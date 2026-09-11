import frappe

@frappe.whitelist(allow_guest=True)
def get_print_payload(item_code, template_name=None, price_list="Standard Selling"):
    """
    Fetch data payload for desktop barcode printer application.
    """
    # 1. Fetch the Item details
    item_details = frappe.db.get_value("Item", item_code, ["item_name", "item_group"], as_dict=True)
    
    if not item_details:
        frappe.throw(f"Item {item_code} not found")

    # 2. Fetch the Item's selling price
    price = 0.0
    item_prices = frappe.get_all(
        "Item Price",
        filters={"item_code": item_code, "selling": 1},
        fields=["price_list", "price_list_rate"]
    )
    
    if item_prices:
        requested_price = next((p for p in item_prices if p.price_list == price_list), None)
        if requested_price:
            price = requested_price.price_list_rate
        else:
            # Fallback to Standard Selling or first available
            standard_price = next((p for p in item_prices if p.price_list == "Standard Selling"), None)
            if standard_price:
                price = standard_price.price_list_rate
            else:
                price = item_prices[0].price_list_rate

    # 3. Fetch the 'tspl_code' from the 'TSPL Printer Template'
    if not template_name:
        template_name = frappe.db.get_value("TSPL Printer Template", {"is_default": 1}, "name")
        
    if not template_name:
        frappe.throw("No template_name provided and no default template is set.")
        
    tspl_code = frappe.db.get_value("TSPL Printer Template", template_name, "tspl_code")
    
    if not tspl_code:
        frappe.throw(f"TSPL Printer Template '{template_name}' not found or has no TSPL code.")

    # 4. Render the TSPL template with Jinja
    context = {
        "item_code": item_code,
        "item_name": item_details.get("item_name"),
        "price": price,
        "company_name": frappe.defaults.get_user_default("Company")
    }
    rendered_tspl = frappe.render_template(tspl_code, context)

    # 5. Return structured JSON payload
    return {
        "item_code": item_code,
        "item_name": item_details.get("item_name"),
        "item_group": item_details.get("item_group"),
        "standard_selling_rate": price,
        "template": rendered_tspl
    }

@frappe.whitelist(allow_guest=True)
def get_app_settings():
    """
    Initialization API for desktop client cold start.
    """
    company_name = frappe.defaults.get_user_default("Company")
    default_template = frappe.db.get_value("TSPL Printer Template", {"is_default": 1}, "name")
    
    return {
        "company_name": company_name or "Unknown Company",
        "default_template": default_template or None
    }

@frappe.whitelist(allow_guest=True)
def search_items(search_key="", limit_start=1, limit_page_length=20):
    """
    Lightweight dedicated paginated search endpoint for desktop application.
    """
    limit_start = frappe.utils.cint(limit_start)
    limit_page_length = frappe.utils.cint(limit_page_length)
    
    # Translate 1-based start index to 0-based database offset
    db_start = limit_start - 1 if limit_start > 0 else 0

    if not search_key:
        return []
        
    wildcard_term = f"%{search_key}%"
    
    return frappe.get_all(
        "Item",
        filters={"disabled": 0},
        or_filters={
            "name": ("like", wildcard_term),
            "item_name": ("like", wildcard_term),
            "item_group": ("like", wildcard_term)
        },
        fields=["name as item_code", "item_name", "item_group"],
        limit_start=db_start,
        limit_page_length=limit_page_length
    )

@frappe.whitelist()
def get_allowed_selling_price_lists():
    """
    Fetch all selling price lists the current user is authorized to access.
    """
    return frappe.get_list(
        "Price List",
        filters={"selling": 1, "enabled": 1},
        fields=["name"]
    )

