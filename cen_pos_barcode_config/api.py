import frappe

def generate_weigh_scale_barcode(doc, method):
    # 1. Flag Verification
    if not doc.get("custom_is_weigh_scale_item"):
        return

    # 2. Concurrency-Safe Database Lock
    # Fetch settings with a pessimistic lock
    try:
        settings = frappe.db.get_value(
            "Weigh Scale Settings",
            "Weigh Scale Settings",
            ["barcode_sequence_format", "last_generated_sequence"],
            as_dict=True,
            for_update=True
        )
    except frappe.DoesNotExistError:
        settings = None

    if not settings:
        settings = {
            "barcode_sequence_format": "###",
            "last_generated_sequence": 0
        }

    format_str = settings.get("barcode_sequence_format") or "###"
    last_seq = frappe.utils.cint(settings.get("last_generated_sequence"))

    # 3. Calculate and Parse Sequence
    next_seq = last_seq + 1
    pad_width = format_str.count('#')
    if pad_width <= 0:
        pad_width = 3

    barcode_val = str(next_seq).zfill(pad_width)

    # 4. Assign the Barcode
    # Append to child table 'barcodes'
    doc.append("barcodes", {
        "barcode": barcode_val
    })
    
    # Update main barcode field if it exists (standard Item doctype has 'barcode' field)
    if doc.meta.has_field("barcode") and not doc.barcode:
        doc.barcode = barcode_val

    # 5. Update the Counter
    # Use raw SQL to bypass full ORM save operations for high-speed barcode generation
    frappe.db.sql(
        """
        UPDATE `tabSingles` 
        SET value = %s 
        WHERE doctype = 'Weigh Scale Settings' 
        AND field = 'last_generated_sequence'
        """,
        (next_seq,)
    )

@frappe.whitelist(allow_guest=False)
def get_barcode_uom(barcode):
    return frappe.db.get_value("Item Barcode", {"barcode": barcode}, ["parent", "uom"], as_dict=True)
