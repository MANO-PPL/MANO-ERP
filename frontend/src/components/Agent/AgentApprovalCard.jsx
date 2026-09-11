import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    XCircle,
    CheckSquare,
    FileText,
    AlertTriangle,
    ArrowUpRight,
    ShieldCheck,
    Clock,
    FolderKanban,
    CheckCheck
} from 'lucide-react';
import { AgentEntityChip } from './AgentEntityChip.jsx';

const TYPE_CONFIG = {
    qaqc_observation: {
        label: 'QAQC Observation',
        shortLabel: 'Quality',
        icon: AlertTriangle,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
        iconColor: 'text-amber-600 dark:text-amber-400'
    },
    document_cycle: {
        label: 'Document Cycle',
        shortLabel: 'Document',
        icon: FileText,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
        iconColor: 'text-blue-600 dark:text-blue-400'
    },
    milestone_task: {
        label: 'Milestone Task',
        shortLabel: 'Task',
        icon: CheckSquare,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
        iconColor: 'text-emerald-600 dark:text-emerald-400'
    }
};

export function AgentApprovalCard({ queue, onPrompt, preview = false }) {
    const navigate = useNavigate();
    const [selectedTab, setSelectedTab] = useState('all');
    const [actionStatus, setActionStatus] = useState({});

    const items = Array.isArray(queue?.items) ? queue.items : [];
    const totalPending = queue?.totalPending ?? items.length;
    const byType = queue?.byType ?? {
        qaqc_observation: items.filter(i => i.itemType === 'qaqc_observation').length,
        document_cycle: items.filter(i => i.itemType === 'document_cycle').length,
        milestone_task: items.filter(i => i.itemType === 'milestone_task').length
    };

    const filteredItems = selectedTab === 'all'
        ? items
        : items.filter(item => item.itemType === selectedTab);

    const handleDecide = (item, action) => {
        const actionWord = action === 'approve' ? 'Approve' : 'Reject';
        const typeNoun = item.itemType === 'qaqc_observation'
            ? 'observation'
            : item.itemType === 'document_cycle'
                ? 'cycle'
                : 'task';

        setActionStatus(prev => ({
            ...prev,
            [item.id]: { action, status: 'requested' }
        }));

        if (onPrompt) {
            onPrompt(`${actionWord} ${typeNoun} ${item.id}`);
        }
    };

    const handleBatchApprove = () => {
        if (onPrompt) {
            if (selectedTab === 'all') {
                onPrompt('Approve all pending items');
            } else if (selectedTab === 'qaqc_observation') {
                onPrompt('Approve all pending QAQC observations');
            } else if (selectedTab === 'document_cycle') {
                onPrompt('Approve all pending document cycles');
            } else if (selectedTab === 'milestone_task') {
                onPrompt('Approve all pending tasks');
            }
        }
    };

    const handleTeleport = (route) => {
        if (route) {
            navigate(route);
        }
    };

    return (
        <section
            className="rounded-xl border border-gray-200/90 bg-white p-3.5 text-xs shadow-2xs dark:border-gh-border dark:bg-gh-subtle"
            aria-label="Pending Approvals Queue Card"
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-gh-border">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <ShieldCheck size={16} aria-hidden="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-gray-900 dark:text-gh-text">
                                Pending Approval Queue
                            </h3>
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                {totalPending} Pending
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gh-muted">
                            Multi-entity approvals awaiting administrative sign-off
                        </p>
                    </div>
                </div>

                {totalPending > 0 && (
                    <button
                        type="button"
                        onClick={handleBatchApprove}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
                    >
                        <CheckCheck size={13} aria-hidden="true" />
                        <span>Approve All ({filteredItems.length})</span>
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div className="mt-2.5 flex flex-wrap gap-1 border-b border-gray-100 pb-2 dark:border-gh-border">
                <button
                    type="button"
                    onClick={() => setSelectedTab('all')}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${selectedTab === 'all'
                        ? 'bg-gray-100 text-gray-900 font-semibold dark:bg-gh-hover dark:text-gh-text'
                        : 'text-gray-500 hover:text-gray-900 dark:text-gh-muted dark:hover:text-gh-text'
                    }`}
                >
                    All ({totalPending})
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTab('qaqc_observation')}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${selectedTab === 'qaqc_observation'
                        ? 'bg-amber-50 text-amber-800 font-semibold dark:bg-amber-950/60 dark:text-amber-200'
                        : 'text-gray-500 hover:text-amber-700 dark:text-gh-muted dark:hover:text-amber-300'
                    }`}
                >
                    Quality ({byType.qaqc_observation || 0})
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTab('document_cycle')}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${selectedTab === 'document_cycle'
                        ? 'bg-blue-50 text-blue-800 font-semibold dark:bg-blue-950/60 dark:text-blue-200'
                        : 'text-gray-500 hover:text-blue-700 dark:text-gh-muted dark:hover:text-blue-300'
                    }`}
                >
                    Documents ({byType.document_cycle || 0})
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedTab('milestone_task')}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${selectedTab === 'milestone_task'
                        ? 'bg-emerald-50 text-emerald-800 font-semibold dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'text-gray-500 hover:text-emerald-700 dark:text-gh-muted dark:hover:text-emerald-300'
                    }`}
                >
                    Tasks ({byType.milestone_task || 0})
                </button>
            </div>

            {/* List of Items */}
            {filteredItems.length === 0 ? (
                <div className="py-6 text-center text-gray-500 dark:text-gh-muted">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1.5 opacity-80" aria-hidden="true" />
                    <p className="font-medium text-xs text-gray-700 dark:text-gh-text">No pending approvals</p>
                    <p className="text-[11px] mt-0.5">All items in this category are signed off and up to date.</p>
                </div>
            ) : (
                <div className="mt-2.5 space-y-2">
                    {filteredItems.map(item => {
                        const config = TYPE_CONFIG[item.itemType] || TYPE_CONFIG.document_cycle;
                        const ItemIcon = config.icon;
                        const state = actionStatus[item.id];

                        return (
                            <div
                                key={`${item.itemType}-${item.id}`}
                                className="group relative rounded-lg border border-gray-200/80 bg-gray-50/50 p-2.5 transition-all hover:border-gray-300 dark:border-gh-border/80 dark:bg-gh-subtle/50 dark:hover:border-gh-border"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    {/* Left Details */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                            <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${config.badgeClass}`}>
                                                <ItemIcon size={11} className={config.iconColor} aria-hidden="true" />
                                                {config.shortLabel}
                                            </span>

                                            {item.projectName && (
                                                <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-600 dark:border-gh-border dark:bg-[#161b22] dark:text-gh-muted">
                                                    <FolderKanban size={10} aria-hidden="true" />
                                                    <span className="truncate max-w-[120px]">{item.projectName}</span>
                                                </span>
                                            )}

                                            {item.severity && item.severity !== 'Normal' && (
                                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                                    item.severity === 'Critical' || item.severity === 'High' || item.severity === 'Urgent'
                                                        ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                                        : 'bg-gray-100 text-gray-600 dark:bg-gh-hover dark:text-gh-muted'
                                                }`}>
                                                    {item.severity}
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="font-semibold text-gray-900 dark:text-gh-text text-xs leading-snug">
                                            {item.title}
                                        </h4>

                                        {item.details && (
                                            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gh-muted line-clamp-1">
                                                {item.details}
                                            </p>
                                        )}

                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-gray-400 dark:text-gh-muted">
                                            {item.submittedBy && (
                                                <span>By: <span className="text-gray-600 dark:text-gh-text">{item.submittedBy}</span></span>
                                            )}
                                            {item.submittedAt && (
                                                <span className="flex items-center gap-0.5">
                                                    <Clock size={10} aria-hidden="true" />
                                                    {new Date(item.submittedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                                        {item.route && (
                                            <button
                                                type="button"
                                                onClick={() => handleTeleport(item.route)}
                                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors dark:border-gh-border dark:bg-gh-subtle dark:text-gh-text dark:hover:bg-gh-hover"
                                                title="Teleport to ERP Page"
                                            >
                                                <span>Jump</span>
                                                <ArrowUpRight size={12} aria-hidden="true" />
                                            </button>
                                        )}

                                        {state ? (
                                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
                                                state.action === 'approve'
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                    : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                                            }`}>
                                                {state.action === 'approve' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                {state.action === 'approve' ? 'Approved' : 'Rejected'}
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDecide(item, 'approve')}
                                                    className="inline-flex items-center gap-0.5 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                                                >
                                                    <CheckCircle2 size={12} aria-hidden="true" />
                                                    <span>Approve</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDecide(item, 'reject')}
                                                    className="inline-flex items-center gap-0.5 rounded-md border border-red-300 bg-white px-1.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors dark:border-red-800/80 dark:bg-gh-subtle dark:text-red-400 dark:hover:bg-red-950/30"
                                                >
                                                    <XCircle size={12} aria-hidden="true" />
                                                    <span>Reject</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
export default AgentApprovalCard;
