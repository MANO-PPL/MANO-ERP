import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Search,
    Plus,
    Download,
    Package,
    HardHat,
    Truck,
    Edit2,
    Trash2,
    Archive,
    RotateCcw,
    GitCompare,
    RefreshCw,
    Loader2
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import catalogCache from './catalogCache';
import { showCatalogErrorToast } from './catalogErrors';
import { formatMoney, getTodayDateStr } from './catalogFormat';
import { customToast } from '../../utils/toast';
import ResourceDrawer from './ResourceDrawer';
import ResourceDetailPage from './ResourceDetailPage';
import ImportMasterDialog from './ImportMasterDialog';
import SyncReviewModal from './SyncReviewModal';
import ReasonModal from './ReasonModal';
import CatalogToolbar from './CatalogToolbar';

export default function ResourcesTab({
    scope = 'master',
    projectId = null,
    projectName = '',
    units = [],
    setExtraBreadcrumbs
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [resources, setResources] = useState([]);
    const [ratesMap, setRatesMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters (performed 100% in frontend memory for instant responsiveness)
    const [searchTerm, setSearchTerm] = useState('');
    const [kindFilter, setKindFilter] = useState('all'); // 'all' | 'material' | 'labour' | 'equipment'
    const [statusFilter, setStatusFilter] = useState('active'); // 'all' | 'active' | 'archived'

    // Drawers & Modals
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingResource, setEditingResource] = useState(null);
    const [selectedResource, setSelectedResource] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [syncItem, setSyncItem] = useState(null);

    // Reason modals for delete / archive / restore
    const [actionResource, setActionResource] = useState(null);
    const [actionType, setActionType] = useState(null);
    const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);

    const todayStr = useMemo(() => getTodayDateStr(), []);

    // Load rates in background chunks without blocking UI
    const loadRatesInBackground = useCallback(async (resList) => {
        const initialMap = {};
        const missing = [];

        for (const r of resList) {
            const cachedRate = catalogCache.getRate(r.id, todayStr);
            if (cachedRate !== undefined) {
                if (cachedRate) initialMap[r.id] = cachedRate;
            } else {
                missing.push(r);
            }
        }

        setRatesMap(prev => ({ ...prev, ...initialMap }));

        if (missing.length === 0) return;

        // Fetch uncached rates in parallel batches of 5 to avoid overwhelming connection pool
        const batchSize = 5;
        for (let i = 0; i < missing.length; i += batchSize) {
            const batch = missing.slice(i, i + batchSize);
            await Promise.all(batch.map(async (r) => {
                try {
                    const rateRes = await catalogApi.getRate(r.id, todayStr);
                    catalogCache.setRate(r.id, todayStr, rateRes || null);
                    if (rateRes) {
                        setRatesMap(prev => ({ ...prev, [r.id]: rateRes }));
                    }
                } catch (_) {
                    catalogCache.setRate(r.id, todayStr, null);
                }
            }));
        }
    }, [todayStr]);

    // Load Resources (uses in-memory cache on tab switch; fetches once per scope)
    const loadResources = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) {
            const cached = catalogCache.getResources(scope, projectId);
            if (cached) {
                setResources(cached);
                setLoading(false);
                loadRatesInBackground(cached);
                return;
            }
        }

        if (forceRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const data = await catalogApi.listResources({
                scope,
                projectId: scope === 'project' ? projectId : undefined
            });

            const list = data || [];
            catalogCache.setResources(scope, projectId, list);
            setResources(list);
            setLoading(false);
            setRefreshing(false);

            // Fetch current rates in background
            loadRatesInBackground(list);
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to load resources');
            setLoading(false);
            setRefreshing(false);
        }
    }, [scope, projectId, loadRatesInBackground]);

    useEffect(() => {
        loadResources();
    }, [loadResources]);

    // Handlers for opening and closing resource detail page
    const handleSelectResource = useCallback((r) => {
        setSelectedResource(r);
        const p = new URLSearchParams(searchParams);
        p.set('res', r.code);
        setSearchParams(p);
    }, [searchParams, setSearchParams]);

    const handleBackFromDetail = useCallback(() => {
        setSelectedResource(null);
        const p = new URLSearchParams(searchParams);
        p.delete('res');
        setSearchParams(p);
        loadResources(true);
    }, [searchParams, setSearchParams, loadResources]);

    // Sync selectedResource with URL param 'res'
    useEffect(() => {
        const resCode = searchParams.get('res');
        if (resCode && resources.length > 0) {
            const found = resources.find(r => r.code === resCode || String(r.id) === resCode);
            if (found && selectedResource?.id !== found.id) {
                setSelectedResource(found);
            }
        } else if (!resCode && selectedResource) {
            setSelectedResource(null);
        }
    }, [searchParams, resources, selectedResource]);

    // Sync top-level project breadcrumbs (if parent provided setExtraBreadcrumbs and not already handled)
    useEffect(() => {
        if (!selectedResource && setExtraBreadcrumbs) {
            setExtraBreadcrumbs([]);
        }
    }, [selectedResource, setExtraBreadcrumbs]);

    // Client-Side In-Memory Filtering (Instant <1ms response)
    const filteredResources = useMemo(() => {
        let list = resources;

        if (kindFilter !== 'all') {
            list = list.filter(r => r.kind === kindFilter);
        }

        if (statusFilter !== 'all') {
            list = list.filter(r => r.status === statusFilter);
        }

        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            list = list.filter(r =>
                r.code?.toLowerCase().includes(q) ||
                r.name?.toLowerCase().includes(q)
            );
        }

        return list;
    }, [resources, kindFilter, statusFilter, searchTerm]);

    const handleRefresh = () => {
        catalogCache.invalidateResources(scope, projectId);
        loadResources(true);
    };

    // Kind Badge Helper
    const renderKindBadge = (kind) => {
        switch (kind) {
            case 'material':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        <Package size={12} /> Material
                    </span>
                );
            case 'labour':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        <HardHat size={12} /> Labour
                    </span>
                );
            case 'equipment':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                        <Truck size={12} /> Equipment
                    </span>
                );
            default:
                return <span className="capitalize">{kind}</span>;
        }
    };

    // Actions
    const handleOpenAction = (resource, type) => {
        setActionResource(resource);
        setActionType(type);
        setIsReasonModalOpen(true);
    };

    const handleConfirmAction = async (reason) => {
        if (!actionResource || !actionType) return;
        try {
            if (actionType === 'archive') {
                await catalogApi.archiveResource(actionResource.id, reason);
                customToast.success(`Resource ${actionResource.code} archived`, 'Archived');
            } else if (actionType === 'restore') {
                await catalogApi.restoreResource(actionResource.id, reason);
                customToast.success(`Resource ${actionResource.code} restored to active`, 'Restored');
            } else if (actionType === 'delete') {
                await catalogApi.deleteResource(actionResource.id, reason);
                customToast.success(`Resource ${actionResource.code} deleted permanently`, 'Deleted');
            }
            setIsReasonModalOpen(false);
            setActionResource(null);
            catalogCache.invalidateResources(scope, projectId);
            await loadResources(true);
        } catch (err) {
            showCatalogErrorToast(err, `Failed to ${actionType} resource`);
            throw err;
        }
    };

    // When a resource is selected, enter full-page ResourceDetailPage
    if (selectedResource) {
        return (
            <>
                <ResourceDetailPage
                    resource={selectedResource}
                    scope={scope}
                    projectId={projectId}
                    units={units}
                    onBack={handleBackFromDetail}
                    onResourceUpdated={() => {
                        catalogCache.invalidateResources(scope, projectId);
                        loadResources(true);
                    }}
                    onAction={handleOpenAction}
                    onSync={setSyncItem}
                />

                {/* Reason Modals for Delete / Archive / Restore */}
                <ReasonModal
                    isOpen={isReasonModalOpen}
                    title={
                        actionType === 'delete'
                            ? `Delete Resource "${actionResource?.name}"`
                            : actionType === 'archive'
                            ? `Archive Resource "${actionResource?.name}"`
                            : `Restore Resource "${actionResource?.name}"`
                    }
                    subtitle={
                        actionType === 'delete'
                            ? 'Permanently deletes this resource if it has no dependent rates or norms. Requires an auditable reason.'
                            : actionType === 'archive'
                            ? 'Hides resource from new activity norms and estimations while preserving historical integrity.'
                            : 'Restores resource to active catalog status.'
                    }
                    confirmText={
                        actionType === 'delete' ? 'Delete Resource' : actionType === 'archive' ? 'Archive Resource' : 'Restore Resource'
                    }
                    confirmCls={actionType === 'delete' ? 'bg-red-600 hover:bg-red-700 text-white' : undefined}
                    onClose={() => {
                        setIsReasonModalOpen(false);
                        setActionResource(null);
                        setActionType(null);
                    }}
                    onConfirm={handleConfirmAction}
                />

                {/* Sync Review Modal */}
                {syncItem && (
                    <SyncReviewModal
                        isOpen={Boolean(syncItem)}
                        entityType="resource"
                        itemId={syncItem.id}
                        itemName={syncItem.name}
                        itemCode={syncItem.code}
                        projectId={projectId}
                        onClose={() => setSyncItem(null)}
                        onSuccess={() => {
                            catalogCache.invalidateResources(scope, projectId);
                            loadResources(true);
                            if (selectedResource && selectedResource.id === syncItem.id) {
                                catalogApi.listResources({ scope, projectId }).then(list => {
                                    const updated = (list || []).find(r => r.id === selectedResource.id);
                                    if (updated) setSelectedResource(updated);
                                }).catch(() => {});
                            }
                        }}
                    />
                )}
            </>
        );
    }

    return (
        <div className="space-y-4">
            {/* Top Toolbar */}
            <CatalogToolbar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Search code, name, description..."
                filters={(
                    <>
                        {/* Kind Filter */}
                        <select
                            value={kindFilter}
                            onChange={(e) => setKindFilter(e.target.value)}
                            className="px-2.5 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 cursor-pointer"
                        >
                            <option value="all">All Kinds</option>
                            <option value="material">Materials</option>
                            <option value="labour">Labour</option>
                            <option value="equipment">Equipment</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-2.5 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 cursor-pointer"
                        >
                            <option value="active">Active Only</option>
                            <option value="archived">Archived Only</option>
                            <option value="all">All Statuses</option>
                        </select>
                    </>
                )}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                totalCount={resources.length}
                filteredCount={filteredResources.length}
                actions={(
                    <>
                        {scope === 'project' && (
                            <button
                                type="button"
                                onClick={() => setIsImportModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gh-hover text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gh-subtle border border-gray-300 dark:border-gh-border transition-colors shadow-xs cursor-pointer"
                            >
                                <Download size={14} className="text-blue-500" />
                                Import from Master
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                setEditingResource(null);
                                setIsDrawerOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs cursor-pointer"
                        >
                            <Plus size={14} />
                            New Resource
                        </button>
                    </>
                )}
            />

            {/* Resources Table */}
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-xs overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <Loader2 size={28} className="animate-spin mb-2 text-blue-500" />
                        <span className="text-xs font-medium">Loading catalog resources...</span>
                    </div>
                ) : filteredResources.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Package size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {resources.length === 0 ? 'No resources defined in this scope' : 'No resources match current filter'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50/80 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3.5">Code</th>
                                    <th className="py-2.5 px-3.5">Name</th>
                                    <th className="py-2.5 px-3.5">Kind</th>
                                    <th className="py-2.5 px-3.5">Base Unit</th>
                                    <th className="py-2.5 px-3.5">Current Rate (Today)</th>
                                    <th className="py-2.5 px-3.5">Status</th>
                                    {scope === 'project' && <th className="py-2.5 px-3.5">Sync Status</th>}
                                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                {filteredResources.map((r) => {
                                    const currentRate = ratesMap[r.id];
                                    const isBehind = scope === 'project' && r.parent_id && Number(r.master_version) > Number(r.synced_version || 0);

                                    return (
                                        <tr
                                            key={r.id}
                                            className="hover:bg-gray-50/70 dark:hover:bg-gh-hover/30 transition-colors group"
                                        >
                                            <td className="py-2.5 px-3.5 font-mono font-bold text-gray-900 dark:text-gray-100">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectResource(r)}
                                                    className="hover:text-blue-600 hover:underline text-left cursor-pointer"
                                                    title="Open Resource Details & Management"
                                                >
                                                    {r.code}
                                                </button>
                                            </td>
                                            <td className="py-2.5 px-3.5 text-gray-800 dark:text-gray-200">
                                                <div className="flex items-center gap-2.5">
                                                    {r.image_url ? (
                                                        <img
                                                            src={r.image_url}
                                                            alt={r.name}
                                                            className="w-7 h-7 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gh-border bg-gray-50 dark:bg-gh-subtle"
                                                        />
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gh-subtle border border-gray-200 dark:border-gh-border text-gray-400">
                                                            {r.kind === 'material' ? <Package size={14} /> : r.kind === 'labour' ? <HardHat size={14} /> : <Truck size={14} />}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div
                                                            className="font-medium cursor-pointer hover:text-blue-600 transition-colors truncate"
                                                            onClick={() => handleSelectResource(r)}
                                                            title="Open Resource Details & Management"
                                                        >
                                                            {r.name}
                                                        </div>
                                                        {r.description && (
                                                            <div className="text-[11px] text-gray-400 truncate max-w-sm">
                                                                {r.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3.5">
                                                {renderKindBadge(r.kind)}
                                            </td>
                                            <td className="py-2.5 px-3.5 font-mono text-gray-700 dark:text-gray-300">
                                                {r.base_unit_code || '—'}
                                            </td>
                                            <td className="py-2.5 px-3.5 font-mono">
                                                {currentRate ? (
                                                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                        ₹ {formatMoney(currentRate.rate)}{' '}
                                                        <span className="text-[11px] font-normal text-gray-500">
                                                            / {currentRate.unit_code}
                                                        </span>
                                                    </div>
                                                ) : currentRate === undefined ? (
                                                    <span className="text-gray-400 italic font-mono text-[11px]">Loading...</span>
                                                ) : (
                                                    <span className="text-gray-400 italic">No active rate</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3.5">
                                                {r.status === 'active' ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 uppercase">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 uppercase">
                                                        Archived
                                                    </span>
                                                )}
                                            </td>
                                            {scope === 'project' && (
                                                <td className="py-2.5 px-3.5">
                                                    {r.parent_id ? (
                                                        isBehind ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSyncItem(r)}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-200 transition-colors uppercase tracking-wider cursor-pointer"
                                                                title="Master has been updated. Click to review differences and sync."
                                                            >
                                                                <GitCompare size={12} /> Master Changed
                                                            </button>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                                                In Sync (v{r.synced_version})
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10">
                                                            Project Local
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="py-2.5 px-3.5 text-right space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectResource(r)}
                                                    className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                    title="Open Details & Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                {r.status === 'active' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenAction(r, 'archive')}
                                                        className="p-1 rounded text-gray-500 hover:text-amber-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors"
                                                        title="Archive Resource"
                                                    >
                                                        <Archive size={14} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenAction(r, 'restore')}
                                                        className="p-1 rounded text-gray-500 hover:text-teal-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors"
                                                        title="Restore Resource"
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenAction(r, 'delete')}
                                                    className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors"
                                                    title="Delete Resource (Blocked if in use)"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Drawer */}
            <ResourceDrawer
                isOpen={isDrawerOpen}
                resource={editingResource}
                scope={scope}
                projectId={projectId}
                units={units}
                onClose={() => {
                    setIsDrawerOpen(false);
                    setEditingResource(null);
                }}
                onSuccess={() => {
                    catalogCache.invalidateResources(scope, projectId);
                    loadResources(true);
                    if (selectedResource && editingResource && selectedResource.id === editingResource.id) {
                        catalogApi.listResources({
                            scope,
                            projectId: scope === 'project' ? projectId : undefined
                        }).then(list => {
                            const updated = (list || []).find(r => r.id === selectedResource.id);
                            if (updated) setSelectedResource(updated);
                        }).catch(() => {});
                    }
                }}
            />

            {/* Import from Master Dialog */}
            <ImportMasterDialog
                isOpen={isImportModalOpen}
                entityType="resource"
                projectId={projectId}
                projectName={projectName}
                existingProjectItems={resources}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    catalogCache.invalidateResources(scope, projectId);
                    loadResources(true);
                }}
            />

            {/* Sync Review Modal */}
            {syncItem && (
                <SyncReviewModal
                    isOpen={Boolean(syncItem)}
                    entityType="resource"
                    itemId={syncItem.id}
                    itemName={syncItem.name}
                    itemCode={syncItem.code}
                    onClose={() => setSyncItem(null)}
                    onSuccess={() => {
                        catalogCache.invalidateResources(scope, projectId);
                        loadResources(true);
                    }}
                />
            )}

            {/* Reason Modal (Archive / Restore / Delete) */}
            <ReasonModal
                isOpen={isReasonModalOpen}
                title={`${actionType === 'delete' ? 'Delete' : actionType === 'archive' ? 'Archive' : 'Restore'} Resource`}
                subtitle={`Target: ${actionResource?.code} - ${actionResource?.name}`}
                confirmText={actionType === 'delete' ? 'Delete Permanently' : actionType === 'archive' ? 'Archive Resource' : 'Restore Resource'}
                confirmCls={actionType === 'delete' ? 'bg-red-600 hover:bg-red-700 text-white' : actionType === 'archive' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}
                onClose={() => {
                    setIsReasonModalOpen(false);
                    setActionResource(null);
                    setActionType(null);
                }}
                onConfirm={handleConfirmAction}
            />
        </div>
    );
}
