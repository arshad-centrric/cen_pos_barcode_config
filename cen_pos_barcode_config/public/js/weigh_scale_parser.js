window.cen_weigh_scale = {
    parse_weigh_scale_barcode: function(barcode, settings) {
        if (!barcode || !settings || !settings.barcode_length) {
            return { is_weigh_scale: false };
        }

        if (barcode.length !== settings.barcode_length) {
            return { is_weigh_scale: false };
        }

        // Extract condition code (converting 1-based index to 0-based for JS substring)
        let conditionCode = barcode.substring(settings.condition_start - 1, settings.condition_end);
        
        // Check if condition code matches rules
        if (!settings.condition_rules || !Array.isArray(settings.condition_rules)) {
            return { is_weigh_scale: false };
        }
        
        let matchedRule = settings.condition_rules.find(r => r.condition_code === conditionCode);
        if (!matchedRule) {
            return { is_weigh_scale: false };
        }

        // Extract item code
        let itemCode = barcode.substring(settings.item_code_start - 1, settings.item_code_end);

        // Extract quantity
        let rawQtyStr = barcode.substring(settings.qty_start - 1, settings.qty_end);
        let rawQty = parseFloat(rawQtyStr);

        if (isNaN(rawQty)) {
            return { is_weigh_scale: false };
        }

        // Calculate final quantity (default divisor to 1000 if not specified)
        let divisor = matchedRule.divisor_value || 1000;
        let qty = rawQty / divisor;

        return {
            is_weigh_scale: true,
            item_code: itemCode,
            qty: qty,
            uom: matchedRule.target_uom
        };
    }
};
