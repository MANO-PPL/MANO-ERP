import React, { useState, useEffect } from 'react';
import {
    Plus, X, ChevronDown, ChevronUp, Users,
    GitBranch, Shield, CheckCircle2, Trash2, UserCheck,
    Pencil, Check, ArrowUp, ArrowDown
} from 'lucide-react';
import AccessControl from '../AccessControl';
import { toast } from 'react-toastify';

// ─── Employee pool ─────────────────────────────────────────────────────────
const EMPLOYEES = [
    { id: 1, name: 'Madhavan S', role: 'Super Admin', initials: 'MS', color: 'from-blue-400 to-indigo-500' },
    { id: 2, name: 'Sathish Kumar', role: 'Project Manager', initials: 'SK', color: 'from-purple-400 to-pink-500' },
    { id: 3, name: 'Mano Kakoos', role: 'Site Lead', initials: 'MK', color: 'from-orange-400 to-red-500' },
    { id: 4, name: 'Harish R', role: 'Viewer', initials: 'HR', color: 'from-teal-400 to-green-500' },
    { id: 5, name: 'Admin User', role: 'Admin', initials: 'AU', color: 'from-gray-400 to-slate-500' },
    { id: 6, name: 'Jane Doe', role: 'Designer', initials: 'JD', color: 'from-pink-400 to-rose-500' },
    { id: 7, name: 'Raj Mehta', role: 'Engineer', initials: 'RM', color: 'from-cyan-400 to-blue-500' },
    { id: 8, name: 'Priya Sharma', role: 'QA Lead', initials: 'PS', color: 'from-violet-400 to-purple-500' },
];

// ─── Project sections ──────────────────────────────────────────────────────
const SECTIONS = [
    'Dashboard', 'Tasks', 'WIP', 'Reports',
    'General Documents', 'Drawings', 'Planning',
    'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management',
];

// ─── Default approval config per section ─────────────────────────────────
const defaultConfig = () => ({
    reporters: [],
    approvalLevels: [{ id: Date.now(), label: 'Approval 1', approvers: [] }],
});

// ─── Avatar chip ───────────────────────────────────────────────────────────
const Chip = ({ emp, onRemove }) => (
    <div className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-500/30 rounded-full">
        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
            {emp.initials}
        </div>
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">{emp.name}</span>
        {onRemove && (
            <button onClick={onRemove} className="text-blue-300 hover:text-red-500 transition-colors ml-0.5">
                <X size={10} />
            </button>
        )}
    </div>
);

