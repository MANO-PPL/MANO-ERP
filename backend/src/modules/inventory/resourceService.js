import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

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
    const query = db('res_resources as r')
        .leftJoin('res_units as u', 'r.base_unit_id', 'u.id')
        .where('r.org_id', orgId)
        .select(
            'r.id',
            'r.name',
            'r.code',
            'r.type',
            'r.description',
            'r.remarks',
            'r.base_unit_id',
            'u.name as base_unit_name',
            'u.symbol as base_unit_symbol'
        )
        .orderBy('r.name');

    if (type) query.where('r.type', type);
    if (search) query.where('r.name', 'like', `%${search}%`);

    query.limit(limit).offset(offset);
    return await query;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get single resource with full detail
// ─────────────────────────────────────────────────────────────────────────────

export async function getResourceById(orgId, id) {
    const resource = await db('res_resources as r')
        .leftJoin('res_units as u', 'r.base_unit_id', 'u.id')
        .where('r.id', id)
        .andWhere('r.org_id', orgId)
        .select(
            'r.id', 'r.name', 'r.code', 'r.type', 'r.description', 'r.remarks',
            'r.base_unit_id',
            'u.name as base_unit_name',
            'u.symbol as base_unit_symbol'
        )
        .first();

    if (!resource) throw new AppError('Resource not found in your organization', 404);

    // Fetch unit conversions
    resource.conversions = await db('res_conversions as rc')
        .leftJoin('res_units as u', 'rc.unit_id', 'u.id')
        .where('rc.resource_id', id)
        .andWhere('rc.org_id', orgId)
        .select('rc.id', 'rc.name', 'rc.quantity', 'rc.unit_id', 'u.name as unit_name', 'u.symbol as unit_symbol');

    // Fetch compositions (only meaningful for items)
    if (resource.type === 'item') {
        resource.compositions = await db('res_compositions as c')
            .join('res_resources as r2', 'c.component_resource_id', 'r2.id')
            .leftJoin('res_units as u', 'c.unit_id', 'u.id')
            .where('c.parent_resource_id', id)
            .select(
                'c.id',
                'c.component_resource_id',
                'r2.name as component_name',
                'r2.code as component_code',
                'c.quantity',
                'c.unit_id',
                'u.name as unit_name',
                'u.symbol as unit_symbol'
            );
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
 * For items, optionally pass compositions: [{ component_resource_id, quantity, unit_id }]
 */
export async function createResource(orgId, { name, code, type, base_unit_id, description, remarks, compositions = [] }) {
    if (!name || !type || !base_unit_id) {
        throw new AppError('name, type, and base_unit_id are required', 400);
    }
    if (!['material', 'item'].includes(type)) {
        throw new AppError('type must be "material" or "item"', 400);
    }

    // Validate base unit exists in org
    const unit = await db('res_units').where({ id: base_unit_id, org_id: orgId }).first();
    if (!unit) throw new AppError('base_unit_id does not exist in your organization', 400);

    const [insertId] = await db('res_resources').insert({
        org_id: orgId,
        name, code: code || null, type,
        base_unit_id,
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

export async function updateResource(orgId, id, { name, code, base_unit_id, description, remarks }) {
    await ensureResourceExists(orgId, id);

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (base_unit_id !== undefined) updates.base_unit_id = base_unit_id;
    if (description !== undefined) updates.description = description;
    if (remarks !== undefined) updates.remarks = remarks;

    if (Object.keys(updates).length > 0) {
        // Validate unit if changed
        if (updates.base_unit_id) {
            const unit = await db('res_units').where({ id: updates.base_unit_id, org_id: orgId }).first();
            if (!unit) throw new AppError('base_unit_id does not exist in your organization', 400);
        }
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

    // Cascade compositions and conversions manually (in case DB doesn't cascade)
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
    // Validate all component IDs exist in org and are 'material' type
    for (const c of compositions) {
        if (!c.component_resource_id || !c.quantity) {
            throw new AppError('Each composition row must have component_resource_id and quantity', 400);
        }
        const comp = await db('res_resources').where({ id: c.component_resource_id, org_id: orgId }).first();
        if (!comp) throw new AppError(`Component resource id ${c.component_resource_id} not found in your organization`, 400);
        if (comp.type !== 'material') {
            throw new AppError(`Component resource "${comp.name}" must be of type 'material'`, 400);
        }
    }

    await db('res_compositions').where('parent_resource_id', parentResourceId).del();

    if (compositions.length > 0) {
        const rows = compositions.map(c => ({
            parent_resource_id: parentResourceId,
            component_resource_id: c.component_resource_id,
            quantity: c.quantity,
            unit_id: c.unit_id || null
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
export async function addConversion(orgId, resourceId, { name, quantity, unit_id }) {
    await ensureResourceExists(orgId, resourceId);
    if (!name || !quantity || !unit_id) {
        throw new AppError('name, quantity, and unit_id are required for a conversion', 400);
    }
    // Validate unit exists in org
    const unit = await db('res_units').where({ id: unit_id, org_id: orgId }).first();
    if (!unit) throw new AppError('unit_id does not exist in your organization', 400);

    const [insertId] = await db('res_conversions').insert({
        org_id: orgId,
        resource_id: resourceId,
        name,
        quantity,
        unit_id
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

export default {
    getResources,
    getResourceById,
    createResource,
    updateResource,
    deleteResource,
    setCompositions,
    addConversion,
    removeConversion
};
