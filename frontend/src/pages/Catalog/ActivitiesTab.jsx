import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Search,
    Plus,
    Download,
    Layers,
    Edit2,
    Trash2,
    Archive,
    RotateCcw,
    GitCompare,
    Eye,
    Calculator,
    RefreshCw,
    Loader2,
    X
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import catalogCache from './catalogCache';
import { showCatalogErrorToast } from './catalogErrors';
import { customToast } from '../../utils/toast';
import ActivityDetailPage from './ActivityDetailPage';
import ImportMasterDialog from './ImportMasterDialog';
import SyncReviewModal from './SyncReviewModal';
import ReasonModal from './ReasonModal';
import CatalogToolbar from './CatalogToolbar';

export default function ActivitiesTab({
    scope = 'master',
    projectId = null,
    projectName = '',
    units = [],
    setExtraBreadcrumbs
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters (performed 100% in frontend memory for instant responsiveness)
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('active'); // 'all' | 'active' | 'archived'

    // Modals & Details
    const [selectedActivity, setSelectedActivity] = useState(null); // for detail view
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [syncItem, setSyncItem] = useState(null); // for sync review modal

    // Reason modals for delete / archive / restore
    const [actionActivity, setActionActivity] = useState(null);
    const [actionType, setActionType] = useState(null); // 'delete' | 'archive' | 'restore'
    const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);

    // Image Preview Lightbox State
    const [previewImage, setPreviewImage] = useState(null); // { url, name, code }

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setPreviewImage(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Load Activities (uses in-memory cache on tab switch; fetches once per scope)
    const loadActivities = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh) {
            const cached = catalogCache.getActivities(scope, projectId);
            if (cached) {
                setActivities(cached);
                setLoading(false);
                return;
            }
        }

        if (activities.length === 0) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const data = await catalogApi.listActivities({
                scope,
                projectId: scope === 'project' ? projectId : undefined
            });
            const list = data || [];
            catalogCache.setActivities(scope, projectId, list);
            setActivities(list);
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to load activities');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [scope, projectId, activities.length]);

    useEffect(() => {
        loadActivities();
    }, [loadActivities]);

    // Handlers for opening and closing activity detail page
    const handleSelectActivity = useCallback((a, extra = {}) => {
        setSelectedActivity({ ...a, ...extra });
        const p = new URLSearchParams(searchParams);
        p.set('act', a.code);
        setSearchParams(p);
    }, [searchParams, setSearchParams]);

    const handleBackFromDetail = useCallback(() => {
        setSelectedActivity(null);
        const p = new URLSearchParams(searchParams);
        p.delete('act');
        setSearchParams(p);
        loadActivities(true);
    }, [searchParams, setSearchParams, loadActivities]);

    // Sync selectedActivity with URL param 'act'
    useEffect(() => {
        const actCode = searchParams.get('act');
        if (actCode && activities.length > 0) {
            const found = activities.find(a => a.code === actCode || String(a.id) === actCode);
            if (found && selectedActivity?.id !== found.id) {
                setSelectedActivity(found);
            }
        } else if (!actCode && selectedActivity && !selectedActivity.isNew) {
            setSelectedActivity(null);
        }
    }, [searchParams, activities, selectedActivity]);

    useEffect(() => {
        if (!selectedActivity && setExtraBreadcrumbs) {
            setExtraBreadcrumbs([]);
        }
    }, [selectedActivity, setExtraBreadcrumbs]);

    // In-memory instant filtering
    const filteredActivities = useMemo(() => {
        return activities.filter((a) => {
            if (statusFilter !== 'all' && a.status !== statusFilter) {
                return false;
            }
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase().trim();
                const matchCode = (a.code || '').toLowerCase().includes(q);
                const matchName = (a.name || '').toLowerCase().includes(q);
                const matchDesc = (a.description || '').toLowerCase().includes(q);
                const matchUnit = (a.output_unit_code || '').toLowerCase().includes(q);
                if (!matchCode && !matchName && !matchDesc && !matchUnit) {
                    return false;
                }
            }
            return true;
        });
    }, [activities, statusFilter, searchTerm]);

    const handleOpenAction = (act, type) => {
        setActionActivity(act);
        setActionType(type);
        setIsReasonModalOpen(true);
    };

    const handleConfirmAction = async (reason) => {
        if (!actionActivity || !actionType) return;
        try {
            if (actionType === 'archive') {
                await catalogApi.archiveActivity(actionActivity.id, reason);
                customToast.success(`Activity ${actionActivity.code} archived`, 'Archived');
            } else if (actionType === 'restore') {
                await catalogApi.restoreActivity(actionActivity.id, reason);
                customToast.success(`Activity ${actionActivity.code} restored to active`, 'Restored');
            } else if (actionType === 'delete') {
                await catalogApi.deleteActivity(actionActivity.id, reason);
                customToast.success(`Activity ${actionActivity.code} deleted permanently`, 'Deleted');
            }
            setIsReasonModalOpen(false);
            setActionActivity(null);
            catalogCache.invalidateActivities(scope, projectId);
            await loadActivities(true);
        } catch (err) {
            showCatalogErrorToast(err, `Failed to ${actionType} activity`);
            throw err;
        }
    };

    // When an activity is selected, enter full-page ActivityDetailPage
    if (selectedActivity) {
        return (
            <>
                <ActivityDetailPage
                    activity={selectedActivity}
                    scope={scope}
                    projectId={projectId}
                    units={units}
                    onBack={handleBackFromDetail}
                    onActivityUpdated={(fresh) => {
                        catalogCache.invalidateActivities(scope, projectId);
                        loadActivities(true);
                        if (fresh?.code) {
                            setSelectedActivity(fresh);
                            const p = new URLSearchParams(searchParams);
                            p.set('act', fresh.code);
                            setSearchParams(p);
                        }
                    }}
                    onActivityCreated={(created) => {
                        catalogCache.invalidateActivities(scope, projectId);
                        loadActivities(true);
                        if (created?.code) {
                            setSelectedActivity(created);
                            const p = new URLSearchParams(searchParams);
                            p.set('act', created.code);
                            setSearchParams(p);
                        }
                    }}
                    onAction={handleOpenAction}
                    onSync={setSyncItem}
                />

                {/* Reason Modal (Archive / Restore / Delete) */}
                <ReasonModal
                    isOpen={isReasonModalOpen}
                    title={`${actionType === 'delete' ? 'Delete' : actionType === 'archive' ? 'Archive' : 'Restore'} Activity`}
                    subtitle={`Target: ${actionActivity?.code} - ${actionActivity?.name}`}
                    confirmText={actionType === 'delete' ? 'Delete Permanently' : actionType === 'archive' ? 'Archive Activity' : 'Restore Activity'}
                    confirmCls={actionType === 'delete' ? 'bg-red-600 hover:bg-red-700 text-white' : actionType === 'archive' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}
                    onClose={() => {
                        setIsReasonModalOpen(false);
                        setActionActivity(null);
                        setActionType(null);
                    }}
                    onConfirm={handleConfirmAction}
                />

                {/* Sync Review Modal */}
                {syncItem && (
                    <SyncReviewModal
                        isOpen={Boolean(syncItem)}
                        entityType="activity"
                        itemId={syncItem.id}
                        itemName={syncItem.name}
                        itemCode={syncItem.code}
                        onClose={() => setSyncItem(null)}
                        onSuccess={() => {
                            catalogCache.invalidateActivities(scope, projectId);
                            loadActivities(true);
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
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 cursor-pointer"
                    >
                        <option value="active">Active Only</option>
                        <option value="archived">Archived Only</option>
                        <option value="all">All Statuses</option>
                    </select>
                )}
                onRefresh={() => {
                    catalogCache.invalidateActivities(scope, projectId);
                    loadActivities(true);
                }}
                refreshing={refreshing}
                totalCount={activities.length}
                filteredCount={filteredActivities.length}
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
                            onClick={() => setSelectedActivity({ isNew: true })}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs cursor-pointer"
                        >
                            <Plus size={14} />
                            New Activity
                        </button>
                    </>
                )}
            />

            {/* Activities Table */}
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-xs overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <Loader2 size={28} className="animate-spin mb-2 text-blue-500" />
                        <span className="text-xs font-medium">Loading catalog activities...</span>
                    </div>
                ) : filteredActivities.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Layers size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {activities.length === 0 ? 'No activities found' : 'No activities match the current filter'}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {scope === 'project'
                                ? 'Import master activities or define project-specific activities.'
                                : 'Create your first construction activity to begin building norms.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50/80 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wider">
                                <tr>
                                    <th className="py-2.5 px-3.5">Code</th>
                                    <th className="py-2.5 px-3.5">Name</th>
                                    <th className="py-2.5 px-3.5">Output Unit</th>
                                    <th className="py-2.5 px-3.5">Status</th>
                                    {scope === 'project' && <th className="py-2.5 px-3.5">Sync Status</th>}
                                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                {filteredActivities.map((a) => {
                                    const isBehind = scope === 'project' && a.parent_id && Number(a.master_version) > Number(a.synced_version || 0);

                                    return (
                                        <tr
                                            key={a.id}
                                            className="hover:bg-gray-50/70 dark:hover:bg-gh-hover/30 transition-colors group"
                                        >
                                            <td className="py-2.5 px-3.5 font-mono font-bold text-gray-900 dark:text-gray-100">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectActivity(a)}
                                                    className="hover:text-blue-600 hover:underline text-left cursor-pointer"
                                                    title="Click to view norms and dynamic cost calculator"
                                                >
                                                    {a.code}
                                                </button>
                                            </td>
                                            <td className="py-2.5 px-3.5 text-gray-800 dark:text-gray-200">
                                                <div className="flex items-center gap-2.5">
                                                    {a.image_url ? (
                                                        <div className="relative w-7 h-7 rounded-lg shrink-0 overflow-hidden border border-gray-200 dark:border-gh-border bg-gray-50 dark:bg-gh-subtle group/img">
                                                            <img
                                                                src={a.image_url}
                                                                alt={a.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setPreviewImage({ url: a.image_url, name: a.name, code: a.code });
                                                                }}
                                                                className="absolute inset-0 bg-black/55 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity cursor-pointer text-white"
                                                                title="View full image"
                                                            >
                                                                <Eye size={13} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/40 text-blue-500">
                                                            <Layers size={14} />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div
                                                            className="font-medium cursor-pointer hover:text-blue-600 transition-colors truncate"
                                                            onClick={() => handleSelectActivity(a)}
                                                            title="Open Activity Details & Recipe"
                                                        >
                                                            {a.name}
                                                        </div>
                                                        {a.description && (
                                                            <div className="text-[11px] text-gray-400 truncate max-w-sm mt-0.5">
                                                                {a.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3.5 font-mono text-gray-700 dark:text-gray-300">
                                                {a.output_unit_code || '—'}
                                            </td>
                                            <td className="py-2.5 px-3.5">
                                                {a.status === 'active' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 uppercase">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 uppercase">
                                                        Archived
                                                    </span>
                                                )}
                                            </td>
                                            {scope === 'project' && (
                                                <td className="py-2.5 px-3.5">
                                                    {a.parent_id ? (
                                                        isBehind ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSyncItem(a)}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-200 transition-colors uppercase tracking-wider cursor-pointer"
                                                                title="Master has been updated. Click to review differences and sync."
                                                            >
                                                                <GitCompare size={12} /> Master Changed
                                                            </button>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                                                In Sync (v{a.synced_version})
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
                                                    onClick={() => handleSelectActivity(a)}
                                                    className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                    title="View Norms & Cost Calculator"
                                                >
                                                    <Calculator size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectActivity(a, { startEditing: true })}
                                                    className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                    title="Edit Activity"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                                {a.status === 'active' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenAction(a, 'archive')}
                                                        className="p-1 rounded text-gray-500 hover:text-amber-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                        title="Archive Activity"
                                                    >
                                                        <Archive size={15} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenAction(a, 'restore')}
                                                        className="p-1 rounded text-gray-500 hover:text-teal-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                        title="Restore Activity"
                                                    >
                                                        <RotateCcw size={15} />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenAction(a, 'delete')}
                                                    className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                    title="Delete Activity (Blocked if in use)"
                                                >
                                                    <Trash2 size={15} />
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

            {/* Import from Master Dialog */}
            <ImportMasterDialog
                isOpen={isImportModalOpen}
                entityType="activity"
                projectId={projectId}
                projectName={projectName}
                existingProjectItems={activities}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    catalogCache.invalidateActivities(scope, projectId);
                    loadActivities(true);
                }}
            />

            {/* Sync Review Modal */}
            {syncItem && (
                <SyncReviewModal
                    isOpen={Boolean(syncItem)}
                    entityType="activity"
                    itemId={syncItem.id}
                    itemName={syncItem.name}
                    itemCode={syncItem.code}
                    onClose={() => setSyncItem(null)}
                    onSuccess={() => {
                        catalogCache.invalidateActivities(scope, projectId);
                        loadActivities(true);
                    }}
                />
            )}

            {/* Reason Modal (Archive / Restore / Delete) */}
            <ReasonModal
                isOpen={isReasonModalOpen}
                title={`${actionType === 'delete' ? 'Delete' : actionType === 'archive' ? 'Archive' : 'Restore'} Activity`}
                subtitle={`Target: ${actionActivity?.code} - ${actionActivity?.name}`}
                confirmText={actionType === 'delete' ? 'Delete Permanently' : actionType === 'archive' ? 'Archive Activity' : 'Restore Activity'}
                confirmCls={actionType === 'delete' ? 'bg-red-600 hover:bg-red-700 text-white' : actionType === 'archive' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}
                onClose={() => {
                    setIsReasonModalOpen(false);
                    setActionActivity(null);
                    setActionType(null);
                }}
                onConfirm={handleConfirmAction}
            />

            {/* Fullscreen Image Lightbox Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setPreviewImage(null)}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                            title="Close (Esc)"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="max-w-4xl max-h-[85vh] flex flex-col items-center justify-center select-none" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={previewImage.url}
                            alt={previewImage.name || 'Activity photo'}
                            className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
                        />
                        <div className="mt-3 text-center">
                            <span className="text-white text-sm font-semibold block">{previewImage.name}</span>
                            <span className="text-white/60 text-xs font-mono">{previewImage.code}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


