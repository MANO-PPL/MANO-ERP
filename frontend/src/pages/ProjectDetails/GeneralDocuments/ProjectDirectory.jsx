import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, GripVertical, Trash2, Info, X, Clock, ArrowLeft, Search, ChevronDown } from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';
import WorkflowPanel from '../../../components/WorkflowPanel';
import { workflowApi } from '../../../services/workflowApi';
import { toast } from 'react-toastify';

/* ---- Inline Vendor Dropdown for Project Vendors ---- */
const VendorSelector = ({ value, onChange, projectVendors }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const ref = useRef(null);

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
                width: Math.max(rect.width, 280) 
            });
        }
        setOpen(!open);
    };

    const filtered = projectVendors.filter(v =>
        v.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.job_nature?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} className="relative min-w-[160px]">
            <button
                type="button"
                onClick={handleToggle}
                className="flex items-center justify-between w-full px-2 py-1 bg-white dark:bg-[#161b22] border border-blue-500/50 focus:border-blue-500 rounded text-xs outline-none dark:text-white transition-all min-h-[26px] gap-2"
            >
                <span className="truncate max-w-[140px] text-left">{value || <span className="text-gray-400">Select vendor…</span>}</span>
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
                                placeholder="Search project vendors…"
                                className="w-full pl-7 pr-3 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 transition-all dark:text-white"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        {filtered.length > 0 ? filtered.map(v => (
                            <button
                                key={v.pv_id}
                                type="button"
                                onClick={() => { onChange(v); setOpen(false); setSearch(''); }}
                                className="w-full px-3 py-2.5 flex flex-col items-start hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-50 dark:border-white/5 text-left group transition-colors"
                            >
                                <span className="text-xs font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase tracking-tight">{v.name}</span>
                                {v.job_nature && <span className="text-[10px] text-gray-400 mt-0.5 font-medium">{v.job_nature}</span>}
                            </button>
                        )) : (
                            <div className="px-3 py-6 text-center text-xs text-gray-400">No project vendors found</div>
                        )}
                    </div>
                </motion.div>,
                document.body
            )}
        </div>
    );
};

const ResizableInput = ({ value, onChange, autoFocus, className = "", minW = "50px" }) => (
    <div className="inline-grid w-fit max-w-full items-center align-middle relative">
        <span className={`invisible col-start-1 row-start-1 whitespace-pre pointer-events-none min-h-[26px] flex items-center ${className}`} style={{ minWidth: minW }}>
            {value || ' '}
        </span>
        <input
            autoFocus={autoFocus}
            className={`absolute inset-0 w-full h-full bg-white dark:bg-[#161b22] border border-blue-500/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded outline-none shadow-sm dark:text-white transition-all ${className}`}
            value={value || ''}
            onChange={onChange}
        />
    </div>
);

