import frappe

@frappe.whitelist(allow_guest=True)
def get_print_payload(item_code, template_name=None):
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
        # Find "Standard Selling" or fallback to first available
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
