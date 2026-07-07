import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

export async function fetchProjectStaff(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const staff = await db('proj_staff_responsible')
        .where('project_id', projectId)
        .select('*');

    return { staff, staffCount: staff.length };
}

export async function insertStaff(data) {
    const [psrr_id] = await db('proj_staff_responsible').insert({
        project_id: data.project_id,
        name: data.name,
        designation: data.designation || null,
        responsibilities: data.responsibilities || null,
        mobile: data.mobile || null,
        email: data.email || null
    });

    return { psrr_id };
}

export async function updateStaff(projectId, id, data = {}) {
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.email !== undefined) updateData.email = data.email;

    if (Object.keys(updateData).length === 0) {
        throw new AppError('No fields provided to update', 400);
    }

    const affected = await db('proj_staff_responsible')
        .where({ psrr_id: id, project_id: projectId })
        .update(updateData);

    if (affected === 0) throw new AppError('Staff not found', 404);
    return { affected };
}

export async function deleteStaff(projectId, id) {
    const affected = await db('proj_staff_responsible')
        .where({ psrr_id: id, project_id: projectId })
        .del();

    if (affected === 0) throw new AppError('Staff not found', 404);
    return { affectedRows: affected };
}

export default {
    fetchProjectStaff,
    insertStaff,
    updateStaff,
    deleteStaff,
};
