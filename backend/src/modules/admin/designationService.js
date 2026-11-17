import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getDesignations(orgId) {
    return await db('iam_designations').where('org_id', orgId).select('*');
}

export async function createDesignation(orgId, desg_name) {
    if (!desg_name) throw new AppError('Designation name is required', 400);
    const existing = await db('iam_designations')
        .where({ desg_name, org_id: orgId })
        .first();
    if (existing) throw new AppError('Designation already exists', 400);
    const [newId] = await db('iam_designations').insert({ desg_name, org_id: orgId });
    return newId;
}

export async function renameDesignation(orgId, id, value) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name) throw new AppError('Designation name is required', 400);
    const table = 'iam_designations';
    await db.transaction(async trx => {
        const record = await trx(table).where({ org_id: orgId, id }).forUpdate().first();
        if (!record) throw new AppError('Designation not found', 404);
        if (record.desg_name === name) return;
        const duplicate = await trx(table).where({ org_id: orgId, desg_name: name }).whereNot('id', id).first();
        if (duplicate) throw new AppError('Designation already exists', 409);
        await trx(table).where({ org_id: orgId, id }).update({ desg_name: name });
    });
}

export async function deleteDesignation(orgId, desgId) {
    if (!desgId) throw new AppError('Designation ID is required', 400);
    // Check if in use
    const inUse = await db('iam_users').where({ org_id: orgId, desg_id: desgId }).first();
    if (inUse) throw new AppError('Cannot delete: This Designation is currently assigned to one or more users.', 400);

    return await db('iam_designations').where({ org_id: orgId, id: desgId }).delete();
}

export default {
    getDesignations,
    createDesignation,
    renameDesignation,
    deleteDesignation
};