const ProjectDirectory = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workflowState, setWorkflowState] = useState({ mode: 'read', cycleId: null, loading: true });

    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [globalVendors, setGlobalVendors] = useState([]);

    const isEditable = canWrite && (workflowState.notConfigured || (workflowState.mode === 'edit' && workflowState.cycleId));

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
            { label: 'General Documents', onClick: onBack },
            { label: 'Project Directory' }
        ]);
    }, [onBack, setExtraBreadcrumbs, projectId]);

    useEffect(() => {
        const load = async () => {
            if (workflowState.loading) return; // Do not fetch until workflow state is determined
            if (workflowState.instanceId && !workflowState.notConfigured) {
                await fetchDirectory(null, false);
            } else {
                const vendorsList = await fetchProjectVendors();
                await fetchDirectory(vendorsList);
            }
        };
        load();
    }, [projectId, workflowState.loading, workflowState.instanceId, workflowState.cycleId]);

    const fetchProjectVendors = async () => {
        try {
            const data = await generalDocsApi.getVendors(projectId);
            if (data && data.vendors) {
                setGlobalVendors(data.vendors);
                return data.vendors;
            }
        } catch (error) {
            console.error('Failed to fetch project vendors:', error);
        }
        return [];
    };

    const fetchDirectory = async (vendorsList = globalVendors, silent = false) => {
        let list = vendorsList;
        let isSilent = silent;
        if (typeof vendorsList === 'boolean') {
            isSilent = vendorsList;
            list = globalVendors;
        }

        try {
            if (contacts.length === 0 && !isSilent) setLoading(true);
            
            // Check if workflow is active and has an instance
            if (workflowState && workflowState.instanceId && !workflowState.notConfigured) {
                try {
                    let rows = [];
                    let cycleVendors = [];
                    // Try getting draft content if there is an active cycle
                    if (workflowState.cycleId) {
                        try {
                            const res = await workflowApi.getDraftContent(workflowState.instanceId);
                            rows = res.content_tables?.pdoc_directory || [];
                            cycleVendors = res.content_tables?.pdoc_vendors || [];
                        } catch (err) {
                            // Fall back to approved if draft is not accessible
                            const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                            rows = res.content?.pdoc_directory || [];
                            cycleVendors = res.content?.pdoc_vendors || [];
                        }
                    } else {
                        const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                        rows = res.content?.pdoc_directory || [];
                        cycleVendors = res.content?.pdoc_vendors || [];
                    }

                    if (cycleVendors.length > 0) {
                        setGlobalVendors(cycleVendors);
                        list = cycleVendors;
                    }

                    if (rows.length === 0) {
                        const data = await generalDocsApi.getDirectory(projectId);
                        if (data && data.directory) {
                            const mappedContacts = data.directory.map(c => ({
                                id: c.pd_id,
                                pv_id: c.pv_id,
                                name: c.company_name,
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
                        const matchedVendor = (list || []).find(gv => gv.pv_id === c.pv_id);
                        return {
                            id: c.pd_id,
                            pv_id: c.pv_id,
                            name: matchedVendor?.name || c.company_name || '-',
                            nature: matchedVendor?.job_nature || c.job_nature || '-',
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
                    id: c.pd_id,
                    pv_id: c.pv_id,
                    name: c.company_name,
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
            pv_id: null,
            name: '',
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

    // Called when user picks a vendor from the inline dropdown
    const handleVendorSelect = (vendor) => {
        setEditData(prev => ({
            ...prev,
            pv_id: vendor.pv_id,
            name: vendor.name || '',
            nature: vendor.job_nature || ''
        }));
    };

    const handleEdit = (contact) => {
        if (!isEditable) return;
        setEditingId(contact.id);
        setEditData({ ...contact });
    };

    const handleSave = async () => {
        try {
            const payload = {
                pv_id: editData.pv_id || null,
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
                        <p className="text-sm text-gray-500 dark:text-gray-400">Manage all project-related contacts and vendors.</p>
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
                <WorkflowPanel 
                    projectId={projectId} 
                    templateName="Project Directory" 
                    instanceId={workflowState.instanceId}
                    onStateChange={setWorkflowState} 
                    onRefreshContent={fetchDirectory} 
                />

                {loading ? (
                    <div className="flex items-center justify-center h-48 opacity-50 dark:text-white">Loading data...</div>
                ) : (
                        <div className="overflow-x-auto mt-4">
                            <table className="w-full text-left text-[13px] border-collapse bg-white dark:bg-[#0d1117] table-fixed min-w-[1200px]">
                                <colgroup>
                                    <col className="w-[50px]" />
                                    <col className="w-[60px]" />
                                    <col className="w-[220px]" />
                                    <col className="w-[180px]" />
                                    <col className="w-[180px]" />
                                    <col className="w-[160px]" />
                                    <col className="w-[200px]" />
                                    <col className="w-[140px]" />
                                    <col className="w-[200px]" />
                                    <col className="w-[220px]" />
                                    {isEditable && <col className="w-[120px]" />}
                                </colgroup>
                                <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-wide">
                                    <tr>
                                        <th className="px-3 py-3 text-center"></th>
                                        <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest text-center">Sl No.</th>
                                        <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest">Company Name</th>
                                        <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest">Job Nature</th>
                                        <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest">Person Name</th>
                                        <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest">Designation</th>
                                        <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest">Responsibilities</th>
                                        <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest">Mobile No</th>
                                        <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest">Email ID</th>
                                        <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest">Address</th>
                                        {isEditable && <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest text-center">Actions</th>}
                                    </tr>
                                </thead>
                                <Reorder.Group axis="y" values={contacts} onReorder={isEditable ? setContacts : () => {}} as="tbody" className="divide-y divide-gray-100 dark:divide-white/[0.03]">
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
                                                    className={`${isEditing ? 'bg-blue-50/10 dark:bg-blue-900/5' : 'hover:bg-blue-50/10 dark:hover:bg-blue-900/10'} transition-colors group/row h-[48px] cursor-default relative align-top`}
                                                >
                                                    <td className="px-3 py-4 text-center">
                                                        <div className="flex items-center justify-center">
                                                            <GripVertical size={14} className={`text-gray-300 dark:text-gray-700 group-hover/row:text-blue-500 transition-colors ${isEditable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`} />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-5 text-gray-500 dark:text-gray-600 font-mono text-[11px] text-center">
                                                        {String(idx + 1)}
                                                    </td>

                                                    {/* Company Name */}
                                                    <td className="px-4 py-4" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                        {isEditing ? (
                                                            <VendorSelector
                                                                value={editData.name}
                                                                onChange={handleVendorSelect}
                                                                projectVendors={globalVendors}
                                                            />
                                                        ) : (
                                                            <div className="text-gray-900 dark:text-gray-200 cursor-pointer font-medium py-1">
                                                                {contact.name || '-'}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Job Nature */}
                                                    <td className="px-4 py-4" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                        {isEditing ? (
                                                            <div className={`px-2 py-1.5 text-[11px] rounded border ${editData.nature ? 'text-blue-500 border-blue-500/30 bg-blue-500/10 dark:bg-blue-900/20 font-bold' : 'text-gray-400 border-gray-200 dark:border-white/10 italic'}`}>
                                                                {editData.nature || 'Auto-filled'}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-600 dark:text-gray-400 cursor-pointer py-1 font-medium">{contact.nature || '-'}</div>
                                                        )}
                                                    </td>

                                                    {/* Person Name */}
                                                    <td className="px-4 py-4" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                        {isEditing ? (
                                                            <ResizableInput
                                                                className="px-2 py-1 text-xs font-medium"
                                                                value={editData.person}
                                                                onChange={(e) => setEditData({ ...editData, person: e.target.value })}
                                                            />
                                                        ) : (
                                                            <div className="text-gray-600 dark:text-gray-400 cursor-pointer py-1">{contact.person || '-'}</div>
                                                        )}
                                                    </td>

                                                    {/* Designation */}
                                                    <td className="px-4 py-4" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                        {isEditing ? (
                                                            <ResizableInput
                                                                className="px-2 py-1 text-xs"
                                                                value={editData.designation}
                                                                onChange={(e) => setEditData({ ...editData, designation: e.target.value })}
                                                            />
                                                        ) : (
                                                            <div className="text-gray-600 dark:text-gray-400 cursor-pointer py-1">{contact.designation || '-'}</div>
                                                        )}
                                                    </td>

                                                    {/* Responsibilities */}
                                                    <td className="px-4 py-4" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                        {isEditing ? (
                                                            <textarea
                                                                className="w-full bg-white dark:bg-[#161b22] border border-blue-500/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded outline-none shadow-sm dark:text-white transition-all px-2 py-1 text-xs min-h-[60px] resize-none"
                                                                value={editData.responsibilities}
                                                                onChange={(e) => setEditData({ ...editData, responsibilities: e.target.value })}
                                                                placeholder="Enter responsibilities..."
                                                            />
                                                        ) : (
                                                            <div className="text-gray-600 dark:text-gray-400 cursor-pointer py-1 whitespace-pre-wrap leading-relaxed">{contact.responsibilities || '-'}</div>
                                                        )}
                                                    </td>

                                                    {/* Mobile No */}
                                                    <td className="px-4 py-4" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                        {isEditing ? (
                                                            <ResizableInput
                                                                className="px-2 py-1 text-xs"
                                                                value={editData.phone}
                                                                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                                            />
                                                        ) : (
                                                            <div className="text-gray-600 dark:text-gray-400 cursor-pointer py-1 font-mono">{contact.phone || '-'}</div>
                                                        )}
                                                    </td>

                                                    {/* Email ID */}
                                                    <td className="px-4 py-4" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                        {isEditing ? (
                                                            <ResizableInput
                                                                className="px-2 py-1 text-xs"
                                                                value={editData.email}
                                                                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                                            />
                                                        ) : (
                                                            <div className="text-blue-500 hover:underline cursor-pointer py-1 truncate">{contact.email || '-'}</div>
                                                        )}
                                                    </td>

                                                    {/* Address */}
                                                    <td className="px-4 py-4" onClick={() => isEditable && !isEditing && handleEdit(contact)}>
                                                        {isEditing ? (
                                                            <textarea
                                                                className="w-full bg-white dark:bg-[#161b22] border border-blue-500/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded outline-none shadow-sm dark:text-white transition-all px-2 py-1 text-xs min-h-[60px] resize-none"
                                                                value={editData.address}
                                                                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                                                                placeholder="Enter address..."
                                                            />
                                                        ) : (
                                                            <div className="text-gray-600 dark:text-gray-400 cursor-pointer py-1 whitespace-pre-wrap leading-relaxed">{contact.address || '-'}</div>
                                                        )}
                                                    </td>

                                                    {/* Actions */}
                                                    {isEditable && (
                                                        <td className="px-4 py-4 text-center">
                                                            {isEditing ? (
                                                                <div className="flex flex-col items-center justify-center space-y-2">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                                                        className="w-16 py-1 bg-blue-600 text-white rounded text-[11px] font-bold hover:bg-blue-700 transition-all shadow-md"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                                                                        className="w-16 py-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded text-[11px] font-bold hover:bg-gray-200 transition-all"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-center space-x-3 transition-opacity duration-200">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleEdit(contact); }}
                                                                        className="text-gray-400 hover:text-blue-500 transition-colors p-1 cursor-pointer"
                                                                    >
                                                                        <Edit2 size={15} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }}
                                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                                                    >
                                                                        <Trash2 size={15} />
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
