
import db from '../config/database.js';

let compositionColumnsPromise;

/**
 * The composition table was renamed from parent_resource_id/component_resource_id
 * to item_id/component_id. Keep the resolver tolerant of an older test or
 * partially migrated database while all new writes use the new names.
 */
export async function getCompositionColumns(dbClient = db) {
    if (!dbClient.schema?.hasColumn) {
        return { item: 'parent_resource_id', component: 'component_resource_id' };
    }

    if (dbClient === db && compositionColumnsPromise) return compositionColumnsPromise;

    const promise = (async () => {
        const hasItemId = await dbClient.schema.hasColumn('res_compositions', 'item_id');
        const hasComponentId = await dbClient.schema.hasColumn('res_compositions', 'component_id');
        if (hasItemId && hasComponentId) {
            return { item: 'item_id', component: 'component_id' };
        }

        const hasParentId = await dbClient.schema.hasColumn('res_compositions', 'parent_resource_id');
        const hasLegacyComponentId = await dbClient.schema.hasColumn('res_compositions', 'component_resource_id');
        if (hasParentId && hasLegacyComponentId) {
            return { item: 'parent_resource_id', component: 'component_resource_id' };
        }

        throw new Error('res_compositions must contain item_id/component_id columns');
    })();

    if (dbClient === db) compositionColumnsPromise = promise;
    return promise;
}

/**
 * Checks recursively for circular references in compositions.
 * Throws an error if a cycle is detected.
 */
async function checkCycles(resourceId, dbClient, visited = new Set()) {
    if (visited.has(resourceId)) {
        const chain = [...visited, resourceId].join(' -> ');
        throw new Error(`Circular reference detected: ${chain}`);
    }

    const resource = await dbClient('res_resources').where('id', resourceId).first();
    if (!resource || resource.type === 'material' || resource.type === 'labour') {
        return;
    }

    visited.add(resourceId);

    const columns = await getCompositionColumns(dbClient);
    const components = await dbClient('res_compositions')
        .where(columns.item, resourceId)
        .select(columns.component);

    for (const comp of components) {
        await checkCycles(comp[columns.component], dbClient, new Set(visited));
    }
}

/**
 * Resolves the immediate components of a resource.
 * - If resource is a material or labor: returns itself with factor 1.0.
 * - If resource is an item: returns its immediate composition elements.
 * - Guard: Throws if a circular reference is found anywhere in the tree.
 * 
 * @param {number} resourceId 
 * @param {object} dbClient - Knex instance (defaults to global db)
 */
export async function resolveComponents(resourceId, dbClient = db) {
    const resource = await dbClient('res_resources').where('id', resourceId).first();
    if (!resource) {
        throw new Error(`Resource with ID ${resourceId} not found`);
    }

    if (resource.type === 'material' || resource.type === 'labour') {
        return [{
            resourceId: resource.id,
            quantity: 1.0,
            unitCode: resource.base_unit_code
        }];
    }

    // Run recursive circular reference check
    await checkCycles(resourceId, dbClient);

    // Fetch immediate components
    const columns = await getCompositionColumns(dbClient);
    const compositions = await dbClient('res_compositions')
        .where(columns.item, resourceId)
        .select(`${columns.component} as resourceId`, 'quantity', 'unit_code as unitCode');

    return compositions.map(c => ({
        resourceId: c.resourceId,
        quantity: Number(c.quantity),
        unitCode: c.unitCode
    }));
}
export async function detectCycle(parentId, componentId, dbClient = db, asOfDate = null, visited = new Set()) {
    // Direct self-reference
    if (Number(parentId) === Number(componentId)) {
        return true;
    }

    if (visited.has(Number(componentId))) {
        // Already-existing cycle in the data; treat as a cycle too.
        return true;
    }
    visited.add(Number(componentId));

    const columns = await getCompositionColumns(dbClient);
    const query = dbClient('res_compositions')
        .where(columns.item, componentId)
        .select(columns.component);

    if (asOfDate) {
        query
            .andWhere('effective_from', '<=', asOfDate)
            .andWhere(function () {
                this.whereNull('effective_to').orWhere('effective_to', '>=', asOfDate);
            });
    }

    const children = await query;

    for (const child of children) {
        const childId = child[columns.component];
        if (Number(childId) === Number(parentId)) {
            return true; // componentId's subtree reaches back to parentId
        }
        if (await detectCycle(parentId, childId, dbClient, asOfDate, visited)) {
            return true;
        }
    }

    return false;
}
export default {
    resolveComponents,
    detectCycle,
    getCompositionColumns
};
