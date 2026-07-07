import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   FETCH PROJECT AGENDAS (LIST)
-------------------------------------------------------- */
export async function fetchProjectAgendas(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const agendas = await db('proj_agendas')
        .where('project_id', projectId)
        .select(['id as agenda_id', 'subject', 'meeting_no', 'date', 'venue'])
        .orderBy('date', 'desc');

    return { agendas, count: agendas.length };
}

/* -------------------------------------------------------
   FETCH SINGLE AGENDA BY ID
-------------------------------------------------------- */
export async function fetchAgendaById(projectId, agendaId) {
    if (!agendaId) throw new AppError('agendaId is required', 400);

    const agenda = await db('proj_agendas as pa')
        .leftJoin('proj_projects as p', 'pa.project_id', 'p.id')
        .where('pa.id', agendaId)
        .andWhere('pa.project_id', projectId)
        .select([
            'pa.id as agenda_id',
            'pa.project_id',
            'p.name as project_name',
            'pa.subject',
            'pa.venue',
            'pa.date',
            'pa.meeting_no',
            'pa.content',
            'pa.participants'
        ])
        .first();

    if (!agenda) throw new AppError('Agenda not found', 404);

    // Parse JSON values safely
    if (agenda.content && typeof agenda.content === "string") {
        try {
            agenda.content = JSON.parse(agenda.content);
        } catch (e) {
            console.error(`Error parsing Agenda content for ID ${agendaId}:`, e.message);
        }
    }

    if (agenda.participants) {
        if (typeof agenda.participants === "string") {
            try {
                agenda.participants = JSON.parse(agenda.participants);
            } catch (e) {
                console.error(`Error parsing Agenda participants for ID ${agendaId}:`, e.message);
                agenda.participants = [];
            }
        }
    } else {
        agenda.participants = [];
    }

    return agenda;
}

/* -------------------------------------------------------
   CREATE AGENDA
-------------------------------------------------------- */
export async function createAgenda(projectId, data) {
    const [id] = await db('proj_agendas').insert({
        project_id: projectId,
        meeting_no: data.meeting_no,
        subject: data.subject,
        venue: data.venue,
        date: data.date,
        participants: data.participants ? (typeof data.participants === 'string' ? data.participants : JSON.stringify(data.participants)) : null,
        content: data.content ? (typeof data.content === 'string' ? data.content : JSON.stringify(data.content)) : null
    });

    return { agenda_id: id };
}

/* -------------------------------------------------------
   UPDATE AGENDA
-------------------------------------------------------- */
export async function updateAgenda(projectId, agendaId, data) {
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
        const affected = await db('proj_agendas')
            .where('id', agendaId)
            .where('project_id', projectId)
            .update(updateData);

        if (affected === 0) throw new AppError('Agenda not found', 404);
    }

    return { affected: 1 };
}

/* -------------------------------------------------------
   DELETE AGENDA
-------------------------------------------------------- */
export async function deleteAgenda(projectId, agendaId) {
    const affected = await db('proj_agendas')
        .where({ id: agendaId, project_id: projectId })
        .del();

    if (affected === 0) throw new AppError('Agenda not found', 404);
    return { affectedRows: 1 };
}

export default {
    fetchProjectAgendas,
    fetchAgendaById,
    createAgenda,
    updateAgenda,
    deleteAgenda,
};
