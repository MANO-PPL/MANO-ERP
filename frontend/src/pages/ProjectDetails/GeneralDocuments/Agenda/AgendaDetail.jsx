import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Plus, Trash2, ChevronRight, Pencil, Save, ArrowLeft, Search, ChevronDown } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { generalDocsApi } from '../../../../services/generalDocsApi';

// --- Vendor Selector Dropdown ---
const VendorSelector = ({ value, onChange, globalVendors }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.portal-dropdown')) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleToggle = () => {
        if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: Math.max(rect.width, 280) });
        }
        setOpen(!open);
    };

    const filtered = globalVendors.filter(v =>
        v.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        v.job_nature?.toLowerCase().includes(search.toLowerCase()) ||
        v.contact_person?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} className="relative min-w-[160px]">
            <button
                type="button"
                onClick={handleToggle}
                className="flex items-center justify-between w-full px-2 py-1 bg-transparent border border-blue-500/40 hover:border-blue-500 rounded text-xs outline-none dark:text-white transition-all min-h-[26px] gap-2"
            >
                <span className="truncate max-w-[160px] text-left">{value || <span className="text-gray-400">Select vendor…</span>}</span>
                <ChevronDown size={12} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && createPortal(
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="portal-dropdown fixed bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col"
                    style={{ 
                        top: coords.top - window.scrollY, 
                        left: coords.left - window.scrollX, 
                        width: coords.width,
                        maxHeight: '300px'
                    }}
                >
                    <div className="p-2 border-b border-gray-100 dark:border-white/5">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search vendors…"
                                className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 transition-all dark:text-white"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        {filtered.length > 0 ? filtered.map(v => (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => { onChange(v); setOpen(false); setSearch(''); }}
                                className="w-full px-3 py-2.5 flex flex-col items-start hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-50 dark:border-white/5 text-left group transition-colors"
                            >
                                <span className="text-xs font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase tracking-tight">{v.company_name}</span>
                                {v.contact_person && <span className="text-[10px] text-gray-400 mt-0.5 font-medium">{v.contact_person}{v.job_nature ? ` — ${v.job_nature}` : ''}</span>}
                            </button>
                        )) : (
                            <div className="px-3 py-6 text-center text-xs text-gray-400">No vendors found</div>
                        )}
                    </div>
                </motion.div>,
                document.body
            )}
        </div>
    );
};

// --- Reusable Input Components ---

// --- Reusable Input Components ---
const ResizableInput = ({ value, onChange, placeholder = "", className = "", minW = "50px" }) => (
    <div className="inline-grid w-fit max-w-full items-center align-middle relative">
        <span className={`invisible col-start-1 row-start-1 whitespace-pre pointer-events-none min-h-[26px] flex items-center ${className}`} style={{ minWidth: minW }}>
            {value || placeholder || ' '}
        </span>
        <input
            className={`absolute inset-0 w-full h-full bg-transparent border-0 outline-none text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500/50 rounded transition-all ${className}`}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
        />
    </div>
);

const ResizableTextarea = ({ value, onChange, placeholder = "", className = "" }) => (
    <div className="grid w-full items-start align-top relative min-w-0 flex-1">
        {/* Invisible span for auto-height, perfectly matching textarea padding/font/line-height */}
        <div
            className={`invisible col-start-1 row-start-1 whitespace-pre-wrap break-words min-h-[40px] px-1 py-1 w-full ${className}`}
        >
            {value || placeholder || ' '}
            {/* Adding an extra line break ensures empty lines at the end render correctly for sizing */}
            {value && value.endsWith('\n') ? <br /> : null}
        </div>
        <textarea
            className={`col-start-1 row-start-1 w-full h-full resize-none overflow-hidden bg-transparent border-0 outline-none text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500/50 rounded px-1 py-1 transition-all ${className}`}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            style={{ margin: 0 }}
        />
    </div>
);


