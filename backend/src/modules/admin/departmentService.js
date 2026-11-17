import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getDepartments(orgId) {
    return await db('iam_departments').where('org_id', orgId).select('*');
}

export async function createDepartment(orgId, dept_name) {
    if (!dept_name) throw new AppError('Department name is required', 400);
    const [newId] = await db('iam_departments').insert({ dept_name, org_id: orgId });
    return newId;
}

export async function renameDepartment(orgId, id, value) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name) throw new AppError('Department name is required', 400);
    const table = 'iam_departments';
    await db.transaction(async trx => {
        const record = await trx(table).where({ org_id: orgId, id }).forUpdate().first();
        if (!record) throw new AppError('Department not found', 404);
        if (record.dept_name === name) return;
        const duplicate = await trx(table).where({ org_id: orgId, dept_name: name }).whereNot('id', id).first();
        if (duplicate) throw new AppError('Department already exists', 409);
        await trx(table).where({ org_id: orgId, id }).update({ dept_name: name });
    });
}

export async function deleteDepartment(orgId, deptId) {
    if (!deptId) throw new AppError('Department ID is required', 400);
    // Check if in use
    const inUse = await db('iam_users').where({ org_id: orgId, dept_id: deptId }).first();
    if (inUse) throw new AppError('Cannot delete: This Department is currently assigned to one or more users.', 400);

    return await db('iam_departments').where({ org_id: orgId, id: deptId }).delete();
}

export default {
    getDepartments,
    createDepartment,
    renameDepartment,
    deleteDepartment
};
