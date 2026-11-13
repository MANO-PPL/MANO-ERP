import db from '../../config/database.js';
import { CatalogError, CatalogErrorCodes } from './catalogErrors.js';
import {
    parseDecimal,
    addDec,
    subDec,
    mulDec,
    divDec,
    cmpDec,
    roundDec,
    toFixedStr,
    toNumber
} from './catalogDecimal.js';
import {
    SYSTEM_UNITS,
    isSystemUnitCode,
    getSystemUnitByCode,
    resolveAuthoritativeFactor,
} from './catUnitRegistry.js';

export const UNIT_CATEGORIES = ['weight', 'volume', 'area', 'length', 'count', 'time'];
export const RESOURCE_KINDS = ['material', 'labour', 'equipment'];
export const CHANGE_LOG_ENTITIES = ['resource', 'activity', 'rate', 'norm', 'conversion'];

// Re-export frozen sovereign system units definition
export const SEED_UNITS = SYSTEM_UNITS;
export { isSystemUnitCode, getSystemUnitByCode, resolveAuthoritativeFactor };

/**
 * Check if a unit is accessible for a given organization scope.
 * Global system units (org_id === null) are universally accessible to all orgs.
 * Org-specific units are only accessible to their owning organization.
 */
export function isUnitAccessibleForOrg(unitOrgId, targetOrgId) {
    if (unitOrgId === null || unitOrgId === undefined) return true;
    if (targetOrgId === null || targetOrgId === undefined) return false;
    return String(unitOrgId) === String(targetOrgId);
}

// Registered usage checks per entity ('resource' | 'activity'): Set<fn(ids) => Promise<ids[]>>
const usageChecks = {
    resource: new Set(),
    activity: new Set(),
};

export function registerUsageCheck(entity, fn) {
    if (!usageChecks[entity]) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Unsupported usage check entity: "${entity}"`);
    }
    if (typeof fn === 'function') {
        usageChecks[entity].add(fn);
    }
    return () => usageChecks[entity].delete(fn);
}

export function clearUsageChecks(entity = null) {
    if (entity) {
        if (usageChecks[entity]) usageChecks[entity].clear();
    } else {
        usageChecks.resource.clear();
        usageChecks.activity.clear();
    }
}

async function runUsageChecks(entity, ids) {
    if (!ids || ids.length === 0) return [];
    const hooks = usageChecks[entity];
    if (!hooks || hooks.size === 0) return [];
    const inUse = new Set();
    for (const fn of hooks) {
        const res = await fn(ids);
        if (Array.isArray(res)) {
            res.forEach(id => inUse.add(Number(id)));
        }
    }
    return Array.from(inUse);
}

async function withTransaction(externalTrx, callback) {
    if (externalTrx) {
        return callback(externalTrx);
    }
    return db.transaction(async trx => callback(trx));
}

// =========================================================================
// Helpers: Dates, Project Scope, Change Log, Formatting
// =========================================================================

function toDateStr(val, fieldName = 'date') {
    if (val === null || val === undefined || val === '') {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `${fieldName} is required`);
    }
    if (val instanceof Date) {
        if (Number.isNaN(val.getTime())) {
            throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Invalid ${fieldName}`);
        }
        return val.toISOString().slice(0, 10);
    }
    const str = String(val).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Invalid ${fieldName} "${val}". Expected YYYY-MM-DD`);
    }
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Invalid calendar ${fieldName}: "${str}"`);
    }
    return str;
}

function optionalDateStr(val, fieldName = 'date') {
    if (val === null || val === undefined || val === '') return null;
    return toDateStr(val, fieldName);
}

function dayBefore(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d - 1));
    return dt.toISOString().slice(0, 10);
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function formatRateRow(r) {
    if (!r) return null;
    return {
        ...r,
        effective_from: r.effective_from ? toDateStr(r.effective_from, 'effective_from') : null,
        effective_to: r.effective_to ? toDateStr(r.effective_to, 'effective_to') : null,
    };
}

function formatNormRow(n) {
    if (!n) return null;
    return {
        ...n,
        wastage_pct: n.wastage_pct !== undefined && n.wastage_pct !== null ? toNumber(n.wastage_pct, 3) : 0,
        effective_from: n.effective_from ? toDateStr(n.effective_from, 'effective_from') : null,
        effective_to: n.effective_to ? toDateStr(n.effective_to, 'effective_to') : null,
    };
}

async function verifyProjectMatchesOrg(trx, projectId, orgId) {
    if (projectId === null || projectId === undefined) return;
    try {
        const proj = await trx('proj_projects').where({ id: projectId }).select('id', 'org_id').first();
        if (proj && proj.org_id && String(proj.org_id) !== String(orgId)) {
            throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Project belongs to another organization');
        }
    } catch (err) {
        if (err instanceof CatalogError) throw err;
        // Tolerate missing proj_projects in isolated test tenants
    }
}

async function writeChangeLog(trx, { orgId, entity, entityId, action, beforeData = null, afterData = null, reason = null, userId = null }) {
    await trx('cat_change_log').insert({
        org_id: orgId,
        entity,
        entity_id: entityId,
        action,
        before_data: beforeData !== null && beforeData !== undefined ? JSON.stringify(beforeData) : null,
        after_data: afterData !== null && afterData !== undefined ? JSON.stringify(afterData) : null,
        reason: reason ? String(reason).trim().slice(0, 255) : null,
        user_id: userId || null,
    });
}

function validateNonEmptyCode(code, label = 'code') {
    if (!code || typeof code !== 'string' || !code.trim()) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `${label} is required`);
    }
    const trimmed = code.trim();
    if (trimmed.length > 40) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `${label} must be at most 40 characters`);
    }
    return trimmed;
}

function validateNonEmptyName(name, label = 'name') {
    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `${label} is required`);
    }
    const trimmed = name.trim();
    if (trimmed.length > 160) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `${label} must be at most 160 characters`);
    }
    return trimmed;
}

// =========================================================================
// 1. Units & Per-Resource Conversions
// =========================================================================

export async function listUnits(orgId = null, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        let query = trx('cat_unit');
        if (orgId) {
            query = query.where(function() {
                this.whereNull('org_id').orWhere({ org_id: orgId });
            });
        } else {
            query = query.whereNull('org_id');
        }
        return query
            .orderByRaw('CASE WHEN org_id IS NULL THEN 0 ELSE 1 END ASC')
            .orderBy('category', 'asc')
            .orderBy('is_base', 'desc')
            .orderBy('code', 'asc');
    });
}

/**
 * Ensures immutable global system standard units exist in the database (org_id IS NULL).
 * Seeded once globally, shared by all tenants/organizations. Never duplicated per org.
 */
export async function seedGlobalUnits(externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        for (const u of SEED_UNITS) {
            const exists = await trx('cat_unit').whereNull('org_id').where({ code: u.code }).first();
            if (!exists) {
                await trx('cat_unit').insert({
                    org_id: null,
                    code: u.code,
                    name: u.name,
                    category: u.category,
                    to_base_factor: toFixedStr(u.to_base_factor, 10),
                    is_base: u.is_base,
                });
            }
        }
        return listUnits(null, trx);
    });
}

/**
 * Self-healing repair for global system units.
 * Recreates missing system units and restores any tampered factors/names/categories
 * back to the sovereign code registry definitions.
 */
export async function repairSystemUnits(externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        let repairedCount = 0;
        const details = [];
        for (const u of SYSTEM_UNITS) {
            const existing = await trx('cat_unit').whereNull('org_id').where({ code: u.code }).first();
            if (!existing) {
                await trx('cat_unit').insert({
                    org_id: null,
                    code: u.code,
                    name: u.name,
                    category: u.category,
                    to_base_factor: u.to_base_factor,
                    is_base: u.is_base,
                });
                repairedCount++;
                details.push({ code: u.code, action: 'recreated' });
            } else if (
                existing.category !== u.category ||
                Number(existing.is_base) !== Number(u.is_base) ||
                toFixedStr(existing.to_base_factor, 10) !== u.to_base_factor ||
                existing.name !== u.name
            ) {
                await trx('cat_unit').where({ id: existing.id }).update({
                    name: u.name,
                    category: u.category,
                    to_base_factor: u.to_base_factor,
                    is_base: u.is_base,
                });
                repairedCount++;
                details.push({ code: u.code, action: 'repaired_tampered_values' });
            }
        }
        return {
            repairedCount,
            restoredCount: repairedCount,
            details,
        };
    });
}

/**
 * Ensures global system standard units exist and returns units available for the org.
 * Does not duplicate or create per-org copies of standard units.
 */
export async function seedDefaultUnits(orgId = null, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        await seedGlobalUnits(trx);
        return listUnits(orgId, trx);
    });
}

export async function createUnit(input, externalTrx = null) {
    const {
        orgId,
        code,
        name,
        category,
        toBaseFactor,
        isBase = false,
    } = input || {};

    if (!orgId || !code || !name || !category) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'orgId, code, name, and category are required');
    }
    if (!UNIT_CATEGORIES.includes(category)) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Invalid unit category "${category}"`);
    }
    const trimmedCode = String(code).trim().toLowerCase();
    if (!trimmedCode || trimmedCode.length > 20) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Unit code must be 1..20 characters');
    }
    if (isSystemUnitCode(trimmedCode)) {
        throw new CatalogError(
            CatalogErrorCodes.CAT_DUPLICATE_CODE,
            `Unit code "${trimmedCode}" is reserved for global system standard units`
        );
    }
    const trimmedName = String(name).trim();
    if (!trimmedName || trimmedName.length > 60) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Unit name must be 1..60 characters');
    }

    const factorVal = toBaseFactor !== undefined ? toBaseFactor : (isBase ? '1' : null);
    parseDecimal(factorVal);
    if (cmpDec(factorVal, '0') <= 0) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'toBaseFactor must be greater than 0');
    }

    return withTransaction(externalTrx, async trx => {
        // Disallow collision with either global system units or this org's custom units
        const dup = await trx('cat_unit')
            .where(function() {
                this.whereNull('org_id').orWhere({ org_id: orgId });
            })
            .where({ code: trimmedCode })
            .first();
        if (dup) {
            throw new CatalogError(
                CatalogErrorCodes.CAT_DUPLICATE_CODE,
                `Unit code "${trimmedCode}" already exists (${dup.org_id === null ? 'System standard unit' : 'Custom unit'})`
            );
        }

        if (isBase) {
            const existingBase = await trx('cat_unit')
                .where(function() {
                    this.whereNull('org_id').orWhere({ org_id: orgId });
                })
                .where({ category, is_base: 1 })
                .first();
            if (existingBase) {
                throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Category "${category}" already has a base unit (${existingBase.code})`);
            }
        }

        const [id] = await trx('cat_unit').insert({
            org_id: orgId,
            code: trimmedCode,
            name: trimmedName,
            category,
            to_base_factor: toFixedStr(isBase ? '1' : factorVal, 10),
            is_base: isBase ? 1 : 0,
        });
        return trx('cat_unit').where({ id }).first();
    });
}

export async function updateUnit(id, patch, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_unit').where({ id }).first();
        if (!existing) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Unit not found');
        }
        if (existing.org_id === null || isSystemUnitCode(existing.code)) {
            throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'System standard units are immutable and cannot be modified');
        }

        const updateData = {};
        if (patch.name !== undefined) {
            const trimmedName = String(patch.name).trim();
            if (!trimmedName || trimmedName.length > 60) {
                throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Unit name must be 1..60 characters');
            }
            updateData.name = trimmedName;
        }
        if (patch.code !== undefined && patch.code.trim().toLowerCase() !== existing.code) {
            const trimmedCode = String(patch.code).trim().toLowerCase();
            if (!trimmedCode || trimmedCode.length > 20) {
                throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Unit code must be 1..20 characters');
            }
            const dup = await trx('cat_unit')
                .where(function() {
                    this.whereNull('org_id').orWhere({ org_id: existing.org_id });
                })
                .where({ code: trimmedCode })
                .whereNot({ id })
                .first();
            if (dup) {
                throw new CatalogError(CatalogErrorCodes.CAT_DUPLICATE_CODE, `Unit code "${trimmedCode}" already exists`);
            }
            updateData.code = trimmedCode;
        }
        if (patch.isBase !== undefined || patch.is_base !== undefined) {
            const requestedBase = Boolean(patch.isBase ?? patch.is_base);
            if (existing.is_base && !requestedBase) {
                throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Base units cannot be removed or demoted');
            }
        }
        const factorPatch = patch.toBaseFactor ?? patch.to_base_factor;
        if (factorPatch !== undefined) {
            parseDecimal(factorPatch);
            if (cmpDec(factorPatch, '0') <= 0) {
                throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'toBaseFactor must be greater than 0');
            }
            if (existing.is_base && cmpDec(factorPatch, '1') !== 0) {
                throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Base unit factor must remain 1');
            }
            updateData.to_base_factor = toFixedStr(factorPatch, 10);
        }

        if (Object.keys(updateData).length > 0) {
            await trx('cat_unit').where({ id }).update(updateData);
        }
        return trx('cat_unit').where({ id }).first();
    });
}

