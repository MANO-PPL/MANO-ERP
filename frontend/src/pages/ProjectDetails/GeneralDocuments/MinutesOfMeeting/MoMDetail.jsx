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

// --- Status Picker Dropdown ---
const StatusPicker = ({ value, onChange, isEditing }) => {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const ref = useRef(null);

    const statuses = [
        { code: 'C', label: 'Completed', color: 'bg-green-500', text: 'text-green-500' },
        { code: 'O', label: 'Ongoing', color: 'bg-blue-500', text: 'text-blue-500' },
        { code: 'P', label: 'Pending', color: 'bg-orange-500', text: 'text-orange-500' },
        { code: 'I', label: 'In Progress', color: 'bg-purple-500', text: 'text-purple-500' },
        { code: '-', label: 'None', color: 'bg-gray-400', text: 'text-gray-400' }
    ];

    const current = statuses.find(s => s.code === value) || statuses[4];

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.portal-dropdown')) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleToggle = () => {
        if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            // Open upward
            setCoords({ top: rect.top + window.scrollY, left: rect.left + window.scrollX });
        }
        setOpen(!open);
    };

    if (!isEditing) {
        return (
            <div className={`text-xs font-bold px-2 py-0.5 rounded-full border ${current.text.replace('text-', 'border-').replace('500', '500/30')} ${current.text.replace('text-', 'bg-').replace('500', '500/5')}`}>
                {value || '-'}
            </div>
        );
    }

    return (
        <div ref={ref} className="relative inline-block">
            <button
                type="button"
                onClick={handleToggle}
                className={`w-10 h-7 flex items-center justify-center font-bold text-sm rounded-lg transition-all border ${open ? 'border-blue-500/50 bg-blue-500/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'}`}
            >
                <span className={current.text}>{value || '-'}</span>
            </button>

            {open && createPortal(
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="portal-dropdown fixed -translate-y-full mb-2 w-48 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden p-1.5"
                    style={{ 
                        top: coords.top - window.scrollY - 8, 
                        left: coords.left - window.scrollX 
                    }}
                >
                    <div className="px-2 py-1.5 mb-1 border-b border-gray-100 dark:border-white/5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Update Status</span>
                    </div>
                    {statuses.map(s => (
                        <button
                            key={s.code}
                            type="button"
                            onClick={() => { onChange(s.code); setOpen(false); }}
                            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors group"
                        >
                            <div className={`w-2.5 h-2.5 rounded-full ${s.color} shadow-sm`} />
                            <span className={`text-[11px] font-medium transition-colors ${s.text} group-hover:opacity-100 uppercase`}>{s.label}</span>
                            <span className="ml-auto text-[10px] font-black opacity-30 group-hover:opacity-100">{s.code}</span>
                        </button>
                    ))}
                </motion.div>,
                document.body
            )}
        </div>
    );
};

const StatusLegend = () => (
    <div className="flex flex-wrap items-center gap-4 py-2 px-4 bg-gray-50/50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5 mb-4 mt-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-2">S (Status) Meaning:</span>
        {[
            { c: 'C', l: 'Completed', cl: 'text-green-500' },
            { c: 'O', l: 'Ongoing', cl: 'text-blue-500' },
            { c: 'P', l: 'Pending', cl: 'text-orange-500' },
            { c: 'I', l: 'In Progress', cl: 'text-purple-500' }
        ].map(i => (
            <div key={i.c} className="flex items-center gap-1.5">
                <span className={`text-[11px] font-bold ${i.cl}`}>{i.c}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{i.l}</span>
            </div>
        ))}
    </div>
);

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


