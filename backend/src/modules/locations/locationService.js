import db from '../../config/database.js';
import { LocationError, LocationErrorCodes } from './locationErrors.js';

export const DEFAULT_MAX_DEPTH = 8;
export const SEED_TYPES = [
    { code: 'site', name: 'Site', sort_order: 1 },
    { code: 'tower', name: 'Tower', sort_order: 2 },
    { code: 'floor', name: 'Floor', sort_order: 3 },
    { code: 'unit', name: 'Unit', sort_order: 4 },
    { code: 'room', name: 'Room', sort_order: 5 },
    { code: 'zone', name: 'Zone', sort_order: 6 },
    { code: 'grid', name: 'Grid', sort_order: 7 },
    { code: 'chainage_segment', name: 'Chainage Segment', sort_order: 8 }
];

// Registered usage hooks: each hook is fn(locationIds: number[]) => Promise<number[]>
const registeredUsageHooks = new Set();

export function registerUsageCheck(fn) {
    if (typeof fn === 'function') {
        registeredUsageHooks.add(fn);
    }
    return () => registeredUsageHooks.delete(fn);
}

export function clearUsageChecks() {
    registeredUsageHooks.clear();
}

/**
 * Helper to run work inside an existing transaction or create a new one.
 */
async function withTransaction(customTrx, callback) {
    if (customTrx) {
        return callback(customTrx);
    }
    return db.transaction(async trx => callback(trx));
}

// =========================================================================
// 1. Types / Vocabulary Management
// =========================================================================

export async function listTypes(orgId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        return trx('loc_type')
            .where({ org_id: orgId })
            .orderBy('sort_order', 'asc')
            .orderBy('name', 'asc');
    });
}

export async function createType({ orgId, code, name, sortOrder = 0 }, externalTrx = null) {
    if (!orgId || !code || !name) {
        throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'orgId, code, and name are required');
    }
    return withTransaction(externalTrx, async trx => {
        const existing = await trx('loc_type').where({ org_id: orgId, code }).first();
        if (existing) {
            throw new LocationError(LocationErrorCodes.LOC_DUPLICATE_NAME, `Type code "${code}" already exists for this organization`);
        }
        const [id] = await trx('loc_type').insert({
            org_id: orgId,
            code: code.trim(),
            name: name.trim(),
            sort_order: sortOrder || 0
        });
        return trx('loc_type').where({ id }).first();
    });
}

export async function updateType(id, patch, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const type = await trx('loc_type').where({ id }).first();
        if (!type) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location type not found');
        }
        const updateData = {};
        if (patch.name !== undefined) updateData.name = patch.name.trim();
        if (patch.sortOrder !== undefined) updateData.sort_order = patch.sortOrder;
        if (patch.sort_order !== undefined) updateData.sort_order = patch.sort_order;
        if (patch.code !== undefined && patch.code !== type.code) {
            const conflict = await trx('loc_type')
                .where({ org_id: type.org_id, code: patch.code })
                .whereNot({ id })
                .first();
            if (conflict) {
                throw new LocationError(LocationErrorCodes.LOC_DUPLICATE_NAME, `Type code "${patch.code}" already exists`);
            }
            updateData.code = patch.code.trim();
        }

        if (Object.keys(updateData).length > 0) {
            await trx('loc_type').where({ id }).update(updateData);
        }
        return trx('loc_type').where({ id }).first();
    });
}

export async function deleteType(id, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const type = await trx('loc_type').where({ id }).first();
        if (!type) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location type not found');
        }

        // Check if in use by loc_location
        const inUse = await trx('loc_location').where({ type_id: id }).first();
        if (inUse) {
            throw new LocationError(LocationErrorCodes.LOC_TYPE_IN_USE, 'Cannot delete type that is in use by one or more locations');
        }

        await trx('loc_type').where({ id }).delete();
        return { success: true, id };
    });
}

export async function seedDefaultTypes(orgId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        for (const item of SEED_TYPES) {
            const exists = await trx('loc_type').where({ org_id: orgId, code: item.code }).first();
            if (!exists) {
                await trx('loc_type').insert({
                    org_id: orgId,
                    code: item.code,
                    name: item.name,
                    sort_order: item.sort_order
                });
            }
        }
        return listTypes(orgId, trx);
    });
}

