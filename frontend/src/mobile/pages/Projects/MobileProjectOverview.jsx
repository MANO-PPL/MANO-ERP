import React, { useEffect, useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    Building2,
    CalendarDays,
    Flag,
    MapPin,
    Pencil,
    PieChart,
    TrendingUp,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import { projectApi } from '../../../services/projectApi.js';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import { normalizeProject } from './projectModel';

const ISSUE_VALUES = ['None', 'Risk', 'Blocked', 'Resolved'];

function formatCurrency(amount) {
    const val = Number(amount) || 0;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
}

export default function MobileProjectOverview({
    open,
    onClose,
    project,
    canWrite,
    onEdit,
    onOpenProject,
    onMetadataChange,
    projectService = projectApi,
}) {
    const [details, setDetails] = useState(project);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [metadataSaving, setMetadataSaving] = useState(false);
    const [tag, setTag] = useState('');

    useEffect(() => {
        if (!open || !project?.id) return undefined;
        let active = true;
        setDetails(project);
        setMembers([]);
        setLoading(true);
        Promise.all([
            projectService.getProject(project.id).catch(() => null),
            projectService.getProjectMembers(project.id).catch(() => null),
        ]).then(([projectResponse, membersResponse]) => {
            if (!active) return;
            if (projectResponse?.success && projectResponse.project) {
                setDetails(normalizeProject(projectResponse.project));
            }
            if (membersResponse?.success && Array.isArray(membersResponse.members)) {
                setMembers(membersResponse.members);
            }
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [open, project, projectService]);

    if (!project) return null;
    const display = details || project;
    const progressPct = Math.round(Number(display.completion ?? display.progress ?? 0));
    const budgetVal = Number(display.budget ?? 0);
    const spentVal = Number(display.spent ?? display.executed ?? (budgetVal * (progressPct / 100)));

    const saveMetadata = async (changes) => {
        if (!onMetadataChange || metadataSaving) return false;
        setMetadataSaving(true);
        try {
            const saved = await onMetadataChange(display, changes);
            if (saved) {
                setDetails((current) => ({ ...current, ...changes, metadata: { ...current.metadata, ...changes } }));
            }
            return Boolean(saved);
        } catch {
            return false;
        } finally {
            setMetadataSaving(false);
        }
    };

    const addTag = async () => {
        const nextTag = tag.trim();
        if (!nextTag || display.tags?.includes(nextTag)) return;
        const saved = await saveMetadata({ tags: [...(display.tags || []), nextTag] });
        if (saved) setTag('');
    };

    const removeTag = async (removed) => {
        const tags = (display.tags || []).filter((item) => item !== removed);
        await saveMetadata({ tags });
    };

    return (
        <MobileBottomSheet
            open={open}
            onClose={onClose}
            title={display.name}
            description={`${display.code || 'PRJ'} · ${display.archived ? 'Archived' : display.statusLabel || 'Active'}`}
        >
            <div className="space-y-3.5 pb-2">
                {/* Optional Banner Logo Image Header */}
                {display.logoUrl && (
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gh-border">
                        <img
                            src={display.logoUrl}
                            alt={display.name}
                            className="h-28 w-full object-cover"
                        />
                    </div>
                )}

                {/* 3-Column Quick Metrics Grid matching MANO-App project_overview_sheet.dart */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5 text-center dark:border-blue-900/50 dark:bg-blue-950/20">
                        <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                            <Wallet size={15} />
                        </div>
                        <p className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gh-muted">Total Budget</p>
                        <p className="mt-0.5 font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                            {formatCurrency(budgetVal)}
                        </p>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
                        <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                            <TrendingUp size={15} />
                        </div>
                        <p className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gh-muted">Executed</p>
                        <p className="mt-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            {formatCurrency(spentVal)}
                        </p>
                    </div>

                    <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-2.5 text-center dark:border-purple-900/50 dark:bg-purple-950/20">
                        <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300">
                            <PieChart size={15} />
                        </div>
                        <p className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gh-muted">Progress</p>
                        <p className="mt-0.5 font-mono text-xs font-bold text-purple-700 dark:text-purple-300">
                            {progressPct}%
                        </p>
                    </div>
                </div>

                {/* Details List with Icons */}
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gh-border dark:border-gh-border dark:bg-[#161B22]">
                    <div className="flex items-center justify-between p-2.5 text-xs">
                        <span className="flex items-center gap-2 text-gray-500 dark:text-gh-muted">
                            <Building2 size={14} className="text-gray-400" /> Employer / Owner
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gh-text">{display.owner || '—'}</span>
                    </div>

                    {display.client && display.client !== display.owner && (
                        <div className="flex items-center justify-between p-2.5 text-xs">
                            <span className="flex items-center gap-2 text-gray-500 dark:text-gh-muted">
                                <Building2 size={14} className="text-gray-400" /> Client
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-gh-text">{display.client}</span>
                        </div>
                    )}

                    {display.location && (
                        <div className="flex items-center justify-between p-2.5 text-xs">
                            <span className="flex items-center gap-2 text-gray-500 dark:text-gh-muted">
                                <MapPin size={14} className="text-gray-400" /> Location
                            </span>
                            <span className="max-w-[60%] truncate font-semibold text-gray-900 dark:text-gh-text">{display.location}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between p-2.5 text-xs">
                        <span className="flex items-center gap-2 text-gray-500 dark:text-gh-muted">
                            <CalendarDays size={14} className="text-gray-400" /> Timeline
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gh-text">
                            {display.startDate || 'Started'} to {display.endDate || 'Ongoing'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 text-xs">
                        <span className="flex items-center gap-2 text-gray-500 dark:text-gh-muted">
                            <Flag size={14} className="text-gray-400" /> Phases Status
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gh-text">
                            {display.totalPhases > 0 ? `${display.completedPhases} / ${display.totalPhases} Completed` : 'Execution Phase'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 text-xs">
                        <span className="flex items-center gap-2 text-gray-500 dark:text-gh-muted">
                            <AlertTriangle size={14} className="text-gray-400" /> Issues Status
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase ${
                            (display.issues || 'None').toLowerCase() === 'blocked'
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : (display.issues || 'None').toLowerCase() === 'risk'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gh-bg dark:text-gh-muted'
                        }`}>
                            {display.issues || 'None'}
                        </span>
                    </div>
                </div>

                {/* Project Description */}
                {display.description && (
                    <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">
                            Project Description
                        </h4>
                        <p className="mt-1 rounded-xl bg-gray-50 p-2.5 text-xs leading-relaxed text-gray-700 dark:bg-gh-bg dark:text-gh-text">
                            {display.description}
                        </p>
                    </div>
                )}

                {/* Assigned Team Members with Avatar Chips */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">
                        Assigned Team Members ({members.length || display.memberCount || 0})
                    </h4>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {loading ? (
                            <p className="text-xs text-gray-400">Loading members…</p>
                        ) : members.length > 0 ? (
                            members.map((m, idx) => {
                                const name = m.user_name || m.name || 'Member';
                                const role = m.user_type || m.role || 'Team';
                                const initial = name.charAt(0).toUpperCase();
                                return (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50/70 py-1 pl-1.5 pr-2.5 text-xs dark:border-gh-border dark:bg-gh-bg"
                                    >
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                                            {initial}
                                        </span>
                                        <div className="leading-tight">
                                            <p className="font-semibold text-gray-900 dark:text-gh-text">{name}</p>
                                            <p className="text-[9px] text-gray-500 dark:text-gh-muted">{role}</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-xs italic text-gray-400">No members explicitly assigned yet.</p>
                        )}
                    </div>
                </div>

                {/* Tags */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">
                        Tags
                    </h4>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(display.tags || []).map((item) => (
                            <span
                                key={item}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                            >
                                {item}
                                {canWrite && (
                                    <button
                                        type="button"
                                        aria-label={`Remove ${item} tag`}
                                        onClick={() => removeTag(item)}
                                        className="ml-0.5 text-blue-400 hover:text-blue-700"
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canWrite && (
                        <div className="mt-2 flex gap-1.5">
                            <input
                                disabled={metadataSaving}
                                value={tag}
                                onChange={(e) => setTag(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                className="min-h-8 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input"
                                placeholder="Add a tag..."
                            />
                            <button
                                type="button"
                                disabled={metadataSaving || !tag.trim()}
                                onClick={addTag}
                                className="min-h-8 rounded-lg bg-blue-50 px-3 text-xs font-semibold text-blue-600 disabled:opacity-50 dark:bg-blue-950/60 dark:text-blue-400"
                            >
                                Add
                            </button>
                        </div>
                    )}
                </div>

                {/* Action Buttons matching MANO-App project_overview_sheet.dart */}
                <div className="flex items-center gap-2 pt-2">
                    {canWrite && (
                        <button
                            type="button"
                            onClick={() => onEdit?.(display)}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card"
                        >
                            <Pencil size={14} />
                            Edit Details
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onOpenProject?.(display)}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-[0.99]"
                    >
                        Access Project Directory
                        <ArrowRight size={15} />
                    </button>
                </div>
            </div>
        </MobileBottomSheet>
    );
}
