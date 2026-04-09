import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   FETCH DIRECTORY (with vendor + job_nature joins)
-------------------------------------------------------- */
export async function fetchProjectDirectory(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const directory = await db('project_directory as pd')
        .leftJoin('contacts as c', function () {
            this.on('pd.vendor_id', 'c.id').andOn('c.type', db.raw("'vendor'"));
        })
        .leftJoin('job_nature as jn', 'c.job_nature_id', 'jn.job_id')
        .where('pd.project_id', projectId)
        .select([
            'pd.pd_id',
            'pd.project_id',
            'pd.vendor_id',
            'c.name as company_name',
            'jn.job_name as job_nature',
            'pd.contact_person',
            'pd.designation',
            'pd.responsibilities',
            'pd.mobile_no',
            'pd.email',
            'pd.address_line',
            'pd.created_at',
            'pd.updated_at',
        ])
        .orderBy('pd.created_at', 'desc');

    return { directory, count: directory.length };
}

/* -------------------------------------------------------
   METADATA — directory count
-------------------------------------------------------- */
export async function fetchDirectoryCount(projectId = null) {
    let query = db('project_directory');
    if (projectId) query = query.where('project_id', projectId);

    const [result] = await query.count('* as count');
    return result.count;
}

/* -------------------------------------------------------
   INSERT
-------------------------------------------------------- */
export async function insertDirectoryItem(data) {
    const [pd_id] = await db('project_directory').insert({
        project_id: data.project_id,
        vendor_id: data.vendor_id,
        contact_person: data.contact_person,
        designation: data.designation,
        responsibilities: data.responsibilities,
        mobile_no: data.mobile_no,
        email: data.email,
        address_line: data.address_line,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
    });

    return { pd_id };
}

/* -------------------------------------------------------
   UPDATE
-------------------------------------------------------- */
export async function updateDirectoryItem(id, data = {}) {
    const updateData = {};

    if (data.vendor_id !== undefined) updateData.vendor_id = data.vendor_id;
    if (data.contact_person !== undefined) updateData.contact_person = data.contact_person;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
    if (data.mobile_no !== undefined) updateData.mobile_no = data.mobile_no;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address_line !== undefined) updateData.address_line = data.address_line;

    if (Object.keys(updateData).length === 0) {
        throw new AppError('No fields provided to update', 400);
    }

    updateData.updated_at = db.fn.now();

    const affected = await db('project_directory')
        .where('pd_id', id)
        .update(updateData);

    if (affected === 0) throw new AppError('Directory item not found', 404);
    return { affected };
}

/* -------------------------------------------------------
   DELETE
-------------------------------------------------------- */
export async function deleteDirectoryItem(id) {
    const affected = await db('project_directory')
        .where('pd_id', id)
        .del();

    if (affected === 0) throw new AppError('Directory item not found', 404);
    return { affectedRows: affected };
}

export default {
    fetchProjectDirectory,
    fetchDirectoryCount,
    insertDirectoryItem,
    updateDirectoryItem,
    deleteDirectoryItem,
};