export async function deleteUnit(id, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_unit').where({ id }).first();
        if (!existing) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Unit not found');
        }
        if (existing.org_id === null || isSystemUnitCode(existing.code)) {
            throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'System standard units cannot be deleted');
        }
        if (existing.is_base) {
            throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Base units cannot be deleted');
        }
        const [inResource, inActivity, inRate, inNorm, inConv] = await Promise.all([
            trx('cat_resource').where({ base_unit_id: id }).first(),
            trx('cat_activity').where({ output_unit_id: id }).first(),
            trx('cat_rate').where({ unit_id: id }).first(),
            trx('cat_activity_norm').where({ unit_id: id }).first(),
            trx('cat_resource_conversion').where(function() {
                this.where({ from_unit_id: id }).orWhere({ to_unit_id: id });
            }).first(),
        ]);
        if (inResource || inActivity || inRate || inNorm || inConv) {
            throw new CatalogError(CatalogErrorCodes.CAT_HAS_DEPENDENTS, 'Cannot delete unit because it is currently in use');
        }
        await trx('cat_unit').where({ id }).del();
        return { deleted: true, id };
    });
}

async function loadResourceConversions(trx, resourceId) {
    return trx('cat_resource_conversion as c')
        .join('cat_unit as fu', 'fu.id', 'c.from_unit_id')
        .join('cat_unit as tu', 'tu.id', 'c.to_unit_id')
        .where('c.resource_id', resourceId)
        .select(
            'c.*',
            'fu.code as from_unit_code',
            'fu.name as from_unit_name',
            'fu.category as from_unit_category',
            'fu.to_base_factor as from_unit_to_base_factor',
            'tu.code as to_unit_code',
            'tu.name as to_unit_name',
            'tu.category as to_unit_category',
            'tu.to_base_factor as to_unit_to_base_factor'
        );
}

/**
 * Check if a unit is usable for a resource (Invariant 6):
 * same category as resource.base_unit_id, OR resource has a conversion linking the two categories.
 */
async function assertUnitUsableForResource(trx, resource, unit) {
    if (!isUnitAccessibleForOrg(unit.org_id, resource.org_id)) {
        throw new CatalogError(CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE, 'Unit belongs to another organization');
    }
    const baseUnit = await trx('cat_unit').where({ id: resource.base_unit_id }).first();
    if (!baseUnit) {
        throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource base unit not found');
    }
    if (unit.category === baseUnit.category) {
        return;
    }

    const conversions = await loadResourceConversions(trx, resource.id);
    const hasLink = conversions.some(c =>
        (c.from_unit_category === unit.category && c.to_unit_category === baseUnit.category) ||
        (c.to_unit_category === unit.category && c.from_unit_category === baseUnit.category)
    );

    if (!hasLink) {
        throw new CatalogError(
            CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE,
            `Unit "${unit.code}" (${unit.category}) has no conversion linking to base unit "${baseUnit.code}" (${baseUnit.category})`
        );
    }
}

/**
 * Exact decimal conversion returning a decimal string internally.
 */
export async function convertExact(qty, fromUnitId, toUnitId, resourceId = null, externalTrx = null) {
    parseDecimal(qty);
    if (!fromUnitId || !toUnitId) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'fromUnitId and toUnitId are required');
    }
    if (String(fromUnitId) === String(toUnitId)) {
        return roundDec(qty, 10);
    }

    return withTransaction(externalTrx, async trx => {
        const [fromUnit, toUnit] = await Promise.all([
            trx('cat_unit').where({ id: fromUnitId }).first(),
            trx('cat_unit').where({ id: toUnitId }).first(),
        ]);
        if (!fromUnit || !toUnit) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Source or target unit not found');
        }
        if (fromUnit.org_id !== null && toUnit.org_id !== null && String(fromUnit.org_id) !== String(toUnit.org_id)) {
            throw new CatalogError(CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE, 'Cannot convert between units of different organizations');
        }

        // Check resource conversions first if resourceId provided
        let conversions = [];
        if (resourceId) {
            const resource = await trx('cat_resource').where({ id: resourceId }).first();
            if (!resource) {
                throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
            }
            if (!isUnitAccessibleForOrg(fromUnit.org_id, resource.org_id) || !isUnitAccessibleForOrg(toUnit.org_id, resource.org_id)) {
                throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Resource belongs to another organization');
            }
            conversions = await loadResourceConversions(trx, resourceId);

            const direct = conversions.find(
                c => String(c.from_unit_id) === String(fromUnitId) && String(c.to_unit_id) === String(toUnitId)
            );
            if (direct) {
                return roundDec(mulDec(qty, direct.factor), 10);
            }
            const inverse = conversions.find(
                c => String(c.from_unit_id) === String(toUnitId) && String(c.to_unit_id) === String(fromUnitId)
            );
            if (inverse) {
                return roundDec(divDec(qty, inverse.factor), 10);
            }
        }

        // Resolve factors authoritatively: system units strictly use frozen in-memory constants
        const fromFactor = resolveAuthoritativeFactor(fromUnit);
        const toFactor = resolveAuthoritativeFactor(toUnit);

        // Same category factor math
        if (fromUnit.category === toUnit.category) {
            const inBase = mulDec(qty, fromFactor);
            const result = divDec(inBase, toFactor);
            return roundDec(result, 10);
        }

        // Cross-category conversion via resource conversion graph (category-level BFS)
        if (!resourceId || conversions.length === 0) {
            throw new CatalogError(
                CatalogErrorCodes.CAT_NO_CONVERSION,
                `No conversion defined from "${fromUnit.code}" (${fromUnit.category}) to "${toUnit.code}" (${toUnit.category})`
            );
        }

        // Convert qty from `fromUnit` into base unit of `fromUnit.category`: qtyInFromCatBase = qty * fromFactor
        // Each conversion edge c links c.from_unit_category <-> c.to_unit_category:
        //   1 base_of(from_cat) = (c.factor * c.to_unit_to_base_factor / c.from_unit_to_base_factor) base_of(to_cat)
        const adj = new Map();
        const addEdge = (catA, catB, ratio) => {
            if (!adj.has(catA)) adj.set(catA, []);
            adj.get(catA).push({ toCat: catB, ratio });
        };

        for (const c of conversions) {
            const fromEdgeFactor = resolveAuthoritativeFactor({ code: c.from_unit_code, org_id: null, to_base_factor: c.from_unit_to_base_factor });
            const toEdgeFactor = resolveAuthoritativeFactor({ code: c.to_unit_code, org_id: null, to_base_factor: c.to_unit_to_base_factor });
            const forwardRatio = divDec(mulDec(c.factor, toEdgeFactor), fromEdgeFactor);
            const backwardRatio = divDec('1', forwardRatio);
            addEdge(c.from_unit_category, c.to_unit_category, forwardRatio);
            addEdge(c.to_unit_category, c.from_unit_category, backwardRatio);
        }

        const startCat = fromUnit.category;
        const targetCat = toUnit.category;
        const visited = new Set([startCat]);
        const queue = [{ cat: startCat, valueInCatBase: mulDec(qty, fromFactor) }];

        while (queue.length > 0) {
            const { cat, valueInCatBase } = queue.shift();
            if (cat === targetCat) {
                return roundDec(divDec(valueInCatBase, toFactor), 10);
            }
            const edges = adj.get(cat) || [];
            for (const edge of edges) {
                if (!visited.has(edge.toCat)) {
                    visited.add(edge.toCat);
                    queue.push({
                        cat: edge.toCat,
                        valueInCatBase: mulDec(valueInCatBase, edge.ratio),
                    });
                }
            }
        }

        throw new CatalogError(
            CatalogErrorCodes.CAT_NO_CONVERSION,
            `No conversion defined on resource #${resourceId} from "${fromUnit.code}" (${fromUnit.category}) to "${toUnit.code}" (${toUnit.category})`
        );
    });
}

export async function convert(qty, fromUnitId, toUnitId, resourceId = null, externalTrx = null) {
    const exactStr = await convertExact(qty, fromUnitId, toUnitId, resourceId, externalTrx);
    return toNumber(exactStr, 10);
}

export async function listConversions(resourceId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const res = await trx('cat_resource').where({ id: resourceId }).first();
        if (!res) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        return loadResourceConversions(trx, resourceId);
    });
}

export async function setConversion(resourceId, fromUnitId, toUnitId, factor, options = {}, externalTrx = null) {
    parseDecimal(factor);
    if (cmpDec(factor, '0') <= 0) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Conversion factor must be greater than 0');
    }
    if (!resourceId || !fromUnitId || !toUnitId) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'resourceId, fromUnitId, and toUnitId are required');
    }
    if (String(fromUnitId) === String(toUnitId)) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'fromUnitId and toUnitId must be different');
    }

    const { userId = null, reason = null } = options || {};

    return withTransaction(externalTrx, async trx => {
        const resource = await trx('cat_resource').where({ id: resourceId }).forUpdate().first();
        if (!resource) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        const [fromUnit, toUnit] = await Promise.all([
            trx('cat_unit').where({ id: fromUnitId }).first(),
            trx('cat_unit').where({ id: toUnitId }).first(),
        ]);
        if (!fromUnit || !toUnit) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Unit not found');
        }
        if (!isUnitAccessibleForOrg(fromUnit.org_id, resource.org_id) || !isUnitAccessibleForOrg(toUnit.org_id, resource.org_id)) {
            throw new CatalogError(CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE, 'Conversion units must belong to the resource organization or be system standard units');
        }

        const fixedFactor = toFixedStr(factor, 10);

        const existingDirect = await trx('cat_resource_conversion')
            .where({ resource_id: resourceId, from_unit_id: fromUnitId, to_unit_id: toUnitId })
            .first();

        const existingInverse = await trx('cat_resource_conversion')
            .where({ resource_id: resourceId, from_unit_id: toUnitId, to_unit_id: fromUnitId })
            .first();

        let saved;
        let action;
        let beforeData = null;

        if (existingDirect) {
            beforeData = existingDirect;
            await trx('cat_resource_conversion').where({ id: existingDirect.id }).update({ factor: fixedFactor });
            saved = await trx('cat_resource_conversion').where({ id: existingDirect.id }).first();
            action = 'update';
        } else if (existingInverse) {
            // Keep one stored direction; update existing inverse row with 1 / factor
            beforeData = existingInverse;
            const invFactor = toFixedStr(divDec('1', fixedFactor), 10);
            await trx('cat_resource_conversion').where({ id: existingInverse.id }).update({ factor: invFactor });
            saved = await trx('cat_resource_conversion').where({ id: existingInverse.id }).first();
            action = 'update';
        } else {
            const [newId] = await trx('cat_resource_conversion').insert({
                resource_id: resourceId,
                from_unit_id: fromUnitId,
                to_unit_id: toUnitId,
                factor: fixedFactor,
            });
            saved = await trx('cat_resource_conversion').where({ id: newId }).first();
            action = 'create';
        }

        if (resource.project_id === null) {
            await trx('cat_resource').where({ id: resource.id }).increment('version', 1);
        }

        await writeChangeLog(trx, {
            orgId: resource.org_id,
            entity: 'conversion',
            entityId: saved.id,
            action,
            beforeData,
            afterData: saved,
            reason,
            userId,
        });

        const list = await loadResourceConversions(trx, resourceId);
        return list.find(c => c.id === saved.id) || saved;
    });
}

export async function removeConversion(conversionId, options = {}, externalTrx = null) {
    const { userId = null, reason = null } = options || {};
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_resource_conversion').where({ id: conversionId }).first();
        if (!existing) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Conversion not found');
        }

        const resource = await trx('cat_resource').where({ id: existing.resource_id }).forUpdate().first();
        if (!resource) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        }

        const baseUnit = await trx('cat_unit').where({ id: resource.base_unit_id }).first();
        const remaining = await loadResourceConversions(trx, resource.id);
        const afterRemoval = remaining.filter(c => c.id !== existing.id);

        const isCategorySupported = (cat) => {
            if (cat === baseUnit.category) return true;
            return afterRemoval.some(c =>
                (c.from_unit_category === cat && c.to_unit_category === baseUnit.category) ||
                (c.to_unit_category === cat && c.from_unit_category === baseUnit.category)
            );
        };

        // Ensure removing this conversion doesn't break Invariant 6 for existing rates or norms
        const rateUnits = await trx('cat_rate as r')
            .join('cat_unit as u', 'u.id', 'r.unit_id')
            .where('r.resource_id', resource.id)
            .select('u.category', 'u.code');
        for (const ru of rateUnits) {
            if (!isCategorySupported(ru.category)) {
                throw new CatalogError(
                    CatalogErrorCodes.CAT_IN_USE,
                    `Cannot remove conversion: existing rate uses unit "${ru.code}" (${ru.category}) which depends on it`
                );
            }
        }

        const normUnits = await trx('cat_activity_norm as n')
            .join('cat_unit as u', 'u.id', 'n.unit_id')
            .where('n.resource_id', resource.id)
            .select('u.category', 'u.code');
        for (const nu of normUnits) {
            if (!isCategorySupported(nu.category)) {
                throw new CatalogError(
                    CatalogErrorCodes.CAT_IN_USE,
                    `Cannot remove conversion: existing norm uses unit "${nu.code}" (${nu.category}) which depends on it`
                );
            }
        }

        await trx('cat_resource_conversion').where({ id: conversionId }).delete();

        if (resource.project_id === null) {
            await trx('cat_resource').where({ id: resource.id }).increment('version', 1);
        }

        await writeChangeLog(trx, {
            orgId: resource.org_id,
            entity: 'conversion',
            entityId: existing.id,
            action: 'delete',
            beforeData: existing,
            afterData: null,
            reason,
            userId,
        });

        return { deleted: true, id: existing.id };
    });
}

