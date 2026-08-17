import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getJobNatures(orgId) {
    const list = await db('crm_job_nature')
        .where({ org_id: orgId })
        .orderBy('job_name', 'asc')
        .select('*');

    const seen = new Set();
    const uniqueList = [];
    for (const item of list) {
        const key = (item.job_name || '').trim().toLowerCase();
        if (key && !seen.has(key)) {
            seen.add(key);
            uniqueList.push(item);
        }
    }
    return uniqueList;
}

export async function findOrCreateJobNature(orgId, jobName, connection = db) {
    if (!jobName || !jobName.trim()) return null;
    const trimmed = jobName.trim();

    const existing = await connection('crm_job_nature')
        .whereRaw('LOWER(job_name) = ?', [trimmed.toLowerCase()])
        .where({ org_id: orgId })
        .first();

    if (existing) return existing.job_id;

    const [newId] = await connection('crm_job_nature').insert({ job_name: trimmed, org_id: orgId });
    return newId;
}

export async function createJobNature(orgId, jobName) {
    if (!jobName || !jobName.trim()) throw new AppError('Job Nature name is required', 400);
    const trimmed = jobName.trim();
    const existing = await db('crm_job_nature')
        .whereRaw('LOWER(job_name) = ?', [trimmed.toLowerCase()])
        .where({ org_id: orgId })
        .first();

    if (existing) return existing.job_id;

    const [newId] = await db('crm_job_nature').insert({ job_name: trimmed, org_id: orgId });
    return newId;
}

export async function deleteJobNature(orgId, jobId) {
    if (!jobId) throw new AppError('Job Nature ID is required', 400);
    const inUse = await db('crm_contacts').where({ job_nature_id: jobId, org_id: orgId }).first();
    if (inUse) throw new AppError('Cannot delete: This Job Nature is currently assigned to one or more contacts.', 400);

    return await db('crm_job_nature').where({ job_id: jobId, org_id: orgId }).delete();
}

export default {
    getJobNatures,
    findOrCreateJobNature,
    createJobNature,
    deleteJobNature
};

