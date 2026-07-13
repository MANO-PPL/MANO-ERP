import React, { useEffect, useState, useRef } from 'react';
import { Plus, GripVertical, Trash2, Info, X, Clock, ArrowLeft, Search, Check } from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';
import WorkflowPanel from '../../../components/WorkflowPanel';
import { workflowApi } from '../../../services/workflowApi';
import { toast } from 'react-toastify';

const ProjectVendorList = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workflowState, setWorkflowState] = useState({ mode: 'read', cycleId: null });

    const [isAdding, setIsAdding] = useState(false);
    const [globalVendors, setGlobalVendors] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [hoveredRow, setHoveredRow] = useState(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const dropdownRef = useRef(null);

    const isEditable = canWrite && (workflowState.notConfigured || (workflowState.mode === 'edit' && workflowState.cycleId));

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

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'General Documents', onClick: onBack },
            { label: 'Project Vendor List' }
        ]);
        fetchGlobalVendors();
    }, [onBack, setExtraBreadcrumbs, projectId]);

    useEffect(() => {
        fetchVendors();
    }, [workflowState, projectId]);

    // Handle clicking outside of dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsAdding(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchVendors = async () => {
        try {
            setLoading(true);
            
            // Check if workflow is active and has an instance
            if (workflowState && workflowState.instanceId && !workflowState.notConfigured) {
                try {
                    let rows = [];
                    // Try getting draft content if there is an active cycle
                    if (workflowState.cycleId) {
                        try {
                            const res = await workflowApi.getDraftContent(workflowState.instanceId);
                            rows = res.content_tables?.pdoc_vendors || [];
                        } catch (err) {
                            // Fall back to approved if draft is not accessible
                            const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                            rows = res.content?.pdoc_vendors || [];
                        }
                    } else {
                        const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                        rows = res.content?.pdoc_vendors || [];
                    }

                    // If no workflow content yet, fall back to base project vendors
                    if (rows.length === 0) {
                        const data = await generalDocsApi.getVendors(projectId);
                        if (data && data.vendors) {
                            const mappedVendors = data.vendors.map(v => ({
                                id: v.pv_id,
                                vendors_id: v.vendors_id,
                                name: v.name,
                                person: v.contact_person,
                                phone: v.mobile,
                                email: v.email,
                                trade: v.job_nature
                            }));
                            setVendors(mappedVendors);
                            setLoading(false);
                            return;
                        }
                    }

                    const mappedVendors = rows.map(v => ({
                        id: v.pv_id,
                        vendors_id: v.vendors_id,
                        name: v.name,
                        person: v.contact_person,
                        phone: v.mobile,
                        email: v.email,
                        trade: v.job_nature
                    }));
                    setVendors(mappedVendors);
                    setLoading(false);
                    return;
                } catch (err) {
                    console.log("No approved/draft workflow content, falling back to base API", err);
                    // Fall through to base API below
                }
            }

            // Normal fallback if workflow is not configured/initialized
            const data = await generalDocsApi.getVendors(projectId);
            if (data && data.vendors) {
                const mappedVendors = data.vendors.map(v => ({
                    id: v.pv_id,
                    vendors_id: v.vendors_id,
                    name: v.name,
                    person: v.contact_person,
                    phone: v.mobile,
                    email: v.email,
                    trade: v.job_nature
                }));
                setVendors(mappedVendors);
            }
        } catch (error) {
            console.error("Failed to fetch vendors:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchGlobalVendors = async () => {
        try {
            const data = await generalDocsApi.getGlobalVendors({ limit: 5000 });
            if (data && data.vendors) {
                setGlobalVendors(data.vendors);
            }
        } catch (error) {
            console.error("Failed to fetch global vendors:", error);
        }
    };

    const handleAddVendor = async (vendorId) => {
        try {
            if (workflowState && workflowState.cycleId) {
                const gv = globalVendors.find(v => v.id === vendorId);
                await workflowApi.addVendorDraft(workflowState.cycleId, {
                    vendors_id: vendorId,
                    name: gv?.name,
                    contact_person: gv?.contact_person,
                    mobile: gv?.mobile,
                    email: gv?.email,
                    job_nature: gv?.job_nature
                });
            } else {
                await generalDocsApi.addVendor(projectId, [vendorId]);
            }
            await fetchVendors();
            setIsAdding(false);
            setSearchTerm('');
        } catch (error) {
            console.error("Failed to add vendor to project:", error);
            toast.error("Failed to add vendor to cycle");
        }
    };

    const handleDelete = async (id) => {
        try {
            if (workflowState && workflowState.cycleId) {
                await workflowApi.deleteVendorDraft(workflowState.cycleId, id);
            } else {
                await generalDocsApi.deleteVendor(projectId, id);
            }
            await fetchVendors();
        } catch (error) {
            console.error("Failed to delete vendor:", error);
            toast.error("Failed to delete vendor");
        }
    };

    // Filter global vendors that are NOT already in the project
    const filteredGlobalVendors = globalVendors.filter(gv => {
        const alreadyInProject = vendors.some(v => v.vendors_id === gv.id);
        const matchesSearch = gv.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             gv.job_nature?.toLowerCase().includes(searchTerm.toLowerCase());
        return !alreadyInProject && matchesSearch;
    });

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left relative">
            {/* Toolbar Area */}
            <div className="flex justify-between items-center px-8 py-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0d1117] z-20">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition-all active:scale-95 group cursor-pointer"
                        title="Back to list"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-medium text-gray-900 dark:text-white">Project Vendor List</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Directory of approved vendors and contractors for this project.</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3 relative" ref={dropdownRef}>
                    {isEditable && (
                        <button 
                            onClick={() => setIsAdding(!isAdding)} 
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[12px] font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                        >
                            <Plus size={16} />
                            <span>Add vendor</span>
                        </button>
                    )}

                    {/* Searchable Dropdown */}
                    <AnimatePresence>
                        {isAdding && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                            >
                                <div className="p-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#0d1117]/50">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Search approved vendors..."
                                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 transition-all dark:text-white"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                    {filteredGlobalVendors.length > 0 ? (
                                        filteredGlobalVendors.map(gv => (
                                            <button
                                                key={gv.id}
                                                onClick={() => handleAddVendor(gv.id)}
                                                className="w-full px-4 py-3 flex flex-col items-start hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-50 dark:border-white/5 text-left group cursor-pointer"
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{gv.name}</span>
                                                    <Plus size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Trade: {gv.job_nature || 'General'}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-xs">
                                            {searchTerm ? 'No matching vendors found' : 'No available vendors to add'}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={() => setIsInfoOpen(true)}
                        className="p-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-white/10 rounded-md transition-all active:scale-95 cursor-pointer"
                        title="View Audit Trail"
                    >
                        <Info size={18} />
                    </button>
                </div>
            </div>

            {/* List View - Task Theme Style */}
            <div className="flex-1 overflow-auto custom-scrollbar p-6">
                <WorkflowPanel 
                    projectId={projectId} 
                    templateName="Project Vendor List" 
                    onStateChange={setWorkflowState} 
                    onRefreshContent={fetchVendors} 
                />

                {loading ? (
                    <div className="flex items-center justify-center h-48 opacity-50 dark:text-white">Loading data...</div>
                ) : (
                    <div className="min-w-full inline-block align-middle pb-20 mt-4">
                        <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                            <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-wide">
                                <tr>
                                    <th className="px-3 py-3 w-6 text-center"></th>
                                    <th className="px-4 py-3 font-medium normal-case text-[10px] tracking-normal border-r border-gray-100 dark:border-white/5 w-16 text-center">S. no.</th>
                                    <th className="px-4 py-3 font-medium normal-case text-[10px] tracking-normal border-r border-gray-100 dark:border-white/5">Vendor name</th>
                                    <th className="px-4 py-3 font-medium normal-case text-[10px] tracking-normal border-r border-gray-100 dark:border-white/5">Contact person</th>
                                    <th className="px-4 py-3 font-medium normal-case text-[10px] tracking-normal border-r border-gray-100 dark:border-white/5">Mobile no</th>
                                    <th className="px-4 py-3 font-medium normal-case text-[10px] tracking-normal border-r border-gray-100 dark:border-white/5">Email id</th>
                                    <th className="px-4 py-3 font-medium normal-case text-[10px] tracking-normal border-r border-gray-100 dark:border-white/5">Trade / service</th>
                                    {isEditable && <th className="px-4 py-3 font-medium normal-case text-[10px] tracking-normal text-center">Actions</th>}
                                </tr>
                            </thead>
                            <Reorder.Group axis="y" values={vendors} onReorder={isEditable ? setVendors : () => {}} as="tbody" className="divide-y divide-gray-100 dark:divide-white/[0.03]">
                                <AnimatePresence initial={false}>
                                    {vendors.map((vendor, idx) => {
                                        return (
                                            <Reorder.Item
                                                key={vendor.id}
                                                value={vendor}
                                                as="tr"
                                                onMouseEnter={() => setHoveredRow(vendor.id)}
                                                onMouseLeave={() => setHoveredRow(null)}
                                                className={`hover:bg-blue-50/10 dark:hover:bg-blue-900/10 transition-colors group/row h-[52px] cursor-default relative`}
                                            >
                                                <td className="px-3 py-2 text-center w-6 min-w-[40px]">
                                                    <div className="flex items-center justify-center">
                                                        <GripVertical size={14} className={`text-gray-300 dark:text-gray-700 group-hover/row:text-blue-500 transition-colors ${isEditable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-gray-500 dark:text-gray-600 font-mono text-[11px] border-r border-gray-100 dark:border-white/[0.03] text-center w-16">
                                                    {String(idx + 1)}
                                                </td>

                                                {/* Vendor Name Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]">
                                                    <span className="text-gray-900 dark:text-gray-200 font-bold">
                                                        {vendor.name || '-'}
                                                    </span>
                                                </td>

                                                {/* Contact Person Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]">
                                                    <span className="text-gray-600 dark:text-gray-400">{vendor.person || '-'}</span>
                                                </td>

                                                {/* Mobile Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]">
                                                    <span className="text-gray-600 dark:text-gray-400">{vendor.phone || '-'}</span>
                                                </td>

                                                {/* Email Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]">
                                                    <span className="text-blue-500 hover:underline">{!vendor.email || vendor.email === '-' ? '' : vendor.email}</span>
                                                </td>

                                                {/* Trade Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]">
                                                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-sm bg-blue-500/10 text-blue-500 border-blue-500/30">
                                                        {vendor.trade || '-'}
                                                    </span>
                                                </td>

                                                {/* Actions Column */}
                                                {isEditable && (
                                                    <td className="px-4 py-2 text-center min-w-[120px]">
                                                        <div className={`flex items-center justify-center space-x-3 transition-opacity duration-200 opacity-100`}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(vendor.id); }}
                                                                className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                                                title="Remove from Project"
                                                            >
                                                                 <Trash2 size={14} />
                                                            </button>
                                                        </div>
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
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all outline-none cursor-pointer"
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

export default ProjectVendorList;
