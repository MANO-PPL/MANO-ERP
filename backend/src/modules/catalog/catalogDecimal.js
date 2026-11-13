import { CatalogError, CatalogErrorCodes } from './catalogErrors.js';

/**
 * Exact decimal arithmetic using BigInt so quantities, factors, rates, and
 * activity cost sums never suffer IEEE-754 floating-point drift.
 */

const INTERNAL_SCALE = 20;

/**
 * Parse a number or decimal/scientific string into { coeff: BigInt, scale: number }.
 */
export function parseDecimal(value) {
    if (value === null || value === undefined || value === '') {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Numeric value is required');
    }

    let str = typeof value === 'number' ? value.toString() : String(value).trim();
    if (!str || str === 'NaN' || str === 'Infinity' || str === '-Infinity') {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Invalid numeric value: "${value}"`);
    }

    // Handle scientific notation (e.g. 1e-6, 2.5e+3)
    const sciMatch = str.match(/^([+-]?)(\d+(?:\.\d+)?|\.\d+)[eE]([+-]?\d+)$/);
    if (sciMatch) {
        const sign = sciMatch[1] === '-' ? -1n : 1n;
        const mantissa = sciMatch[2];
        const exp = parseInt(sciMatch[3], 10);
        const dotIdx = mantissa.indexOf('.');
        const fracLen = dotIdx >= 0 ? mantissa.length - dotIdx - 1 : 0;
        const digits = mantissa.replace('.', '');
        const rawCoeff = BigInt(digits) * sign;
        const netScale = fracLen - exp;
        if (netScale >= 0) {
            return { coeff: rawCoeff, scale: netScale };
        }
        return { coeff: rawCoeff * (10n ** BigInt(-netScale)), scale: 0 };
    }

    const match = str.match(/^([+-]?)(\d+(?:\.\d*)?|\.\d+)$/);
    if (!match) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Invalid decimal format: "${value}"`);
    }

    const sign = match[1] === '-' ? -1n : 1n;
    const body = match[2];
    const dotIdx = body.indexOf('.');
    if (dotIdx === -1) {
        return { coeff: BigInt(body) * sign, scale: 0 };
    }

    const intPart = body.slice(0, dotIdx) || '0';
    const fracPart = body.slice(dotIdx + 1);
    const digits = (intPart + fracPart).replace(/^0+(?=\d)/, '') || '0';
    return { coeff: BigInt(digits) * sign, scale: fracPart.length };
}

function alignScales(a, b) {
    const pA = parseDecimal(a);
    const pB = parseDecimal(b);
    const targetScale = Math.max(pA.scale, pB.scale);
    const cA = pA.coeff * (10n ** BigInt(targetScale - pA.scale));
    const cB = pB.coeff * (10n ** BigInt(targetScale - pB.scale));
    return { cA, cB, scale: targetScale };
}

/**
 * Format { coeff, scale } as a canonical decimal string without trailing zeros.
 */
export function formatScaled(coeff, scale) {
    if (coeff === 0n) return '0';
    const neg = coeff < 0n;
    const abs = neg ? -coeff : coeff;
    const s = abs.toString();

    if (scale === 0) {
        return (neg ? '-' : '') + s;
    }

    let padded = s;
    if (padded.length <= scale) {
        padded = padded.padStart(scale + 1, '0');
    }
    const splitAt = padded.length - scale;
    const intPart = padded.slice(0, splitAt);
    const fracPart = padded.slice(splitAt).replace(/0+$/, '');
    const formatted = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
    return (neg ? '-' : '') + formatted;
}

/**
 * Round a scaled integer half-up to targetScale decimal places.
 */
export function roundScaled(coeff, currentScale, targetScale) {
    if (currentScale <= targetScale) {
        return { coeff: coeff * (10n ** BigInt(targetScale - currentScale)), scale: targetScale };
    }
    const diff = currentScale - targetScale;
    const divisor = 10n ** BigInt(diff);
    const half = divisor / 2n;
    const neg = coeff < 0n;
    const abs = neg ? -coeff : coeff;
    const quotient = (abs + half) / divisor;
    return { coeff: neg ? -quotient : quotient, scale: targetScale };
}

export function addDec(a, b) {
    const { cA, cB, scale } = alignScales(a, b);
    return formatScaled(cA + cB, scale);
}

export function subDec(a, b) {
    const { cA, cB, scale } = alignScales(a, b);
    return formatScaled(cA - cB, scale);
}

export function mulDec(a, b) {
    const pA = parseDecimal(a);
    const pB = parseDecimal(b);
    return formatScaled(pA.coeff * pB.coeff, pA.scale + pB.scale);
}

export function divDec(a, b, precision = INTERNAL_SCALE) {
    const pA = parseDecimal(a);
    const pB = parseDecimal(b);
    if (pB.coeff === 0n) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Division by zero');
    }

    // Scale numerator so quotient has `precision + 1` extra digits for half-up rounding
    const extraScale = precision + 1;
    const shift = extraScale + pB.scale - pA.scale;
    const neg = (pA.coeff < 0n) !== (pB.coeff < 0n);
    const absA = pA.coeff < 0n ? -pA.coeff : pA.coeff;
    const absB = pB.coeff < 0n ? -pB.coeff : pB.coeff;

    const scaledA = shift >= 0 ? absA * (10n ** BigInt(shift)) : absA / (10n ** BigInt(-shift));
    const q = scaledA / absB;
    const rounded = roundScaled(neg ? -q : q, extraScale, precision);
    return formatScaled(rounded.coeff, rounded.scale);
}

export function roundDec(val, decimals = 10) {
    const p = parseDecimal(val);
    const rounded = roundScaled(p.coeff, p.scale, decimals);
    return formatScaled(rounded.coeff, rounded.scale);
}

export function cmpDec(a, b) {
    const { cA, cB } = alignScales(a, b);
    if (cA < cB) return -1;
    if (cA > cB) return 1;
    return 0;
}

export function toFixedStr(val, decimals) {
    const p = parseDecimal(val);
    const rounded = roundScaled(p.coeff, p.scale, decimals);
    const neg = rounded.coeff < 0n;
    const abs = neg ? -rounded.coeff : rounded.coeff;
    if (decimals === 0) return (neg ? '-' : '') + abs.toString();
    const s = abs.toString().padStart(decimals + 1, '0');
    const splitAt = s.length - decimals;
    return (neg ? '-' : '') + s.slice(0, splitAt) + '.' + s.slice(splitAt);
}

export function toNumber(val, decimals = 10) {
    return Number(roundDec(val, decimals));
}

