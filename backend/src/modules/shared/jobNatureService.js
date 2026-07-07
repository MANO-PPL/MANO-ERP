import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getJobNatures(orgId) {
    return await db('crm_job_nature').where('org_id', orgId).select('*');
}

export async function findOrCreateJobNature(orgId, jobName) {
    if (!jobName || !jobName.trim()) return null;
    const trimmed = jobName.trim();

    const existing = await db('crm_job_nature').where({ job_name: trimmed, org_id: orgId }).first();
    if (existing) return existing.job_id;

    const [newId] = await db('crm_job_nature').insert({ job_name: trimmed, org_id: orgId });
    return newId;
}

export async function createJobNature(orgId, jobName) {
    if (!jobName) throw new AppError('Job Nature name is required', 400);
    const existing = await db('crm_job_nature').where({ job_name: jobName, org_id: orgId }).first();
    if (existing) throw new AppError('Job Nature already exists', 400);
    const [newId] = await db('crm_job_nature').insert({ job_name: jobName, org_id: orgId });
    return newId;
}

export async function deleteJobNature(orgId, jobId) {
    if (!jobId) throw new AppError('Job Nature ID is required', 400);
    // Check if in use
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
