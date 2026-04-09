import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   FETCH PROJECT STAFF
-------------------------------------------------------- */
export async function fetchProjectStaff(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const staff = await db('project_staff_role_responsible')
        .where('project_id', projectId)
        .select('*');

    return { staff, staffCount: staff.length };
}

/* -------------------------------------------------------
   INSERT STAFF
-------------------------------------------------------- */
export async function insertStaff(data) {
    const [psrr_id] = await db('project_staff_role_responsible').insert({
        project_id: data.project_id,
        name: data.name,
        designation: data.designation,
        responsibilities: data.responsibilities,
        mobile: data.mobile,
        email: data.email,
    });

    return { psrr_id };
}

/* -------------------------------------------------------
   UPDATE STAFF
-------------------------------------------------------- */
export async function updateStaff(id, data = {}) {
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.email !== undefined) updateData.email = data.email;

    if (Object.keys(updateData).length === 0) {
        throw new AppError('No fields provided to update', 400);
    }

    const affected = await db('project_staff_role_responsible')
        .where('psrr_id', id)
        .update(updateData);

    if (affected === 0) throw new AppError('Staff not found', 404);
    return { affected };
}

/* -------------------------------------------------------
   DELETE STAFF
-------------------------------------------------------- */
export async function deleteStaff(id) {
    const affected = await db('project_staff_role_responsible')
        .where('psrr_id', id)
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
