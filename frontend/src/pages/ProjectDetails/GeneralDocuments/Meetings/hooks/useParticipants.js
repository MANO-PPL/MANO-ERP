// ─────────────────────────────────────────────────────────────────────────────
// Meetings / hooks / useParticipants.js
// Handles: participant state, add/remove/toggle/markAll, add-participant
// modal state, and the filtered availableParticipantsToAdd memo.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { generalDocsApi } from '../../../../../services/generalDocsApi';
import { toast }           from 'react-toastify';

/**
 * useParticipants
 * @param {{
 *   projectId: string,
 *   projectName: string,
 *   isNew: boolean,
 *   directoryContacts: Array,
 *   setDirectoryContacts: Function,
 *   projectMembers: Array,
 *   erpUsers: Array,
 * }} options
 */
export function useParticipants({
    projectId,
    projectName,
    isNew,
    directoryContacts,
    setDirectoryContacts,
    projectMembers,
    erpUsers
}) {
    const [participants,          setParticipants]          = useState([]);
    const [isAddParticipantOpen,  setIsAddParticipantOpen]  = useState(false);
    const [participantSearch,     setParticipantSearch]     = useState('');
    const [participantSourceTab,  setParticipantSourceTab]  = useState('all');
    const [addingParticipantId,   setAddingParticipantId]   = useState(null);

    // ── Attendance helpers ──────────────────────────────────────────────────

    const handleToggleAttendance = (pdId) => {
        setParticipants(prev =>
            prev.map(p => {
                if (p.pd_id !== pdId) return p;
                const newAttended = !p.attended;
                return { ...p, attended: newAttended, attendance: newAttended ? 'present' : 'absent' };
            })
        );
    };

    const handleMarkAllAttendance = (attended) => {
        setParticipants(prev =>
            prev.map(p => ({ ...p, attended, attendance: attended ? 'present' : 'absent' }))
        );
    };

    // ── Add / Remove ────────────────────────────────────────────────────────

    const handleAddParticipant = async (item) => {
        try {
            setAddingParticipantId(item.id);
            let pdId = null;

            if (item.source === 'directory') {
                pdId = item.rawId;
            } else {
                const existingDir = directoryContacts.find(d =>
                    (d.email && item.email && d.email.toLowerCase() === item.email.toLowerCase()) ||
                    (d.contact_person && d.contact_person.toLowerCase() === item.name.toLowerCase())
                );

                if (existingDir) {
                    pdId = existingDir.id;
                } else {
                    try {
                        const newDir = await generalDocsApi.addDirectoryItem(projectId, {
                            contact_person: item.name,
                            designation:    item.designation || (item.source === 'project' ? 'Project Team' : 'ERP User'),
                            email:          item.email || null,
                            responsibilities: item.source === 'project' ? 'Project Team Member' : 'ERP Staff'
                        });
                        pdId = newDir.id || newDir.pd_id;
                        // Refresh directory contacts cache silently
                        generalDocsApi.getDirectory(projectId)
                            .then(res => { if (res?.directory) setDirectoryContacts(res.directory); })
                            .catch(() => {});
                    } catch (e) {
                        console.error('Failed to auto-register directory contact:', e);
                        pdId = item.rawId;
                    }
                }
            }

            const initialAttended = isNew ? false : true;
            setParticipants(prev => [
                ...prev,
                {
                    pd_id:          pdId,
                    contact_person: item.name,
                    designation:    item.designation,
                    company_name:   item.organization,
                    organization:   item.organization,
                    email:          item.email,
                    attended:       initialAttended,
                    attendance:     initialAttended ? 'present' : 'absent'
                }
            ]);

            toast.success(`Added ${item.name} to participants`);
            setIsAddParticipantOpen(false);
            setParticipantSearch('');
        } catch (err) {
            console.error('Failed to add participant:', err);
            toast.error('Failed to add participant');
        } finally {
            setAddingParticipantId(null);
        }
    };

    const handleRemoveParticipant = (pdId) => {
        setParticipants(prev => prev.filter(p => p.pd_id !== pdId));
    };

    // ── Computed values ─────────────────────────────────────────────────────

    const attendanceStats = useMemo(() => {
        const total   = participants.length;
        const present = participants.filter(p => p.attended).length;
        return { total, present, absent: total - present };
    }, [participants]);

    const availableParticipantsToAdd = useMemo(() => {
        const addedPdIds  = new Set(participants.map(p => String(p.pd_id)));
        const addedNames  = new Set(participants.map(p => (p.contact_person || '').trim().toLowerCase()));
        const addedEmails = new Set(participants.map(p => (p.email || '').trim().toLowerCase()).filter(Boolean));

        const list = [];

        // 1. Directory contacts
        if (participantSourceTab === 'all' || participantSourceTab === 'directory') {
            directoryContacts.forEach(d => {
                const name  = d.contact_person || '';
                const email = (d.email || '').trim().toLowerCase();
                if (addedPdIds.has(String(d.id)) ||
                    (name  && addedNames.has(name.trim().toLowerCase())) ||
                    (email && addedEmails.has(email))) return;
                list.push({
                    id: `dir-${d.id}`, rawId: d.id,
                    source: 'directory', sourceLabel: 'Directory',
                    name:  name  || 'Unnamed',
                    designation:  d.designation   || 'Directory Contact',
                    organization: d.company_name  || d.organization || d.category || 'External',
                    email: d.email || '', data: d
                });
            });
        }

        // 2. Project Team members
        if (participantSourceTab === 'all' || participantSourceTab === 'project') {
            projectMembers.forEach(m => {
                const name  = m.user_name || m.name || '';
                const email = (m.email || '').trim().toLowerCase();
                if ((name  && addedNames.has(name.trim().toLowerCase())) ||
                    (email && addedEmails.has(email))) return;
                if (list.some(item =>
                    (name  && item.name.toLowerCase()  === name.toLowerCase()) ||
                    (email && item.email && item.email.toLowerCase() === email))) return;
                list.push({
                    id: `proj-${m.id || m.user_id}`, rawId: m.id || m.user_id,
                    source: 'project', sourceLabel: 'Project Team',
                    name:  name  || 'Team Member',
                    designation:  m.designation || m.user_type || 'Project Team',
                    organization: projectName   || 'Project Team',
                    email: m.email || '', data: m
                });
            });
        }

        // 3. ERP users
        if (participantSourceTab === 'all' || participantSourceTab === 'erp') {
            erpUsers.forEach(u => {
                const name  = u.user_name || u.name || '';
                const email = (u.email || '').trim().toLowerCase();
                if ((name  && addedNames.has(name.trim().toLowerCase())) ||
                    (email && addedEmails.has(email))) return;
                if (list.some(item =>
                    (name  && item.name.toLowerCase()  === name.toLowerCase()) ||
                    (email && item.email && item.email.toLowerCase() === email))) return;
                list.push({
                    id: `erp-${u.id}`, rawId: u.id,
                    source: 'erp', sourceLabel: 'ERP User',
                    name:  name  || 'ERP User',
                    designation:  u.designation || u.user_type || 'Staff',
                    organization: u.dept_name   || 'MANO ERP',
                    email: u.email || '', data: u
                });
            });
        }

        if (!participantSearch.trim()) return list;
        const term = participantSearch.toLowerCase();
        return list.filter(item =>
            item.name.toLowerCase().includes(term)         ||
            item.designation.toLowerCase().includes(term)  ||
            item.organization.toLowerCase().includes(term) ||
            (item.email && item.email.toLowerCase().includes(term))
        );
    }, [participants, directoryContacts, projectMembers, erpUsers, participantSourceTab, participantSearch, projectName]);

    return {
        participants, setParticipants,
        isAddParticipantOpen, setIsAddParticipantOpen,
        participantSearch,    setParticipantSearch,
        participantSourceTab, setParticipantSourceTab,
        addingParticipantId,
        attendanceStats,
        availableParticipantsToAdd,
        handleToggleAttendance,
        handleMarkAllAttendance,
        handleAddParticipant,
        handleRemoveParticipant
    };
}
