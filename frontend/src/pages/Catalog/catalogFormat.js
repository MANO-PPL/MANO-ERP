/**
 * Catalog Decimal and Plain Date Formatting Utilities
 * Adheres strictly to Catalog Data Rules:
 * - No floating point rounding on decimals.
 * - Thousands separator only for money displays.
 * - Dates kept as plain YYYY-MM-DD without timezone shifts.
 */

export function getTodayDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function formatDatePlain(dateVal) {
    if (!dateVal) return '—';
    const s = String(dateVal).trim();
    // If it has ISO time like '2026-04-01T00:00:00.000Z', slice the date portion
    if (s.length >= 10 && s[4] === '-' && s[7] === '-') {
        return s.slice(0, 10);
    }
    return s;
}

/**
 * Format string decimal or number as money with thousands separator.
 * Displays 2 decimal places by default, only showing 3rd or 4th digits
 * if they are non-zero (significant). Trailing zeros beyond 2 decimals are trimmed.
 * Automatically eliminates IEEE-754 binary floating-point drift.
 * Examples:
 * - 5, "5", "5.0000" -> "5.00"
 * - 5.5, "5.5000" -> "5.50"
 * - "5.1200" -> "5.12"
 * - "5.1250" -> "5.125" (3rd digit shown because required)
 * - "5.1234" -> "5.1234" (4th digit shown because required)
 * - "0.0025" -> "0.0025"
 * - "1250000.5000" -> "1,250,000.50"
 * - 125.35799999999999 -> "125.358"
 */
export function formatMoney(val) {
    if (val === null || val === undefined || val === '') return '—';
    const s = String(val).trim();
    if (s === '—') return '—';
    const num = Number(s);
    if (isNaN(num)) return s;

    const sign = num < 0 ? '-' : '';
    const absNum = Math.abs(num);

    // Clean IEEE 754 binary floating-point drift up to 4 decimal places
    const cleaned = Math.round((absNum + Number.EPSILON) * 10000) / 10000;

    const fixedStr = cleaned.toFixed(4);
    const parts = fixedStr.split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let rawDec = parts[1] || '0000';

    // Trim trailing zeros beyond 2 decimal places
    if (rawDec.length > 2) {
        const trimmed = rawDec.replace(/0+$/, '');
        rawDec = trimmed.length <= 2 ? trimmed.padEnd(2, '0') : trimmed;
    } else {
        rawDec = rawDec.padEnd(2, '0');
    }

    return `${sign}${intPart}.${rawDec}`;
}

/**
 * Display quantity cleanly, eliminating IEEE-754 floating-point drift
 * and trimming redundant trailing decimal zeros.
 * Examples:
 * - "1.000000" -> "1"
 * - "0.250000" -> "0.25"
 * - "2.200000" -> "2.2"
 * - "24" -> "24"
 * - 448.79999999999995 -> "448.8"
 * - 37.400000000000006 -> "37.4"
 */
export function formatQuantity(val) {
    if (val === null || val === undefined || val === '') return '—';
    const s = String(val).trim();
    if (s === '—') return '—';
    const num = Number(val);
    if (isNaN(num)) return s;

    // Eliminate binary floating-point drift up to 4 decimal places
    const cleaned = Math.round((num + Number.EPSILON) * 10000) / 10000;
    const cleanedStr = String(cleaned);
    if (!cleanedStr.includes('.')) return cleanedStr;
    const trimmed = cleanedStr.replace(/\.?0+$/, '');
    return trimmed || '0';
}

