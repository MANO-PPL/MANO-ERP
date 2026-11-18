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
 * Format string decimal as money with thousands separator on integer part only.
 * Preserves decimal digits without floating point rounding.
 * e.g. "1234567.8900" -> "1,234,567.8900"
 */
export function formatMoney(val) {
    if (val === null || val === undefined || val === '') return '—';
    const s = String(val).trim();
    const sign = s.startsWith('-') ? '-' : '';
    const clean = sign ? s.slice(1) : s;

    const parts = clean.split('.');
    const intPart = parts[0] || '0';
    const decPart = parts.length > 1 ? `.${parts[1]}` : '';

    // Standard thousands separator for integer part
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}${formattedInt}${decPart}`;
}

/**
 * Display quantity as returned without rounding.
 */
export function formatQuantity(val) {
    if (val === null || val === undefined || val === '') return '—';
    return String(val);
}

