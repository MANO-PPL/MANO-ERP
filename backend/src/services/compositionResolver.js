import defaultDb from '../config/database.js';

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

    const components = await dbClient('res_compositions')
        .where('parent_resource_id', resourceId)
        .select('component_resource_id');

    for (const comp of components) {
        await checkCycles(comp.component_resource_id, dbClient, new Set(visited));
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
export async function resolveComponents(resourceId, dbClient = defaultDb) {
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
    const compositions = await dbClient('res_compositions')
        .where('parent_resource_id', resourceId)
        .select('component_resource_id as resourceId', 'quantity', 'unit_code as unitCode');

    return compositions.map(c => ({
        resourceId: c.resourceId,
        quantity: Number(c.quantity),
        unitCode: c.unitCode
    }));
}

export default {
    resolveComponents
};