// =========================================================================
// 2. Locations Core Service API
// =========================================================================

export async function createLocation(input, externalTrx = null) {
    const {
        orgId,
        projectId,
        parentId = null,
        typeId,
        name,
        code = null,
        sortOrder = 0,
        meta = null,
        createdBy = null
    } = input;

    if (!orgId || !projectId || !typeId || !name) {
        throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'orgId, projectId, typeId, and name are required');
    }

    const trimmedName = name.trim();

    return withTransaction(externalTrx, async trx => {
        // Validate type exists and belongs to same organization
        const type = await trx('loc_type').where({ id: typeId }).first();
        if (!type) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location type not found');
        }
        if (String(type.org_id) !== String(orgId)) {
            throw new LocationError(LocationErrorCodes.LOC_TYPE_ORG_MISMATCH, 'Type belongs to another organization');
        }

        let parent = null;
        let depth = 1;

        if (parentId) {
            parent = await trx('loc_location').where({ id: parentId }).first();
            if (!parent) {
                throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Parent location not found');
            }
            if (String(parent.project_id) !== String(projectId)) {
                throw new LocationError(LocationErrorCodes.LOC_CROSS_PROJECT, 'Parent belongs to a different project');
            }
            if (parent.status === 'archived') {
                throw new LocationError(LocationErrorCodes.LOC_PARENT_ARCHIVED, 'Cannot create child under an archived parent');
            }
            depth = parent.depth + 1;
            if (depth > DEFAULT_MAX_DEPTH) {
                throw new LocationError(LocationErrorCodes.LOC_MAX_DEPTH, `Depth cannot exceed configured maximum of ${DEFAULT_MAX_DEPTH}`);
            }
        }

        // Sibling name uniqueness (Hits uq_loc_sibling_name index on [project_id, parent_key, name])
        const duplicate = await trx('loc_location')
            .where({
                project_id: projectId,
                parent_key: parentId || 0,
                name: trimmedName
            })
            .first();

        if (duplicate) {
            throw new LocationError(LocationErrorCodes.LOC_DUPLICATE_NAME, `Sibling location with name "${trimmedName}" already exists`);
        }

        // Check unique code if provided
        if (code) {
            const codeDuplicate = await trx('loc_location')
                .where({ project_id: projectId, code: code.trim() })
                .first();
            if (codeDuplicate) {
                throw new LocationError(LocationErrorCodes.LOC_DUPLICATE_NAME, `Location with code "${code}" already exists in this project`);
            }
        }

        // Two-step insert flow per spec: insert with placeholder '//' then rewrite path
        const insertPayload = {
            project_id: projectId,
            parent_id: parentId || null,
            type_id: typeId,
            code: code ? code.trim() : null,
            name: trimmedName,
            path: '//',
            depth,
            sort_order: sortOrder || 0,
            status: 'active',
            meta: meta ? (typeof meta === 'string' ? meta : JSON.stringify(meta)) : null,
            created_by: createdBy || null
        };
        if (orgId) {
            insertPayload.org_id = orgId;
        }

        let newId;
        try {
            [newId] = await trx('loc_location').insert(insertPayload);
        } catch (insertErr) {
            // Resilient fallback: if org_id column was dropped in 3NF schema, retry without it
            if ((insertErr.code === 'ER_BAD_FIELD_ERROR' || insertErr.message.includes('Unknown column')) && insertPayload.org_id) {
                delete insertPayload.org_id;
                [newId] = await trx('loc_location').insert(insertPayload);
            } else {
                throw insertErr;
            }
        }

        const realPath = parent ? `${parent.path}${newId}/` : `/${newId}/`;
        await trx('loc_location').where({ id: newId }).update({ path: realPath });

        return getLocation(newId, trx);
    });
}

