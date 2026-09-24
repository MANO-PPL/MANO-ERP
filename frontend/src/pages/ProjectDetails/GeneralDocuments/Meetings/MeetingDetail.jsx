// ─────────────────────────────────────────────────────────────────────────────
// Meetings / MeetingDetail.jsx  (slim orchestrator shell)
//
// All state logic lives in the three hooks; all UI lives in components/.
// This file wires them together, owns tab/edit mode state, and performs
// the initial data load once all hooks are initialized.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { useParams }        from 'react-router-dom';
import { Loader2 }          from 'lucide-react';

// ── Hooks ────────────────────────────────────────────────────────────────────
import { useMeetingData }   from './hooks/useMeetingData';
import { useParticipants }  from './hooks/useParticipants';
import { useAgendaMom }     from './hooks/useAgendaMom';

// ── Components ────────────────────────────────────────────────────────────────
import MeetingPrintStyle    from './components/MeetingPrintStyle';
import MeetingActionBar     from './components/MeetingActionBar';
import MeetingHeader        from './components/MeetingHeader';
import ParticipantsTable    from './components/ParticipantsTable';
import AgendaTable          from './components/AgendaTable';
import MomTable             from './components/MomTable';

// ─────────────────────────────────────────────────────────────────────────────

const MeetingDetail = ({ onBack, setExtraBreadcrumbs, meetingId: id, canWrite }) => {
    const { id: projectId } = useParams();
    const isNew = id === 'new';

    // ── Tab / edit mode (owned here) ─────────────────────────────────────────
    const [activeTab,   setActiveTab]   = useState('agenda');
    const [editSection, setEditSection] = useState('agenda');
    const [isEditing,   setIsEditing]   = useState(isNew);

    // ── Data hook ─────────────────────────────────────────────────────────────
    const meetingData = useMeetingData(projectId, id, isNew, onBack, setExtraBreadcrumbs);
    const {
        loading, saving, setSaving,
        projectName, details, setDetails,
        directoryContacts, setDirectoryContacts,
        projectMembers, erpUsers,
        formattedDate,
        loadMeetingData
    } = meetingData;

    // ── Participants hook ─────────────────────────────────────────────────────
    const {
        participants, setParticipants,
        isAddParticipantOpen, setIsAddParticipantOpen,
        participantSearch, setParticipantSearch,
        participantSourceTab, setParticipantSourceTab,
        addingParticipantId,
        attendanceStats,
        availableParticipantsToAdd,
        handleToggleAttendance, handleMarkAllAttendance,
        handleAddParticipant, handleRemoveParticipant
    } = useParticipants({
        projectId, projectName, isNew,
        directoryContacts, setDirectoryContacts,
        projectMembers, erpUsers
    });

    // ── Agenda / MoM hook ─────────────────────────────────────────────────────
    const {
        agendaPoints, setAgendaPoints,
        momPoints,    setMomPoints,
        validAgendaCount, validMomCount,
        handleAddAgendaPoint, handleRemoveAgendaPoint, handleAgendaPointChange,
        handleAddMomPoint,    handleRemoveMomPoint,    handleMomPointChange,
        handleCopyAgendaToMom,
        handleSave, handleCancelEdit, handlePrint
    } = useAgendaMom({
        projectId, id, isNew, onBack,
        details, participants,
        setSaving, setIsEditing,
        reloadMeeting: useCallback(async () => {
            // Inline reload: loadMeetingData returns shaped data;
            // distribute to each hook's state setter.
            const data = await loadMeetingData();
            if (!data) return;
            setParticipants(data.participants);
            setAgendaPoints(data.agendaPoints);
            setMomPoints(data.momPoints);
            if (data.status === 'completed') setActiveTab('mom');
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [projectId, id])
    });

    // ── Initial data load (runs after all hooks are initialized) ─────────────
    useEffect(() => {
        if (isNew) return;
        (async () => {
            const data = await loadMeetingData();
            if (!data) return;
            setParticipants(data.participants);
            setAgendaPoints(data.agendaPoints);
            setMomPoints(data.momPoints);
            if (data.status === 'completed') setActiveTab('mom');
        })();
    // Only re-run when the meeting id or project changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, id]);

    // ── Visibility flags ──────────────────────────────────────────────────────
    const showAgenda = isEditing ? editSection === 'agenda' : (activeTab === 'agenda' || activeTab === 'full');
    const showMom    = isEditing ? editSection === 'mom'    : (activeTab === 'mom'    || activeTab === 'full');

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2 bg-white dark:bg-[#0d1117]">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <p className="text-xs text-gray-500 dark:text-gray-400">Loading meeting...</p>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-[#0d1117] font-sans text-gray-900 dark:text-gray-100 transition-colors overflow-hidden">

            {/* Print CSS (injected globally, hidden in screen) */}
            <MeetingPrintStyle />

            {/* Top action bar */}
            <MeetingActionBar
                isEditing={isEditing}
                editSection={editSection}
                activeTab={activeTab}
                validAgendaCount={validAgendaCount}
                validMomCount={validMomCount}
                saving={saving}
                isNew={isNew}
                canWrite={canWrite}
                onTabChange={setActiveTab}
                onEditSectionChange={setEditSection}
                onPrint={handlePrint}
                onEdit={() => { setIsEditing(true); setEditSection(activeTab === 'mom' ? 'mom' : 'agenda'); }}
                onSave={handleSave}
                onCancel={handleCancelEdit}
            />

            {/* Document body */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0d1117] custom-scrollbar">
                <div id="meeting-document-card" className="w-full pl-2 pr-3 pt-1 pb-4 bg-white dark:bg-[#0d1117] space-y-2.5 print:p-0">

                    {/* Header: edit row or read metadata */}
                    <MeetingHeader
                        isEditing={isEditing}
                        editSection={editSection}
                        activeTab={activeTab}
                        details={details}
                        onChange={patch => setDetails(prev => ({ ...prev, ...patch }))}
                        formattedDate={formattedDate}
                        projectName={projectName}
                    />

                    {/* Participants & Attendance */}
                    <ParticipantsTable
                        isEditing={isEditing}
                        editSection={editSection}
                        activeTab={activeTab}
                        participants={participants}
                        attendanceStats={attendanceStats}
                        isAddParticipantOpen={isAddParticipantOpen}
                        setIsAddParticipantOpen={setIsAddParticipantOpen}
                        participantSearch={participantSearch}
                        setParticipantSearch={setParticipantSearch}
                        participantSourceTab={participantSourceTab}
                        setParticipantSourceTab={setParticipantSourceTab}
                        addingParticipantId={addingParticipantId}
                        availableParticipantsToAdd={availableParticipantsToAdd}
                        onToggleAttendance={handleToggleAttendance}
                        onMarkAll={handleMarkAllAttendance}
                        onAddParticipant={handleAddParticipant}
                        onRemoveParticipant={handleRemoveParticipant}
                    />

                    {/* Agenda Points */}
                    {showAgenda && (
                        <AgendaTable
                            agendaPoints={agendaPoints}
                            isEditing={isEditing}
                            onAdd={handleAddAgendaPoint}
                            onRemove={handleRemoveAgendaPoint}
                            onChange={handleAgendaPointChange}
                        />
                    )}

                    {/* Minutes of Meeting */}
                    {showMom && (
                        <MomTable
                            momPoints={momPoints}
                            isEditing={isEditing}
                            onAdd={handleAddMomPoint}
                            onRemove={handleRemoveMomPoint}
                            onChange={handleMomPointChange}
                            onCopyFromAgenda={handleCopyAgendaToMom}
                        />
                    )}

                    {/* Print-only page footer */}
                    <div id="print-page-footer" className="hidden print:flex justify-end items-center pt-2 mt-4 text-[7.5pt] text-gray-500 font-medium">
                        <span>Page <span className="print-page-num">1</span></span>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MeetingDetail;
