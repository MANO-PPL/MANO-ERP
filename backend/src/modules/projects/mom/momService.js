import meetingService from '../meetings/meetingService.js';

export async function fetchProjectMoMs(projectId) {
    const res = await meetingService.fetchProjectMeetings(projectId);
    const mapped = res.meetings.map(m => ({
        mom_id: m.id,
        id: m.id,
        subject: m.subject,
        meeting_no: m.meeting_no,
        date: m.date,
        venue: m.venue,
        time: m.time,
        content: m.content
    }));
    return { moms: mapped, count: mapped.length };
}

export async function fetchMoMById(projectId, momId) {
    const m = await meetingService.fetchMeetingById(projectId, momId);
    return {
        ...m,
        mom_id: m.id,
        id: m.id
    };
}

export async function createMoM(projectId, data) {
    const res = await meetingService.createMeeting(projectId, data);
    return { mom_id: res.id, id: res.id };
}

export async function updateMoM(projectId, momId, data) {
    return await meetingService.updateMeeting(projectId, momId, data);
}

export async function deleteMoM(projectId, momId) {
    return await meetingService.deleteMeeting(projectId, momId);
}

export default {
    fetchProjectMoMs,
    fetchMoMById,
    createMoM,
    updateMoM,
    deleteMoM
};
