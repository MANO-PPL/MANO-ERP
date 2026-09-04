import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/* -------------------------------------------------------
   HELPER: NORMALIZE CONTENT JSON
-------------------------------------------------------- */
function normalizeMeetingContent(rawContent, fallbackTime = '') {
    let contentObj = {
        time: fallbackTime || '',
        status: '',
        agenda_points: [],
        mom_points: [],
        attendance: {}
    };
    if (!rawContent) return contentObj;

    try {
        const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
        if (Array.isArray(parsed)) {
            const mapped = parsed.map((p, i) => ({
                sl_no: p.sl_no || i + 1,
                point: p.point || p.topic || p.description || ''
            }));
            contentObj.agenda_points = mapped;
            contentObj.mom_points = [];
        } else if (parsed && typeof parsed === 'object') {
            const rawAgenda = Array.isArray(parsed.agenda_points)
                ? parsed.agenda_points.map((p, i) => ({
                    sl_no: p.sl_no || i + 1,
                    point: p.point || p.topic || p.description || ''
                }))
                : (Array.isArray(parsed.points)
                    ? parsed.points.map((p, i) => ({
                        sl_no: p.sl_no || i + 1,
                        point: p.point || p.topic || p.description || ''
                    }))
                    : []);

            const rawMom = Array.isArray(parsed.mom_points)
                ? parsed.mom_points.map((p, i) => ({
                    sl_no: p.sl_no || i + 1,
                    point: p.point || p.topic || p.description || ''
                }))
                : [];

            contentObj = {
                time: parsed.time || fallbackTime || '',
                status: parsed.status || '',
                agenda_points: rawAgenda,
                mom_points: rawMom,
                attendance: (parsed.attendance && typeof parsed.attendance === 'object') ? parsed.attendance : {}
            };
        }
    } catch (e) {
        console.error('[normalizeMeetingContent] Error parsing content:', e.message);
    }
    return contentObj;
}

/* -------------------------------------------------------
   FETCH PROJECT MEETINGS (LIST)
-------------------------------------------------------- */
export async function fetchProjectMeetings(projectId) {
    if (!projectId) throw new AppError('projectId is required', 400);

    const meetings = await db('proj_meetings as pm')
        .where('pm.project_id', projectId)
        .select([
            'pm.id',
            'pm.id as meeting_id',
            'pm.project_id',
            'pm.meeting_no',
            'pm.subject',
            'pm.venue',
            'pm.date',
            'pm.content',
            'pm.created_at',
            'pm.updated_at'
        ])
        .orderBy('pm.date', 'desc')
        .orderBy('pm.meeting_no', 'desc');

    // Fetch participant counts for each meeting
    const meetingIds = meetings.map(m => m.id);
    let participantCounts = {};
    if (meetingIds.length > 0) {
        const counts = await db('proj_meetings_participants')
            .whereIn('meeting_id', meetingIds)
            .groupBy('meeting_id')
            .select('meeting_id')
            .count('* as count');
        counts.forEach(c => {
            participantCounts[c.meeting_id] = Number(c.count);
        });
    }

    const mappedMeetings = meetings.map(m => {
        const contentObj = normalizeMeetingContent(m.content);
        const agendaCount = (contentObj.agenda_points || []).length;
        const momCount = (contentObj.mom_points || []).length;

        return {
            id: m.id,
            meeting_id: m.id,
            project_id: m.project_id,
            meeting_no: m.meeting_no,
            subject: m.subject,
            venue: m.venue,
            date: m.date,
            time: contentObj.time || '',
            content: contentObj,
            agenda_points: contentObj.agenda_points || [],
            mom_points: contentObj.mom_points || [],
            agenda_count: agendaCount,
            mom_count: momCount,
            points_count: agendaCount + momCount,
            participants_count: participantCounts[m.id] || 0,
            created_at: m.created_at,
            updated_at: m.updated_at
        };
    });

    return { meetings: mappedMeetings, count: mappedMeetings.length };
}