export async function updateLocation(id, patch, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const location = await trx('loc_location').where({ id }).first();
        if (!location) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location not found');
        }

        const updateData = {};

        // Sibling name update check (Hits uq_loc_sibling_name index on [project_id, parent_key, name])
        if (patch.name !== undefined && patch.name.trim() !== location.name) {
            const trimmedName = patch.name.trim();

            const duplicate = await trx('loc_location')
                .where({
                    project_id: location.project_id,
                    parent_key: location.parent_id || 0,
                    name: trimmedName
                })
                .whereNot({ id })
                .first();

            if (duplicate) {
                throw new LocationError(LocationErrorCodes.LOC_DUPLICATE_NAME, `Sibling location with name "${trimmedName}" already exists`);
            }
            updateData.name = trimmedName;
        }

        // Code uniqueness check
        if (patch.code !== undefined && patch.code !== location.code) {
            if (patch.code) {
                const codeDuplicate = await trx('loc_location')
                    .where({ project_id: location.project_id, code: patch.code.trim() })
                    .whereNot({ id })
                    .first();
                if (codeDuplicate) {
                    throw new LocationError(LocationErrorCodes.LOC_DUPLICATE_NAME, `Location code "${patch.code}" already exists in this project`);
                }
                updateData.code = patch.code.trim();
            } else {
                updateData.code = null;
            }
        }

        // Type check: ensure new type belongs to project's organization
        if (patch.typeId !== undefined && patch.typeId !== location.type_id) {
            const type = await trx('loc_type').where({ id: patch.typeId }).first();
            if (!type) {
                throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location type not found');
            }
            let targetOrgId = location.org_id;
            if (!targetOrgId) {
                const project = await trx('proj_projects').where({ id: location.project_id }).select('org_id').first();
                targetOrgId = project?.org_id;
            }
            if (targetOrgId && String(type.org_id) !== String(targetOrgId)) {
                throw new LocationError(LocationErrorCodes.LOC_TYPE_ORG_MISMATCH, 'Type belongs to another organization');
            }
            updateData.type_id = patch.typeId;
        }

        if (patch.sortOrder !== undefined) updateData.sort_order = patch.sortOrder;
        if (patch.sort_order !== undefined) updateData.sort_order = patch.sort_order;
        if (patch.meta !== undefined) {
            updateData.meta = patch.meta ? (typeof patch.meta === 'string' ? patch.meta : JSON.stringify(patch.meta)) : null;
        }

        if (Object.keys(updateData).length > 0) {
            await trx('loc_location').where({ id }).update(updateData);
        }

        return getLocation(id, trx);
    });
}