// ─── Employee picker dropdown ──────────────────────────────────────────────
const EmpPicker = ({ selected, onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = React.useRef(null);

    const openDropdown = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.left });
        }
        setOpen(o => !o);
    };

    const toggle = (emp) => {
        const exists = selected.find(e => e.id === emp.id);
        onChange(exists ? selected.filter(e => e.id !== emp.id) : [...selected, emp]);
    };

    return (
        <div className="relative">
            <button
                ref={btnRef}
                type="button"
                onClick={openDropdown}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:border-blue-400 transition-colors"
            >
                <Users size={12} className="shrink-0" />
                <span>{selected.length > 0 ? `${selected.length} selected` : placeholder}</span>
                <ChevronDown size={11} className="ml-1 opacity-60" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
                    <div
                        className="fixed z-[9999] w-56 bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden"
                        style={{ top: pos.top, left: pos.left }}
                    >
                        {EMPLOYEES.map(emp => {
                            const sel = !!selected.find(e => e.id === emp.id);
                            return (
                                <button key={emp.id} type="button" onClick={() => toggle(emp)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors text-sm ${sel ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                                        {emp.initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-800 dark:text-white truncate text-xs">{emp.name}</p>
                                        <p className="text-[10px] text-gray-400">{emp.role}</p>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${sel ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-white/20'}`}>
                                        {sel && (
                                            <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="1,4 3.5,6.5 9,1" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};


// ─── Level Row (single approval level with rename + reorder) ──────────────
const LevelRow = ({ level, idx, total, onApproversChange, onRemove, onRename, onMove, canWrite }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(level.label);

    const commitRename = () => {
        onRename(draft.trim() || level.label);
        setEditing(false);
    };

    // colour coding: first level = blue, last = purple, middle = indigo
    const badgeColor = idx === 0 ? 'bg-blue-500' : idx === total - 1 ? 'bg-purple-600' : 'bg-indigo-500';

    return (
        <div className="bg-gray-50 dark:bg-[#0d1117] rounded-xl border border-gray-100 dark:border-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
                {/* Up / Down reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                        disabled={idx === 0 || !canWrite}
                        onClick={() => onMove(-1)}
                        className="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move up (higher priority)"
                    >
                        <ArrowUp size={11} />
                    </button>
                    <button
                        disabled={idx === total - 1 || !canWrite}
                        onClick={() => onMove(1)}
                        className="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Move down (lower priority)"
                    >
                        <ArrowDown size={11} />
                    </button>
                </div>

                {/* Level badge */}
                <div className={`w-5 h-5 rounded-full ${badgeColor} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                    {idx + 1}
                </div>

                {/* Editable label */}
                {editing ? (
                    <div className="flex items-center gap-1 flex-1">
                        <input
                            autoFocus
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
                            className="flex-1 bg-white dark:bg-[#161b22] border border-blue-400 rounded-md px-2 py-0.5 text-xs font-semibold text-gray-800 dark:text-white outline-none"
                        />
                        <button onClick={commitRename} className="p-1 rounded text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"><Check size={12} /></button>
                        <button onClick={() => setEditing(false)} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"><X size={12} /></button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{level.label}</span>
                        {canWrite && <button onClick={() => { setDraft(level.label); setEditing(true); }} className="p-0.5 rounded text-gray-300 hover:text-blue-500 transition-colors shrink-0"><Pencil size={10} /></button>}
                    </div>
                )}

                {/* Approver picker */}
                {canWrite && <EmpPicker selected={level.approvers} onChange={onApproversChange} placeholder="Add approvers…" />}

                {/* Remove */}
                {total > 1 && canWrite && (
                    <button onClick={onRemove} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0" title="Remove level">
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            {/* Approver chips */}
            {level.approvers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ml-9">
                    {level.approvers.map(emp => (
                        <Chip key={emp.id} emp={emp}
                            onRemove={canWrite ? () => onApproversChange(level.approvers.filter(e => e.id !== emp.id)) : null} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Section Card ──────────────────────────────────────────────────────────
const SectionCard = ({ section, config, onChange, canWrite }) => {

    const setReporters = (reporters) => onChange({ ...config, reporters });

    const setLevelApprovers = (levelId, approvers) =>
        onChange({ ...config, approvalLevels: config.approvalLevels.map(l => l.id === levelId ? { ...l, approvers } : l) });

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

    const totalConfigured =
        config.reporters.length +
        config.approvalLevels.reduce((s, l) => s + l.approvers.length, 0);

    return (
        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-white/8 shadow-sm">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                        <GitBranch size={15} className="text-blue-500" />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{section}</span>
                    {totalConfigured > 0 && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full">
                            {totalConfigured} assigned
                        </span>
                    )}
                </div>
            </div>

            <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-white/5 pt-4">

                {/* Reporters row */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Users size={12} className="text-indigo-500" />
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reporters</span>
                        {canWrite && (
                            <EmpPicker
                                selected={config.reporters}
                                onChange={setReporters}
                                placeholder="Add reporters…"
                            />
                        )}
                    </div>
                    {config.reporters.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 ml-5">
                            {config.reporters.map(emp => (
                                <Chip key={emp.id} emp={emp} onRemove={canWrite ? () => setReporters(config.reporters.filter(e => e.id !== emp.id)) : null} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Approval levels */}
                <div className="space-y-2">
                    {/* Hierarchy hint */}
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-gray-400 font-medium">Level order: top = first approval → bottom = final approval</span>
                    </div>
                    {config.approvalLevels.map((level, idx) => (
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
                        />
                    ))}

                    {/* Add approval level */}
                    {canWrite && (
                        <button
                            onClick={addLevel}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-dashed border-blue-300 dark:border-blue-500/40"
                        >
                            <Plus size={12} /> Add Approval Level
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main Approvals page ───────────────────────────────────────────────────
const Approvals = ({ setExtraBreadcrumbs, project, projectPermissions, isAdmin }) => {
    const canWrite = isAdmin || (projectPermissions && projectPermissions['Approvals'] >= 2);
    const [configs, setConfigs] = useState(() => {
        const c = {};
        SECTIONS.forEach(s => { c[s] = defaultConfig(); });
        return c;
    });
    const [saved, setSaved] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('workflows'); // 'workflows' or 'access'

    useEffect(() => {
        setExtraBreadcrumbs([{ label: 'Approvals' }]);
    }, [setExtraBreadcrumbs]);

    const updateConfig = (section, cfg) =>
        setConfigs(prev => ({ ...prev, [section]: cfg }));

    const handleSave = () => {
        setSaved(true);
        toast.success('Approval workflows saved successfully');
        setTimeout(() => setSaved(false), 2500);
    };

    const totalAssigned = Object.values(configs).reduce((sum, cfg) =>
        sum + cfg.reporters.length + cfg.approvalLevels.reduce((s, l) => s + l.approvers.length, 0), 0);

    if (isAdmin && activeSubTab === 'access') {
        return (
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
                {/* Sub Tab Switcher */}
                <div className="px-6 py-2 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-white/5 flex gap-4 shrink-0">
                    <button
                        onClick={() => setActiveSubTab('workflows')}
                        className="py-1 px-3 text-xs font-semibold rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                        Approval Workflows
                    </button>
                    <button
                        onClick={() => setActiveSubTab('access')}
                        className="py-1 px-3 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    >
                        Member Permissions
                    </button>
                </div>
                <AccessControl />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            {/* Sub Tab Switcher */}
            {isAdmin && (
                <div className="px-6 py-2 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-white/5 flex gap-4 shrink-0">
                    <button
                        onClick={() => setActiveSubTab('workflows')}
                        className="py-1 px-3 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    >
                        Approval Workflows
                    </button>
                    <button
                        onClick={() => setActiveSubTab('access')}
                        className="py-1 px-3 text-xs font-semibold rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                        Member Permissions
                    </button>
                </div>
            )}

            {/* Page header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#0d1117] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                        <Shield size={18} className="text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">Approval Workflows</h2>
                    </div>
                    {totalAssigned > 0 && (
                        <span className="ml-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full border border-blue-100 dark:border-blue-500/30">
                            {totalAssigned} total assignments
                        </span>
                    )}
                </div>
                {canWrite && (
                    <button
                        onClick={handleSave}
                        className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 ${saved ? 'bg-green-500 text-white shadow-green-500/25' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'}`}
                    >
                        {saved ? <><CheckCircle2 size={15} /> Saved!</> : <><UserCheck size={15} /> Save Workflows</>}
                    </button>
                )}
            </div>

            {/* Section cards */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="grid grid-cols-2 gap-4">
                    {SECTIONS.map(section => (
                        <SectionCard
                            key={section}
                            section={section}
                            config={configs[section]}
                            onChange={(cfg) => updateConfig(section, cfg)}
                            canWrite={canWrite}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Approvals;
