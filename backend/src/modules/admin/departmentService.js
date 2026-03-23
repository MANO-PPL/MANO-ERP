import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getDepartments(orgId) {
    return await db('departments').where('org_id', orgId).select('*');
}

export async function createDepartment(orgId, dept_name) {
    if (!dept_name) throw new AppError('Department name is required', 400);
    const [newId] = await db('departments').insert({ dept_name, org_id: orgId });
    return newId;
}

export default {
    getDepartments,
    createDepartment
};