export async function moveLocation(id, newParentId = null, sortOrder = null, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        // Immediate cycle check: moving under itself
        if (String(id) === String(newParentId)) {
            throw new LocationError(LocationErrorCodes.LOC_CYCLE, 'Cannot move a location under itself');
        }

        // Lock moved location and subtree
        const node = await trx('loc_location').where({ id }).forUpdate().first();
        if (!node) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location not found');
        }

        let newParent = null;
        let newBaseDepth = 1;
        let newPrefix = `/${node.id}/`;

        if (newParentId) {
            newParent = await trx('loc_location').where({ id: newParentId }).forUpdate().first();
            if (!newParent) {
                throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Target parent location not found');
            }
            if (String(newParent.project_id) !== String(node.project_id)) {
                throw new LocationError(LocationErrorCodes.LOC_CROSS_PROJECT, 'Target parent is from a different project');
            }
            if (newParent.status === 'archived') {
                throw new LocationError(LocationErrorCodes.LOC_PARENT_ARCHIVED, 'Cannot move location under an archived parent');
            }

            // Cycle check: Reject if new parent is a descendant of the moved node
            if (newParent.path.startsWith(node.path)) {
                throw new LocationError(LocationErrorCodes.LOC_CYCLE, 'Cannot move a location under one of its own descendants');
            }

            newBaseDepth = newParent.depth + 1;
            newPrefix = `${newParent.path}${node.id}/`;
        }

        // Sibling name uniqueness under new parent / root (Hits uq_loc_sibling_name index on [project_id, parent_key, name])
        const siblingClash = await trx('loc_location')
            .where({
                project_id: node.project_id,
                parent_key: newParentId || 0,
                name: node.name
            })
            .whereNot({ id })
            .first();

        if (siblingClash) {
            throw new LocationError(
                LocationErrorCodes.LOC_DUPLICATE_NAME,
                newParentId
                    ? `A sibling named "${node.name}" already exists under target parent`
                    : `A root location named "${node.name}" already exists`
            );
        }

        // Find max depth of moved subtree to ensure total depth does not exceed DEFAULT_MAX_DEPTH
        const [maxRow] = await trx('loc_location')
            .where('project_id', node.project_id)
            .where(q => q.where('path', node.path).orWhere('path', 'like', `${node.path}%`))
            .max('depth as maxDepth');

        const subtreeHeight = (maxRow?.maxDepth || node.depth) - node.depth;
        if (newBaseDepth + subtreeHeight > DEFAULT_MAX_DEPTH) {
            throw new LocationError(LocationErrorCodes.LOC_MAX_DEPTH, `Move would exceed maximum depth of ${DEFAULT_MAX_DEPTH}`);
        }

        const oldPrefix = node.path;
        const depthDelta = newBaseDepth - node.depth;

        // Update moved node's parent and sort_order
        const updateMoved = { parent_id: newParentId || null };
        if (sortOrder !== null && sortOrder !== undefined) {
            updateMoved.sort_order = sortOrder;
        }
        await trx('loc_location').where({ id: node.id }).update(updateMoved);

        // Atomic subtree rewrite in one statement
        // oldPrefix.length is index offset. In MySQL SUBSTRING(path, oldPrefix.length + 1)
        await trx.raw(
            `UPDATE loc_location 
             SET path = CONCAT(?, SUBSTRING(path, ?)),
                 depth = depth + ?
             WHERE project_id = ? 
               AND (path = ? OR path LIKE ?)`,
            [newPrefix, oldPrefix.length + 1, depthDelta, node.project_id, oldPrefix, `${oldPrefix}%`]
        );

        return getLocation(id, trx);
    });
}

export async function archiveLocation(id, options = {}, externalTrx = null) {
    const { cascade = false } = options;
    return withTransaction(externalTrx, async trx => {
        const node = await trx('loc_location').where({ id }).first();
        if (!node) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location not found');
        }

        if (cascade) {
            await trx('loc_location')
                .where('project_id', node.project_id)
                .where(q => q.where('path', node.path).orWhere('path', 'like', `${node.path}%`))
                .update({ status: 'archived' });
        } else {
            await trx('loc_location').where({ id }).update({ status: 'archived' });
        }

        return getLocation(id, trx);
    });
}

export async function restoreLocation(id, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const node = await trx('loc_location').where({ id }).first();
        if (!node) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location not found');
        }

        if (node.parent_id) {
            const parent = await trx('loc_location').where({ id: node.parent_id }).first();
            if (parent && parent.status === 'archived') {
                throw new LocationError(LocationErrorCodes.LOC_PARENT_ARCHIVED, 'Cannot restore location while its parent is archived');
            }
        }

        await trx('loc_location').where({ id }).update({ status: 'active' });
        return getLocation(id, trx);
    });
}

export async function deleteLocation(id, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const node = await trx('loc_location').where({ id }).first();
        if (!node) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location not found');
        }

        // Check if node has children
        const hasChildren = await trx('loc_location').where({ parent_id: id }).first();
        if (hasChildren) {
            throw new LocationError(LocationErrorCodes.LOC_HAS_CHILDREN, 'Cannot delete a location that has children. Archive it instead.');
        }

        // Execute all registered usage checks
        for (const hook of registeredUsageHooks) {
            try {
                const inUse = await hook([id]);
                if (inUse) {
                    const isReported = Array.isArray(inUse) ? inUse.includes(id) : (inUse.has && inUse.has(id));
                    if (isReported) {
                        throw new LocationError(LocationErrorCodes.LOC_IN_USE, 'Cannot delete location: it is currently referenced by another module.');
                    }
                }
            } catch (err) {
                if (err instanceof LocationError) throw err;
                throw new LocationError(LocationErrorCodes.LOC_IN_USE, err.message);
            }
        }

        await trx('loc_location').where({ id }).delete();
        return { success: true, id };
    });
}

