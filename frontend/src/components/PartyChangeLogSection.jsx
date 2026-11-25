import React, { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import api from '../services/api';

const ACTION_STYLES = {
    create: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20',
    update: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
    archive: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    restore: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    delete: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    promote: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
};

export default function PartyChangeLogSection({ partyId }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!partyId || String(partyId).startsWith('temp_')) return;
        let active = true;
        setLoading(true);
        api.get(`/parties/${partyId}/changelog`)
            .then((res) => {
                if (active) setLogs(res.data?.logs || []);
            })
            .catch(() => {
                if (active) setLogs([]);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [partyId]);

    if (!loading && logs.length === 0) return null;

    return (
        <div className="pt-3 border-t border-gray-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                    <History size={12} className="text-gray-400" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Audit History
                    </h3>
                </div>
                {!loading && (
                    <span className="text-[10px] text-gray-400 tabular-nums">{logs.length}</span>
                )}
            </div>
            {loading ? (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 py-1.5">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Loading...</span>
                </div>
            ) : (
                <div className="divide-y divide-gray-100 dark:divide-white/5 rounded-md border border-gray-100 dark:border-white/5 bg-gray-50/40 dark:bg-white/[0.01] max-h-44 overflow-y-auto">
                    {logs.map((log) => (
                        <div
                            key={log.id}
                            className="px-2.5 py-1.5 flex items-baseline justify-between gap-2 text-[11px]"
                        >
                            <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide shrink-0 ${ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-300 dark:border-white/10'}`}>
                                    {log.action}
                                </span>
                                <span className="font-medium text-gray-700 dark:text-gray-300 shrink-0">
                                    {log.user_name || 'System'}
                                </span>
                                {log.reason && (
                                    <span className="text-gray-500 dark:text-gray-400 break-words">
                                        — {log.reason}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                                {log.at ? new Date(log.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
