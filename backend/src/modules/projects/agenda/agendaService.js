import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   FETCH PROJECT AGENDAS (LIST)
-------------------------------------------------------- */
export async function fetchProjectAgendas(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const agendas = await db('pdoc_agenda')
        .where('project_id', projectId)
        .select(['agenda_id', 'subject', 'meeting_no', 'date', 'venue'])
        .orderBy('date', 'desc');

    return { agendas, count: agendas.length };
}

/* -------------------------------------------------------
   FETCH SINGLE AGENDA BY ID
-------------------------------------------------------- */
export async function fetchAgendaById(projectId, agendaId) {
    if (!agendaId) throw new AppError('agendaId is required', 400);

    // Get agenda details with project name
    const agenda = await db('pdoc_agenda as pa')
        .leftJoin('proj_projects as p', 'pa.project_id', 'p.id')
        .where('pa.agenda_id', agendaId)
        .andWhere('pa.project_id', projectId)
        .select([
            'pa.agenda_id',
            'pa.project_id',
            'p.name as project_name',
            'pa.subject',
            'pa.venue',
            'pa.date',
            'pa.meeting_no',
            'pa.content'
        ])
        .first();

    if (!agenda) throw new AppError('Agenda not found', 404);

    // Get participants for this agenda (using contacts table instead of vendors)
    const participants = await db('pdoc_agenda_participants as pap')
        .leftJoin('pdoc_directory as pd', 'pap.pd_id', 'pd.pd_id')
        .leftJoin('pdoc_vendors as pv', 'pd.pv_id', 'pv.pv_id')
        .leftJoin('crm_contacts as c', 'pv.vendors_id', 'c.id')
        .where('pap.agenda_id', agendaId)
        .select([
            'pap.pap_id',
            'pap.pd_id',
            'pd.responsibilities',
            'c.name as company_name',
            'pd.contact_person',
            'pd.designation'
        ]);

    agenda.participants = participants;
    return agenda;
}

/* -------------------------------------------------------
   CREATE AGENDA
-------------------------------------------------------- */
export async function createAgenda(projectId, data) {
    let agenda_id;

    await db.transaction(async (trx) => {
        const [id] = await trx('pdoc_agenda').insert({
            project_id: projectId,
            subject: data.subject,
            venue: data.venue,
            date: data.date,
            meeting_no: data.meeting_no,
            content: data.content ? JSON.stringify(data.content) : null,
        });

        agenda_id = id;

        // Insert participants
        if (Array.isArray(data.participants) && data.participants.length > 0) {
            const participantRecords = data.participants.map(pd_id => ({
                agenda_id,
                pd_id,
            }));
            await trx('pdoc_agenda_participants').insert(participantRecords);
        }
    });

    return { agenda_id };
}

/* -------------------------------------------------------
   UPDATE AGENDA
-------------------------------------------------------- */
export async function updateAgenda(projectId, agendaId, data) {
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
            const affected = await trx('pdoc_agenda')
                .where('agenda_id', agendaId)
                .where('project_id', projectId)
                .update(updateData);

            if (affected === 0) throw new AppError('Agenda not found', 404);
        }

        /* ---------------- PARTICIPANTS UPDATE ---------------- */
        if (Array.isArray(data.participants)) {
            await trx('pdoc_agenda_participants')
                .where('agenda_id', agendaId)
                .del();

            if (data.participants.length > 0) {
                const participantRecords = data.participants.map(pd_id => ({
                    agenda_id: agendaId,
                    pd_id
                }));
                await trx('pdoc_agenda_participants').insert(participantRecords);
            }
        }
    });

    return { affected: 1 };
}

/* -------------------------------------------------------
   DELETE AGENDA
-------------------------------------------------------- */
export async function deleteAgenda(projectId, agendaId) {
    const agenda = await db('pdoc_agenda').where({ agenda_id: agendaId, project_id: projectId }).first();
    if (!agenda) throw new AppError('Agenda not found', 404);

    await db.transaction(async (trx) => {
        // Delete participants first (foreign key constraint)
        await trx('pdoc_agenda_participants').where('agenda_id', agendaId).del();
        
        // Delete agenda
        await trx('pdoc_agenda').where('agenda_id', agendaId).del();
    });

    return { affectedRows: 1 };
}

export default {
    fetchProjectAgendas,
    fetchAgendaById,
    createAgenda,
    updateAgenda,
    deleteAgenda,
};
