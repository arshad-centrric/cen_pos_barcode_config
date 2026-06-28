frappe.provide('cen_pos_barcode_config');

// 1. Listen via Frappe Global Event Bus
// 1. Safe entry point - page_js only executes on the point-of-sale page anyway
$(document).ready(function() {
    try {
        if (frappe.get_route() && frappe.get_route()[0] === 'point-of-sale') {
            cen_pos_barcode_config.init_barcode_interceptor();
        }
    } catch (error) {
        console.error("[Weigh Scale Interceptor] Error during route initialization:", error);
    }
});

// 2. Also listen for route changes in case it's a SPA navigation
$(document).on('page-change', function() {
    try {
        if (frappe.get_route() && frappe.get_route()[0] === 'point-of-sale') {
            console.log("[Weigh Scale Interceptor] POS page accessed via route change.");
            cen_pos_barcode_config.init_barcode_interceptor();
        }
    } catch (error) {
        console.error("[Weigh Scale Interceptor] Error during route initialization:", error);
    }
});


cen_pos_barcode_config.init_barcode_interceptor = function() {
    console.log("[Weigh Scale Interceptor] init_barcode_interceptor called.");
    
    // Prevent multiple initializations
    if (window._weigh_scale_interceptor_init) {
        console.log("[Weigh Scale Interceptor] Already initialized, skipping.");
        return;
    }
    window._weigh_scale_interceptor_init = true;

    frappe.db.get_doc('Weigh Scale Settings').then(settings => {
        try {
            console.log("[Weigh Scale Interceptor] Settings fetched successfully:", settings);
            if (!settings || !settings.barcode_length) {
                console.warn("[Weigh Scale Interceptor] Missing barcode_length setting, aborting.");
                return;
            }

            // Monkey Patch the existing ERPNext POS Item Selector!
            let attempts = 0;
            const check_pos_ready = setInterval(() => {
                try {
                    attempts++;
                    if (window.erpnext && window.erpnext.PointOfSale && window.erpnext.PointOfSale.ItemSelector) {
                        console.log("[Weigh Scale Interceptor] ERPNext POS ItemSelector class found! Patching filter_items...");
                        clearInterval(check_pos_ready);
                        
                        const original_filter_items = window.erpnext.PointOfSale.ItemSelector.prototype.filter_items;
                        
                        // Override the search/filter function directly
                        window.erpnext.PointOfSale.ItemSelector.prototype.filter_items = function({ search_term = "" } = {}) {
                            try {
                                if (search_term && search_term.length === settings.barcode_length) {
                                    console.log(`[Weigh Scale Interceptor] Intercepted inside POS ItemSelector: ${search_term}`);
                                    cen_pos_barcode_config.process_weigh_scale_barcode(search_term, settings);
                                    this.set_search_value(""); // Clear the POS search bar
                                    return; // Stop standard search
                                }
                            } catch(err) {
                                console.error("[Weigh Scale Interceptor] Error in patched filter_items:", err);
                            }
                            
                            // If it's not a weigh scale barcode, let standard POS handle it
                            return original_filter_items.apply(this, arguments);
                        };
                        
                        console.log("[Weigh Scale Interceptor] POS filter_items successfully patched.");
                    } else if (attempts > 20) { 
                        // Give up after 10 seconds
                        console.log("[Weigh Scale Interceptor] Gave up waiting for erpnext.PointOfSale.ItemSelector class.");
                        clearInterval(check_pos_ready);
                    }
                } catch (intervalErr) {
                    console.error("[Weigh Scale Interceptor] Error inside patcher interval:", intervalErr);
                    clearInterval(check_pos_ready);
                }
            }, 500);

        } catch (error) {
            console.error("[Weigh Scale Interceptor] Error processing fetched settings:", error);
        }
    }).catch(err => {
        console.error("[Weigh Scale Interceptor] Failed to fetch settings:", err);
    });
};

