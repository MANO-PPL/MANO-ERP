import meetingService from '../meetings/meetingService.js';

export async function fetchProjectAgendas(projectId) {
    const res = await meetingService.fetchProjectMeetings(projectId);
    const mapped = res.meetings.map(m => ({
        agenda_id: m.id,
        id: m.id,
        subject: m.subject,
        meeting_no: m.meeting_no,
        date: m.date,
        venue: m.venue,
        time: m.time,
        content: m.content
    }));
    return { agendas: mapped, count: mapped.length };
}

export async function fetchAgendaById(projectId, agendaId) {
    const m = await meetingService.fetchMeetingById(projectId, agendaId);
    return {
        ...m,
        agenda_id: m.id,
        id: m.id
    };
}

export async function createAgenda(projectId, data) {
    const res = await meetingService.createMeeting(projectId, data);
    return { agenda_id: res.id, id: res.id };
}

export async function updateAgenda(projectId, agendaId, data) {
    return await meetingService.updateMeeting(projectId, agendaId, data);
}

export async function deleteAgenda(projectId, agendaId) {
    return await meetingService.deleteMeeting(projectId, agendaId);
}

export default {
    fetchProjectAgendas,
    fetchAgendaById,
    createAgenda,
    updateAgenda,
    deleteAgenda
};
