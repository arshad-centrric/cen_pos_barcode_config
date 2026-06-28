import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields as _create_custom_fields

def create_custom_fields():
    custom_fields = {
        "Item": [
            {
                "fieldname": "custom_weigh_scale_id",
                "label": "Weigh Scale ID",
                "fieldtype": "Data",
                "unique": 1,
                "insert_after": "disabled"
            }
        ],
        "UOM": [
            {
                "fieldname": "custom_weigh_scale_code",
                "label": "Weigh Scale Code",
                "fieldtype": "Data",
                "insert_after": "uom_name"
            }
        ]
    }
    
    _create_custom_fields(custom_fields)
