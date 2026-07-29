import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { getUnit, convert, UNIT_REGISTRY } from '../../services/unitRegistry.js';
import { detectCycle } from '../../services/compositionResolver.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureResourceExists(orgId, id) {
    const resource = await db('res_resources').where({ id, org_id: orgId }).first();
    if (!resource) throw new AppError('Resource not found in your organization', 404);
    return resource;
}

const toIsoDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

// ─────────────────────────────────────────────────────────────────────────────
// Rates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a date/date-like value to the DATE format used by res_rates.
 * Keeping this in one place prevents timezone offsets from changing the
 * effective day when a caller passes a JavaScript Date.
 */
function toDateOnly(value, fallback = new Date()) {
    if (value === undefined || value === null || value === '') {
        value = fallback;
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new AppError('Invalid rate date. Use YYYY-MM-DD.', 400);
    }

    return parsed.toISOString().slice(0, 10);
}

/**
 * Find the manual rate row effective on a particular date.
 * res_rates is organization-neutral in the current schema, so ownership is
 * enforced by joining through res_resources.
 */
async function findEffectiveManualRate(orgId, resourceId, asOfDate, dbClient = db) {
    return dbClient('res_rates as rr')
        .join('res_resources as r', 'rr.resource_id', 'r.id')
        .where('rr.resource_id', resourceId)
        .andWhere('r.org_id', orgId)
        .andWhere('rr.is_active', 1)
        .whereNotNull('rr.rate')   // ← this line replaces the source filter
        .andWhere('rr.effective_from', '<=', asOfDate)
        .andWhere(function () {
            this.whereNull('rr.effective_to').orWhere('rr.effective_to', '>=', asOfDate);
        })
        .select('rr.id', 'rr.resource_id', 'rr.rate', 'rr.unit_code', 'rr.effective_from', 'rr.effective_to', 'rr.is_active', 'rr.remarks')
        .orderBy('rr.effective_from', 'desc')
        .orderBy('rr.id', 'desc')
        .first();
}