// =========================================================================
// 2. Resources
// =========================================================================

async function fetchResourceWithUnit(trx, id) {
    return trx('cat_resource as r')
        .leftJoin('cat_unit as u', 'u.id', 'r.base_unit_id')
        .where('r.id', id)
        .select(
            'r.*',
            'u.code as base_unit_code',
            'u.name as base_unit_name',
            'u.category as base_unit_category'
        )
        .first();
}

export async function createResource(input, externalTrx = null) {
    const {
        orgId,
        projectId = null,
        parentId = null,
        kind,
        code,
        name,
        baseUnitId,
        description = null,
        remarks = null,
        userId = null,
    } = input || {};

    if (!orgId) throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'orgId is required');
    if (!RESOURCE_KINDS.includes(kind)) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Invalid resource kind "${kind}". Must be material, labour, or equipment`);
    }
    const cleanCode = validateNonEmptyCode(code, 'Resource code');
    const cleanName = validateNonEmptyName(name, 'Resource name');
    if (!baseUnitId) throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'baseUnitId is required');

    const normalizedProjectId = projectId !== null && projectId !== undefined && projectId !== '' ? Number(projectId) : null;
    const normalizedParentId = parentId !== null && parentId !== undefined && parentId !== '' ? Number(parentId) : null;

    if (normalizedProjectId === null && normalizedParentId !== null) {
        throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Master resource cannot have a parent_id');
    }

    return withTransaction(externalTrx, async trx => {
        await verifyProjectMatchesOrg(trx, normalizedProjectId, orgId);

        const unit = await trx('cat_unit').where({ id: baseUnitId }).first();
        if (!unit) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Base unit not found');
        if (!isUnitAccessibleForOrg(unit.org_id, orgId)) {
            throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Base unit belongs to another organization');
        }

        let syncedVersion = null;
        if (normalizedParentId !== null) {
            const parent = await trx('cat_resource').where({ id: normalizedParentId }).first();
            if (!parent) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Parent master resource not found');
            if (parent.project_id !== null) {
                throw new CatalogError(CatalogErrorCodes.CAT_NOT_MASTER, 'Parent resource must be a master row');
            }
            if (String(parent.org_id) !== String(orgId)) {
                throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Parent resource belongs to another organization');
            }
            if (parent.kind !== kind) {
                throw new CatalogError(CatalogErrorCodes.CAT_KIND_MISMATCH, 'Project copy kind must match master kind');
            }
            syncedVersion = parent.version;
        }

        const scopeKey = normalizedProjectId || 0;
        const dup = await trx('cat_resource')
            .where({ org_id: orgId, scope_key: scopeKey, code: cleanCode })
            .first();
        if (dup) {
            throw new CatalogError(CatalogErrorCodes.CAT_DUPLICATE_CODE, `Resource code "${cleanCode}" already exists in this scope`);
        }

        const [newId] = await trx('cat_resource').insert({
            org_id: orgId,
            project_id: normalizedProjectId,
            parent_id: normalizedParentId,
            kind,
            code: cleanCode,
            name: cleanName,
            base_unit_id: baseUnitId,
            description: description ? String(description).slice(0, 500) : null,
            remarks: remarks ? String(remarks).slice(0, 500) : null,
            status: 'active',
            version: 1,
            synced_version: syncedVersion,
        });

        const created = await fetchResourceWithUnit(trx, newId);
        await writeChangeLog(trx, {
            orgId,
            entity: 'resource',
            entityId: newId,
            action: 'create',
            beforeData: null,
            afterData: created,
            userId,
        });

        return created;
    });
}

export async function updateResource(id, patch, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_resource').where({ id }).forUpdate().first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        if (patch.kind !== undefined && patch.kind !== existing.kind) {
            throw new CatalogError(CatalogErrorCodes.CAT_KIND_MISMATCH, 'Resource kind cannot be changed after creation');
        }

        const updateData = {};
        if (patch.name !== undefined) {
            updateData.name = validateNonEmptyName(patch.name, 'Resource name');
        }
        if (patch.code !== undefined) {
            const cleanCode = validateNonEmptyCode(patch.code, 'Resource code');
            if (cleanCode !== existing.code) {
                const dup = await trx('cat_resource')
                    .where({ org_id: existing.org_id, scope_key: existing.scope_key, code: cleanCode })
                    .whereNot({ id })
                    .first();
                if (dup) {
                    throw new CatalogError(CatalogErrorCodes.CAT_DUPLICATE_CODE, `Resource code "${cleanCode}" already exists in this scope`);
                }
                updateData.code = cleanCode;
            }
        }
        if (patch.description !== undefined) {
            updateData.description = patch.description !== null ? String(patch.description).slice(0, 500) : null;
        }
        if (patch.remarks !== undefined) {
            updateData.remarks = patch.remarks !== null ? String(patch.remarks).slice(0, 500) : null;
        }

        const nextBaseUnitId = patch.baseUnitId ?? patch.base_unit_id;
        if (nextBaseUnitId !== undefined && Number(nextBaseUnitId) !== Number(existing.base_unit_id)) {
            const newUnit = await trx('cat_unit').where({ id: nextBaseUnitId }).first();
            if (!newUnit) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'New base unit not found');
            if (!isUnitAccessibleForOrg(newUnit.org_id, existing.org_id)) {
                throw new CatalogError(CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE, 'Base unit belongs to another organization');
            }

            const [hasRate, hasNorm, externalInUse] = await Promise.all([
                trx('cat_rate').where({ resource_id: id }).first(),
                trx('cat_activity_norm').where({ resource_id: id }).first(),
                runUsageChecks('resource', [id]),
            ]);
            if (hasRate || hasNorm || externalInUse.length > 0) {
                throw new CatalogError(
                    CatalogErrorCodes.CAT_IN_USE,
                    'Cannot change base unit while rates, norms, or external records reference this resource'
                );
            }
            updateData.base_unit_id = Number(nextBaseUnitId);
        }

        if (Object.keys(updateData).length === 0) {
            return fetchResourceWithUnit(trx, id);
        }

        if (existing.project_id === null) {
            updateData.version = existing.version + 1;
        }

        await trx('cat_resource').where({ id }).update(updateData);
        const updated = await fetchResourceWithUnit(trx, id);

        await writeChangeLog(trx, {
            orgId: existing.org_id,
            entity: 'resource',
            entityId: id,
            action: 'update',
            beforeData: existing,
            afterData: updated,
            reason: patch.reason || null,
            userId: patch.userId || null,
        });

        return updated;
    });
}

export async function archiveResource(id, options = {}, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_resource').where({ id }).forUpdate().first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        if (existing.status === 'archived') {
            return fetchResourceWithUnit(trx, id);
        }

        const updateData = { status: 'archived' };
        if (existing.project_id === null) updateData.version = existing.version + 1;

        await trx('cat_resource').where({ id }).update(updateData);
        const updated = await fetchResourceWithUnit(trx, id);

        await writeChangeLog(trx, {
            orgId: existing.org_id,
            entity: 'resource',
            entityId: id,
            action: 'archive',
            beforeData: existing,
            afterData: updated,
            reason: options?.reason || null,
            userId: options?.userId || null,
        });

        return updated;
    });
}

export async function restoreResource(id, options = {}, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_resource').where({ id }).forUpdate().first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        if (existing.status === 'active') {
            return fetchResourceWithUnit(trx, id);
        }

        const updateData = { status: 'active' };
        if (existing.project_id === null) updateData.version = existing.version + 1;

        await trx('cat_resource').where({ id }).update(updateData);
        const updated = await fetchResourceWithUnit(trx, id);

        await writeChangeLog(trx, {
            orgId: existing.org_id,
            entity: 'resource',
            entityId: id,
            action: 'restore',
            beforeData: existing,
            afterData: updated,
            reason: options?.reason || null,
            userId: options?.userId || null,
        });

        return updated;
    });
}

export async function deleteResource(id, options = {}, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_resource').where({ id }).forUpdate().first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        const [usedInNorm, hasCopies, externalInUse] = await Promise.all([
            trx('cat_activity_norm').where({ resource_id: id }).first(),
            trx('cat_resource').where({ parent_id: id }).first(),
            runUsageChecks('resource', [id]),
        ]);

        if (usedInNorm || hasCopies || externalInUse.length > 0) {
            throw new CatalogError(
                CatalogErrorCodes.CAT_IN_USE,
                'Resource is referenced by norms, project copies, or external modules and can only be archived'
            );
        }

        await trx('cat_resource').where({ id }).delete();

        await writeChangeLog(trx, {
            orgId: existing.org_id,
            entity: 'resource',
            entityId: id,
            action: 'delete',
            beforeData: existing,
            afterData: null,
            reason: options?.reason || null,
            userId: options?.userId || null,
        });

        return { deleted: true, id };
    });
}

export async function getResource(id, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        return fetchResourceWithUnit(trx, id);
    });
}

export async function listResources(filter = {}, externalTrx = null) {
    const {
        orgId,
        scope,
        projectId,
        kind,
        status,
        search,
    } = filter || {};

    return withTransaction(externalTrx, async trx => {
        let query = trx('cat_resource as r')
            .leftJoin('cat_unit as u', 'u.id', 'r.base_unit_id')
            .leftJoin('cat_resource as p', 'p.id', 'r.parent_id');

        if (orgId) {
            query = query.where('r.org_id', orgId);
        }

        if (scope === 'master' || projectId === null) {
            query = query.whereNull('r.project_id');
        } else if (projectId !== undefined && projectId !== '') {
            query = query.where('r.project_id', Number(projectId));
        }

        if (kind) {
            query = query.where('r.kind', kind);
        }
        if (status) {
            query = query.where('r.status', status);
        }
        if (search && String(search).trim()) {
            const term = `%${String(search).trim()}%`;
            query = query.where(q => q.where('r.code', 'like', term).orWhere('r.name', 'like', term));
        }

        return query
            .select(
                'r.*',
                'u.code as base_unit_code',
                'u.name as base_unit_name',
                'u.category as base_unit_category',
                'p.version as master_version'
            )
            .orderBy('r.kind', 'asc')
            .orderBy('r.code', 'asc');
    });
}

export async function importResource(masterId, projectId, options = {}, externalTrx = null) {
    if (!projectId) {
        throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Target projectId is required to import a master resource');
    }

    const {
        asNewVariant = false,
        code = null,
        name = null,
        userId = null,
    } = options || {};

    return withTransaction(externalTrx, async trx => {
        // Lock master row so concurrent imports serialize cleanly
        const master = await trx('cat_resource').where({ id: masterId }).forUpdate().first();
        if (!master) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Master resource not found');
        }
        if (master.project_id !== null) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_MASTER, 'Only master catalog resources can be imported');
        }
        if (master.status === 'archived') {
            throw new CatalogError(CatalogErrorCodes.CAT_ARCHIVED, 'Archived master resource cannot be imported');
        }

        await verifyProjectMatchesOrg(trx, Number(projectId), master.org_id);

        if (!asNewVariant) {
            // Locking read avoids stale snapshot in REPEATABLE READ
            const existingCopy = await trx('cat_resource')
                .where({ org_id: master.org_id, project_id: Number(projectId), parent_id: master.id })
                .forUpdate()
                .orderBy('id', 'asc')
                .first();
            if (existingCopy) {
                return fetchResourceWithUnit(trx, existingCopy.id);
            }
        }

        const newCode = validateNonEmptyCode(code || master.code, 'Resource code');
        const newName = validateNonEmptyName(name || master.name, 'Resource name');

        const dup = await trx('cat_resource')
            .where({ org_id: master.org_id, scope_key: Number(projectId), code: newCode })
            .first();
        if (dup) {
            throw new CatalogError(CatalogErrorCodes.CAT_DUPLICATE_CODE, `Resource code "${newCode}" already exists in project #${projectId}`);
        }

        const [newId] = await trx('cat_resource').insert({
            org_id: master.org_id,
            project_id: Number(projectId),
            parent_id: master.id,
            kind: master.kind,
            code: newCode,
            name: newName,
            base_unit_id: master.base_unit_id,
            description: master.description,
            remarks: master.remarks,
            status: 'active',
            version: 1,
            synced_version: master.version,
        });

        // Copy conversions
        const conversions = await trx('cat_resource_conversion').where({ resource_id: master.id });
        for (const c of conversions) {
            await trx('cat_resource_conversion').insert({
                resource_id: newId,
                from_unit_id: c.from_unit_id,
                to_unit_id: c.to_unit_id,
                factor: c.factor,
            });
        }

        // Copy rates
        const rates = await trx('cat_rate').where({ resource_id: master.id }).orderBy('effective_from', 'asc');
        for (const r of rates) {
            await trx('cat_rate').insert({
                resource_id: newId,
                rate: r.rate,
                unit_id: r.unit_id,
                effective_from: toDateStr(r.effective_from, 'effective_from'),
                effective_to: optionalDateStr(r.effective_to, 'effective_to'),
                note: r.note,
                created_by: userId || r.created_by,
            });
        }

        const created = await fetchResourceWithUnit(trx, newId);
        await writeChangeLog(trx, {
            orgId: master.org_id,
            entity: 'resource',
            entityId: newId,
            action: 'import',
            beforeData: null,
            afterData: {
                masterId: master.id,
                masterVersion: master.version,
                asNewVariant: Boolean(asNewVariant),
                resource: created,
            },
            userId,
        });

        return created;
    });
}

// =========================================================================
// 3. Rates
// =========================================================================

