import React, { useEffect, useState } from 'react';
import { Plus, Edit2, GripVertical, Trash2, Info, X, Clock, ArrowLeft } from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';
import WorkflowPanel from '../../../components/WorkflowPanel';
import { workflowApi } from '../../../services/workflowApi';
import { toast } from 'react-toastify';

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

const ProjectSummary = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workflowState, setWorkflowState] = useState({ mode: 'read', cycleId: null, loading: true });

    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState(null);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [auditTrail, setAuditTrail] = useState([]);

    const isEditable = canWrite && (workflowState.notConfigured || (workflowState.mode === 'edit' && workflowState.cycleId));

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
            { label: 'Project Summary' }
        ]);
    }, [onBack, setExtraBreadcrumbs, projectId]);

    useEffect(() => {
        if (workflowState.loading) return;
        fetchSummaries();
    }, [projectId, workflowState.loading, workflowState.instanceId, workflowState.cycleId]);

    const fetchSummaries = async (silent = false) => {
        let isSilent = silent;
        if (typeof silent === 'boolean') {
            isSilent = silent;
        } else {
            isSilent = false;
        }

        try {
            if (milestones.length === 0 && !isSilent) setLoading(true);

            // Check if workflow is active and has an instance
            if (workflowState && workflowState.instanceId && !workflowState.notConfigured) {
                try {
                    let rows = [];
                    // Try getting draft content if there is an active cycle
                    if (workflowState.cycleId) {
                        try {
                            const res = await workflowApi.getDraftContent(workflowState.instanceId);
                            rows = res.content_tables?.pdoc_summary || [];
                        } catch (err) {
                            // Fall back to approved if draft is not accessible
                            const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                            rows = res.content?.pdoc_summary || [];
                        }
                    } else {
                        const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                        rows = res.content?.pdoc_summary || [];
                    }

                    // If no workflow content yet, fall back to base summaries
                    if (rows.length === 0) {
                        const data = await generalDocsApi.getSummaries(projectId);
                        if (data && data.summaries) {
                            const mappedSummaries = data.summaries.map(s => ({
                                id: s.id,
                                activity: s.title,
                                date: s.date,
                                status: s.status,
                                remarks: s.details
                            }));
                            setMilestones(mappedSummaries);
                            setLoading(false);
                            return;
                        }
                    }

                    const mappedSummaries = rows.map(s => ({
                        id: s.id,
                        activity: s.title,
                        date: s.date,
                        status: s.status,
                        remarks: s.details
                    }));
                    setMilestones(mappedSummaries);
                    setLoading(false);
                    return;
                } catch (err) {
                    console.log("No approved/draft workflow content, falling back to base API", err);
                }
            }

            // Normal fallback if workflow is not configured/initialized
            const data = await generalDocsApi.getSummaries(projectId);
            if (data && data.summaries) {
                const mappedSummaries = data.summaries.map(s => ({
                    id: s.id,
                    activity: s.title,
                    date: s.date,
                    status: s.status,
                    remarks: s.details
                }));
                setMilestones(mappedSummaries);
            }
        } catch (error) {
            console.error("Failed to fetch summaries:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        if (!isEditable) return;
        const newRecord = {
            id: `new-${Date.now()}`,
            activity: '',
            date: '',
            status: 'in_progress',
            remarks: '',
            isNew: true
        };
        setMilestones([...milestones, newRecord]);
        setEditingId(newRecord.id);
        setEditData(newRecord);
    };

    const handleEdit = (milestone) => {
        if (!isEditable) return;
        setEditingId(milestone.id);
        setEditData({ ...milestone });
    };

    const handleSave = async () => {
        try {
            let formattedDate = editData.date ? editData.date.split('T')[0] : null;
            const payload = {
                title: editData.activity,
                date: formattedDate,
                status: editData.status,
                details: editData.remarks
            };

            if (workflowState && workflowState.cycleId) {
                if (editData.isNew) {
                    await workflowApi.addSummaryDraft(workflowState.cycleId, payload);
                } else {
                    await workflowApi.updateSummaryDraft(workflowState.cycleId, editData.id, payload);
                }
            } else {
                if (editData.isNew) {
                    await generalDocsApi.addSummaries(projectId, [payload]);
                } else {
                    await generalDocsApi.updateSummaries(projectId, [{
                        id: editData.id,
                        ...payload
                    }]);
                }
            }
            await fetchSummaries();
            setEditingId(null);
            setEditData(null);
        } catch (error) {
            console.error("Failed to save summary:", error);
            toast.error("Failed to save summary");
        }
    };

    const handleCancel = () => {
        if (editData?.isNew) {
            setMilestones(prev => prev.filter(m => m.id !== editData.id));
        }
        setEditingId(null);
        setEditData(null);
    };

    const handleDelete = async (id) => {
        try {
            if (workflowState && workflowState.cycleId) {
                await workflowApi.deleteSummaryDraft(workflowState.cycleId, id);
            } else {
                await generalDocsApi.deleteSummaries(projectId, [id]);
            }
            await fetchSummaries();
        } catch (error) {
            console.error("Failed to delete summary:", error);
            toast.error("Failed to delete summary");
        }
    };

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
                        <h1 className="text-2xl font-medium text-gray-900 dark:text-white">Project Summary</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">High-level overview and milestones of the project.</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {isEditable && (
                        <button onClick={handleAdd} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[12px] font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer">
                            <Plus size={16} />
                            <span>Add milestone</span>
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
            <div className="flex-1 overflow-auto no-scrollbar p-6">
                <WorkflowPanel 
                    projectId={projectId} 
                    templateName="Project Summary" 
                    instanceId={workflowState.instanceId}
                    onStateChange={setWorkflowState} 
                    onRefreshContent={fetchSummaries} 
                />

                {loading ? (
                    <div className="flex items-center justify-center h-48 opacity-50 dark:text-white">Loading data...</div>
                ) : (
                    <div className="min-w-full inline-block align-middle pb-20 mt-4">
                        <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                            <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-wide">
                                <tr>
                                    <th className="px-3 py-3 w-6 text-center"></th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5 w-16 text-center">S. no.</th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5">Activity / milestone</th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5">Date</th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5">Status</th>
                                    <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest border-r border-gray-100 dark:border-white/5">Remarks</th>
                                    {isEditable && <th className="px-4 py-3 font-medium capitalize text-[10px] tracking-widest text-center">Actions</th>}
                                </tr>
                            </thead>
                            <Reorder.Group axis="y" values={milestones} onReorder={isEditable ? setMilestones : () => {}} as="tbody" className="divide-y divide-gray-100 dark:divide-white/[0.03]">
                                <AnimatePresence initial={false}>
                                    {milestones.map((milestone, idx) => {
                                        const isEditing = editingId === milestone.id;
                                        const displayDate = milestone.date ? milestone.date.split('T')[0] : '';
                                        return (
                                            <Reorder.Item
                                                key={milestone.id}
                                                value={milestone}
                                                as="tr"
                                                onMouseEnter={() => setHoveredRow(milestone.id)}
                                                onMouseLeave={() => setHoveredRow(null)}
                                                className={`${isEditing ? 'bg-blue-50/10 dark:bg-blue-900/5' : 'hover:bg-blue-50/10 dark:hover:bg-blue-900/10'} transition-colors group/row h-[52px] cursor-default relative`}
                                            >
                                                <td className="px-3 py-2 text-center w-6 min-w-[40px]">
                                                    <div className="flex items-center justify-center">
                                                        <GripVertical size={14} className={`text-gray-300 dark:text-gray-700 group-hover/row:text-blue-500 transition-colors ${isEditable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-gray-500 dark:text-gray-600 font-mono text-[11px] border-r border-gray-100 dark:border-white/[0.03] text-center w-16">
                                                    {String(idx + 1)}
                                                </td>

                                                {/* Activity Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]" onClick={() => !isEditing && handleEdit(milestone)}>
                                                    {isEditing ? (
                                                        <ResizableInput
                                                            autoFocus
                                                            className="px-2 py-1 text-xs"
                                                            value={editData.activity}
                                                            onChange={(e) => setEditData({ ...editData, activity: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-900 dark:text-gray-200 cursor-pointer font-medium">
                                                            {milestone.activity || '-'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Date Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]" onClick={() => !isEditing && handleEdit(milestone)}>
                                                    {isEditing ? (
                                                        <input
                                                            type="date"
                                                            className="px-2 py-1 text-xs bg-white dark:bg-[#161b22] border border-blue-500/50 rounded outline-none text-gray-900 dark:text-white"
                                                            value={editData.date ? editData.date.split('T')[0] : ''}
                                                            onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-600 dark:text-gray-400 cursor-pointer">{displayDate || '-'}</span>
                                                    )}
                                                </td>

                                                {/* Status Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]" onClick={() => !isEditing && handleEdit(milestone)}>
                                                    {isEditing ? (
                                                        <select
                                                            className="px-2 py-1 text-xs bg-white dark:bg-[#161b22] border border-blue-500/50 rounded outline-none text-gray-900 dark:text-white"
                                                            value={editData.status || 'pending'}
                                                            onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                                        >
                                                            <option value="completed">Completed</option>
                                                            <option value="in_progress">In Progress</option>
                                                            <option value="pending">Pending</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-sm transition-all ${
                                                            milestone.status === 'completed' 
                                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                                                            milestone.status === 'in_progress' 
                                                                ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                                                                'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                                            }`}>
                                                            {milestone.status?.replace('_', ' ') || '-'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Remarks Field */}
                                                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/[0.03]" onClick={() => !isEditing && handleEdit(milestone)}>
                                                    {isEditing ? (
                                                        <ResizableInput
                                                            className="px-2 py-1 text-xs"
                                                            minW="150px"
                                                            value={editData.remarks}
                                                            onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-600 dark:text-gray-400 cursor-pointer">{milestone.remarks || '-'}</span>
                                                    )}
                                                </td>

                                                {/* Actions Column */}
                                                {isEditable && (
                                                    <td className="px-4 py-2 text-center min-w-[120px]">
                                                        {isEditing ? (
                                                            <div className="flex items-center justify-center space-x-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                                                    className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                                                                    className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded text-[11px] font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className={`flex items-center justify-center space-x-3 transition-opacity duration-200 opacity-100`}>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEdit(milestone); }}
                                                                    className="text-gray-400 hover:text-blue-500 transition-colors p-1 cursor-pointer"
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(milestone.id); }}
                                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                                                                    title="Delete"
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
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all outline-none cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {auditTrail.length > 0 ? (
                                    auditTrail.map((log) => (
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
                                    ))
                                ) : (
                                    <div className="text-center text-gray-400 text-xs py-8">
                                        No logs available for this instance.
                                    </div>
                                )}
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

export default ProjectSummary;
