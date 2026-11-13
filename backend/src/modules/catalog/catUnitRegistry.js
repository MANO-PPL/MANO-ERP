/**
 * Module 2: Catalog Specification
 * catUnitRegistry.js - Sovereign Code-Level System Unit Registry
 *
 * Enterprise Architecture: "Code as Sovereign Source of Truth for Physics"
 * Universal standard units (SI, time, count standards) are defined here as
 * deeply frozen, immutable constants.
 *
 * Mathematical Immunity Guarantee:
 * - The calculation engine and conversion graphs resolve standard unit factors
 *   directly from this frozen code registry.
 * - Even if a DBA or bad migration script alters or tampers with `cat_unit.to_base_factor`
 *   in the database, arithmetic and conversion math remain 100% immune to corruption.
 * - Database rows with `org_id IS NULL` exist purely to satisfy relational Foreign Keys
 *   (e.g. cat_resource.base_unit_id -> cat_unit.id), database indexing, and SQL joins.
 */

import { toFixedStr } from './catalogDecimal.js';

export const RAW_SYSTEM_UNITS = [
    // weight (kg base)
    { code: 'kg', name: 'Kilogram', category: 'weight', to_base_factor: '1.0000000000', is_base: 1 },
    { code: 'g', name: 'Gram', category: 'weight', to_base_factor: '0.0010000000', is_base: 0 },
    { code: 'quintal', name: 'Quintal', category: 'weight', to_base_factor: '100.0000000000', is_base: 0 },
    { code: 'tonne', name: 'Tonne', category: 'weight', to_base_factor: '1000.0000000000', is_base: 0 },

    // volume (m3 base)
    { code: 'm3', name: 'Cubic Meter', category: 'volume', to_base_factor: '1.0000000000', is_base: 1 },
    { code: 'litre', name: 'Litre', category: 'volume', to_base_factor: '0.0010000000', is_base: 0 },
    { code: 'cft', name: 'Cubic Foot', category: 'volume', to_base_factor: '0.0283168466', is_base: 0 },

    // area (m2 base)
    { code: 'm2', name: 'Square Meter', category: 'area', to_base_factor: '1.0000000000', is_base: 1 },
    { code: 'sqft', name: 'Square Foot', category: 'area', to_base_factor: '0.0929030400', is_base: 0 },

    // length (m base)
    { code: 'm', name: 'Meter', category: 'length', to_base_factor: '1.0000000000', is_base: 1 },
    { code: 'mm', name: 'Millimeter', category: 'length', to_base_factor: '0.0010000000', is_base: 0 },
    { code: 'cm', name: 'Centimeter', category: 'length', to_base_factor: '0.0100000000', is_base: 0 },
    { code: 'ft', name: 'Foot', category: 'length', to_base_factor: '0.3048000000', is_base: 0 },
    { code: 'in', name: 'Inch', category: 'length', to_base_factor: '0.0254000000', is_base: 0 },
    { code: 'rm', name: 'Running Meter', category: 'length', to_base_factor: '1.0000000000', is_base: 0 },

    // count (nos base)
    { code: 'nos', name: 'Numbers', category: 'count', to_base_factor: '1.0000000000', is_base: 1 },
    { code: 'bag', name: 'Bag', category: 'count', to_base_factor: '1.0000000000', is_base: 0 },
    { code: 'bundle', name: 'Bundle', category: 'count', to_base_factor: '1.0000000000', is_base: 0 },
    { code: 'trip', name: 'Trip', category: 'count', to_base_factor: '1.0000000000', is_base: 0 },
    { code: 'load', name: 'Load', category: 'count', to_base_factor: '1.0000000000', is_base: 0 },
    { code: 'set', name: 'Set', category: 'count', to_base_factor: '1.0000000000', is_base: 0 },
    { code: 'truck', name: 'Truck', category: 'count', to_base_factor: '1.0000000000', is_base: 0 },
    { code: 'tank', name: 'Tank', category: 'count', to_base_factor: '1.0000000000', is_base: 0 },
    { code: 'drum', name: 'Drum', category: 'count', to_base_factor: '1.0000000000', is_base: 0 },

    // time (hr base)
    { code: 'hr', name: 'Hour', category: 'time', to_base_factor: '1.0000000000', is_base: 1 },
    { code: 'min', name: 'Minute', category: 'time', to_base_factor: '0.0166666667', is_base: 0 },
    { code: 'day', name: 'Day (8 hr)', category: 'time', to_base_factor: '8.0000000000', is_base: 0 },
];

// Deep-freeze each unit and map by lowercase code
export const SYSTEM_UNITS = Object.freeze(
    RAW_SYSTEM_UNITS.map(u => Object.freeze({ ...u, to_base_factor: toFixedStr(u.to_base_factor, 10) }))
);

const CODE_MAP = new Map();
for (const u of SYSTEM_UNITS) {
    CODE_MAP.set(u.code.toLowerCase(), u);
}
export const SYSTEM_UNITS_BY_CODE = CODE_MAP;

/**
 * Check if a unit code belongs to the sovereign global standard system units.
 */
export function isSystemUnitCode(code) {
    if (!code || typeof code !== 'string') return false;
    return CODE_MAP.has(code.trim().toLowerCase());
}

/**
 * Retrieve the sovereign definition of a standard unit by its code.
 */
export function getSystemUnitByCode(code) {
    if (!code || typeof code !== 'string') return null;
    return CODE_MAP.get(code.trim().toLowerCase()) || null;
}

/**
 * Returns the mathematically authoritative to_base_factor for a unit.
 * If the unit is a global system unit (org_id is null or code matches system unit),
 * it returns the immutable factor from code, ignoring any DB tampering.
 * If the unit is an org-specific custom unit, returns its DB factor.
 */
export function resolveAuthoritativeFactor(unitRow) {
    if (!unitRow) return '1.0000000000';
    const isGlobal = unitRow.org_id === null || unitRow.org_id === undefined;
    if (isGlobal || isSystemUnitCode(unitRow.code)) {
        const sys = getSystemUnitByCode(unitRow.code);
        if (sys) return sys.to_base_factor;
    }
    return toFixedStr(unitRow.to_base_factor, 10);
}