export async function setRate(resourceId, rate, unitId, effectiveFrom, note = null, options = {}, externalTrx = null) {
    if (rate === null || rate === undefined || rate === '') {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Rate value is required');
    }
    parseDecimal(rate);
    if (cmpDec(rate, '0') < 0) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Rate must be 0 or greater');
    }
    const effFrom = toDateStr(effectiveFrom, 'effectiveFrom');
    const { userId = null } = options || {};

    return withTransaction(externalTrx, async trx => {
        // Lock resource row to serialize concurrent rate writes
        const resource = await trx('cat_resource').where({ id: resourceId }).forUpdate().first();
        if (!resource) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        const unit = await trx('cat_unit').where({ id: unitId }).first();
        if (!unit) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Rate unit not found');
        await assertUnitUsableForResource(trx, resource, unit);

        // Locking read of existing rates
        const existingRates = await trx('cat_rate')
            .where({ resource_id: resourceId })
            .orderBy('effective_from', 'asc')
            .forUpdate();

        // Check overlap: any existing rate covering effFrom, or starting on/after effFrom
        for (const r of existingRates) {
            const rFrom = toDateStr(r.effective_from, 'effective_from');
            const rTo = optionalDateStr(r.effective_to, 'effective_to');
            if (rFrom === effFrom) {
                throw new CatalogError(CatalogErrorCodes.CAT_RATE_OVERLAP, `A rate already starts on ${effFrom}`);
            }
            if (rFrom > effFrom) {
                throw new CatalogError(CatalogErrorCodes.CAT_RATE_OVERLAP, `Rate date ${effFrom} precedes existing rate starting ${rFrom}`);
            }
            if (rTo !== null && effFrom >= rFrom && effFrom <= rTo) {
                throw new CatalogError(CatalogErrorCodes.CAT_RATE_OVERLAP, `Rate date ${effFrom} falls inside existing period ${rFrom}..${rTo}`);
            }
        }

        // End any open-ended rate the day before effFrom
        const openRate = existingRates.find(r => r.effective_to === null || r.effective_to === undefined);
        if (openRate) {
            const closeDate = dayBefore(effFrom);
            await trx('cat_rate').where({ id: openRate.id }).update({ effective_to: closeDate });
        }

        const [newId] = await trx('cat_rate').insert({
            resource_id: resourceId,
            rate: toFixedStr(rate, 4),
            unit_id: unitId,
            effective_from: effFrom,
            effective_to: null,
            note: note ? String(note).slice(0, 255) : null,
            created_by: userId,
        });

        const inserted = formatRateRow(await trx('cat_rate').where({ id: newId }).first());

        if (resource.project_id === null) {
            await trx('cat_resource').where({ id: resource.id }).increment('version', 1);
        }

        await writeChangeLog(trx, {
            orgId: resource.org_id,
            entity: 'rate',
            entityId: newId,
            action: 'create',
            beforeData: openRate ? formatRateRow(openRate) : null,
            afterData: inserted,
            userId,
        });

        return inserted;
    });
}

export async function getRate(resourceId, date, options = {}, externalTrx = null) {
    const asOfDate = toDateStr(date, 'date');
    const inUnitId = options?.inUnit ?? options?.inUnitId ?? null;

    return withTransaction(externalTrx, async trx => {
        const row = await trx('cat_rate as r')
            .join('cat_unit as u', 'u.id', 'r.unit_id')
            .where('r.resource_id', resourceId)
            .where('r.effective_from', '<=', asOfDate)
            .where(q => q.whereNull('r.effective_to').orWhere('r.effective_to', '>=', asOfDate))
            .select('r.*', 'u.code as unit_code', 'u.name as unit_name', 'u.category as unit_category')
            .first();

        if (!row) return null;

        const formatted = formatRateRow(row);
        if (inUnitId && Number(inUnitId) !== Number(row.unit_id)) {
            // 1 targetUnit = factor * sourceUnit => rate per targetUnit = rate * factor
            const factor = await convertExact('1', Number(inUnitId), row.unit_id, resourceId, trx);
            const convertedRate = toFixedStr(mulDec(row.rate, factor), 4);
            const targetUnit = await trx('cat_unit').where({ id: inUnitId }).first();
            return {
                ...formatted,
                source_rate: formatted.rate,
                source_unit_id: formatted.unit_id,
                source_unit_code: formatted.unit_code,
                rate: convertedRate,
                unit_id: targetUnit.id,
                unit_code: targetUnit.code,
                unit_name: targetUnit.name,
                unit_category: targetUnit.category,
            };
        }

        return formatted;
    });
}

export async function listRates(resourceId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const res = await trx('cat_resource').where({ id: resourceId }).first();
        if (!res) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        const rows = await trx('cat_rate as r')
            .join('cat_unit as u', 'u.id', 'r.unit_id')
            .where('r.resource_id', resourceId)
            .select('r.*', 'u.code as unit_code', 'u.name as unit_name', 'u.category as unit_category')
            .orderBy('r.effective_from', 'asc');
        return rows.map(formatRateRow);
    });
}

export async function correctRate(rateId, patch, reason, options = {}, externalTrx = null) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'A reason is required when correcting a rate');
    }

    const { userId = null } = options || {};

    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_rate').where({ id: rateId }).first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Rate not found');

        const resource = await trx('cat_resource').where({ id: existing.resource_id }).forUpdate().first();
        if (!resource) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        const beforeData = formatRateRow(existing);
        const updateData = {};

        if (patch.rate !== undefined) {
            parseDecimal(patch.rate);
            if (cmpDec(patch.rate, '0') < 0) {
                throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Rate must be 0 or greater');
            }
            updateData.rate = toFixedStr(patch.rate, 4);
        }

        const nextUnitId = patch.unitId ?? patch.unit_id;
        if (nextUnitId !== undefined && Number(nextUnitId) !== Number(existing.unit_id)) {
            const unit = await trx('cat_unit').where({ id: nextUnitId }).first();
            if (!unit) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Unit not found');
            await assertUnitUsableForResource(trx, resource, unit);
            updateData.unit_id = Number(nextUnitId);
        }

        if (patch.note !== undefined) {
            updateData.note = patch.note !== null ? String(patch.note).slice(0, 255) : null;
        }

        const nextFrom = patch.effectiveFrom !== undefined || patch.effective_from !== undefined
            ? toDateStr(patch.effectiveFrom ?? patch.effective_from, 'effectiveFrom')
            : beforeData.effective_from;

        const nextTo = patch.effectiveTo !== undefined || patch.effective_to !== undefined
            ? optionalDateStr(patch.effectiveTo ?? patch.effective_to, 'effectiveTo')
            : beforeData.effective_to;

        if (nextTo !== null && nextTo < nextFrom) {
            throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'effective_to cannot be before effective_from');
        }

        if (nextFrom !== beforeData.effective_from || nextTo !== beforeData.effective_to) {
            const others = await trx('cat_rate')
                .where({ resource_id: existing.resource_id })
                .whereNot({ id: rateId })
                .forUpdate();
            const effEnd = nextTo || '9999-12-31';
            for (const o of others) {
                const oFrom = toDateStr(o.effective_from, 'effective_from');
                const oTo = optionalDateStr(o.effective_to, 'effective_to') || '9999-12-31';
                if (nextFrom <= oTo && oFrom <= effEnd) {
                    throw new CatalogError(CatalogErrorCodes.CAT_RATE_OVERLAP, `Corrected dates ${nextFrom}..${nextTo || 'open'} overlap existing rate ${oFrom}..${oTo}`);
                }
            }
            updateData.effective_from = nextFrom;
            updateData.effective_to = nextTo;
        }

        if (Object.keys(updateData).length > 0) {
            await trx('cat_rate').where({ id: rateId }).update(updateData);
        }

        const afterData = formatRateRow(await trx('cat_rate').where({ id: rateId }).first());

        if (resource.project_id === null) {
            await trx('cat_resource').where({ id: resource.id }).increment('version', 1);
        }

        await writeChangeLog(trx, {
            orgId: resource.org_id,
            entity: 'rate',
            entityId: rateId,
            action: 'correct',
            beforeData,
            afterData,
            reason: reason.trim(),
            userId,
        });

        return afterData;
    });
}

export async function removeRate(rateId, reason, options = {}, externalTrx = null) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'A reason is required when removing a future rate');
    }

    const { userId = null, today = todayStr() } = options || {};

    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_rate').where({ id: rateId }).first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Rate not found');

        const resource = await trx('cat_resource').where({ id: existing.resource_id }).forUpdate().first();
        if (!resource) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        const effFrom = toDateStr(existing.effective_from, 'effective_from');
        if (effFrom <= today) {
            throw new CatalogError(
                CatalogErrorCodes.CAT_INVALID_VALUE,
                `Past or active rate (${effFrom}) cannot be removed; use correctRate instead`
            );
        }

        const beforeData = formatRateRow(existing);
        await trx('cat_rate').where({ id: rateId }).delete();

        // If the immediately preceding rate closed the day before this rate, extend it to this rate's effective_to
        const prevClose = dayBefore(effFrom);
        const prevRate = await trx('cat_rate')
            .where({ resource_id: existing.resource_id, effective_to: prevClose })
            .first();
        if (prevRate) {
            await trx('cat_rate').where({ id: prevRate.id }).update({ effective_to: existing.effective_to });
        }

        if (resource.project_id === null) {
            await trx('cat_resource').where({ id: resource.id }).increment('version', 1);
        }

        await writeChangeLog(trx, {
            orgId: resource.org_id,
            entity: 'rate',
            entityId: rateId,
            action: 'delete',
            beforeData,
            afterData: null,
            reason: reason.trim(),
            userId,
        });

        return { deleted: true, id: rateId };
    });
}

// =========================================================================
// 4. Activities & Norms
// =========================================================================

async function fetchActivityWithNorms(trx, id) {
    const activity = await trx('cat_activity as a')
        .leftJoin('cat_unit as u', 'u.id', 'a.output_unit_id')
        .where('a.id', id)
        .select(
            'a.*',
            'u.code as output_unit_code',
            'u.name as output_unit_name',
            'u.category as output_unit_category'
        )
        .first();
    if (!activity) return null;

    const norms = await trx('cat_activity_norm as n')
        .join('cat_resource as r', 'r.id', 'n.resource_id')
        .join('cat_unit as u', 'u.id', 'n.unit_id')
        .join('cat_unit as bu', 'bu.id', 'r.base_unit_id')
        .where('n.activity_id', id)
        .select(
            'n.*',
            'r.code as resource_code',
            'r.name as resource_name',
            'r.kind as resource_kind',
            'r.base_unit_id as resource_base_unit_id',
            'bu.code as resource_base_unit_code',
            'u.code as unit_code',
            'u.name as unit_name',
            'u.category as unit_category'
        )
        .orderBy('r.code', 'asc')
        .orderBy('n.effective_from', 'asc');

    return {
        ...activity,
        norms: norms.map(formatNormRow),
    };
}

export async function createActivity(input, externalTrx = null) {
    const {
        orgId,
        projectId = null,
        parentId = null,
        code,
        name,
        outputUnitId,
        description = null,
        remarks = null,
        userId = null,
    } = input || {};

    if (!orgId) throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'orgId is required');
    const cleanCode = validateNonEmptyCode(code, 'Activity code');
    const cleanName = validateNonEmptyName(name, 'Activity name');
    if (!outputUnitId) throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'outputUnitId is required');

    const normalizedProjectId = projectId !== null && projectId !== undefined && projectId !== '' ? Number(projectId) : null;
    const normalizedParentId = parentId !== null && parentId !== undefined && parentId !== '' ? Number(parentId) : null;

    if (normalizedProjectId === null && normalizedParentId !== null) {
        throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Master activity cannot have a parent_id');
    }

    return withTransaction(externalTrx, async trx => {
        await verifyProjectMatchesOrg(trx, normalizedProjectId, orgId);

        const unit = await trx('cat_unit').where({ id: outputUnitId }).first();
        if (!unit) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Output unit not found');
        if (!isUnitAccessibleForOrg(unit.org_id, orgId)) {
            throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Output unit belongs to another organization');
        }

        let syncedVersion = null;
        if (normalizedParentId !== null) {
            const parent = await trx('cat_activity').where({ id: normalizedParentId }).first();
            if (!parent) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Parent master activity not found');
            if (parent.project_id !== null) {
                throw new CatalogError(CatalogErrorCodes.CAT_NOT_MASTER, 'Parent activity must be a master row');
            }
            if (String(parent.org_id) !== String(orgId)) {
                throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Parent activity belongs to another organization');
            }
            syncedVersion = parent.version;
        }

        const scopeKey = normalizedProjectId || 0;
        const dup = await trx('cat_activity')
            .where({ org_id: orgId, scope_key: scopeKey, code: cleanCode })
            .first();
        if (dup) {
            throw new CatalogError(CatalogErrorCodes.CAT_DUPLICATE_CODE, `Activity code "${cleanCode}" already exists in this scope`);
        }

        const [newId] = await trx('cat_activity').insert({
            org_id: orgId,
            project_id: normalizedProjectId,
            parent_id: normalizedParentId,
            code: cleanCode,
            name: cleanName,
            output_unit_id: outputUnitId,
            description: description ? String(description).slice(0, 500) : null,
            remarks: remarks ? String(remarks).slice(0, 500) : null,
            status: 'active',
            version: 1,
            synced_version: syncedVersion,
        });

        const created = await fetchActivityWithNorms(trx, newId);
        await writeChangeLog(trx, {
            orgId,
            entity: 'activity',
            entityId: newId,
            action: 'create',
            beforeData: null,
            afterData: created,
            userId,
        });

        return created;
    });
}

