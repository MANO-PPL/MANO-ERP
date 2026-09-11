import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Users,
    Briefcase,
    ArrowUpRight,
    Activity,
    ShieldAlert,
    ExternalLink
} from 'lucide-react';

const HEALTH_CONFIG = {
    'On Track': {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        icon: CheckCircle2
    },
    'At Risk': {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
        icon: AlertTriangle
    },
    'Delayed': {
        bg: 'bg-red-50 dark:bg-red-950/40',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-200 dark:border-red-800',
        dot: 'bg-red-500',
        icon: ShieldAlert
    },
    'Needs Attention': {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
        icon: AlertTriangle
    },
    'Active': {
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
        dot: 'bg-blue-500',
        icon: Activity
    }
};

export function AgentExecutiveCard({ briefing, preview = false }) {
    const navigate = useNavigate();

    const {
        projectId,
        projectName,
        projectCode,
        status = 'active',
        location,
        timeline = {},
        tasks = {},
        stakeholders = {},
        team = {},
        quickLinks = []
    } = briefing || {};

    const health = HEALTH_CONFIG[timeline.health] || HEALTH_CONFIG['Active'];
    const HealthIcon = health.icon;

    const handleTeleport = (path) => {
        if (!preview && path) {
            navigate(path);
        }
    };

    return (
        <section
            className="rounded-xl border border-gray-200/90 bg-white p-4 text-xs shadow-2xs transition-all dark:border-gh-border dark:bg-gh-subtle"
            aria-label={`Executive Briefing: ${projectName}`}
        >
            {preview && (
                <div className="mb-2.5 inline-block rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    Simulation · Preview Only
                </div>
            )}

            {/* Header: Project Identity & Status */}
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gh-border">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                            <Building2 size={16} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                                {projectName || `Project #${projectId}`}
                            </h3>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gh-muted">
                                {projectCode && (
                                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                                        [{projectCode}]
                                    </span>
                                )}
                                {location && <span>· {location}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Health & Status Badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${health.bg} ${health.text} ${health.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${health.dot} animate-pulse`} />
                        <HealthIcon size={12} />
                        {timeline.health || 'Active'}
                    </span>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-600 dark:border-gh-border dark:bg-gh-hover dark:text-gray-300">
                        {status}
                    </span>
                </div>
            </div>

            {/* Progress Trackers */}
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {/* Task Completion Progress */}
                <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 dark:border-gh-border dark:bg-gh-hover/30">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Task Completion</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{tasks.completionRate ?? 0}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, tasks.completionRate ?? 0))}%` }}
                        />
                    </div>
                    <div className="mt-1 text-right text-[10px] text-gray-500 dark:text-gh-muted">
                        {tasks.completed ?? 0} of {tasks.total ?? 0} completed
                    </div>
                </div>

                {/* Timeline Progress */}
                <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 dark:border-gh-border dark:bg-gh-hover/30">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Schedule Elapsed</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">
                            {timeline.elapsedPercent !== null && timeline.elapsedPercent !== undefined
                                ? `${timeline.elapsedPercent}%`
                                : 'Flexible'}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, timeline.elapsedPercent ?? 0))}%` }}
                        />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-gh-muted">
                        <span>{timeline.startDate || 'Start date unset'}</span>
                        <span>{timeline.endDate || 'End date unset'}</span>
                    </div>
                </div>
            </div>

            {/* Metrics KPI Grid */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-gray-100 bg-white p-2 text-center dark:border-gh-border dark:bg-gh-subtle">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gh-muted">In Progress</div>
                    <div className="mt-0.5 text-base font-bold text-blue-600 dark:text-blue-400">
                        {tasks.inProgress ?? 0}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">{tasks.pending ?? 0} pending</div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-white p-2 text-center dark:border-gh-border dark:bg-gh-subtle">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gh-muted">Overdue</div>
                    <div className={`mt-0.5 text-base font-bold ${tasks.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                        {tasks.overdue ?? 0}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">
                        {tasks.highPriority ? `${tasks.highPriority} urgent` : 'No urgent tasks'}
                    </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-white p-2 text-center dark:border-gh-border dark:bg-gh-subtle">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gh-muted">Stakeholders</div>
                    <div className="mt-0.5 text-base font-bold text-purple-600 dark:text-purple-400">
                        {stakeholders.partiesCount ?? 0}
                    </div>
                    <div className="truncate text-[10px] text-gray-400 dark:text-gray-500">
                        {stakeholders.clientName ? `Client: ${stakeholders.clientName}` : 'No client linked'}
                    </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-white p-2 text-center dark:border-gh-border dark:bg-gh-subtle">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gh-muted">Team Members</div>
                    <div className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {team.memberCount ?? 0}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">Assigned staff</div>
                </div>
            </div>

            {/* Key Stakeholders & Key Staff Chips */}
            {((stakeholders.keyParties && stakeholders.keyParties.length > 0) || (team.keyMembers && team.keyMembers.length > 0)) && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-2.5 dark:border-gh-border">
                    {stakeholders.keyParties && stakeholders.keyParties.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gh-muted">Parties:</span>
                            {stakeholders.keyParties.map((party, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-700 dark:border-gh-border dark:bg-gh-hover dark:text-gray-300"
                                >
                                    <span className="font-medium">{party.name}</span>
                                    <span className="text-gray-400 dark:text-gray-500">({party.category})</span>
                                </span>
                            ))}
                        </div>
                    )}

                    {team.keyMembers && team.keyMembers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gh-muted">Team:</span>
                            {team.keyMembers.map((member, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50/60 px-2 py-0.5 text-[10px] text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                                >
                                    <span className="font-medium">{member.name}</span>
                                    <span className="text-blue-500 dark:text-blue-400">· {member.role}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Project Phases */}
            {briefing?.phases && briefing.phases.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-2.5 dark:border-gh-border">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                        <span>Project Phases ({briefing.phases.length})</span>
                        <span className="text-[10px] text-gray-400 dark:text-gh-muted">
                            {briefing.phases.filter(p => p.status === 'Completed' || p.progress >= 100).length} of {briefing.phases.length} completed
                        </span>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                        {briefing.phases.map((phase, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/70 p-2 text-[11px] dark:border-gh-border dark:bg-gh-hover/20"
                            >
                                <div className="min-w-0 flex-1 truncate">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                                        {phase.name}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 dark:text-gh-muted">
                                        {phase.weight ? <span>Weight: {phase.weight}%</span> : null}
                                        {phase.startDate && phase.endDate ? (
                                            <span>· {phase.startDate} to {phase.endDate}</span>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                        {phase.progress}%
                                    </span>
                                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                        phase.progress >= 100
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                            : phase.progress > 0
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gh-subtle dark:text-gray-400'
                                    }`}>
                                        {phase.status || (phase.progress >= 100 ? 'Completed' : phase.progress > 0 ? 'In Progress' : 'Pending')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Action Teleports */}
            {quickLinks && quickLinks.length > 0 && (
                <div className="mt-3.5 border-t border-gray-100 pt-2.5 dark:border-gh-border">
                    <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gh-muted">
                        <span>Quick Teleport</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">Open module</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {quickLinks.map((link, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleTeleport(link.path)}
                                className="group inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-2xs hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 transition-all dark:border-gh-border dark:bg-gh-subtle dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
                            >
                                <span>{link.label}</span>
                                <ArrowUpRight size={13} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

export default AgentExecutiveCard;