export async function getLocation(id, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const row = await trx('loc_location as l')
            .leftJoin('loc_type as t', 't.id', 'l.type_id')
            .where('l.id', id)
            .select(
                'l.*',
                't.code as type_code',
                't.name as type_name'
            )
            .first();

        if (!row) return null;
        if (row.meta && typeof row.meta === 'string') {
            try {
                row.meta = JSON.parse(row.meta);
            } catch (e) {}
        }
        return row;
    });
}

export async function listChildren(projectId, parentId = null, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const query = trx('loc_location as l')
            .leftJoin('loc_type as t', 't.id', 'l.type_id')
            .where('l.project_id', projectId);

        if (parentId) {
            query.where('l.parent_id', parentId);
        } else {
            query.whereNull('l.parent_id');
        }

        const rows = await query
            .select('l.*', 't.code as type_code', 't.name as type_name')
            .orderBy('l.sort_order', 'asc')
            .orderBy('l.name', 'asc');

        return rows.map(r => {
            if (r.meta && typeof r.meta === 'string') {
                try { r.meta = JSON.parse(r.meta); } catch (e) {}
            }
            return r;
        });
    });
}

export async function getTree(projectId, options = {}, externalTrx = null) {
    const { includeArchived = false, maxDepth = null } = options;
    return withTransaction(externalTrx, async trx => {
        let query = trx('loc_location as l')
            .leftJoin('loc_type as t', 't.id', 'l.type_id')
            .where('l.project_id', projectId);

        if (!includeArchived) {
            query = query.where('l.status', 'active');
        }
        if (maxDepth !== null) {
            query = query.where('l.depth', '<=', maxDepth);
        }

        const rows = await query
            .select('l.*', 't.code as type_code', 't.name as type_name')
            .orderBy('l.depth', 'asc')
            .orderBy('l.sort_order', 'asc')
            .orderBy('l.name', 'asc');

        const map = new Map();
        const roots = [];

        rows.forEach(r => {
            if (r.meta && typeof r.meta === 'string') {
                try { r.meta = JSON.parse(r.meta); } catch (e) {}
            }
            map.set(r.id, { ...r, children: [] });
        });

        rows.forEach(r => {
            const node = map.get(r.id);
            if (r.parent_id && map.has(r.parent_id)) {
                map.get(r.parent_id).children.push(node);
            } else if (!r.parent_id) {
                roots.push(node);
            }
        });

        return roots;
    });
}

export async function getSubtree(id, options = {}, externalTrx = null) {
    const { includeArchived = false, maxDepth = null } = options;
    return withTransaction(externalTrx, async trx => {
        const root = await getLocation(id, trx);
        if (!root) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location not found');
        }

        let query = trx('loc_location as l')
            .leftJoin('loc_type as t', 't.id', 'l.type_id')
            .where('l.project_id', root.project_id)
            .where(q => q.where('l.path', root.path).orWhere('l.path', 'like', `${root.path}%`));

        if (!includeArchived) {
            query = query.where('l.status', 'active');
        }
        if (maxDepth !== null) {
            query = query.where('l.depth', '<=', maxDepth);
        }

        const rows = await query
            .select('l.*', 't.code as type_code', 't.name as type_name')
            .orderBy('l.depth', 'asc')
            .orderBy('l.sort_order', 'asc')
            .orderBy('l.name', 'asc');

        const map = new Map();
        let subtreeRoot = null;

        rows.forEach(r => {
            if (r.meta && typeof r.meta === 'string') {
                try { r.meta = JSON.parse(r.meta); } catch (e) {}
            }
            const item = { ...r, children: [] };
            map.set(r.id, item);
            if (r.id === root.id) subtreeRoot = item;
        });

        rows.forEach(r => {
            if (r.id !== root.id && r.parent_id && map.has(r.parent_id)) {
                map.get(r.parent_id).children.push(map.get(r.id));
            }
        });

        return subtreeRoot || root;
    });
}