export async function updateActivity(id, patch, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_activity').where({ id }).forUpdate().first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');

        const updateData = {};
        if (patch.name !== undefined) {
            updateData.name = validateNonEmptyName(patch.name, 'Activity name');
        }
        if (patch.code !== undefined) {
            const cleanCode = validateNonEmptyCode(patch.code, 'Activity code');
            if (cleanCode !== existing.code) {
                const dup = await trx('cat_activity')
                    .where({ org_id: existing.org_id, scope_key: existing.scope_key, code: cleanCode })
                    .whereNot({ id })
                    .first();
                if (dup) {
                    throw new CatalogError(CatalogErrorCodes.CAT_DUPLICATE_CODE, `Activity code "${cleanCode}" already exists in this scope`);
                }
                updateData.code = cleanCode;
            }
        }
        if (patch.description !== undefined) {
            updateData.description = patch.description !== null ? String(patch.description).slice(0, 500) : null;
        }
        if (patch.remarks !== undefined) {
            updateData.remarks = patch.remarks !== null ? String(patch.remarks).slice(0, 500) : null;
        }

        const nextOutputUnitId = patch.outputUnitId ?? patch.output_unit_id;
        if (nextOutputUnitId !== undefined && Number(nextOutputUnitId) !== Number(existing.output_unit_id)) {
            const unit = await trx('cat_unit').where({ id: nextOutputUnitId }).first();
            if (!unit) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Output unit not found');
            if (!isUnitAccessibleForOrg(unit.org_id, existing.org_id)) {
                throw new CatalogError(CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE, 'Output unit belongs to another organization');
            }
            const [hasNorm, externalInUse] = await Promise.all([
                trx('cat_activity_norm').where({ activity_id: id }).first(),
                runUsageChecks('activity', [id]),
            ]);
            if (hasNorm || externalInUse.length > 0) {
                throw new CatalogError(
                    CatalogErrorCodes.CAT_IN_USE,
                    'Cannot change activity output unit while norms or external records reference this activity'
                );
            }
            updateData.output_unit_id = Number(nextOutputUnitId);
        }

        if (Object.keys(updateData).length === 0) {
            return fetchActivityWithNorms(trx, id);
        }

        if (existing.project_id === null) {
            updateData.version = existing.version + 1;
        }

        await trx('cat_activity').where({ id }).update(updateData);
        const updated = await fetchActivityWithNorms(trx, id);

        await writeChangeLog(trx, {
            orgId: existing.org_id,
            entity: 'activity',
            entityId: id,
            action: 'update',
            beforeData: existing,
            afterData: updated,
            reason: patch.reason || null,
            userId: patch.userId || null,
        });

        return updated;
    });
}

export async function archiveActivity(id, options = {}, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_activity').where({ id }).forUpdate().first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');

        if (existing.status === 'archived') return fetchActivityWithNorms(trx, id);

        const updateData = { status: 'archived' };
        if (existing.project_id === null) updateData.version = existing.version + 1;

        await trx('cat_activity').where({ id }).update(updateData);
        const updated = await fetchActivityWithNorms(trx, id);

        await writeChangeLog(trx, {
            orgId: existing.org_id,
            entity: 'activity',
            entityId: id,
            action: 'archive',
            beforeData: existing,
            afterData: updated,
            reason: options?.reason || null,
            userId: options?.userId || null,
        });

        return updated;
    });
}

export async function restoreActivity(id, options = {}, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_activity').where({ id }).forUpdate().first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');

        if (existing.status === 'active') return fetchActivityWithNorms(trx, id);

        const updateData = { status: 'active' };
        if (existing.project_id === null) updateData.version = existing.version + 1;

        await trx('cat_activity').where({ id }).update(updateData);
        const updated = await fetchActivityWithNorms(trx, id);

        await writeChangeLog(trx, {
            orgId: existing.org_id,
            entity: 'activity',
            entityId: id,
            action: 'restore',
            beforeData: existing,
            afterData: updated,
            reason: options?.reason || null,
            userId: options?.userId || null,
        });

        return updated;
    });
}

export async function deleteActivity(id, options = {}, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_activity').where({ id }).forUpdate().first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');

        const [hasCopies, externalInUse] = await Promise.all([
            trx('cat_activity').where({ parent_id: id }).first(),
            runUsageChecks('activity', [id]),
        ]);

        if (hasCopies || externalInUse.length > 0) {
            throw new CatalogError(
                CatalogErrorCodes.CAT_IN_USE,
                'Activity is referenced by project copies or external modules and can only be archived'
            );
        }

        await trx('cat_activity').where({ id }).delete();

        await writeChangeLog(trx, {
            orgId: existing.org_id,
            entity: 'activity',
            entityId: id,
            action: 'delete',
            beforeData: existing,
            afterData: null,
            reason: options?.reason || null,
            userId: options?.userId || null,
        });

        return { deleted: true, id };
    });
}

export async function getActivity(id, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        return fetchActivityWithNorms(trx, id);
    });
}

export async function listActivities(filter = {}, externalTrx = null) {
    const {
        orgId,
        scope,
        projectId,
        status,
        search,
    } = filter || {};

    return withTransaction(externalTrx, async trx => {
        let query = trx('cat_activity as a')
            .leftJoin('cat_unit as u', 'u.id', 'a.output_unit_id')
            .leftJoin('cat_activity as p', 'p.id', 'a.parent_id');

        if (orgId) {
            query = query.where('a.org_id', orgId);
        }
        if (scope === 'master' || projectId === null) {
            query = query.whereNull('a.project_id');
        } else if (projectId !== undefined && projectId !== '') {
            query = query.where('a.project_id', Number(projectId));
        }
        if (status) {
            query = query.where('a.status', status);
        }
        if (search && String(search).trim()) {
            const term = `%${String(search).trim()}%`;
            query = query.where(q => q.where('a.code', 'like', term).orWhere('a.name', 'like', term));
        }

        const activities = await query
            .select(
                'a.*',
                'u.code as output_unit_code',
                'u.name as output_unit_name',
                'u.category as output_unit_category',
                'p.version as master_version'
            )
            .orderBy('a.code', 'asc');

        if (activities.length === 0) return [];

        const actIds = activities.map(a => a.id);
        const allNorms = await trx('cat_activity_norm as n')
            .join('cat_resource as r', 'r.id', 'n.resource_id')
            .join('cat_unit as u', 'u.id', 'n.unit_id')
            .join('cat_unit as bu', 'bu.id', 'r.base_unit_id')
            .whereIn('n.activity_id', actIds)
            .select(
                'n.*',
                'r.code as resource_code',
                'r.name as resource_name',
                'r.kind as resource_kind',
                'r.base_unit_id as resource_base_unit_id',
                'bu.code as resource_base_unit_code',
                'u.code as unit_code',
                'u.name as unit_name',
                'u.category as unit_category'
            )
            .orderBy('r.code', 'asc')
            .orderBy('n.effective_from', 'asc');

        const normsByAct = new Map();
        for (const n of allNorms) {
            if (!normsByAct.has(n.activity_id)) normsByAct.set(n.activity_id, []);
            normsByAct.get(n.activity_id).push(formatNormRow(n));
        }

        return activities.map(a => ({
            ...a,
            norms: normsByAct.get(a.id) || [],
        }));
    });
}

export async function setNorm(activityId, resourceId, qtyPerUnit, unitId, effectiveFrom, note = null, options = {}, externalTrx = null) {
    if (qtyPerUnit === null || qtyPerUnit === undefined || qtyPerUnit === '') {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'qtyPerUnit is required');
    }
    parseDecimal(qtyPerUnit);
    if (cmpDec(qtyPerUnit, '0') <= 0) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'qtyPerUnit must be greater than 0');
    }

    const rawWastage = options?.wastagePct ?? options?.wastage_pct ?? 0;
    parseDecimal(rawWastage);
    if (cmpDec(rawWastage, '0') < 0 || cmpDec(rawWastage, '100') > 0) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'wastagePct must be between 0 and 100');
    }
    const cleanWastage = toFixedStr(rawWastage, 3);

    const effFrom = toDateStr(effectiveFrom, 'effectiveFrom');
    const { userId = null } = options || {};

    return withTransaction(externalTrx, async trx => {
        const activity = await trx('cat_activity').where({ id: activityId }).forUpdate().first();
        if (!activity) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        if (activity.status === 'archived') {
            throw new CatalogError(CatalogErrorCodes.CAT_ARCHIVED, 'Cannot add norms to an archived activity');
        }

        const resource = await trx('cat_resource').where({ id: resourceId }).first();
        if (!resource) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        if (resource.status === 'archived') {
            throw new CatalogError(CatalogErrorCodes.CAT_ARCHIVED, 'Archived resource cannot be added to a norm');
        }

        // Same-scope invariant (Invariant 4)
        const sameOrg = String(activity.org_id) === String(resource.org_id);
        const bothMaster = activity.project_id === null && resource.project_id === null;
        const sameProject = activity.project_id !== null && resource.project_id !== null &&
            String(activity.project_id) === String(resource.project_id);
        if (!sameOrg || (!bothMaster && !sameProject)) {
            throw new CatalogError(
                CatalogErrorCodes.CAT_SCOPE_MISMATCH,
                'Norm resource must belong to the same scope (master or same project) as the activity'
            );
        }

        const unit = await trx('cat_unit').where({ id: unitId }).first();
        if (!unit) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Norm unit not found');
        await assertUnitUsableForResource(trx, resource, unit);

        const existingNorms = await trx('cat_activity_norm')
            .where({ activity_id: activityId, resource_id: resourceId })
            .orderBy('effective_from', 'asc')
            .forUpdate();

        for (const n of existingNorms) {
            const nFrom = toDateStr(n.effective_from, 'effective_from');
            const nTo = optionalDateStr(n.effective_to, 'effective_to');
            if (nFrom === effFrom) {
                throw new CatalogError(CatalogErrorCodes.CAT_NORM_OVERLAP, `A norm already starts on ${effFrom}`);
            }
            if (nFrom > effFrom) {
                throw new CatalogError(CatalogErrorCodes.CAT_NORM_OVERLAP, `Norm date ${effFrom} precedes existing norm starting ${nFrom}`);
            }
            if (nTo !== null && effFrom >= nFrom && effFrom <= nTo) {
                throw new CatalogError(CatalogErrorCodes.CAT_NORM_OVERLAP, `Norm date ${effFrom} falls inside existing period ${nFrom}..${nTo}`);
            }
        }

        const openNorm = existingNorms.find(n => n.effective_to === null || n.effective_to === undefined);
        if (openNorm) {
            await trx('cat_activity_norm').where({ id: openNorm.id }).update({ effective_to: dayBefore(effFrom) });
        }

        const [newId] = await trx('cat_activity_norm').insert({
            activity_id: activityId,
            resource_id: resourceId,
            qty_per_unit: toFixedStr(qtyPerUnit, 6),
            unit_id: unitId,
            wastage_pct: cleanWastage,
            effective_from: effFrom,
            effective_to: null,
            note: note ? String(note).slice(0, 255) : null,
        });

        const inserted = formatNormRow(await trx('cat_activity_norm').where({ id: newId }).first());

        if (activity.project_id === null) {
            await trx('cat_activity').where({ id: activity.id }).increment('version', 1);
        }

        await writeChangeLog(trx, {
            orgId: activity.org_id,
            entity: 'norm',
            entityId: newId,
            action: 'create',
            beforeData: openNorm ? formatNormRow(openNorm) : null,
            afterData: inserted,
            userId,
        });

        return inserted;
    });
}

export async function getNorms(activityId, date, externalTrx = null) {
    const asOfDate = toDateStr(date, 'date');
    return withTransaction(externalTrx, async trx => {
        const rows = await trx('cat_activity_norm as n')
            .join('cat_resource as r', 'r.id', 'n.resource_id')
            .join('cat_unit as u', 'u.id', 'n.unit_id')
            .join('cat_unit as bu', 'bu.id', 'r.base_unit_id')
            .where('n.activity_id', activityId)
            .where('n.effective_from', '<=', asOfDate)
            .where(q => q.whereNull('n.effective_to').orWhere('n.effective_to', '>=', asOfDate))
            .select(
                'n.*',
                'r.code as resource_code',
                'r.name as resource_name',
                'r.kind as resource_kind',
                'r.base_unit_id as resource_base_unit_id',
                'bu.code as resource_base_unit_code',
                'u.code as unit_code',
                'u.name as unit_name',
                'u.category as unit_category'
            )
            .orderBy('r.code', 'asc');
        return rows.map(formatNormRow);
    });
}

