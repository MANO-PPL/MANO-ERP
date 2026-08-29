import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Package,
    Layers,
    Users,
    Plus,
    CopyCheck,
    Scale,
    DollarSign
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import ResourceDetail from './ResourceDetail';
import ResourceForm from './ResourceForm';
import ResourceRecipesTab from './ResourceRecipesTab';
import ResourceRatesTab from './ResourceRatesTab';
import ResourceConversionsTab from './ResourceConversionsTab';
import { useAuth } from '../../context/AuthContext';
import { UNIT_OPTIONS } from './resourceConstants';
import DuplicateResolverModal from '../../components/DuplicateResolverModal';
import ResourceFilterDropdown from './ResourceFilterDropdown';
import { ExcelGrid } from '../../components/ExcelGrid';

const TYPE_CONFIG = {
    material: { label: 'Material', icon: Package, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    item: { label: 'Item', icon: Layers, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    labour: { label: 'Labour', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' }
};

const COLUMN_ALIASES = {
    code: ['code', 'item code', 'resource code', 'material code', 'sku', 'product code', 'item no', 'item_code'],
    name: ['resource name', 'name', 'item name', 'material name', 'item description', 'description / name', 'product name', 'title'],
    type: ['type', 'resource type', 'category', 'item type', 'classification'],
    base_unit_code: ['base unit', 'unit', 'uom', 'unit of measure', 'unit code', 'measure', 'base unit code'],
    rate: ['rate', 'standard rate', 'unit rate', 'price', 'unit price', 'cost', 'standard rate (₹)', 'rate (₹)', 'rate (rs)'],
    description: ['description', 'specification', 'spec', 'details', 'item details', 'desc'],
    remarks: ['remarks', 'notes', 'comments', 'remark', 'note']
};

export const ResourceList = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'directory';

    const [resources, setResources] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Active filters
    const [activeTypeFilters, setActiveTypeFilters] = useState([]);
    const [activeUnitFilters, setActiveUnitFilters] = useState([]);

    // Modals & Drawers
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState(null);
    const [viewingResource, setViewingResource] = useState(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // Fetch Resources
    const fetchResources = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await resourceApi.getResources({ limit: 50000 });
            const list = res.resources || res.data || [];
            setResources(list);
        } catch (err) {
            console.error('Failed to load resources:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    // Filtered data by type & unit
    const filteredResources = useMemo(() => {
        const hasTypes = activeTypeFilters.length > 0;
        const hasUnits = activeUnitFilters.length > 0;
        if (!hasTypes && !hasUnits) return resources;

        const typeSet = new Set(activeTypeFilters);
        const unitSet = new Set(activeUnitFilters);

        return resources.filter((r) => {
            if (hasTypes && !typeSet.has(r.type)) return false;
            if (hasUnits && !unitSet.has(r.base_unit_code)) return false;
            return true;
        });
    }, [resources, activeTypeFilters, activeUnitFilters]);

    // Stats calculations
    const stats = useMemo(() => {
        let materials = 0;
        let items = 0;
        let labour = 0;

        resources.forEach((r) => {
            if (r.type === 'material') materials++;
            else if (r.type === 'item') items++;
            else if (r.type === 'labour') labour++;
        });

        return {
            total: resources.length,
            materials,
            items,
            labour
        };
    }, [resources]);

    // Column Definitions for ExcelGrid
    const columns = useMemo(() => {
        const unitValues = (UNIT_OPTIONS || []).map((u) => u.value || u);

        return [
            {
                key: 'code',
                label: 'Code',
                width: '130px',
                minWidth: '120px',
                aliases: COLUMN_ALIASES.code
            },
            {
                key: 'name',
                label: 'Name',
                required: true,
                width: '220px',
                minWidth: '200px',
                aliases: COLUMN_ALIASES.name
            },
            {
                key: 'type',
                label: 'Type',
                type: 'select',
                options: ['material', 'item', 'labour'],
                defaultValue: 'material',
                width: '140px',
                minWidth: '130px',
                aliases: COLUMN_ALIASES.type,
                renderCell: (val) => {
                    const cfg = TYPE_CONFIG[val] || TYPE_CONFIG.material;
                    const Icon = cfg.icon;
                    return (
                        <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}
                        >
                            <Icon size={11} />
                            <span>{cfg.label}</span>
                        </span>
                    );
                }
            },
            {
                key: 'base_unit_code',
                label: 'Base Unit',
                type: 'select',
                options: unitValues,
                defaultValue: 'kg',
                width: '130px',
                minWidth: '120px',
                aliases: COLUMN_ALIASES.base_unit_code
            },
            {
                key: 'rate',
                label: 'Rate (₹)',
                type: 'number',
                align: 'right',
                width: '130px',
                minWidth: '120px',
                aliases: COLUMN_ALIASES.rate,
                renderCell: (val) => {
                    if (val === undefined || val === null || val === '') {
                        return '';
                    }
                    const num = Number(val);
                    return isNaN(num) ? String(val) : `₹${num.toLocaleString('en-IN')}`;
                }
            },
            {
                key: 'description',
                label: 'Description',
                width: '220px',
                minWidth: '200px',
                aliases: COLUMN_ALIASES.description
            },
            {
                key: 'remarks',
                label: 'Remarks',
                width: '200px',
                minWidth: '180px',
                aliases: COLUMN_ALIASES.remarks
            }
        ];
    }, []);

    // Batch Save Handler connecting to resourceApi
    const handleSaveGridBatch = async (payload) => {
        const { created, updated, deleted } = payload;

        if (deleted.length > 0) {
            for (const id of deleted) {
                await resourceApi.deleteResource(id);
            }
        }

        if (created.length > 0) {
            for (const item of created) {
                if (item.name && item.name.trim()) {
                    await resourceApi.createResource(item);
                }
            }
        }

        if (updated.length > 0) {
            for (const item of updated) {
                if (item.id && item.name && item.name.trim()) {
                    await resourceApi.updateResource(item.id, item);
                }
            }
        }

        await fetchResources();
    };

    // View Details Drawer
    const handleViewResourceDetails = async (resource) => {
        try {
            const res = await resourceApi.getResourceById(resource.id);
            setViewingResource(res?.resource || res || resource);
        } catch (err) {
            setViewingResource(resource);
        }
    };

    // Save from Modal
    const handleSaveResourceFromModal = async (formData) => {
        try {
            if (editingResource) {
                await resourceApi.updateResource(editingResource.id, formData);
            } else {
                await resourceApi.createResource(formData);
            }
            setIsAddModalOpen(false);
            setEditingResource(null);
            fetchResources();
        } catch (err) {
            console.error('Failed to save resource from modal:', err);
        }
    };

    // Duplicate Resolver Delete
    const handleConfirmDeleteDuplicates = async (idsToDelete) => {
        if (!idsToDelete || idsToDelete.length === 0) return;
        for (const id of idsToDelete) {
            await resourceApi.deleteResource(id);
        }
        fetchResources();
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117]">
            {/* Top Navigation Tabs Header */}
            <div className="px-4 pt-2.5 pb-0 border-b border-gray-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-white/[0.01]">
                <div className="flex items-center gap-4 text-xs font-bold">
                    {[
                        { id: 'directory', label: 'Directory', icon: Package },
                        { id: 'recipes', label: 'Item Recipes (BOM)', icon: Layers },
                        { id: 'rates', label: 'Rate History', icon: DollarSign },
                        { id: 'conversions', label: 'Unit Conversions', icon: Scale }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setSearchParams({ tab: tab.id })}
                                className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                                    isActive
                                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                            >
                                <Icon size={14} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab 1: Main Directory Grid */}
            {activeTab === 'directory' && (
                <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
                    {/* Top Stats Banner */}
                    <div className="px-3 pt-1.5 pb-1.5 border-b border-gray-200 dark:border-white/5 shrink-0">
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                {
                                    id: 'total',
                                    label: 'Total Resources',
                                    value: stats.total,
                                    color: 'text-gray-900 dark:text-white',
                                    bg: 'bg-gray-50 dark:bg-white/[0.03]'
                                },
                                {
                                    id: 'materials',
                                    label: 'Materials',
                                    value: stats.materials,
                                    color: 'text-amber-600 dark:text-amber-400',
                                    bg: 'bg-amber-50 dark:bg-amber-900/10'
                                },
                                {
                                    id: 'items',
                                    label: 'Items (Assemblies)',
                                    value: stats.items,
                                    color: 'text-purple-600 dark:text-purple-400',
                                    bg: 'bg-purple-50 dark:bg-purple-900/10'
                                },
                                {
                                    id: 'labour',
                                    label: 'Labour',
                                    value: stats.labour,
                                    color: 'text-blue-600 dark:text-blue-400',
                                    bg: 'bg-blue-50 dark:bg-blue-900/10'
                                }
                            ].map((s) => (
                                <div
                                    key={s.id}
                                    className={`${s.bg} rounded-lg p-2 px-3 border border-gray-100 dark:border-white/5`}
                                >
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {s.label}
                                    </p>
                                    <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Centralized ExcelGrid Component */}
                    <ExcelGrid
                        data={filteredResources}
                        columns={columns}
                        primaryKey="id"
                        entityName="Resources"
                        canWrite={canWrite}
                        isLoading={isLoading}
                        onSave={handleSaveGridBatch}
                        onRefresh={fetchResources}
                        onViewRow={handleViewResourceDetails}
                        emptyMessage="No resources found in database"
                        extraFilters={
                            <ResourceFilterDropdown
                                activeTypeFilters={activeTypeFilters}
                                setActiveTypeFilters={setActiveTypeFilters}
                                activeUnitFilters={activeUnitFilters}
                                setActiveUnitFilters={setActiveUnitFilters}
                            />
                        }
                        customActions={
                            <div className="flex items-center gap-1.5">
                                {canWrite && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingResource(null);
                                                setIsAddModalOpen(true);
                                            }}
                                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                        >
                                            <Plus size={13} className="stroke-[3]" />
                                            <span>Add Resource</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsDuplicateModalOpen(true)}
                                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                                            title="Check & Resolve Duplicate Resources"
                                        >
                                            <CopyCheck size={13} className="text-amber-500 stroke-[2.5]" />
                                            <span>Resolve Duplicates</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        }
                    />
                </div>
            )}

            {/* Tab 2: Item Recipes (BOM) */}
            {activeTab === 'recipes' && (
                <div className="flex-1 overflow-auto">
                    <ResourceRecipesTab canWrite={canWrite} />
                </div>
            )}

            {/* Tab 3: Rate History */}
            {activeTab === 'rates' && (
                <div className="flex-1 overflow-auto">
                    <ResourceRatesTab canWrite={canWrite} />
                </div>
            )}

            {/* Tab 4: Unit Conversions */}
            {activeTab === 'conversions' && (
                <div className="flex-1 overflow-auto">
                    <ResourceConversionsTab canWrite={canWrite} />
                </div>
            )}

            {/* ─── Resource Detail Right Drawer ─── */}
            {viewingResource && (
                <ResourceDetail
                    resourceId={viewingResource.id || viewingResource.resource_id}
                    resource={viewingResource}
                    isOpen={Boolean(viewingResource)}
                    onClose={() => setViewingResource(null)}
                    onEdit={(r) => {
                        setEditingResource(r);
                        setIsAddModalOpen(true);
                        setViewingResource(null);
                    }}
                />
            )}

            {/* ─── Add / Edit Resource Modal ─── */}
            {isAddModalOpen && (
                <ResourceForm
                    resource={editingResource}
                    isOpen={isAddModalOpen}
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setEditingResource(null);
                    }}
                    onSave={handleSaveResourceFromModal}
                    initialData={editingResource}
                />
            )}

            {/* ─── Duplicate Resolver Modal ─── */}
            {isDuplicateModalOpen && (
                <DuplicateResolverModal
                    isOpen={isDuplicateModalOpen}
                    onClose={() => setIsDuplicateModalOpen(false)}
                    onConfirm={handleConfirmDeleteDuplicates}
                    items={resources}
                    primaryKey="name"
                    entityName="Resources"
                />
            )}
        </div>
    );
};

export default ResourceList;
