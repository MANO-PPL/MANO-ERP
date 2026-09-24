// ─────────────────────────────────────────────────────────────────────────────
// Meetings / hooks / useMeetingData.js
// Handles: fetching meeting detail, fetching participant sources,
// meeting header state (details), project name, and formattedDate memo.
//
// loadMeetingData() RETURNS the raw shaped data so the caller (MeetingDetail)
// can distribute it to useParticipants / useAgendaMom state setters.
// The hook itself only owns: loading, saving, projectName, details.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import { generalDocsApi } from '../../../../../services/generalDocsApi';
import { projectApi }      from '../../../../../services/projectApi';
import { adminApi }        from '../../../../../services/adminApi';
import { toast }           from 'react-toastify';

const DEFAULT_DETAILS = {
    subject:   '',
    meetingNo: '',
    venue:     '',
    date:      new Date().toISOString().split('T')[0],
    time:      '10:30 AM',
    status:    'scheduled'
};

/**
 * useMeetingData
 * @param {string} projectId
 * @param {string|'new'} id  - meeting id or 'new'
 * @param {boolean} isNew
 * @param {Function} onBack
 * @param {Function} setExtraBreadcrumbs
 */
export function useMeetingData(projectId, id, isNew, onBack, setExtraBreadcrumbs) {
    const [loading,           setLoading]           = useState(!isNew);
    const [saving,            setSaving]            = useState(false);
    const [projectName,       setProjectName]       = useState('');
    const [details,           setDetails]           = useState(DEFAULT_DETAILS);
    const [directoryContacts, setDirectoryContacts] = useState([]);
    const [projectMembers,    setProjectMembers]    = useState([]);
    const [erpUsers,          setErpUsers]          = useState([]);

    // Breadcrumbs
    useEffect(() => {
        if (setExtraBreadcrumbs) {
            setExtraBreadcrumbs([
                { label: 'Project Meetings', onClick: onBack },
                { label: isNew ? 'New Meeting' : details.subject || 'Meeting Details' }
            ]);
        }
    }, [onBack, setExtraBreadcrumbs, isNew, details.subject]);

    // Fetch participant sources (directory, project members, ERP users) on mount
    useEffect(() => {
        fetchParticipantsSources();
    }, [projectId, id]);

    const fetchParticipantsSources = async () => {
        try {
            const [dirRes, membersRes, usersRes] = await Promise.allSettled([
                generalDocsApi.getDirectory(projectId),
                projectApi.getProjectMembers(projectId),
                adminApi.getUsers()
            ]);
            if (dirRes.status     === 'fulfilled' && dirRes.value?.directory)     setDirectoryContacts(dirRes.value.directory);
            if (membersRes.status === 'fulfilled' && membersRes.value?.members)   setProjectMembers(membersRes.value.members);
            if (usersRes.status   === 'fulfilled' && usersRes.value?.users)       setErpUsers(usersRes.value.users);
        } catch (err) {
            console.error('Failed to load participant sources:', err);
        }
    };

    /**
     * Fetches meeting from API.
     * Sets: projectName, details (header fields).
     * Returns: { participants, agendaPoints, momPoints, completedStatus }
     * so the caller can distribute to other state setters.
     */
    const loadMeetingData = async () => {
        try {
            setLoading(true);
            const res = await generalDocsApi.getMeeting(projectId, id);
            const m   = res.meeting || {};
            const contentObj    = m.content || {};
            const attendanceMap = contentObj.attendance || {};

            setProjectName(m.project_name || '');
            setDetails({
                subject:   m.subject    || '',
                meetingNo: m.meeting_no || '',
                venue:     m.venue      || '',
                date:      m.date ? m.date.split('T')[0] : '',
                time:      m.time  || contentObj.time   || '',
                status:    m.status || contentObj.status || 'scheduled'
            });

            // Shape participants
            const participants = (Array.isArray(m.participants) ? m.participants : []).map(p => ({
                ...p,
                attended:   attendanceMap[p.pd_id] !== 'absent',
                attendance: attendanceMap[p.pd_id] || 'present'
            }));

            // Shape agenda points
            let agendaPoints = [];
            const rawAgenda = m.agenda_points || contentObj.agenda_points;
            if (Array.isArray(rawAgenda) && rawAgenda.length > 0) {
                agendaPoints = rawAgenda.map((p, i) => ({
                    id: `ag-${i}-${Date.now()}`,
                    sl_no: p.sl_no || i + 1,
                    point: typeof p === 'string' ? p : (p.point || p.topic || p.description || '')
                }));
            } else if (Array.isArray(contentObj.points) && contentObj.points.length > 0) {
                agendaPoints = contentObj.points.map((p, i) => ({
                    id: `ag-${i}-${Date.now()}`,
                    sl_no: p.sl_no || i + 1,
                    point: p.point || p.topic || p.description || ''
                }));
            }

            // Shape MoM points
            let momPoints = [];
            const rawMom = m.mom_points || contentObj.mom_points;
            if (Array.isArray(rawMom) && rawMom.length > 0) {
                momPoints = rawMom.map((p, i) => ({
                    id: `mom-${i}-${Date.now()}`,
                    sl_no: p.sl_no || i + 1,
                    point: typeof p === 'string' ? p : (p.point || p.discussion || p.decision || '')
                }));
            }

            return { participants, agendaPoints, momPoints, status: m.status };
        } catch (err) {
            console.error('Failed to load meeting:', err);
            toast.error('Failed to load meeting details');
            return null;
        } finally {
            setLoading(false);
        }
    };

    const formattedDate = useMemo(() => {
        if (!details.date) return '-';
        try {
            return new Date(details.date).toLocaleDateString('en-GB', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch {
            return details.date;
        }
    }, [details.date]);

    return {
        loading, setLoading,
        saving,  setSaving,
        projectName,
        details, setDetails,
        directoryContacts, setDirectoryContacts,
        projectMembers,
        erpUsers,
        formattedDate,
        loadMeetingData
    };
}