// -------------------------------------------------------------
// correctNorm implementation
// -------------------------------------------------------------
export async function correctNorm(normId, patch, reason, options = {}, externalTrx = null) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'A reason is required when correcting a norm');
    }
    const { userId = null } = options || {};

    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_activity_norm').where({ id: normId }).first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Norm not found');

        const activity = await trx('cat_activity').where({ id: existing.activity_id }).forUpdate().first();
        if (!activity) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        const resource = await trx('cat_resource').where({ id: existing.resource_id }).first();

        const beforeData = formatNormRow(existing);
        const updateData = {};

        const nextQty = patch.qtyPerUnit ?? patch.qty_per_unit;
        if (nextQty !== undefined) {
            parseDecimal(nextQty);
            if (cmpDec(nextQty, '0') <= 0) {
                throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'qtyPerUnit must be greater than 0');
            }
            updateData.qty_per_unit = toFixedStr(nextQty, 6);
        }

        const nextUnitId = patch.unitId ?? patch.unit_id;
        if (nextUnitId !== undefined && Number(nextUnitId) !== Number(existing.unit_id)) {
            const unit = await trx('cat_unit').where({ id: nextUnitId }).first();
            if (!unit) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Unit not found');
            await assertUnitUsableForResource(trx, resource, unit);
            updateData.unit_id = Number(nextUnitId);
        }

        const nextWastage = patch.wastagePct ?? patch.wastage_pct;
        if (nextWastage !== undefined) {
            parseDecimal(nextWastage);
            if (cmpDec(nextWastage, '0') < 0 || cmpDec(nextWastage, '100') > 0) {
                throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'wastagePct must be between 0 and 100');
            }
            updateData.wastage_pct = toFixedStr(nextWastage, 3);
        }

        if (patch.note !== undefined) {
            updateData.note = patch.note !== null ? String(patch.note).slice(0, 255) : null;
        }

        const nextFrom = patch.effectiveFrom !== undefined || patch.effective_from !== undefined
            ? toDateStr(patch.effectiveFrom ?? patch.effective_from, 'effectiveFrom')
            : beforeData.effective_from;

        const nextTo = patch.effectiveTo !== undefined || patch.effective_to !== undefined
            ? optionalDateStr(patch.effectiveTo ?? patch.effective_to, 'effectiveTo')
            : beforeData.effective_to;

        if (nextTo !== null && nextTo < nextFrom) {
            throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'effective_to cannot be before effective_from');
        }

        if (nextFrom !== beforeData.effective_from || nextTo !== beforeData.effective_to) {
            const others = await trx('cat_activity_norm')
                .where({ activity_id: existing.activity_id, resource_id: existing.resource_id })
                .whereNot({ id: normId })
                .forUpdate();
            const effEnd = nextTo || '9999-12-31';
            for (const o of others) {
                const oFrom = toDateStr(o.effective_from, 'effective_from');
                const oTo = optionalDateStr(o.effective_to, 'effective_to') || '9999-12-31';
                if (nextFrom <= oTo && oFrom <= effEnd) {
                    throw new CatalogError(CatalogErrorCodes.CAT_NORM_OVERLAP, `Corrected norm dates ${nextFrom}..${nextTo || 'open'} overlap existing period`);
                }
            }
            updateData.effective_from = nextFrom;
            updateData.effective_to = nextTo;
        }

        if (Object.keys(updateData).length > 0) {
            await trx('cat_activity_norm').where({ id: normId }).update(updateData);
        }

        const afterData = formatNormRow(await trx('cat_activity_norm').where({ id: normId }).first());

        if (activity.project_id === null) {
            await trx('cat_activity').where({ id: activity.id }).increment('version', 1);
        }

        await writeChangeLog(trx, {
            orgId: activity.org_id,
            entity: 'norm',
            entityId: normId,
            action: 'correct',
            beforeData,
            afterData,
            reason: reason.trim(),
            userId,
        });

        return afterData;
    });
}

export async function removeNorm(normId, reason, options = {}, externalTrx = null) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'A reason is required when removing a future norm');
    }
    const { userId = null, today = todayStr() } = options || {};

    return withTransaction(externalTrx, async trx => {
        const existing = await trx('cat_activity_norm').where({ id: normId }).first();
        if (!existing) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Norm not found');

        const activity = await trx('cat_activity').where({ id: existing.activity_id }).forUpdate().first();
        if (!activity) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');

        const effFrom = toDateStr(existing.effective_from, 'effective_from');
        if (effFrom <= today) {
            throw new CatalogError(
                CatalogErrorCodes.CAT_INVALID_VALUE,
                `Past or active norm (${effFrom}) cannot be removed; use correctNorm instead`
            );
        }

        const beforeData = formatNormRow(existing);
        await trx('cat_activity_norm').where({ id: normId }).delete();

        const prevClose = dayBefore(effFrom);
        const prevNorm = await trx('cat_activity_norm')
            .where({ activity_id: existing.activity_id, resource_id: existing.resource_id, effective_to: prevClose })
            .first();
        if (prevNorm) {
            await trx('cat_activity_norm').where({ id: prevNorm.id }).update({ effective_to: existing.effective_to });
        }

        if (activity.project_id === null) {
            await trx('cat_activity').where({ id: activity.id }).increment('version', 1);
        }

        await writeChangeLog(trx, {
            orgId: activity.org_id,
            entity: 'norm',
            entityId: normId,
            action: 'delete',
            beforeData,
            afterData: null,
            reason: reason.trim(),
            userId,
        });

        return { deleted: true, id: normId };
    });
}

export async function importActivity(masterId, projectId, options = {}, externalTrx = null) {
    if (!projectId) {
        throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Target projectId is required to import a master activity');
    }

    const {
        asNewVariant = false,
        code = null,
        name = null,
        userId = null,
    } = options || {};

    return withTransaction(externalTrx, async trx => {
        const master = await trx('cat_activity').where({ id: masterId }).forUpdate().first();
        if (!master) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Master activity not found');
        }
        if (master.project_id !== null) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_MASTER, 'Only master catalog activities can be imported');
        }
        if (master.status === 'archived') {
            throw new CatalogError(CatalogErrorCodes.CAT_ARCHIVED, 'Archived master activity cannot be imported');
        }

        await verifyProjectMatchesOrg(trx, Number(projectId), master.org_id);

        if (!asNewVariant) {
            const existingCopy = await trx('cat_activity')
                .where({ org_id: master.org_id, project_id: Number(projectId), parent_id: master.id })
                .forUpdate()
                .orderBy('id', 'asc')
                .first();
            if (existingCopy) {
                return fetchActivityWithNorms(trx, existingCopy.id);
            }
        }

        const newCode = validateNonEmptyCode(code || master.code, 'Activity code');
        const newName = validateNonEmptyName(name || master.name, 'Activity name');

        const dup = await trx('cat_activity')
            .where({ org_id: master.org_id, scope_key: Number(projectId), code: newCode })
            .first();
        if (dup) {
            throw new CatalogError(CatalogErrorCodes.CAT_DUPLICATE_CODE, `Activity code "${newCode}" already exists in project #${projectId}`);
        }

        const [newActId] = await trx('cat_activity').insert({
            org_id: master.org_id,
            project_id: Number(projectId),
            parent_id: master.id,
            code: newCode,
            name: newName,
            output_unit_id: master.output_unit_id,
            description: master.description,
            remarks: master.remarks,
            status: 'active',
            version: 1,
            synced_version: master.version,
        });

        // Copy norms and import/reuse needed project resources
        const masterNorms = await trx('cat_activity_norm')
            .where({ activity_id: master.id })
            .orderBy('effective_from', 'asc');

        const resourceMap = new Map();
        for (const n of masterNorms) {
            let projectRes = resourceMap.get(n.resource_id);
            if (!projectRes) {
                projectRes = await importResource(n.resource_id, Number(projectId), { userId }, trx);
                resourceMap.set(n.resource_id, projectRes);
            }
            await trx('cat_activity_norm').insert({
                activity_id: newActId,
                resource_id: projectRes.id,
                qty_per_unit: n.qty_per_unit,
                unit_id: n.unit_id,
                wastage_pct: n.wastage_pct ?? 0,
                effective_from: toDateStr(n.effective_from, 'effective_from'),
                effective_to: optionalDateStr(n.effective_to, 'effective_to'),
                note: n.note,
            });
        }

        const created = await fetchActivityWithNorms(trx, newActId);
        await writeChangeLog(trx, {
            orgId: master.org_id,
            entity: 'activity',
            entityId: newActId,
            action: 'import',
            beforeData: null,
            afterData: {
                masterId: master.id,
                masterVersion: master.version,
                asNewVariant: Boolean(asNewVariant),
                activity: created,
            },
            userId,
        });

        return created;
    });
}

// =========================================================================
// 5. Master -> Project Sync (Status, Diff, Accept)
// =========================================================================

function resolveSyncArgs(arg1, arg2) {
    if (arg1 === 'resource' || arg1 === 'activity') {
        return { entityType: arg1, id: Number(arg2) };
    }
    return { entityType: arg2 === 'activity' ? 'activity' : 'resource', id: Number(arg1) };
}

export async function getResourceSyncStatus(projectResourceId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const copy = await trx('cat_resource').where({ id: projectResourceId }).first();
        if (!copy) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');

        if (copy.project_id === null || !copy.parent_id) {
            return {
                entity: 'resource',
                id: copy.id,
                hasMaster: false,
                status: 'standalone',
                isBehind: false,
                masterVersion: null,
                syncedVersion: copy.synced_version,
            };
        }

        const master = await trx('cat_resource').where({ id: copy.parent_id }).first();
        if (!master) {
            return {
                entity: 'resource',
                id: copy.id,
                hasMaster: false,
                status: 'orphaned',
                isBehind: false,
                masterVersion: null,
                syncedVersion: copy.synced_version,
            };
        }

        const isBehind = Number(master.version) > Number(copy.synced_version || 0);
        return {
            entity: 'resource',
            id: copy.id,
            masterId: master.id,
            hasMaster: true,
            status: isBehind ? 'behind' : 'synced',
            isBehind,
            masterVersion: master.version,
            syncedVersion: copy.synced_version,
        };
    });
}

export async function getActivitySyncStatus(projectActivityId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const copy = await trx('cat_activity').where({ id: projectActivityId }).first();
        if (!copy) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');

        if (copy.project_id === null || !copy.parent_id) {
            return {
                entity: 'activity',
                id: copy.id,
                hasMaster: false,
                status: 'standalone',
                isBehind: false,
                masterVersion: null,
                syncedVersion: copy.synced_version,
            };
        }

        const master = await trx('cat_activity').where({ id: copy.parent_id }).first();
        if (!master) {
            return {
                entity: 'activity',
                id: copy.id,
                hasMaster: false,
                status: 'orphaned',
                isBehind: false,
                masterVersion: null,
                syncedVersion: copy.synced_version,
            };
        }

        const isBehind = Number(master.version) > Number(copy.synced_version || 0);
        return {
            entity: 'activity',
            id: copy.id,
            masterId: master.id,
            hasMaster: true,
            status: isBehind ? 'behind' : 'synced',
            isBehind,
            masterVersion: master.version,
            syncedVersion: copy.synced_version,
        };
    });
}

export async function getSyncStatus(idOrEntity, entityOrId = 'resource', externalTrx = null) {
    const { entityType, id } = resolveSyncArgs(idOrEntity, entityOrId);
    if (entityType === 'activity') return getActivitySyncStatus(id, externalTrx);
    return getResourceSyncStatus(id, externalTrx);
}

export async function getResourceSyncDiff(projectResourceId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const copy = await fetchResourceWithUnit(trx, projectResourceId);
        if (!copy) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        if (copy.project_id === null || !copy.parent_id) {
            throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Resource is not a project copy linked to a master');
        }

        const master = await fetchResourceWithUnit(trx, copy.parent_id);
        if (!master) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Master resource not found');

        const [masterRates, projectRates, masterConvs, projectConvs] = await Promise.all([
            listRates(master.id, trx),
            listRates(copy.id, trx),
            loadResourceConversions(trx, master.id),
            loadResourceConversions(trx, copy.id),
        ]);

        const fieldKeys = ['code', 'name', 'base_unit_id', 'description', 'remarks', 'status'];
        const fields = {};
        for (const k of fieldKeys) {
            fields[k] = {
                master: master[k],
                project: copy[k],
                changed: String(master[k] ?? '') !== String(copy[k] ?? ''),
            };
        }

        const normRateKey = (r) => `${r.effective_from}|${r.effective_to || ''}|${r.unit_id}|${toFixedStr(r.rate, 4)}`;
        const ratesChanged = JSON.stringify(masterRates.map(normRateKey)) !== JSON.stringify(projectRates.map(normRateKey));

        const normConvKey = (c) => `${c.from_unit_id}|${c.to_unit_id}|${toFixedStr(c.factor, 10)}`;
        const convsChanged = JSON.stringify(masterConvs.map(normConvKey).sort()) !== JSON.stringify(projectConvs.map(normConvKey).sort());

        return {
            entity: 'resource',
            projectId: copy.project_id,
            projectResourceId: copy.id,
            masterId: master.id,
            masterVersion: master.version,
            syncedVersion: copy.synced_version,
            isBehind: Number(master.version) > Number(copy.synced_version || 0),
            fields,
            rates: { master: masterRates, project: projectRates, changed: ratesChanged },
            conversions: { master: masterConvs, project: projectConvs, changed: convsChanged },
        };
    });
}

