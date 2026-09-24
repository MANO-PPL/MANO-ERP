import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Plus,
    Info,
    X,
    Clock,
    Calendar,
    Loader2,
    CheckCircle2,
    Hourglass,
    TrendingUp,
    AlertCircle,
    Layers
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';
import { workflowApi } from '../../../services/workflowApi';
import { ExcelGrid } from '../../../components/ExcelGrid';
import CustomSelect from '../../../components/CustomSelect';
import CustomDatePicker from '../../../components/CustomDatePicker';
import { formatOrdinalDate } from '../../../utils/dateUtils';
import { toast } from 'react-toastify';

const normalizeDateToIso = (val) => {
    if (!val) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const str = String(val).trim();
    if (!str) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split('T')[0];
    const cleaned = str.replace(/(\d+)(st|nd|rd|th)/i, '$1');
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return str;
};

const STATUS_OPTIONS = [
    { label: 'Completed', value: 'completed' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Pending', value: 'pending' }
];

const ProjectSummary = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workflowState, setWorkflowState] = useState({
        mode: 'read',
        cycleId: null,
        instanceId: null,
        loading: false,
        notConfigured: true
    });

    const [statusFilter, setStatusFilter] = useState('All');
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [auditTrail, setAuditTrail] = useState([]);

    const isEditable = canWrite && (workflowState.notConfigured || (workflowState.mode === 'edit' && workflowState.cycleId));

    // Audit logs fetcher
    const fetchLogs = async (instanceId) => {
        if (!instanceId) return;
        try {
            const res = await workflowApi.getInstanceLogs(instanceId);
            if (res.success && res.logs) {
                const mappedLogs = res.logs.map((log) => {
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
            console.error('Failed to fetch logs:', err);
        }
    };

    useEffect(() => {
        if (isInfoOpen && workflowState.instanceId) {
            fetchLogs(workflowState.instanceId);
        }
    }, [isInfoOpen, workflowState.instanceId]);

    useEffect(() => {
        if (setExtraBreadcrumbs) {
            setExtraBreadcrumbs([{ label: 'Project Summary' }]);
        }
    }, [setExtraBreadcrumbs, projectId]);

    const fetchSummaries = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true);

            // Check if workflow is active and has an instance
            if (workflowState && workflowState.instanceId && !workflowState.notConfigured) {
                try {
                    let rows = [];
                    if (workflowState.cycleId) {
                        try {
                            const res = await workflowApi.getDraftContent(workflowState.instanceId);
                            rows = res.content_tables?.proj_summary || [];
                        } catch {
                            const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                            rows = res.content?.proj_summary || [];
                        }
                    } else {
                        const res = await workflowApi.getApprovedContent(workflowState.instanceId);
                        rows = res.content?.proj_summary || [];
                    }

                    if (rows.length > 0) {
                        const mappedSummaries = rows.map((s) => ({
                            id: s.id,
                            activity: s.title || '',
                            title: s.title || '',
                            date: s.date ? String(s.date).split('T')[0] : '',
                            status: s.status || 'pending',
                            remarks: s.details || '',
                            details: s.details || ''
                        }));
                        setMilestones(mappedSummaries);
                        return;
                    }
                } catch (err) {
                    console.log('No approved/draft workflow content, falling back to base API', err);
                }
            }

            // Normal fetch from base summaries API
            const data = await generalDocsApi.getSummaries(projectId);
            if (data && data.summaries) {
                const mappedSummaries = data.summaries.map((s) => ({
                    id: s.id,
                    activity: s.title || '',
                    title: s.title || '',
                    date: s.date ? String(s.date).split('T')[0] : '',
                    status: s.status || 'pending',
                    remarks: s.details || '',
                    details: s.details || ''
                }));
                setMilestones(mappedSummaries);
            }
        } catch (error) {
            console.error('Failed to fetch summaries:', error);
            toast.error('Failed to load project summary milestones');
        } finally {
            setLoading(false);
        }
    }, [projectId, workflowState]);

    useEffect(() => {
        if (workflowState.loading) return;
        fetchSummaries();
    }, [projectId, workflowState.loading, workflowState.instanceId, workflowState.cycleId, fetchSummaries]);

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        const total = milestones.length;
        const completed = milestones.filter((m) => m.status === 'completed').length;
        const inProgress = milestones.filter((m) => m.status === 'in_progress').length;
        const pending = milestones.filter((m) => m.status === 'pending').length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, inProgress, pending, percentage };
    }, [milestones]);

    // Filtered data for ExcelGrid
    const filteredMilestones = useMemo(() => {
        if (statusFilter === 'All') return milestones;
        return milestones.filter((m) => (m.status || '').toLowerCase() === statusFilter.toLowerCase());
    }, [milestones, statusFilter]);

    // Column Definitions for ExcelGrid
    const columns = useMemo(
        () => [
            {
                key: 'activity',
                label: 'Activity / Milestone Description',
                required: true,
                width: '320px',
                minWidth: '240px',
                aliases: ['activity', 'milestone', 'title', 'task', 'description', 'phase'],
                renderCell: (val) => (
                    <span className="font-semibold text-slate-900 dark:text-white truncate block py-0.5">
                        {val || '-'}
                    </span>
                )
            },
            {
                key: 'date',
                label: 'Target Date',
                type: 'date',
                required: true,
                width: '185px',
                minWidth: '170px',
                align: 'center',
                aliases: ['date', 'target_date', 'due_date', 'deadline', 'target'],
                renderCell: (val, row, column, onChange) => {
                    const rawVal = val !== undefined && val !== null ? val : row.date;
                    const dateStr = rawVal ? String(rawVal).split('T')[0] : '';
                    const formatted = dateStr ? formatOrdinalDate(dateStr) : '';

                    return (
                        <div
                            className="w-full flex items-center justify-center py-0.5"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <CustomDatePicker
                                value={dateStr}
                                displayValue={formatted}
                                placeholder="Select Date"
                                disabled={!isEditable}
                                onChange={(e) => {
                                    const nextVal = typeof e === 'object' && e?.target ? e.target.value : e;
                                    if (onChange) onChange(nextVal);
                                }}
                                buttonClassName="w-full h-7 px-2.5 bg-slate-50/70 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 hover:border-blue-400 dark:hover:border-blue-500 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-1.5 transition cursor-pointer shadow-2xs"
                            />
                        </div>
                    );
                }
            },
            {
                key: 'status',
                label: 'Status',
                type: 'select',
                options: STATUS_OPTIONS,
                placeholder: '-- Select Status --',
                width: '160px',
                minWidth: '140px',
                aliases: ['status', 'state', 'progress'],
                renderCell: (val, row, column, onChange) => {
                    const currentVal = val || 'pending';
                    const badgeStyles = {
                        completed: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
                        in_progress: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
                        pending: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
                    };
                    const dotStyles = {
                        completed: 'bg-emerald-500',
                        in_progress: 'bg-blue-500 animate-pulse',
                        pending: 'bg-amber-500'
                    };

                    return (
                        <div
                            className="w-full flex items-center"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <CustomSelect
                                value={currentVal}
                                options={STATUS_OPTIONS}
                                disabled={!isEditable}
                                onChange={(e) => {
                                    const selected = typeof e === 'object' && e?.target ? e.target.value : e;
                                    onChange(selected);
                                }}
                                className="w-full"
                                buttonClassName={`w-full flex items-center justify-between px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer h-6 shadow-2xs ${badgeStyles[currentVal] || badgeStyles.pending}`}
                            />
                        </div>
                    );
                },
                renderEditor: (value, row, column, onChange, onBlur) => (
                    <div
                        className="w-full"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <CustomSelect
                            value={value || 'pending'}
                            options={STATUS_OPTIONS}
                            disabled={!isEditable}
                            onChange={(e) => {
                                const selected = typeof e === 'object' && e?.target ? e.target.value : e;
                                onChange(selected);
                                if (onBlur) onBlur(selected);
                            }}
                            className="w-full"
                            buttonClassName="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-[#161b22] border border-blue-500 text-slate-900 dark:text-white h-7"
                        />
                    </div>
                )
            },
            {
                key: 'remarks',
                label: 'Remarks / Scope Notes',
                width: '360px',
                minWidth: '260px',
                aliases: ['remarks', 'details', 'notes', 'comments', 'scope'],
                renderCell: (val) => (
                    <span className="text-slate-600 dark:text-slate-400 text-xs py-0.5 truncate block">
                        {val || '-'}
                    </span>
                )
            }
        ],
        [isEditable]
    );

    // Batch Save Handler connecting to generalDocsApi or workflow draft
    const handleSaveBatch = async (payload) => {
        const { created = [], updated = [], deleted = [] } = payload;

        try {
            // Process created items
            const toCreate = created
                .filter((r) => (r.activity || r.title || '').trim())
                .map((r) => ({
                    title: (r.activity || r.title || '').trim(),
                    details: r.remarks || r.details || '',
                    status: r.status || 'pending',
                    date: normalizeDateToIso(r.date) || new Date().toISOString().split('T')[0]
                }));

            // Process updated items
            const toUpdate = updated
                .filter((r) => r.id && !String(r.id).startsWith('temp_'))
                .map((r) => ({
                    id: Number(r.id),
                    title: (r.activity || r.title || '').trim(),
                    details: r.remarks || r.details || '',
                    status: r.status || 'pending',
                    date: normalizeDateToIso(r.date) || null
                }));

            const toDelete = (deleted || []).map(Number).filter((n) => !isNaN(n));

            // If workflow cycle is active
            if (workflowState && workflowState.cycleId) {
                for (const delId of toDelete) {
                    await workflowApi.deleteSummaryDraft(workflowState.cycleId, delId);
                }
                for (const item of toCreate) {
                    await workflowApi.addSummaryDraft(workflowState.cycleId, item);
                }
                for (const item of toUpdate) {
                    await workflowApi.updateSummaryDraft(workflowState.cycleId, item.id, item);
                }
            } else {
                // Direct base API save
                const promises = [];
                if (toDelete.length > 0) {
                    promises.push(generalDocsApi.deleteSummaries(projectId, toDelete));
                }
                if (toCreate.length > 0) {
                    promises.push(generalDocsApi.addSummaries(projectId, toCreate));
                }
                if (toUpdate.length > 0) {
                    promises.push(generalDocsApi.updateSummaries(projectId, toUpdate));
                }
                await Promise.all(promises);
            }

            toast.success('Project summary milestones saved successfully');
            await fetchSummaries(true);
        } catch (error) {
            console.error('Failed to save summary batch:', error);
            toast.error(error.response?.data?.message || 'Failed to save changes');
            throw error;
        }
    };

    // Handler for "+ Add Row" from ExcelGrid
    const handleAddRows = (count = 1, position = 'top') => {
        const todayStr = new Date().toISOString().split('T')[0];
        const newRows = Array.from({ length: count }).map((_, idx) => ({
            id: `temp_milestone_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
            activity: '',
            date: todayStr,
            status: 'pending',
            remarks: '',
            _status: 'new'
        }));

        setMilestones((prev) => (position === 'bottom' ? [...prev, ...newRows] : [...newRows, ...prev]));
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden text-left relative font-sans">
            {/* ─── Executive KPI Milestone Strip ─── */}
            <div className="px-6 py-3 border-b border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-[#161b22]/50 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Total Milestones */}
                    <div
                        onClick={() => setStatusFilter('All')}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                            statusFilter === 'All'
                                ? 'bg-white dark:bg-[#1f242c] border-blue-500 shadow-sm ring-1 ring-blue-500'
                                : 'bg-white dark:bg-[#161b22] border-slate-200 dark:border-white/10 hover:border-slate-300'
                        }`}
                    >
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Total Milestones
                            </span>
                            <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                                {metrics.total}
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
                            <Layers size={16} />
                        </div>
                    </div>

                    {/* Completed */}
                    <div
                        onClick={() => setStatusFilter('completed')}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                            statusFilter.toLowerCase() === 'completed'
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                                : 'bg-white dark:bg-[#161b22] border-slate-200 dark:border-white/10 hover:border-emerald-300'
                        }`}
                    >
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                    Completed
                                </span>
                                <span className="text-[9px] font-bold px-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                                    {metrics.percentage}%
                                </span>
                            </div>
                            <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                                {metrics.completed}
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={16} />
                        </div>
                    </div>

                    {/* In Progress */}
                    <div
                        onClick={() => setStatusFilter('in_progress')}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                            statusFilter.toLowerCase() === 'in_progress'
                                ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-500 shadow-sm ring-1 ring-blue-500'
                                : 'bg-white dark:bg-[#161b22] border-slate-200 dark:border-white/10 hover:border-blue-300'
                        }`}
                    >
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                                In Progress
                            </span>
                            <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                                {metrics.inProgress}
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-blue-100/80 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Clock size={16} />
                        </div>
                    </div>

                    {/* Pending */}
                    <div
                        onClick={() => setStatusFilter('pending')}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                            statusFilter.toLowerCase() === 'pending'
                                ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-500 shadow-sm ring-1 ring-amber-500'
                                : 'bg-white dark:bg-[#161b22] border-slate-200 dark:border-white/10 hover:border-amber-300'
                        }`}
                    >
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                Pending
                            </span>
                            <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                                {metrics.pending}
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-amber-100/80 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <Hourglass size={16} />
                        </div>
                    </div>
                </div>

                {/* Overall Progress Bar */}
                <div className="mt-2.5 flex items-center gap-3">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        Overall Milestone Progress:
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden relative">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 ease-out"
                            style={{ width: `${metrics.percentage}%` }}
                        />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0 font-mono">
                        {metrics.percentage}%
                    </span>
                </div>
            </div>

            {/* ─── Excel Spreadsheet Grid ─── */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
                <ExcelGrid
                    data={filteredMilestones}
                    columns={columns}
                    primaryKey="id"
                    entityName="Milestones"
                    canWrite={isEditable}
                    isLoading={loading}
                    onSave={handleSaveBatch}
                    onRefresh={() => fetchSummaries(false)}
                    onAddRows={handleAddRows}
                    emptyMessage="No project milestones found. Click '+ Add Row' to define your first project milestone."
                    extraFilters={
                        <div className="flex items-center gap-1.5 py-0.5">
                            {['All', 'completed', 'in_progress', 'pending'].map((status) => {
                                const isSelected = statusFilter.toLowerCase() === status.toLowerCase();
                                const label =
                                    status === 'All'
                                        ? 'All'
                                        : status === 'in_progress'
                                            ? 'In Progress'
                                            : status.charAt(0).toUpperCase() + status.slice(1);
                                return (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setStatusFilter(status)}
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer border ${
                                            isSelected
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-blue-400'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    }
                    extraTools={
                        <button
                            type="button"
                            onClick={() => setIsInfoOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
                            title="View audit trail and revision logs"
                        >
                            <Info size={13} className="text-blue-500" />
                            <span>Audit Trail</span>
                        </button>
                    }
                />
            </div>

            {/* ─── Audit Trail Slide-out Drawer ─── */}
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
                            className="fixed right-0 top-0 h-full w-[380px] bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-white/10 shadow-2xl z-[101] flex flex-col font-sans"
                        >
                            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-[#161b22]">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Info size={20} className="text-blue-500" />
                                    </div>
                                    <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                        Audit Trail & Revision History
                                    </h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsInfoOpen(false)}
                                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {auditTrail.length > 0 ? (
                                    auditTrail.map((log) => (
                                        <div key={log.id} className="relative pl-8 pb-2">
                                            <div className="absolute left-3 top-2 bottom-0 w-[1px] bg-slate-200 dark:bg-white/10" />
                                            <div
                                                className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white dark:border-[#0d1117] z-10 flex items-center justify-center ${
                                                    log.type === 'create'
                                                        ? 'bg-emerald-500/20 text-emerald-500'
                                                        : log.type === 'update'
                                                            ? 'bg-blue-500/20 text-blue-500'
                                                            : 'bg-rose-500/20 text-rose-500'
                                                }`}
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                                                    {log.action}
                                                </p>
                                                <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                                                    <span className="font-medium text-slate-600 dark:text-slate-400">
                                                        {log.user}
                                                    </span>
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
                                    <div className="text-center text-slate-400 text-xs py-8">
                                        No revision logs recorded for this summary instance yet.
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#161b22]/50">
                                <button
                                    type="button"
                                    onClick={() => setIsInfoOpen(false)}
                                    className="w-full py-2 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition border border-slate-300 dark:border-white/10 cursor-pointer"
                                >
                                    Close Panel
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
