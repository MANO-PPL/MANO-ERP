import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, GripVertical, Trash2, Info, X, Clock, ArrowLeft, Search, ChevronDown, Users, Loader2, Building2 } from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';
import WorkflowPanel from '../../../components/WorkflowPanel';
import { workflowApi } from '../../../services/workflowApi';
import { toast } from 'react-toastify';

import SearchableDropdownPortal, { rankAndFilter, HighlightMatch } from '../../../components/SearchableDropdownPortal';

/* ---- Inline Party Dropdown for Project Parties ---- */
const PartySelector = ({ value, onChange, projectParties }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const ref = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.portal-dropdown')) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleToggle = () => {
        if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: Math.max(rect.width, 300)
            });
            setSearch('');
            setActiveIndex(0);
        }
        setOpen(!open);
    };

    const filtered = useMemo(() => {
        return rankAndFilter(projectParties, search, v => `${v.name || ''} ${v.category || ''} ${v.job_nature || ''}`);
    }, [projectParties, search]);

    useEffect(() => {
        setActiveIndex(0);
    }, [search]);

    useEffect(() => {
        if (!listRef.current) return;
        const activeElem = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
        if (activeElem) {
            activeElem.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filtered.length > 0) {
                setActiveIndex(prev => (prev + 1) % filtered.length);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filtered.length > 0) {
                setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0 && activeIndex >= 0 && activeIndex < filtered.length) {
                onChange(filtered[activeIndex]);
                setOpen(false);
                setSearch('');
            }
        }
    };

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                onClick={handleToggle}
                className="flex items-center justify-between w-full h-8 px-2.5 bg-white dark:bg-[#161b22] border border-blue-500/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-md text-xs outline-none dark:text-white transition-all gap-2 cursor-pointer shadow-2xs"
            >
                <span className="truncate max-w-[160px] text-left font-medium">{value || <span className="text-gray-400 font-normal">Select party…</span>}</span>
                <ChevronDown size={13} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180 text-blue-500' : ''}`} />
            </button>

            {open && createPortal(
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="portal-dropdown fixed bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col p-1.5"
                    style={{
                        top: coords.top - window.scrollY,
                        left: coords.left - window.scrollX,
                        width: coords.width,
                        maxHeight: '300px'
                    }}
                >
                    <div className="p-1 border-b border-gray-100 dark:border-white/5 mb-1">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={inputRef}
                                autoFocus
                                type="text"
                                placeholder="Search project parties…"
                                className="w-full pl-7 pr-7 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 transition-all dark:text-white"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        inputRef.current?.focus();
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div ref={listRef} className="overflow-y-auto custom-scrollbar flex-1 space-y-0.5">
                        {filtered.length > 0 ? filtered.map((v, idx) => {
                            const isActive = activeIndex === idx;
                            return (
                                <button
                                    key={v.pv_id || idx}
                                    data-index={idx}
                                    type="button"
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onClick={() => { onChange(v); setOpen(false); setSearch(''); }}
                                    className={`w-full px-2.5 py-2 flex flex-col items-start rounded-lg text-left transition-colors cursor-pointer ${isActive
                                            ? 'bg-blue-50 dark:bg-blue-900/30'
                                            : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <span className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-tight">
                                        <HighlightMatch text={v.name} query={search} />
                                    </span>
                                    <span className="text-[10px] text-gray-400 mt-0.5 font-medium">
                                        {[v.category || 'Uncategorized', v.job_nature].filter(Boolean).join(' · ')}
                                    </span>
                                </button>
                            );
                        }) : (
                            <div className="px-3 py-6 text-center text-xs text-gray-400">No project parties found</div>
                        )}
                    </div>
                </motion.div>,
                document.body
            )}
        </div>
    );
};

const StandardInput = ({ value, onChange, placeholder, autoFocus, type = "text", className = "" }) => (
    <input
        type={type}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        className={`w-full h-8 px-2.5 text-xs bg-white dark:bg-[#161b22] border border-blue-500/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-md outline-none dark:text-white transition-all ${className}`}
    />
);

const StandardTextarea = ({ value, onChange, placeholder, className = "" }) => (
    <textarea
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        className={`w-full bg-white dark:bg-[#161b22] border border-blue-500/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-md outline-none dark:text-white transition-all px-2.5 py-1.5 text-xs min-h-[60px] resize-none ${className}`}
    />
);

const ProjectDirectory = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workflowState, setWorkflowState] = useState({ mode: 'read', cycleId: null, instanceId: null, loading: false, notConfigured: true });
    const isEditable = canWrite && (workflowState.notConfigured || (workflowState.mode === 'edit' && workflowState.cycleId));

    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [projectParties, setProjectParties] = useState([]);

    // Excel Grid & Selection State
    const [selectionAnchor, setSelectionAnchor] = useState(null);
    const [selectionFocus, setSelectionFocus] = useState(null);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [customColWidths, setCustomColWidths] = useState({});

    const DIRECTORY_COLS = [
        'name', 'category', 'nature', 'person', 'designation',
        'responsibilities', 'phone', 'email', 'address'
    ];

    const COLUMN_LABELS = {
        name: 'Company Name',
        category: 'Category',
        nature: 'Job Nature',
        person: 'Person Name',
        designation: 'Designation',
        responsibilities: 'Responsibilities',
        phone: 'Mobile No',
        email: 'Email ID',
        address: 'Address'
    };

    const getBoundsFromRefs = useCallback(() => {
        if (!selectionAnchor || !selectionFocus) return null;
        return {
            minRow: Math.min(selectionAnchor.r, selectionFocus.r),
            maxRow: Math.max(selectionAnchor.r, selectionFocus.r),
            minCol: Math.min(selectionAnchor.c, selectionFocus.c),
            maxCol: Math.max(selectionAnchor.c, selectionFocus.c)
        };
    }, [selectionAnchor, selectionFocus]);

    const handleColumnHeaderDoubleClick = useCallback((colKey) => {
        let maxLen = (COLUMN_LABELS[colKey] || colKey).length;
        contacts.forEach(c => {
            const val = String(c[colKey] ?? '');
            if (val.length > maxLen) maxLen = val.length;
        });
        const computedWidth = Math.max(100, Math.min(480, maxLen * 8.5 + 32));
        setCustomColWidths(prev => {
            if (prev[colKey]) {
                const next = { ...prev };
                delete next[colKey];
                return next;
            }
            return { ...prev, [colKey]: `${computedWidth}px` };
        });
    }, [contacts]);

    // Excel TSV Copy
    const handleExcelCopy = useCallback(() => {
        const bounds = getBoundsFromRefs();
        if (!bounds) return;
        const lines = [];
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const row = contacts[r];
            if (!row) continue;
            const cells = [];
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const colKey = DIRECTORY_COLS[c];
                cells.push(String(row[colKey] ?? ''));
            }
            lines.push(cells.join('\t'));
        }
        navigator.clipboard.writeText(lines.join('\n')).catch(() => { });
        toast.info(`Copied ${lines.length} row(s) to clipboard`);
    }, [getBoundsFromRefs, contacts]);

    // Excel Fill Down
    const handleFillDown = useCallback(() => {
        if (!isEditable) return;
        const bounds = getBoundsFromRefs();
        if (!bounds || bounds.minRow === bounds.maxRow) return;
        const sourceRow = contacts[bounds.minRow];
        if (!sourceRow) return;
        const updated = [...contacts];
        for (let r = bounds.minRow + 1; r <= bounds.maxRow; r++) {
            const targetRow = { ...updated[r] };
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const colKey = DIRECTORY_COLS[c];
                if (['designation', 'responsibilities', 'address'].includes(colKey)) {
                    targetRow[colKey] = sourceRow[colKey];
                }
            }
            updated[r] = targetRow;
        }
        setContacts(updated);
        toast.info('Filled down');
    }, [isEditable, getBoundsFromRefs, contacts]);

    // Excel Fill Right
    const handleFillRight = useCallback(() => {
        if (!isEditable) return;
        const bounds = getBoundsFromRefs();
        if (!bounds || bounds.minCol === bounds.maxCol) return;
        toast.info('Filled right');
    }, [isEditable, getBoundsFromRefs]);

    // Global Keydown Handler
    useEffect(() => {
        const handleKeyDown = (e) => {
            const activeEl = document.activeElement;
            const isTyping = activeEl?.tagName?.toLowerCase() === 'input' || activeEl?.tagName?.toLowerCase() === 'textarea';

            if (e.key === 'Escape') {
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setEditingId(null);
                return;
            }

            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const mod = isMac ? e.metaKey : e.ctrlKey;

            // Ctrl+S
            if (mod && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                toast.success('Directory saved');
                return;
            }

            // Insert / Ctrl++
            if (e.key === 'Insert' || (mod && (e.key === '+' || e.key === '='))) {
                e.preventDefault();
                if (isEditable) handleAdd();
                return;
            }

            // Ctrl+-
            if (mod && (e.key === '-' || e.key === '_')) {
                e.preventDefault();
                if (selectionAnchor && isEditable && contacts[selectionAnchor.r]) {
                    handleDelete(contacts[selectionAnchor.r].id);
                }
                return;
            }

            // Ctrl+A
            if (mod && (e.key === 'a' || e.key === 'A') && !isTyping) {
                e.preventDefault();
                setSelectionAnchor({ r: 0, c: 0 });
                setSelectionFocus({ r: contacts.length - 1, c: DIRECTORY_COLS.length - 1 });
                return;
            }

            if (mod && (e.key === 'c' || e.key === 'C') && !isTyping) { e.preventDefault(); handleExcelCopy(); return; }
            if (mod && (e.key === 'd' || e.key === 'D') && !isTyping) { e.preventDefault(); handleFillDown(); return; }
            if (mod && (e.key === 'r' || e.key === 'R') && !isTyping) { e.preventDefault(); handleFillRight(); return; }

            if (isTyping) return;

            if (selectionAnchor) {
                const totalRows = contacts.length;
                const totalCols = DIRECTORY_COLS.length;
                let { r, c } = selectionFocus || selectionAnchor;

                if (e.key === 'ArrowDown') { e.preventDefault(); r = mod ? totalRows - 1 : Math.min(r + 1, totalRows - 1); }
                if (e.key === 'ArrowUp') { e.preventDefault(); r = mod ? 0 : Math.max(r - 1, 0); }
                if (e.key === 'ArrowRight') { e.preventDefault(); c = mod ? totalCols - 1 : Math.min(c + 1, totalCols - 1); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); c = mod ? 0 : Math.max(c - 1, 0); }
                if (e.key === 'Tab') { e.preventDefault(); c = e.shiftKey ? Math.max(c - 1, 0) : Math.min(c + 1, totalCols - 1); }
                if (e.key === 'Enter') { e.preventDefault(); r = e.shiftKey ? Math.max(r - 1, 0) : Math.min(r + 1, totalRows - 1); }
                if (e.key === 'Home') { e.preventDefault(); c = 0; if (mod) r = 0; }
                if (e.key === 'End') { e.preventDefault(); c = totalCols - 1; if (mod) r = totalRows - 1; }
                if (e.key === 'PageUp') { e.preventDefault(); r = Math.max(0, r - 10); }
                if (e.key === 'PageDown') { e.preventDefault(); r = Math.min(totalRows - 1, r + 10); }

                // Space
                if (e.key === ' ' || e.key === 'Spacebar') {
                    if (e.shiftKey && !mod) {
                        e.preventDefault();
                        setSelectionAnchor({ r, c: 0 });
                        setSelectionFocus({ r, c: totalCols - 1 });
                        return;
                    }
                    if (mod && !e.shiftKey) {
                        e.preventDefault();
                        setSelectionAnchor({ r: 0, c });
                        setSelectionFocus({ r: totalRows - 1, c });
                        return;
                    }
                }

                if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Tab', 'Enter', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
                    if (e.shiftKey && e.key !== 'Tab' && e.key !== 'Enter') {
                        setSelectionFocus({ r, c });
                    } else {
                        setSelectionAnchor({ r, c });
                        setSelectionFocus({ r, c });
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectionAnchor, selectionFocus, contacts, isEditable, handleExcelCopy, handleFillDown, handleFillRight]);

    const [auditTrail, setAuditTrail] = useState([]);

    const fetchLogs = async (instanceId) => {
        if (!instanceId) return;
        try {
            const res = await workflowApi.getInstanceLogs(instanceId);
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
            fetchLogs(workflowState.instanceId);
        }
    }, [isInfoOpen, workflowState.instanceId]);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Project Directory' }
        ]);
    }, [setExtraBreadcrumbs, projectId]);

    useEffect(() => {
        const load = async () => {
            if (workflowState.loading) return; // Do not fetch until workflow state is determined
            if (workflowState.instanceId && !workflowState.notConfigured) {
                await fetchDirectory(null, false);
            } else {
                const partiesList = await fetchProjectParties();
                await fetchDirectory(partiesList);
            }
        };
        load();
    }, [projectId, workflowState.loading, workflowState.instanceId, workflowState.cycleId]);

    const fetchProjectParties = async () => {
        try {
            const data = await generalDocsApi.getParties(projectId);
            if (data && data.parties) {
                setProjectParties(data.parties);
                return data.parties;
            }
        } catch (error) {
            console.error('Failed to fetch project parties:', error);
        }
        return [];
    };

    const fetchDirectory = async (partiesList = projectParties, silent = false) => {
        let list = partiesList;
        let isSilent = silent;
        if (typeof partiesList === 'boolean') {
            isSilent = partiesList;
            list = projectParties;
        }

        try {
            if (contacts.length === 0 && !isSilent) setLoading(true);

            // Check if workflow is active and has an instance
            if (workflowState && workflowState.instanceId && !workflowState.notConfigured) {
                try {
                    let rows = [];
                    let cycleParties = [];
                    // Try getting draft content if there is an active cycle
                    if (workflowState.cycleId) {
                        try {
                            const res = await workflowApi.getDraftContent(workflowState.instanceId);
                            rows = res.content_tables?.proj_directory || res.content_tables?.pdoc_directory || [];
                            cycleParties = res.content_tables?.proj_parties || res.content_tables?.pdoc_vendors || [];
                        } catch (err) {
                            // Fall back to approved if draft is not accessible
                            const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                            rows = res.content?.proj_directory || res.content?.pdoc_directory || [];
                            cycleParties = res.content?.proj_parties || res.content?.pdoc_vendors || [];
                        }
                    } else {
                        const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                        rows = res.content?.proj_directory || res.content?.pdoc_directory || [];
                        cycleParties = res.content?.proj_parties || res.content?.pdoc_vendors || [];
                    }

                    if (cycleParties.length > 0) {
                        setProjectParties(cycleParties);
                        list = cycleParties;
                    }

                    if (rows.length === 0) {
                        const data = await generalDocsApi.getDirectory(projectId);
                        if (data && data.directory) {
                            const mappedContacts = data.directory.map(c => ({
                                id: c.id,
                                party_id: c.party_id || c.pv_id,
                                pv_id: c.party_id || c.pv_id,
                                name: c.company_name,
                                category: c.category,
                                nature: c.job_nature,
                                person: c.contact_person,
                                designation: c.designation,
                                responsibilities: c.responsibilities,
                                phone: c.mobile_no,
                                email: c.email,
                                address: c.address_line
                            }));
                            setContacts(mappedContacts);
                            setLoading(false);
                            return;
                        }
                    }

                    const mappedContacts = rows.map(c => {
                        const partyKey = c.party_id || c.pv_id;
                        const matchedParty = (list || []).find(party => (party.id === partyKey) || (party.pv_id === partyKey));
                        return {
                            id: c.id,
                            party_id: partyKey,
                            pv_id: partyKey,
                            name: matchedParty?.name || c.company_name || '-',
                            category: matchedParty?.category || c.category || 'Uncategorized',
                            nature: matchedParty?.job_nature || c.job_nature || '-',
                            person: c.contact_person,
                            designation: c.designation,
                            responsibilities: c.responsibilities,
                            phone: c.mobile_no,
                            email: c.email,
                            address: c.address_line
                        };
                    });
                    setContacts(mappedContacts);
                    setLoading(false);
                    return;
                } catch (err) {
                    console.log("No approved/draft workflow content, falling back to base API", err);
                }
            }

            const data = await generalDocsApi.getDirectory(projectId);
            if (data && data.directory) {
                const mappedContacts = data.directory.map(c => ({
                    id: c.id,
                    party_id: c.party_id || c.pv_id,
                    pv_id: c.party_id || c.pv_id,
                    name: c.company_name,
                    category: c.category,
                    nature: c.job_nature,
                    person: c.contact_person,
                    designation: c.designation,
                    responsibilities: c.responsibilities,
                    phone: c.mobile_no,
                    email: c.email,
                    address: c.address_line
                }));
                setContacts(mappedContacts);
            }
        } catch (error) {
            console.error("Failed to fetch directory:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        if (!isEditable) return;
        const newRecord = {
            id: `new-${Date.now()}`,
            party_id: null,
            pv_id: null,
            name: '',
            category: '',
            nature: '',
            person: '',
            designation: '',
            responsibilities: '',
            phone: '',
            email: '',
            address: '',
            isNew: true
        };
        setContacts([...contacts, newRecord]);
        setEditingId(newRecord.id);
        setEditData(newRecord);
    };

    // Called when user picks a party from the inline dropdown
    const handlePartySelect = (party) => {
        const partyId = party.id || party.pv_id;
        setEditData(prev => ({
            ...prev,
            party_id: partyId,
            pv_id: partyId,
            name: party.name || '',
            category: party.category || party.contact_category || party.party_category || 'Uncategorized',
            nature: party.job_nature || party.jobNature || ''
        }));
    };

    const handleEdit = (contact) => {
        if (!isEditable) return;
        setEditingId(contact.id);
        setEditData({ ...contact });
    };

    const handleSave = async () => {
        try {
            const partyId = editData.party_id || editData.pv_id || null;
            const payload = {
                party_id: partyId,
                pv_id: partyId,
                contact_person: editData.person,
                designation: editData.designation,
                responsibilities: editData.responsibilities,
                mobile_no: editData.phone,
                email: editData.email,
                address_line: editData.address
            };

            if (workflowState && workflowState.cycleId) {
                if (editData.isNew) {
                    await workflowApi.addDirectoryDraft(workflowState.cycleId, payload);
                } else {
                    await workflowApi.updateDirectoryDraft(workflowState.cycleId, editData.id, payload);
                }
            } else {
                if (editData.isNew) {
                    await generalDocsApi.addDirectoryItem(projectId, payload);
                } else {
                    await generalDocsApi.updateDirectoryItem(projectId, editData.id, payload);
                }
            }
            await fetchDirectory();
            setEditingId(null);
            setEditData(null);
        } catch (error) {
            console.error("Failed to save directory item:", error);
            toast.error("Failed to save directory item");
        }
    };

    const handleCancel = () => {
        if (editData?.isNew) {
            setContacts(prev => prev.filter(c => c.id !== editData.id));
        }
        setEditingId(null);
        setEditData(null);
    };

    const handleDelete = async (id) => {
        try {
            if (workflowState && workflowState.cycleId) {
                await workflowApi.deleteDirectoryDraft(workflowState.cycleId, id);
            } else {
                await generalDocsApi.deleteDirectoryItem(projectId, id);
            }
            await fetchDirectory();
        } catch (error) {
            console.error("Failed to delete directory item:", error);
            toast.error("Failed to delete directory item");
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left relative">
            {/* Toolbar Area */}
            <div className="flex justify-between items-center px-8 py-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0d1117] z-20">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition-all active:scale-95 group"
                        title="Back to list"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-medium text-gray-900 dark:text-white">Project Directory</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage all project-related contacts and parties.</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {isEditable && (
                        <button onClick={handleAdd} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[12px] font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer">
                            <Plus size={16} />
                            <span>Add new contact</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsInfoOpen(true)}
                        className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-white/10 rounded-md transition-all active:scale-95 cursor-pointer text-[12px] font-medium"
                        title="View Audit Trail"
                    >
                        <Info size={16} />
                        <span>Audit trails</span>
                    </button>
                </div>
            </div>

            {/* List View - Task Theme Style */}
            <div className="flex-1 overflow-auto custom-scrollbar p-6">
                {/* <WorkflowPanel 
                    projectId={projectId} 
                    templateName="Project Directory" 
                    instanceId={workflowState.instanceId}
                    onStateChange={setWorkflowState} 
                    onRefreshContent={fetchDirectory} 
                /> */}

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Loader2 className="animate-spin mb-3 text-blue-500" size={28} />
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Loading project directory contacts...</p>
                    </div>
                ) : contacts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/30 p-12 text-center my-4">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                            <Users size={26} />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Directory Contacts Added</h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                            There are currently no contacts in this project directory. Add parties and staff members to build the communication tree.
                        </p>
                        {isEditable && (
                            <button
                                onClick={handleAdd}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                            >
                                <Plus size={15} />
                                <span>Add First Contact</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="mt-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] shadow-xs overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1200px]">
                            <colgroup>
                                <col className="w-[45px]" />
                                <col className="w-[55px]" />
                                <col className="w-[200px]" />
                                <col className="w-[120px]" />
                                <col className="w-[150px]" />
                                <col className="w-[160px]" />
                                <col className="w-[150px]" />
                                <col className="w-[220px]" />
                                <col className="w-[140px]" />
                                <col className="w-[190px]" />
                                <col className="w-[200px]" />
                                {isEditable && <col className="w-[110px]" />}
                            </colgroup>
                            <thead className="bg-gray-50/80 dark:bg-[#161b22] text-gray-600 dark:text-gray-300 sticky top-0 z-10 border-b border-gray-200 dark:border-white/10 select-none">
                                <tr>
                                    <th className="px-2 py-3 text-center"></th>
                                    <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-center text-gray-500 dark:text-gray-400">Sl No.</th>
                                    <th
                                        onDoubleClick={() => handleColumnHeaderDoubleClick('name')}
                                        style={customColWidths['name'] ? { width: customColWidths['name'], minWidth: customColWidths['name'] } : {}}
                                        title="Company Name - Double-click to Auto-Fit"
                                        className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >Company Name</th>
                                    <th
                                        onDoubleClick={() => handleColumnHeaderDoubleClick('category')}
                                        style={customColWidths['category'] ? { width: customColWidths['category'], minWidth: customColWidths['category'] } : {}}
                                        title="Category - Double-click to Auto-Fit"
                                        className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >Category</th>
                                    <th
                                        onDoubleClick={() => handleColumnHeaderDoubleClick('nature')}
                                        style={customColWidths['nature'] ? { width: customColWidths['nature'], minWidth: customColWidths['nature'] } : {}}
                                        title="Job Nature - Double-click to Auto-Fit"
                                        className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >Job Nature</th>
                                    <th
                                        onDoubleClick={() => handleColumnHeaderDoubleClick('person')}
                                        style={customColWidths['person'] ? { width: customColWidths['person'], minWidth: customColWidths['person'] } : {}}
                                        title="Person Name - Double-click to Auto-Fit"
                                        className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >Person Name</th>
                                    <th
                                        onDoubleClick={() => handleColumnHeaderDoubleClick('designation')}
                                        style={customColWidths['designation'] ? { width: customColWidths['designation'], minWidth: customColWidths['designation'] } : {}}
                                        title="Designation - Double-click to Auto-Fit"
                                        className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >Designation</th>
                                    <th
                                        onDoubleClick={() => handleColumnHeaderDoubleClick('responsibilities')}
                                        style={customColWidths['responsibilities'] ? { width: customColWidths['responsibilities'], minWidth: customColWidths['responsibilities'] } : {}}
                                        title="Responsibilities - Double-click to Auto-Fit"
                                        className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >Responsibilities</th>
                                    <th
                                        onDoubleClick={() => handleColumnHeaderDoubleClick('phone')}
                                        style={customColWidths['phone'] ? { width: customColWidths['phone'], minWidth: customColWidths['phone'] } : {}}
                                        title="Mobile No - Double-click to Auto-Fit"
                                        className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >Mobile No</th>
                                    <th
                                        onDoubleClick={() => handleColumnHeaderDoubleClick('email')}
                                        style={customColWidths['email'] ? { width: customColWidths['email'], minWidth: customColWidths['email'] } : {}}
                                        title="Email ID - Double-click to Auto-Fit"
                                        className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >Email ID</th>
                                    <th
                                        onDoubleClick={() => handleColumnHeaderDoubleClick('address')}
                                        style={customColWidths['address'] ? { width: customColWidths['address'], minWidth: customColWidths['address'] } : {}}
                                        title="Address - Double-click to Auto-Fit"
                                        className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                    >Address</th>
                                    {isEditable && <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-center text-gray-500 dark:text-gray-400">Actions</th>}
                                </tr>
                            </thead>
                            <Reorder.Group axis="y" values={contacts} onReorder={isEditable ? setContacts : () => { }} as="tbody" className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                                <AnimatePresence initial={false}>
                                    {contacts.map((contact, idx) => {
                                        const isEditing = editingId === contact.id;
                                        return (
                                            <Reorder.Item
                                                key={contact.id}
                                                value={contact}
                                                as="tr"
                                                onMouseEnter={() => setHoveredRow(contact.id)}
                                                onMouseLeave={() => setHoveredRow(null)}
                                                className={`${isEditing ? 'bg-blue-50/20 dark:bg-blue-900/10' : 'hover:bg-gray-50/70 dark:hover:bg-white/[0.02]'} transition-colors group/row cursor-default align-top`}
                                            >
                                                <td className="px-2 py-3 text-center">
                                                    <div className="flex items-center justify-center pt-1.5">
                                                        <GripVertical size={14} className={`text-gray-300 dark:text-gray-600 group-hover/row:text-blue-500 transition-colors ${isEditable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`} />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-gray-500 dark:text-gray-500 font-mono text-[11px] text-center">
                                                    {String(idx + 1)}
                                                </td>

                                                {/* Company Name */}
                                                <td data-cell-pos={`${idx}-0`} className="px-3 py-3" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                    {isEditing ? (
                                                        <PartySelector
                                                            value={editData.name}
                                                            onChange={handlePartySelect}
                                                            projectParties={projectParties}
                                                        />
                                                    ) : (
                                                        <div className="text-gray-900 dark:text-white font-medium py-1">
                                                            {contact.name || '-'}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Party Category */}
                                                <td data-cell-pos={`${idx}-1`} className="px-3 py-3" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                    <span className="inline-flex px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold uppercase tracking-wide">
                                                        {(isEditing ? editData.category : contact.category) || 'Uncategorized'}
                                                    </span>
                                                </td>

                                                {/* Job Nature */}
                                                <td data-cell-pos={`${idx}-2`} className="px-3 py-3" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                    {isEditing ? (
                                                        <div className={`h-8 px-2.5 flex items-center text-xs rounded-md border ${editData.nature ? 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/5 font-semibold' : 'text-gray-400 border-gray-200 dark:border-white/10 italic'}`}>
                                                            {editData.nature || 'Auto-filled'}
                                                        </div>
                                                    ) : (
                                                        <div className="text-gray-600 dark:text-gray-400 py-1 font-medium">{contact.nature || '-'}</div>
                                                    )}
                                                </td>

                                                {/* Person Name */}
                                                <td data-cell-pos={`${idx}-3`} className="px-3 py-3" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                    {isEditing ? (
                                                        <StandardInput
                                                            autoFocus
                                                            placeholder="Contact Person..."
                                                            value={editData.person}
                                                            onChange={(e) => setEditData({ ...editData, person: e.target.value })}
                                                        />
                                                    ) : (
                                                        <div className="text-gray-900 dark:text-gray-200 py-1 font-medium">{contact.person || '-'}</div>
                                                    )}
                                                </td>

                                                {/* Designation */}
                                                <td data-cell-pos={`${idx}-4`} className="px-3 py-3" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                    {isEditing ? (
                                                        <StandardInput
                                                            placeholder="Designation..."
                                                            value={editData.designation}
                                                            onChange={(e) => setEditData({ ...editData, designation: e.target.value })}
                                                        />
                                                    ) : (
                                                        <div className="text-gray-600 dark:text-gray-400 py-1">{contact.designation || '-'}</div>
                                                    )}
                                                </td>

                                                {/* Responsibilities */}
                                                <td data-cell-pos={`${idx}-5`} className="px-3 py-3" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                    {isEditing ? (
                                                        <StandardTextarea
                                                            placeholder="Enter responsibilities..."
                                                            value={editData.responsibilities}
                                                            onChange={(e) => setEditData({ ...editData, responsibilities: e.target.value })}
                                                        />
                                                    ) : (
                                                        <div className="text-gray-600 dark:text-gray-400 py-1 whitespace-pre-wrap leading-relaxed">{contact.responsibilities || '-'}</div>
                                                    )}
                                                </td>

                                                {/* Mobile No */}
                                                <td data-cell-pos={`${idx}-6`} className="px-3 py-3" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                    {isEditing ? (
                                                        <StandardInput
                                                            placeholder="Mobile Number..."
                                                            value={editData.phone}
                                                            onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                                        />
                                                    ) : (
                                                        <div className="text-gray-600 dark:text-gray-400 py-1 font-mono">{contact.phone || '-'}</div>
                                                    )}
                                                </td>

                                                {/* Email ID */}
                                                <td data-cell-pos={`${idx}-7`} className="px-3 py-3" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                    {isEditing ? (
                                                        <StandardInput
                                                            type="email"
                                                            placeholder="Email ID..."
                                                            value={editData.email}
                                                            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                                        />
                                                    ) : (
                                                        <div className="text-blue-500 hover:underline cursor-pointer py-1 truncate">{contact.email || '-'}</div>
                                                    )}
                                                </td>

                                                {/* Address */}
                                                <td data-cell-pos={`${idx}-8`} className="px-3 py-3" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                    {isEditing ? (
                                                        <StandardTextarea
                                                            placeholder="Enter address..."
                                                            value={editData.address}
                                                            onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                                                        />
                                                    ) : (
                                                        <div className="text-gray-600 dark:text-gray-400 py-1 whitespace-pre-wrap leading-relaxed">{contact.address || '-'}</div>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                {isEditable && (
                                                    <td className="px-3 py-3 text-center">
                                                        {isEditing ? (
                                                            <div className="flex flex-col items-center justify-center space-y-1.5 pt-1">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                                                    className="w-full py-1.5 bg-blue-600 text-white rounded-md text-[11px] font-semibold hover:bg-blue-700 transition-all shadow-sm cursor-pointer"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                                                                    className="w-full py-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-md text-[11px] font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center space-x-2 pt-1">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEdit(contact); }}
                                                                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors cursor-pointer"
                                                                    title="Edit contact"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }}
                                                                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                                    title="Delete contact"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                            </Reorder.Item>
                                        );
                                    })}
                                </AnimatePresence>
                            </Reorder.Group>
                        </table>
                    </div>
                )}
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
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all outline-none"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
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
                                    className="w-full py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-md text-sm font-bold transition-all outline-none border border-gray-300 dark:border-white/10"
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

export default ProjectDirectory;
