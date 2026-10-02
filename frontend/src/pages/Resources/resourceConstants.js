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

export const UNIT_ALIASES = {
    // volume
    'litre': 'L',
    'liter': 'L',
    'litres': 'L',
    'liters': 'L',
    'ltr': 'L',
    'ltrs': 'L',
    'lt': 'L',
    'l': 'L',
    'cu.m': 'cum',
    'cu m': 'cum',
    'cu-m': 'cum',
    'm3': 'cum',
    'm^3': 'cum',
    'cubic meter': 'cum',
    'cubic meters': 'cum',
    'cubic metre': 'cum',
    'cu.ft': 'cft',
    'cu ft': 'cft',
    'cu-ft': 'cft',
    'ft3': 'cft',
    'ft^3': 'cft',
    'cubic feet': 'cft',
    'cubic foot': 'cft',
    'cubic ft': 'cft',
    'gallon': 'gal',
    'gallons': 'gal',

    // area
    'sq.ft': 'sqft',
    'sq ft': 'sqft',
    'sq-ft': 'sqft',
    'sqft': 'sqft',
    'square feet': 'sqft',
    'square foot': 'sqft',
    'sq. feet': 'sqft',
    'sq feet': 'sqft',
    'sq. foot': 'sqft',
    'sqfeet': 'sqft',
    'sq.m': 'sqm',
    'sq m': 'sqm',
    'sq-m': 'sqm',
    'sqm': 'sqm',
    'square meter': 'sqm',
    'square meters': 'sqm',
    'square metre': 'sqm',
    'sq. meter': 'sqm',
    'sq.in': 'sqin',
    'sq in': 'sqin',
    'sq-in': 'sqin',
    'sqin': 'sqin',
    'square inch': 'sqin',
    'square inches': 'sqin',
    'ha': 'hectare',

    // weight
    'kilogram': 'kg',
    'kilograms': 'kg',
    'kilo': 'kg',
    'kilos': 'kg',
    'kgs': 'kg',
    'gram': 'g',
    'grams': 'g',
    'gm': 'g',
    'gms': 'g',
    'milligram': 'mg',
    'milligrams': 'mg',
    'ton': 'MT',
    'tons': 'MT',
    'tonne': 'MT',
    'tonnes': 'MT',
    'metric ton': 'MT',
    'metric tonne': 'MT',
    'pound': 'lb',
    'pounds': 'lb',
    'lbs': 'lb',

    // length
    'meter': 'm',
    'meters': 'm',
    'metre': 'm',
    'metres': 'm',
    'mtr': 'm',
    'mtrs': 'm',
    'centimeter': 'cm',
    'centimeters': 'cm',
    'centimetre': 'cm',
    'millimeter': 'mm',
    'millimeters': 'mm',
    'millimetre': 'mm',
    'kilometer': 'km',
    'kilometers': 'km',
    'inch': 'in',
    'inches': 'in',
    'foot': 'ft',
    'feet': 'ft',
    'yard': 'yd',
    'yards': 'yd',
    'r.ft': 'RFT',
    'rft': 'RFT',
    'r. ft': 'RFT',
    'running foot': 'RFT',
    'running feet': 'RFT',
    'running ft': 'RFT',

    // count & packaging -> map to Nos
    'nos': 'Nos',
    'no': 'Nos',
    'no.': 'Nos',
    'nos.': 'Nos',
    'number': 'Nos',
    'numbers': 'Nos',
    'each': 'Nos',
    'ea': 'Nos',
    'dozen': 'doz',
    'dozens': 'doz',
    'pairs': 'pair',
    'sets': 'set',

    // time
    'hour': 'hr',
    'hours': 'hr',
    'hrs': 'hr',
    'minute': 'min',
    'minutes': 'min',
    'mins': 'min',
    'second': 'sec',
    'seconds': 'sec',
    'secs': 'sec',
    'days': 'day',
    'weeks': 'wk',
    'wks': 'wk',
    'months': 'month',
    'mon': 'month',
    'years': 'yr',
    'yrs': 'yr'
};

/**
 * Normalizes any unit input string into a standard canonical code or dynamic unit code.
 * @param {string} rawCode
 * @returns {string}
 */
export function normalizeUnitCode(rawCode) {
    if (!rawCode || typeof rawCode !== 'string') return 'Nos';
    const trimmed = rawCode.trim();
    if (!trimmed) return 'Nos';

    // Exact match in registry
    if (UNIT_REGISTRY[trimmed]) return trimmed;

    // Lowercase match in aliases
    const lower = trimmed.toLowerCase();
    if (UNIT_ALIASES[lower]) return UNIT_ALIASES[lower];

    // Case-insensitive match in registry
    const registryKey = Object.keys(UNIT_REGISTRY).find(k => k.toLowerCase() === lower);
    if (registryKey) return registryKey;

    // Return trimmed code as dynamic unit code
    return trimmed;
}

export const UNIT_OPTIONS = Object.entries(UNIT_REGISTRY).map(([code, u]) => ({
    value: code,
    label: `${u.name} (${code})`,
    code,
    ...u
}));

export const UNIT_GROUPS = UNIT_OPTIONS.reduce((acc, u) => {
    if (!acc[u.type]) acc[u.type] = [];
    acc[u.type].push(u);
    return acc;
}, {});

export function getUnit(code) {
    if (!code || typeof code !== 'string') {
        return { name: 'Number/Each', symbol: 'Nos', type: 'count', factor: 1.0, isBase: true, isDynamic: true };
    }
    const normalized = normalizeUnitCode(code);
    if (UNIT_REGISTRY[normalized]) {
        return UNIT_REGISTRY[normalized];
    }
    return {
        name: code.trim(),
        symbol: code.trim(),
        type: 'count',
        factor: 1.0,
        isBase: true,
        isDynamic: true
    };
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