export async function getActivitySyncDiff(projectActivityId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const copy = await fetchActivityWithNorms(trx, projectActivityId);
        if (!copy) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        if (copy.project_id === null || !copy.parent_id) {
            throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Activity is not a project copy linked to a master');
        }

        const master = await fetchActivityWithNorms(trx, copy.parent_id);
        if (!master) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Master activity not found');

        const fieldKeys = ['code', 'name', 'output_unit_id', 'description', 'remarks', 'status'];
        const fields = {};
        for (const k of fieldKeys) {
            fields[k] = {
                master: master[k],
                project: copy[k],
                changed: String(master[k] ?? '') !== String(copy[k] ?? ''),
            };
        }

        const normKey = (n) => `${n.resource_code}|${n.effective_from}|${n.effective_to || ''}|${n.unit_id}|${toFixedStr(n.qty_per_unit, 6)}|${toFixedStr(n.wastage_pct ?? 0, 3)}`;
        const normsChanged = JSON.stringify(master.norms.map(normKey).sort()) !== JSON.stringify(copy.norms.map(normKey).sort());

        return {
            entity: 'activity',
            projectId: copy.project_id,
            projectActivityId: copy.id,
            masterId: master.id,
            masterVersion: master.version,
            syncedVersion: copy.synced_version,
            isBehind: Number(master.version) > Number(copy.synced_version || 0),
            fields,
            norms: { master: master.norms, project: copy.norms, changed: normsChanged },
        };
    });
}

export async function getSyncDiff(idOrEntity, entityOrId = 'resource', externalTrx = null) {
    const { entityType, id } = resolveSyncArgs(idOrEntity, entityOrId);
    if (entityType === 'activity') return getActivitySyncDiff(id, externalTrx);
    return getResourceSyncDiff(id, externalTrx);
}

function normalizeSelection(selection = {}) {
    const fieldSet = new Set(Array.isArray(selection.fields) ? selection.fields : []);
    for (const k of ['code', 'name', 'base_unit_id', 'output_unit_id', 'description', 'remarks', 'status']) {
        if (selection[k] === true) fieldSet.add(k);
    }
    if (selection.baseUnitId === true) fieldSet.add('base_unit_id');
    if (selection.outputUnitId === true) fieldSet.add('output_unit_id');

    return {
        fields: fieldSet,
        rates: Boolean(selection.rates || selection.rate),
        conversions: Boolean(selection.conversions || selection.conversion),
        norms: Boolean(selection.norms || selection.norm),
    };
}

export async function acceptResourceSync(projectResourceId, selection = {}, options = {}, externalTrx = null) {
    const { userId = null, reason = null } = options || {};
    const sel = normalizeSelection(selection);

    return withTransaction(externalTrx, async trx => {
        const copy = await trx('cat_resource').where({ id: projectResourceId }).forUpdate().first();
        if (!copy) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        if (copy.project_id === null || !copy.parent_id) {
            throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Resource is not a project copy linked to a master');
        }

        const master = await trx('cat_resource').where({ id: copy.parent_id }).first();
        if (!master) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Master resource not found');

        const beforeData = await fetchResourceWithUnit(trx, copy.id);
        const updateData = {
            synced_version: master.version,
            version: copy.version + 1,
        };

        for (const f of ['name', 'description', 'remarks', 'status']) {
            if (sel.fields.has(f)) updateData[f] = master[f];
        }
        if (sel.fields.has('code') && master.code !== copy.code) {
            const dup = await trx('cat_resource')
                .where({ org_id: copy.org_id, scope_key: copy.scope_key, code: master.code })
                .whereNot({ id: copy.id })
                .first();
            if (dup) {
                throw new CatalogError(CatalogErrorCodes.CAT_DUPLICATE_CODE, `Code "${master.code}" already exists in project`);
            }
            updateData.code = master.code;
        }
        if (sel.fields.has('base_unit_id') && master.base_unit_id !== copy.base_unit_id) {
            updateData.base_unit_id = master.base_unit_id;
        }

        if (sel.conversions) {
            await trx('cat_resource_conversion').where({ resource_id: copy.id }).delete();
            const masterConvs = await trx('cat_resource_conversion').where({ resource_id: master.id });
            for (const c of masterConvs) {
                await trx('cat_resource_conversion').insert({
                    resource_id: copy.id,
                    from_unit_id: c.from_unit_id,
                    to_unit_id: c.to_unit_id,
                    factor: c.factor,
                });
            }
        }

        if (sel.rates) {
            await trx('cat_rate').where({ resource_id: copy.id }).delete();
            const masterRates = await trx('cat_rate').where({ resource_id: master.id }).orderBy('effective_from', 'asc');
            for (const r of masterRates) {
                await trx('cat_rate').insert({
                    resource_id: copy.id,
                    rate: r.rate,
                    unit_id: r.unit_id,
                    effective_from: toDateStr(r.effective_from, 'effective_from'),
                    effective_to: optionalDateStr(r.effective_to, 'effective_to'),
                    note: r.note,
                    created_by: userId || r.created_by,
                });
            }
        }

        await trx('cat_resource').where({ id: copy.id }).update(updateData);
        const afterData = await fetchResourceWithUnit(trx, copy.id);

        await writeChangeLog(trx, {
            orgId: copy.org_id,
            entity: 'resource',
            entityId: copy.id,
            action: 'sync_accept',
            beforeData,
            afterData: {
                resource: afterData,
                selection: {
                    fields: Array.from(sel.fields),
                    rates: sel.rates,
                    conversions: sel.conversions,
                },
                syncedVersion: master.version,
            },
            reason,
            userId,
        });

        return afterData;
    });
}

export async function acceptActivitySync(projectActivityId, selection = {}, options = {}, externalTrx = null) {
    const { userId = null, reason = null } = options || {};
    const sel = normalizeSelection(selection);

    return withTransaction(externalTrx, async trx => {
        const copy = await trx('cat_activity').where({ id: projectActivityId }).forUpdate().first();
        if (!copy) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        if (copy.project_id === null || !copy.parent_id) {
            throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'Activity is not a project copy linked to a master');
        }

        const master = await trx('cat_activity').where({ id: copy.parent_id }).first();
        if (!master) throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Master activity not found');

        const beforeData = await fetchActivityWithNorms(trx, copy.id);
        const updateData = {
            synced_version: master.version,
            version: copy.version + 1,
        };

        for (const f of ['name', 'description', 'remarks', 'status']) {
            if (sel.fields.has(f)) updateData[f] = master[f];
        }
        if (sel.fields.has('code') && master.code !== copy.code) {
            const dup = await trx('cat_activity')
                .where({ org_id: copy.org_id, scope_key: copy.scope_key, code: master.code })
                .whereNot({ id: copy.id })
                .first();
            if (dup) {
                throw new CatalogError(CatalogErrorCodes.CAT_DUPLICATE_CODE, `Activity code "${master.code}" already exists in project`);
            }
            updateData.code = master.code;
        }
        if (sel.fields.has('output_unit_id') && master.output_unit_id !== copy.output_unit_id) {
            updateData.output_unit_id = master.output_unit_id;
        }

        if (sel.norms) {
            await trx('cat_activity_norm').where({ activity_id: copy.id }).delete();
            const masterNorms = await trx('cat_activity_norm')
                .where({ activity_id: master.id })
                .orderBy('effective_from', 'asc');
            const resCache = new Map();
            for (const n of masterNorms) {
                let projRes = resCache.get(n.resource_id);
                if (!projRes) {
                    projRes = await importResource(n.resource_id, copy.project_id, { userId }, trx);
                    resCache.set(n.resource_id, projRes);
                }
                await trx('cat_activity_norm').insert({
                    activity_id: copy.id,
                    resource_id: projRes.id,
                    qty_per_unit: n.qty_per_unit,
                    unit_id: n.unit_id,
                    wastage_pct: n.wastage_pct ?? 0,
                    effective_from: toDateStr(n.effective_from, 'effective_from'),
                    effective_to: optionalDateStr(n.effective_to, 'effective_to'),
                    note: n.note,
                });
            }
        }

        await trx('cat_activity').where({ id: copy.id }).update(updateData);
        const afterData = await fetchActivityWithNorms(trx, copy.id);

        await writeChangeLog(trx, {
            orgId: copy.org_id,
            entity: 'activity',
            entityId: copy.id,
            action: 'sync_accept',
            beforeData,
            afterData: {
                activity: afterData,
                selection: {
                    fields: Array.from(sel.fields),
                    norms: sel.norms,
                },
                syncedVersion: master.version,
            },
            reason,
            userId,
        });

        return afterData;
    });
}

export async function acceptSync(idOrEntity, selectionOrId, optionsOrSelection = {}, maybeOptions = {}, externalTrx = null) {
    if (idOrEntity === 'activity' || idOrEntity === 'resource') {
        const id = Number(selectionOrId);
        const selection = optionsOrSelection;
        const options = maybeOptions;
        if (idOrEntity === 'activity') return acceptActivitySync(id, selection, options, externalTrx);
        return acceptResourceSync(id, selection, options, externalTrx);
    }
    return acceptResourceSync(Number(idOrEntity), selectionOrId, optionsOrSelection, externalTrx);
}

// =========================================================================
// 6. Computation (Activity Cost & Expected Usage)
// =========================================================================

export async function computeActivityCost(activityId, date, externalTrx = null) {
    const asOfDate = toDateStr(date, 'date');

    return withTransaction(externalTrx, async trx => {
        const activity = await trx('cat_activity as a')
            .leftJoin('cat_unit as u', 'u.id', 'a.output_unit_id')
            .where('a.id', activityId)
            .select('a.*', 'u.code as output_unit_code', 'u.name as output_unit_name')
            .first();

        if (!activity) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        }

        const norms = await getNorms(activityId, asOfDate, trx);
        if (norms.length === 0) {
            return {
                activityId: activity.id,
                activityCode: activity.code,
                activityName: activity.name,
                outputUnitId: activity.output_unit_id,
                outputUnitCode: activity.output_unit_code,
                date: asOfDate,
                total: 0,
                complete: true,
                incomplete: false,
                lines: [],
                warnings: [],
            };
        }

        let totalDec = '0';
        let incomplete = false;
        const lines = [];
        const warnings = [];

        for (const n of norms) {
            let rateRow = null;
            let warningMsg = null;

            const wastagePctStr = toFixedStr(n.wastage_pct ?? 0, 3);
            const wastageFactor = addDec('1', divDec(wastagePctStr, '100'));
            const grossQtyDec = mulDec(n.qty_per_unit, wastageFactor);

            try {
                rateRow = await getRate(n.resource_id, asOfDate, { inUnit: n.unit_id }, trx);
                if (!rateRow) {
                    warningMsg = `No rate in force on ${asOfDate} for ${n.resource_name} (${n.resource_code})`;
                }
            } catch (err) {
                warningMsg = err.message || `Cannot convert rate unit for ${n.resource_name} (${n.resource_code})`;
            }

            if (!rateRow || warningMsg) {
                incomplete = true;
                warnings.push({
                    code: 'MISSING_RATE',
                    resourceId: n.resource_id,
                    resourceCode: n.resource_code,
                    resourceName: n.resource_name,
                    message: warningMsg,
                });
                lines.push({
                    resourceId: n.resource_id,
                    resourceCode: n.resource_code,
                    resourceName: n.resource_name,
                    kind: n.resource_kind,
                    qty: toNumber(n.qty_per_unit, 6),
                    netQty: toNumber(n.qty_per_unit, 6),
                    wastagePct: toNumber(wastagePctStr, 3),
                    grossQty: toNumber(grossQtyDec, 6),
                    unitId: n.unit_id,
                    unitCode: n.unit_code,
                    rate: null,
                    amount: null,
                });
            } else {
                const rawAmount = mulDec(grossQtyDec, rateRow.rate);
                const amountDec = roundDec(rawAmount, 4);
                totalDec = addDec(totalDec, amountDec);
                lines.push({
                    resourceId: n.resource_id,
                    resourceCode: n.resource_code,
                    resourceName: n.resource_name,
                    kind: n.resource_kind,
                    qty: toNumber(n.qty_per_unit, 6),
                    netQty: toNumber(n.qty_per_unit, 6),
                    wastagePct: toNumber(wastagePctStr, 3),
                    grossQty: toNumber(grossQtyDec, 6),
                    unitId: n.unit_id,
                    unitCode: n.unit_code,
                    rate: toNumber(rateRow.rate, 4),
                    amount: toNumber(amountDec, 4),
                });
            }
        }

        return {
            activityId: activity.id,
            activityCode: activity.code,
            activityName: activity.name,
            outputUnitId: activity.output_unit_id,
            outputUnitCode: activity.output_unit_code,
            date: asOfDate,
            total: toNumber(totalDec, 4),
            complete: !incomplete,
            incomplete,
            lines,
            warnings,
        };
    });
}

export async function expectedUsage(activityId, outputQty, date, externalTrx = null) {
    parseDecimal(outputQty);
    if (cmpDec(outputQty, '0') < 0) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'outputQty must be 0 or greater');
    }
    const asOfDate = toDateStr(date, 'date');

    return withTransaction(externalTrx, async trx => {
        const activity = await trx('cat_activity as a')
            .leftJoin('cat_unit as u', 'u.id', 'a.output_unit_id')
            .where('a.id', activityId)
            .select('a.*', 'u.code as output_unit_code', 'u.name as output_unit_name')
            .first();

        if (!activity) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        }

        const norms = await getNorms(activityId, asOfDate, trx);
        const items = [];

        for (const n of norms) {
            const rawNetQty = mulDec(outputQty, n.qty_per_unit);
            const netQtyBaseStr = await convertExact(rawNetQty, n.unit_id, n.resource_base_unit_id, n.resource_id, trx);

            const wastagePctStr = toFixedStr(n.wastage_pct ?? 0, 3);
            const wastageFactor = addDec('1', divDec(wastagePctStr, '100'));
            const grossQtyBaseStr = mulDec(netQtyBaseStr, wastageFactor);
            const allowanceQtyBaseStr = subDec(grossQtyBaseStr, netQtyBaseStr);

            items.push({
                resourceId: n.resource_id,
                resourceCode: n.resource_code,
                resourceName: n.resource_name,
                kind: n.resource_kind,
                qty: toNumber(grossQtyBaseStr, 6),
                netQty: toNumber(netQtyBaseStr, 6),
                allowanceQty: toNumber(allowanceQtyBaseStr, 6),
                grossQty: toNumber(grossQtyBaseStr, 6),
                wastagePct: toNumber(wastagePctStr, 3),
                unitId: n.resource_base_unit_id,
                unitCode: n.resource_base_unit_code,
                normQtyPerUnit: toNumber(n.qty_per_unit, 6),
                normUnitId: n.unit_id,
                normUnitCode: n.unit_code,
            });
        }

        return {
            activityId: activity.id,
            activityCode: activity.code,
            activityName: activity.name,
            outputQty: toNumber(outputQty, 6),
            outputUnitId: activity.output_unit_id,
            outputUnitCode: activity.output_unit_code,
            date: asOfDate,
            items,
        };
    });
}

