import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   FETCH PROJECT AGENDAS (LIST)
-------------------------------------------------------- */
export async function fetchProjectAgendas(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const rawAgendas = await db('pdoc_meeting as pm')
        .leftJoin('wf_document_instances as wdi', 'pm.instance_id', 'wdi.instance_id')
        .where({ 'pm.project_id': projectId, 'pm.meeting_type': 'agenda' })
        .select([
            'pm.meeting_id as agenda_id',
            'pm.subject',
            'pm.meeting_no',
            'pm.date',
            'pm.venue',
            'pm.instance_id',
            'wdi.instance_status'
        ]);

    const grouped = {};
    const agendas = [];

    for (const m of rawAgendas) {
        if (!m.instance_id) {
            agendas.push(m);
        } else {
            if (!grouped[m.instance_id] || m.agenda_id > grouped[m.instance_id].agenda_id) {
                grouped[m.instance_id] = m;
            }
        }
    }

    agendas.push(...Object.values(grouped));

    agendas.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
    });

    return { agendas, count: agendas.length };
}

/* -------------------------------------------------------
   FETCH SINGLE AGENDA BY ID
-------------------------------------------------------- */
export async function fetchAgendaById(projectId, agendaId) {
    if (!agendaId) throw new AppError('agendaId is required', 400);

    // Get agenda details with project name
    const agenda = await db('pdoc_meeting as pa')
        .leftJoin('proj_projects as p', 'pa.project_id', 'p.id')
        .where('pa.meeting_id', agendaId)
        .andWhere('pa.project_id', projectId)
        .andWhere('pa.meeting_type', 'agenda')
        .select([
            'pa.meeting_id as agenda_id',
            'pa.project_id',
            'p.name as project_name',
            'pa.subject',
            'pa.venue',
            'pa.date',
            'pa.meeting_no',
            'pa.content',
            'pa.instance_id'
        ])
        .first();

    if (!agenda) throw new AppError('Agenda not found', 404);

    // Get participants for this agenda (using contacts table instead of vendors)
    const participants = await db('pdoc_meeting_participants as pap')
        .leftJoin('pdoc_directory as pd', 'pap.pd_id', 'pd.pd_id')
        .leftJoin('pdoc_vendors as pv', 'pd.pv_id', 'pv.pv_id')
        .leftJoin('crm_contacts as c', 'pv.vendors_id', 'c.id')
        .where('pap.meeting_id', agendaId)
        .select([
            'pap.id as pap_id',
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
        const [id] = await trx('pdoc_meeting').insert({
            project_id: projectId,
            meeting_type: 'agenda',
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
                meeting_id: agenda_id,
                pd_id,
            }));
            await trx('pdoc_meeting_participants').insert(participantRecords);
        }
    });

    return { agenda_id };
}

/* -------------------------------------------------------
   UPDATE AGENDA
-------------------------------------------------------- */
export async function updateAgenda(projectId, agendaId, data) {
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
                .where('meeting_id', agendaId)
                .where('project_id', projectId)
                .where('meeting_type', 'agenda')
                .update(updateData);

            if (affected === 0) throw new AppError('Agenda not found', 404);
        }

        /* ---------------- PARTICIPANTS UPDATE ---------------- */
        if (Array.isArray(data.participants)) {
            await trx('pdoc_meeting_participants')
                .where('meeting_id', agendaId)
                .del();

            if (data.participants.length > 0) {
                const participantRecords = data.participants.map(pd_id => ({
                    meeting_id: agendaId,
                    pd_id
                }));
                await trx('pdoc_meeting_participants').insert(participantRecords);
            }
        }
    });

    return { affected: 1 };
}

/* -------------------------------------------------------
   DELETE AGENDA
-------------------------------------------------------- */
export async function deleteAgenda(projectId, agendaId) {
    const agenda = await db('pdoc_meeting')
        .where({ meeting_id: agendaId, project_id: projectId, meeting_type: 'agenda' })
        .first();
    if (!agenda) throw new AppError('Agenda not found', 404);

    await db.transaction(async (trx) => {
        // Delete participants first (foreign key constraint)
        await trx('pdoc_meeting_participants').where('meeting_id', agendaId).del();
        
        // Delete agenda
        await trx('pdoc_meeting').where('meeting_id', agendaId).del();
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
