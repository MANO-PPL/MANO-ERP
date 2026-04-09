import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   FETCH PROJECT MoMs (LIST)
-------------------------------------------------------- */
export async function fetchProjectMoMs(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const moms = await db('project_mom')
        .where('project_id', projectId)
        .select(['mom_id', 'subject', 'meeting_no', 'date', 'venue'])
        .orderBy('date', 'desc');

    return { moms, count: moms.length };
}

/* -------------------------------------------------------
   FETCH SINGLE MoM BY ID
-------------------------------------------------------- */
export async function fetchMoMById(projectId, momId) {
    if (!momId) throw new AppError('momId is required', 400);

    const mom = await db('project_mom as pm')
        .leftJoin('projects as p', 'pm.project_id', 'p.id')
        .where('pm.mom_id', momId)
        .andWhere('pm.project_id', projectId)
        .select([
            'pm.mom_id',
            'pm.project_id',
            'p.name as project_name',
            'pm.subject',
            'pm.venue',
            'pm.date',
            'pm.meeting_no',
            'pm.content'
        ])
        .first();

    if (!mom) throw new AppError('MoM not found', 404);

    // Fetch participants correctly referencing contacts
    const participants = await db('project_mom_participants as pmp')
        .leftJoin('project_directory as pd', 'pmp.pd_id', 'pd.pd_id')
        .leftJoin('contacts as c', function () {
            this.on('pd.vendor_id', 'c.id').andOn('c.type', db.raw("'vendor'"));
        })
        .where('pmp.mom_id', momId)
        .select([
            'pmp.pmp_id',
            'pmp.pd_id',
            'pd.responsibilities',
            'c.name as organization',
            'pd.contact_person',
            'pd.designation'
        ]);

    mom.participants = participants;

    // Parse content JSON safely
    if (mom.content && typeof mom.content === "string") {
        try {
            mom.content = JSON.parse(mom.content);
        } catch (e) {
            console.error(`[fetchMoMById] Error parsing MoM content for ID ${momId}:`, e.message);
        }
    }

    return mom;
}

/* -------------------------------------------------------
   CREATE MoM
-------------------------------------------------------- */
export async function createMoM(projectId, data) {
    let mom_id;
    await db.transaction(async (trx) => {
        const [id] = await trx('project_mom').insert({
            project_id: projectId,
            subject: data.subject,
            venue: data.venue,
            date: data.date,
            meeting_no: data.meeting_no,
            content: data.content ? JSON.stringify(data.content) : null,
        });

        mom_id = id;

        // Insert participants
        if (Array.isArray(data.participants) && data.participants.length > 0) {
            const records = data.participants.map((pd_id) => ({
                mom_id,
                pd_id,
            }));
            await trx('project_mom_participants').insert(records);
        }
    });

    return { mom_id };
}

/* -------------------------------------------------------
   UPDATE MoM
-------------------------------------------------------- */
export async function updateMoM(projectId, momId, data) {
    await db.transaction(async (trx) => {
        const allowedFields = ["subject", "venue", "date", "meeting_no"];
        const updateData = {};

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        }

        if (data.content !== undefined) {
            updateData.content = data.content ? JSON.stringify(data.content) : null;
        }

        if (Object.keys(updateData).length > 0) {
            const affected = await trx('project_mom')
                .where('mom_id', momId)
                .where('project_id', projectId) // Scoped to project
                .update(updateData);

            if (affected === 0) throw new AppError('MoM not found', 404);
        }

        /* ---------------- PARTICIPANTS UPDATE ---------------- */
        if (Array.isArray(data.participants)) {
            await trx('project_mom_participants').where('mom_id', momId).del();

            if (data.participants.length > 0) {
                const records = data.participants.map((pd_id) => ({
                    mom_id: momId,
                    pd_id,
                }));
                await trx('project_mom_participants').insert(records);
            }
        }
    });

    return { affected: 1 };
}

/* -------------------------------------------------------
   DELETE MoM
-------------------------------------------------------- */
export async function deleteMoM(projectId, momId) {
    const mom = await db('project_mom').where({ mom_id: momId, project_id: projectId }).first();
    if (!mom) throw new AppError('MoM not found', 404);

    await db.transaction(async (trx) => {
        await trx('project_mom_participants').where('mom_id', momId).del();
        await trx('project_mom').where('mom_id', momId).del();
    });

    return { affectedRows: 1 };
}

export default {
    fetchProjectMoMs,
    fetchMoMById,
    createMoM,
    updateMoM,
    deleteMoM
};
