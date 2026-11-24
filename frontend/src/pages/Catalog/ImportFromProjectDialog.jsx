import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Search,
    Download,
    Check,
    AlertCircle,
    Loader2,
    Info,
    CheckCircle2,
    Package,
    HardHat,
    Truck,
    Building2,
    Layers
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import catalogCache from './catalogCache';
import { getCatalogErrorMessage } from './catalogErrors';

export default function ImportFromProjectDialog({
    isOpen,
    entityType = 'resource', // 'resource' | 'activity'
    existingMasterItems = [], // Array of current master items to identify code conflicts
    onClose,
    onSuccess
}) {
    const isActivity = entityType === 'activity';
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');

    const [loadingItems, setLoadingItems] = useState(false);
    const [projectItems, setProjectItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [kindFilter, setKindFilter] = useState('all');
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Progress & Results
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState(null); // Array of { id, code, name, status: 'created'|'existed'|'error', message }

    // Load available projects when modal opens
    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        setLoadingProjects(true);
        setSelectedProjectId('');
        setProjectItems([]);
        setSelectedIds(new Set());
        setResults(null);
        setSearchTerm('');
        setKindFilter('all');

        const fetchProjects = async () => {
            try {
                const list = await catalogApi.listProjects();
                if (active) {
                    setProjects(Array.isArray(list) ? list : []);
                }
            } catch (err) {
                console.error('Failed to load projects for catalog import:', err);
            } finally {
                if (active) setLoadingProjects(false);
            }
        };

        fetchProjects();

        return () => {
            active = false;
        };
    }, [isOpen, entityType]);

    // Load project items (resources or activities) whenever a project is selected
    useEffect(() => {
        if (!selectedProjectId) {
            setProjectItems([]);
            setSelectedIds(new Set());
            return;
        }

        let active = true;
        setLoadingItems(true);
        setSelectedIds(new Set());
        setResults(null);

        const fetchItems = async () => {
            try {
                const data = isActivity
                    ? await catalogApi.listActivities({
                        projectId: selectedProjectId,
                        scope: 'project',
                        status: 'active'
                    })
                    : await catalogApi.listResources({
                        projectId: selectedProjectId,
                        scope: 'project',
                        status: 'active'
                    });

                if (active) {
                    setProjectItems(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error(`Failed to load ${entityType}s for project #${selectedProjectId}:`, err);
            } finally {
                if (active) setLoadingItems(false);
            }
        };

        fetchItems();

        return () => {
            active = false;
        };
    }, [selectedProjectId, isActivity]);

    // Map existing master codes
    const masterCodeMap = useMemo(() => {
        const set = new Set();
        (existingMasterItems || []).forEach(item => {
            if (item.code) set.add(item.code.toUpperCase());
        });
        return set;
    }, [existingMasterItems]);

    // Filter project items by search and kind (for resources)
    const filteredItems = useMemo(() => {
        return projectItems.filter(item => {
            if (!isActivity && kindFilter !== 'all' && item.kind !== kindFilter) return false;
            if (!searchTerm.trim()) return true;
            const q = searchTerm.toLowerCase().trim();
            return (
                item.code?.toLowerCase().includes(q) ||
                item.name?.toLowerCase().includes(q) ||
                (item.kind && item.kind.toLowerCase().includes(q))
            );
        });
    }, [projectItems, searchTerm, kindFilter, isActivity]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAllAvailable = () => {
        const availableIds = filteredItems
            .filter(item => !item.parent_id && !masterCodeMap.has(item.code?.toUpperCase()))
            .map(item => item.id);
        setSelectedIds(new Set(availableIds));
    };

    const handleClearSelection = () => {
        setSelectedIds(new Set());
    };

    const handleStartImport = async () => {
        if (selectedIds.size === 0) return;

        setImporting(true);
        const importResults = [];

        for (const itemId of selectedIds) {
            const projectItem = projectItems.find(p => p.id === itemId);
            const itemCode = projectItem ? projectItem.code : `#${itemId}`;
            const itemName = projectItem ? projectItem.name : '';

            try {
                let response;
                if (isActivity) {
                    response = await catalogApi.promoteActivityToMaster(itemId, {
                        masterCode: projectItem.code,
                        masterName: projectItem.name,
                        reason: `Imported activity to Master Catalog from project #${selectedProjectId}`
                    });
                } else {
                    response = await catalogApi.promoteResourceToMaster(itemId, {
                        masterCode: projectItem.code,
                        masterName: projectItem.name,
                        includeRates: 'latest',
                        includeConversions: true,
                        reason: `Imported resource to Master Catalog from project #${selectedProjectId}`
                    });
                }

                importResults.push({
                    id: itemId,
                    code: response?.code || itemCode,
                    name: response?.name || itemName,
                    status: 'created',
                    message: `Imported to Master Catalog`
                });
            } catch (err) {
                const errMsg = getCatalogErrorMessage(err, 'Promotion failed');
                importResults.push({
                    id: itemId,
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

    const selectedProjectObj = projects.find(p => String(p.id) === String(selectedProjectId));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-3xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gh-border">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                            <Download size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                Import {isActivity ? 'Activities & Norms' : 'Resources'} from Project to Master
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {isActivity
                                    ? 'Pull project-local activities into Master with composition norms and auto-linked resources'
                                    : 'Pull project-local resources into the Organization Master Catalog with rates & conversions'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={importing}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50 cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Activity Explanatory Banner */}
                    {isActivity && (
                        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-300">
                            <Info size={16} className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                            <div>
                                <span className="font-semibold">Automatic Dependency Resolution:</span> Importing a project activity copies its norms and automatically links or promotes any local project resources used in its composition to Master.
                            </div>
                        </div>
                    )}

                    {/* Project Selector Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-gray-50 dark:bg-gh-subtle/40 border border-gray-200 dark:border-gh-border">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                            <Building2 size={16} className="text-indigo-500 shrink-0" />
                            <span>Source Project:</span>
                        </div>
                        <div className="flex-1 max-w-md">
                            {loadingProjects ? (
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                                    <span>Loading active projects...</span>
                                </div>
                            ) : (
                                <select
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                    disabled={importing}
                                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gh-border bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="">-- Choose a project to pull {isActivity ? 'activities' : 'resources'} from --</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {p.code ? `(${p.code})` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {results ? (
                        /* Results View */
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Import Summary ({results.length} item{results.length > 1 ? 's' : ''})
                                </h4>
                                <span className="text-xs text-gray-500">
                                    {results.filter(r => r.status === 'created').length} imported &bull; {results.filter(r => r.status === 'error').length} failed
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
                                                            <CheckCircle2 size={12} /> Imported to Master
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
                    ) : !selectedProjectId ? (
                        /* Empty State: Select Project */
                        <div className="text-center py-12 text-gray-400">
                            {isActivity ? (
                                <Layers size={36} className="mx-auto mb-2 opacity-30 text-indigo-400" />
                            ) : (
                                <Package size={36} className="mx-auto mb-2 opacity-30 text-indigo-400" />
                            )}
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                Select a project above to browse its local {isActivity ? 'activities' : 'resources'}.
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                                You can selectively import project-created {isActivity ? 'activities and norms' : 'materials, labour, or equipment'} into the organization master catalog.
                            </p>
                        </div>
                    ) : loadingItems ? (
                        /* Loading state */
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Loader2 size={28} className="animate-spin mb-2 text-indigo-500" />
                            <span className="text-xs font-medium">Fetching {isActivity ? 'activities' : 'resources'} from {selectedProjectObj?.name || 'project'}...</span>
                        </div>
                    ) : projectItems.length === 0 ? (
                        /* No items in project */
                        <div className="text-center py-12 text-gray-400">
                            {isActivity ? (
                                <Layers size={32} className="mx-auto mb-2 opacity-30" />
                            ) : (
                                <Package size={32} className="mx-auto mb-2 opacity-30" />
                            )}
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                No active {isActivity ? 'activities' : 'resources'} found in this project.
                            </p>
                        </div>
                    ) : (
                        /* Items List View */
                        <div className="space-y-3">
                            {/* Filter Bar */}
                            <div className="flex flex-col sm:flex-row items-center gap-2.5">
                                <div className="relative flex-1 w-full">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by code or name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                {!isActivity && (
                                    <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
                                        {['all', 'material', 'labour', 'equipment'].map(k => (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => setKindFilter(k)}
                                                className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${
                                                    kindFilter === k
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gh-subtle text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-hover'
                                                }`}
                                            >
                                                {k}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Batch Selection Controls */}
                            <div className="flex items-center justify-between text-xs text-gray-500 py-1">
                                <div>
                                    Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{filteredItems.length}</span> {isActivity ? 'activities' : 'resources'}
                                </div>
                                <div className="space-x-2">
                                    <button
                                        type="button"
                                        onClick={handleSelectAllAvailable}
                                        className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                    >
                                        Select All Available
                                    </button>
                                    <span>&bull;</span>
                                    <button
                                        type="button"
                                        onClick={handleClearSelection}
                                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="border border-gray-200 dark:border-gh-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase sticky top-0 z-10">
                                        <tr>
                                            <th className="w-9 py-2 px-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        filteredItems.length > 0 &&
                                                        filteredItems.every(r => selectedIds.has(r.id) || r.parent_id || masterCodeMap.has(r.code?.toUpperCase()))
                                                    }
                                                    onChange={(e) => {
                                                        if (e.target.checked) handleSelectAllAvailable();
                                                        else handleClearSelection();
                                                    }}
                                                    className="rounded border-gray-300 dark:border-gh-border text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </th>
                                            <th className="py-2 px-3">Code</th>
                                            <th className="py-2 px-3">Name</th>
                                            {!isActivity && <th className="py-2 px-3">Kind</th>}
                                            <th className="py-2 px-3">{isActivity ? 'UOM' : 'Base Unit'}</th>
                                            <th className="py-2 px-3 text-right">Master Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                        {filteredItems.map(item => {
                                            const isSelected = selectedIds.has(item.id);
                                            const isLinkedToMaster = Boolean(item.parent_id);
                                            const isCodeColliding = !isLinkedToMaster && masterCodeMap.has(item.code?.toUpperCase());
                                            const isDisabled = isLinkedToMaster || isCodeColliding;

                                            return (
                                                <tr
                                                    key={item.id}
                                                    onClick={() => !isDisabled && toggleSelect(item.id)}
                                                    className={`transition-colors ${
                                                        isDisabled
                                                            ? 'opacity-50 bg-gray-50 dark:bg-gh-subtle/30 cursor-not-allowed'
                                                            : isSelected
                                                            ? 'bg-indigo-50/60 dark:bg-indigo-950/20 cursor-pointer'
                                                            : 'hover:bg-gray-50 dark:hover:bg-gh-hover/30 cursor-pointer'
                                                    }`}
                                                >
                                                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            disabled={isDisabled}
                                                            onChange={() => toggleSelect(item.id)}
                                                            className="rounded border-gray-300 dark:border-gh-border text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                                                        />
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono font-medium text-gray-900 dark:text-gray-100">
                                                        {item.code}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-200">
                                                        {item.name}
                                                    </td>
                                                    {!isActivity && (
                                                        <td className="py-2.5 px-3">
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium capitalize text-gray-600 dark:text-gray-300">
                                                                {item.kind === 'material' ? (
                                                                    <Package size={12} className="text-blue-500" />
                                                                ) : item.kind === 'labour' ? (
                                                                    <HardHat size={12} className="text-amber-500" />
                                                                ) : (
                                                                    <Truck size={12} className="text-purple-500" />
                                                                )}
                                                                {item.kind}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-300">
                                                        {isActivity ? (item.output_unit_code || '—') : (item.base_unit_code || '—')}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right">
                                                        {isLinkedToMaster ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                                Already in Master
                                                            </span>
                                                        ) : isCodeColliding ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" title="Code already exists in Master Catalog">
                                                                Code Collision
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                                                Project Local
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-gh-subtle/30">
                    <div className="text-xs text-gray-500">
                        {results ? (
                            <span>Import complete. Review results above.</span>
                        ) : selectedIds.size > 0 ? (
                            <span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{selectedIds.size}</span> {isActivity ? 'activit' + (selectedIds.size > 1 ? 'ies' : 'y') : 'resource' + (selectedIds.size > 1 ? 's' : '')} selected for Master import
                            </span>
                        ) : (
                            <span>Select {isActivity ? 'activities' : 'resources'} to import</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {results ? (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-gh-hover text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gh-subtle transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={importing}
                                    className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-hover transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleStartImport}
                                    disabled={selectedIds.size === 0 || importing}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                                >
                                    {importing ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={14} />
                                            Import Selected to Master ({selectedIds.size})
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