const AgendaDetail = ({ onBack, setExtraBreadcrumbs, agendaId: id, canWrite }) => {
    const { id: projectId } = useParams();
    const [isEditing, setIsEditing] = useState(id === 'new' && canWrite);

    // Form State
    const [details, setDetails] = useState({
        subject: '',
        meetingNo: '',
        venue: '',
        date: ''
    });

    const [participants, setParticipants] = useState([]);
    const [points, setPoints] = useState([]);
    const [directoryContacts, setDirectoryContacts] = useState([]);

    // Live Load Data
    useEffect(() => {
        const loadAgenda = async () => {
            if (id && id !== 'new') {
                try {
                    const data = await generalDocsApi.getAgenda(projectId, id);
                    const agenda = data.agenda || {};
                    setDetails({
                        subject: agenda.subject || '',
                        meetingNo: agenda.meeting_no || agenda.meetingNo || '',
                        venue: agenda.venue || '',
                        date: agenda.date ? agenda.date.split('T')[0] : ''
                    });
                    
                    let loadedParticipants = [];
                    let loadedPoints = [];
                    if (agenda.content) {
                        try {
                            const parsed = typeof agenda.content === 'string' ? JSON.parse(agenda.content) : agenda.content;
                            if (Array.isArray(parsed)) {
                                // New format: content is a flat array of { no, description, remarks }
                                loadedPoints = parsed.map(p => ({
                                    id: Math.random(),
                                    slNo: p.no || '',
                                    description: p.description || '',
                                    remarks: p.remarks || ''
                                }));
                            } else if (parsed.points && Array.isArray(parsed.points)) {
                                // Legacy format: { points: [...], participants: [...] }
                                loadedPoints = parsed.points.map((p, index) => {
                                    if (typeof p === 'string') {
                                        return { id: Math.random(), slNo: `${index + 1}`, description: p, remarks: '' };
                                    }
                                    return { 
                                        id: Math.random(), 
                                        slNo: p.slNo || p.no || `${index + 1}`, 
                                        description: p.description || '', 
                                        remarks: p.remarks || '' 
                                    };
                                });
                                if (parsed.participants) loadedParticipants = parsed.participants;
                            }
                        } catch (e) { console.error('Parse error', e); }
                    }
                    
                    if (loadedPoints.length > 0) {
                        setPoints(loadedPoints);
                    } else if (id !== 'new') {
                        setPoints([]);
                    }
                    
                    if (loadedParticipants.length === 0 && agenda.participants && agenda.participants.length > 0) {
                        loadedParticipants = agenda.participants.map(p => ({
                            id: p.pap_id || p.id || Math.random(),
                            pd_id: p.pd_id,
                            organization: p.company_name || p.organization || '',
                            responsibility: p.responsibilities || p.responsibility || '',
                            representatives: p.contact_person || p.representatives || ''
                        }));
                    }
                    
                    if (loadedParticipants.length > 0) {
                        setParticipants(loadedParticipants);
                    } else if (id !== 'new') {
                        setParticipants([]); // ensure empty array instead of random old state
                    }
                } catch(err) {
                    console.error("Failed to load agenda", err);
                }
            } else if (id === 'new') {
                // Initialize defaults for a new agenda
                setParticipants([
                    { id: Date.now() + 1, organization: '', responsibility: '', representatives: '' }
                ]);
                setPoints([
                    { id: Date.now() + 2, slNo: '1', description: '', remarks: '' }
                ]);
            }
        };
        loadAgenda();
        // Load project directory for participant selection
        generalDocsApi.getDirectory(projectId).then(d => { if (d?.directory) setDirectoryContacts(d.directory); }).catch(() => {});
    }, [id, projectId]);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'General Documents', onClick: onBack },
            { label: 'Agenda of Meeting', onClick: onBack },
            { label: id === 'new' ? 'New Agenda' : details.subject || 'Edit Agenda' }
        ]);
    }, [onBack, setExtraBreadcrumbs, id, details.subject, isEditing]);

    const handleSave = async () => {
        try {
            const payload = {
                subject: details.subject || 'Untitled',
                meeting_no: details.meetingNo || '-',
                venue: details.venue || '-',
                date: details.date || new Date().toISOString().split('T')[0],
                participants: participants.filter(p => p.pd_id).map(p => p.pd_id),
                content: points.map(pt => ({
                    no: pt.slNo,
                    description: pt.description || '',
                    remarks: pt.remarks || ''
                }))
            };

            if (id === 'new') {
                await generalDocsApi.createAgenda(projectId, payload);
                onBack();
            } else {
                await generalDocsApi.updateAgenda(projectId, id, payload);
                setIsEditing(false);
            }
        } catch(err) {
            alert('Failed to save agenda. Please check console for details.');
            console.error(err);
        }
    };

    // --- Participants Actions ---
    const addParticipant = () => {
        setParticipants([...participants, { id: Date.now(), pd_id: null, organization: '', responsibility: '', representatives: '' }]);
    };

    const handleParticipantSelect = (pid, directoryEntry) => {
        setParticipants(participants.map(p => p.id === pid ? {
            ...p,
            pd_id: directoryEntry.pd_id,
            organization: directoryEntry.company_name || '',
            responsibility: directoryEntry.responsibilities || '',
            representatives: directoryEntry.contact_person || ''
        } : p));
    };

    const removeParticipant = (pid) => {
        setParticipants(participants.filter(p => p.id !== pid));
    };

    const updateParticipant = (pid, field, value) => {
        setParticipants(participants.map(p => p.id === pid ? { ...p, [field]: value } : p));
    };

    // --- Points Actions ---
    const addPoint = () => {
        setPoints([...points, { id: Date.now(), slNo: (points.length + 1).toString(), description: '', remarks: '' }]);
    };

    const addSubPoint = (index, parentSlNo) => {
        // Find existing subpoints for this parent to determine the next number
        const prefix = parentSlNo + '.';
        const subPoints = points.filter(p => p.slNo.startsWith(prefix));

        // Find highest existing subpoint number, default to 0 so next is .1
        const highestSub = subPoints.reduce((max, p) => {
            const suffix = p.slNo.split('.').pop();
            const num = parseInt(suffix);
            return (!isNaN(num) && num > max) ? num : max;
        }, 0);

        const newSlNo = `${parentSlNo}.${highestSub + 1}`;
        const newPoint = { id: Date.now(), slNo: newSlNo, description: '', remarks: '' };

        // Insert immediately after the parent or its existing subpoints
        const newPoints = [...points];
        // Insert at index + 1 + length of existing subpoints to keep them grouped visually
        newPoints.splice(index + subPoints.length + 1, 0, newPoint);
        setPoints(newPoints);
    };

    const removePoint = (pid) => {
        setPoints(points.filter(p => p.id !== pid));
    };

    const updatePoint = (pid, field, value) => {
        setPoints(points.map(p => p.id === pid ? { ...p, [field]: value } : p));
    };

    return (
        <div className="flex-1 flex flex-col bg-[#fafafa] dark:bg-[#0d1117] font-sans text-gray-900 dark:text-gray-700 dark:text-gray-300 transition-colors overflow-hidden">
            {/* Top Bar */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] sticky top-0 z-10 w-full">
                <button
                    onClick={isEditing && id !== 'new' ? () => setIsEditing(false) : onBack}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors text-sm font-medium px-2 py-1.5"
                >
                    {isEditing && id !== 'new' ? <X size={16} /> : <ArrowLeft size={16} />}
                    <span>{isEditing && id !== 'new' ? 'Cancel' : 'Back'}</span>
                </button>
                <div className="flex items-center space-x-3">
                    {!isEditing ? (
                        canWrite && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md font-medium text-sm transition-colors shadow-sm"
                            >
                                <Pencil size={16} />
                                <span>Edit Agenda</span>
                            </button>
                        )
                    ) : (
                        <button
                            onClick={handleSave}
                            className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-md font-medium text-sm transition-colors shadow-sm"
                        >
                            <Save size={16} />
                            <span>{id === 'new' ? 'Save Agenda' : 'Save Changes'}</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="w-full space-y-6">

                    {/* Section 1: Edit Details */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg flex flex-col shadow-sm">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10 rounded-t-lg">
                            <h2 className="text-gray-900 dark:text-white font-bold text-[15px]">{isEditing ? 'Edit Details' : 'Agenda Details'}</h2>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            {/* Subject */}
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs text-gray-500 font-medium tracking-wide">Subject</label>
                                <div className={`border rounded-md p-1 transition-all ${isEditing ? 'bg-white dark:bg-[#1c222b] border-gray-200 dark:border-gray-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20' : 'border-transparent'}`}>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white px-2 py-1 text-sm placeholder-gray-400 dark:placeholder-gray-600"
                                            value={details.subject}
                                            onChange={(e) => setDetails({ ...details, subject: e.target.value })}
                                            placeholder="Enter subject..."
                                        />
                                    ) : (
                                        <div className="text-gray-900 dark:text-white px-2 py-1 text-sm font-semibold">{details.subject || '-'}</div>
                                    )}
                                </div>
                            </div>
                            {/* Meeting No */}
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs text-gray-500 font-medium tracking-wide">Meeting No</label>
                                <div className={`border rounded-md p-1 transition-all ${isEditing ? 'bg-white dark:bg-[#1c222b] border-gray-200 dark:border-gray-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20' : 'border-transparent'}`}>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white px-2 py-1 text-sm placeholder-gray-400 dark:placeholder-gray-600"
                                            value={details.meetingNo}
                                            onChange={(e) => setDetails({ ...details, meetingNo: e.target.value })}
                                        />
                                    ) : (
                                        <div className="text-gray-900 dark:text-white px-2 py-1 text-sm">{details.meetingNo || '-'}</div>
                                    )}
                                </div>
                            </div>
                            {/* Venue */}
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs text-gray-500 font-medium tracking-wide">Venue</label>
                                <div className={`border rounded-md p-1 transition-all ${isEditing ? 'bg-white dark:bg-[#1c222b] border-gray-200 dark:border-gray-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20' : 'border-transparent'}`}>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white px-2 py-1 text-sm placeholder-gray-400 dark:placeholder-gray-600"
                                            value={details.venue}
                                            onChange={(e) => setDetails({ ...details, venue: e.target.value })}
                                        />
                                    ) : (
                                        <div className="text-gray-900 dark:text-white px-2 py-1 text-sm">{details.venue || '-'}</div>
                                    )}
                                </div>
                            </div>
                            {/* Date */}
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs text-gray-500 font-medium tracking-wide">Date</label>
                                <div className={`border rounded-md p-1 transition-all ${isEditing ? 'bg-white dark:bg-[#1c222b] border-gray-200 dark:border-gray-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 pr-2' : 'border-transparent'}`}>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white px-2 py-1 text-sm placeholder-gray-400 dark:placeholder-gray-600"
                                            value={details.date}
                                            onChange={(e) => setDetails({ ...details, date: e.target.value })}
                                        />
                                    ) : (
                                        <div className="text-gray-900 dark:text-white px-2 py-1 text-sm">{details.date ? new Date(details.date).toLocaleDateString() : '-'}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Participants */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg flex flex-col shadow-sm">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161b22] rounded-t-lg">
                            <h2 className="text-gray-900 dark:text-white font-bold text-[15px]">Participants</h2>
                            {isEditing && (
                                <button
                                    onClick={addParticipant}
                                    className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded-md text-xs font-medium transition-colors"
                                >
                                    <Plus size={14} />
                                    <span>Add Participant</span>
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm table-fixed whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-white/10 text-gray-500 bg-gray-100 dark:bg-[#12161c]">
                                        <th className="px-5 py-2 w-1/3 text-xs font-medium hidden sm:table-cell">Organization</th>
                                        <th className="px-5 py-2 w-1/3 text-xs font-medium hidden sm:table-cell">Responsibility</th>
                                        <th className="px-5 py-2 w-1/3 text-xs font-medium">Representatives</th>
                                        <th className="px-2 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence>
                                        {participants.map((p) => (
                                            <motion.tr
                                                key={p.id}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="border-b border-gray-200 dark:border-white/10/50 group/row hover:bg-gray-800/10"
                                            >
                                                <td className="px-5 py-2">
                                                    {isEditing ? (
                                                        <VendorSelector
                                                            value={p.organization}
                                                            onChange={(v) => handleParticipantSelect(p.id, v)}
                                                            globalVendors={directoryContacts}
                                                        />
                                                    ) : (
                                                        <div className="font-medium text-gray-700 dark:text-gray-300 py-1">{p.organization || '-'}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-2 hidden sm:table-cell text-gray-600 dark:text-gray-400">
                                                    {isEditing ? (
                                                        <ResizableInput
                                                            value={p.responsibility}
                                                            onChange={(e) => updateParticipant(p.id, 'responsibility', e.target.value)}
                                                            className="text-gray-600 dark:text-gray-400 w-full"
                                                            minW="100%"
                                                        />
                                                    ) : (
                                                        <div className="py-1">{p.responsibility || '-'}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-2 text-gray-600 dark:text-gray-400">
                                                    {isEditing ? (
                                                        <ResizableInput
                                                            value={p.representatives}
                                                            onChange={(e) => updateParticipant(p.id, 'representatives', e.target.value)}
                                                            className="text-gray-600 dark:text-gray-400 w-full"
                                                            minW="100%"
                                                        />
                                                    ) : (
                                                        <div className="py-1">{p.representatives || '-'}</div>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 text-right">
                                                    {isEditing && (
                                                        <button
                                                            onClick={() => removeParticipant(p.id)}
                                                            className="text-red-500/70 hover:text-red-500 p-1 opacity-0 group-hover/row:opacity-100 transition-all rounded hover:bg-red-500/10"
                                                        >
                                                            <X size={15} />
                                                        </button>
                                                    )}
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 3: Points */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg flex flex-col shadow-sm">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161b22] rounded-t-lg">
                            <h2 className="text-gray-900 dark:text-white font-bold text-[15px]">Points</h2>
                            {isEditing && (
                                <button
                                    onClick={addPoint}
                                    className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                                >
                                    <Plus size={14} />
                                    <span>Add Main Point</span>
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm" style={{ tableLayout: 'fixed' }}>
                                <colgroup><col style={{ width: '60px' }} /><col style={{ width: '55%' }} /><col style={{ width: '30%' }} /><col style={{ width: '80px' }} /></colgroup>
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-white/10 text-gray-500 bg-gray-100 dark:bg-[#12161c]">
                                        <th className="px-5 py-3 text-xs font-medium text-center w-[60px]">Sl No.</th>
                                        <th className="px-5 py-3 text-xs font-medium">Description</th>
                                        <th className="px-5 py-3 text-xs font-medium hidden md:table-cell w-[30%]">Remarks</th>
                                        {isEditing && <th className="px-2 py-3 text-xs font-medium text-center w-[80px]">Actions</th>}
                                    </tr>
                                </thead>
                                <Reorder.Group axis="y" values={points} onReorder={setPoints} as="tbody">
                                    <AnimatePresence>
                                            {points.map((pt) => (
                                                <Reorder.Item
                                                    key={pt.id}
                                                    value={pt}
                                                    as="tr"
                                                    className="border-b border-gray-200 dark:border-white/10/50 group/row hover:bg-gray-800/10 align-top"
                                                >
                                                    <td className="px-5 py-4 text-center text-gray-600 dark:text-gray-400 font-medium align-top">
                                                        <div className="flex flex-col items-center justify-start space-y-1">
                                                            {isEditing && (
                                                                <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center opacity-0 group-hover/row:opacity-100 cursor-grab mb-1 transition-opacity">
                                                                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                                                                </div>
                                                            )}
                                                            {isEditing ? (
                                                                <input
                                                                    value={pt.slNo}
                                                                    onChange={(e) => updatePoint(pt.id, 'slNo', e.target.value)}
                                                                    className="w-12 bg-transparent text-center font-bold outline-none focus:bg-white dark:bg-[#1c222b] focus:ring-1 focus:ring-blue-500/50 rounded py-1 transition-colors"
                                                                />
                                                            ) : (
                                                                <div className="font-bold py-1">{pt.slNo}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 align-top">
                                                        <div className={`w-full rounded-lg p-2 transition-colors border ${isEditing ? 'group-hover/row:bg-white dark:group-hover/row:bg-[#1c222b]/50 border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:focus-within:bg-[#1c222b]' : 'border-transparent'}`}>
                                                            {isEditing ? (
                                                                <ResizableTextarea
                                                                    value={pt.description}
                                                                    onChange={(e) => updatePoint(pt.id, 'description', e.target.value)}
                                                                    className="text-gray-800 dark:text-gray-200 w-full min-h-[36px]"
                                                                    placeholder="Enter description..."
                                                                />
                                                            ) : (
                                                                <div className={`text-gray-800 dark:text-gray-200 whitespace-pre-wrap ${pt.slNo.includes('.') ? 'ml-4 text-sm' : 'font-medium'}`}>
                                                                    {pt.description || '-'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 align-top">
                                                        <div className={`w-full rounded-lg p-2 transition-colors border ${isEditing ? 'group-hover/row:bg-white dark:group-hover/row:bg-[#1c222b]/50 border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:focus-within:bg-[#1c222b]' : 'border-transparent'}`}>
                                                            {isEditing ? (
                                                                <ResizableTextarea
                                                                    value={pt.remarks}
                                                                    onChange={(e) => updatePoint(pt.id, 'remarks', e.target.value)}
                                                                    className="text-gray-600 dark:text-gray-400 w-full min-h-[36px]"
                                                                    placeholder="Add remarks..."
                                                                />
                                                            ) : (
                                                                <div className="text-gray-600 dark:text-gray-400 text-sm italic">{pt.remarks || '-'}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {isEditing && (
                                                        <td className="px-2 py-3">
                                                            <div className="flex flex-col items-center justify-center space-y-2 h-full opacity-0 group-hover/row:opacity-100 transition-opacity p-2">
                                                                <button
                                                                    onClick={() => addSubPoint(points.findIndex(p => p.id === pt.id), pt.slNo)}
                                                                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors p-1"
                                                                    title="Add Sub-point"
                                                                >
                                                                    <Plus size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => removePoint(pt.id)}
                                                                    className="text-red-500/80 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors p-1"
                                                                    title="Delete Point"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </Reorder.Item>
                                            ))}
                                    </AnimatePresence>
                                </Reorder.Group>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AgendaDetail;
