import React, { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import api from '../services/api';

const ACTION_LABELS = {
    create: 'Created',
    update: 'Updated',
    archive: 'Archived',
    restore: 'Restored',
    delete: 'Deleted',
    promote: 'Promoted',
    contact_add: 'Contact added',
    contact_update: 'Contact updated',
    contact_primary: 'Primary contact set',
    contact_delete: 'Contact removed'
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
            <div className="flex items-center justify-between mb-2">
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
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {logs.map((log) => {
                        const label = ACTION_LABELS[log.action] || String(log.action || 'Event').replace(/_/g, ' ');
                        return (
                            <div
                                key={log.id}
                                className="flex items-baseline justify-between gap-3 py-0.5 text-[11px]"
                            >
                                <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0 translate-y-[-1px]" />
                                    <span className="font-semibold text-gray-800 dark:text-gray-200 shrink-0">
                                        {label}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400 shrink-0">
                                        by <span className="font-medium text-gray-700 dark:text-gray-300">{log.user_name || 'System'}</span>
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
                        );
                    })}
                </div>
            )}
        </div>
    );
}
