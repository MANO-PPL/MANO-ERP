import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
    'Dashboard', 'Tasks', 'WIP', 'Reports',
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
    'Dashboard', 'Tasks', 'WIP', 'Reports', 'Drawings', 'Planning',
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

// ─── Avatar chip ───────────────────────────────────────────────────────────
const Chip = ({ emp, onRemove }) => (
    <div className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-500/30 rounded-full animate-fade-in">
        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
            {emp.initials}
        </div>
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">{emp.name}</span>
        {onRemove && (
            <button onClick={onRemove} className="text-blue-300 hover:text-red-500 transition-colors ml-0.5 cursor-pointer">
                <X size={10} />
            </button>
        )}
    </div>
);

// ─── Employee picker dropdown ──────────────────────────────────────────────
const EmpPicker = ({ selected, onChange, placeholder, employees = [] }) => {
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
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:border-blue-400 transition-colors cursor-pointer"
            >
                <Users size={12} className="shrink-0" />
                <span>{selected.length > 0 ? `${selected.length} selected` : placeholder}</span>
                <ChevronDown size={11} className="ml-1 opacity-60" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
                    <div
                        className="fixed z-[9999] w-56 bg-white dark:bg-[#1a2235] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar"
                        style={{ top: pos.top, left: pos.left }}
                    >
                        {employees.map(emp => {
                            const sel = !!selected.find(e => e.id === emp.id);
                            return (
                                <button key={emp.id} type="button" onClick={() => toggle(emp)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors text-sm ${sel ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                                        {emp.initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-800 dark:text-white truncate text-xs">{emp.name}</p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-tight">{emp.role}</p>
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
const LevelRow = ({ level, idx, total, onApproversChange, onRemove, onRename, onMove, canWrite, employees = [] }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(level.label);

    const commitRename = () => {
        onRename(draft.trim() || level.label);
        setEditing(false);
    };

    const badgeColor = idx === 0 ? 'bg-blue-500' : idx === total - 1 ? 'bg-purple-600' : 'bg-indigo-500';

    return (
        <div className="bg-gray-50 dark:bg-[#0d1117] rounded-xl border border-gray-100 dark:border-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-2">
                {/* Up / Down reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                        disabled={idx === 0 || !canWrite}
                        onClick={() => onMove(-1)}
                        className="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Move up (higher priority)"
                    >
                        <ArrowUp size={11} />
                    </button>
                    <button
                        disabled={idx === total - 1 || !canWrite}
                        onClick={() => onMove(1)}
                        className="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                {canWrite && <EmpPicker selected={level.approvers} onChange={onApproversChange} placeholder="Add approvers…" employees={employees} />}

                {/* Remove */}
                {total > 1 && canWrite && (
                    <button onClick={onRemove} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0 cursor-pointer" title="Remove level">
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
const SectionCard = ({ section, config, onChange, canWrite, employees = [], onExplore, subSectionsCount }) => {

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

    if (onExplore) {
        return (
            <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-white/8 shadow-sm flex flex-col justify-between min-h-[180px] p-6 text-left">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                            <GitBranch size={15} className="text-blue-500" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{section}</span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full">
                        {subSectionsCount} sub-documents
                    </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-3">
                    This section contains multiple document types (e.g. Agendas, MoMs, Vendor lists) with individual approval hierarchies.
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-end mt-4">
                    <button
                        onClick={onExplore}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer"
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

    return (
        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-200 dark:border-white/8 shadow-sm text-left">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                        <GitBranch size={15} className="text-blue-500" />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{section}</span>
                    {['Agenda of Meeting', 'Minutes of Meeting', 'Daily Progress Report (DPR)'].includes(section) ? (
                        <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[8px] font-extrabold rounded uppercase tracking-wider whitespace-nowrap">
                            Category Default
                        </span>
                    ) : (section.startsWith('Agenda of Meeting') || section.startsWith('Minutes of Meeting') || section.startsWith('Daily Progress Report (DPR)')) ? (
                        <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[8px] font-extrabold rounded uppercase tracking-wider whitespace-nowrap">
                            Instance Workflow
                        </span>
                    ) : (
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400 text-[8px] font-extrabold rounded uppercase tracking-wider whitespace-nowrap">
                            Singleton
                        </span>
                    )}
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
                                selected={config?.reporters || []}
                                onChange={setReporters}
                                placeholder="Add reporters…"
                                employees={employees}
                            />
                        )}
                    </div>
                    {config?.reporters?.length > 0 && (
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
                        />
                    ))}

                    {/* Add approval level */}
                    {canWrite && (
                        <button
                            onClick={addLevel}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-dashed border-blue-300 dark:border-blue-500/40 cursor-pointer"
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
    const [currentConfigView, setCurrentConfigView] = useState('main'); // 'main' or the name of a section with sub-sections (e.g. 'General Documents')
    const [activeSubTab, setActiveSubTab] = useState('workflows'); // 'workflows' or 'access'

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all organization users instead of only project members
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
                        id: m.user_id,
                        name: m.user_name,
                        role: m.user_type,
                        initials,
                        color: colors[idx % colors.length]
                    };
                });
                setEmployees(mappedEmps);
            }

            // 2. Fetch document templates
            const templatesRes = await workflowApi.getTemplates(id);
            if (templatesRes.success && templatesRes.templates) {
                const fetchedTemplates = templatesRes.templates;
                setTemplates(fetchedTemplates);

                // Fetch details for each template in parallel
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
                        
                        // Map reporters (role = 'reporter')
                        const reporters = (t.document_roles || [])
                            .filter(r => r.role === 'reporter')
                            .map(r => mappedEmps.find(e => e.id === r.user_id))
                            .filter(Boolean);

                        // Map approval levels
                        const approvalLevels = (t.approval_levels || []).map(level => {
                            const levelApprovers = (t.document_roles || [])
                                .filter(r => r.role === 'approver' && r.level_id === level.level_id)
                                .map(r => mappedEmps.find(e => e.id === r.user_id))
                                .filter(Boolean);

                            return {
                                id: level.level_id,
                                label: level.label,
                                approvers: levelApprovers
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
        setExtraBreadcrumbs([
            { label: 'Approvals', onClick: () => setCurrentConfigView('main') },
            ...(currentConfigView !== 'main' ? [{ label: currentConfigView }] : [])
        ]);
        if (id) {
            loadData();
        }
    }, [id, currentConfigView]);

    const updateConfig = (section, cfg) =>
        setConfigs(prev => ({ ...prev, [section]: cfg }));

    // Helper: save a single section's workflow config
    const saveSingleSection = async (section) => {
        const config = configs[section];
        if (!config) return;

        const hasReporters = config.reporters.length > 0;
        const hasApprovers = config.approvalLevels.some(l => l.approvers.length > 0);
        const existingTemplate = templates.find(t => t.name === section);

        // Skip sections with no data AND no existing template to update
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

        // Fetch current template state
        const detailRes = await workflowApi.getTemplate(documentId);
        if (!detailRes.success || !detailRes.template) {
            throw new Error(`Failed to fetch template detail for ${section}`);
        }
        const currentTemplate = detailRes.template;

        // Clear existing roles first (roles FK-reference levels, so roles must go first)
        await Promise.all(
            (currentTemplate.document_roles || []).map(r => workflowApi.removeRole(documentId, r.id).catch(() => null))
        );
        // Then clear levels once roles are gone
        await Promise.all(
            (currentTemplate.approval_levels || []).map(l => workflowApi.removeLevel(documentId, l.level_id).catch(() => null))
        );

        // Re-create levels + assign approvers (levels must be sequential as IDs are needed)
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
                            user_id: emp.id,
                            role: 'approver',
                            level_id: levelId
                        }).catch(() => null)
                    )
                );
            }
        }

        // Assign reporters in parallel
        await Promise.all(
            config.reporters.map(emp =>
                workflowApi.assignRole(documentId, {
                    user_id: emp.id,
                    role: 'reporter'
                }).catch(() => null)
            )
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const sectionsToSave = Array.from(new Set([
                ...ALL_CONFIG_SECTIONS,
                ...templates.map(t => t.name)
            ]));

            // Run all section saves in parallel
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
            <div className="px-5 py-2.5 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 flex shrink-0">
                <div className="inline-flex p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                    {[
                        { id: 'workflows', label: 'Approval Workflows' },
                        { id: 'access', label: 'Member Permissions' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={`flex items-center px-4 py-1 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${activeSubTab === tab.id
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

    if (isAdmin && activeSubTab === 'access') {
        return (
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
                {renderSubTabSwitcher()}
                <AccessControl />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white dark:bg-[#0d1117] anim-fade-in Poppins text-left">
                <Loader2 size={36} className="text-blue-500 animate-spin mb-4" />
                <p className="text-sm text-gray-400">Loading approval workflows...</p>
            </div>
        );
    }

    let currentSections = currentConfigView === 'main' 
        ? MAIN_SECTIONS 
        : (SUB_SECTIONS[currentConfigView] || []);

    if (currentConfigView === 'General Documents') {
        const singletons = ['Project Vendor List', 'Project Directory', 'Staff Roles', 'Project Summary', 'Organisation Chart'];
        const defaults = ['Agenda of Meeting', 'Minutes of Meeting', 'Daily Progress Report (DPR)'];
        currentSections = [...singletons, ...defaults];
    }

    // Build a map of template name → document_id for stable, unique keys
    const templateKeyMap = Object.fromEntries(templates.map(t => [t.name, t.document_id]));

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            {renderSubTabSwitcher()}

            {/* Page header */}
            <div className="px-6 py-3 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#0d1117] shrink-0">
                <div className="flex items-center gap-3">
                    {currentConfigView !== 'main' && (
                        <button
                            onClick={() => setCurrentConfigView('main')}
                            className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                            title="Back to main workflows"
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                        <Shield size={16} className="text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                            {currentConfigView === 'main' ? 'Approval Workflows' : `${currentConfigView} Sub-Documents`}
                        </h2>
                    </div>
                    {totalAssigned > 0 && (
                        <span className="ml-2 px-2.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full border border-blue-100 dark:border-blue-500/30">
                            {totalAssigned} total assignments
                        </span>
                    )}
                </div>
                {canWrite && (
                    <button
                        disabled={saving}
                        onClick={handleSave}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer ${saving || saved ? '' : 'hover:scale-[1.02]'} ${saved ? 'bg-green-500 text-white shadow-green-500/25' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'}`}
                    >
                        {saving ? (
                            <><Loader2 size={13} className="animate-spin" /> Saving...</>
                        ) : saved ? (
                            <><CheckCircle2 size={13} /> Saved!</>
                        ) : (
                            <><UserCheck size={13} /> Save Workflows</>
                        )}
                    </button>
                )}
            </div>

            {/* Section cards */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="grid grid-cols-2 gap-3">
                    {currentSections.map(section => {
                        const hasSubs = !!SUB_SECTIONS[section];
                        return (
                            <SectionCard
                                key={templateKeyMap[section] ?? section}
                                section={section}
                                config={configs[section]}
                                onChange={(cfg) => updateConfig(section, cfg)}
                                canWrite={canWrite}
                                employees={employees}
                                onExplore={hasSubs ? () => setCurrentConfigView(section) : null}
                                subSectionsCount={hasSubs ? SUB_SECTIONS[section].length : 0}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Approvals;
