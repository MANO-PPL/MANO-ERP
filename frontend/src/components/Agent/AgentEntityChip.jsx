import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    Briefcase,
    Users,
    Package,
    Layers,
    ArrowUpRight
} from 'lucide-react';
import { customToast } from '../../utils/toast.js';

const ENTITY_CONFIG = {
    project: {
        label: 'Project',
        icon: Building2,
        bg: 'bg-blue-50/90 dark:bg-blue-950/60',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200/80 dark:border-blue-800/60',
        hover: 'hover:bg-blue-100/90 dark:hover:bg-blue-900/60 hover:border-blue-300',
        badgeBg: 'bg-blue-200/70 text-blue-800 dark:bg-blue-800/60 dark:text-blue-200'
    },
    vendor: {
        label: 'Vendor',
        icon: Briefcase,
        bg: 'bg-purple-50/90 dark:bg-purple-950/60',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-200/80 dark:border-purple-800/60',
        hover: 'hover:bg-purple-100/90 dark:hover:bg-purple-900/60 hover:border-purple-300',
        badgeBg: 'bg-purple-200/70 text-purple-800 dark:bg-purple-800/60 dark:text-purple-200'
    },
    client: {
        label: 'Client',
        icon: Users,
        bg: 'bg-emerald-50/90 dark:bg-emerald-950/60',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200/80 dark:border-emerald-800/60',
        hover: 'hover:bg-emerald-100/90 dark:hover:bg-emerald-900/60 hover:border-emerald-300',
        badgeBg: 'bg-emerald-200/70 text-emerald-800 dark:bg-emerald-800/60 dark:text-emerald-200'
    },
    resource: {
        label: 'Resource',
        icon: Package,
        bg: 'bg-amber-50/90 dark:bg-amber-950/60',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200/80 dark:border-amber-800/60',
        hover: 'hover:bg-amber-100/90 dark:hover:bg-amber-900/60 hover:border-amber-300',
        badgeBg: 'bg-amber-200/70 text-amber-800 dark:bg-amber-800/60 dark:text-amber-200'
    },
    material: {
        label: 'Material',
        icon: Package,
        bg: 'bg-amber-50/90 dark:bg-amber-950/60',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200/80 dark:border-amber-800/60',
        hover: 'hover:bg-amber-100/90 dark:hover:bg-amber-900/60 hover:border-amber-300',
        badgeBg: 'bg-amber-200/70 text-amber-800 dark:bg-amber-800/60 dark:text-amber-200'
    },
    drawing: {
        label: 'Drawing',
        icon: Layers,
        bg: 'bg-indigo-50/90 dark:bg-indigo-950/60',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-200/80 dark:border-indigo-800/60',
        hover: 'hover:bg-indigo-100/90 dark:hover:bg-indigo-900/60 hover:border-indigo-300',
        badgeBg: 'bg-indigo-200/70 text-indigo-800 dark:bg-indigo-800/60 dark:text-indigo-200'
    }
};

export function AgentEntityChip({
    entityType = 'project',
    entityId,
    label,
    route,
    onPrompt
}) {
    const navigate = useNavigate();
    const [showPopover, setShowPopover] = useState(false);

    const typeKey = String(entityType || 'project').toLowerCase();
    const config = ENTITY_CONFIG[typeKey] || ENTITY_CONFIG.project;
    const Icon = config.icon;

    // Resolve target route if not explicitly provided
    let resolvedRoute = route;
    if (!resolvedRoute) {
        if (typeKey === 'project' && entityId) {
            resolvedRoute = `/projects/${entityId}`;
        } else if (typeKey === 'vendor') {
            resolvedRoute = label ? `/vendors?search=${encodeURIComponent(label)}` : '/vendors';
        } else if (typeKey === 'client') {
            resolvedRoute = label ? `/clients?search=${encodeURIComponent(label)}` : '/clients';
        } else if (typeKey === 'resource' || typeKey === 'material') {
            resolvedRoute = '/resources';
        } else if (typeKey === 'drawing') {
            resolvedRoute = entityId ? `/projects/${entityId}?tab=drawings` : '/projects';
        } else {
            resolvedRoute = '/projects';
        }
    }

    const handleTeleport = (e) => {
        e?.stopPropagation();
        if (resolvedRoute) {
            navigate(resolvedRoute);
            try {
                customToast.info(`Teleported to ${label || config.label}`, 'Navigation');
            } catch {
                // Ignore toast if context is not mounted
            }
        }
        setShowPopover(false);
    };

    const handleAskAi = (e) => {
        e?.stopPropagation();
        setShowPopover(false);
        if (onPrompt) {
            const promptText = typeKey === 'project'
                ? `Give me an executive briefing on ${label || `project #${entityId}`}`
                : `Show details for ${label || `${config.label} #${entityId}`}`;
            onPrompt(promptText);
        }
    };

    return (
        <span className="relative inline-block align-middle my-0.5 mx-0.5">
            <button
                type="button"
                onClick={handleTeleport}
                onMouseEnter={() => setShowPopover(true)}
                onMouseLeave={() => setShowPopover(false)}
                className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs transition-all duration-150 ${config.bg} ${config.text} ${config.border} ${config.hover}`}
                title={`Teleport to ${label || config.label}`}
                aria-label={`Teleport to ${config.label}: ${label}`}
            >
                <Icon size={12} className="shrink-0" aria-hidden="true" />
                <span className="font-medium truncate max-w-[170px]">{label}</span>
                <span className={`rounded-full px-1 py-0.2 text-[9px] font-bold ${config.badgeBg}`}>
                    {config.label}
                </span>
                <ArrowUpRight
                    size={12}
                    className="shrink-0 opacity-70 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                    aria-hidden="true"
                />
            </button>

            {/* Quick Action Mini-Popover on Hover/Focus */}
            {showPopover && (
                <div
                    onMouseEnter={() => setShowPopover(true)}
                    onMouseLeave={() => setShowPopover(false)}
                    className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gh-border dark:bg-gh-subtle animate-in fade-in zoom-in-95 duration-150"
                >
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2 dark:border-gh-border">
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.text}`}>
                            <Icon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-bold text-gray-800 dark:text-gray-100">
                                {label}
                            </div>
                            <div className="text-[10px] text-gray-400 capitalize">
                                {config.label} {entityId ? `#${entityId}` : ''}
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 space-y-1">
                        <button
                            type="button"
                            onClick={handleTeleport}
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gh-hover transition-colors"
                        >
                            <span>Teleport to View</span>
                            <ArrowUpRight size={13} className="text-gray-400" />
                        </button>
                        {onPrompt && (
                            <button
                                type="button"
                                onClick={handleAskAi}
                                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors"
                            >
                                <span>Ask AI Briefing</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </span>
    );
}

export default AgentEntityChip;
