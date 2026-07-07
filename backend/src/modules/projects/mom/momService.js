import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   FETCH PROJECT MoMs (LIST)
-------------------------------------------------------- */
export async function fetchProjectMoMs(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const moms = await db('proj_moms')
        .where('project_id', projectId)
        .select(['id as mom_id', 'subject', 'meeting_no', 'date', 'venue'])
        .orderBy('date', 'desc');

    return { moms, count: moms.length };
}

/* -------------------------------------------------------
   FETCH SINGLE MoM BY ID
-------------------------------------------------------- */
export async function fetchMoMById(projectId, momId) {
    if (!momId) throw new AppError('momId is required', 400);

    const mom = await db('proj_moms as pm')
        .leftJoin('proj_projects as p', 'pm.project_id', 'p.id')
        .where('pm.id', momId)
        .andWhere('pm.project_id', projectId)
        .select([
            'pm.id as mom_id',
            'pm.project_id',
            'p.name as project_name',
            'pm.subject',
            'pm.venue',
            'pm.date',
            'pm.meeting_no',
            'pm.content',
            'pm.participants'
        ])
        .first();

    if (!mom) throw new AppError('MoM not found', 404);

    // Parse JSON values safely
    if (mom.content && typeof mom.content === "string") {
        try {
            mom.content = JSON.parse(mom.content);
        } catch (e) {
            console.error(`Error parsing MoM content for ID ${momId}:`, e.message);
        }
    }

    if (mom.participants) {
        if (typeof mom.participants === "string") {
            try {
                mom.participants = JSON.parse(mom.participants);
            } catch (e) {
                console.error(`Error parsing MoM participants for ID ${momId}:`, e.message);
                mom.participants = [];
            }
        }
    } else {
        mom.participants = [];
    }

    return mom;
}

/* -------------------------------------------------------
   CREATE MoM
-------------------------------------------------------- */
export async function createMoM(projectId, data) {
    const [id] = await db('proj_moms').insert({
        project_id: projectId,
        meeting_no: data.meeting_no,
        subject: data.subject,
        venue: data.venue,
        date: data.date,
        participants: data.participants ? (typeof data.participants === 'string' ? data.participants : JSON.stringify(data.participants)) : null,
        content: data.content ? (typeof data.content === 'string' ? data.content : JSON.stringify(data.content)) : null
    });

    return { mom_id: id };
}

/* -------------------------------------------------------
   UPDATE MoM
-------------------------------------------------------- */
export async function updateMoM(projectId, momId, data) {
    const allowedFields = ["subject", "venue", "date", "meeting_no"];
    const updateData = {};

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updateData[field] = data[field];
        }
    }

    if (data.content !== undefined) {
        updateData.content = data.content ? (typeof data.content === 'string' ? data.content : JSON.stringify(data.content)) : null;
    }

    if (data.participants !== undefined) {
        updateData.participants = data.participants ? (typeof data.participants === 'string' ? data.participants : JSON.stringify(data.participants)) : null;
    }

    if (Object.keys(updateData).length > 0) {
        const affected = await db('proj_moms')
            .where('id', momId)
            .where('project_id', projectId)
            .update(updateData);

        if (affected === 0) throw new AppError('MoM not found', 404);
    }

    return { affected: 1 };
}

/* -------------------------------------------------------
   DELETE MoM
-------------------------------------------------------- */
export async function deleteMoM(projectId, momId) {
    const affected = await db('proj_moms')
        .where({ id: momId, project_id: projectId })
        .del();

    if (affected === 0) throw new AppError('MoM not found', 404);
    return { affectedRows: 1 };
}

export default {
    fetchProjectMoMs,
    fetchMoMById,
    createMoM,
    updateMoM,
    deleteMoM
};