@frappe.whitelist()
def get_repack_stock_entry_list(search_key="", limit_start=1, limit_page_length=20):
    """
    Paginated search endpoint to fetch submitted Repack Stock Entries.
    """
    limit_start = frappe.utils.cint(limit_start)
    limit_page_length = frappe.utils.cint(limit_page_length)
    
    # Translate 1-based start index to 0-based database offset
    db_start = max(0, limit_start - 1)
    
    filters = {
        "docstatus": 1,
        "stock_entry_type": "Repack"
    }
    
    if search_key:
        filters["name"] = ("like", f"%{search_key}%")
        
    fields = ["name", "posting_date", "posting_time", "company", "to_warehouse"]
    
    # Check for branch fields securely
    has_branch = frappe.get_meta("Stock Entry").has_field("branch")
    has_custom_branch = frappe.get_meta("Stock Entry").has_field("custom_cen_branch")
    if has_branch:
        fields.append("branch")
    elif has_custom_branch:
        fields.append("custom_cen_branch")
        
    stock_entries = frappe.get_list(
        "Stock Entry",
        filters=filters,
        fields=fields,
        order_by="creation desc",
        limit_start=db_start,
        limit_page_length=limit_page_length
    )
    
    if not stock_entries:
        return []
        
    se_names = [se.name for se in stock_entries]
    
    # Fetch details to identify the finished product
    details = frappe.get_all(
        "Stock Entry Detail",
        filters={"parent": ("in", se_names)},
        fields=["parent", "item_code", "item_name", "qty", "t_warehouse", "s_warehouse", "is_finished_item"]
    )
    
    item_map = {}
    for d in details:
        # A finished item in Repack is either explicitly marked or has a target warehouse but no source warehouse
        if d.is_finished_item or (d.t_warehouse and not d.s_warehouse):
            if d.parent not in item_map:
                item_map[d.parent] = d
                
    response = []
    for se in stock_entries:
        finished_item = item_map.get(se.name) or {}
        
        branch_val = ""
        if has_branch:
            branch_val = se.get("branch") or ""
        elif has_custom_branch:
            branch_val = se.get("custom_cen_branch") or ""
            
        response.append({
            "id": se.name,
            "posting_date": se.posting_date,
            "posting_time": se.posting_time,
            "company": se.company,
            "target_warehouse": se.to_warehouse or finished_item.get("t_warehouse") or "",
            "item_code": finished_item.get("item_code") or "",
            "item_name": finished_item.get("item_name") or "",
            "qty": finished_item.get("qty") or 0.0,
            "branch": branch_val
        })
        
    return response

@frappe.whitelist()
def get_repack_print_payload(stock_entry_id, template_name, price_list="Standard Selling"):
    """
    Generate barcode print payload and copy count for a Repack Stock Entry.
    """
    if not frappe.has_permission("Stock Entry", "read", stock_entry_id):
        frappe.throw("Not permitted", frappe.PermissionError)
        
    se_doc = frappe.get_doc("Stock Entry", stock_entry_id)
    
    # Identify finished good
    finished_row = None
    for row in se_doc.items:
        if row.is_finished_item or (row.t_warehouse and not row.s_warehouse):
            finished_row = row
            break
            
    if not finished_row:
        frappe.throw(f"No Finished Good found in Stock Entry {stock_entry_id}", frappe.ValidationError)
        
    # Fetch Item Price
    price = 0.0
    item_prices = frappe.get_all(
        "Item Price",
        filters={"item_code": finished_row.item_code, "selling": 1},
        fields=["price_list", "price_list_rate"]
    )
    
    if item_prices:
        requested_price = next((p for p in item_prices if p.price_list == price_list), None)
        if requested_price:
            price = requested_price.price_list_rate
        else:
            standard_price = next((p for p in item_prices if p.price_list == "Standard Selling"), None)
            if standard_price:
                price = standard_price.price_list_rate
            else:
                price = item_prices[0].price_list_rate
                
    # Fetch TSPL Template
    if not template_name:
        template_name = frappe.db.get_value("TSPL Printer Template", {"is_default": 1}, "name")
        
    if not template_name:
        frappe.throw("No TSPL Printer Template provided and no default template is set.")
        
    tspl_code = frappe.db.get_value("TSPL Printer Template", template_name, "tspl_code")
    if not tspl_code:
        frappe.throw(f"TSPL Printer Template '{template_name}' not found or has no TSPL code.")
        
    # Render TSPL Template
    context = {
        "item_code": finished_row.item_code,
        "item_name": finished_row.item_name,
        "company": se_doc.company,
        "price": price
    }
    rendered_tspl = frappe.render_template(tspl_code, context)
    
    return {
        "stock_entry_id": stock_entry_id,
        "item_code": finished_row.item_code,
        "item_name": finished_row.item_name,
        "item_group": finished_row.item_group,
        "price": price,
        "qty": float(finished_row.qty),
        "copies": int(finished_row.qty),
        "template": rendered_tspl
    }

