import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

export async function fetchProjectDirectory(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const directory = await db('proj_directory as pd')
        .leftJoin('crm_contacts as c', 'pd.vendor_id', 'c.id')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.job_id')
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
            'pd.address_line'
        ]);

    return { directory, count: directory.length };
}

export async function fetchDirectoryCount(projectId = null) {
    const query = db('proj_directory');
    if (projectId) {
        query.where('project_id', projectId);
    }
    const result = await query.count('pd_id as cnt').first();
    return result ? parseInt(result.cnt, 10) : 0;
}

export async function insertDirectoryItem(data) {
    const [pd_id] = await db('proj_directory').insert({
        project_id: data.project_id,
        vendor_id: data.vendor_id || data.pv_id || null,
        contact_person: data.contact_person,
        designation: data.designation || null,
        responsibilities: data.responsibilities || null,
        mobile_no: data.mobile_no || null,
        email: data.email || null,
        address_line: data.address_line || null
    });

    return { pd_id };
}

export async function updateDirectoryItem(projectId, id, data = {}) {
    const updateData = {};
    if (data.vendor_id !== undefined) updateData.vendor_id = data.vendor_id;
    if (data.pv_id !== undefined) updateData.vendor_id = data.pv_id;
    if (data.contact_person !== undefined) updateData.contact_person = data.contact_person;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
    if (data.mobile_no !== undefined) updateData.mobile_no = data.mobile_no;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address_line !== undefined) updateData.address_line = data.address_line;

    const affected = await db('proj_directory')
        .where({ pd_id: id, project_id: projectId })
        .update(updateData);

    if (affected === 0) throw new AppError('Directory item not found', 404);
    return { affected };
}

export async function deleteDirectoryItem(projectId, id) {
    const affectedRows = await db('proj_directory')
        .where({ pd_id: id, project_id: projectId })
        .del();

    if (affectedRows === 0) throw new AppError('Directory item not found', 404);
    return { affectedRows };
}

export default {
    fetchProjectDirectory,
    fetchDirectoryCount,
    insertDirectoryItem,
    updateDirectoryItem,
    deleteDirectoryItem,
};
