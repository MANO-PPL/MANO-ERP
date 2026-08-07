import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   FETCH PROJECT MoMs (LIST)
-------------------------------------------------------- */
export async function fetchProjectMoMs(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const rawMoms = await db('pdoc_meeting as pm')
        .leftJoin('wf_document_instances as wdi', 'pm.instance_id', 'wdi.instance_id')
        .where({ 'pm.project_id': projectId, 'pm.meeting_type': 'mom' })
        .select([
            'pm.meeting_id as mom_id',
            'pm.subject',
            'pm.meeting_no',
            'pm.date',
            'pm.venue',
            'pm.instance_id',
            'wdi.instance_status'
        ]);

    const grouped = {};
    const moms = [];

    for (const m of rawMoms) {
        if (!m.instance_id) {
            moms.push(m);
        } else {
            if (!grouped[m.instance_id] || m.mom_id > grouped[m.instance_id].mom_id) {
                grouped[m.instance_id] = m;
            }
        }
    }

    moms.push(...Object.values(grouped));

    moms.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
    });

    return { moms, count: moms.length };
}

/* -------------------------------------------------------
   FETCH SINGLE MoM BY ID
-------------------------------------------------------- */
export async function fetchMoMById(projectId, momId) {
    if (!momId) throw new AppError('momId is required', 400);

    const mom = await db('pdoc_meeting as pm')
        .leftJoin('proj_projects as p', 'pm.project_id', 'p.id')
        .where('pm.meeting_id', momId)
        .andWhere('pm.project_id', projectId)
        .andWhere('pm.meeting_type', 'mom')
        .select([
            'pm.meeting_id as mom_id',
            'pm.project_id',
            'p.name as project_name',
            'pm.subject',
            'pm.venue',
            'pm.date',
            'pm.meeting_no',
            'pm.content',
            'pm.instance_id'
        ])
        .first();

    if (!mom) throw new AppError('MoM not found', 404);

    // Fetch participants correctly referencing contacts
    const participants = await db('pdoc_meeting_participants as pmp')
        .leftJoin('pdoc_directory as pd', 'pmp.pd_id', 'pd.pd_id')
        .leftJoin('pdoc_vendors as pv', 'pd.pv_id', 'pv.pv_id')
        .leftJoin('crm_contacts as c', 'pv.vendors_id', 'c.id')
        .where('pmp.meeting_id', momId)
        .where(function () {
            this.whereNull('c.category')
                .orWhereRaw('LOWER(??) NOT IN (?, ?)', ['c.category', 'client', 'pmc']);
        })
        .select([
            'pmp.id as pmp_id',
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
        const [id] = await trx('pdoc_meeting').insert({
            project_id: projectId,
            meeting_type: 'mom',
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
                meeting_id: mom_id,
                pd_id,
            }));
            await trx('pdoc_meeting_participants').insert(records);
        }
    });

    return { mom_id };
}

/* -------------------------------------------------------
   UPDATE MoM
-------------------------------------------------------- */
export async function updateMoM(projectId, momId, data) {
    await db.transaction(async (trx) => {
        const allowedFields = ["subject", "venue", "date", "meeting_no", "instance_id", "cycle_id"];
        const updateData = {};

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        }

        if (updateData.meeting_no !== undefined) {
            const parsedNo = parseInt(updateData.meeting_no, 10);
            updateData.meeting_no = isNaN(parsedNo) ? null : parsedNo;
        }

        if (data.content !== undefined) {
            updateData.content = data.content ? JSON.stringify(data.content) : null;
        }

        if (Object.keys(updateData).length > 0) {
            const affected = await trx('pdoc_meeting')
                .where('meeting_id', momId)
                .where('project_id', projectId) // Scoped to project
                .where('meeting_type', 'mom')
                .update(updateData);

            if (affected === 0) throw new AppError('MoM not found', 404);
        }

        /* ---------------- PARTICIPANTS UPDATE ---------------- */
        if (Array.isArray(data.participants)) {
            await trx('pdoc_meeting_participants').where('meeting_id', momId).del();

            if (data.participants.length > 0) {
                const records = data.participants.map((pd_id) => ({
                    meeting_id: momId,
                    pd_id,
                }));
                await trx('pdoc_meeting_participants').insert(records);
            }
        }
    });

    return { affected: 1 };
}

/* -------------------------------------------------------
   DELETE MoM
-------------------------------------------------------- */
export async function deleteMoM(projectId, momId) {
    const mom = await db('pdoc_meeting')
        .where({ meeting_id: momId, project_id: projectId, meeting_type: 'mom' })
        .first();
    if (!mom) throw new AppError('MoM not found', 404);

    await db.transaction(async (trx) => {
        await trx('pdoc_meeting_participants').where('meeting_id', momId).del();
        await trx('pdoc_meeting').where('meeting_id', momId).del();
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
