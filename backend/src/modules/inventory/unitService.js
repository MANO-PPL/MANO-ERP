import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

/**
 * List all units for an organization, optionally filtered by unit_type.
 * Returns units ordered by type then name for easy dropdown grouping.
 */
export async function getUnits(orgId, unitType = null) {
    const query = db('res_units').where('org_id', orgId).orderBy(['unit_type', 'name']);
    if (unitType) query.where('unit_type', unitType);
    return await query;
}

/**
 * Get a single unit by id and orgId.
 */
export async function getUnitById(orgId, id) {
    const unit = await db('res_units').where({ id, org_id: orgId }).first();
    if (!unit) throw new AppError('Unit not found in your organization', 404);
    return unit;
}

/**
 * Create a new unit for an organization.
 * If base_unit_id is provided, it must exist in the same org and share the same unit_type.
 */
export async function createUnit(orgId, { name, symbol, unit_type, base_unit_id = null, conversion_factor = 1 }) {
    if (!name || !symbol || !unit_type) {
        throw new AppError('name, symbol, and unit_type are required', 400);
    }
    const validTypes = ['weight', 'volume', 'count'];
    if (!validTypes.includes(unit_type)) {
        throw new AppError(`unit_type must be one of: ${validTypes.join(', ')}`, 400);
    }

    if (base_unit_id) {
        const baseUnit = await getUnitById(orgId, base_unit_id);
        if (baseUnit.unit_type !== unit_type) {
            throw new AppError('base_unit must have the same unit_type', 400);
        }
    }

    const [insertId] = await db('res_units').insert({
        org_id: orgId,
        name,
        symbol,
        unit_type,
        base_unit_id: base_unit_id || null,
        conversion_factor
    });
    return insertId;
}

/**
 * Update an existing unit.
 */
export async function updateUnit(orgId, id, { name, symbol, unit_type, base_unit_id, conversion_factor }) {
    await getUnitById(orgId, id); // ensure it exists in org

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (symbol !== undefined) updates.symbol = symbol;
    if (unit_type !== undefined) updates.unit_type = unit_type;
    if (base_unit_id !== undefined) updates.base_unit_id = base_unit_id;
    if (conversion_factor !== undefined) updates.conversion_factor = conversion_factor;

    if (Object.keys(updates).length === 0) return true;

    await db('res_units').where({ id, org_id: orgId }).update(updates);
    return true;
}

/**
 * Delete a unit. Refuses if the unit is referenced by any resource or conversion in the org.
 */
export async function deleteUnit(orgId, id) {
    await getUnitById(orgId, id);

    // Guard: referenced as base_unit in resources
    const usedInResources = await db('res_resources').where('base_unit_id', id).count('id as cnt').first();
    if (parseInt(usedInResources.cnt) > 0) {
        throw new AppError('Cannot delete: unit is used as base unit in one or more resources', 400);
    }

    // Guard: referenced in resource_conversions
    const usedInConversions = await db('res_conversions').where('unit_id', id).count('id as cnt').first();
    if (parseInt(usedInConversions.cnt) > 0) {
        throw new AppError('Cannot delete: unit is referenced in resource conversions', 400);
    }

    // Guard: referenced in resource_compositions
    const usedInCompositions = await db('res_compositions').where('unit_id', id).count('id as cnt').first();
    if (parseInt(usedInCompositions.cnt) > 0) {
        throw new AppError('Cannot delete: unit is referenced in resource compositions', 400);
    }

    await db('res_units').where({ id, org_id: orgId }).del();
    return true;
}

export default { getUnits, getUnitById, createUnit, updateUnit, deleteUnit };


// const t = await getUnits(1, 'weight');
// console.log(t)
