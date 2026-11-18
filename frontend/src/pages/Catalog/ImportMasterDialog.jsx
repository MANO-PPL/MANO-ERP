import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Download, Check, AlertCircle, Loader2, Info, CheckCircle2 } from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import catalogCache from './catalogCache';
import { getCatalogErrorMessage } from './catalogErrors';

export default function ImportMasterDialog({
    isOpen,
    entityType = 'resource', // 'resource' | 'activity'
    projectId,
    projectName = '',
    existingProjectItems = [], // Array of current project items to identify already-imported rows
    onClose,
    onSuccess
}) {
    const [loading, setLoading] = useState(true);
    const [masterItems, setMasterItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [asNewVariant, setAsNewVariant] = useState(false);
    const [variantSuffix, setVariantSuffix] = useState('V2');

    // Progress & Results
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState(null); // Array of { id, code, name, status: 'created'|'existed'|'error', message }

    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        setLoading(true);
        setSelectedIds(new Set());
        setResults(null);
        setSearchTerm('');
        setAsNewVariant(false);

        const fetchMaster = async () => {
            try {
                const cached = entityType === 'resource'
                    ? catalogCache.getResources('master')
                    : catalogCache.getActivities('master');
                if (cached && active) {
                    setMasterItems(cached.filter(i => i.status === 'active'));
                    setLoading(false);
                    return;
                }

                const data = entityType === 'resource'
                    ? await catalogApi.listResources({ scope: 'master', status: 'active' })
                    : await catalogApi.listActivities({ scope: 'master', status: 'active' });

                if (active) {
                    setMasterItems(data || []);
                }
            } catch (err) {
                console.error('Failed to load master items:', err);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchMaster();

        return () => {
            active = false;
        };
    }, [isOpen, entityType]);

    // Map existing project items by parent_id
    const existingParentIds = useMemo(() => {
        const set = new Set();
        (existingProjectItems || []).forEach(item => {
            if (item.parent_id) set.add(Number(item.parent_id));
        });
        return set;
    }, [existingProjectItems]);

    // Filter master items by search
    const filteredMasterItems = useMemo(() => {
        if (!searchTerm.trim()) return masterItems;
        const q = searchTerm.toLowerCase().trim();
        return masterItems.filter(item =>
            item.code?.toLowerCase().includes(q) ||
            item.name?.toLowerCase().includes(q) ||
            item.kind?.toLowerCase().includes(q)
        );
    }, [masterItems, searchTerm]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAllNotImported = () => {
        const notImported = filteredMasterItems
            .filter(item => !existingParentIds.has(Number(item.id)))
            .map(item => item.id);
        setSelectedIds(new Set(notImported));
    };

    const handleClearSelection = () => {
        setSelectedIds(new Set());
    };

    const handleStartImport = async () => {
        if (selectedIds.size === 0 || !projectId) return;

        setImporting(true);
        const importResults = [];

        for (const masterId of selectedIds) {
            const masterItem = masterItems.find(m => m.id === masterId);
            const itemCode = masterItem ? masterItem.code : `#${masterId}`;
            const itemName = masterItem ? masterItem.name : '';

            try {
                const options = {};
                if (asNewVariant) {
                    options.asNewVariant = true;
                    const suffix = variantSuffix.trim() ? `-${variantSuffix.trim()}` : '-VAR';
                    options.code = `${masterItem.code}${suffix}`;
                    options.name = `${masterItem.name} (${variantSuffix.trim() || 'Variant'})`;
                }

                let response;
                if (entityType === 'resource') {
                    response = await catalogApi.importResourceToProject(projectId, masterId, options);
                } else {
                    response = await catalogApi.importActivityToProject(projectId, masterId, options);
                }

                // Check if this was an existing copy returned
                const isExisting = !asNewVariant && existingParentIds.has(Number(masterId));

                importResults.push({
                    id: masterId,
                    code: response?.code || itemCode,
                    name: response?.name || itemName,
                    status: isExisting ? 'existed' : 'created',
                    message: isExisting
                        ? 'Already existed in project (linked copy reused)'
                        : 'Imported successfully'
                });
            } catch (err) {
                const errMsg = getCatalogErrorMessage(err, 'Import failed');
                importResults.push({
                    id: masterId,
                    code: itemCode,
                    name: itemName,
                    status: 'error',
                    message: errMsg
                });
            }
        }

        setResults(importResults);
        setImporting(false);
        if (onSuccess) onSuccess();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-3xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gh-border">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                            <Download size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                Import {entityType === 'resource' ? 'Resources' : 'Activities'} from Master
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Target Project: <span className="font-medium text-gray-700 dark:text-gray-200">{projectName || `#${projectId}`}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={importing}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Activity Import Notification Banner */}
                    {entityType === 'activity' && (
                        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300">
                            <Info size={16} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                            <div>
                                <span className="font-semibold">Automatic Dependency Resolution:</span> Importing a master activity automatically copies its composition norms and imports any required master resources into this project (or links existing project copies).
                            </div>
                        </div>
                    )}

                    {results ? (
                        /* Results View */
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Import Summary ({results.length} item{results.length > 1 ? 's' : ''})
                                </h4>
                                <span className="text-xs text-gray-500">
                                    {results.filter(r => r.status === 'created').length} created &bull; {results.filter(r => r.status === 'existed').length} already existed &bull; {results.filter(r => r.status === 'error').length} failed
                                </span>
                            </div>

                            <div className="border border-gray-200 dark:border-gh-border rounded-lg overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                        <tr>
                                            <th className="py-2.5 px-3">Code</th>
                                            <th className="py-2.5 px-3">Name</th>
                                            <th className="py-2.5 px-3">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                        {results.map((res, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gh-hover/30">
                                                <td className="py-2.5 px-3 font-mono font-medium text-gray-900 dark:text-gray-100">
                                                    {res.code}
                                                </td>
                                                <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
                                                    {res.name}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    {res.status === 'created' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                            <CheckCircle2 size={12} /> Imported
                                                        </span>
                                                    ) : res.status === 'existed' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                                            <Info size={12} /> Already Existed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                                                            <AlertCircle size={12} /> {res.message}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* Selection View */
                        <>
                            {/* Search and Toolbar */}
                            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                                <div className="relative w-full sm:w-72">
                                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder={`Search master ${entityType}s...`}
                                        className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSelectAllNotImported}
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        Select All Unimported
                                    </button>
                                    <span className="text-gray-300 dark:text-gray-600">|</span>
                                    <button
                                        type="button"
                                        onClick={handleClearSelection}
                                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Options: Variant */}
                            <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gh-subtle rounded-lg border border-gray-200 dark:border-gh-border text-xs">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={asNewVariant}
                                        onChange={(e) => setAsNewVariant(e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="font-medium text-gray-700 dark:text-gray-200">
                                        Import as new variant
                                    </span>
                                </label>
                                {asNewVariant && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500 dark:text-gray-400">Variant Suffix:</span>
                                        <input
                                            type="text"
                                            value={variantSuffix}
                                            onChange={(e) => setVariantSuffix(e.target.value)}
                                            placeholder="V2"
                                            className="w-20 px-2 py-1 text-xs border rounded bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 font-mono"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Master Items Table */}
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <Loader2 size={28} className="animate-spin mb-2 text-blue-500" />
                                    <span className="text-sm">Loading master {entityType}s...</span>
                                </div>
                            ) : filteredMasterItems.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm">
                                    No master {entityType}s found matching your search.
                                </div>
                            ) : (
                                <div className="border border-gray-200 dark:border-gh-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="py-2.5 px-3 w-10 text-center">Select</th>
                                                <th className="py-2.5 px-3 w-32">Code</th>
                                                <th className="py-2.5 px-3">Name</th>
                                                <th className="py-2.5 px-3 w-24">Unit</th>
                                                <th className="py-2.5 px-3 w-32">Project Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                            {filteredMasterItems.map((item) => {
                                                const isImported = existingParentIds.has(Number(item.id));
                                                const isChecked = selectedIds.has(item.id);
                                                const unitCode = entityType === 'resource'
                                                    ? item.base_unit_code
                                                    : item.output_unit_code;

                                                return (
                                                    <tr
                                                        key={item.id}
                                                        onClick={() => toggleSelect(item.id)}
                                                        className={`cursor-pointer transition-colors ${isChecked ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gh-hover/40'}`}
                                                    >
                                                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleSelect(item.id)}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono font-medium text-gray-900 dark:text-gray-100">
                                                            {item.code}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
                                                            <div>{item.name}</div>
                                                            {item.description && (
                                                                <div className="text-[11px] text-gray-400 truncate max-w-xs">{item.description}</div>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-400">
                                                            {unitCode || '—'}
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            {isImported ? (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                                    Imported
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400">
                                                                    Not in project
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gh-border bg-gray-50 dark:bg-gh-subtle">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {results ? 'Import complete' : `${selectedIds.size} master item(s) selected`}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={importing}
                            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gh-hover border border-gray-300 dark:border-gh-border rounded-lg hover:bg-gray-100 dark:hover:bg-gh-subtle transition-colors"
                        >
                            {results ? 'Close' : 'Cancel'}
                        </button>
                        {!results && (
                            <button
                                type="button"
                                onClick={handleStartImport}
                                disabled={importing || selectedIds.size === 0}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {importing && <Loader2 size={14} className="animate-spin" />}
                                Import Selected ({selectedIds.size})
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

