frappe.provide('cen_pos_barcode_config');

$(document).ready(function() {
    try {
        if (frappe.get_route() && frappe.get_route()[0] === 'point-of-sale') {
            cen_pos_barcode_config.init_barcode_interceptor();
        }
    } catch (error) {
        console.error("[Weigh Scale Interceptor] Error during route init:", error);
    }
});

$(document).on('page-change', function() {
    try {
        if (frappe.get_route() && frappe.get_route()[0] === 'point-of-sale') {
            cen_pos_barcode_config.init_barcode_interceptor();
        }
    } catch (error) {
        console.error("[Weigh Scale Interceptor] Error during route change:", error);
    }
});

cen_pos_barcode_config.init_barcode_interceptor = function() {
    if (window._weigh_scale_interceptor_init) return;
    window._weigh_scale_interceptor_init = true;

    frappe.db.get_doc('Weigh Scale Settings').then(settings => {
        try {
            if (!settings || !settings.barcode_length) return;

            let attempts = 0;
            const check_pos_ready = setInterval(() => {
                try {
                    attempts++;
                    if (window.erpnext && window.erpnext.PointOfSale && window.erpnext.PointOfSale.ItemSelector) {
                        clearInterval(check_pos_ready);
                        
                        const original_filter_items = window.erpnext.PointOfSale.ItemSelector.prototype.filter_items;
                        
                        window.erpnext.PointOfSale.ItemSelector.prototype.filter_items = function({ search_term = "" } = {}) {
                            try {
                                const prefix = settings.barcode_prefix || "0";
                                // Strict Validation: Check Length AND Prefix
                                if (search_term && search_term.length === settings.barcode_length && search_term.startsWith(prefix)) {
                                    console.log(`[Weigh Scale Interceptor] Valid Barcode Intercepted: ${search_term}`);
                                    cen_pos_barcode_config.process_weigh_scale_barcode(search_term, settings);
                                    
                                    // Block standard POS behavior
                                    this.set_search_value("");
                                    return; 
                                }
                            } catch(err) {
                                console.error("[Weigh Scale Interceptor] Validation error:", err);
                            }
                            
                            return original_filter_items.apply(this, arguments);
                        };
                    } else if (attempts > 20) { 
                        clearInterval(check_pos_ready);
                    }
                } catch (intervalErr) {
                    clearInterval(check_pos_ready);
                }
            }, 500);

        } catch (error) {
            console.error(error);
        }
    });
};

cen_pos_barcode_config.process_weigh_scale_barcode = function(barcode, settings) {
    try {
        let s_item = parseInt(settings.item_code_start, 10);
        let e_item = parseInt(settings.item_code_end, 10);
        let s_qty = parseInt(settings.qty_start, 10);
        let e_qty = parseInt(settings.qty_end, 10);

        // 1-Based UX Translation
        // The user configures start indices as 1-based (e.g., 1 for the first character).
        // JavaScript substring is 0-based. So we subtract 1 from start, but leave end untouched.
        const item_code_str = barcode.substring(s_item - 1, e_item).trim();
        const qty_str = barcode.substring(s_qty - 1, e_qty).trim();
        
        // Math Conversion: Division by Weight Divisor
        const weight_divisor = parseFloat(settings.weight_divisor) || 1000.0;
        const qty_value = parseFloat(qty_str) / weight_divisor;
        
        console.log(`[Weigh Scale Interceptor] Extracted - Barcode: ${item_code_str}, Qty: ${qty_value}`);

        // Native DB Lookup via POS Barcode Scanner API
        frappe.call({
            method: "erpnext.selling.page.point_of_sale.point_of_sale.search_for_serial_or_batch_or_barcode_number",
            args: { search_value: item_code_str },
            callback: function(r) {
                try {
                    let results = r.message;
                    if (results && results.item_code) {
                        const item_code = results.item_code;
                        const final_uom = results.uom;

                        if (window.cur_pos && window.cur_pos.item_selector) {
                            window.cur_pos.item_selector.get_items({ search_term: item_code }).then(({ message }) => {
                                if (message && message.items && message.items.length > 0) {
                                    let pos_item = message.items[0];
                                    
                                    // UOM MAPPING OVERRIDE
                                    let target_uom = final_uom || pos_item.stock_uom;
                                    
                                    let args_item = {
                                        item_code: pos_item.item_code,
                                        batch_no: pos_item.batch_no,
                                        serial_no: pos_item.serial_no,
                                        uom: target_uom,
                                        rate: pos_item.price_list_rate || 0,
                                        stock_uom: pos_item.stock_uom
                                    };

                                    // Find existing item in the cart matching item_code and target_uom
                                    let items = window.cur_pos.frm.doc.items || [];
                                    let item_row = items.find(i => 
                                        i.item_code === args_item.item_code && 
                                        i.uom === target_uom && 
                                        (!args_item.batch_no || i.batch_no === args_item.batch_no)
                                    );
                                    let final_qty = qty_value;
                                    
                                    // Cart Injection (Accumulate or Add)
                                    if (item_row) {
                                        final_qty = flt(item_row.qty) + flt(qty_value);
                                        frappe.model.set_value(item_row.doctype, item_row.name, "qty", final_qty).then(() => {
                                            window.cur_pos.update_cart_html(item_row);
                                            frappe.show_alert({ message: `Updated ${item_code} quantity`, indicator: 'green' });
                                        });
                                    } else {
                                        window.cur_pos.on_cart_update({
                                            field: "qty",
                                            value: final_qty,
                                            item: args_item
                                        }).then(() => {
                                            let items = window.cur_pos.frm.doc.items;
                                            if (items && items.length > 0) {
                                                let last_row = items[items.length - 1];
                                                
                                                if (last_row.item_code === item_code && last_row.uom !== target_uom) {
                                                    // Safely update the model
                                                    frappe.model.set_value(last_row.doctype, last_row.name, "uom", target_uom).then(() => {
                                                        // Immediately update UI so user sees the change
                                                        window.cur_pos.update_cart_html(last_row);
                                                        
                                                        // Attempt to trigger server-side recalculation for conversion factor/rates
                                                        try {
                                                            window.cur_pos.frm.script_manager.trigger("uom", last_row.doctype, last_row.name)
                                                                .then(() => {
                                                                    window.cur_pos.update_cart_html(last_row);
                                                                })
                                                                .catch(err => console.warn("[Weigh Scale Interceptor] UOM Trigger warning:", err));
                                                        } catch (triggerErr) {
                                                            console.warn("[Weigh Scale Interceptor] Failed to trigger UOM:", triggerErr);
                                                        }
                                                    }).catch(setErr => {
                                                        console.error("[Weigh Scale Interceptor] Failed to set UOM:", setErr);
                                                    });
                                                }
                                            }
                                        }).catch(err => {
                                            console.error("[Weigh Scale Interceptor] cart update error:", err);
                                        });
                                    }
                                } else {
                                    console.warn(`[Weigh Scale Interceptor] POS get_items failed to return item for: ${item_code}`);
                                }
                            });
                        }
                } else {
                    frappe.show_alert({ message: `Item not found for Barcode: ${item_code_str}`, indicator: 'red' });
                }
            } catch(innerErr) {
                console.error("[Weigh Scale Interceptor] Result processing error:", innerErr);
            }
        }});
    } catch(err) {
        console.error("[Weigh Scale Interceptor] Parsing error:", err);
    }
};
