import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Download, Check, Loader2, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function ImportPartyFromProjectDialog({
    isOpen,
    partyType = 'client', // 'client' | 'vendor'
    onClose,
    onSuccess
}) {
    const isClient = partyType === 'client';
    const titleLabel = isClient ? 'Clients' : 'Vendors';

    const [loadingProjects, setLoadingProjects] = useState(false);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');

    const [loadingItems, setLoadingItems] = useState(false);
    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());

    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        setLoadingProjects(true);
        setSelectedProjectId('');
        setItems([]);
        setSelectedIds(new Set());
        setResults(null);
        setSearchTerm('');

        api.get('/projects')
            .then((res) => {
                if (!active) return;
                const list = res.data?.projects || res.data || [];
                setProjects(Array.isArray(list) ? list : []);
            })
            .catch((err) => console.error('Failed to load projects:', err))
            .finally(() => {
                if (active) setLoadingProjects(false);
            });

        return () => { active = false; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        setLoadingItems(true);
        setSelectedIds(new Set());

        const params = {
            scope: 'project',
            party_type: partyType,
            limit: 5000
        };
        if (selectedProjectId) params.project_id = selectedProjectId;

        api.get('/parties', { params })
            .then((res) => {
                if (!active) return;
                const list = res.data?.parties || res.data?.clients || res.data?.vendors || [];
                setItems(Array.isArray(list) ? list : []);
            })
            .catch((err) => {
                console.error('Failed to load project-scoped parties:', err);
                if (active) setItems([]);
            })
            .finally(() => {
                if (active) setLoadingItems(false);
            });

        return () => { active = false; };
    }, [isOpen, selectedProjectId, partyType]);

    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return items;
        const term = searchTerm.trim().toLowerCase();
        return items.filter((item) =>
            (item.name || '').toLowerCase().includes(term) ||
            (item.contact_person || '').toLowerCase().includes(term) ||
            (item.category || '').toLowerCase().includes(term) ||
            (item.job_name || '').toLowerCase().includes(term) ||
            (item.project_name || '').toLowerCase().includes(term)
        );
    }, [items, searchTerm]);

    const toggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (filteredItems.length === 0) return;
        const allSelected = filteredItems.every((i) => selectedIds.has(i.id));
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map((i) => i.id)));
        }
    };

    const handleImport = async () => {
        if (selectedIds.size === 0) return;
        setImporting(true);
        const outcome = [];

        for (const id of selectedIds) {
            const item = items.find((i) => i.id === id);
            try {
                await api.patch(`/parties/${id}/promote`);
                outcome.push({ id, name: item?.name || `#${id}`, status: 'promoted' });
            } catch (err) {
                outcome.push({
                    id,
                    name: item?.name || `#${id}`,
                    status: 'error',
                    message: err.response?.data?.message || 'Failed to promote'
                });
            }
        }

        setImporting(false);
        setResults(outcome);
        const okCount = outcome.filter((r) => r.status === 'promoted').length;
        if (okCount > 0) {
            toast.success(`Imported ${okCount} ${isClient ? 'client' : 'vendor'}${okCount > 1 ? 's' : ''} to Master`);
            onSuccess?.();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Download size={16} className="text-blue-600 dark:text-blue-400" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            Import {titleLabel} from Project
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg cursor-pointer">
                        <X size={16} />
                    </button>
                </div>

                {/* Controls */}
                <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center gap-2.5 bg-gray-50/60 dark:bg-white/[0.02]">
                    <div className="flex-1 min-w-[180px]">
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            disabled={loadingProjects || importing}
                            className="w-full px-3 py-1.5 text-xs font-medium bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg text-gray-800 dark:text-gray-200"
                        >
                            <option value="">All Projects</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="relative flex-1 min-w-[180px]">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={`Search project ${titleLabel.toLowerCase()}...`}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg text-gray-800 dark:text-gray-200"
                        />
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {results ? (
                        <div className="space-y-2">
                            {results.map((r) => (
                                <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] text-xs">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{r.name}</span>
                                    {r.status === 'promoted' ? (
                                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                            <CheckCircle2 size={13} /> Imported to Master
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                                            <AlertCircle size={13} /> {r.message}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : loadingItems ? (
                        <div className="py-12 flex items-center justify-center gap-2 text-xs text-gray-400">
                            <Loader2 size={16} className="animate-spin" />
                            <span>Loading project {titleLabel.toLowerCase()}...</span>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="py-12 text-center text-xs text-gray-400">
                            No project-only {titleLabel.toLowerCase()} found to import.
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between px-2 pb-1 text-[11px] text-gray-500">
                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                    {filteredItems.every((i) => selectedIds.has(i.id)) ? 'Deselect All' : `Select All (${filteredItems.length})`}
                                </button>
                                <span>{selectedIds.size} selected</span>
                            </div>
                            {filteredItems.map((item) => {
                                const checked = selectedIds.has(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => toggleSelect(item.id)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition flex items-center justify-between gap-3 cursor-pointer ${
                                            checked
                                                ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-500/10'
                                                : 'border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-white/20'
                                            }`}>
                                                {checked && <Check size={11} className="stroke-[3]" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                    {[item.category, item.job_name, item.contact_person].filter(Boolean).join(' • ') || 'No details'}
                                                </p>
                                            </div>
                                        </div>
                                        {item.project_name && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-[10px] font-semibold text-gray-600 dark:text-gray-300 shrink-0">
                                                <Building2 size={10} />
                                                {item.project_name}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg cursor-pointer"
                    >
                        {results ? 'Close' : 'Cancel'}
                    </button>
                    {!results && (
                        <button
                            type="button"
                            disabled={selectedIds.size === 0 || importing}
                            onClick={handleImport}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                        >
                            {importing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                            <span>Import to Master ({selectedIds.size})</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
