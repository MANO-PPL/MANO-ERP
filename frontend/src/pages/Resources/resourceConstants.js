// Unit registry inline (mirrors backend)
export const UNIT_REGISTRY = {
    'kg': { name: 'Kilogram', symbol: 'kg', type: 'weight' },
    'g': { name: 'Gram', symbol: 'g', type: 'weight' },
    'mg': { name: 'Milligram', symbol: 'mg', type: 'weight' },
    'MT': { name: 'Metric Ton', symbol: 'MT', type: 'weight' },
    'lb': { name: 'Pound', symbol: 'lb', type: 'weight' },
    'oz': { name: 'Ounce', symbol: 'oz', type: 'weight' },
    'L': { name: 'Liter', symbol: 'L', type: 'volume' },
    'ml': { name: 'Milliliter', symbol: 'ml', type: 'volume' },
    'cum': { name: 'Cubic Meter', symbol: 'cum', type: 'volume' },
    'cft': { name: 'Cubic Foot', symbol: 'cft', type: 'volume' },
    'gal': { name: 'Gallon', symbol: 'gal', type: 'volume' },
    'm': { name: 'Meter', symbol: 'm', type: 'length' },
    'cm': { name: 'Centimeter', symbol: 'cm', type: 'length' },
    'mm': { name: 'Millimeter', symbol: 'mm', type: 'length' },
    'km': { name: 'Kilometer', symbol: 'km', type: 'length' },
    'in': { name: 'Inch', symbol: 'in', type: 'length' },
    'ft': { name: 'Foot', symbol: 'ft', type: 'length' },
    'yd': { name: 'Yard', symbol: 'yd', type: 'length' },
    'RFT': { name: 'Running Foot', symbol: 'RFT', type: 'length' },
    'sqm': { name: 'Square Meter', symbol: 'sqm', type: 'area' },
    'sqft': { name: 'Square Foot', symbol: 'sqft', type: 'area' },
    'sqin': { name: 'Square Inch', symbol: 'sqin', type: 'area' },
    'acre': { name: 'Acre', symbol: 'acre', type: 'area' },
    'hectare': { name: 'Hectare', symbol: 'ha', type: 'area' },
    'Nos': { name: 'Number/Each', symbol: 'Nos', type: 'count' },
    'doz': { name: 'Dozen', symbol: 'doz', type: 'count' },
    'pair': { name: 'Pair', symbol: 'pair', type: 'count' },
    'set': { name: 'Set', symbol: 'set', type: 'count' },
    'hr': { name: 'Hour', symbol: 'hr', type: 'time' },
    'sec': { name: 'Second', symbol: 'sec', type: 'time' },
    'min': { name: 'Minute', symbol: 'min', type: 'time' },
    'day': { name: 'Day', symbol: 'day', type: 'time' },
    'wk': { name: 'Week', symbol: 'wk', type: 'time' },
    'month': { name: 'Month', symbol: 'mo', type: 'time' },
    'yr': { name: 'Year', symbol: 'yr', type: 'time' },
};

export const UNIT_OPTIONS = Object.entries(UNIT_REGISTRY).map(([code, u]) => ({
    code, ...u
}));

export const UNIT_GROUPS = UNIT_OPTIONS.reduce((acc, u) => {
    if (!acc[u.type]) acc[u.type] = [];
    acc[u.type].push(u);
    return acc;
}, {});
