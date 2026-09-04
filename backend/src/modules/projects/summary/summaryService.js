import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

export async function getProjectSummaries(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const summaries = await db('proj_summary')
        .where({ project_id: projectId })
        .orderBy('date', 'desc');

    return summaries;
}

export async function addProjectSummaries(projectId, items) {
    const toInsert = items.map(item => ({
        project_id: projectId,
        title: item.title,
        details: item.details,
        status: item.status || 'pending',
        date: item.date || new Date().toISOString().split('T')[0]
    }));

    await db('proj_summary').insert(toInsert);
    return true;
}

export async function updateProjectSummaries(projectId, items) {
    await db.transaction(async (trx) => {
        const queries = items.map(item => {
            if (!item.id) return Promise.resolve();

            const updateData = {
                title: item.title,
                details: item.details,
                status: item.status,
                date: item.date
            };

            // Remove undefined fields
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            return trx('proj_summary')
                .where({ id: item.id, project_id: projectId })
                .update(updateData);
        });
        await Promise.all(queries);
    });
    return true;
}

export async function deleteProjectSummaries(projectId, idsToDelete) {
    await db('proj_summary')
        .where('project_id', projectId)
        .whereIn('id', idsToDelete)
        .del();

    return true;
}

export default {
    getProjectSummaries,
    addProjectSummaries,
    updateProjectSummaries,
    deleteProjectSummaries,
};
