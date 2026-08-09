import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Plus, Trash2, ChevronRight, Pencil, Save, ArrowLeft, Search, ChevronDown, Info, Clock, Shield, Play, Loader2 } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { generalDocsApi } from '../../../../services/generalDocsApi';
import WorkflowPanel from '../../../../components/WorkflowPanel';
import { workflowApi } from '../../../../services/workflowApi';
import { toast } from 'react-toastify';

// --- Party Selector Dropdown ---
const PartySelector = ({ value, onChange, projectParties }) => {
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

    const filtered = projectParties.filter(v =>
        v.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        v.job_nature?.toLowerCase().includes(search.toLowerCase()) ||
        v.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
        v.category?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                onClick={handleToggle}
                className="flex items-center justify-between w-full px-2 py-1 bg-transparent border border-blue-500/40 hover:border-blue-500 rounded text-xs outline-none dark:text-white transition-all min-h-[26px] gap-2"
            >
                <span className="truncate text-left flex-1">{value || <span className="text-gray-400">Select party…</span>}</span>
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
                                placeholder="Search parties…"
                                className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 transition-all dark:text-white"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        {filtered.length > 0 ? filtered.map((v, idx) => (
                            <button
                                key={v.id ?? v.party_id ?? v._id ?? v.company_name ?? idx}
                                type="button"
                                onClick={() => { onChange(v); setOpen(false); setSearch(''); }}
                                className="w-full px-3 py-2.5 flex flex-col items-start hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-50 dark:border-white/5 text-left group transition-colors"
                            >
                                <span className="text-xs font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase tracking-tight">{v.company_name}</span>
                                <span className="text-[10px] text-gray-400 mt-0.5 font-medium">
                                    {[v.category || 'Uncategorized', v.contact_person, v.job_nature].filter(Boolean).join(' — ')}
                                </span>
                            </button>
                        )) : (
                            <div className="px-3 py-6 text-center text-xs text-gray-400">No parties found</div>
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


const AgendaDetail = ({ onBack, setExtraBreadcrumbs, agendaId: id, canWrite }) => {
    const { id: projectId } = useParams();
    const [workflowState, setWorkflowState] = useState({ mode: 'read', cycleId: null, instanceId: null, loading: id !== 'new' });
    // Guard: track which instanceId+cycleId we've already loaded workflow content for
    const loadedWorkflowKey = useRef(null);
    const [template, setTemplate] = useState(null);
    const [isEditing, setIsEditing] = useState(id === 'new' && canWrite);

    // Form State
    const [details, setDetails] = useState({
        subject: '',
        meetingNo: '',
        venue: '',
        date: ''
    });

    const [participants, setParticipants] = useState([]);
    const [originalParticipants, setOriginalParticipants] = useState([]);
    const [points, setPoints] = useState([]);
    const [directoryContacts, setDirectoryContacts] = useState([]);

    const isEditable = canWrite && (workflowState.notConfigured || !workflowState.instanceId ? isEditing : (workflowState.mode === 'edit' && workflowState.cycleId));

    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [auditTrail, setAuditTrail] = useState([]);

    const fetchLogs = async () => {
        if (!workflowState.instanceId) return;
        try {
            const res = await workflowApi.getInstanceLogs(workflowState.instanceId);
            if (res.success && res.logs) {
                const mappedLogs = res.logs.map(log => {
                    let actionText = log.action;
                    let logType = 'update';
                    
                    if (log.action === 'cycle_initiated') {
                        actionText = `Revision cycle V${log.version_number} started`;
                        logType = 'create';
                    } else if (log.action === 'submitted') {
                        actionText = `Submitted for Level ${log.level_order} Approval`;
                        logType = 'update';
                    } else if (log.action === 'revision_requested') {
                        actionText = `Revision requested at Level ${log.level_order}`;
                        logType = 'cancel';
                    } else if (log.action === 'approved') {
                        actionText = `Approved and sealed V${log.version_number}`;
                        logType = 'create';
                    } else if (log.action === 'rejected') {
                        actionText = `Rejected at Level ${log.level_order}`;
                        logType = 'cancel';
                    } else if (log.action === 'cycle_cancelled') {
                        actionText = `Cycle cancelled`;
                        logType = 'cancel';
                    } else if (log.action === 'draft_saved') {
                        actionText = `Draft content auto-saved`;
                        logType = 'update';
                    }

                    if (log.comments) {
                        actionText += ` (${log.comments})`;
                    }

                    return {
                        id: log.log_id,
                        action: actionText,
                        user: log.acted_by_name || 'System User',
                        timestamp: new Date(log.acted_at).toLocaleString(),
                        type: logType
                    };
                });
                setAuditTrail(mappedLogs);
            }
        } catch (err) {
            console.error("Failed to fetch logs:", err);
        }
    };

    useEffect(() => {
        if (isInfoOpen && workflowState.instanceId) {
            fetchLogs();
        }
    }, [isInfoOpen, workflowState.instanceId]);

    // Load templates on load to check if workflow is configured
    useEffect(() => {
        const fetchTemplate = async () => {
            try {
                const res = await workflowApi.getTemplates(projectId);
                if (res.success && res.templates) {
                    const found = res.templates.find(t => t.name === 'Agenda of Meeting');
                    setTemplate(found || null);
                }
            } catch (err) {
                console.error("Failed to load templates:", err);
            }
        };
        fetchTemplate();
    }, [projectId]);

    // Live Load Data
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
                
                // If it is mapped to a workflow instance, set it
                if (agenda.instance_id) {
                    setWorkflowState(prev => ({ ...prev, instanceId: agenda.instance_id }));
                }

                let loadedParticipants = [];
                let loadedPoints = [];
                if (agenda.content) {
                    try {
                        const parsed = typeof agenda.content === 'string' ? JSON.parse(agenda.content) : agenda.content;
                        if (Array.isArray(parsed)) {
                            loadedPoints = parsed.map(p => ({
                                id: Math.random(),
                                slNo: p.no || '',
                                description: p.description || '',
                                remarks: p.remarks || ''
                            }));
                        } else if (parsed.points && Array.isArray(parsed.points)) {
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
                } else {
                    setPoints([]);
                }
                
                if (loadedParticipants.length === 0 && agenda.participants && agenda.participants.length > 0) {
                    loadedParticipants = agenda.participants.map(p => ({
                        id: p.pap_id || p.id || Math.random(),
                        pd_id: p.pd_id,
                        organization: p.company_name || p.organization || '',
                        category: p.category || '',
                        responsibility: p.responsibilities || p.responsibility || '',
                        representatives: p.contact_person || p.representatives || ''
                    }));
                }
                
                if (loadedParticipants.length > 0) {
                    setParticipants(loadedParticipants);
                    setOriginalParticipants(loadedParticipants);
                } else {
                    setParticipants([]);
                    setOriginalParticipants([]);
                }
            } catch(err) {
                console.error("Failed to load agenda", err);
            }
        } else if (id === 'new') {
            setParticipants([
                { id: Date.now() + 1, organization: '', category: '', responsibility: '', representatives: '' }
            ]);
            setPoints([
                { id: Date.now() + 2, slNo: '1', description: '', remarks: '' }
            ]);
        }
    };

    useEffect(() => {
        // Fetch directory and agenda concurrently so directory is ready before workflow content enrichment
        Promise.all([
            loadAgenda(),
            generalDocsApi.getDirectory(projectId)
                .then(d => { if (d?.directory) setDirectoryContacts(d.directory); })
                .catch(() => {})
        ]);
    }, [id, projectId]);

    // Re-enrich participants if directoryContacts loaded after loadWorkflowContent already ran
    useEffect(() => {
        if (directoryContacts.length === 0) return;
        setParticipants(prev => prev.map(p => {
            if (!p.pd_id) return p;
            if (p.organization && p.category && p.responsibility && p.representatives) return p; // already enriched
            const dir = directoryContacts.find(d => d.pd_id === p.pd_id || d.id === p.pd_id);
            if (!dir) return p;
            return {
                ...p,
                organization: p.organization || dir.company_name || '',
                category: p.category || dir.category || '',
                responsibility: p.responsibility || dir.job_nature || '',
                representatives: p.representatives || dir.contact_person || ''
            };
        }));
    }, [directoryContacts]);

    // Load Approved/Draft workflow content
    // forceReload=true bypasses the dedup guard (used after save actions)
    const loadWorkflowContent = async (forceReload = false) => {
        if (!workflowState.instanceId || workflowState.notConfigured) return;

        // Dedup: skip if we've already loaded this exact instanceId+cycleId pair
        const key = `${workflowState.instanceId}::${workflowState.cycleId ?? 'none'}`;
        if (!forceReload && loadedWorkflowKey.current === key) return;
        loadedWorkflowKey.current = key;

        try {
            if (workflowState.cycleId) {
                try {
                    const res = await workflowApi.getDraftContent(workflowState.instanceId);
                    const meeting = res.content_tables?.pdoc_meeting?.[0];
                    if (meeting) {
                        setDetails({
                            subject: meeting.subject || '',
                            meetingNo: meeting.meeting_no || '',
                            venue: meeting.venue || '',
                            date: meeting.date ? meeting.date.split('T')[0] : ''
                        });
                        const parsed = meeting.content ? (typeof meeting.content === 'string' ? JSON.parse(meeting.content) : meeting.content) : [];
                        setPoints(parsed.map((p, i) => ({
                            id: p.id || `wf-pt-${i}-${p.no || i}`,
                            slNo: p.no || '',
                            description: p.description || '',
                            remarks: p.remarks || ''
                        })));
                        const pList = (meeting.pdoc_meeting_participants || []).map((p, i) => {
                            // Try to get display fields from directoryContacts if not provided by draft API
                            const dir = p.pd_id ? directoryContacts.find(d => d.pd_id === p.pd_id || d.id === p.pd_id) : null;
                            return {
                                id: p.id || p.pap_id || `wf-p-${i}`,
                                pd_id: p.pd_id,
                                organization: p.company_name || p.organization || dir?.company_name || '',
                                category: p.category || dir?.category || '',
                                responsibility: p.responsibilities || p.responsibility || dir?.job_nature || '',
                                representatives: p.contact_person || p.representatives || dir?.contact_person || ''
                            };
                        });
                        setParticipants(pList);
                        setOriginalParticipants(pList);
                    }
                } catch (err) {
                    console.error("Failed to load draft content", err);
                }
            } else {
                try {
                    const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                    const meeting = res.content?.pdoc_meeting?.[0];
                    if (meeting) {
                        setDetails({
                            subject: meeting.subject || '',
                            meetingNo: meeting.meeting_no || '',
                            venue: meeting.venue || '',
                            date: meeting.date ? meeting.date.split('T')[0] : ''
                        });
                        const parsed = meeting.content ? (typeof meeting.content === 'string' ? JSON.parse(meeting.content) : meeting.content) : [];
                        setPoints(parsed.map((p, i) => ({
                            id: p.id || `wf-pt-${i}-${p.no || i}`,
                            slNo: p.no || '',
                            description: p.description || '',
                            remarks: p.remarks || ''
                        })));
                        const pList = (meeting.pdoc_meeting_participants || []).map((p, i) => {
                            const dir = p.pd_id ? directoryContacts.find(d => d.pd_id === p.pd_id || d.id === p.pd_id) : null;
                            return {
                                id: p.id || p.pap_id || `wf-p-${i}`,
                                pd_id: p.pd_id,
                                organization: p.company_name || p.organization || dir?.company_name || '',
                                category: p.category || dir?.category || '',
                                responsibility: p.responsibilities || p.responsibility || dir?.job_nature || '',
                                representatives: p.contact_person || p.representatives || dir?.contact_person || ''
                            };
                        });
                        setParticipants(pList);
                        setOriginalParticipants(pList);
                    }
                } catch (err) {
                    console.error("Failed to load approved content", err);
                }
            }
        } catch (err) {
            console.error("Workflow loader error", err);
        }
    };

    useEffect(() => {
        // Only fire when instanceId or cycleId actually changes to a real value
        if (!workflowState.instanceId) return;
        loadWorkflowContent();
    }, [workflowState.cycleId, workflowState.instanceId]);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'General Documents', onClick: onBack },
            { label: 'Agenda of Meeting', onClick: onBack },
            { label: id === 'new' ? 'New Agenda' : details.subject || 'Edit Agenda' }
        ]);
    }, [onBack, setExtraBreadcrumbs, id, details.subject]);

    const handleInitializeWorkflow = async () => {
        try {
            if (!template) return;
            toast.info('Initializing workflow...');

            // Use the global template directly — no per-instance template copy
            const targetDocId = template.document_id;

            // Create instance & start cycle
            const instRes = await workflowApi.createInstance(projectId, {
                document_id: targetDocId,
                title: details.subject || 'New Agenda'
            });
            if (instRes.success) {
                const cycleRes = await workflowApi.initiateCycle(instRes.instance_id);
                if (cycleRes.success) {
                    // Update database with instance_id and cycle_id
                    await generalDocsApi.updateAgenda(projectId, id, {
                        instance_id: instRes.instance_id,
                        cycle_id: cycleRes.cycle_id
                    });

                    // Save initial content payload to draft
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
                    await workflowApi.updateAgendaDraft(cycleRes.cycle_id, payload);
                    await Promise.all(participants.filter(p => p.pd_id).map(p =>
                        workflowApi.addAgendaParticipantDraft(cycleRes.cycle_id, p.pd_id)
                    ));

                    toast.success('Workflow enabled and draft cycle started!');
                    setWorkflowState(prev => ({
                        ...prev,
                        instanceId: instRes.instance_id,
                        cycleId: cycleRes.cycle_id,
                        mode: 'edit'
                    }));
                    loadWorkflowContent(true); // force reload after initializing workflow
                }
            }
        } catch (err) {
            console.error("Failed to enable workflow:", err);
            toast.error("Failed to enable workflow approval");
        }
    };

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

            // If Workflow is configured
            console.log('[SaveDraft] state:', { template: !!template, workflowState, id });
            if (template && !workflowState.notConfigured) {
                if (id === 'new' || !workflowState.instanceId) {
                    // Use the global template directly — no per-instance template copy
                    const targetDocId = template.document_id;

                    // Create instance & start cycle
                    const instRes = await workflowApi.createInstance(projectId, {
                        document_id: targetDocId,
                        title: details.subject || 'New Agenda'
                    });
                    if (instRes.success) {
                        const cycleRes = await workflowApi.initiateCycle(instRes.instance_id);
                        if (cycleRes.success) {
                            await workflowApi.updateAgendaDraft(cycleRes.cycle_id, payload);
                            await Promise.all(participants.filter(p => p.pd_id).map(p =>
                                workflowApi.addAgendaParticipantDraft(cycleRes.cycle_id, p.pd_id)
                            ));

                            if (id !== 'new') {
                                await generalDocsApi.updateAgenda(projectId, id, {
                                    instance_id: instRes.instance_id,
                                    cycle_id: cycleRes.cycle_id
                                });
                                toast.success('Agenda workflow initialized successfully');
                                setWorkflowState(prev => ({
                                    ...prev,
                                    instanceId: instRes.instance_id,
                                    cycleId: cycleRes.cycle_id,
                                    mode: 'edit'
                                }));
                                setIsEditing(false);
                                loadWorkflowContent();
                            } else {
                                toast.success('Agenda draft submitted successfully');
                                onBack();
                            }
                        }
                    }
                } else {
                    // Update existing draft cycle — resolve cycleId if somehow missing from state
                    let activeCycleId = workflowState.cycleId;
                    if (!activeCycleId && workflowState.instanceId) {
                        // Fallback: fetch active cycle directly from the instance
                        console.warn('[SaveDraft] cycleId missing from state, fetching from instance...');
                        const instRes = await workflowApi.getInstance(workflowState.instanceId);
                        activeCycleId = instRes?.instance?.current_cycle?.cycle_id || null;
                    }

                    if (!activeCycleId) {
                        toast.error('No active draft cycle found. Please refresh the page.');
                        return;
                    }

                    // Update existing draft cycle
                    await workflowApi.updateAgendaDraft(activeCycleId, payload);
                    
                    // Diff participants
                    const origIds = originalParticipants.map(p => p.pd_id).filter(Boolean);
                    const newIds = participants.map(p => p.pd_id).filter(Boolean);
                    
                    const added = participants.filter(p => p.pd_id && !origIds.includes(p.pd_id));
                    await Promise.all(added.map(p => workflowApi.addAgendaParticipantDraft(activeCycleId, p.pd_id)));
                    
                    const removed = originalParticipants.filter(p => p.pd_id && !newIds.includes(p.pd_id));
                    await Promise.all(removed.map(p =>
                        workflowApi.removeAgendaParticipantDraft(activeCycleId, p.id)
                    ));

                    toast.success('Agenda draft saved');
                    loadWorkflowContent(true); // force reload after save
                }
            } else {
                // Normal fallback
                if (id === 'new') {
                    await generalDocsApi.createAgenda(projectId, payload);
                    onBack();
                } else {
                    await generalDocsApi.updateAgenda(projectId, id, payload);
                    setIsEditing(false);
                }
            }
        } catch(err) {
            toast.error('Failed to save agenda');
            console.error(err);
        }
    };

    // --- Participants Actions ---
    const addParticipant = () => {
            setParticipants([...participants, { id: Date.now(), pd_id: null, organization: '', category: '', responsibility: '', representatives: '' }]);
    };

    const handleParticipantSelect = (pid, directoryEntry) => {
        setParticipants(participants.map(p => p.id === pid ? {
            ...p,
            pd_id: directoryEntry.pd_id,
            organization: directoryEntry.company_name || '',
            category: directoryEntry.category || '',
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
                    {workflowState.instanceId && (
                        <button
                            onClick={() => setIsInfoOpen(true)}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-white/10 rounded-md transition-all active:scale-95 cursor-pointer text-xs font-medium"
                            title="View Audit Trail"
                        >
                            <Info size={14} />
                            <span>Audit trails</span>
                        </button>
                    )}

                    {(!workflowState.instanceId || workflowState.notConfigured) ? (
                        !isEditing ? (
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
                        )
                    ) : (
                        workflowState.mode === 'edit' && (
                            <button
                                onClick={handleSave}
                                className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-md font-medium text-sm transition-colors shadow-sm"
                            >
                                <Save size={16} />
                                <span>Save Draft</span>
                            </button>
                        )
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="w-full space-y-6">

                    {id !== 'new' && !workflowState.instanceId && !workflowState.loading && template && !workflowState.notConfigured && (
                        <div className="mb-6 p-5 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                                    <Shield size={20} className="text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Approval Workflow Configured</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This document has a workflow setup ready, but approval tracking is not yet active for this item.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleInitializeWorkflow}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer shrink-0"
                            >
                                <Play size={12} /> Enable Approval Workflow
                            </button>
                        </div>
                    )}

                    {id !== 'new' && (
                        <WorkflowPanel
                            projectId={projectId}
                            templateName="Agenda of Meeting"
                            instanceId={workflowState.instanceId}
                            onStateChange={(newState) => setWorkflowState(prev => ({ ...prev, ...newState }))}
                            onRefreshContent={loadWorkflowContent}
                        />
                    )}
                    {workflowState.loading ? (
                        <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-sm">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse font-medium">Loading document workflow state...</p>
                        </div>
                    ) : (
                        <>
                            {/* Section 1: Edit Details */}
                            <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg flex flex-col shadow-sm">
                                <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10 rounded-t-lg">
                                    <h2 className="text-gray-900 dark:text-white font-bold text-[15px]">{isEditable ? 'Edit Details' : 'Agenda Details'}</h2>
                                </div>
                                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    {/* Subject */}
                                    <div className="flex flex-col space-y-1.5">
                                        <label className="text-xs text-gray-500 font-medium tracking-wide">Subject</label>
                                        <div className={`border rounded-md p-1 transition-all ${isEditable ? 'bg-white dark:bg-[#1c222b] border-gray-200 dark:border-gray-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20' : 'border-transparent'}`}>
                                            {isEditable ? (
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
                                        <div className={`border rounded-md p-1 transition-all ${isEditable ? 'bg-white dark:bg-[#1c222b] border-gray-200 dark:border-gray-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20' : 'border-transparent'}`}>
                                            {isEditable ? (
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
                                        <div className={`border rounded-md p-1 transition-all ${isEditable ? 'bg-white dark:bg-[#1c222b] border-gray-200 dark:border-gray-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20' : 'border-transparent'}`}>
                                            {isEditable ? (
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
                                        <div className={`border rounded-md p-1 transition-all ${isEditable ? 'bg-white dark:bg-[#1c222b] border-gray-200 dark:border-gray-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 pr-2' : 'border-transparent'}`}>
                                            {isEditable ? (
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
                                    {isEditable && (
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
                                    <table className="w-full text-left text-sm whitespace-nowrap" style={{ tableLayout: 'fixed', width: '100%' }}>
                                        <colgroup>
                                            <col style={{ width: '30%' }} />
                                            <col style={{ width: '16%' }} />
                                            <col style={{ width: '25%' }} />
                                            <col style={{ width: '23%' }} />
                                            <col style={{ width: '6%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-white/10 text-gray-500 bg-gray-100 dark:bg-[#12161c]">
                                                <th className="px-5 py-2.5 text-xs font-medium">Organization</th>
                                                <th className="px-5 py-2.5 text-xs font-medium">Category</th>
                                                <th className="px-5 py-2.5 text-xs font-medium">Responsibility</th>
                                                <th className="px-5 py-2.5 text-xs font-medium">Representatives</th>
                                                <th className="px-2 py-2.5 w-10"></th>
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
                                                        className="border-b border-gray-200 dark:border-white/10/50 group/row hover:bg-gray-800/10 align-middle"
                                                    >
                                                        <td className="px-5 py-2">
                                                            {isEditable ? (
                                                                <PartySelector
                                                                    value={p.organization}
                                                                    onChange={(v) => handleParticipantSelect(p.id, v)}
                                                                    projectParties={directoryContacts}
                                                                />
                                                            ) : (
                                                                <div className="font-medium text-gray-700 dark:text-gray-300 py-1">{p.organization || '-'}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-2">
                                                            <span className="inline-flex px-2 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300 text-[9px] font-semibold uppercase tracking-wide">
                                                                {p.category || 'Uncategorized'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-2 text-gray-600 dark:text-gray-400">
                                                            {isEditable ? (
                                                                <input
                                                                    type="text"
                                                                    value={p.responsibility}
                                                                    onChange={(e) => updateParticipant(p.id, 'responsibility', e.target.value)}
                                                                    className="w-full bg-white dark:bg-[#1c222b] border border-gray-200 dark:border-gray-700/50 hover:border-blue-500/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded px-2 py-1 text-xs outline-none text-gray-900 dark:text-white transition-all min-h-[26px]"
                                                                    placeholder="Enter responsibility..."
                                                                />
                                                            ) : (
                                                                <div className="py-1">{p.responsibility || '-'}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-2 text-gray-600 dark:text-gray-400">
                                                            {isEditable ? (
                                                                <input
                                                                    type="text"
                                                                    value={p.representatives}
                                                                    onChange={(e) => updateParticipant(p.id, 'representatives', e.target.value)}
                                                                    className="w-full bg-white dark:bg-[#1c222b] border border-gray-200 dark:border-gray-700/50 hover:border-blue-500/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded px-2 py-1 text-xs outline-none text-gray-900 dark:text-white transition-all min-h-[26px]"
                                                                    placeholder="Enter representatives..."
                                                                />
                                                            ) : (
                                                                <div className="py-1">{p.representatives || '-'}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2 text-right">
                                                            {isEditable && (
                                                                <button
                                                                    onClick={() => removeParticipant(p.id)}
                                                                    className="text-red-500/70 hover:text-red-500 p-1 opacity-0 group-hover/row:opacity-100 transition-all rounded hover:bg-red-500/10 cursor-pointer"
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
                                    {isEditable && (
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
                                                {isEditable && <th className="px-2 py-3 text-xs font-medium text-center w-[80px]">Actions</th>}
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
                                                                    {isEditable && (
                                                                        <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center opacity-0 group-hover/row:opacity-100 cursor-grab mb-1 transition-opacity">
                                                                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                                                                        </div>
                                                                    )}
                                                                    {isEditable ? (
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
                                                                <div className={`w-full rounded-lg p-2 transition-colors border ${isEditable ? 'group-hover/row:bg-white dark:group-hover/row:bg-[#1c222b]/50 border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:focus-within:bg-[#1c222b]' : 'border-transparent'}`}>
                                                                    {isEditable ? (
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
                                                                <div className={`w-full rounded-lg p-2 transition-colors border ${isEditable ? 'group-hover/row:bg-white dark:group-hover/row:bg-[#1c222b]/50 border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:focus-within:bg-[#1c222b]' : 'border-transparent'}`}>
                                                                    {isEditable ? (
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
                                                            {isEditable && (
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
                        </>
                    )}
                </div>
            </div>

            {/* Audit Trail Drawer */}
            <AnimatePresence>
                {isInfoOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsInfoOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-[380px] bg-white dark:bg-[#0d1117] border-l border-gray-200 dark:border-white/10 shadow-2xl z-[101] flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161b22]">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Info size={20} className="text-blue-400" />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Audit trail & history</h2>
                                </div>
                                <button
                                    onClick={() => setIsInfoOpen(false)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all outline-none cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-left">
                                {auditTrail.map((log) => (
                                    <div key={log.id} className="relative pl-8 pb-2">
                                        <div className="absolute left-3 top-2 bottom-0 w-[1px] bg-gray-200 dark:bg-white/10" />
                                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white dark:border-[#0d1117] z-10 flex items-center justify-center ${log.type === 'create' ? 'bg-green-500/20 text-green-400' :
                                            log.type === 'update' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-purple-500/20 text-purple-400'
                                            }`}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                                                {log.action}
                                            </p>
                                            <div className="flex items-center space-x-2 text-[11px] text-gray-500">
                                                <span className="font-medium text-gray-400">{log.user}</span>
                                                <span>•</span>
                                                <div className="flex items-center space-x-1">
                                                    <Clock size={10} />
                                                    <span>{log.timestamp}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#161b22]/50">
                                <button
                                    onClick={() => setIsInfoOpen(false)}
                                    className="w-full py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-md text-sm font-bold transition-all outline-none border border-gray-300 dark:border-white/10 cursor-pointer"
                                >
                                    Close panel
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AgendaDetail;