cen_pos_barcode_config.process_weigh_scale_barcode = function(barcode, settings) {
    console.log(`[Weigh Scale Interceptor] Parsing barcode: ${barcode}`);
    try {
        let s_item = parseInt(settings.item_code_start, 10);
        let e_item = parseInt(settings.item_code_end, 10);
        let s_uom = parseInt(settings.uom_code_start, 10);
        let e_uom = parseInt(settings.uom_code_end, 10);
        let s_qty = parseInt(settings.qty_start, 10);
        let e_qty = parseInt(settings.qty_end, 10);

        // Auto-detect 1-based vs 0-based indexing
        let offset = (s_item === 1) ? 1 : 0;
        
        // Auto-correct common user mistakes (if they change start to 1 but forget to shift the other starts)
        if (offset === 1 && s_uom === e_item) s_uom += 1;
        if (offset === 1 && s_qty === e_uom) s_qty += 1;

        const item_code_str = barcode.substring(s_item - offset, e_item).trim();
        const uom_code_str = barcode.substring(s_uom - offset, e_uom).trim();
        const qty_str = barcode.substring(s_qty - offset, e_qty).trim();
        
        const qty_value = parseFloat(qty_str) / Math.pow(10, settings.qty_decimal_places);
        
        console.log(`[Weigh Scale Interceptor] Parsed values - Item: '${item_code_str}', UOM: '${uom_code_str}', Qty: ${qty_value}`);

        Promise.all([
            frappe.db.get_value('Item', { 'custom_weigh_scale_id': item_code_str }, 'name'),
            frappe.db.get_value('UOM', { 'custom_weigh_scale_code': uom_code_str }, 'name').then(res => {
                // If "08" fails, try looking up "8" just in case they saved it as an integer in the DB
                if (!res || !res.message) {
                    const int_uom = parseInt(uom_code_str, 10).toString();
                    return frappe.db.get_value('UOM', { 'custom_weigh_scale_code': int_uom }, 'name');
                }
                return res;
            })
        ]).then(results => {
            try {
                const item_result = results[0];
                const uom_result = results[1];

                if (item_result && item_result.message && item_result.message.name) {
                    const item_code = item_result.message.name;
                    const uom = (uom_result && uom_result.message) ? uom_result.message.name : null;
                    
                    console.log(`[Weigh Scale Interceptor] DB matches - Real Item: ${item_code}, Real UOM: ${uom}`);

                    if (window.cur_pos && window.cur_pos.item_selector) {
                        // Fetch full item details (like price_list_rate) required by POS via standard backend call
                        window.cur_pos.item_selector.get_items({ search_term: item_code }).then(({ message }) => {
                            try {
                                if (message && message.items && message.items.length > 0) {
                                    let pos_item = message.items[0];
                                    let final_uom = uom || pos_item.uom;
                                    
                                    let args_item = {
                                        item_code: pos_item.item_code,
                                        batch_no: pos_item.batch_no,
                                        serial_no: pos_item.serial_no,
                                        uom: final_uom,
                                        rate: pos_item.price_list_rate || 0,
                                        stock_uom: pos_item.stock_uom
                                    };

                                    // Check if item already exists in cart to accumulate qty correctly
                                    let item_row = window.cur_pos.get_item_from_frm(args_item);
                                    let final_qty = qty_value;
                                    
                                    if (item_row && !$.isEmptyObject(item_row)) {
                                        final_qty = flt(item_row.qty) + flt(qty_value);
                                        console.log(`[Weigh Scale Interceptor] Item already in cart. Updating qty to ${final_qty}`);
                                        
                                        // Standard on_cart_update ignores arbitrary quantity updates for existing items unless edited.
                                        // We force the update directly on the model:
                                        frappe.model.set_value(item_row.doctype, item_row.name, "qty", final_qty).then(() => {
                                            window.cur_pos.update_cart_html(item_row);
                                            frappe.show_alert({ message: `Updated ${item_code} quantity to ${final_qty} ${final_uom}`, indicator: 'green' });
                                        });
                                    } else {
                                        // Safely trigger standard POS add_to_cart flow for new items
                                        window.cur_pos.item_selector.events.item_selected({
                                            field: "qty",
                                            value: final_qty,
                                            item: args_item
                                        }).then(() => {
                                            // ERPNext triggers 'item_code' field event on new rows which forcibly fetches 
                                            // the default Sales UOM and overwrites our passed UOM. 
                                            // We use setTimeout to ensure all ERPNext async UI tasks finish before we restore it.
                                            setTimeout(() => {
                                                let items = window.cur_pos.frm.doc.items;
                                                if (items && items.length > 0) {
                                                    let last_row = items[items.length - 1];
                                                    console.log(`[Weigh Scale Interceptor] Post-add check - Expected UOM: ${final_uom}, Actual UOM: ${last_row.uom}`);
                                                    
                                                    if (last_row.item_code === item_code && last_row.uom !== final_uom) {
                                                        console.log(`[Weigh Scale Interceptor] Restoring UOM to ${final_uom} (ERPNext changed it to ${last_row.uom})`);
                                                        frappe.model.set_value(last_row.doctype, last_row.name, "uom", final_uom).then(() => {
                                                            window.cur_pos.update_cart_html(last_row);
                                                            frappe.show_alert({ message: `UOM Corrected to ${final_uom}`, indicator: 'green' });
                                                        });
                                                    }
                                                }
                                            }, 300);
                                        });
                                        frappe.show_alert({ message: `Added ${qty_value} ${final_uom} of ${item_code} from Weigh Scale`, indicator: 'green' });
                                    }
                                } else {
                                    frappe.show_alert({ message: `Item ${item_code} not available in current POS Price List.`, indicator: 'orange' });
                                }
                            } catch (itemErr) {
                                console.error("[Weigh Scale Interceptor] Error during POS item injection:", itemErr);
                            }
                        });
                    } else {
                        console.warn("[Weigh Scale Interceptor] POS interface (cur_pos) is not fully loaded.");
                    }
                } else {
                    frappe.show_alert({ message: `Weigh Scale Item not found for ID: ${item_code_str}`, indicator: 'red' });
                    console.error(`[Weigh Scale Interceptor] DB lookup failed for ID: ${item_code_str}`);
                }
            } catch(innerErr) {
                console.error("[Weigh Scale Interceptor] Error processing DB lookup results:", innerErr);
            }
        }).catch(dbErr => {
            console.error("[Weigh Scale Interceptor] DB query promise failed:", dbErr);
        });
    } catch(err) {
        console.error("[Weigh Scale Interceptor] Error during parsing phase:", err);
    }
};
