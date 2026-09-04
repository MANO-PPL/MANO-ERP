import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    Pencil,
    X,
    Printer,
    Plus,
    Trash2,
    Calendar,
    Clock,
    MapPin,
    Users,
    ListOrdered,
    FileCheck2,
    UserPlus,
    ChevronDown,
    Check,
    UserCheck,
    UserX,
    Loader2
} from 'lucide-react';
import { generalDocsApi } from '../../../../services/generalDocsApi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MeetingDetail = ({ onBack, setExtraBreadcrumbs, meetingId: id, canWrite }) => {
    const { id: projectId } = useParams();
    const isNew = id === 'new';

    const [isEditing, setIsEditing] = useState(isNew);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [projectName, setProjectName] = useState('');

    // Meeting Header Details State
    const [details, setDetails] = useState({
        subject: '',
        meetingNo: '',
        venue: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:30 AM'
    });

    // Participants & Directory with Attendance status
    const [participants, setParticipants] = useState([]);
    const [directoryContacts, setDirectoryContacts] = useState([]);
    const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
    const [participantSearch, setParticipantSearch] = useState('');

    // Part 1: Agenda Points (Sr. No + Point only)
    const [agendaPoints, setAgendaPoints] = useState([
        { id: 'ag-1', sl_no: 1, point: '' }
    ]);

    // Part 2: MoM Points (Sr. No + Point only)
    const [momPoints, setMomPoints] = useState([
        { id: 'mom-1', sl_no: 1, point: '' }
    ]);

    useEffect(() => {
        if (setExtraBreadcrumbs) {
            setExtraBreadcrumbs([
                { label: 'Project Meetings', onClick: onBack },
                { label: isNew ? 'New Meeting' : details.subject || 'Meeting Details' }
            ]);
        }
    }, [onBack, setExtraBreadcrumbs, isNew, details.subject]);

    useEffect(() => {
        fetchDirectory();
        if (!isNew) {
            loadMeetingData();
        }
    }, [projectId, id]);

    const fetchDirectory = async () => {
        try {
            const res = await generalDocsApi.getDirectory(projectId);
            if (res && res.directory) {
                setDirectoryContacts(res.directory);
            }
        } catch (err) {
            console.error('Failed to load project directory:', err);
        }
    };

    const loadMeetingData = async () => {
        try {
            setLoading(true);
            const res = await generalDocsApi.getMeeting(projectId, id);
            const m = res.meeting || {};

            setProjectName(m.project_name || '');

            const contentObj = m.content || {};
            const attendanceMap = contentObj.attendance || {};

            setDetails({
                subject: m.subject || '',
                meetingNo: m.meeting_no || '',
                venue: m.venue || '',
                date: m.date ? m.date.split('T')[0] : '',
                time: m.time || contentObj.time || ''
            });

            if (m.participants && Array.isArray(m.participants)) {
                setParticipants(
                    m.participants.map(p => ({
                        ...p,
                        attended: attendanceMap[p.pd_id] !== 'absent',
                        attendance: attendanceMap[p.pd_id] || 'present'
                    }))
                );
            }

            // Load Part 1: Agenda Points
            const rawAgenda = m.agenda_points || contentObj.agenda_points;
            if (Array.isArray(rawAgenda) && rawAgenda.length > 0) {
                setAgendaPoints(
                    rawAgenda.map((p, i) => ({
                        id: `ag-${i}-${Date.now()}`,
                        sl_no: p.sl_no || i + 1,
                        point: typeof p === 'string' ? p : (p.point || p.topic || p.description || '')
                    }))
                );
            } else if (Array.isArray(contentObj.points) && contentObj.points.length > 0) {
                // Fallback from legacy points
                setAgendaPoints(
                    contentObj.points.map((p, i) => ({
                        id: `ag-${i}-${Date.now()}`,
                        sl_no: p.sl_no || i + 1,
                        point: p.point || p.topic || p.description || ''
                    }))
                );
            }

            // Load Part 2: MoM Points
            const rawMom = m.mom_points || contentObj.mom_points;
            if (Array.isArray(rawMom) && rawMom.length > 0) {
                setMomPoints(
                    rawMom.map((p, i) => ({
                        id: `mom-${i}-${Date.now()}`,
                        sl_no: p.sl_no || i + 1,
                        point: typeof p === 'string' ? p : (p.point || p.discussion || p.decision || '')
                    }))
                );
            }
        } catch (err) {
            console.error('Failed to load meeting:', err);
            toast.error('Failed to load meeting details');
        } finally {
            setLoading(false);
        }
    };

    // Toggle Attendance for a participant (Present / Absent)
    const handleToggleAttendance = (pdId) => {
        if (!isEditing) return;
        setParticipants(prev =>
            prev.map(p => {
                if (p.pd_id !== pdId) return p;
                const newAttended = !p.attended;
                return {
                    ...p,
                    attended: newAttended,
                    attendance: newAttended ? 'present' : 'absent'
                };
            })
        );
    };

    // Add / Remove Participants
    const handleAddParticipant = (dirPerson) => {
        if (participants.some(p => p.pd_id === dirPerson.id)) {
            toast.info('Person already added to participants');
            return;
        }

        // Initially absent in creation mode
        const initialAttended = isNew ? false : true;

        setParticipants(prev => [
            ...prev,
            {
                pd_id: dirPerson.id,
                contact_person: dirPerson.contact_person,
                designation: dirPerson.designation,
                responsibilities: dirPerson.responsibilities,
                company_name: dirPerson.company_name || dirPerson.organization || '',
                category: dirPerson.category || '',
                attended: initialAttended,
                attendance: initialAttended ? 'present' : 'absent'
            }
        ]);
        setIsAddParticipantOpen(false);
        setParticipantSearch('');
    };

    const handleRemoveParticipant = (pdId) => {
        setParticipants(prev => prev.filter(p => p.pd_id !== pdId));
    };

    // ── Part 1: Agenda Points Handlers ──
    const handleAddAgendaPoint = () => {
        setAgendaPoints(prev => [
            ...prev,
            { id: `ag-${Date.now()}`, sl_no: prev.length + 1, point: '' }
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
        setAgendaPoints(prev =>
            prev.map(p => (p.id === pointId ? { ...p, point: val } : p))
        );
    };

    // ── Part 2: MoM Points Handlers ──
    const handleAddMomPoint = () => {
        setMomPoints(prev => [
            ...prev,
            { id: `mom-${Date.now()}`, sl_no: prev.length + 1, point: '' }
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
        setMomPoints(prev =>
            prev.map(p => (p.id === pointId ? { ...p, point: val } : p))
        );
    };

    // Save Meeting
    const handleSave = async () => {
        if (!details.subject.trim()) {
            toast.error('Please enter a meeting subject');
            return;
        }

        setSaving(true);
        try {
            const attendanceMap = {};
            participants.forEach(p => {
                attendanceMap[p.pd_id] = p.attended ? 'present' : 'absent';
            });

            // Filter out empty rows if user didn't type anything
            const filteredAgenda = agendaPoints
                .filter(p => p.point && p.point.trim())
                .map((p, i) => ({ sl_no: i + 1, point: p.point.trim() }));

            const filteredMom = momPoints
                .filter(p => p.point && p.point.trim())
                .map((p, i) => ({ sl_no: i + 1, point: p.point.trim() }));

            const payload = {
                subject: details.subject.trim(),
                meeting_no: details.meetingNo ? parseInt(details.meetingNo, 10) : undefined,
                venue: details.venue.trim(),
                date: details.date,
                time: details.time,
                participants: participants.map(p => ({
                    pd_id: p.pd_id,
                    attended: p.attended
                })),
                agenda_points: filteredAgenda,
                mom_points: filteredMom,
                content: {
                    time: details.time,
                    attendance: attendanceMap,
                    agenda_points: filteredAgenda,
                    mom_points: filteredMom
                }
            };

            if (isNew) {
                await generalDocsApi.createMeeting(projectId, payload);
                toast.success('Meeting created successfully');
                onBack();
            } else {
                await generalDocsApi.updateMeeting(projectId, id, payload);
                toast.success('Meeting saved successfully');
                setIsEditing(false);
                loadMeetingData();
            }
        } catch (err) {
            console.error('Failed to save meeting:', err);
            toast.error(err.response?.data?.message || err.message || 'Failed to save meeting');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        if (isNew) {
            onBack();
        } else {
            setIsEditing(false);
            loadMeetingData();
        }
    };

    const [exportingPdf, setExportingPdf] = useState(false);

    // Export / Print to PDF
    const handleGeneratePDF = async () => {
        const element = document.getElementById('meeting-document-card');
        if (!element) {
            window.print();
            return;
        }

        try {
            setExportingPdf(true);
            toast.info('Generating PDF...');

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 1200,
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.classList.remove('dark');
                    const el = clonedDoc.getElementById('meeting-document-card');
                    if (el) {
                        el.classList.remove('dark');
                        el.style.backgroundColor = '#ffffff';
                        el.style.color = '#111827';
                        el.style.boxShadow = 'none';
                        el.style.borderRadius = '0';
                        el.style.border = 'none';
                    }
                }
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210; // A4 width mm
            const pageHeight = 297; // A4 height mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const cleanSubject = (details.subject || 'Meeting').replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `Meeting_${details.meetingNo || 'Record'}_${cleanSubject}.pdf`;
            pdf.save(fileName);
            toast.success('PDF generated and downloaded!');
        } catch (err) {
            console.error('Error generating PDF:', err);
            toast.error('Failed to export PDF, opening browser print...');
            window.print();
        } finally {
            setExportingPdf(false);
        }
    };

    const availableDirectoryToAdd = useMemo(() => {
        const addedIds = new Set(participants.map(p => p.pd_id));
        return directoryContacts.filter(d => {
            if (addedIds.has(d.id)) return false;
            const term = participantSearch.toLowerCase();
            return (
                (d.contact_person || '').toLowerCase().includes(term) ||
                (d.company_name || '').toLowerCase().includes(term) ||
                (d.designation || '').toLowerCase().includes(term)
            );
        });
    }, [directoryContacts, participants, participantSearch]);

    const formattedDate = useMemo(() => {
        if (!details.date) return '-';
        try {
            return new Date(details.date).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        } catch {
            return details.date;
        }
    }, [details.date]);

    // Attendance stats
    const attendanceStats = useMemo(() => {
        const total = participants.length;
        const present = participants.filter(p => p.attended).length;
        const absent = total - present;
        return { total, present, absent };
    }, [participants]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 bg-white dark:bg-[#0d1117]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Loading meeting...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#f8fafc] dark:bg-[#090d13] font-sans text-gray-900 dark:text-gray-100 transition-colors overflow-hidden">
            {/* ══════════ TOP ACTION BAR (Hidden in print) ══════════ */}
            <div className="print:hidden flex items-center justify-between px-6 py-3.5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#12171f] z-20 shadow-2xs">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition-all active:scale-95 cursor-pointer"
                        title="Back to Meetings"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                {isNew ? 'New Meeting' : isEditing ? 'Edit Meeting' : 'Meeting Details'}
                            </span>
                            {!isNew && details.meetingNo && (
                                <span className="px-1.5 py-0.2 text-[10px] font-black rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                    #{details.meetingNo}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Print / PDF Button */}
                    {!isEditing && (
                        <button
                            type="button"
                            disabled={exportingPdf}
                            onClick={handleGeneratePDF}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                            title="Generate and download PDF document"
                        >
                            {exportingPdf ? (
                                <>
                                    <Loader2 size={14} className="animate-spin text-blue-500" />
                                    <span>Generating PDF...</span>
                                </>
                            ) : (
                                <>
                                    <Printer size={14} />
                                    <span>Print / PDF</span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Edit / Save Buttons */}
                    {canWrite && (
                        <>
                            {isEditing ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                    >
                                        <X size={14} />
                                        <span>Cancel</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={handleSave}
                                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-bold text-xs transition-all shadow-sm cursor-pointer"
                                    >
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                        <span>{isNew ? 'Create Meeting' : 'Save Changes'}</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-1.5 rounded-lg font-bold text-xs transition-all shadow-sm cursor-pointer"
                                >
                                    <Pencil size={13} />
                                    <span>Edit Meeting</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ══════════ MAIN 1-PAGE DOCUMENT ══════════ */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div id="meeting-document-card" className="max-w-4xl mx-auto bg-white dark:bg-[#12171f] border border-gray-200/90 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0 space-y-0">

                    {/* ── Document Header ── */}
                    <div className="p-6 md:p-8 bg-gradient-to-b from-gray-50/80 to-white dark:from-[#161c26] dark:to-[#12171f] border-b border-gray-200 dark:border-white/10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/70 dark:border-white/10 pb-5">
                            <div>
                                <span className="text-[11px] font-black tracking-widest text-blue-600 dark:text-blue-400 uppercase">
                                    {projectName ? projectName.toUpperCase() : 'MANO PROJECT MANAGEMENT'}
                                </span>
                                <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-0.5 uppercase">
                                    Project Meeting
                                </h1>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200/80 dark:border-blue-800/60 rounded-xl text-center">
                                    <span className="block text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                                        Meeting No
                                    </span>
                                    <span className="text-base font-black text-blue-700 dark:text-blue-300">
                                        #{details.meetingNo || 'AUTO'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Subject */}
                        <div className="mt-5">
                            {isEditing ? (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                        Meeting Subject <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Weekly Site Coordination Review"
                                        value={details.subject}
                                        onChange={e => setDetails({ ...details, subject: e.target.value })}
                                        className="w-full text-base font-bold px-3.5 py-2 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Subject
                                    </span>
                                    <h2 className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-white mt-0.5 leading-snug">
                                        {details.subject || 'Untitled Meeting'}
                                    </h2>
                                </div>
                            )}
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                            {/* Date */}
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5">
                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    <Calendar size={11} className="text-blue-500" />
                                    <span>Date</span>
                                </span>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={details.date}
                                        onChange={e => setDetails({ ...details, date: e.target.value })}
                                        className="w-full mt-1 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
                                    />
                                ) : (
                                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-1">
                                        {formattedDate}
                                    </p>
                                )}
                            </div>

                            {/* Time */}
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5">
                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    <Clock size={11} className="text-blue-500" />
                                    <span>Time</span>
                                </span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        placeholder="10:30 AM"
                                        value={details.time}
                                        onChange={e => setDetails({ ...details, time: e.target.value })}
                                        className="w-full mt-1 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
                                    />
                                ) : (
                                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-1">
                                        {details.time || '-'}
                                    </p>
                                )}
                            </div>

                            {/* Venue */}
                            <div className="col-span-2 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5">
                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    <MapPin size={11} className="text-blue-500" />
                                    <span>Venue / Location</span>
                                </span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        placeholder="Site Conference Room / Microsoft Teams"
                                        value={details.venue}
                                        onChange={e => setDetails({ ...details, venue: e.target.value })}
                                        className="w-full mt-1 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs font-bold text-gray-900 dark:text-white focus:outline-none"
                                    />
                                ) : (
                                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-1 truncate">
                                        {details.venue || '-'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Section: Attendees & Attendance ── */}
                    <div className="p-6 md:p-8 border-b border-gray-200 dark:border-white/10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-blue-500" />
                                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                        Participants & Attendance ({participants.length})
                                    </h3>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    {attendanceStats.total > 0 ? (
                                        <span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{attendanceStats.present} Attended</span> •{' '}
                                            <span className="text-gray-400 font-medium">{attendanceStats.absent} Absent</span> (Total: {attendanceStats.total})
                                        </span>
                                    ) : (
                                        'No participants added yet.'
                                    )}
                                </p>
                            </div>

                            {isEditing && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddParticipantOpen(!isAddParticipantOpen)}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                    >
                                        <UserPlus size={12} />
                                        <span>Add Participant</span>
                                        <ChevronDown size={11} />
                                    </button>

                                    {isAddParticipantOpen && (
                                        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 p-2 space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Search project directory..."
                                                value={participantSearch}
                                                onChange={e => setParticipantSearch(e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />

                                            <div className="max-h-52 overflow-y-auto space-y-1">
                                                {availableDirectoryToAdd.length === 0 ? (
                                                    <p className="text-center text-[11px] text-gray-400 py-3">
                                                        No available contacts found.
                                                    </p>
                                                ) : (
                                                    availableDirectoryToAdd.map(d => (
                                                        <button
                                                            key={d.id}
                                                            type="button"
                                                            onClick={() => handleAddParticipant(d)}
                                                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex flex-col cursor-pointer"
                                                        >
                                                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                                {d.contact_person || 'Unnamed'}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                                {d.company_name || 'No Company'} • {d.designation || 'No Role'}
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {participants.length === 0 ? (
                            <p className="text-xs text-gray-400 py-4 italic text-center border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                                No participants added. Click "+ Add Participant" to select members.
                            </p>
                        ) : (
                            <div className="border border-gray-200/80 dark:border-white/10 rounded-xl overflow-hidden shadow-2xs">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200/80 dark:border-white/10 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                        <tr>
                                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                                            <th className="py-2.5 px-3">Contact Person</th>
                                            <th className="py-2.5 px-3">Designation</th>
                                            <th className="py-2.5 px-3">Organization</th>
                                            <th className="py-2.5 px-3 text-center w-28">Attendance</th>
                                            {isEditing && <th className="py-2.5 px-3 text-right w-12">Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
                                        {participants.map((p, idx) => (
                                            <tr key={p.pd_id || idx} className="hover:bg-gray-50/40 dark:hover:bg-white/[0.01]">
                                                <td className="py-2.5 px-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                                                <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-white">
                                                    {p.contact_person || '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                    {p.designation || '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                                                    {p.company_name || p.organization || '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    {isEditing ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleAttendance(p.pd_id)}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${p.attended
                                                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                                                                : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10'
                                                                }`}
                                                            title="Click to toggle"
                                                        >
                                                            {p.attended ? (
                                                                <>
                                                                    <UserCheck size={12} />
                                                                    <span>Attended</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <UserX size={12} />
                                                                    <span>Absent</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        p.attended ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                                                <Check size={11} strokeWidth={3} />
                                                                <span>Attended</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gray-100 dark:bg-white/5 text-gray-400 border border-gray-200 dark:border-white/10">
                                                                <span>Absent</span>
                                                            </span>
                                                        )
                                                    )}
                                                </td>
                                                {isEditing && (
                                                    <td className="py-2.5 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveParticipant(p.pd_id)}
                                                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                                                            title="Remove"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ════════════════════════════════════════════════════════════════
                        POINTS SECTION (2 PARTS ON 1 PAGE: 1. AGENDA, 2. MOM)
                        Simple: Sr. No & Point Only! No status!
                       ════════════════════════════════════════════════════════════════ */}

                    {/* ── PART 1: AGENDA POINTS ── */}
                    <div className="p-6 md:p-8 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#12171f]">
                        <div className="flex items-center justify-between mb-3.5">
                            <div className="flex items-center gap-2">
                                <ListOrdered size={16} className="text-blue-500" />
                                <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                    1. Agenda Points
                                </h3>
                            </div>

                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={handleAddAgendaPoint}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                >
                                    <Plus size={13} />
                                    <span>Add Agenda Point</span>
                                </button>
                            )}
                        </div>

                        {/* Agenda Table */}
                        <div className="border border-gray-200/90 dark:border-white/10 rounded-xl overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/10 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="py-2.5 px-3 w-14 text-center">Sr. No</th>
                                        <th className="py-2.5 px-4">Agenda Points</th>
                                        {isEditing && <th className="py-2.5 px-3 w-12 text-right">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
                                    {agendaPoints.length === 0 ? (
                                        <tr>
                                            <td colSpan={isEditing ? 3 : 2} className="py-4 text-center text-gray-400 italic">
                                                No agenda points added.
                                            </td>
                                        </tr>
                                    ) : (
                                        agendaPoints.map((ag) => (
                                            <tr key={ag.id} className="hover:bg-gray-50/40 dark:hover:bg-white/[0.01]">
                                                <td className="py-2.5 px-3 text-center text-gray-400 font-bold">
                                                    {ag.sl_no}
                                                </td>
                                                <td className="py-2.5 px-4 text-gray-900 dark:text-white font-medium">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            placeholder={`Enter agenda point #${ag.sl_no}...`}
                                                            value={ag.point}
                                                            onChange={(e) => handleAgendaPointChange(ag.id, e.target.value)}
                                                            className="w-full px-3 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    ) : (
                                                        <span className="leading-relaxed">
                                                            {ag.point || <span className="text-gray-400 italic">No text</span>}
                                                        </span>
                                                    )}
                                                </td>
                                                {isEditing && (
                                                    <td className="py-2.5 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveAgendaPoint(ag.id)}
                                                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                                                            title="Delete Agenda Point"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── PART 2: MOM (MINUTES OF MEETING) POINTS (Directly Below Agenda) ── */}
                    <div className="p-6 md:p-8 bg-gray-50/30 dark:bg-[#0e131a]/40">
                        <div className="flex items-center justify-between mb-3.5">
                            <div className="flex items-center gap-2">
                                <FileCheck2 size={16} className="text-emerald-500" />
                                <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                    2. Minutes of Meeting Points
                                </h3>
                            </div>

                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={handleAddMomPoint}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                >
                                    <Plus size={13} />
                                    <span>Add MoM Point</span>
                                </button>
                            )}
                        </div>

                        {/* MoM Table */}
                        <div className="border border-gray-200/90 dark:border-white/10 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-[#12171f]">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/10 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="py-2.5 px-3 w-14 text-center">Sr. No</th>
                                        <th className="py-2.5 px-4">Minutes of Meeting (MoM) Points</th>
                                        {isEditing && <th className="py-2.5 px-3 w-12 text-right">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium">
                                    {momPoints.length === 0 ? (
                                        <tr>
                                            <td colSpan={isEditing ? 3 : 2} className="py-4 text-center text-gray-400 italic">
                                                No MoM points added.
                                            </td>
                                        </tr>
                                    ) : (
                                        momPoints.map((mom) => (
                                            <tr key={mom.id} className="hover:bg-gray-50/40 dark:hover:bg-white/[0.01]">
                                                <td className="py-2.5 px-3 text-center text-gray-400 font-bold">
                                                    {mom.sl_no}
                                                </td>
                                                <td className="py-2.5 px-4 text-gray-900 dark:text-white font-medium">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            placeholder={`Enter MoM point #${mom.sl_no}...`}
                                                            value={mom.point}
                                                            onChange={(e) => handleMomPointChange(mom.id, e.target.value)}
                                                            className="w-full px-3 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    ) : (
                                                        <span className="leading-relaxed">
                                                            {mom.point || <span className="text-gray-400 italic">No text</span>}
                                                        </span>
                                                    )}
                                                </td>
                                                {isEditing && (
                                                    <td className="py-2.5 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveMomPoint(mom.id)}
                                                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                                                            title="Delete MoM Point"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MeetingDetail;
