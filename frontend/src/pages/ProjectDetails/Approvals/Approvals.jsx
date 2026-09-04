import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, X, ChevronDown, ChevronUp, Users,
    GitBranch, Shield, CheckCircle2, Trash2, UserCheck,
    Pencil, Check, ArrowUp, ArrowDown, Loader2, ArrowLeft
} from 'lucide-react';
import AccessControl from '../AccessControl';
import { toast } from 'react-toastify';
import { workflowApi } from '../../../services/workflowApi';
import { projectApi } from '../../../services/projectApi';
import { adminApi } from '../../../services/adminApi';

// ─── Project sections ──────────────────────────────────────────────────────
const MAIN_SECTIONS = [
    'Tasks', 'WIP', 'Reports',
    'General Documents', 'Drawings', 'Planning',
    'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management',
];

const SUB_SECTIONS = {
    'General Documents': [
        'Project Vendor List',
        'Project Directory',
        'Staff Roles',
        'Project Summary',
        'Agenda of Meeting',
        'Minutes of Meeting',
        'Organisation Chart',
        'Daily Progress Report (DPR)'
    ]
};

const ALL_CONFIG_SECTIONS = [
    'Tasks', 'WIP', 'Reports', 'Drawings', 'Planning',
    'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management',
    'Project Vendor List', 'Project Directory', 'Staff Roles', 'Project Summary',
    'Agenda of Meeting', 'Minutes of Meeting', 'Organisation Chart', 'Daily Progress Report (DPR)'
];

const EPISODIC_SECTIONS = ['Agenda of Meeting', 'Minutes of Meeting', 'Daily Progress Report (DPR)'];

// ─── Default approval config per section ─────────────────────────────────
const defaultConfig = () => ({
    reporters: [],
    approvalLevels: [{ id: Date.now(), label: 'Approval 1', approvers: [] }],
});

