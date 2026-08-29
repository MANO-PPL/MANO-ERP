import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
    Milestone, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Calendar, Percent, 
    CheckCircle2, Clock, AlertTriangle, Search, Filter, LayoutList, BarChart3, Grid, 
    X, Layers, TrendingUp, Check, Info, ShieldCheck, ArrowRight, PieChart, Activity,
    Loader2, GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { toast } from 'react-toastify';
import { projectApi } from '../../services/projectApi';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomInput from '../../components/CustomInput';
import ConfirmModal from '../../components/ConfirmModal';

const Phases = ({ setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();
    const [project, setProject] = useState(null);
    const [phases, setPhases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // View & Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, COMPLETED, IN_PROGRESS, NOT_STARTED
    const [viewMode, setViewMode] = useState('gantt'); // 'gantt', 'grid'
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Delete Confirmation Modal State
    const [deleteConfirmState, setDeleteConfirmState] = useState({
        isOpen: false,
        phaseIdx: null,
        phaseName: '',
        isDeleting: false
    });

    // Sidebar Popup (Drawer) States
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingIdx, setEditingIdx] = useState(null); // null = creating new
    const [drawerForm, setDrawerForm] = useState({
        name: '',
        startDate: '',
        endDate: '',
        weight: '',
        progress: '0',
        description: ''
    });

    useEffect(() => {
        setExtraBreadcrumbs([]);
        fetchProjectData();
    }, [projectId, setExtraBreadcrumbs]);

    const fetchProjectData = async () => {
        try {
            setLoading(true);
            const res = await projectApi.getProject(projectId);
            if (res.success && res.project) {
                setProject(res.project);
                let meta = {};
                if (res.project.metadata) {
                    meta = typeof res.project.metadata === 'string' ? JSON.parse(res.project.metadata) : res.project.metadata;
                }
                const loadedPhases = (meta.phases || []).map((p, i) => ({
                    ...p,
                    id: p.id || `phase_${i}_${Date.now()}`
                }));
                setPhases(loadedPhases);
            }
        } catch (error) {
            console.error("Failed to fetch project for phases", error);
            toast.error("Failed to load project phases data.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToDatabase = async (updatedPhases) => {
        if (!project) return;
        setIsSaving(true);
        try {
            // Calculate overall weighted completion
            const overallProgress = updatedPhases.reduce((acc, p) => {
                const progress = parseFloat(p.progress) || 0;
                const weight = parseFloat(p.weight) || 0;
                return acc + (progress * (weight / 100));
            }, 0);

            let meta = {};
            if (project.metadata) {
                meta = typeof project.metadata === 'string' ? JSON.parse(project.metadata) : project.metadata;
            }

            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: project.status,
                project_code: project.project_code,
                start_date: project.start_date,
                end_date: project.end_date,
                metadata: {
                    ...meta,
                    phases: updatedPhases,
                    completion: Math.round(overallProgress)
                }
            };

            const res = await projectApi.updateProject(project.id, updatedPayload);
            if (res.success) {
                setProject(prev => ({
                    ...prev,
                    metadata: updatedPayload.metadata
                }));
                toast.success("Project phases updated successfully!");
            }
        } catch (error) {
            console.error("Failed to save phases to database", error);
            toast.error("Failed to save changes. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    // Open Sidebar Popup (Drawer) for Creating
    const handleOpenCreateDrawer = () => {
        const remainingWeight = Math.max(0, 100 - phases.reduce((acc, p) => acc + (parseFloat(p.weight) || 0), 0));
        setEditingIdx(null);
        setDrawerForm({
            name: '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: '',
            weight: remainingWeight > 0 ? remainingWeight.toString() : '10',
            progress: '0',
            description: ''
        });
        setIsDrawerOpen(true);
    };

    // Open Sidebar Popup (Drawer) for Editing
    const handleOpenEditDrawer = (idx, phase) => {
        setEditingIdx(idx);
        setDrawerForm({
            name: phase.name || '',
            startDate: phase.startDate || '',
            endDate: phase.endDate || '',
            weight: phase.weight !== undefined ? phase.weight.toString() : '0',
            progress: phase.progress !== undefined ? phase.progress.toString() : '0',
            description: phase.description || ''
        });
        setIsDrawerOpen(true);
    };

    // Save Drawer Form
    const handleSaveDrawer = async (e) => {
        e?.preventDefault();
        if (!drawerForm.name.trim()) {
            return toast.warning("Phase Name is required.");
        }

        const weightVal = parseFloat(drawerForm.weight) || 0;
        const progressVal = Math.min(100, Math.max(0, parseFloat(drawerForm.progress) || 0));

        let updatedPhases = [...phases];

        if (editingIdx === null) {
            // Create New
            const newPhase = {
                id: Date.now(),
                name: drawerForm.name.trim(),
                startDate: drawerForm.startDate,
                endDate: drawerForm.endDate,
                weight: weightVal,
                progress: progressVal,
                description: drawerForm.description.trim()
            };
            updatedPhases.push(newPhase);
        } else {
            // Update Existing
            updatedPhases[editingIdx] = {
                ...updatedPhases[editingIdx],
                name: drawerForm.name.trim(),
                startDate: drawerForm.startDate,
                endDate: drawerForm.endDate,
                weight: weightVal,
                progress: progressVal,
                description: drawerForm.description.trim()
            };
        }

        setPhases(updatedPhases);
        setIsDrawerOpen(false);
        await handleSaveToDatabase(updatedPhases);
    };

    // Quick Inline Progress Change
    const handleProgressChange = async (idx, newProgress) => {
        const updatedPhases = [...phases];
        updatedPhases[idx] = {
            ...updatedPhases[idx],
            progress: parseFloat(newProgress) || 0
        };
        setPhases(updatedPhases);
        await handleSaveToDatabase(updatedPhases);
    };

    const handleDeletePhase = (idx) => {
        const targetPhase = phases[idx];
        if (!targetPhase) return;
        setDeleteConfirmState({
            isOpen: true,
            phaseIdx: idx,
            phaseName: targetPhase.name || `Phase ${idx + 1}`,
            isDeleting: false
        });
    };

    const handleConfirmDelete = async () => {
        if (deleteConfirmState.phaseIdx === null) return;
        setDeleteConfirmState(prev => ({ ...prev, isDeleting: true }));
        const targetName = deleteConfirmState.phaseName;
        try {
            const updatedPhases = phases.filter((_, i) => i !== deleteConfirmState.phaseIdx);
            setPhases(updatedPhases);
            await handleSaveToDatabase(updatedPhases);
            toast.success(`Phase "${targetName}" deleted successfully!`);
        } catch (error) {
            console.error("Failed to delete phase", error);
            toast.error("Failed to delete phase. Please try again.");
        } finally {
            setDeleteConfirmState({
                isOpen: false,
                phaseIdx: null,
                phaseName: '',
                isDeleting: false
            });
        }
    };

    const handleMovePhase = async (idx, direction) => {
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= phases.length) return;
        const updatedPhases = [...phases];
        const temp = updatedPhases[idx];
        updatedPhases[idx] = updatedPhases[targetIdx];
        updatedPhases[targetIdx] = temp;
        setPhases(updatedPhases);
        await handleSaveToDatabase(updatedPhases);
    };

    // Live Preview Phases (reflecting drawer input values in real time)
    const previewPhases = useMemo(() => {
        if (!isDrawerOpen) return phases;
        if (editingIdx === null) {
            // Adding new phase
            return [
                ...phases,
                {
                    id: 'preview-new',
                    name: drawerForm.name || 'New Phase',
                    startDate: drawerForm.startDate,
                    endDate: drawerForm.endDate,
                    weight: drawerForm.weight,
                    progress: drawerForm.progress,
                    description: drawerForm.description
                }
            ];
        } else {
            // Editing existing phase
            return phases.map((p, i) => i === editingIdx ? {
                ...p,
                name: drawerForm.name || p.name,
                startDate: drawerForm.startDate,
                endDate: drawerForm.endDate,
                weight: drawerForm.weight,
                progress: drawerForm.progress,
                description: drawerForm.description
            } : p);
        }
    }, [phases, isDrawerOpen, editingIdx, drawerForm]);

    // Real-time Metrics Calculations (updates instantly as user types in drawer)
    const totalWeight = useMemo(() => {
        const sum = previewPhases.reduce((acc, p) => acc + (parseFloat(p.weight) || 0), 0);
        return Math.round(sum * 10) / 10;
    }, [previewPhases]);

    const overallProgress = useMemo(() => {
        const sum = previewPhases.reduce((acc, p) => {
            const progress = parseFloat(p.progress) || 0;
            const weight = parseFloat(p.weight) || 0;
            return acc + (progress * (weight / 100));
        }, 0);
        return Math.round(sum * 10) / 10;
    }, [previewPhases]);

    const completedCount = useMemo(() => previewPhases.filter(p => (parseFloat(p.progress) || 0) === 100).length, [previewPhases]);
    const inProgressCount = useMemo(() => previewPhases.filter(p => {
        const pr = parseFloat(p.progress) || 0;
        return pr > 0 && pr < 100;
    }).length, [previewPhases]);
    const notStartedCount = useMemo(() => previewPhases.filter(p => (parseFloat(p.progress) || 0) === 0).length, [previewPhases]);

    // Color Palette for Gantt bars & Visualizations
    const phaseColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6'];

    // Timeline Date Bounds & Gantt Grid Setup
    const timelineBounds = useMemo(() => {
        if (phases.length === 0) {
            const start = new Date('2026-01-01');
            const end = new Date('2026-12-31');
            return { start, end, totalSpan: end.getTime() - start.getTime(), months: [] };
        }

        const dates = [];
        phases.forEach(p => {
            if (p.startDate) dates.push(new Date(p.startDate));
            if (p.endDate) dates.push(new Date(p.endDate));
        });

        if (dates.length === 0) {
            const start = new Date('2026-01-01');
            const end = new Date('2026-12-31');
            return { start, end, totalSpan: end.getTime() - start.getTime(), months: [] };
        }

        // Start from start of min month to end of max month
        let minDate = new Date(Math.min(...dates));
        let maxDate = new Date(Math.max(...dates));

        // Pad dates slightly for visual breathing room
        minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);

        const totalSpan = maxDate.getTime() - minDate.getTime() || 1;

        // Build list of months for Gantt Header
        const months = [];
        let curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        while (curr <= maxDate) {
            const monthStart = new Date(curr.getFullYear(), curr.getMonth(), 1);
            const monthEnd = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
            const monthSpan = monthEnd.getTime() - monthStart.getTime();
            const widthPct = (monthSpan / totalSpan) * 100;

            months.push({
                name: curr.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
                widthPct,
                startDate: monthStart,
                endDate: monthEnd
            });

            curr.setMonth(curr.getMonth() + 1);
        }

        const diffDays = Math.ceil(Math.abs(maxDate - minDate) / (1000 * 60 * 60 * 24));

        return { start: minDate, end: maxDate, totalSpan, totalDays: diffDays, months };
    }, [phases]);

    // Calculate Today's Position in Gantt Chart
    const todayPosition = useMemo(() => {
        const today = new Date();
        if (today < timelineBounds.start || today > timelineBounds.end) return null;
        const pos = ((today.getTime() - timelineBounds.start.getTime()) / timelineBounds.totalSpan) * 100;
        return Math.max(0, Math.min(100, pos));
    }, [timelineBounds]);

    // Filtered Phases List
    const filteredPhases = useMemo(() => {
        return phases.filter(phase => {
            const matchesSearch = phase.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (phase.description && phase.description.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const progressVal = parseFloat(phase.progress) || 0;
            let matchesStatus = true;
            if (statusFilter === 'COMPLETED') matchesStatus = progressVal === 100;
            else if (statusFilter === 'IN_PROGRESS') matchesStatus = progressVal > 0 && progressVal < 100;
            else if (statusFilter === 'NOT_STARTED') matchesStatus = progressVal === 0;

            return matchesSearch && matchesStatus;
        });
    }, [phases, searchQuery, statusFilter]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] text-gray-400">
                <Loader2 className="animate-spin mb-2.5 text-blue-500" size={26} />
                <span className="text-xs font-semibold">Loading project roadmap & Gantt chart...</span>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-transparent overflow-hidden text-left font-sans">
            {/* Reduced container padding with hidden scrollbars for clean seamless UI */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-3 md:p-4 space-y-3">

                {/* KPI Metric Summary Cards - Rectangular layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Overall Progress Card */}
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md p-3.5 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Overall Progress</span>
                            <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                <TrendingUp size={15} />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-2xl font-black text-gray-900 dark:text-white">
                                {Math.round(overallProgress)}%
                            </span>
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                Weighted Completion
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded mt-2 overflow-hidden">
                            <div 
                                className="bg-blue-600 h-full rounded-sm transition-all duration-500" 
                                style={{ width: `${Math.min(100, Math.round(overallProgress))}%` }} 
                            />
                        </div>
                    </div>

                    {/* Weightage Allocation Card */}
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md p-3.5 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Weightage</span>
                            <div className={`p-1.5 rounded ${totalWeight === 100 ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'}`}>
                                <Percent size={15} />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className={`text-2xl font-black ${totalWeight === 100 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {totalWeight}%
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${totalWeight === 100 ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'}`}>
                                {totalWeight === 100 ? 'Target Balanced' : totalWeight < 100 ? `${Math.round((100 - totalWeight) * 10) / 10}% Unallocated` : 'Exceeds 100%'}
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded mt-2 overflow-hidden">
                            <div 
                                className={`h-full rounded-sm transition-all duration-500 ${totalWeight === 100 ? 'bg-green-500' : totalWeight > 100 ? 'bg-red-500' : 'bg-amber-500'}`} 
                                style={{ width: `${Math.min(100, totalWeight)}%` }} 
                            />
                        </div>
                    </div>

                    {/* Status Breakdown Card */}
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md p-3.5 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phase Status</span>
                            <div className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                                <Layers size={15} />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
                                <CheckCircle2 size={13} />
                                <span>{completedCount} Done</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                                <Clock size={13} />
                                <span>{inProgressCount} Active</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                                <AlertTriangle size={13} />
                                <span>{notStartedCount} Pending</span>
                            </div>
                        </div>
                        <div className="w-full flex h-1.5 rounded overflow-hidden mt-2 bg-gray-100 dark:bg-white/10 gap-0.5">
                            {phases.length > 0 ? (
                                <>
                                    <div style={{ width: `${(completedCount / phases.length) * 100}%` }} className="bg-green-500 h-full" />
                                    <div style={{ width: `${(inProgressCount / phases.length) * 100}%` }} className="bg-blue-500 h-full" />
                                    <div style={{ width: `${(notStartedCount / phases.length) * 100}%` }} className="bg-gray-300 dark:bg-gray-700 h-full" />
                                </>
                            ) : (
                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-full" />
                            )}
                        </div>
                    </div>

                    {/* Roadmap Horizon Card */}
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md p-3.5 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time Horizon</span>
                            <div className="p-1.5 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
                                <Calendar size={15} />
                            </div>
                        </div>
                        <div className="mt-2">
                            <span className="text-base font-bold text-gray-900 dark:text-white block truncate">
                                {timelineBounds.start ? `${timelineBounds.start.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} - ${timelineBounds.end ? timelineBounds.end.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : ''}` : 'No Dates Defined'}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 block">
                                {timelineBounds.totalDays > 0 ? `Total Horizon: ${timelineBounds.totalDays} Days` : 'Set phase start and end dates'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ADDITIONAL ANALYTICAL VISUALIZATIONS */}
                {showAnalytics && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Visual 1: Interactive Weightage Allocation Share Bar */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2">
                                <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <PieChart size={15} className="text-blue-500" />
                                    Phase Weightage Share & Allocation Split
                                </h3>
                                <span className="text-[10px] font-bold text-gray-400">Total: {totalWeight}%</span>
                            </div>

                            {/* Multi-segment Weight Share Bar */}
                            <div className="w-full bg-gray-100 dark:bg-white/5 h-4 rounded flex overflow-hidden border border-gray-200 dark:border-white/10">
                                {phases.map((p, idx) => {
                                    const w = parseFloat(p.weight) || 0;
                                    if (w === 0) return null;
                                    const col = phaseColors[idx % phaseColors.length];
                                    return (
                                        <div
                                            key={p.id || idx}
                                            style={{ width: `${w}%`, backgroundColor: col }}
                                            className="h-full border-r border-white/20 transition-all hover:opacity-90 relative group"
                                            title={`${p.name}: ${w}% Weight`}
                                        />
                                    );
                                })}
                            </div>

                            {/* Legend Badges - Scrollbar hidden */}
                            <div className="flex flex-wrap gap-2 pt-1 max-h-24 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
                                {phases.map((p, idx) => {
                                    const w = parseFloat(p.weight) || 0;
                                    const col = phaseColors[idx % phaseColors.length];
                                    return (
                                        <div key={p.id || idx} className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded border border-gray-100 dark:border-white/5">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col }} />
                                            <span className="truncate max-w-[120px]">{p.name}</span>
                                            <span className="text-gray-400 font-bold">({w}%)</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Visual 2: Cumulative Progress Velocity (S-Curve Trajectory) */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md p-4 shadow-sm space-y-3">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2">
                                <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Activity size={15} className="text-green-500" />
                                    Cumulative Velocity & Completion Velocity
                                </h3>
                                <span className="text-[10px] font-bold text-green-500 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded border border-green-200 dark:border-green-800/40">
                                    {Math.round(overallProgress)}% Accomplished
                                </span>
                            </div>

                            <div className="space-y-2 max-h-36 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar pr-1">
                                {phases.map((p, idx) => {
                                    const progressVal = parseFloat(p.progress) || 0;
                                    const weightVal = parseFloat(p.weight) || 0;
                                    const contribution = Math.round(progressVal * (weightVal / 100) * 10) / 10;
                                    const col = phaseColors[idx % phaseColors.length];

                                    return (
                                        <div key={p.id || idx} className="space-y-1">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                                                    {p.name}
                                                </span>
                                                <span className="text-gray-500 dark:text-gray-400 font-bold">
                                                    {progressVal}% done <span className="text-gray-400 font-normal">({contribution}% of overall)</span>
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded overflow-hidden flex">
                                                <div
                                                    className="h-full rounded-xs transition-all duration-300"
                                                    style={{ width: `${progressVal}%`, backgroundColor: col }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Toolbar: Search, Filters, View Mode Switcher & Action Buttons */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search phase name or details..."
                            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Status Filter Tabs, View Switcher & Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
                        {/* Status Filter Pills */}
                        <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-md border border-gray-200 dark:border-white/10 text-xs">
                            <button
                                onClick={() => setStatusFilter('ALL')}
                                className={`px-2.5 py-1 rounded-sm font-semibold transition-all ${statusFilter === 'ALL' ? 'bg-white dark:bg-[#1f242d] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                All ({phases.length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('IN_PROGRESS')}
                                className={`px-2.5 py-1 rounded-sm font-semibold transition-all ${statusFilter === 'IN_PROGRESS' ? 'bg-white dark:bg-[#1f242d] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                In Progress ({inProgressCount})
                            </button>
                            <button
                                onClick={() => setStatusFilter('COMPLETED')}
                                className={`px-2.5 py-1 rounded-sm font-semibold transition-all ${statusFilter === 'COMPLETED' ? 'bg-white dark:bg-[#1f242d] text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                Completed ({completedCount})
                            </button>
                        </div>

                        {/* View Switcher */}
                        <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-md border border-gray-200 dark:border-white/10 text-xs">
                            <button
                                onClick={() => setViewMode('gantt')}
                                title="Interactive Gantt Chart View"
                                className={`px-2.5 py-1 rounded-sm font-semibold flex items-center gap-1.5 transition-all ${viewMode === 'gantt' ? 'bg-white dark:bg-[#1f242d] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-white'}`}
                            >
                                <BarChart3 size={14} />
                                <span>Gantt</span>
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                title="Side-by-Side Cards View"
                                className={`px-2.5 py-1 rounded-sm font-semibold flex items-center gap-1.5 transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-[#1f242d] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-white'}`}
                            >
                                <Grid size={14} />
                                <span>Cards</span>
                            </button>
                        </div>

                        {/* Analytics Toggle Button */}
                        <button
                            onClick={() => setShowAnalytics(prev => !prev)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-semibold transition-all cursor-pointer ${showAnalytics ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40' : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'}`}
                        >
                            <Activity size={13} />
                            <span>{showAnalytics ? 'Hide Analytics' : 'Show Analytics'}</span>
                        </button>

                        {/* Add Phase Button */}
                        {canWrite && (
                            <button
                                onClick={handleOpenCreateDrawer}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-md text-xs font-semibold transition-all shadow-sm shrink-0 cursor-pointer"
                            >
                                <Plus size={14} className="stroke-[2.5]" />
                                <span>Add Project Phase</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Content View Modes */}
                {filteredPhases.length === 0 ? (
                    /* Seamless Centered Empty State */
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3.5 shadow-xs">
                            <Milestone size={26} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            {searchQuery || statusFilter !== 'ALL' ? 'No matching phases found' : 'No project phases configured'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1 mb-5">
                            {searchQuery || statusFilter !== 'ALL' ? 'Try adjusting your search criteria or status filter.' : 'Define project milestones and schedule weights to track completion.'}
                        </p>
                        {canWrite && !searchQuery && statusFilter === 'ALL' && (
                            <button
                                onClick={handleOpenCreateDrawer}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer shadow-blue-500/20"
                            >
                                <Plus size={14} className="stroke-[2.5]" />
                                <span>Create First Phase</span>
                            </button>
                        )}
                    </div>
                ) : viewMode === 'gantt' ? (
                    /* INTERACTIVE GANTT CHART VIEW */
                    <div className="space-y-3">
                        {/* Gantt Container with Horizontal Scroll (Scrollbar Hidden) */}
                        <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar border border-gray-200 dark:border-white/10 rounded-md bg-white dark:bg-[#0d1117] shadow-xs">
                            <div className="min-w-[850px] flex flex-col">
                                {/* Gantt Header Row (Month Columns) */}
                                <div className="flex border-b border-gray-200 dark:border-white/10 bg-gray-100/80 dark:bg-[#161b22]">
                                    {/* Left Label Column */}
                                    <div className="w-72 p-2.5 font-bold text-[11px] text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-white/10 shrink-0 flex items-center justify-between">
                                        <span>Phase / Milestone</span>
                                        <span className="text-[10px] text-gray-400 font-normal">Drag to Reorder</span>
                                    </div>
                                    {/* Timeline Month Grid */}
                                    <div className="flex-1 flex relative">
                                        {timelineBounds.months.map((m, idx) => (
                                            <div
                                                key={idx}
                                                style={{ width: `${m.widthPct}%` }}
                                                className="p-2.5 text-center font-bold text-[11px] text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-white/10 shrink-0 truncate"
                                            >
                                                {m.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Gantt Rows with Drag-and-Drop Reordering */}
                                <div className="relative">
                                    {/* Vertical Dotted "Today" Line Indicator */}
                                    {todayPosition !== null && (
                                        <div
                                            className="absolute top-0 bottom-0 z-20 border-l-2 border-dashed border-red-500 pointer-events-none"
                                            style={{ left: `calc(18rem + ${todayPosition}%)` }}
                                        >
                                            <span className="absolute -top-3 -left-5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                                                TODAY
                                            </span>
                                        </div>
                                    )}

                                    <Reorder.Group
                                        axis="y"
                                        values={phases}
                                        onReorder={async (newOrder) => {
                                            if (!canWrite) return;
                                            setPhases(newOrder);
                                            await handleSaveToDatabase(newOrder);
                                        }}
                                        as="div"
                                        className="divide-y divide-gray-200 dark:divide-white/5"
                                    >
                                        {filteredPhases.map((phase, idx) => {
                                            const originalIdx = phases.findIndex(p => p.id === phase.id);
                                            const progressVal = parseFloat(phase.progress) || 0;
                                            const isCompleted = progressVal === 100;
                                            const isInProgress = progressVal > 0 && progressVal < 100;

                                            // Calculate proportional date bar position
                                            let leftPct = 0;
                                            let widthPct = 100;

                                            if (phase.startDate && phase.endDate && timelineBounds.totalSpan > 0) {
                                                const pStart = new Date(phase.startDate).getTime();
                                                const pEnd = new Date(phase.endDate).getTime();

                                                leftPct = Math.max(0, Math.min(100, ((pStart - timelineBounds.start.getTime()) / timelineBounds.totalSpan) * 100));
                                                const rawWidth = ((pEnd - pStart) / timelineBounds.totalSpan) * 100;
                                                widthPct = Math.max(4, Math.min(100 - leftPct, rawWidth));
                                            }

                                            const barColor = phaseColors[originalIdx % phaseColors.length];

                                            return (
                                                <Reorder.Item
                                                    key={phase.id || originalIdx}
                                                    value={phase}
                                                    dragListener={canWrite && !searchQuery && statusFilter === 'ALL'}
                                                    as="div"
                                                    className="flex items-center hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors group cursor-default"
                                                >
                                                    {/* Left Phase Title & Info */}
                                                    <div className="w-72 p-2.5 border-r border-gray-200 dark:border-white/10 shrink-0 flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {canWrite && !searchQuery && statusFilter === 'ALL' && (
                                                                <GripVertical
                                                                    size={14}
                                                                    className="text-gray-400 dark:text-gray-600 group-hover:text-blue-500 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                                                                    title="Drag to reorder phase position"
                                                                />
                                                            )}
                                                            <div
                                                                onClick={() => canWrite && handleOpenEditDrawer(originalIdx, phase)}
                                                                className="truncate cursor-pointer flex-1"
                                                                title="Click to edit phase details"
                                                            >
                                                                <span className="font-bold text-xs text-gray-900 dark:text-white block truncate hover:text-blue-500 transition-colors">
                                                                    {String(originalIdx + 1).padStart(2, '0')}. {phase.name}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400 block truncate">
                                                                    W: {phase.weight}% | {phase.startDate ? new Date(phase.startDate).toLocaleDateString() : 'N/A'} - {phase.endDate ? new Date(phase.endDate).toLocaleDateString() : 'N/A'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400' : isInProgress ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                                {progressVal}%
                                                            </span>
                                                            {canWrite && (
                                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleOpenEditDrawer(originalIdx, phase); }}
                                                                        className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                                                        title="Edit Phase"
                                                                    >
                                                                        <Pencil size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDeletePhase(originalIdx); }}
                                                                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                                                        title="Delete Phase"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Right Gantt Bar Canvas */}
                                                    <div
                                                        onClick={() => canWrite && handleOpenEditDrawer(originalIdx, phase)}
                                                        className="flex-1 relative h-12 flex items-center px-2 cursor-pointer"
                                                        title="Click to edit phase details"
                                                    >
                                                        {/* Background Month Grid Lines */}
                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                            {timelineBounds.months.map((m, mIdx) => (
                                                                <div key={mIdx} style={{ width: `${m.widthPct}%` }} className="h-full border-r border-gray-200/50 dark:border-white/5" />
                                                            ))}
                                                        </div>

                                                        {/* Proportional Gantt Bar */}
                                                        <div
                                                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                                            className="absolute h-7 rounded-sm shadow-sm border border-black/10 dark:border-white/10 transition-all duration-300 flex items-center overflow-hidden cursor-pointer group-hover:scale-[1.01]"
                                                            title={`${phase.name}: ${phase.startDate} to ${phase.endDate} (${progressVal}% complete) — Click to edit`}
                                                        >
                                                            {/* Base Color Background */}
                                                            <div
                                                                className="absolute inset-0 opacity-25"
                                                                style={{ backgroundColor: barColor }}
                                                            />

                                                            {/* Progress Completion Fill */}
                                                            <div
                                                                className="h-full transition-all duration-500 relative flex items-center justify-end px-2"
                                                                style={{ width: `${progressVal}%`, backgroundColor: barColor }}
                                                            >
                                                                {progressVal > 15 && (
                                                                    <span className="text-[10px] font-black text-white drop-shadow-sm">
                                                                        {progressVal}%
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {progressVal <= 15 && (
                                                                <span className="absolute left-2 text-[10px] font-bold text-gray-800 dark:text-white drop-shadow-sm">
                                                                    {progressVal}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Reorder.Item>
                                            );
                                        })}
                                    </Reorder.Group>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* 2-COLUMN SIDE-BY-SIDE CARDS GRID VIEW */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredPhases.map((phase, idx) => {
                            const originalIdx = phases.findIndex(p => p.id === phase.id);
                            const progressVal = parseFloat(phase.progress) || 0;
                            const isCompleted = progressVal === 100;
                            const isInProgress = progressVal > 0 && progressVal < 100;

                            return (
                                <div
                                    key={phase.id || idx}
                                    className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md p-4 shadow-sm flex flex-col justify-between space-y-3.5 hover:border-blue-500/50 transition-all duration-200 group relative"
                                >
                                    {/* Top Header: Sequence Badge, Phase Name & Status */}
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                                                    Phase {String(originalIdx + 1).padStart(2, '0')}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    Weight: <strong className="text-gray-700 dark:text-gray-300 font-bold">{phase.weight}%</strong>
                                                </span>
                                            </div>
                                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider flex items-center gap-1 ${isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 border border-green-200 dark:border-green-800/40' : isInProgress ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                {isCompleted ? <CheckCircle2 size={11} /> : isInProgress ? <Clock size={11} /> : <AlertTriangle size={11} />}
                                                {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started'}
                                            </span>
                                        </div>

                                        <div
                                            onClick={() => canWrite && handleOpenEditDrawer(originalIdx, phase)}
                                            className="cursor-pointer"
                                            title="Click to edit phase details"
                                        >
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 hover:text-blue-500 transition-colors">
                                                {phase.name}
                                            </h4>
                                            {phase.description && (
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                                                    {phase.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle: Duration Details */}
                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.02] px-3 py-2 rounded border border-gray-100 dark:border-white/5">
                                        <span className="flex items-center gap-1.5 font-medium text-[11px]">
                                            <Calendar size={13} className="text-blue-500 shrink-0" />
                                            <span>
                                                {phase.startDate ? new Date(phase.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} - {phase.endDate ? new Date(phase.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                            </span>
                                        </span>
                                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                            {progressVal}% Done
                                        </span>
                                    </div>

                                    {/* Progress Bar & Adjustment Slider */}
                                    <div className="space-y-1.5">
                                        <div className="w-full bg-gray-100 dark:bg-white/10 h-2 rounded overflow-hidden flex">
                                            <div
                                                className={`h-full rounded-xs transition-all duration-300 ${isCompleted ? 'bg-green-600' : 'bg-blue-600'}`}
                                                style={{ width: `${progressVal}%` }}
                                            />
                                        </div>
                                        {canWrite && (
                                            <div className="flex items-center gap-2 pt-0.5">
                                                <span className="text-[10px] text-gray-400 font-medium shrink-0">Progress:</span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={progressVal}
                                                    onChange={(e) => handleProgressChange(originalIdx, e.target.value)}
                                                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded appearance-none cursor-pointer accent-blue-600"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Action Footer */}
                                    {canWrite && (
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5 text-xs">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleMovePhase(originalIdx, -1)}
                                                    disabled={originalIdx === 0}
                                                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded disabled:opacity-20 transition-colors cursor-pointer"
                                                    title="Move Phase Up"
                                                >
                                                    <ChevronUp size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleMovePhase(originalIdx, 1)}
                                                    disabled={originalIdx === phases.length - 1}
                                                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded disabled:opacity-20 transition-colors cursor-pointer"
                                                    title="Move Phase Down"
                                                >
                                                    <ChevronDown size={14} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenEditDrawer(originalIdx, phase); }}
                                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer"
                                                    title="Edit Phase Details"
                                                >
                                                    <Pencil size={12} />
                                                    <span>Edit</span>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeletePhase(originalIdx); }}
                                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                                                    title="Delete Phase"
                                                >
                                                    <Trash2 size={12} />
                                                    <span>Delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* SIDEBAR POPUP (RIGHT DRAWER PANEL) */}
            {isDrawerOpen && (
                <div className="fixed inset-0 z-[4000] flex justify-end bg-black/50 backdrop-blur-xs">
                    {/* Backdrop click listener */}
                    <div className="absolute inset-0" onClick={() => setIsDrawerOpen(false)} />

                    {/* Right Slide-over Side Drawer Container */}
                    <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] h-full shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300">
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Milestone className="text-blue-500" size={18} />
                                {editingIdx === null ? 'Create New Project Phase' : 'Edit Phase Details'}
                            </h3>
                            <button
                                onClick={() => setIsDrawerOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Drawer Form Content - Scrollbar Hidden */}
                        <form onSubmit={handleSaveDrawer} className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-5 space-y-4">
                            <div>
                                <CustomInput
                                    label="Phase Name"
                                    value={drawerForm.name}
                                    onChange={(e) => setDrawerForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., Substructure & Foundation Excavation"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <CustomDatePicker
                                    label="Target Start Date"
                                    value={drawerForm.startDate}
                                    onChange={(val) => setDrawerForm(prev => ({ ...prev, startDate: val.target.value }))}
                                />
                                <CustomDatePicker
                                    label="Target End Date"
                                    value={drawerForm.endDate}
                                    onChange={(val) => setDrawerForm(prev => ({ ...prev, endDate: val.target.value }))}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3.5 items-start">
                                <div>
                                    <CustomInput
                                        label="Weightage (%)"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={drawerForm.weight}
                                        onChange={(e) => setDrawerForm(prev => ({ ...prev, weight: e.target.value }))}
                                        placeholder="0"
                                    />
                                    {/* Real-time Weightage Visual Bar */}
                                    <div className="mt-2 space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                            <span>Phase: <strong className="text-gray-900 dark:text-white font-bold">{parseFloat(drawerForm.weight) || 0}%</strong></span>
                                            <span>Total: <strong className={`font-bold ${totalWeight === 100 ? 'text-green-500' : totalWeight > 100 ? 'text-red-500' : 'text-amber-500'}`}>{totalWeight}%</strong></span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-[#2d3548] h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${totalWeight === 100 ? 'bg-green-500' : totalWeight > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                                                style={{ width: `${Math.min(100, Math.max(0, totalWeight))}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <CustomInput
                                        label="Progress (%)"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={drawerForm.progress}
                                        onChange={(e) => setDrawerForm(prev => ({ ...prev, progress: e.target.value }))}
                                        placeholder="0"
                                    />
                                    {/* Real-time Progress Visual Bar */}
                                    <div className="mt-2 space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                            <span>Completion: <strong className="text-blue-600 dark:text-blue-400 font-bold">{parseFloat(drawerForm.progress) || 0}%</strong></span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${parseFloat(drawerForm.progress) === 100 ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40' : parseFloat(drawerForm.progress) > 0 ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5'}`}>
                                                {parseFloat(drawerForm.progress) === 100 ? 'Done' : parseFloat(drawerForm.progress) > 0 ? 'Active' : 'Pending'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-[#2d3548] h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${parseFloat(drawerForm.progress) === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                                                style={{ width: `${Math.min(100, Math.max(0, parseFloat(drawerForm.progress) || 0))}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <CustomInput
                                    label="Phase Notes & Scope (Optional)"
                                    rows={4}
                                    value={drawerForm.description}
                                    onChange={(e) => setDrawerForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Add summary details of key deliverables for this phase..."
                                />
                            </div>
                        </form>

                        {/* Drawer Footer Actions */}
                        <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-[#161b22]">
                            <button
                                type="button"
                                onClick={() => setIsDrawerOpen(false)}
                                className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveDrawer}
                                disabled={isSaving}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                                ) : (
                                    <Check size={14} />
                                )}
                                <span>{editingIdx === null ? 'Create Phase' : 'Save Changes'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteConfirmState.isOpen}
                onClose={() => setDeleteConfirmState({ isOpen: false, phaseIdx: null, phaseName: '', isDeleting: false })}
                onConfirm={handleConfirmDelete}
                title="Delete Project Phase"
                message={`Are you sure you want to delete "${deleteConfirmState.phaseName}"? All progress tracking and weightage associated with this phase will be permanently removed.`}
                confirmText="Delete Phase"
                cancelText="Cancel"
                variant="danger"
                isLoading={deleteConfirmState.isDeleting}
            />
        </div>
    );
};

export default Phases;
