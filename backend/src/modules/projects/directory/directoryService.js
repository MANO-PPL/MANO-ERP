import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

export async function fetchProjectDirectory(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const directory = await db('proj_directory as pd')
        .leftJoin('proj_parties as pp', 'pd.party_id', 'pp.id')
        .leftJoin('crm_contacts as c', 'pp.contact_id', 'c.id')
        .leftJoin('crm_job_nature as jn', 'c.job_nature_id', 'jn.id')
        .where('pd.project_id', projectId)
        .select([
            'pd.id',
            'pd.project_id',
            'pd.party_id as party_id',
            'pd.party_id as pv_id',
            'pp.contact_id as contact_id',
            'c.name as company_name',
            'c.category as category',
            'jn.job_name as job_nature',
            'pd.contact_person',
            'pd.designation',
            'pd.responsibilities',
            'pd.mobile_no',
            'pd.email',
            'pd.address_line',
            'pd.created_at',
            'pd.updated_at'
        ]);

    return { directory, count: directory.length };
}

export async function fetchDirectoryCount(projectId = null) {
    const query = db('proj_directory');
    if (projectId) {
        query.where('project_id', projectId);
    }
    const result = await query.count('id as cnt').first();
    return result ? parseInt(result.cnt, 10) : 0;
}

export async function insertDirectoryItem(data) {
    // Find party_id from proj_parties based on id or contact_id
    let party_id = data.party_id || data.pv_id || null;
    if (party_id) {
        const v = await db('proj_parties')
            .where({ project_id: data.project_id, id: party_id })
            .orWhere({ project_id: data.project_id, contact_id: party_id })
            .first();
        if (v) party_id = v.id;
    }

    const [id] = await db('proj_directory').insert({
        project_id: data.project_id,
        party_id: party_id,
        contact_person: data.contact_person,
        designation: data.designation || null,
        responsibilities: data.responsibilities || null,
        mobile_no: data.mobile_no || null,
        email: data.email || null,
        address_line: data.address_line || null
    });

    return { id };
}

export async function updateDirectoryItem(projectId, id, data = {}) {
    const updateData = {};
    if (data.party_id !== undefined || data.pv_id !== undefined) {
        let party_id = data.party_id || data.pv_id || null;
        if (party_id) {
            const v = await db('proj_parties')
                .where({ project_id: projectId, id: party_id })
                .orWhere({ project_id: projectId, contact_id: party_id })
                .first();
            if (v) party_id = v.id;
        }
        updateData.party_id = party_id;
    }
    if (data.contact_person !== undefined) updateData.contact_person = data.contact_person;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
    if (data.mobile_no !== undefined) updateData.mobile_no = data.mobile_no;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address_line !== undefined) updateData.address_line = data.address_line;

    const affected = await db('proj_directory')
        .where({ id, project_id: projectId })
        .update(updateData);

    if (affected === 0) throw new AppError('Directory item not found', 404);
    return { affected };
}

export async function deleteDirectoryItem(projectId, id) {
    const affectedRows = await db('proj_directory')
        .where({ id, project_id: projectId })
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
