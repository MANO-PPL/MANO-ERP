// Unit registry inline (mirrors backend unitRegistry.js)
export const UNIT_REGISTRY = {
    // weight
    'kg': { name: 'Kilogram', symbol: 'kg', type: 'weight', factor: 1.0, isBase: true },
    'g': { name: 'Gram', symbol: 'g', type: 'weight', factor: 0.001 },
    'mg': { name: 'Milligram', symbol: 'mg', type: 'weight', factor: 0.000001 },
    'MT': { name: 'Metric Ton', symbol: 'MT', type: 'weight', factor: 1000.0 },
    'lb': { name: 'Pound', symbol: 'lb', type: 'weight', factor: 0.45359237 },
    'oz': { name: 'Ounce', symbol: 'oz', type: 'weight', factor: 0.02834952 },

    // volume
    'L': { name: 'Liter', symbol: 'L', type: 'volume', factor: 1.0, isBase: true },
    'ml': { name: 'Milliliter', symbol: 'ml', type: 'volume', factor: 0.001 },
    'cum': { name: 'Cubic Meter', symbol: 'cum', type: 'volume', factor: 1000.0 },
    'cft': { name: 'Cubic Foot', symbol: 'cft', type: 'volume', factor: 28.316846 },
    'gal': { name: 'Gallon', symbol: 'gal', type: 'volume', factor: 3.785412 },

    // length
    'm': { name: 'Meter', symbol: 'm', type: 'length', factor: 1.0, isBase: true },
    'cm': { name: 'Centimeter', symbol: 'cm', type: 'length', factor: 0.01 },
    'mm': { name: 'Millimeter', symbol: 'mm', type: 'length', factor: 0.001 },
    'km': { name: 'Kilometer', symbol: 'km', type: 'length', factor: 1000.0 },
    'in': { name: 'Inch', symbol: 'in', type: 'length', factor: 0.0254 },
    'ft': { name: 'Foot', symbol: 'ft', type: 'length', factor: 0.3048 },
    'yd': { name: 'Yard', symbol: 'yd', type: 'length', factor: 0.9144 },
    'RFT': { name: 'Running Foot', symbol: 'RFT', type: 'length', factor: 0.3048 },

    // area
    'sqm': { name: 'Square Meter', symbol: 'sqm', type: 'area', factor: 1.0, isBase: true },
    'sqft': { name: 'Square Foot', symbol: 'sqft', type: 'area', factor: 0.09290304 },
    'sqin': { name: 'Square Inch', symbol: 'sqin', type: 'area', factor: 0.00064516 },
    'acre': { name: 'Acre', symbol: 'acre', type: 'area', factor: 4046.8564 },
    'hectare': { name: 'Hectare', symbol: 'ha', type: 'area', factor: 10000.0 },

    // count
    'Nos': { name: 'Number/Each', symbol: 'Nos', type: 'count', factor: 1.0, isBase: true },
    'doz': { name: 'Dozen', symbol: 'doz', type: 'count', factor: 12.0 },
    'pair': { name: 'Pair', symbol: 'pair', type: 'count', factor: 2.0 },
    'set': { name: 'Set', symbol: 'set', type: 'count', factor: 1.0 },

    // time
    'hr': { name: 'Hour', symbol: 'hr', type: 'time', factor: 1.0, isBase: true },
    'sec': { name: 'Second', symbol: 'sec', type: 'time', factor: 0.000277778 },
    'min': { name: 'Minute', symbol: 'min', type: 'time', factor: 0.01666667 },
    'day': { name: 'Day', symbol: 'day', type: 'time', factor: 24.0 },
    'wk': { name: 'Week', symbol: 'wk', type: 'time', factor: 168.0 },
    'month': { name: 'Month', symbol: 'mo', type: 'time', factor: 720.0 },
    'yr': { name: 'Year', symbol: 'yr', type: 'time', factor: 8760.0 }
};

export const UNIT_OPTIONS = Object.entries(UNIT_REGISTRY).map(([code, u]) => ({
    code, ...u
}));

export const UNIT_GROUPS = UNIT_OPTIONS.reduce((acc, u) => {
    if (!acc[u.type]) acc[u.type] = [];
    acc[u.type].push(u);
    return acc;
}, {});

export function getUnit(code) {
    const unit = UNIT_REGISTRY[code];
    if (!unit) throw new Error(`Invalid unit code: "${code}"`);
    return unit;
}

export function convert(fromCode, toCode, quantity) {
    const fromUnit = getUnit(fromCode);
    const toUnit = getUnit(toCode);
    if (fromUnit.type !== toUnit.type) {
        throw new Error(`Incompatible unit types: Cannot convert from "${fromCode}" (${fromUnit.type}) to "${toCode}" (${toUnit.type})`);
    }
    const valueInBase = quantity * (fromUnit.factor || 1.0);
    return valueInBase / (toUnit.factor || 1.0);
}