function subtractOneDay(dateOnly) {
    const date = new Date(`${dateOnly}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

/**
 * Resolve a resource's rate using the Resource domain rule:
 *
 *   - an effective res_rates row is a manual rate;
 *   - an item without such a row is computed from its composition;
 *   - a base resource without a row has no rate and cannot be computed.
 *
 * The path set prevents recursive composition data from causing an endless
 * rate calculation. The returned unit is always the resource's base unit for
 * computed items, and the stored rate unit for manual rates.
 */
async function resolveRateInternal(orgId, resourceId, asOfDate, dbClient, path = new Set()) {
    const resource = await dbClient('res_resources')
        .where({ id: resourceId, org_id: orgId })
        .first();

    if (!resource) {
        throw new AppError('Resource not found in your organization', 404);
    }

    if (path.has(Number(resourceId))) {
        const chain = [...path, Number(resourceId)].join(' -> ');
        throw new AppError(`Circular composition detected while resolving rate: ${chain}`, 400);
    }

    const manualRate = await findEffectiveManualRate(orgId, resourceId, asOfDate, dbClient);
    if (manualRate) {
        const storedRate = Number(manualRate.rate);
        if (!Number.isFinite(storedRate)) {
            throw new AppError(`Manual rate for resource "${resource.name}" is invalid`, 500);
        }

        const rateUnit = getUnit(manualRate.unit_code);
        const resourceUnit = getUnit(resource.base_unit_code);
        if (rateUnit.type !== resourceUnit.type) {
            throw new AppError(
                `Manual rate unit "${manualRate.unit_code}" is incompatible with resource base unit "${resource.base_unit_code}"`,
                400
            );
        }

        return {
            resourceId: resource.id,
            resourceName: resource.name,
            rate: storedRate,
            unitCode: manualRate.unit_code,
            source: 'manual',
            rateId: manualRate.id,
            effectiveFrom: toIsoDate(manualRate.effective_from),
            effectiveTo: toIsoDate(manualRate.effective_to),
            isActive: Number(manualRate.is_active) === 1,
            remarks: manualRate.remarks || null
        };
    }

    if (resource.type !== 'item') {
        throw new AppError(
            `No effective manual rate is configured for resource "${resource.name}"`,
            404
        );
    }

    const compositions = await dbClient('res_compositions as c')
        .join('res_resources as component', 'c.component_resource_id', 'component.id')
        .where('c.parent_resource_id', resource.id)
        .andWhere('c.effective_from', '<=', asOfDate)
        .andWhere(function () {
            this.whereNull('c.effective_to').orWhere('c.effective_to', '>=', asOfDate);
        })
        .andWhere('component.org_id', orgId)
        .select(
            'c.component_resource_id',
            'c.quantity',
            'c.unit_code',
            'c.effective_from',
            'c.effective_to',
            'component.name as component_name'
        );

    if (compositions.length === 0) {
        throw new AppError(
            `Item "${resource.name}" has no composition and no manual rate`,
            404
        );
    }

    const nextPath = new Set(path);
    nextPath.add(Number(resourceId));
    let total = 0;
    const breakdown = [];

    for (const composition of compositions) {
        const quantity = Number(composition.quantity);
        if (!Number.isFinite(quantity) || quantity < 0) {
            throw new AppError(
                `Invalid composition quantity for component "${composition.component_name}"`,
                400
            );
        }

        const componentRate = await resolveRateInternal(
            orgId,
            composition.component_resource_id,
            asOfDate,
            dbClient,
            nextPath
        );

        let quantityInRateUnit;
        try {
            quantityInRateUnit = convert(
                composition.unit_code,
                componentRate.unitCode,
                quantity
            );
        } catch (err) {
            throw new AppError(
                `Cannot convert composition quantity for component "${composition.component_name}": ${err.message}`,
                400
            );
        }

        const componentCost = quantityInRateUnit * componentRate.rate;
        total += componentCost;
        breakdown.push({
            resourceId: componentRate.resourceId,
            resourceName: componentRate.resourceName,
            quantity,
            quantityUnitCode: composition.unit_code,
            rate: componentRate.rate,
            rateUnitCode: componentRate.unitCode,
            cost: componentCost,
            source: componentRate.source
        });
    }

    return {
        resourceId: resource.id,
        resourceName: resource.name,
        rate: total,
        unitCode: resource.base_unit_code,
        source: 'computed',
        asOfDate,
        effectiveFrom: toIsoDate(compositions[0].effective_from),
        effectiveTo: toIsoDate(compositions[0].effective_to),
        breakdown
    };
}

/**
 * Public rate entry point. All callers should use this method rather than
 * joining res_rates or calculating composition costs themselves.
 */
export async function getResolvedRate(orgId, resourceId, asOfDate) {
    const effectiveDate = toDateOnly(asOfDate);
    return resolveRateInternal(orgId, resourceId, effectiveDate, db);
}

/**
 * Create a manual rate row. The presence of this row is what makes the rate
 * manual; no rate_type column is required for the current business rule.
 */
export async function addRate(orgId, resourceId, { rate, unit_code, effective_from, remarks }) {
    const resource = await ensureResourceExists(orgId, resourceId);
    const numericRate = Number(rate);
    if (rate === undefined || rate === null || rate === '' || !Number.isFinite(numericRate) || numericRate < 0) {
        throw new AppError('rate must be a non-negative number', 400);
    }
    if (!unit_code) throw new AppError('unit_code is required for a rate', 400);

    let rateUnit;
    try {
        rateUnit = getUnit(unit_code);
    } catch (err) {
        throw new AppError(err.message, 400);
    }
    const resourceUnit = getUnit(resource.base_unit_code);
    if (rateUnit.type !== resourceUnit.type) {
        throw new AppError(
            `Rate unit "${unit_code}" must match resource base unit category "${resource.base_unit_code}"`,
            400
        );
    }

    const effectiveFrom = toDateOnly(effective_from);

    return db.transaction(async (trx) => {
        // The active flag tracks the latest edit, while effective dates still
        // determine which historical row applies to a requested date.
        const activeRate = await trx('res_rates')
            .where({ resource_id: resourceId, is_active: 1 })
            .orderBy('id', 'desc')
            .forUpdate()
            .first('id', 'effective_from', 'effective_to');

        if (activeRate) {
            const activeFrom = toDateOnly(activeRate.effective_from);
            if (effectiveFrom < activeFrom) {
                throw new AppError(
                    `New rate effective_from ${effectiveFrom} cannot be earlier than the active rate ${activeFrom}`,
                    400
                );
            }

            await trx('res_rates').where({ id: activeRate.id }).update({
                is_active: 0,
                // A same-day edit replaces the rate for that day. For a later
                // edit, close the previous version the day before the new one.
                effective_to: effectiveFrom === activeFrom
                    ? effectiveFrom
                    : subtractOneDay(effectiveFrom)
            });
        }

        const [insertId] = await trx('res_rates').insert({
            resource_id: resourceId,
            rate: numericRate,
            unit_code,
            effective_from: effectiveFrom,
            effective_to: null,
            is_active: 1,
            remarks: remarks || null
        });
        return insertId;
    });
}

/**
 * Return all manual rate versions for a resource, newest first.
 */
export async function getRateHistory(orgId, resourceId) {
    await ensureResourceExists(orgId, resourceId);
    const rows = await db('res_rates as rr')
        .join('res_resources as r', 'rr.resource_id', 'r.id')
        .where('rr.resource_id', resourceId)
        .andWhere('r.org_id', orgId)
        .select(
            'rr.id', 'rr.resource_id', 'rr.rate', 'rr.unit_code',
            'rr.effective_from', 'rr.effective_to', 'rr.is_active',
            'rr.remarks', 'rr.created_at', 'rr.updated_at'
        )
        .orderBy('rr.effective_from', 'desc')
        .orderBy('rr.id', 'desc');

    return rows.map(r => ({
        ...r,
        effective_from: toIsoDate(r.effective_from),
        effective_to: toIsoDate(r.effective_to)
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List resources with optional filters.
 * @param {number} orgId
 * @param {object} filters  { type:'material'|'item', search:'...', limit, offset }
 */
export async function getResources(orgId, { type, search, limit = 100, offset = 0 } = {}) {
    const query = db('res_resources')
        .where('org_id', orgId)
        .select('id', 'name', 'code', 'type', 'description', 'remarks', 'base_unit_code')
        .orderBy('name');

    if (type) query.where('type', type);
    if (search) query.where('name', 'like', `%${search}%`);

    query.limit(limit).offset(offset);
    const resources = await query;

    // Enrich with standard base unit name/symbol in-memory from UNIT_REGISTRY
    resources.forEach(r => {
        const u = UNIT_REGISTRY[r.base_unit_code];
        r.base_unit_name = u ? u.name : '';
        r.base_unit_symbol = u ? u.symbol : '';
    });

    return resources;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get single resource with full detail
// ─────────────────────────────────────────────────────────────────────────────

export async function getResourceById(orgId, id) {
    const resource = await db('res_resources')
        .where({ id, org_id: orgId })
        .select('id', 'name', 'code', 'type', 'description', 'remarks', 'base_unit_code')
        .first();

    if (!resource) throw new AppError('Resource not found in your organization', 404);

    // Enrich base unit details
    const baseUnit = UNIT_REGISTRY[resource.base_unit_code];
    resource.base_unit_name = baseUnit ? baseUnit.name : '';
    resource.base_unit_symbol = baseUnit ? baseUnit.symbol : '';

    // Fetch unit conversions
    const conversions = await db('res_conversions')
        .where({ resource_id: id, org_id: orgId })
        .select('id', 'name', 'quantity', 'unit_code');

    conversions.forEach(c => {
        const u = UNIT_REGISTRY[c.unit_code];
        c.unit_name = u ? u.name : '';
        c.unit_symbol = u ? u.symbol : '';
    });
    resource.conversions = conversions;

    // Fetch compositions (only meaningful for items)
    if (resource.type === 'item') {
        const compositionDate = toDateOnly();
        const compositions = await db('res_compositions as c')
            .join('res_resources as r2', 'c.component_resource_id', 'r2.id')
            .where('c.parent_resource_id', id)
            .andWhere('r2.org_id', orgId)
            .andWhere('c.effective_from', '<=', compositionDate)
            .andWhere(function () {
                this.whereNull('c.effective_to').orWhere('c.effective_to', '>=', compositionDate);
            })
            .select(
                'c.id',
                'c.component_resource_id',
                'r2.name as component_name',
                'r2.code as component_code',
                'c.quantity',
                'c.unit_code',
                'c.effective_from',
                'c.effective_to'
            );

        compositions.forEach(c => {
            const u = UNIT_REGISTRY[c.unit_code];
            c.unit_name = u ? u.name : '';
            c.unit_symbol = u ? u.symbol : '';
            c.effective_from = toIsoDate(c.effective_from);
            c.effective_to = toIsoDate(c.effective_to);
        });
        resource.compositions = compositions;
    } else {
        resource.compositions = [];
    }

    return resource;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a resource.
 * For items, optionally pass compositions: [{ component_resource_id, quantity, unit_code }]
 */
async function _replaceConversions(orgId, resourceId, conversions, baseUnit, dbClient = db) {
    for (const conv of conversions) {
        if (!conv.name || !conv.quantity || !conv.unit_code) {
            throw new AppError('Each conversion must have name, quantity, and unit_code', 400);
        }
        
        let targetUnit;
        try {
            targetUnit = getUnit(conv.unit_code);
        } catch (err) {
            throw new AppError(err.message, 400);
        }

        if (targetUnit.type !== baseUnit.type) {
            throw new AppError(`Incompatible unit category: Conversion target unit "${conv.unit_code}" (${targetUnit.type}) must match resource base unit "${baseUnit.symbol}" (${baseUnit.type})`, 400);
        }
    }

    await dbClient('res_conversions').where('resource_id', resourceId).del();

    if (conversions.length > 0) {
        const rows = conversions.map(conv => ({
            org_id: orgId,
            resource_id: resourceId,
            name: conv.name,
            quantity: conv.quantity,
            unit_code: conv.unit_code
        }));
        await dbClient('res_conversions').insert(rows);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a resource.
 * For items, optionally pass compositions: [{ component_resource_id, quantity, unit_code }]
 */
export async function createResource(orgId, { name, code, type, base_unit_code, description, remarks, compositions = [], conversions = [] }) {
    if (!name || !type || !base_unit_code) {
        throw new AppError('name, type, and base_unit_code are required', 400);
    }
    if (!['material', 'item', 'labour'].includes(type)) {
        throw new AppError('type must be "material", "item", or "labour"', 400);
    }

    // App-level validation for standard units
    let unit;
    try {
        unit = getUnit(base_unit_code);
    } catch (err) {
        throw new AppError(err.message, 400);
    }

    const insertId = await db.transaction(async (trx) => {
        const [id] = await trx('res_resources').insert({
            org_id: orgId,
            name,
            code: code || null,
            type,
            base_unit_code,
            description: description || null,
            remarks: remarks || null
        });

        // Insert conversions
        if (conversions.length > 0) {
            await _replaceConversions(orgId, id, conversions, unit, trx);
        }

        // If item, insert compositions
        if (type === 'item' && compositions.length > 0) {
            await _replaceCompositions(orgId, id, compositions, trx);
        }

        return id;
    });

    return insertId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

export async function updateResource(orgId, id, { name, code, type, base_unit_code, description, remarks, compositions, conversions }) {
    const resource = await ensureResourceExists(orgId, id);

    await db.transaction(async (trx) => {
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (code !== undefined) updates.code = code;
        
        let activeType = resource.type;
        if (type !== undefined && type !== resource.type) {
            if (!['material', 'item', 'labour'].includes(type)) {
                throw new AppError('type must be "material", "item", or "labour"', 400);
            }
            if (type === 'item') {
                const usedAsComponent = await trx('res_compositions')
                    .where('component_resource_id', id)
                    .count('id as cnt').first();
                if (parseInt(usedAsComponent.cnt) > 0) {
                    throw new AppError('Cannot change type to "item": resource is used as a component in other composite item recipes', 400);
                }
            }
            if (resource.type === 'item') {
                await trx('res_compositions').where('parent_resource_id', id).del();
            }
            updates.type = type;
            activeType = type;
        }

        let activeBaseUnitCode = resource.base_unit_code;
        if (base_unit_code !== undefined) {
            try {
                getUnit(base_unit_code);
            } catch (err) {
                throw new AppError(err.message, 400);
            }
            updates.base_unit_code = base_unit_code;
            activeBaseUnitCode = base_unit_code;
        }
        if (description !== undefined) updates.description = description;
        if (remarks !== undefined) updates.remarks = remarks;

        if (Object.keys(updates).length > 0) {
            await trx('res_resources').where({ id, org_id: orgId }).update(updates);
        }

        const baseUnit = getUnit(activeBaseUnitCode);

        // Replace conversions if provided
        if (conversions !== undefined) {
            await _replaceConversions(orgId, id, conversions, baseUnit, trx);
        }

        // Replace compositions if provided (items only)
        if (compositions !== undefined && activeType === 'item') {
            await _replaceCompositions(orgId, id, compositions, trx);
        }
    });

    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteResource(orgId, id) {
    await ensureResourceExists(orgId, id);

    // Guard: referenced as a component in any composition
    const usedAsComponent = await db('res_compositions')
        .where('component_resource_id', id)
        .count('id as cnt').first();
    if (parseInt(usedAsComponent.cnt) > 0) {
        throw new AppError('Cannot delete: resource is used as a component in item compositions', 400);
    }

    // Cascade compositions and conversions manually
    await db('res_compositions').where('parent_resource_id', id).del();
    await db('res_conversions').where('resource_id', id).del();
    // Rates reference the resource as well; remove them before deleting the
    // parent row when the database FK is not configured with ON DELETE CASCADE.
    await db('res_rates').where('resource_id', id).del();
    await db('res_resources').where({ id, org_id: orgId }).del();
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compositions (items only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal helper — writes one effective-dated composition version for a
 * resource. Older versions remain available for historical reads.
 */
async function _replaceCompositions(orgId, parentResourceId, compositions, dbClient = db, requestedEffectiveFrom) {
    const defaultEffectiveFrom = toDateOnly(requestedEffectiveFrom);
    const rowDates = compositions
        .map(c => c.effective_from)
        .filter(Boolean)
        .map(date => toDateOnly(date));
    const effectiveFrom = rowDates[0] || defaultEffectiveFrom;

    if (rowDates.some(date => date !== effectiveFrom)) {
        throw new AppError('All composition rows in one version must use the same effective_from date', 400);
    }

    // Versions are append-only. Re-submitting the same effective date is
    // treated as replacing that date's draft/version; going backwards would
    // rewrite history and make historical costing ambiguous.
    const latestVersion = await dbClient('res_compositions')
        .where('parent_resource_id', parentResourceId)
        .max('effective_from as latest_effective_from')
        .first();
    if (latestVersion?.latest_effective_from) {
        const latestDate = toDateOnly(latestVersion.latest_effective_from);
        if (effectiveFrom < latestDate) {
            throw new AppError(
                `Composition effective_from ${effectiveFrom} cannot be earlier than the latest version ${latestDate}`,
                400
            );
        }
    }

    const componentIds = new Set();
    for (const c of compositions) {
        if (!c.component_resource_id || !c.quantity || !c.unit_code) {
            throw new AppError('Each composition row must have component_resource_id, quantity, and unit_code', 400);
        }
        if (componentIds.has(Number(c.component_resource_id))) {
            throw new AppError(
                `Component resource id ${c.component_resource_id} appears more than once in the same composition version`,
                400
            );
        }
        componentIds.add(Number(c.component_resource_id));
        // App-level validation
        let inputUnit;
        try {
            inputUnit = getUnit(c.unit_code);
        } catch (err) {
            throw new AppError(err.message, 400);
        }

        const comp = await dbClient('res_resources').where({ id: c.component_resource_id, org_id: orgId }).first();
        if (!comp) throw new AppError(`Component resource id ${c.component_resource_id} not found in your organization`, 400);
        if (comp.type !== 'material' && comp.type !== 'labour') {
            throw new AppError(`Component resource "${comp.name}" must be of type 'material' or 'labour'`, 400);
        }

        // Validate that the recipe unit matches the child component's unit category
        const compBaseUnit = getUnit(comp.base_unit_code);
        if (inputUnit.type !== compBaseUnit.type) {
            throw new AppError(`Incompatible unit category: Recipe unit "${c.unit_code}" (${inputUnit.type}) must match component base unit "${comp.base_unit_code}" (${compBaseUnit.type})`, 400);
        }

        // This check runs before any delete/insert and uses the same
        // transaction client as the eventual write.
        if (await detectCycle(parentResourceId, c.component_resource_id, dbClient, effectiveFrom)) {
            throw new AppError(
                `Composition would create a circular reference: ${parentResourceId} -> ${c.component_resource_id}`,
                400
            );
        }
    }

    // Close the currently active version before inserting the replacement.
    // An empty composition therefore represents an intentional clear rather
    // than falling back to an older version.
    await dbClient('res_compositions')
        .where('parent_resource_id', parentResourceId)
        .andWhere('effective_from', '<', effectiveFrom)
        .andWhere(function () {
            this.whereNull('effective_to').orWhere('effective_to', '>=', effectiveFrom);
        })
        .update({ effective_to: subtractOneDay(effectiveFrom), 
        is_active: 0
        });

    // Retrying the same version date is idempotent and is safe under the
    // unique index below.
    await dbClient('res_compositions')
        .where('parent_resource_id', parentResourceId)
        .andWhere('effective_from', effectiveFrom)
        .del();

    if (compositions.length > 0) {
        const rows = compositions.map(c => ({
            parent_resource_id: parentResourceId,
            component_resource_id: c.component_resource_id,
            quantity: c.quantity,
            unit_code: c.unit_code,
            effective_from: effectiveFrom,
            effective_to: null,
            is_active: 1
        }));
        await dbClient('res_compositions').insert(rows);
        
    }
}

/**
 * Public API to replace all compositions for an item resource.
 */
export async function setCompositions(orgId, resourceId, compositions, effectiveFrom) {
    const resource = await ensureResourceExists(orgId, resourceId);
    if (resource.type !== 'item') {
        throw new AppError('Compositions can only be set for resources of type "item"', 400);
    }
    await db.transaction(async (trx) => {
        await _replaceCompositions(orgId, resourceId, compositions, trx, effectiveFrom);
    });
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit Conversions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a named unit conversion to a resource (e.g. 1 Bag = 50 kg).
 */
export async function addConversion(orgId, resourceId, { name, quantity, unit_code }) {
    const resource = await ensureResourceExists(orgId, resourceId);
    if (!name || !quantity || !unit_code) {
        throw new AppError('name, quantity, and unit_code are required for a conversion', 400);
    }
    // App-level validation
    let targetUnit;
    try {
        targetUnit = getUnit(unit_code);
    } catch (err) {
        throw new AppError(err.message, 400);
    }

    // Validate that the conversion target matches the resource's base unit category
    const resourceBaseUnit = getUnit(resource.base_unit_code);
    if (targetUnit.type !== resourceBaseUnit.type) {
        throw new AppError(`Incompatible unit category: Conversion target unit "${unit_code}" (${targetUnit.type}) must match resource base unit "${resource.base_unit_code}" (${resourceBaseUnit.type})`, 400);
    }

    const [insertId] = await db('res_conversions').insert({
        org_id: orgId,
        resource_id: resourceId,
        name,
        quantity,
        unit_code
    });
    return insertId;
}

/**
 * Remove a specific conversion by its own id.
 * Verifies that the conversion actually belongs to a resource in the user's org.
 */
export async function removeConversion(orgId, conversionId) {
    const conversion = await db('res_conversions as rc')
        .join('res_resources as r', 'rc.resource_id', 'r.id')
        .where('rc.id', conversionId)
        .andWhere('r.org_id', orgId)
        .select('rc.id')
        .first();

    if (!conversion) throw new AppError('Conversion not found in your organization', 404);

    await db('res_conversions').where({ id: conversionId }).del();
    return true;
}

export async function bulkInsertResources(orgId, resources) {
    if (!Array.isArray(resources)) {
        throw new AppError('Input must be an array of resources', 400);
    }

    const report = {
        successCount: 0,
        insertedIds: [],
        errors: []
    };

    // Run in transaction to guarantee consistency
    await db.transaction(async (trx) => {
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            const { name, code, type, base_unit_code, description, remarks, compositions, conversions } = res;

            try {
                if (!name || !type || !base_unit_code) {
                    throw new Error('name, type, and base_unit_code are required');
                }
                if (!['material', 'item', 'labour'].includes(type)) {
                    throw new Error('type must be "material", "item", or "labour"');
                }

                // App-level validation
                const unit = getUnit(base_unit_code);

                // Insert resource
                const [insertId] = await trx('res_resources').insert({
                    org_id: orgId,
                    name,
                    code: code || null,
                    type,
                    base_unit_code,
                    description: description || null,
                    remarks: remarks || null
                });

                // Handle custom conversions if provided
                if (Array.isArray(conversions) && conversions.length > 0) {
                    for (const conv of conversions) {
                        const { name: convName, quantity: convQty, unit_code: convUnitCode } = conv;
                        if (!convName || !convQty || !convUnitCode) {
                            throw new Error('Each conversion must have name, quantity, and unit_code');
                        }
                        
                        const convUnit = getUnit(convUnitCode);
                        if (convUnit.type !== unit.type) {
                            throw new Error(`Incompatible unit category: Conversion target unit "${convUnitCode}" (${convUnit.type}) must match resource base unit "${base_unit_code}" (${unit.type})`);
                        }

                        await trx('res_conversions').insert({
                            org_id: orgId,
                            resource_id: insertId,
                            name: convName,
                            quantity: convQty,
                            unit_code: convUnitCode
                        });
                    }
                }

                // Handle compositions if provided (items only)
                if (type === 'item' && Array.isArray(compositions) && compositions.length > 0) {
                    // All composition writes go through the same validator as
                    // normal create/update requests. This includes the
                    // transaction-scoped cycle check and effective-date logic.
                    await _replaceCompositions(orgId, insertId, compositions, trx);
                }

                report.successCount++;
                report.insertedIds.push(insertId);

            } catch (err) {
                // Report the error details
                report.errors.push({
                    index: i,
                    name: name || 'Unknown',
                    error: err.message
                });
                // Throw to trigger rollback
                throw err;
            }
        }
    }).catch(err => {
        console.warn("Bulk import transaction rolled back due to error:", err.message);
    });

    return report;
}

export async function bulkUpdateResources(orgId, resources) {
    if (!Array.isArray(resources)) {
        throw new AppError('Input must be an array of resources', 400);
    }

    const report = {
        successCount: 0,
        updatedIds: [],
        errors: []
    };

    await db.transaction(async (trx) => {
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            const { id, name, code, type, base_unit_code, description, remarks } = res;

            try {
                if (!id) {
                    throw new Error('Resource ID is required for update');
                }

                const existing = await trx('res_resources').where({ id, org_id: orgId }).first();
                if (!existing) {
                    throw new Error(`Resource with ID ${id} not found in this organization`);
                }

                const updates = {};
                if (name !== undefined) updates.name = name;
                if (code !== undefined) updates.code = code || null;
                
                let activeType = existing.type;
                if (type !== undefined && type !== existing.type) {
                    if (!['material', 'item', 'labour'].includes(type)) {
                        throw new Error('type must be "material", "item", or "labour"');
                    }
                    if (type === 'item') {
                        const usedAsComponent = await trx('res_compositions')
                            .where('component_resource_id', id)
                            .count('id as cnt').first();
                        if (parseInt(usedAsComponent.cnt) > 0) {
                            throw new Error('Cannot change type to "item": resource is used as a component in other composite item recipes');
                        }
                    }
                    if (existing.type === 'item') {
                        await trx('res_compositions').where('parent_resource_id', id).del();
                    }
                    updates.type = type;
                    activeType = type;
                }

                let activeBaseUnitCode = existing.base_unit_code;
                if (base_unit_code !== undefined) {
                    try {
                        getUnit(base_unit_code);
                    } catch (err) {
                        throw new Error(err.message);
                    }
                    updates.base_unit_code = base_unit_code;
                    activeBaseUnitCode = base_unit_code;
                }
                if (description !== undefined) updates.description = description || null;
                if (remarks !== undefined) updates.remarks = remarks || null;

                if (Object.keys(updates).length > 0) {
                    await trx('res_resources').where({ id, org_id: orgId }).update(updates);
                }

                report.successCount++;
                report.updatedIds.push(id);

            } catch (err) {
                report.errors.push({
                    index: i,
                    id: id || 'Unknown',
                    name: name || 'Unknown',
                    error: err.message
                });
                throw err;
            }
        }
    }).catch(err => {
        console.warn("Bulk update transaction rolled back due to error:", err.message);
    });

    return report;
}

/**
 * Reverts an item back to a computed rate by closing its active manual
 * rate as of a given date, without inserting a replacement row.
 * Only valid for resources of type "item" — materials/labour have no
 * fallback pricing source, so they cannot be cleared.
 */
export async function clearManualRate(orgId, resourceId, effectiveFrom) {
    const resource = await ensureResourceExists(orgId, resourceId);
    if (resource.type !== 'item') {
        throw new AppError('Only items can revert to a computed rate; materials and labour require a manual rate', 400);
    }

    const clearFrom = toDateOnly(effectiveFrom);

    return db.transaction(async (trx) => {
        const activeRate = await trx('res_rates')
            .where({ resource_id: resourceId, is_active: 1 })
            .whereNotNull('rate')
            .orderBy('id', 'desc')
            .forUpdate()
            .first('id', 'effective_from');

        if (!activeRate) {
            throw new AppError('This item has no active manual rate to clear', 400);
        }

        const activeFrom = toDateOnly(activeRate.effective_from);
        if (clearFrom < activeFrom) {
            throw new AppError(`Cannot clear a rate effective before its own start date ${activeFrom}`, 400);
        }

        await trx('res_rates').where({ id: activeRate.id }).update({
            is_active: 0,
            effective_to: clearFrom === activeFrom ? clearFrom : subtractOneDay(clearFrom)
        });

        // rate stays NULL — this row just marks "computed from here."
        // The actual number is always calculated live by the resolver.
        await trx('res_rates').insert({
            resource_id: resourceId,
            rate: null,
            unit_code: resource.base_unit_code,
            effective_from: clearFrom,
            effective_to: null,
            is_active: 1,
            remarks: 'Reverted to computed rate'
        });

        return true;
    });
}


export default {
    getResources,
    getResourceById,
    getResolvedRate,
    addRate,
    getRateHistory,
    createResource,
    updateResource,
    deleteResource,
    setCompositions,
    addConversion,
    removeConversion,
    bulkInsertResources,
    bulkUpdateResources,
    clearManualRate
};