export async function getDescendantIds(id, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const node = await trx('loc_location').where({ id }).first();
        if (!node) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location not found');
        }

        // Stored path always ends in a slash (e.g. /1/5/), preventing /1/5/ from matching /1/50/
        const rows = await trx('loc_location')
            .where('project_id', node.project_id)
            .where(q => q.where('path', node.path).orWhere('path', 'like', `${node.path}%`))
            .select('id')
            .orderBy('depth', 'asc')
            .orderBy('sort_order', 'asc');

        return rows.map(r => r.id);
    });
}

export async function getAncestors(id, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const node = await trx('loc_location').where({ id }).first();
        if (!node) {
            throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Location not found');
        }

        // Extract ancestor IDs from path string (e.g. /1/5/12/ -> [1, 5])
        const parts = node.path
            .split('/')
            .filter(Boolean)
            .map(Number)
            .filter(nId => nId !== node.id);

        if (parts.length === 0) return [];

        const rows = await trx('loc_location as l')
            .leftJoin('loc_type as t', 't.id', 'l.type_id')
            .whereIn('l.id', parts)
            .select('l.*', 't.code as type_code', 't.name as type_name');

        const map = new Map(rows.map(r => [r.id, r]));
        return parts.map(pId => map.get(pId)).filter(Boolean);
    });
}

export async function isDescendantOf(id, ancestorId, externalTrx = null) {
    if (String(id) === String(ancestorId)) return false;
    return withTransaction(externalTrx, async trx => {
        const [node, ancestor] = await Promise.all([
            trx('loc_location').where({ id }).first(),
            trx('loc_location').where({ id: ancestorId }).first()
        ]);
        if (!node || !ancestor) return false;
        return node.path.startsWith(ancestor.path);
    });
}

/**
 * Idempotently create levels along a path and return the leaf node.
 * segments: Array<{ name: string, typeId: number }>
 */
export async function ensurePath(projectId, segments, orgId, externalTrx = null) {
    if (!segments || segments.length === 0) {
        throw new LocationError(LocationErrorCodes.LOC_NOT_FOUND, 'Segments array cannot be empty');
    }

    return withTransaction(externalTrx, async trx => {
        let currentParentId = null;
        let lastNode = null;

        for (const seg of segments) {
            const trimmedName = seg.name.trim();

            // Hits uq_loc_sibling_name index on [project_id, parent_key, name]
            let existing = await trx('loc_location')
                .where({
                    project_id: projectId,
                    parent_key: currentParentId || 0,
                    name: trimmedName
                })
                .first();

            if (!existing) {
                existing = await createLocation({
                    orgId,
                    projectId,
                    parentId: currentParentId,
                    typeId: seg.typeId,
                    name: trimmedName
                }, trx);
            }

            currentParentId = existing.id;
            lastNode = existing;
        }

        return getLocation(lastNode.id, trx);
    });
}

// =========================================================================
// 3. Invariants & Integrity Check Queries
// =========================================================================

