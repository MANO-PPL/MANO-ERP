import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { getUnit, UNIT_REGISTRY } from '../../services/unitRegistry.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureResourceExists(orgId, id) {
    const resource = await db('res_resources').where({ id, org_id: orgId }).first();
    if (!resource) throw new AppError('Resource not found in your organization', 404);
    return resource;
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
        const compositions = await db('res_compositions as c')
            .join('res_resources as r2', 'c.component_resource_id', 'r2.id')
            .where('c.parent_resource_id', id)
            .select(
                'c.id',
                'c.component_resource_id',
                'r2.name as component_name',
                'r2.code as component_code',
                'c.quantity',
                'c.unit_code'
            );

        compositions.forEach(c => {
            const u = UNIT_REGISTRY[c.unit_code];
            c.unit_name = u ? u.name : '';
            c.unit_symbol = u ? u.symbol : '';
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
export async function createResource(orgId, { name, code, type, base_unit_code, description, remarks, compositions = [] }) {
    if (!name || !type || !base_unit_code) {
        throw new AppError('name, type, and base_unit_code are required', 400);
    }
    if (!['material', 'item', 'labour'].includes(type)) {
        throw new AppError('type must be "material", "item", or "labour"', 400);
    }

    // App-level validation for standard units
    try {
        getUnit(base_unit_code);
    } catch (err) {
        throw new AppError(err.message, 400);
    }

    const [insertId] = await db('res_resources').insert({
        org_id: orgId,
        name,
        code: code || null,
        type,
        base_unit_code,
        description: description || null,
        remarks: remarks || null
    });

    // If item, insert compositions
    if (type === 'item' && compositions.length > 0) {
        await _replaceCompositions(orgId, insertId, compositions);
    }

    return insertId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

export async function updateResource(orgId, id, { name, code, base_unit_code, description, remarks }) {
    await ensureResourceExists(orgId, id);

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (base_unit_code !== undefined) {
        try {
            getUnit(base_unit_code);
        } catch (err) {
            throw new AppError(err.message, 400);
        }
        updates.base_unit_code = base_unit_code;
    }
    if (description !== undefined) updates.description = description;
    if (remarks !== undefined) updates.remarks = remarks;

    if (Object.keys(updates).length > 0) {
        await db('res_resources').where({ id, org_id: orgId }).update(updates);
    }
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
    await db('res_resources').where({ id, org_id: orgId }).del();
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compositions (items only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal helper — replaces ALL compositions for a resource.
 */
async function _replaceCompositions(orgId, parentResourceId, compositions) {
    for (const c of compositions) {
        if (!c.component_resource_id || !c.quantity || !c.unit_code) {
            throw new AppError('Each composition row must have component_resource_id, quantity, and unit_code', 400);
        }
        // App-level validation
        let inputUnit;
        try {
            inputUnit = getUnit(c.unit_code);
        } catch (err) {
            throw new AppError(err.message, 400);
        }

        const comp = await db('res_resources').where({ id: c.component_resource_id, org_id: orgId }).first();
        if (!comp) throw new AppError(`Component resource id ${c.component_resource_id} not found in your organization`, 400);
        if (comp.type !== 'material') {
            throw new AppError(`Component resource "${comp.name}" must be of type 'material'`, 400);
        }

        // Validate that the recipe unit matches the child component's unit category
        const compBaseUnit = getUnit(comp.base_unit_code);
        if (inputUnit.type !== compBaseUnit.type) {
            throw new AppError(`Incompatible unit category: Recipe unit "${c.unit_code}" (${inputUnit.type}) must match component base unit "${comp.base_unit_code}" (${compBaseUnit.type})`, 400);
        }
    }

    await db('res_compositions').where('parent_resource_id', parentResourceId).del();

    if (compositions.length > 0) {
        const rows = compositions.map(c => ({
            parent_resource_id: parentResourceId,
            component_resource_id: c.component_resource_id,
            quantity: c.quantity,
            unit_code: c.unit_code
        }));
        await db('res_compositions').insert(rows);
    }
}

/**
 * Public API to replace all compositions for an item resource.
 */
export async function setCompositions(orgId, resourceId, compositions) {
    const resource = await ensureResourceExists(orgId, resourceId);
    if (resource.type !== 'item') {
        throw new AppError('Compositions can only be set for resources of type "item"', 400);
    }
    await _replaceCompositions(orgId, resourceId, compositions);
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
                    for (const comp of compositions) {
                        const { component_resource_id, quantity: compQty, unit_code: compUnitCode } = comp;
                        if (!component_resource_id || !compQty || !compUnitCode) {
                            throw new Error('Each composition must have component_resource_id, quantity, and unit_code');
                        }

                        const compUnit = getUnit(compUnitCode);

                        // Fetch component
                        const component = await trx('res_resources').where({ id: component_resource_id, org_id: orgId }).first();
                        if (!component) {
                            throw new Error(`Component resource id ${component_resource_id} not found in this organization`);
                        }
                        if (component.type !== 'material' && component.type !== 'labour') {
                            throw new Error(`Component resource "${component.name}" must be of type 'material' or 'labour'`);
                        }

                        const compBaseUnit = getUnit(component.base_unit_code);
                        if (compUnit.type !== compBaseUnit.type) {
                            throw new Error(`Incompatible unit category: Recipe unit "${compUnitCode}" (${compUnit.type}) must match component base unit "${component.base_unit_code}" (${compBaseUnit.type})`);
                        }

                        await trx('res_compositions').insert({
                            parent_resource_id: insertId,
                            component_resource_id,
                            quantity: compQty,
                            unit_code: compUnitCode
                        });
                    }
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

export default {
    getResources,
    getResourceById,
    createResource,
    updateResource,
    deleteResource,
    setCompositions,
    addConversion,
    removeConversion,
    bulkInsertResources
};
