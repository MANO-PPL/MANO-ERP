import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   FETCH PROJECT SUMMARIES
-------------------------------------------------------- */
export async function getProjectSummaries(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const summaries = await db('pdoc_summary')
        .where({ project_id: projectId })
        .orderBy('date', 'desc');
    return summaries;
}

/* -------------------------------------------------------
   ADD SUMMARIES (BULK)
-------------------------------------------------------- */
export async function addProjectSummaries(projectId, items) {
    const toInsert = items.map(item => ({
        project_id: projectId,
        title: item.title,
        details: item.details,
        status: item.status || 'pending',
        date: item.date || new Date().toISOString().split('T')[0]
    }));

    await db('pdoc_summary').insert(toInsert);
    return true;
}

/* -------------------------------------------------------
   UPDATE SUMMARIES (BULK)
-------------------------------------------------------- */
export async function updateProjectSummaries(items) {
    await db.transaction(async (trx) => {
        const queries = items.map(item => {
            if (!item.id) return Promise.resolve();
            
            const updateData = {
                title: item.title,
                details: item.details,
                status: item.status,
                date: item.date
            };

            // Remove undefined fields to avoid overwriting with null if unintentional
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            return trx('pdoc_summary')
                .where({ id: item.id })
                .update(updateData);
        });
        await Promise.all(queries);
    });
    return true;
}

/* -------------------------------------------------------
   DELETE SUMMARIES (BULK)
-------------------------------------------------------- */
export async function deleteProjectSummaries(idsToDelete) {
    await db('pdoc_summary').whereIn('id', idsToDelete).del();
    return true;
}

export default {
    getProjectSummaries,
    addProjectSummaries,
    updateProjectSummaries,
    deleteProjectSummaries,
};