/* -------------------------------------------------------
   FETCH SINGLE MEETING BY ID (WITH PARTICIPANTS)
-------------------------------------------------------- */
export async function fetchMeetingById(projectId, meetingId) {
    if (!meetingId) throw new AppError('meetingId is required', 400);

    const meeting = await db('proj_meetings as pm')
        .leftJoin('proj_projects as p', 'pm.project_id', 'p.id')
        .where('pm.id', meetingId)
        .andWhere('pm.project_id', projectId)
        .select([
            'pm.id',
            'pm.id as meeting_id',
            'pm.project_id',
            'p.name as project_name',
            'pm.subject',
            'pm.meeting_no',
            'pm.venue',
            'pm.date',
            'pm.content',
            'pm.created_at',
            'pm.updated_at'
        ])
        .first();

    if (!meeting) throw new AppError('Meeting not found', 404);

    const participants = await db('proj_meetings_participants as pmp')
        .join('proj_directory as pd', 'pmp.pd_id', 'pd.id')
        .leftJoin('proj_parties as pp', 'pd.party_id', 'pp.id')
        .leftJoin('crm_contacts as c', 'pp.contact_id', 'c.id')
        .where('pmp.meeting_id', meetingId)
        .select([
            'pmp.id as participant_entry_id',
            'pmp.pd_id',
            'pd.id',
            'pd.contact_person',
            'pd.designation',
            'pd.responsibilities',
            'pd.mobile_no',
            'pd.email',
            'c.name as company_name',
            'c.name as organization',
            'c.category as category'
        ]);

    const contentObj = normalizeMeetingContent(meeting.content);
    const attendanceMap = contentObj.attendance || {};

    const enrichedParticipants = participants.map(p => ({
        ...p,
        attended: attendanceMap[p.pd_id] !== 'absent',
        attendance: attendanceMap[p.pd_id] || 'present'
    }));

    return {
        ...meeting,
        time: contentObj.time || '',
        content: contentObj,
        agenda_points: contentObj.agenda_points || [],
        mom_points: contentObj.mom_points || [],
        participants: enrichedParticipants
    };
}

/* -------------------------------------------------------
   CREATE MEETING
-------------------------------------------------------- */
export async function createMeeting(projectId, data) {
    if (!projectId) throw new AppError('projectId is required', 400);
    if (!data.subject) throw new AppError('Meeting subject is required', 400);

    let meeting_id;

    await db.transaction(async (trx) => {
        // Resolve meeting number if not provided
        let meetingNo = parseInt(data.meeting_no, 10);
        if (isNaN(meetingNo) || meetingNo <= 0) {
            const lastMeeting = await trx('proj_meetings')
                .where('project_id', projectId)
                .max('meeting_no as maxNo')
                .first();
            meetingNo = (lastMeeting?.maxNo || 0) + 1;
        }

        // Prepare agenda_points and mom_points
        const agendaPoints = (Array.isArray(data.agenda_points) ? data.agenda_points : (data.content?.agenda_points || (Array.isArray(data.points) ? data.points : [])))
            .map((p, i) => ({ sl_no: i + 1, point: typeof p === 'string' ? p : (p.point || p.topic || p.description || '') }));

        const momPoints = (Array.isArray(data.mom_points) ? data.mom_points : (data.content?.mom_points || []))
            .map((p, i) => ({ sl_no: i + 1, point: typeof p === 'string' ? p : (p.point || p.topic || p.description || '') }));

        let finalContent = {
            time: data.time || data.content?.time || '',
            status: data.content?.status || 'agenda_created',
            agenda_points: agendaPoints,
            mom_points: momPoints,
            attendance: data.content?.attendance || {}
        };

        let attendanceMap = finalContent.attendance || {};
        if (data.attendance && typeof data.attendance === 'object') {
            attendanceMap = { ...attendanceMap, ...data.attendance };
        }
        if (Array.isArray(data.participants)) {
            data.participants.forEach(p => {
                if (typeof p === 'object' && p.pd_id) {
                    attendanceMap[p.pd_id] = p.attended === false || p.attendance === 'absent' ? 'absent' : 'present';
                }
            });
        }
        finalContent.attendance = attendanceMap;

        const [id] = await trx('proj_meetings').insert({
            project_id: projectId,
            meeting_no: meetingNo,
            subject: data.subject,
            venue: data.venue || '',
            date: data.date || new Date().toISOString().split('T')[0],
            content: JSON.stringify(finalContent)
        });

        meeting_id = id;

        // Insert participants (array of pd_id integers or objects with pd_id)
        if (Array.isArray(data.participants) && data.participants.length > 0) {
            const records = data.participants
                .map(p => (typeof p === 'object' ? p.pd_id : p))
                .filter(Boolean)
                .map(pd_id => ({
                    meeting_id,
                    pd_id
                }));

            if (records.length > 0) {
                await trx('proj_meetings_participants').insert(records);
            }
        }
    });

    return { id: meeting_id, meeting_id };
}

