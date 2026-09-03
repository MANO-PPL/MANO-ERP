import React, { useEffect, useState } from 'react';
import { Plus, Edit2, GripVertical, Trash2, Info, X, Clock, ArrowLeft, Calendar, Loader2, Flag } from 'lucide-react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';
import WorkflowPanel from '../../../components/WorkflowPanel';
import { workflowApi } from '../../../services/workflowApi';
import { toast } from 'react-toastify';

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

const ProjectSummary = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workflowState, setWorkflowState] = useState({ mode: 'read', cycleId: null, instanceId: null, loading: false, notConfigured: true });

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
            { label: 'Project Summary' }
        ]);
    }, [setExtraBreadcrumbs, projectId]);

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
                            rows = res.content_tables?.proj_summary || [];
                        } catch (err) {
                            // Fall back to approved if draft is not accessible
                            const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                            rows = res.content?.proj_summary || [];
                        }
                    } else {
                        const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                        rows = res.content?.proj_summary || [];
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
                {/* <WorkflowPanel 
                    projectId={projectId} 
                    templateName="Project Summary" 
                    instanceId={workflowState.instanceId}
                    onStateChange={setWorkflowState} 
                    onRefreshContent={fetchSummaries} 
                /> */}

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Loader2 className="animate-spin mb-3 text-blue-500" size={28} />
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Loading project milestones...</p>
                    </div>
                ) : milestones.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/30 p-12 text-center my-4">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                            <Flag size={26} />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Project Milestones Found</h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                            No milestone activities or key target dates have been added for this project yet.
                        </p>
                        {isEditable && (
                            <button
                                onClick={handleAdd}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                            >
                                <Plus size={15} />
                                <span>Add First Milestone</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="mt-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] shadow-xs overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse table-fixed min-w-[850px]">
                            <colgroup>
                                <col className="w-[45px]" />
                                <col className="w-[55px]" />
                                <col className="w-[280px]" />
                                <col className="w-[140px]" />
                                <col className="w-[140px]" />
                                <col className="w-[240px]" />
                                {isEditable && <col className="w-[110px]" />}
                            </colgroup>
                            <thead className="bg-gray-50/80 dark:bg-[#161b22] text-gray-600 dark:text-gray-300 sticky top-0 z-10 border-b border-gray-200 dark:border-white/10">
                                <tr>
                                    <th className="px-2 py-3 text-center"></th>
                                    <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-center text-gray-500 dark:text-gray-400">Sl No.</th>
                                    <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Activity / Milestone</th>
                                    <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Target Date</th>
                                    <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                                    <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Remarks</th>
                                    {isEditable && <th className="px-3 py-3 font-semibold text-[11px] uppercase tracking-wider text-center text-gray-500 dark:text-gray-400">Actions</th>}
                                </tr>
                            </thead>
                            <Reorder.Group axis="y" values={milestones} onReorder={isEditable ? setMilestones : () => { }} as="tbody" className="divide-y divide-gray-100 dark:divide-white/[0.04]">
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

                                                {/* Activity Field */}
                                                <td className="px-3 py-3" onClick={() => !isEditing && handleEdit(milestone)}>
                                                    {isEditing ? (
                                                        <StandardInput
                                                            autoFocus
                                                            placeholder="Activity / milestone description..."
                                                            value={editData.activity}
                                                            onChange={(e) => setEditData({ ...editData, activity: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-900 dark:text-white font-medium py-1 inline-block">
                                                            {milestone.activity || '-'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Date Field */}
                                                <td className="px-3 py-3" onClick={() => !isEditing && handleEdit(milestone)}>
                                                    {isEditing ? (
                                                        <input
                                                            type="date"
                                                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#161b22] border border-blue-500/60 focus:border-blue-500 rounded-md outline-none text-gray-900 dark:text-white"
                                                            value={editData.date ? editData.date.split('T')[0] : ''}
                                                            onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-600 dark:text-gray-400 py-1 inline-block">{displayDate || '-'}</span>
                                                    )}
                                                </td>

                                                {/* Status Field */}
                                                <td className="px-3 py-3" onClick={() => !isEditing && handleEdit(milestone)}>
                                                    {isEditing ? (
                                                        <select
                                                            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#161b22] border border-blue-500/60 focus:border-blue-500 rounded-md outline-none text-gray-900 dark:text-white"
                                                            value={editData.status || 'pending'}
                                                            onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                                        >
                                                            <option value="completed">Completed</option>
                                                            <option value="in_progress">In Progress</option>
                                                            <option value="pending">Pending</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border shadow-2xs ${milestone.status === 'completed'
                                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' :
                                                                milestone.status === 'in_progress'
                                                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25' :
                                                                    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                                            }`}>
                                                            {milestone.status?.replace('_', ' ') || '-'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Remarks Field */}
                                                <td className="px-3 py-3" onClick={() => !isEditing && handleEdit(milestone)}>
                                                    {isEditing ? (
                                                        <StandardInput
                                                            placeholder="Remarks / notes..."
                                                            value={editData.remarks}
                                                            onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-600 dark:text-gray-400 py-1 inline-block">{milestone.remarks || '-'}</span>
                                                    )}
                                                </td>

                                                {/* Actions Column */}
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
                                                                    onClick={(e) => { e.stopPropagation(); handleEdit(milestone); }}
                                                                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors cursor-pointer"
                                                                    title="Edit milestone"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(milestone.id); }}
                                                                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                                    title="Delete milestone"
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
