import React, { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronRight, User, Clock, Loader2 } from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import { formatDatePlain } from './catalogFormat';

export default function ChangeLogSection({ entity, entityType, entityId }) {
    const targetEntity = entity || entityType;
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState([]);
    const [expandedIds, setExpandedIds] = useState(new Set());

    useEffect(() => {
        if (!targetEntity || !entityId) return;
        let active = true;
        setLoading(true);

        const fetchLog = async () => {
            try {
                const data = await catalogApi.getChangeLog(targetEntity, entityId);
                if (active) setEntries(data || []);
            } catch (err) {
                console.error('Failed to load change log:', err);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchLog();
        return () => {
            active = false;
        };
    }, [targetEntity, entityId]);

    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const actionBadgeColors = {
        create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        update: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
        correct: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
        archive: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        restore: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
        delete: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
        import: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
        sync_accept: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 size={18} className="animate-spin mr-2" />
                <span className="text-xs">Loading audit change log...</span>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="text-center py-6 text-gray-400 text-xs">
                No change log entries found for this record.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="relative border-l-2 border-gray-200 dark:border-gh-border ml-3 pl-4 space-y-4">
                {entries.map((entry) => {
                    const isExpanded = expandedIds.has(entry.id);
                    const badgeCls = actionBadgeColors[entry.action] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
                    const timestamp = formatDatePlain(entry.at || entry.created_at);

                    return (
                        <div key={entry.id} className="relative group">
                            {/* Marker dot */}
                            <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-white dark:bg-[#161b22] border-2 border-blue-500" />

                            <div className="bg-gray-50 dark:bg-gh-subtle p-3 rounded-lg border border-gray-200 dark:border-gh-border text-xs space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${badgeCls}`}>
                                            {entry.action}
                                        </span>
                                        <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                            <Clock size={12} />
                                            {timestamp}
                                        </span>
                                        {entry.created_by && (
                                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                <User size={12} />
                                                User #{entry.created_by}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(entry.id)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    >
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                </div>

                                {entry.reason && (
                                    <div className="text-gray-700 dark:text-gray-300 italic bg-white dark:bg-[#0d1117] p-2 rounded border border-gray-200 dark:border-gh-border">
                                        <span className="font-medium not-italic text-gray-500 dark:text-gray-400">Reason:</span> "{entry.reason}"
                                    </div>
                                )}

                                {isExpanded && (
                                    <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div>
                                            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] block mb-1">
                                                Before Data
                                            </span>
                                            <pre className="p-2 rounded bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border text-[11px] font-mono text-gray-800 dark:text-gray-200 overflow-x-auto max-h-48">
                                                {entry.before_data ? JSON.stringify(entry.before_data, null, 2) : '(none)'}
                                            </pre>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] block mb-1">
                                                After Data
                                            </span>
                                            <pre className="p-2 rounded bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border text-[11px] font-mono text-gray-800 dark:text-gray-200 overflow-x-auto max-h-48">
                                                {entry.after_data ? JSON.stringify(entry.after_data, null, 2) : '(none)'}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