/* -------------------------------------------------------
   UPDATE MEETING
-------------------------------------------------------- */
export async function updateMeeting(projectId, meetingId, data) {
    if (!meetingId) throw new AppError('meetingId is required', 400);

    await db.transaction(async (trx) => {
        const updateFields = {};
        if (data.subject !== undefined) updateFields.subject = data.subject;
        if (data.venue !== undefined) updateFields.venue = data.venue;
        if (data.date !== undefined) updateFields.date = data.date;

        if (data.meeting_no !== undefined) {
            const parsedNo = parseInt(data.meeting_no, 10);
            if (!isNaN(parsedNo)) updateFields.meeting_no = parsedNo;
        }

        // Package content
        if (data.content !== undefined || data.points !== undefined || data.agenda_points !== undefined || data.mom_points !== undefined || data.time !== undefined) {
            const currentMeeting = await trx('proj_meetings').where({ id: meetingId, project_id: projectId }).first();
            const currentContent = currentMeeting ? normalizeMeetingContent(currentMeeting.content) : {};

            const rawAgenda = data.agenda_points !== undefined
                ? data.agenda_points
                : (data.content?.agenda_points !== undefined ? data.content.agenda_points : currentContent.agenda_points);

            const rawMom = data.mom_points !== undefined
                ? data.mom_points
                : (data.content?.mom_points !== undefined ? data.content.mom_points : currentContent.mom_points);

            const agendaPoints = (Array.isArray(rawAgenda) ? rawAgenda : [])
                .map((p, i) => ({ sl_no: i + 1, point: typeof p === 'string' ? p : (p.point || p.topic || p.description || '') }));

            const momPoints = (Array.isArray(rawMom) ? rawMom : [])
                .map((p, i) => ({ sl_no: i + 1, point: typeof p === 'string' ? p : (p.point || p.topic || p.description || '') }));

            let finalContent = {
                time: data.time !== undefined ? data.time : (data.content?.time || currentContent.time || ''),
                status: data.content?.status || currentContent.status || '',
                agenda_points: agendaPoints,
                mom_points: momPoints,
                attendance: currentContent.attendance || {}
            };

            let attendanceMap = finalContent.attendance || {};
            if (data.attendance && typeof data.attendance === 'object') {
                attendanceMap = { ...attendanceMap, ...data.attendance };
            }
            if (data.content && data.content.attendance && typeof data.content.attendance === 'object') {
                attendanceMap = { ...attendanceMap, ...data.content.attendance };
            }
            if (Array.isArray(data.participants)) {
                data.participants.forEach(p => {
                    if (typeof p === 'object' && p.pd_id) {
                        attendanceMap[p.pd_id] = p.attended === false || p.attendance === 'absent' ? 'absent' : 'present';
                    }
                });
            }
            finalContent.attendance = attendanceMap;
            updateFields.content = JSON.stringify(finalContent);
        }

        if (Object.keys(updateFields).length > 0) {
            const affected = await trx('proj_meetings')
                .where('id', meetingId)
                .andWhere('project_id', projectId)
                .update(updateFields);

            if (affected === 0) throw new AppError('Meeting not found', 404);
        }

        // Sync participants if passed
        if (Array.isArray(data.participants)) {
            await trx('proj_meetings_participants')
                .where('meeting_id', meetingId)
                .del();

            const records = data.participants
                .map(p => (typeof p === 'object' ? p.pd_id : p))
                .filter(Boolean)
                .map(pd_id => ({
                    meeting_id: meetingId,
                    pd_id
                }));

            if (records.length > 0) {
                await trx('proj_meetings_participants').insert(records);
            }
        }
    });

    return { affected: 1 };
}

/* -------------------------------------------------------
   DELETE MEETING
-------------------------------------------------------- */
export async function deleteMeeting(projectId, meetingId) {
    if (!meetingId) throw new AppError('meetingId is required', 400);

    return await db.transaction(async (trx) => {
        // Delete child participants first
        await trx('proj_meetings_participants')
            .where('meeting_id', meetingId)
            .del();

        const affected = await trx('proj_meetings')
            .where('id', meetingId)
            .andWhere('project_id', projectId)
            .del();

        if (affected === 0) throw new AppError('Meeting not found', 404);
        return { affectedRows: affected };
    });
}

export default {
    fetchProjectMeetings,
    fetchMeetingById,
    createMeeting,
    updateMeeting,
    deleteMeeting
};
