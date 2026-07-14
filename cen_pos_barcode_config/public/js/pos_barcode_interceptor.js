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

    // Task 1: Fetching the New Schema (including condition_rules child table)
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
                                // Task 2: Dynamic Slicing & Rule Matching
                                if (search_term && search_term.length === settings.barcode_length) {
                                    // 1-Based UX Translation to 0-Based JS indexing for condition slice
                                    let s_cond = parseInt(settings.condition_start, 10);
                                    let e_cond = parseInt(settings.condition_end, 10);
                                    
                                    // Slice barcode to extract condition
                                    const cond_str = search_term.substring(s_cond - 1, e_cond).trim();
                                    
                                    // Verify against Condition Rules
                                    const condition_rules = settings.condition_rules || [];
                                    const matched_rule = condition_rules.find(r => r.condition_code === cond_str);
                                    
                                    // If a match is found, proceed with custom logic
                                    if (matched_rule) {
                                        console.log(`[Weigh Scale Interceptor] Valid Barcode Intercepted for rule ${cond_str}: ${search_term}`);
                                        cen_pos_barcode_config.process_weigh_scale_barcode(search_term, settings, matched_rule);
                                        
                                        // Block standard POS behavior
                                        this.set_search_value("");
                                        return; 
                                    }
                                    // If no match, we exit this block naturally and let the POS handle it standardly
                                }
                            } catch(err) {
                                console.error("[Weigh Scale Interceptor] Validation error:", err);
                            }
                            
                            // Let the standard POS logic process it
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

cen_pos_barcode_config.process_weigh_scale_barcode = frappe.utils.debounce(async function(barcode, settings, matched_rule) {
    try {
        let s_item = parseInt(settings.item_code_start, 10);
        let e_item = parseInt(settings.item_code_end, 10);
        let s_qty = parseInt(settings.qty_start, 10);
        let e_qty = parseInt(settings.qty_end, 10);

        // Task 3: Dynamic Calculation & Assignment
        const item_code_str = barcode.substring(s_item - 1, e_item).trim();
        const qty_str = barcode.substring(s_qty - 1, e_qty).trim();
        
        let qty_value = parseFloat(qty_str);
        if (matched_rule.apply_divisor === 1 && matched_rule.divisor_value) {
            qty_value = qty_value / parseFloat(matched_rule.divisor_value);
        }
        
        console.log(`[Weigh Scale Interceptor] Extracted - Barcode: ${item_code_str}, Qty: ${qty_value}, Target UOM: ${matched_rule.target_uom}`);

        // Async Native DB Lookup via POS Barcode Scanner API
        let r = await frappe.call({
            method: "erpnext.selling.page.point_of_sale.point_of_sale.search_for_serial_or_batch_or_barcode_number",
            args: { search_value: item_code_str }
        });

        let results = r.message;
        if (!results || !results.item_code) {
            frappe.show_alert({ message: `Item not found for Barcode: ${item_code_str}`, indicator: 'red' });
            return;
        }

        const item_code = results.item_code;

        if (window.cur_pos && window.cur_pos.item_selector) {
            let item_res = await window.cur_pos.item_selector.get_items({ search_term: item_code });
            let message = item_res.message;

            if (message && message.items && message.items.length > 0) {
                let pos_item = message.items[0];
                let target_uom = matched_rule.target_uom || pos_item.stock_uom;
                
                let args_item = {
                    item_code: pos_item.item_code,
                    batch_no: pos_item.batch_no,
                    serial_no: pos_item.serial_no,
                    uom: target_uom,
                    rate: pos_item.price_list_rate || 0,
                    stock_uom: pos_item.stock_uom
                };

                let items = window.cur_pos.frm.doc.items || [];
                let item_row = items.find(i => 
                    i.item_code === args_item.item_code && 
                    i.uom === target_uom && 
                    (!args_item.batch_no || i.batch_no === args_item.batch_no)
                );
                
                let final_qty = qty_value;
                
                if (item_row) {
                    // Accumulate existing
                    final_qty = flt(item_row.qty) + flt(qty_value);
                    await frappe.model.set_value(item_row.doctype, item_row.name, "qty", final_qty);
                    window.cur_pos.update_cart_html(item_row);
                    frappe.show_alert({ message: `Updated ${item_code} quantity`, indicator: 'green' });
                } else {
                    // Step 2 & 3: Execute insertion with the "Insert-then-Correct" pattern safely
                    await window.cur_pos.on_cart_update({
                        field: "qty",
                        value: final_qty,
                        item: args_item
                    });

                    let current_items = window.cur_pos.frm.doc.items;
                    if (current_items && current_items.length > 0) {
                        let last_row = current_items[current_items.length - 1];
                        
                        if (last_row.item_code === item_code && last_row.uom !== target_uom) {
                            // Safely override the UOM model value
                            await frappe.model.set_value(last_row.doctype, last_row.name, "uom", target_uom);
                            
                            // Force server-side recalculation of rates and conversion factors
                            try {
                                await window.cur_pos.frm.script_manager.trigger("uom", last_row.doctype, last_row.name);
                            } catch (triggerErr) {
                                console.warn("[Weigh Scale Interceptor] Failed to trigger UOM:", triggerErr);
                            }
                            
                            // Paint the DOM exactly once after everything is fully calculated
                            window.cur_pos.update_cart_html(last_row);
                        }
                    }
                }
            } else {
                console.warn(`[Weigh Scale Interceptor] POS get_items failed to return item for: ${item_code}`);
            }
        }
    } catch(err) {
        console.error("[Weigh Scale Interceptor] Parsing error:", err);
    }
}, 300);