export async function checkIntegrity(projectId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const violations = [];

        // 1. Parent in a different project
        const [crossProject] = await trx.raw(`
            SELECT c.id as child_id, c.name as child_name, c.project_id as child_project_id,
                   p.id as parent_id, p.name as parent_name, p.project_id as parent_project_id
            FROM loc_location c 
            JOIN loc_location p ON p.id = c.parent_id
            WHERE c.project_id = ? AND p.project_id <> c.project_id
        `, [projectId]);

        if (crossProject && crossProject.length > 0) {
            crossProject.forEach(v => {
                violations.push({
                    type: 'CROSS_PROJECT_PARENT',
                    locationId: v.child_id,
                    details: `Location "${v.child_name}" (Project ${v.child_project_id}) has parent "${v.parent_name}" in Project ${v.parent_project_id}`
                });
            });
        }

        // 2. Wrong path or depth for a child
        const [wrongChild] = await trx.raw(`
            SELECT c.id, c.name, c.path, c.depth,
                   p.path as parent_path, p.depth as parent_depth,
                   CONCAT(p.path, c.id, '/') as expected_path,
                   p.depth + 1 as expected_depth
            FROM loc_location c 
            JOIN loc_location p ON p.id = c.parent_id
            WHERE c.project_id = ?
              AND (c.path <> CONCAT(p.path, c.id, '/') OR c.depth <> p.depth + 1)
        `, [projectId]);

        if (wrongChild && wrongChild.length > 0) {
            wrongChild.forEach(v => {
                violations.push({
                    type: 'INVALID_CHILD_PATH_OR_DEPTH',
                    locationId: v.id,
                    details: `Child "${v.name}" path=${v.path} (expected ${v.expected_path}), depth=${v.depth} (expected ${v.expected_depth})`
                });
            });
        }

        // 3. Wrong path or depth for a root
        const [wrongRoot] = await trx.raw(`
            SELECT id, name, path, depth,
                   CONCAT('/', id, '/') as expected_path,
                   1 as expected_depth
            FROM loc_location
            WHERE project_id = ? AND parent_id IS NULL
              AND (path <> CONCAT('/', id, '/') OR depth <> 1)
        `, [projectId]);

        if (wrongRoot && wrongRoot.length > 0) {
            wrongRoot.forEach(v => {
                violations.push({
                    type: 'INVALID_ROOT_PATH_OR_DEPTH',
                    locationId: v.id,
                    details: `Root "${v.name}" path=${v.path} (expected ${v.expected_path}), depth=${v.depth} (expected ${v.expected_depth})`
                });
            });
        }

        // 4. Type from another organization (checks project's org against vocabulary type's org)
        const [typeMismatch] = await trx.raw(`
            SELECT l.id, l.name, p.org_id as proj_org_id, t.org_id as type_org_id
            FROM loc_location l 
            JOIN loc_type t ON t.id = l.type_id
            LEFT JOIN proj_projects p ON p.id = l.project_id
            WHERE l.project_id = ? AND p.org_id IS NOT NULL AND t.org_id <> p.org_id
        `, [projectId]);

        if (typeMismatch && typeMismatch.length > 0) {
            typeMismatch.forEach(v => {
                violations.push({
                    type: 'TYPE_ORG_MISMATCH',
                    locationId: v.id,
                    details: `Location "${v.name}" in project org=${v.proj_org_id} has type belonging to org=${v.type_org_id}`
                });
            });
        }

        return violations;
    });
}

/**
 * Recomputes path and depth for every node in the project strictly from parent_id.
 * Safe repair tool to run at any time.
 */
export async function rebuildPaths(projectId, externalTrx = null) {
    return withTransaction(externalTrx, async trx => {
        const allNodes = await trx('loc_location')
            .where({ project_id: projectId })
            .select('id', 'parent_id', 'path', 'depth', 'name');

        const childrenByParent = new Map();
        const roots = [];

        allNodes.forEach(node => {
            if (!node.parent_id) {
                roots.push(node);
            } else {
                if (!childrenByParent.has(node.parent_id)) {
                    childrenByParent.set(node.parent_id, []);
                }
                childrenByParent.get(node.parent_id).push(node);
            }
        });

        let repairedCount = 0;
        const queue = [];

        // Roots
        for (const root of roots) {
            const expectedPath = `/${root.id}/`;
            const expectedDepth = 1;
            if (root.path !== expectedPath || root.depth !== expectedDepth) {
                await trx('loc_location').where({ id: root.id }).update({
                    path: expectedPath,
                    depth: expectedDepth
                });
                root.path = expectedPath;
                root.depth = expectedDepth;
                repairedCount++;
            }
            queue.push(root);
        }

        // BFS traversal
        while (queue.length > 0) {
            const parent = queue.shift();
            const children = childrenByParent.get(parent.id) || [];

            for (const child of children) {
                const expectedPath = `${parent.path}${child.id}/`;
                const expectedDepth = parent.depth + 1;

                if (child.path !== expectedPath || child.depth !== expectedDepth) {
                    await trx('loc_location').where({ id: child.id }).update({
                        path: expectedPath,
                        depth: expectedDepth
                    });
                    child.path = expectedPath;
                    child.depth = expectedDepth;
                    repairedCount++;
                }

                queue.push(child);
            }
        }

        return { repairedCount };
    });
}