const MoMDetail = ({ onBack, setExtraBreadcrumbs, momId: id, canWrite }) => {
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
        const loadMoM = async () => {
            if (id && id !== 'new') {
                try {
                    const data = await generalDocsApi.getMom(projectId, id);
                    const mom = data.mom || {};
                    setDetails({
                        subject: mom.subject || '',
                        meetingNo: mom.meeting_no || mom.meetingNo || '',
                        venue: mom.venue || '',
                        date: mom.date ? mom.date.split('T')[0] : ''
                    });

                    let loadedParticipants = [];
                    let loadedPoints = [];
                    if (mom.content) {
                        try {
                            const parsed = typeof mom.content === 'string' ? JSON.parse(mom.content) : mom.content;
                            if (Array.isArray(parsed)) {
                                // New format: content is a flat array of { no, description, status, targetDate, actionBy }
                                loadedPoints = parsed.map(p => ({
                                    id: Math.random(),
                                    slNo: p.no || '',
                                    description: p.description || '',
                                    status: p.status || p.remarks || '',
                                    targetDate: p.targetDate || '',
                                    actionBy: p.actionBy || ''
                                }));
                            } else if (parsed.points && Array.isArray(parsed.points)) {
                                // Legacy format support
                                loadedPoints = parsed.points.map((p, index) => ({
                                    id: Math.random(),
                                    slNo: p.slNo || p.no || `${index + 1}`,
                                    description: p.description || '',
                                    status: p.status || '',
                                    targetDate: p.targetDate || '',
                                    actionBy: p.actionBy || ''
                                }));
                                if (parsed.participants) loadedParticipants = parsed.participants;
                            }
                        } catch (e) { console.error('Parse error', e); }
                    }

                    if (loadedPoints.length > 0) {
                        setPoints(loadedPoints);
                    } else if (id !== 'new') {
                        setPoints([]);
                    }

                    if (loadedParticipants.length === 0 && mom.participants && mom.participants.length > 0) {
                        loadedParticipants = mom.participants.map(p => ({
                            id: p.pmp_id || p.id || Math.random(),
                            pd_id: p.pd_id,
                            organization: p.organization || p.company_name || '',
                            responsibility: p.responsibilities || p.responsibility || '',
                            representatives: p.contact_person || p.representatives || ''
                        }));
                    }

                    if (loadedParticipants.length > 0) {
                        setParticipants(loadedParticipants);
                    } else if (id !== 'new') {
                        setParticipants([]); // ensure empty array instead of random old state
                    }
                } catch (err) {
                    console.error("Failed to load MoM", err);
                }
            } else if (id === 'new') {
                // Initialize defaults for a new MoM
                setParticipants([
                    { id: Date.now() + 1, organization: '', responsibility: '', representatives: '' }
                ]);
                setPoints([
                    { id: Date.now() + 2, slNo: '1', description: '', status: '', targetDate: '', actionBy: '' }
                ]);
            }
        };
        loadMoM();
        // Load project directory for participant selection
        generalDocsApi.getDirectory(projectId).then(d => { if (d?.directory) setDirectoryContacts(d.directory); }).catch(() => {});
    }, [id, projectId]);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'General Documents', onClick: onBack },
            { label: 'Minutes of Meeting', onClick: onBack },
            { label: id === 'new' ? 'New MoM' : details.subject || 'Edit MoM' }
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
                    status: pt.status || '',
                    targetDate: pt.targetDate || '',
                    actionBy: pt.actionBy || ''
                }))
            };

            if (id === 'new') {
                await generalDocsApi.createMom(projectId, payload);
                onBack();
            } else {
                await generalDocsApi.updateMom(projectId, id, payload);
                setIsEditing(false);
            }
        } catch (err) {
            alert('Failed to save MoM. Please check console for details.');
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
        // Find highest main integer point
        const highestMain = points.reduce((max, p) => {
            const num = parseInt(p.slNo);
            return (!isNaN(num) && !p.slNo.includes('.') && num > max) ? num : max;
        }, 0);
        const newSlNo = `${highestMain + 1}`;
        setPoints([...points, { id: Date.now(), slNo: newSlNo, description: '', status: '', targetDate: '', actionBy: '' }]);
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
        const newPoint = { id: Date.now(), slNo: newSlNo, description: '', status: '', targetDate: '', actionBy: '' };

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
                                <span>Edit MOM</span>
                            </button>
                        )
                    ) : (
                        <button
                            onClick={handleSave}
                            className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-md font-medium text-sm transition-colors shadow-sm"
                        >
                            <Save size={16} />
                            <span>{id === 'new' ? 'Save MOM' : 'Save Changes'}</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="w-full space-y-6">

                    {/* Section 1: Edit Details */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden flex flex-col shadow-sm">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10">
                            <h2 className="text-gray-900 dark:text-white font-bold text-[15px]">{isEditing ? 'Edit Details' : 'Meeting Details'}</h2>
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
                        <div className="px-5">
                            <StatusLegend />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm table-fixed min-w-[800px]">
                                <colgroup>
                                    <col className="w-[60px]" />
                                    <col className="w-auto" />
                                    <col className="w-[60px]" />
                                    <col className="w-[140px]" />
                                    <col className="w-[180px]" />
                                    {isEditing && <col className="w-[100px]" />}
                                </colgroup>
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-white/10 text-gray-500 bg-gray-100 dark:bg-[#12161c]">
                                        <th className="px-4 py-3 text-xs font-medium text-center">Sl No.</th>
                                        <th className="px-5 py-3 text-xs font-medium">Description</th>
                                        <th className="px-2 py-3 text-xs font-medium text-center">S</th>
                                        <th className="px-4 py-3 text-xs font-medium text-center">Target Date</th>
                                        <th className="px-4 py-3 text-xs font-medium">Action By</th>
                                        {isEditing && <th className="px-2 py-3 text-xs font-medium text-center">Actions</th>}
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
                                                    <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-400 font-medium align-top">
                                                        <div className="flex flex-col items-center justify-start h-full">
                                                            {isEditing && (
                                                                <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center opacity-0 group-hover/row:opacity-100 cursor-grab mb-2 transition-opacity">
                                                                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                                                                </div>
                                                            )}
                                                            {isEditing ? (
                                                                <input
                                                                    value={pt.slNo}
                                                                    onChange={(e) => updatePoint(pt.id, 'slNo', e.target.value)}
                                                                    className="w-10 bg-transparent text-center font-bold outline-none focus:bg-white dark:bg-[#1c222b] focus:ring-1 focus:ring-blue-500/50 rounded py-0.5 transition-colors text-xs"
                                                                />
                                                            ) : (
                                                                <div className="font-bold py-0.5 text-xs">{pt.slNo}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-4 align-top">
                                                        <div className={`w-full rounded-lg p-2 transition-colors border ${isEditing ? 'group-hover/row:bg-white dark:bg-[#1c222b]/30 focus-within:border-blue-500/30 focus-within:bg-white dark:bg-[#1c222b] border-transparent' : 'border-transparent'}`}>
                                                            {isEditing ? (
                                                                <ResizableTextarea
                                                                    value={pt.description}
                                                                    onChange={(e) => updatePoint(pt.id, 'description', e.target.value)}
                                                                    className="text-gray-800 dark:text-gray-200 w-full min-h-[44px] flex-1 text-sm pt-0"
                                                                    placeholder="Enter description..."
                                                                />
                                                            ) : (
                                                                <div className={`text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap ${pt.slNo.includes('.') ? 'ml-4' : 'font-medium'}`}>
                                                                    {pt.description || '-'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-4 text-center align-top">
                                                        <div className={`w-full flex justify-center items-center h-full`}>
                                                            <StatusPicker 
                                                                value={pt.status} 
                                                                onChange={(val) => updatePoint(pt.id, 'status', val)} 
                                                                isEditing={isEditing} 
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center align-top">
                                                        <div className={`w-full rounded-lg h-9 flex items-center justify-center transition-colors border relative ${isEditing ? 'group-hover/row:bg-white dark:bg-[#1c222b]/30 focus-within:border-blue-500/30 focus-within:bg-white dark:focus-within:bg-[#1c222b] border-transparent px-2' : 'border-transparent'}`}>
                                                            {isEditing ? (
                                                                <div className="relative w-full flex items-center justify-center">
                                                                    <input
                                                                        type="date"
                                                                        value={pt.targetDate}
                                                                        onChange={(e) => updatePoint(pt.id, 'targetDate', e.target.value)}
                                                                        className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                                                                    />
                                                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-[11px] pointer-events-none">
                                                                        <span>{pt.targetDate ? new Date(pt.targetDate).toLocaleDateString('en-GB') : 'Set Date'}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-gray-600 dark:text-gray-400 text-xs font-medium">{pt.targetDate ? new Date(pt.targetDate).toLocaleDateString('en-GB') : '-'}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 align-top">
                                                        <div className={`w-full rounded-lg p-2 transition-colors border ${isEditing ? 'group-hover/row:bg-white dark:bg-[#1c222b]/30 focus-within:border-blue-500/30 focus-within:bg-white dark:bg-[#1c222b] border-transparent' : 'border-transparent'}`}>
                                                            {isEditing ? (
                                                                <input
                                                                    value={pt.actionBy}
                                                                    onChange={(e) => updatePoint(pt.id, 'actionBy', e.target.value)}
                                                                    className="w-full bg-transparent text-gray-600 dark:text-gray-400 outline-none focus:ring-1 focus:ring-blue-500/50 rounded transition-all text-sm"
                                                                    placeholder="-"
                                                                />
                                                            ) : (
                                                                <div className="text-gray-600 dark:text-gray-400 text-sm">{pt.actionBy || '-'}</div>
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

                    {/* Legal notice block */}
                    <div className="bg-orange-50 dark:bg-[#1e170c] border border-orange-900/50 rounded-lg p-4 shadow-sm text-orange-800 dark:text-orange-200/90 text-sm mt-2">
                        <strong className="text-orange-500 font-bold mb-2 block text-xs">NOTE :</strong>
                        <ol className="list-decimal pl-5 space-y-1 text-xs">
                            <li>In case of any missing points or discrepancy, respective stakeholders are requested to highlight the issues within 24 hours of circulation of this MOM and unless notified, the contents of this MOM stands final and fully justified.</li>
                            <li>All communications / correspondence shall be done via mail strictly. Other mode of communication will not be entertained.</li>
                        </ol>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MoMDetail;
