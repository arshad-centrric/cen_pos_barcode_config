frappe.provide('cen_pos_barcode_config');

$(document).ready(function() {
    try {
        if (frappe.get_route() && frappe.get_route()[0] === 'point-of-sale') {
            cen_pos_barcode_config.init_cart_order();
        }
    } catch (error) {
        console.error("[POS Cart Order] Error during route init:", error);
    }
});

$(document).on('page-change', function() {
    try {
        if (frappe.get_route() && frappe.get_route()[0] === 'point-of-sale') {
            cen_pos_barcode_config.init_cart_order();
        }
    } catch (error) {
        console.error("[POS Cart Order] Error during route change:", error);
    }
});

cen_pos_barcode_config.init_cart_order = function() {
    if (window._pos_cart_order_init) return;
    window._pos_cart_order_init = true;

    // Feature: Reverse Item Cart Order (Latest First)
    let cart_attempts = 0;
    const check_cart_ready = setInterval(() => {
        try {
            cart_attempts++;
            if (window.erpnext && window.erpnext.PointOfSale && window.erpnext.PointOfSale.ItemCart) {
                clearInterval(check_cart_ready);
                if (!window.erpnext.PointOfSale.ItemCart.prototype._cen_cart_overridden) {
                    window.erpnext.PointOfSale.ItemCart.prototype._cen_cart_overridden = true;
                    
                    const original_update_item_html = window.erpnext.PointOfSale.ItemCart.prototype.update_item_html;
                    window.erpnext.PointOfSale.ItemCart.prototype.update_item_html = function(item, remove_item) {
                        original_update_item_html.apply(this, arguments);
                        
                        if (!remove_item && this.$cart_items_wrapper) {
                            try {
                                const $item = this.get_cart_item(item);
                                if ($item && $item.length) {
                                    const $separator = $item.next('.seperator');
                                    if ($separator && $separator.length) {
                                        this.$cart_items_wrapper.prepend($separator);
                                    }
                                    this.$cart_items_wrapper.prepend($item);
                                    
                                    // Scroll to top to ensure visibility of latest item
                                    this.$cart_items_wrapper.animate({ scrollTop: 0 }, 150);
                                }
                            } catch(e) {
                                console.error("[POS Cart Order] Error reordering cart:", e);
                            }
                        }
                    };
                }
            } else if (cart_attempts > 20) {
                clearInterval(check_cart_ready);
            }
        } catch (err) {
            clearInterval(check_cart_ready);
        }
    }, 500);
};