// =========================================================================
// 7. Housekeeping: Project Scope Guard, Change Log, Integrity Check
// =========================================================================

export async function assertProjectScoped(entity, id, projectId, externalTrx = null) {
    if (entity !== 'resource' && entity !== 'activity') {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Unsupported entity "${entity}" for assertProjectScoped`);
    }
    if (!projectId) {
        throw new CatalogError(CatalogErrorCodes.CAT_SCOPE_MISMATCH, 'projectId is required');
    }

    const table = entity === 'resource' ? 'cat_resource' : 'cat_activity';
    return withTransaction(externalTrx, async trx => {
        const row = await trx(table).where({ id }).first();
        if (!row) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, `${entity} #${id} not found`);
        }
        if (row.project_id === null || String(row.project_id) !== String(projectId)) {
            throw new CatalogError(
                CatalogErrorCodes.CAT_SCOPE_MISMATCH,
                `${entity} #${id} does not belong to project #${projectId}`
            );
        }
        return row;
    });
}

export async function getChangeLog(entity, id, externalTrx = null) {
    if (!CHANGE_LOG_ENTITIES.includes(entity)) {
        throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, `Invalid change log entity "${entity}"`);
    }

    return withTransaction(externalTrx, async trx => {
        const rows = await trx('cat_change_log')
            .where({ entity, entity_id: id })
            .orderBy('at', 'desc')
            .orderBy('id', 'desc');

        return rows.map(r => {
            let beforeData = r.before_data;
            let afterData = r.after_data;
            if (typeof beforeData === 'string') {
                try { beforeData = JSON.parse(beforeData); } catch (_) {}
            }
            if (typeof afterData === 'string') {
                try { afterData = JSON.parse(afterData); } catch (_) {}
            }
            return { ...r, before_data: beforeData, after_data: afterData };
        });
    });
}

export async function checkIntegrity(scope = {}, externalTrx = null) {
    const orgId = scope && typeof scope === 'object' ? (scope.orgId || null) : null;
    const projectId = scope && typeof scope === 'object'
        ? (scope.projectId !== undefined ? scope.projectId : undefined)
        : (scope || undefined);

    return withTransaction(externalTrx, async trx => {
        const violations = [];

        const orgFilter = (alias) => (orgId ? ` AND ${alias}.org_id = ?` : '');
        const orgParams = orgId ? [orgId] : [];

        // 1. Master resource with a parent
        const [masterResWithParent] = await trx.raw(`
            SELECT r.id, r.code, r.org_id
            FROM cat_resource r
            WHERE r.project_id IS NULL AND r.parent_id IS NOT NULL ${orgFilter('r')}
        `, orgParams);
        for (const v of masterResWithParent) {
            violations.push({
                type: 'MASTER_RESOURCE_HAS_PARENT',
                entity: 'resource',
                id: v.id,
                details: `Master resource "${v.code}" (#${v.id}) has non-null parent_id`,
            });
        }

        // 2. Master activity with a parent
        const [masterActWithParent] = await trx.raw(`
            SELECT a.id, a.code, a.org_id
            FROM cat_activity a
            WHERE a.project_id IS NULL AND a.parent_id IS NOT NULL ${orgFilter('a')}
        `, orgParams);
        for (const v of masterActWithParent) {
            violations.push({
                type: 'MASTER_ACTIVITY_HAS_PARENT',
                entity: 'activity',
                id: v.id,
                details: `Master activity "${v.code}" (#${v.id}) has non-null parent_id`,
            });
        }

        // 3. Project resource copy whose parent is not a master of the same org and kind
        const [badResParent] = await trx.raw(`
            SELECT c.id, c.code, c.org_id, c.kind, p.id as parent_id, p.project_id as parent_project_id, p.org_id as parent_org_id, p.kind as parent_kind
            FROM cat_resource c
            JOIN cat_resource p ON p.id = c.parent_id
            WHERE (p.project_id IS NOT NULL OR p.org_id <> c.org_id OR p.kind <> c.kind) ${orgFilter('c')}
        `, orgParams);
        for (const v of badResParent) {
            violations.push({
                type: 'INVALID_RESOURCE_PARENT',
                entity: 'resource',
                id: v.id,
                details: `Resource "${v.code}" (#${v.id}) parent #${v.parent_id} is invalid (project=${v.parent_project_id}, org=${v.parent_org_id}, kind=${v.parent_kind})`,
            });
        }

        // 4. Project activity copy whose parent is not a master of the same org
        const [badActParent] = await trx.raw(`
            SELECT c.id, c.code, c.org_id, p.id as parent_id, p.project_id as parent_project_id, p.org_id as parent_org_id
            FROM cat_activity c
            JOIN cat_activity p ON p.id = c.parent_id
            WHERE (p.project_id IS NOT NULL OR p.org_id <> c.org_id) ${orgFilter('c')}
        `, orgParams);
        for (const v of badActParent) {
            violations.push({
                type: 'INVALID_ACTIVITY_PARENT',
                entity: 'activity',
                id: v.id,
                details: `Activity "${v.code}" (#${v.id}) parent #${v.parent_id} is invalid (project=${v.parent_project_id}, org=${v.parent_org_id})`,
            });
        }

        // 5. Norm that mixes scopes (or organizations)
        const [mixedScopeNorms] = await trx.raw(`
            SELECT n.id, a.id as activity_id, a.project_id as act_proj, a.org_id as act_org,
                   r.id as resource_id, r.project_id as res_proj, r.org_id as res_org
            FROM cat_activity_norm n
            JOIN cat_activity a ON a.id = n.activity_id
            JOIN cat_resource r ON r.id = n.resource_id
            WHERE (a.org_id <> r.org_id
               OR (NOT (a.project_id IS NULL AND r.project_id IS NULL)
                   AND NOT (a.project_id <=> r.project_id AND a.project_id IS NOT NULL)))
              ${orgFilter('a')}
        `, orgParams);
        for (const v of mixedScopeNorms) {
            violations.push({
                type: 'NORM_SCOPE_MISMATCH',
                entity: 'norm',
                id: v.id,
                details: `Norm #${v.id} mixes scopes: activity #${v.activity_id} (org=${v.act_org}, project=${v.act_proj}) vs resource #${v.resource_id} (org=${v.res_org}, project=${v.res_proj})`,
            });
        }

        // 6. Overlapping rate periods
        const [overlapRates] = await trx.raw(`
            SELECT a.id as rate_a_id, b.id as rate_b_id, a.resource_id
            FROM cat_rate a
            JOIN cat_rate b ON a.resource_id = b.resource_id AND a.id < b.id
            JOIN cat_resource res ON res.id = a.resource_id
            WHERE a.effective_from <= IFNULL(b.effective_to, '9999-12-31')
              AND b.effective_from <= IFNULL(a.effective_to, '9999-12-31')
              ${orgFilter('res')}
        `, orgParams);
        for (const v of overlapRates) {
            violations.push({
                type: 'OVERLAPPING_RATE_PERIODS',
                entity: 'rate',
                id: v.rate_a_id,
                details: `Resource #${v.resource_id} has overlapping rates #${v.rate_a_id} and #${v.rate_b_id}`,
            });
        }

        // 7. Overlapping norm periods
        const [overlapNorms] = await trx.raw(`
            SELECT a.id as norm_a_id, b.id as norm_b_id, a.activity_id, a.resource_id
            FROM cat_activity_norm a
            JOIN cat_activity_norm b ON a.activity_id = b.activity_id AND a.resource_id = b.resource_id AND a.id < b.id
            JOIN cat_activity act ON act.id = a.activity_id
            WHERE a.effective_from <= IFNULL(b.effective_to, '9999-12-31')
              AND b.effective_from <= IFNULL(a.effective_to, '9999-12-31')
              ${orgFilter('act')}
        `, orgParams);
        for (const v of overlapNorms) {
            violations.push({
                type: 'OVERLAPPING_NORM_PERIODS',
                entity: 'norm',
                id: v.norm_a_id,
                details: `Activity #${v.activity_id} / Resource #${v.resource_id} has overlapping norms #${v.norm_a_id} and #${v.norm_b_id}`,
            });
        }

        // 8. Rate unit not usable for its resource
        const [badRateUnits] = await trx.raw(`
            SELECT r.id, r.resource_id, ru.code as rate_unit, ru.category as rate_cat,
                   bu.code as base_unit, bu.category as base_cat
            FROM cat_rate r
            JOIN cat_resource res ON res.id = r.resource_id
            JOIN cat_unit ru ON ru.id = r.unit_id
            JOIN cat_unit bu ON bu.id = res.base_unit_id
            WHERE (((ru.org_id IS NOT NULL AND ru.org_id <> res.org_id)) OR (ru.category <> bu.category
              AND NOT EXISTS (
                  SELECT 1 FROM cat_resource_conversion c
                  JOIN cat_unit f ON f.id = c.from_unit_id
                  JOIN cat_unit t ON t.id = c.to_unit_id
                  WHERE c.resource_id = res.id
                    AND ((f.category = ru.category AND t.category = bu.category)
                      OR (t.category = ru.category AND f.category = bu.category))
              )))
              ${orgFilter('res')}
        `, orgParams);
        for (const v of badRateUnits) {
            violations.push({
                type: 'RATE_UNIT_INCOMPATIBLE',
                entity: 'rate',
                id: v.id,
                details: `Rate #${v.id} on resource #${v.resource_id} uses "${v.rate_unit}" (${v.rate_cat}) incompatible with base "${v.base_unit}" (${v.base_cat})`,
            });
        }

        // 9. Norm unit not usable for its resource
        const [badNormUnits] = await trx.raw(`
            SELECT n.id, n.activity_id, n.resource_id, nu.code as norm_unit, nu.category as norm_cat,
                   bu.code as base_unit, bu.category as base_cat
            FROM cat_activity_norm n
            JOIN cat_resource res ON res.id = n.resource_id
            JOIN cat_unit nu ON nu.id = n.unit_id
            JOIN cat_unit bu ON bu.id = res.base_unit_id
            WHERE (((nu.org_id IS NOT NULL AND nu.org_id <> res.org_id)) OR (nu.category <> bu.category
              AND NOT EXISTS (
                  SELECT 1 FROM cat_resource_conversion c
                  JOIN cat_unit f ON f.id = c.from_unit_id
                  JOIN cat_unit t ON t.id = c.to_unit_id
                  WHERE c.resource_id = res.id
                    AND ((f.category = nu.category AND t.category = bu.category)
                      OR (t.category = nu.category AND f.category = bu.category))
              )))
              ${orgFilter('res')}
        `, orgParams);
        for (const v of badNormUnits) {
            violations.push({
                type: 'NORM_UNIT_INCOMPATIBLE',
                entity: 'norm',
                id: v.id,
                details: `Norm #${v.id} on activity #${v.activity_id} uses "${v.norm_unit}" (${v.norm_cat}) incompatible with resource #${v.resource_id} base "${v.base_unit}" (${v.base_cat})`,
            });
        }

        // 10. System standard units drift / tampering check
        const dbSystemUnits = await trx('cat_unit').whereNull('org_id');
        const dbUnitMap = new Map(dbSystemUnits.map(u => [u.code.toLowerCase(), u]));
        for (const sys of SYSTEM_UNITS) {
            const row = dbUnitMap.get(sys.code.toLowerCase());
            if (!row) {
                violations.push({
                    type: 'SYSTEM_UNIT_MISSING',
                    entity: 'unit',
                    id: null,
                    details: `System standard unit "${sys.code}" (${sys.name}) is missing from database. Call repairSystemUnits() to restore.`,
                });
            } else if (
                toFixedStr(row.to_base_factor, 10) !== sys.to_base_factor ||
                row.category !== sys.category ||
                Number(row.is_base) !== Number(sys.is_base)
            ) {
                violations.push({
                    type: 'SYSTEM_UNIT_TAMPERED',
                    entity: 'unit',
                    id: row.id,
                    details: `System unit "${sys.code}" has tampered DB values: factor=${row.to_base_factor} (expected ${sys.to_base_factor}), category=${row.category} (expected ${sys.category}). Note: Calculation engine remains protected by in-memory code constants. Call repairSystemUnits() to heal DB rows.`,
                });
            }
        }

        // Optional projectId filter when inspecting a specific project scope
        if (projectId !== undefined && projectId !== null) {
            // Keep all violations relevant to org; project-level filtering is handled if needed
            return violations;
        }
        return violations;
    });
}