// ─── Avatar Chip ───────────────────────────────────────────────────────────
const Chip = ({ emp, onRemove, label = 'Reporter' }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-full shadow-xs group hover:border-blue-400 transition-all"
    >
        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${emp.color || 'from-blue-500 to-indigo-600'} flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-xs`}>
            {emp.initials}
        </div>
        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{emp.name}</span>
        {label && (
            <span className="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-extrabold rounded-full uppercase">
                {label}
            </span>
        )}
        {onRemove && (
            <button
                type="button"
                onClick={onRemove}
                className="text-gray-400 hover:text-red-500 transition-colors ml-0.5 p-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                title="Remove"
            >
                <X size={11} />
            </button>
        )}
    </motion.div>
);

// ─── Level Row Card with Flow Step UI ──────────────────────────────────────
const LevelRow = ({ level, idx, total, onApproversChange, onRemove, onRename, onMove, canWrite, employees = [], excludeIds = [] }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(level.label);
    const [showPicker, setShowPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const commitRename = () => {
        onRename(draft.trim() || level.label);
        setEditing(false);
    };

    const badgeColors = [
        'bg-blue-600 text-white shadow-blue-500/20',
        'bg-indigo-600 text-white shadow-indigo-500/20',
        'bg-purple-600 text-white shadow-purple-500/20',
        'bg-pink-600 text-white shadow-pink-500/20'
    ];

    const assignedApprovers = level.approvers || [];

    const toggleApprover = (emp) => {
        const exists = assignedApprovers.some(a => String(a.id) === String(emp.id));
        if (exists) {
            onApproversChange(assignedApprovers.filter(a => String(a.id) !== String(emp.id)));
        } else {
            onApproversChange([...assignedApprovers, emp]);
        }
    };

    const removeApprover = (empId) => {
        onApproversChange(assignedApprovers.filter(a => String(a.id) !== String(empId)));
    };

    const filteredEmployees = employees.filter(emp => {
        const isExcluded = excludeIds.some(id => String(id) === String(emp.id)) && !assignedApprovers.some(a => String(a.id) === String(emp.id));
        if (isExcluded) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return emp.name.toLowerCase().includes(q) || (emp.role && emp.role.toLowerCase().includes(q));
    });

    return (
        <div className="relative flex gap-3">
            {/* Step Pipeline Line & Circle */}
            <div className="flex flex-col items-center shrink-0">
                <div className={`w-7 h-7 rounded-full ${badgeColors[idx % badgeColors.length]} flex items-center justify-center text-xs font-bold shadow-md z-10`}>
                    {idx + 1}
                </div>
                {idx < total - 1 && (
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-blue-500/40 via-indigo-500/30 to-purple-500/20 my-1" />
                )}
            </div>

            {/* Stage Card */}
            <div className="flex-1 bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/10 rounded-xl p-4 space-y-3 shadow-xs hover:border-blue-400/50 transition-all">
                {/* Header row: Title + Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {editing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                                <input
                                    autoFocus
                                    value={draft}
                                    onChange={e => setDraft(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
                                    className="flex-1 bg-gray-50 dark:bg-[#0d1117] border border-blue-500 rounded-md px-2.5 py-1 text-xs font-bold text-gray-900 dark:text-white outline-none"
                                />
                                <button onClick={commitRename} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"><Check size={13} /></button>
                                <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md"><X size={13} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{level.label}</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                    ({assignedApprovers.length} {assignedApprovers.length === 1 ? 'Approver' : 'Approvers'})
                                </span>
                                {canWrite && (
                                    <button onClick={() => { setDraft(level.label); setEditing(true); }} className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors shrink-0 ml-0.5" title="Rename level">
                                        <Pencil size={11} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Level Actions: Move Up/Down + Remove */}
                    <div className="flex items-center gap-1 shrink-0">
                        {canWrite && (
                            <>
                                <button
                                    disabled={idx === 0}
                                    onClick={() => onMove(-1)}
                                    className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-20 disabled:hover:text-gray-400 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                                    title="Move up"
                                >
                                    <ArrowUp size={12} />
                                </button>
                                <button
                                    disabled={idx === total - 1}
                                    onClick={() => onMove(1)}
                                    className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-20 disabled:hover:text-gray-400 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                                    title="Move down"
                                >
                                    <ArrowDown size={12} />
                                </button>
                                {total > 1 && (
                                    <button
                                        onClick={onRemove}
                                        className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer ml-1"
                                        title="Remove stage"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Assigned Approver Cards List */}
                <div className="space-y-2">
                    {assignedApprovers.length > 0 ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {assignedApprovers.map(emp => (
                                    <div key={emp.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200/60 dark:border-white/5 rounded-xl shadow-2xs">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${emp.color || 'from-blue-500 to-indigo-600'} flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs`}>
                                                {emp.initials}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{emp.name}</p>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-tight truncate">{emp.role || 'Approver'}</p>
                                            </div>
                                        </div>
                                        {canWrite && (
                                            <button
                                                type="button"
                                                onClick={() => removeApprover(emp.id)}
                                                className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0 ml-1"
                                                title="Remove approver"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={() => setShowPicker(!showPicker)}
                                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl transition-all border border-blue-200/50 dark:border-blue-500/30 flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 mt-1"
                                >
                                    <Plus size={12} /> {showPicker ? 'Close Selection' : 'Add Approver'}
                                </button>
                            )}
                        </div>
                    ) : (
                        canWrite ? (
                            <button
                                type="button"
                                onClick={() => setShowPicker(!showPicker)}
                                className="w-full flex items-center justify-between p-3 bg-blue-50/20 dark:bg-blue-950/10 border border-dashed border-blue-200/80 dark:border-blue-500/30 hover:border-blue-400 dark:hover:border-blue-400 rounded-xl transition-all group text-left cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    <UserCheck size={14} className="text-blue-500" />
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                        No approvers assigned to this stage
                                    </span>
                                </div>
                                <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold transition-transform group-hover:scale-105 shadow-2xs flex items-center gap-1">
                                    <Plus size={12} /> {showPicker ? 'Close' : 'Select Approvers'}
                                </span>
                            </button>
                        ) : (
                            <div className="p-2 text-xs text-gray-400 italic">No approver assigned.</div>
                        )
                    )}

                    {/* Inline Approver Selection Panel */}
                    <AnimatePresence>
                        {showPicker && canWrite && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-3 bg-gray-50/80 dark:bg-[#0d1117] border border-blue-200 dark:border-blue-500/30 rounded-xl space-y-2 overflow-hidden"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Toggle Approvers for {level.label}</span>
                                    <button type="button" onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                        <X size={14} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Filter team members..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-800 dark:text-white outline-none"
                                />
                                <div className="max-h-44 overflow-y-auto space-y-1 custom-scrollbar">
                                    {filteredEmployees.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-gray-400">No available members to assign.</div>
                                    ) : (
                                        filteredEmployees.map(emp => {
                                            const isSel = assignedApprovers.some(a => String(a.id) === String(emp.id));
                                            return (
                                                <button
                                                    key={emp.id}
                                                    type="button"
                                                    onClick={() => toggleApprover(emp)}
                                                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${isSel
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold border border-blue-200/50 dark:border-blue-500/30'
                                                        : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${emp.color || 'from-blue-500 to-indigo-600'} flex items-center justify-center text-xs font-bold text-white`}>
                                                            {emp.initials}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-900 dark:text-white">{emp.name}</p>
                                                            <p className="text-[10px] text-gray-400 uppercase">{emp.role || 'Member'}</p>
                                                        </div>
                                                    </div>
                                                    {isSel ? (
                                                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-md flex items-center gap-1">
                                                            <Check size={11} /> Selected
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 text-[10px] font-bold rounded-md">
                                                            Add
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

// ─── Section Card Component ────────────────────────────────────────────────
const SectionCard = ({ section, config, onChange, canWrite, employees = [], onExplore, subSectionsCount, onSaveSection, savingSection }) => {
    const [showReporterSelector, setShowReporterSelector] = useState(false);
    const [reporterSearch, setReporterSearch] = useState('');

    const approverIds = new Set((config?.approvalLevels || []).flatMap(level => level.approvers || []).map(emp => String(emp.id)));
    const reporterIds = new Set((config?.reporters || []).map(emp => String(emp.id)));

    const uniqueUsers = (users) => Array.from(
        new Map(users.map(user => [String(user.id), user])).values()
    );

    const setReporters = (reporters) => onChange({
        ...config,
        reporters: uniqueUsers(reporters).filter(emp => !approverIds.has(String(emp.id)))
    });

    const toggleReporter = (emp) => {
        const currentReporters = config?.reporters || [];
        const exists = currentReporters.some(r => r.id === emp.id);
        if (exists) {
            setReporters(currentReporters.filter(r => r.id !== emp.id));
        } else {
            setReporters([...currentReporters, emp]);
        }
    };

    const setLevelApprovers = (levelId, approvers) => {
        const approversInOtherLevels = new Set(
            (config?.approvalLevels || [])
                .filter(level => level.id !== levelId)
                .flatMap(level => level.approvers || [])
                .map(emp => String(emp.id))
        );

        onChange({
            ...config,
            approvalLevels: config.approvalLevels.map(level => level.id === levelId ? {
                ...level,
                approvers: uniqueUsers(approvers).filter(emp =>
                    !reporterIds.has(String(emp.id)) && !approversInOtherLevels.has(String(emp.id))
                )
            } : level)
        });
    };

    const addLevel = () =>
        onChange({
            ...config,
            approvalLevels: [...config.approvalLevels, {
                id: Date.now(),
                label: `Approval ${config.approvalLevels.length + 1}`,
                approvers: [],
            }]
        });

    const removeLevel = (levelId) =>
        onChange({ ...config, approvalLevels: config.approvalLevels.filter(l => l.id !== levelId) });

    const renameLevel = (levelId, label) =>
        onChange({ ...config, approvalLevels: config.approvalLevels.map(l => l.id === levelId ? { ...l, label } : l) });

    const moveLevel = (idx, dir) => {
        const levels = [...config.approvalLevels];
        const target = idx + dir;
        if (target < 0 || target >= levels.length) return;
        [levels[idx], levels[target]] = [levels[target], levels[idx]];
        onChange({ ...config, approvalLevels: levels });
    };

    if (onExplore) {
        return (
            <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 space-y-4 text-left shadow-2xs flex flex-col justify-between min-h-[170px]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                            <GitBranch size={16} className="text-blue-500" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{section}</span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full">
                        {subSectionsCount} sub-documents
                    </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    This section contains multiple document types (e.g. Agendas, MoMs, Vendor lists) with individual approval hierarchies.
                </p>
                <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex justify-end">
                    <button
                        onClick={onExplore}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-500/20"
                    >
                        Configure Sub-Documents &rarr;
                    </button>
                </div>
            </div>
        );
    }

    const totalConfigured =
        (config?.reporters?.length || 0) +
        (config?.approvalLevels?.reduce((s, l) => s + l.approvers.length, 0) || 0);

    const availableReporterMembers = employees.filter(emp => {
        const isApprover = approverIds.has(String(emp.id));
        if (isApprover) return false;
        if (!reporterSearch.trim()) return true;
        const q = reporterSearch.toLowerCase();
        return emp.name.toLowerCase().includes(q) || (emp.role && emp.role.toLowerCase().includes(q));
    });

    return (
        <div className="space-y-5 text-left pb-4">
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-white/10 pb-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                        <GitBranch size={16} className="text-blue-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{section}</h3>
                            {['Agenda of Meeting', 'Minutes of Meeting', 'Daily Progress Report (DPR)'].includes(section) ? (
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] font-extrabold rounded-full uppercase tracking-wider">
                                    Category Default
                                </span>
                            ) : (section.startsWith('Agenda of Meeting') || section.startsWith('Minutes of Meeting') || section.startsWith('Daily Progress Report (DPR)')) ? (
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[9px] font-extrabold rounded-full uppercase tracking-wider">
                                    Instance Workflow
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400 text-[9px] font-extrabold rounded-full uppercase tracking-wider">
                                    Singleton
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {totalConfigured > 0 && (
                        <span className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-500/30 text-xs font-bold rounded-full flex items-center gap-1">
                            <CheckCircle2 size={12} /> {totalConfigured} Assigned
                        </span>
                    )}
                    {canWrite && onSaveSection && (
                        <button
                            type="button"
                            onClick={onSaveSection}
                            disabled={savingSection}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
                        >
                            {savingSection ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                            Save Workflow
                        </button>
                    )}
                </div>
            </div>

            {/* STAGE 1: Reporters Card */}
            <div className="bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/10 rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-md shrink-0">
                            <Users size={14} />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Reporters & Submitters</span>
                            <p className="text-[11px] text-gray-400 leading-normal">
                                Users authorized to create documents and trigger approvals for {section}.
                            </p>
                        </div>
                    </div>
                    {canWrite && (
                        <button
                            type="button"
                            onClick={() => setShowReporterSelector(!showReporterSelector)}
                            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition-all border border-indigo-200/50 dark:border-indigo-500/30 flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 shrink-0"
                        >
                            <Plus size={13} /> {showReporterSelector ? 'Close Selection' : 'Add Reporters'}
                        </button>
                    )}
                </div>

                {/* Active Reporter Cards */}
                {config?.reporters?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {config.reporters.map(emp => (
                            <div key={emp.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200/60 dark:border-white/10 rounded-xl shadow-2xs">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${emp.color || 'from-indigo-500 to-purple-600'} flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs`}>
                                        {emp.initials}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{emp.name}</p>
                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-tight truncate font-bold">{emp.role || 'Reporter'}</p>
                                    </div>
                                </div>
                                {canWrite && (
                                    <button
                                        type="button"
                                        onClick={() => toggleReporter(emp)}
                                        className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0 ml-1 cursor-pointer"
                                        title="Remove reporter"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-3 bg-gray-50/50 dark:bg-[#0d1117]/50 border border-dashed border-gray-200 dark:border-white/5 rounded-xl text-xs text-gray-400">
                        No reporters assigned yet.
                    </div>
                )}

                {/* Inline Reporter Picker Panel */}
                <AnimatePresence>
                    {showReporterSelector && canWrite && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-3 bg-gray-50/80 dark:bg-[#0d1117] border border-indigo-200 dark:border-indigo-500/30 rounded-xl space-y-2.5 overflow-hidden mt-2"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Toggle Reporters for {section}</span>
                                <button type="button" onClick={() => setShowReporterSelector(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                    <X size={14} />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Search members..."
                                value={reporterSearch}
                                onChange={e => setReporterSearch(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-800 dark:text-white outline-none"
                            />
                            <div className="max-h-44 overflow-y-auto space-y-1 custom-scrollbar">
                                {availableReporterMembers.map(emp => {
                                    const isSel = (config?.reporters || []).some(r => r.id === emp.id);
                                    return (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            onClick={() => toggleReporter(emp)}
                                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${isSel
                                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200/50 dark:border-indigo-500/30'
                                                : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${emp.color || 'from-indigo-500 to-purple-600'} flex items-center justify-center text-xs font-bold text-white`}>
                                                    {emp.initials}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white">{emp.name}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase">{emp.role || 'Member'}</p>
                                                </div>
                                            </div>
                                            {isSel ? (
                                                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-md flex items-center gap-1">
                                                    <Check size={11} /> Selected
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 text-[10px] font-bold rounded-md">
                                                    Add
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* STAGE 2: Approval Hierarchy */}
            <div className="space-y-3 pt-3 border-t border-gray-200/60 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                            <Shield size={12} />
                        </div>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Sequential Approval Stages</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">Top (Level 1) → Bottom (Final Level)</span>
                </div>

                <div className="space-y-2.5">
                    {(config?.approvalLevels || []).map((level, idx) => (
                        <LevelRow
                            key={level.id}
                            level={level}
                            idx={idx}
                            total={config.approvalLevels.length}
                            onApproversChange={(approvers) => setLevelApprovers(level.id, approvers)}
                            onRemove={() => removeLevel(level.id)}
                            onRename={(label) => renameLevel(level.id, label)}
                            onMove={(dir) => moveLevel(idx, dir)}
                            canWrite={canWrite}
                            employees={employees}
                            excludeIds={[
                                ...Array.from(reporterIds),
                                ...Array.from(new Set(
                                    config.approvalLevels
                                        .filter(otherLevel => otherLevel.id !== level.id)
                                        .flatMap(otherLevel => otherLevel.approvers || [])
                                        .map(emp => String(emp.id))
                                ))
                            ]}
                        />
                    ))}
                </div>

                {canWrite && (
                    <button
                        type="button"
                        onClick={addLevel}
                        className="w-full py-2.5 border-2 border-dashed border-blue-200 dark:border-blue-500/30 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] mt-2 shadow-2xs"
                    >
                        <Plus size={14} /> Add Next Approval Stage
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── Section Summary Card Component (for All Sections View) ──────────────────
const SectionSummaryCard = ({ section, config, onSelectSection, subSectionsCount }) => {
    const reportersCount = config?.reporters?.length || 0;
    const approvalLevelsCount = config?.approvalLevels?.length || 0;
    const totalApprovers = config?.approvalLevels?.reduce((sum, lvl) => sum + (lvl.approvers?.length || 0), 0) || 0;
    const totalAssigned = reportersCount + totalApprovers;

    return (
        <motion.div
            whileHover={{ y: -2 }}
            onClick={onSelectSection}
            className="bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/10 hover:border-blue-400/80 dark:hover:border-blue-500/50 rounded-2xl p-4 space-y-3 shadow-2xs hover:shadow-md transition-all cursor-pointer text-left flex flex-col justify-between"
        >
            <div className="space-y-2.5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs shrink-0">
                            <GitBranch size={15} />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{section}</h4>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate block">
                                {subSectionsCount ? `${subSectionsCount} sub-documents` : 'Singleton'}
                            </span>
                        </div>
                    </div>
                    {totalAssigned > 0 ? (
                        <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full border border-green-200/50 dark:border-green-500/30 shrink-0">
                            {totalAssigned} Assigned
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-400 text-[10px] font-bold rounded-full shrink-0">
                            Not Configured
                        </span>
                    )}
                </div>

                {/* Reporters Summary */}
                <div className="p-2.5 bg-gray-50/80 dark:bg-[#0d1117] rounded-xl border border-gray-100 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                            <Users size={12} className="text-indigo-500" /> Reporters ({reportersCount})
                        </span>
                    </div>
                    {reportersCount > 0 ? (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                            {config.reporters.map(r => (
                                <span key={r.id} className="px-2 py-0.5 bg-white dark:bg-[#161b22] border border-gray-200/60 dark:border-white/10 text-gray-800 dark:text-gray-200 text-[10px] font-bold rounded-md shadow-2xs">
                                    {r.name}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-gray-400 italic">No reporters assigned</p>
                    )}
                </div>

                {/* Approval Stages Summary */}
                <div className="p-2.5 bg-gray-50/80 dark:bg-[#0d1117] rounded-xl border border-gray-100 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                            <Shield size={12} className="text-blue-500" /> Approval Stages ({approvalLevelsCount})
                        </span>
                    </div>
                    {approvalLevelsCount > 0 ? (
                        <div className="space-y-1 pt-0.5">
                            {config.approvalLevels.map((lvl, i) => (
                                <div key={lvl.id || i} className="flex items-center justify-between text-[10px] gap-2">
                                    <span className="font-semibold text-gray-500 dark:text-gray-400 truncate">{lvl.label}:</span>
                                    <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
                                        {lvl.approvers?.length > 0
                                            ? lvl.approvers.map(a => a.name).join(', ')
                                            : <span className="text-gray-400 font-normal italic">Unassigned</span>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-gray-400 italic">No approval stages</p>
                    )}
                </div>
            </div>

            {/* Card Footer Action */}
            <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-end text-xs font-bold text-blue-600 dark:text-blue-400">
                <span>Configure Workflow &rarr;</span>
            </div>
        </motion.div>
    );
};

// ─── Main Approvals page ───────────────────────────────────────────────────
const Approvals = ({ setExtraBreadcrumbs, project, projectPermissions, isAdmin }) => {
    const { id } = useParams(); // Project ID
    const canWrite = isAdmin || (projectPermissions && projectPermissions['Approvals'] >= 2);

    const [configs, setConfigs] = useState(() => {
        const c = {};
        ALL_CONFIG_SECTIONS.forEach(s => { c[s] = defaultConfig(); });
        return c;
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [currentConfigView, setCurrentConfigView] = useState('main');
    const [activeSubTab, setActiveSubTab] = useState('access');
    const [selectedSection, setSelectedSection] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const usersRes = await adminApi.getUsers();
            let mappedEmps = [];
            if (usersRes.success && usersRes.users) {
                const colors = [
                    'from-blue-400 to-indigo-500',
                    'from-purple-400 to-pink-500',
                    'from-orange-400 to-red-500',
                    'from-teal-400 to-green-500',
                    'from-gray-400 to-slate-500',
                    'from-pink-400 to-rose-500',
                    'from-cyan-400 to-blue-500',
                    'from-violet-400 to-purple-500'
                ];
                mappedEmps = usersRes.users.map((m, idx) => {
                    const initials = m.user_name ? m.user_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';
                    return {
                        id: m.id,
                        name: m.user_name,
                        role: m.user_type,
                        initials,
                        color: colors[idx % colors.length]
                    };
                });
                setEmployees(mappedEmps);
            }

            const templatesRes = await workflowApi.getTemplates(id);
            if (templatesRes.success && templatesRes.templates) {
                const fetchedTemplates = templatesRes.templates;
                setTemplates(fetchedTemplates);

                const detailedTemplates = await Promise.all(
                    fetchedTemplates.map(t => workflowApi.getTemplate(t.document_id).catch(() => null))
                );

                const newConfigs = {};
                ALL_CONFIG_SECTIONS.forEach(s => {
                    newConfigs[s] = defaultConfig();
                });
                fetchedTemplates.forEach(t => {
                    if (!newConfigs[t.name]) {
                        newConfigs[t.name] = defaultConfig();
                    }
                });

                detailedTemplates.forEach(res => {
                    if (res && res.success && res.template) {
                        const t = res.template;
                        const sectionName = t.name;

                        const reporters = (t.document_roles || [])
                            .filter(r => r.role === 'reporter')
                            .map(r => mappedEmps.find(e => e.id === r.id))
                            .filter(Boolean);

                        const approvalLevels = (t.approval_levels || []).map(level => {
                            const levelApprovers = (t.document_roles || [])
                                .filter(r => r.role === 'approver' && r.level_id === level.level_id)
                                .map(r => mappedEmps.find(e => e.id === r.id))
                                .filter(Boolean);

                            return {
                                id: level.level_id,
                                label: level.label,
                                approvers: levelApprovers.slice(0, 1)
                            };
                        });

                        newConfigs[sectionName] = {
                            reporters,
                            approvalLevels: approvalLevels.length > 0 ? approvalLevels : [{ id: Date.now(), label: 'Approval 1', approvers: [] }]
                        };
                    }
                });

                setConfigs(newConfigs);
            }
        } catch (err) {
            console.error('Error loading approvals data:', err);
            toast.error('Failed to load approval workflows');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setExtraBreadcrumbs(
            currentConfigView !== 'main' ? [{ label: currentConfigView }] : []
        );
        if (id) {
            loadData();
        }
    }, [id, currentConfigView, setExtraBreadcrumbs]);

    const updateConfig = (section, cfg) =>
        setConfigs(prev => ({ ...prev, [section]: cfg }));

    const saveSingleSection = async (section) => {
        const config = configs[section];
        if (!config) return;

        const hasReporters = config.reporters.length > 0;
        const hasApprovers = config.approvalLevels.some(l => l.approvers.length > 0);
        const existingTemplate = templates.find(t => t.name === section);

        if (!hasReporters && !hasApprovers && !existingTemplate) return;

        let documentId;

        if (!existingTemplate) {
            const docType = EPISODIC_SECTIONS.includes(section) ? 'episodic' : 'singleton';
            const createRes = await workflowApi.createTemplate({
                name: section,
                doc_type: docType,
                description: `${section} Workflow`,
                project_id: id
            });
            if (createRes.success) {
                documentId = createRes.document_id;
            } else {
                throw new Error(`Failed to create template for ${section}`);
            }
        } else {
            documentId = existingTemplate.document_id;
        }

        const detailRes = await workflowApi.getTemplate(documentId);
        if (!detailRes.success || !detailRes.template) {
            throw new Error(`Failed to fetch template detail for ${section}`);
        }
        const currentTemplate = detailRes.template;

        await Promise.all(
            (currentTemplate.document_roles || []).map(r => workflowApi.removeRole(documentId, r.id).catch(() => null))
        );
        await Promise.all(
            (currentTemplate.approval_levels || []).map(l => workflowApi.removeLevel(documentId, l.level_id).catch(() => null))
        );

        for (let i = 0; i < config.approvalLevels.length; i++) {
            const level = config.approvalLevels[i];
            const levelRes = await workflowApi.addLevel(documentId, {
                label: level.label,
                level_order: i + 1
            });
            if (levelRes.success) {
                const levelId = levelRes.level_id;
                await Promise.all(
                    level.approvers.map(emp =>
                        workflowApi.assignRole(documentId, {
                            id: emp.id,
                            role: 'approver',
                            level_id: levelId
                        })
                    )
                );
            }
        }

        await Promise.all(
            config.reporters.map(emp =>
                workflowApi.assignRole(documentId, {
                    id: emp.id,
                    role: 'reporter'
                })
            )
        );
    };

    const [savingSection, setSavingSection] = useState(null);

    const handleSaveSection = async (section) => {
        setSavingSection(section);
        try {
            await saveSingleSection(section);
            toast.success(`${section} workflow saved successfully`);
            await loadData();
        } catch (err) {
            console.error('Error saving section workflow:', err);
            toast.error(`Failed to save ${section} workflow`);
        } finally {
            setSavingSection(null);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const sectionsToSave = Array.from(new Set([
                ...ALL_CONFIG_SECTIONS,
                ...templates.map(t => t.name)
            ]));

            await Promise.all(sectionsToSave.map(section => saveSingleSection(section)));

            setSaved(true);
            toast.success('Approval workflows saved successfully');
            setTimeout(() => setSaved(false), 2500);
            await loadData();
        } catch (err) {
            console.error('Error saving workflows:', err);
            toast.error('Failed to save approval workflows');
        } finally {
            setSaving(false);
        }
    };

    const totalAssigned = Object.values(configs).reduce((sum, cfg) =>
        sum + (cfg?.reporters?.length || 0) + (cfg?.approvalLevels?.reduce((s, l) => s + l.approvers.length, 0) || 0), 0);

    const renderSubTabSwitcher = () => {
        if (!isAdmin) return null;
        return (
            <div className="px-3 py-1.5 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 flex shrink-0">
                <div className="inline-flex p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                    {[
                        { id: 'access', label: 'Member Permissions' },
                        { id: 'workflows', label: 'Approval Workflows' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={`flex items-center px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${activeSubTab === tab.id
                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // ─── Approvals Skeleton Loader ─────────────────────────────────────────────
    const ApprovalsSkeleton = ({ renderSubTabSwitcher }) => (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            {renderSubTabSwitcher && renderSubTabSwitcher()}

            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel Skeleton */}
                <div className="w-[270px] sm:w-[280px] border-r border-gray-200 dark:border-white/10 flex flex-col p-3 space-y-3 shrink-0">
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/2 animate-pulse" />
                    <div className="h-8 bg-gray-100 dark:bg-white/5 rounded-md w-full animate-pulse" />
                    <div className="space-y-1.5 pt-1">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="flex items-center gap-2.5 p-2 rounded-md bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 animate-pulse">
                                <div className="w-7 h-7 rounded-md bg-gray-200 dark:bg-white/10 shrink-0" />
                                <div className="space-y-1 flex-1">
                                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
                                    <div className="h-2 bg-gray-200 dark:bg-white/5 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel Skeleton */}
                <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
                    <div className="p-3.5 rounded-md border border-gray-200 dark:border-white/10 space-y-3 animate-pulse">
                        <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-12 bg-gray-100 dark:bg-white/5 rounded-md" />
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/4" />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="bg-white dark:bg-[#161b22] rounded-md border border-gray-200 dark:border-white/8 p-4 space-y-3 animate-pulse">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-md bg-gray-200 dark:bg-white/10 shrink-0" />
                                            <div className="h-3.5 bg-gray-200 dark:bg-white/10 rounded w-28" />
                                        </div>
                                        <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-14" />
                                    </div>
                                    <div className="h-10 bg-gray-50 dark:bg-[#0d1117] rounded-md border border-gray-100 dark:border-white/5" />
                                    <div className="h-12 bg-gray-50 dark:bg-[#0d1117] rounded-md border border-gray-100 dark:border-white/5" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (isAdmin && activeSubTab === 'access') {
        return (
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
                {renderSubTabSwitcher()}
                <AccessControl />
            </div>
        );
    }

    if (loading) {
        return <ApprovalsSkeleton renderSubTabSwitcher={renderSubTabSwitcher} />;
    }

    let currentSections = currentConfigView === 'main'
        ? MAIN_SECTIONS
        : (SUB_SECTIONS[currentConfigView] || []);

    if (currentConfigView === 'General Documents') {
        const singletons = ['Project Vendor List', 'Project Directory', 'Staff Roles', 'Project Summary', 'Organisation Chart'];
        const defaults = ['Agenda of Meeting', 'Minutes of Meeting', 'Daily Progress Report (DPR)'];
        currentSections = [...singletons, ...defaults];
    }

    const filteredSections = currentSections.filter(s =>
        s.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayedSections = selectedSection === 'all'
        ? filteredSections
        : filteredSections.filter(s => s === selectedSection);

    const templateKeyMap = Object.fromEntries(templates.map(t => [t.name, t.document_id]));

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1.0] }}
            className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left"
        >
            {renderSubTabSwitcher()}

            {/* Split Screen Master-Detail Layout matching AccessControl */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Sections List */}
                <div className="w-[270px] sm:w-[280px] border-r border-gray-200 dark:border-white/10 flex flex-col bg-gray-50/50 dark:bg-transparent shrink-0">
                    <div className="p-3 border-b border-gray-200 dark:border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Workflow Sections
                            </label>
                            {currentConfigView !== 'main' && (
                                <button
                                    onClick={() => {
                                        setCurrentConfigView('main');
                                        setSelectedSection('all');
                                    }}
                                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                >
                                    <ArrowLeft size={10} /> Back
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Filter sections..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md text-xs focus:outline-none appearance-none font-medium truncate text-gray-800 dark:text-white"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {/* All Sections selection */}
                        <div
                            onClick={() => setSelectedSection('all')}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer group transition-all ${selectedSection === 'all'
                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-500/30 shadow-xs text-blue-600 dark:text-blue-400 font-bold'
                                : 'hover:bg-gray-100 dark:hover:bg-white/[0.02] border border-transparent text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0">
                                    <Shield size={14} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold truncate">All Sections</p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{currentSections.length} modules</p>
                                </div>
                            </div>
                            {totalAssigned > 0 && (
                                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[9px] font-bold rounded">
                                    {totalAssigned}
                                </span>
                            )}
                        </div>

                        {/* Individual Section list items */}
                        {filteredSections.map((sec, idx) => {
                            const cfg = configs[sec];
                            const assignedCount = (cfg?.reporters?.length || 0) + (cfg?.approvalLevels?.reduce((s, l) => s + l.approvers.length, 0) || 0);
                            const isSelected = selectedSection === sec;
                            const hasSubs = !!SUB_SECTIONS[sec];
                            return (
                                <motion.div
                                    key={sec}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.18, delay: idx * 0.02 }}
                                    onClick={() => setSelectedSection(sec)}
                                    className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer group transition-all ${isSelected
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-500/30 shadow-xs'
                                        : 'hover:bg-gray-100 dark:hover:bg-white/[0.02] border border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'}`}>
                                            <GitBranch size={13} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                                {sec}
                                            </p>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                                {hasSubs ? `${SUB_SECTIONS[sec].length} sub-docs` : 'Singleton'}
                                            </p>
                                        </div>
                                    </div>
                                    {assignedCount > 0 && (
                                        <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-bold rounded">
                                            {assignedCount}
                                        </span>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Approval Workflows Content */}
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
                    {/* Top Summary Banner matching Member Permissions templates bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.04 }}
                        className="p-3.5 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100/60 dark:border-blue-500/20 rounded-md space-y-2.5 mb-4"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                                <Shield size={14} className="text-blue-500" />
                                <span>{currentConfigView === 'main' ? 'Project Approval Workflows' : `${currentConfigView} Sub-Documents`}</span>
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] rounded-md font-bold">
                                    {totalAssigned} Total Assignments
                                </span>
                            </div>
                        </div>

                        {/* Quick summary stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                            <div className="p-2.5 bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/10 rounded-md flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Configured Sections</span>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">{ALL_CONFIG_SECTIONS.length}</span>
                            </div>
                            <div className="p-2.5 bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/10 rounded-md flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Approvers</span>
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                    {Object.values(configs).reduce((sum, cfg) => sum + (cfg?.approvalLevels?.reduce((s, l) => s + l.approvers.length, 0) || 0), 0)}
                                </span>
                            </div>
                            <div className="p-2.5 bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/10 rounded-md flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Reporters</span>
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                    {Object.values(configs).reduce((sum, cfg) => sum + (cfg?.reporters?.length || 0), 0)}
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Section Cards Grid / Focused View */}
                    <div className="space-y-3">

                        <div className={selectedSection === 'all' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5" : "space-y-3"}>
                            {displayedSections.map((section, idx) => {
                                const hasSubs = !!SUB_SECTIONS[section];
                                const isSummaryView = selectedSection === 'all';

                                return (
                                    <motion.div
                                        key={templateKeyMap[section] ?? section}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2, delay: idx * 0.03, ease: 'easeOut' }}
                                    >
                                        {isSummaryView ? (
                                            <SectionSummaryCard
                                                section={section}
                                                config={configs[section]}
                                                onSelectSection={() => setSelectedSection(section)}
                                                subSectionsCount={hasSubs ? SUB_SECTIONS[section].length : 0}
                                            />
                                        ) : (
                                            <SectionCard
                                                section={section}
                                                config={configs[section]}
                                                onChange={(cfg) => updateConfig(section, cfg)}
                                                canWrite={canWrite}
                                                employees={employees}
                                                onExplore={hasSubs ? () => setCurrentConfigView(section) : null}
                                                subSectionsCount={hasSubs ? SUB_SECTIONS[section].length : 0}
                                                onSaveSection={() => handleSaveSection(section)}
                                                savingSection={savingSection === section}
                                            />
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default Approvals;
