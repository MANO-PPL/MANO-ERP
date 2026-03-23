import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function getJobNatures() {
    return await db('job_nature').select('*');
}

export async function findOrCreateJobNature(jobName) {
    if (!jobName || !jobName.trim()) return null;
    const trimmed = jobName.trim();

    const existing = await db('job_nature').where('job_name', trimmed).first();
    if (existing) return existing.job_id;

    const [newId] = await db('job_nature').insert({ job_name: trimmed });
    return newId;
}

export async function createJobNature(jobName) {
    if (!jobName) throw new AppError('Job Nature name is required', 400);
    const existing = await db('job_nature').where({ job_name: jobName }).first();
    if (existing) throw new AppError('Job Nature already exists', 400);
    const [newId] = await db('job_nature').insert({ job_name: jobName });
    return newId;
}

export async function deleteJobNature(jobId) {
    if (!jobId) throw new AppError('Job Nature ID is required', 400);
    // Check if in use
    const inUse = await db('contacts').where('job_nature_id', jobId).first();
    if (inUse) throw new AppError('Cannot delete: This Job Nature is currently assigned to one or more contacts.', 400);

    return await db('job_nature').where({ job_id: jobId }).delete();
}

export default {
    getJobNatures,
    findOrCreateJobNature,
    createJobNature,
    deleteJobNature
};
