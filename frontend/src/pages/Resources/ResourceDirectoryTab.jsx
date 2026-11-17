import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Package,
    Layers,
    Users,
    Plus,
    CopyCheck,
    ChevronDown
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { toast } from 'react-toastify';
import ResourceDetail from './ResourceDetail';
import ResourceForm from './ResourceForm';
import { UNIT_OPTIONS, normalizeUnitCode } from './resourceConstants';
import DuplicateResolverModal from '../../components/DuplicateResolverModal';
import ResourceFilterDropdown from './ResourceFilterDropdown';
import { ExcelGrid } from '../../components/ExcelGrid';
import ResourceCompositionSubGrid from './ResourceCompositionSubGrid';
import { evaluateFormula } from '../../utils/excelFormulaEngine';
import { customToast } from '../../utils/toast';

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

export const ResourceDirectoryTab = ({
    resources = [],
    isLoading = false,
    canWrite = true,
    fetchResources
}) => {
    const [, setSearchParams] = useSearchParams();
    const [expandedRowIds, setExpandedRowIds] = useState(new Set());

    // Active filters
    const [activeTypeFilters, setActiveTypeFilters] = useState([]);
    const [activeUnitFilters, setActiveUnitFilters] = useState([]);

    // Modals & Drawers
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState(null);
    const [viewingResource, setViewingResource] = useState(null);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    const handleToggleExpandRow = useCallback((rowId) => {
        setExpandedRowIds((prev) => {
            const next = new Set(prev);
            const hasIt = next.has(rowId) || next.has(String(rowId)) || (typeof rowId === 'string' && !isNaN(Number(rowId)) && next.has(Number(rowId)));
            if (hasIt) {
                next.delete(rowId);
                next.delete(String(rowId));
                if (typeof rowId === 'string' && !isNaN(Number(rowId))) next.delete(Number(rowId));
            } else {
                next.add(rowId);
            }
            return next;
        });
    }, []);

    const handleNavigateToRecipes = useCallback((resource) => {
        if (!resource?.id) return;
        setSearchParams({ tab: 'recipes', resourceId: String(resource.id) });
    }, [setSearchParams]);

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
        const unitValues = (UNIT_OPTIONS || []).map((u) => ({
            value: u.code || u.value,
            label: `${u.name || u.label || u.code} (${u.code || u.value})`
        }));

        return [
            {
                key: 'code',
                label: 'Code',
                unique: true,
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
                width: '175px',
                minWidth: '165px',
                aliases: COLUMN_ALIASES.type,
                renderCell: (val, row) => {
                    const normType = String(val || '').toLowerCase().trim();
                    const cfg = TYPE_CONFIG[normType] || TYPE_CONFIG.material;
                    const Icon = cfg.icon;
                    const isItem = normType === 'item' || normType === 'items';
                    const compCount = Array.isArray(row?.compositions) ? row.compositions.length : 0;
                    const isExpanded = Boolean(
                        expandedRowIds && (
                            expandedRowIds.has(row?.id) ||
                            expandedRowIds.has(String(row?.id)) ||
                            (typeof row?.id === 'string' && !isNaN(Number(row?.id)) ? expandedRowIds.has(Number(row?.id)) : false)
                        )
                    );

                    return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}
                            >
                                <Icon size={11} />
                                <span>{cfg.label}</span>
                            </span>

                            {isItem && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleExpandRow(row?.id);
                                    }}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer border ${
                                        isExpanded
                                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600/40 shadow-xs'
                                            : 'bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40'
                                    }`}
                                    title={isExpanded ? 'Collapse Recipe Composition' : 'View / Edit Recipe Composition Dropdown'}
                                >
                                    <Layers size={10} className="text-purple-500" />
                                    <span>{compCount > 0 ? `${compCount} items` : 'Recipe'}</span>
                                    <ChevronDown
                                        size={11}
                                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                    />
                                </button>
                            )}
                        </div>
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
                renderCell: (val, row) => {
                    if (val === undefined || val === null || val === '') {
                        return '';
                    }
                    let num = Number(val);
                    if (typeof val === 'string' && val.trim().startsWith('=')) {
                        const evalRes = evaluateFormula(val, row);
                        num = evalRes.success ? Number(evalRes.result) : NaN;
                        if (isNaN(num)) return evalRes.formattedResult;
                    }
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
    }, [expandedRowIds, handleToggleExpandRow]);

    // Unified single-transaction batch save connecting to resourceApi
    const handleSaveGridBatch = async (payload) => {
        const { created = [], updated = [], deleted = [] } = payload;

        // Check for duplicate resource codes before saving
        const existingCodes = new Map();
        (resources || []).forEach(r => {
            if (r.code && String(r.code).trim()) {
                existingCodes.set(String(r.code).trim().toLowerCase(), { id: r.id, name: r.name, code: String(r.code).trim() });
            }
        });

        const createdCodes = new Set();
        for (const item of created) {
            if (item.code && String(item.code).trim()) {
                const norm = String(item.code).trim().toLowerCase();
                if (createdCodes.has(norm)) {
                    const msg = `Resource code already exists: "${String(item.code).trim()}" is duplicated multiple times in new rows. Resource code must be strictly unique. Please change it.`;
                    customToast.error(msg, 'Resource Code Already Exists');
                    throw new Error(msg);
                }
                createdCodes.add(norm);

                if (existingCodes.has(norm)) {
                    const existing = existingCodes.get(norm);
                    const msg = `Resource code already exists: "${String(item.code).trim()}" (${existing.name || 'existing resource'}). Resource code must be strictly unique. Please change it.`;
                    customToast.error(msg, 'Resource Code Already Exists');
                    throw new Error(msg);
                }
            }
        }

        const updatedCodes = new Set();
        for (const item of updated) {
            if (item.code && String(item.code).trim()) {
                const norm = String(item.code).trim().toLowerCase();
                if (createdCodes.has(norm) || updatedCodes.has(norm)) {
                    const msg = `Resource code already exists: "${String(item.code).trim()}" is duplicated in modified rows. Resource code must be strictly unique. Please change it.`;
                    customToast.error(msg, 'Resource Code Already Exists');
                    throw new Error(msg);
                }
                updatedCodes.add(norm);

                if (existingCodes.has(norm)) {
                    const existing = existingCodes.get(norm);
                    if (String(existing.id) !== String(item.id)) {
                        const msg = `Resource code already exists: "${String(item.code).trim()}" (${existing.name || 'another resource'}). Resource code must be strictly unique. Please change it.`;
                        customToast.error(msg, 'Resource Code Already Exists');
                        throw new Error(msg);
                    }
                }
            }
        }

        const resolveNumericRate = (val, row) => {
            if (val === undefined || val === null || val === '') return undefined;
            if (typeof val === 'string' && val.trim().startsWith('=')) {
                const evalRes = evaluateFormula(val, row);
                return evalRes.success && !isNaN(Number(evalRes.result)) ? Number(evalRes.result) : undefined;
            }
            const cleanStr = String(val).replace(/[₹$,\s]/g, '');
            const num = Number(cleanStr);
            return !isNaN(num) ? num : undefined;
        };

        const resolvedCreated = created
            .filter((item) => item.name && String(item.name).trim())
            .map((item) => {
                const cleanType = (item.type || 'material').toString().toLowerCase().trim();
                const finalType = ['material', 'item', 'labour'].includes(cleanType) ? cleanType : 'material';
                const finalUnit = normalizeUnitCode(item.base_unit_code || 'Nos');
                const cleanRate = resolveNumericRate(item.rate, item);
                return {
                    ...item,
                    type: finalType,
                    base_unit_code: finalUnit,
                    rate: cleanRate
                };
            });

        const resolvedUpdated = updated
            .filter((item) => item.id && item.name && String(item.name).trim())
            .map((item) => {
                const updatePayload = { ...item };
                if (item.type) {
                    const cleanType = item.type.toString().toLowerCase().trim();
                    updatePayload.type = ['material', 'item', 'labour'].includes(cleanType) ? cleanType : undefined;
                }
                if (item.base_unit_code) {
                    updatePayload.base_unit_code = normalizeUnitCode(item.base_unit_code);
                }
                if (item.rate !== undefined) {
                    updatePayload.rate = resolveNumericRate(item.rate, item);
                }
                return updatePayload;
            });

        try {
            await resourceApi.batchSaveResources({
                created: resolvedCreated,
                updated: resolvedUpdated,
                deleted: deleted || []
            });
            customToast.success('Resources saved successfully', 'Saved');
            if (fetchResources) await fetchResources();
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to save resources';
            customToast.error(errorMsg, 'Save Failed');
            throw err;
        }
    };

    // View Details Drawer
    const handleViewResourceDetails = async (resource) => {
        if (!resource) return;
        const isTemp = !resource.id || String(resource.id).startsWith('temp_') || isNaN(Number(resource.id));
        if (isTemp) {
            toast.warning('Please save this resource before viewing details.');
            return;
        }
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
                customToast.success(`Resource "${formData.name}" updated successfully`, 'Updated');
            } else {
                await resourceApi.createResource(formData);
                customToast.success(`Resource "${formData.name}" created successfully`, 'Created');
            }
            setIsAddModalOpen(false);
            setEditingResource(null);
            if (fetchResources) fetchResources();
        } catch (err) {
            console.error('Failed to save resource from modal:', err);
            const msg = err.response?.data?.message || err.message || 'Failed to save resource';
            customToast.error(msg, 'Save Failed');
        }
    };

    // Duplicate Resolver Delete
    const handleConfirmDeleteDuplicates = async (idsToDelete) => {
        if (!idsToDelete || idsToDelete.length === 0) return;
        for (const id of idsToDelete) {
            await resourceApi.deleteResource(id);
        }
        if (fetchResources) fetchResources();
    };

    return (
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
                isDuplicateModalOpen={isDuplicateModalOpen}
                setIsDuplicateModalOpen={setIsDuplicateModalOpen}
                emptyMessage="No resources found in database"
                isRowExpandable={(row) => {
                    const t = String(row?.type || '').toLowerCase().trim();
                    return t === 'item' || t === 'items';
                }}
                expandedRowIds={expandedRowIds}
                onToggleExpandRow={handleToggleExpandRow}
                renderExpandedRow={(row, rowIndex, { collapse }) => (
                    <ResourceCompositionSubGrid
                        resource={row}
                        allResources={resources}
                        onCollapse={collapse}
                        onNavigateToRecipes={handleNavigateToRecipes}
                        onRecipeUpdated={fetchResources}
                    />
                )}
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

            {/* ─── Resource Detail Right Drawer ─── */}
            {viewingResource && (
                <ResourceDetail
                    resourceId={viewingResource.id || viewingResource.resource_id}
                    resource={viewingResource}
                    resources={resources}
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
                    existingResources={resources}
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setEditingResource(null);
                    }}
                    onSave={handleSaveResourceFromModal}
                    initialData={editingResource}
                />
            )}
        </div>
    );
};

export default ResourceDirectoryTab;
