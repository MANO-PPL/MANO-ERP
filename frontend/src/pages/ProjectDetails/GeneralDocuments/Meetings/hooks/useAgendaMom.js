// ─────────────────────────────────────────────────────────────────────────────
// Meetings / hooks / useAgendaMom.js
// Handles: agenda point state & handlers, MoM point state & handlers,
// copy-agenda-to-mom, save, cancel, print.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { generalDocsApi } from '../../../../../services/generalDocsApi';
import { toast }           from 'react-toastify';

/**
 * useAgendaMom
 * @param {{
 *   projectId: string,
 *   id: string,
 *   isNew: boolean,
 *   onBack: Function,
 *   details: object,
 *   participants: Array,
 *   setSaving: Function,
 *   setIsEditing: Function,
 *   reloadMeeting: Function,   // loadMeetingData wired with state setters
 * }} options
 */
export function useAgendaMom({
    projectId,
    id,
    isNew,
    onBack,
    details,
    participants,
    setSaving,
    setIsEditing,
    reloadMeeting
}) {
    const [agendaPoints, setAgendaPoints] = useState([{ id: 'ag-1', sl_no: 1, point: '' }]);
    const [momPoints,    setMomPoints]    = useState([{ id: 'mom-1', sl_no: 1, point: '' }]);

    // ── Agenda ──────────────────────────────────────────────────────────────

    const handleAddAgendaPoint = () => {
        setAgendaPoints(prev => [
            ...prev, { id: `ag-${Date.now()}`, sl_no: prev.length + 1, point: '' }
        ]);
    };

    const handleRemoveAgendaPoint = (pointId) => {
        if (agendaPoints.length <= 1) {
            setAgendaPoints([{ id: 'ag-1', sl_no: 1, point: '' }]);
            return;
        }
        setAgendaPoints(prev =>
            prev.filter(p => p.id !== pointId).map((p, i) => ({ ...p, sl_no: i + 1 }))
        );
    };

    const handleAgendaPointChange = (pointId, val) => {
        setAgendaPoints(prev => prev.map(p => (p.id === pointId ? { ...p, point: val } : p)));
    };

    // ── MoM ─────────────────────────────────────────────────────────────────

    const handleAddMomPoint = () => {
        setMomPoints(prev => [
            ...prev, { id: `mom-${Date.now()}`, sl_no: prev.length + 1, point: '' }
        ]);
    };

    const handleRemoveMomPoint = (pointId) => {
        if (momPoints.length <= 1) {
            setMomPoints([{ id: 'mom-1', sl_no: 1, point: '' }]);
            return;
        }
        setMomPoints(prev =>
            prev.filter(p => p.id !== pointId).map((p, i) => ({ ...p, sl_no: i + 1 }))
        );
    };

    const handleMomPointChange = (pointId, val) => {
        setMomPoints(prev => prev.map(p => (p.id === pointId ? { ...p, point: val } : p)));
    };

    // ── Copy agenda → MoM ───────────────────────────────────────────────────

    const handleCopyAgendaToMom = () => {
        const validAgenda = agendaPoints.filter(p => p.point && p.point.trim());
        if (validAgenda.length === 0) { toast.warning('No agenda points to copy.'); return; }
        setMomPoints(validAgenda.map((ag, idx) => ({
            id: `mom-copy-${idx}-${Date.now()}`, sl_no: idx + 1, point: ag.point.trim()
        })));
        toast.success(`Copied ${validAgenda.length} agenda point(s) to MoM.`);
    };

    // ── Save ─────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!details.subject.trim()) { toast.error('Please enter a meeting subject'); return; }
        setSaving(true);
        try {
            const attendanceMap = {};
            participants.forEach(p => { attendanceMap[p.pd_id] = p.attended ? 'present' : 'absent'; });

            const filteredAgenda = agendaPoints
                .filter(p => p.point && p.point.trim())
                .map((p, i) => ({ sl_no: i + 1, point: p.point.trim() }));
            const filteredMom = momPoints
                .filter(p => p.point && p.point.trim())
                .map((p, i) => ({ sl_no: i + 1, point: p.point.trim() }));

            const payload = {
                subject:       details.subject.trim(),
                meeting_no:    details.meetingNo ? parseInt(details.meetingNo, 10) : undefined,
                venue:         details.venue.trim(),
                date:          details.date,
                time:          details.time,
                status:        details.status || 'scheduled',
                participants:  participants.map(p => ({ pd_id: p.pd_id, attended: p.attended })),
                agenda_points: filteredAgenda,
                mom_points:    filteredMom,
                content: {
                    time:          details.time,
                    status:        details.status || 'scheduled',
                    attendance:    attendanceMap,
                    agenda_points: filteredAgenda,
                    mom_points:    filteredMom
                }
            };

            if (isNew) {
                await generalDocsApi.createMeeting(projectId, payload);
                toast.success('Meeting scheduled successfully.');
                onBack();
            } else {
                await generalDocsApi.updateMeeting(projectId, id, payload);
                toast.success('Meeting updated successfully.');
                setIsEditing(false);
                reloadMeeting();
            }
        } catch (err) {
            console.error('Failed to save meeting:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to save meeting');
        } finally {
            setSaving(false);
        }
    };

    // ── Cancel ───────────────────────────────────────────────────────────────

    const handleCancelEdit = () => {
        if (isNew) { onBack(); return; }
        setIsEditing(false);
        reloadMeeting();
    };

    // ── Print ────────────────────────────────────────────────────────────────

    const handlePrint = () => {
        const originalTitle = document.title;
        document.title = ' ';
        window.print();
        setTimeout(() => { document.title = originalTitle; }, 1000);
    };

    // ── Computed ─────────────────────────────────────────────────────────────

    const validAgendaCount = useMemo(
        () => agendaPoints.filter(p => p.point && p.point.trim()).length,
        [agendaPoints]
    );
    const validMomCount = useMemo(
        () => momPoints.filter(p => p.point && p.point.trim()).length,
        [momPoints]
    );

    return {
        agendaPoints, setAgendaPoints,
        momPoints,    setMomPoints,
        validAgendaCount,
        validMomCount,
        handleAddAgendaPoint, handleRemoveAgendaPoint, handleAgendaPointChange,
        handleAddMomPoint,    handleRemoveMomPoint,    handleMomPointChange,
        handleCopyAgendaToMom,
        handleSave, handleCancelEdit, handlePrint
    };
}
