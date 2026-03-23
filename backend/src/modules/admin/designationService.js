import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getDesignations(orgId) {
    return await db('designations').where('org_id', orgId).select('*');
}

export async function createDesignation(orgId, desg_name) {
    if (!desg_name) throw new AppError('Designation name is required', 400);
    const existing = await db('designations')
        .where({ desg_name, org_id: orgId })
        .first();
    if (existing) throw new AppError('Designation already exists', 400);
    const [newId] = await db('designations').insert({ desg_name, org_id: orgId });
    return newId;
}

export default {
    getDesignations,
    createDesignation
};
