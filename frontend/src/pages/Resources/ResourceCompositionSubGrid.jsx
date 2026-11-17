import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Layers,
    Package,
    Users,
    ArrowRight,
    ExternalLink,
    RefreshCw,
    X,
    Check,
    Calculator,
    AlertCircle,
    Loader2,
    Trash2,
    Plus,
    Save,
    RotateCcw
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';

/**
 * ResourceCompositionSubGrid - Interactive Inline Recipe Editor & Composition Sub-Grid
 * Allows viewing, editing ingredient quantities, adding/removing components, and saving directly inline.
 */
export const ResourceCompositionSubGrid = ({
    resource,
    allResources = [],
    onCollapse = null,
    onNavigateToRecipes = null,
    onRecipeUpdated = null
}) => {
    const [compositions, setCompositions] = useState([]);
    const [initialCompositions, setInitialCompositions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [componentRates, setComponentRates] = useState({});

    // Adding component state
    const [isAddingComponent, setIsAddingComponent] = useState(false);
    const [selectedNewComponentId, setSelectedNewComponentId] = useState('');
    const [newComponentQty, setNewComponentQty] = useState('1');

    // Create quick lookup map for all available resources
    const resourceMap = useMemo(() => {
        const map = {};
        (allResources || []).forEach(r => {
            if (r?.id) map[String(r.id)] = r;
        });
        return map;
    }, [allResources]);

    // Load fresh compositions and rates if needed
    const loadCompositionData = async () => {
        if (!resource?.id) return;
        setIsLoading(true);
        setSaveError(null);
        try {
            let comps = resource.compositions || [];
            if (!comps || comps.length === 0) {
                const res = await resourceApi.getCompositionHistory(resource.id);
                comps = res.compositions || [];
            }

            // Normalise composition objects
            const normalised = comps.map(c => {
                const resMeta = resourceMap[String(c.component_resource_id)] || {};
                const code = c.component_code || c.code || resMeta.code || '';
                const isLabour = (c.component_type || c.type || resMeta.type || '').toLowerCase() === 'labour' ||
                    code.startsWith('LBR');
                return {
                    id: c.id,
                    component_resource_id: c.component_resource_id,
                    component_name: c.component_name || c.name || resMeta.name || `Component #${c.component_resource_id}`,
                    component_code: code,
                    component_type: isLabour ? 'labour' : 'material',
                    quantity: String(c.quantity ?? 1),
                    unit_code: c.unit_code || resMeta.base_unit_code || 'Nos',
                    rate: c.rate ?? resMeta.rate ?? 0
                };
            });

            setCompositions(normalised);
            setInitialCompositions(JSON.parse(JSON.stringify(normalised)));

            // Fetch latest resolved rates for all component IDs
            const compIds = normalised.map(c => c.component_resource_id).filter(Boolean);
            if (compIds.length > 0) {
                const ratesRes = await resourceApi.getResolvedRates(compIds);
                const ratesMap = {};
                (ratesRes.rates || []).forEach(r => {
                    ratesMap[String(r.resourceId)] = r.rate ?? 0;
                });
                setComponentRates(ratesMap);
            }
        } catch (err) {
            console.warn('Failed to load sub-grid compositions:', err);
            setSaveError('Failed to load recipe components.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCompositionData();
    }, [resource?.id]);

    // Check if there are unsaved local modifications
    const hasChanges = useMemo(() => {
        if (compositions.length !== initialCompositions.length) return true;
        for (let i = 0; i < compositions.length; i++) {
            const cur = compositions[i];
            const init = initialCompositions[i];
            if (!init) return true;
            if (String(cur.component_resource_id) !== String(init.component_resource_id)) return true;
            if (String(cur.quantity) !== String(init.quantity)) return true;
            if (cur.unit_code !== init.unit_code) return true;
        }
        return false;
    }, [compositions, initialCompositions]);

    // Financial calculations
    const metrics = useMemo(() => {
        let totalCost = 0;
        let materialCost = 0;
        let labourCost = 0;

        compositions.forEach(comp => {
            const qty = parseFloat(comp.quantity) || 0;
            const resMeta = resourceMap[String(comp.component_resource_id)] || {};
            const rate = componentRates[String(comp.component_resource_id)] ??
                (parseFloat(comp.rate) || parseFloat(resMeta.rate) || 0);
            const ext = qty * rate;
            totalCost += ext;

            const isLabour = comp.component_type === 'labour';
            if (isLabour) {
                labourCost += ext;
            } else {
                materialCost += ext;
            }
        });

        const matPercent = totalCost > 0 ? Math.round((materialCost / totalCost) * 100) : 0;
        const labPercent = totalCost > 0 ? Math.round((labourCost / totalCost) * 100) : 0;

        return {
            totalCost,
            materialCost,
            labourCost,
            matPercent,
            labPercent,
            count: compositions.length
        };
    }, [compositions, componentRates, resourceMap]);

    // Handle Quantity edit
    const handleQuantityChange = (index, newQty) => {
        setCompositions(prev => {
            const next = [...prev];
            next[index] = { ...next[index], quantity: newQty };
            return next;
        });
    };

    // Handle Removing a component
    const handleRemoveComponent = (index) => {
        setCompositions(prev => prev.filter((_, i) => i !== index));
    };

    // Handle Adding a component
    const handleAddComponent = () => {
        if (!selectedNewComponentId) return;
        const targetRes = resourceMap[String(selectedNewComponentId)];
        if (!targetRes) return;

        const isLabour = (targetRes.type || '').toLowerCase() === 'labour' || (targetRes.code || '').startsWith('LBR');
        const newComp = {
            component_resource_id: targetRes.id,
            component_name: targetRes.name,
            component_code: targetRes.code || '',
            component_type: isLabour ? 'labour' : 'material',
            quantity: String(newComponentQty || 1),
            unit_code: targetRes.base_unit_code || 'Nos',
            rate: targetRes.rate || 0
        };

        setCompositions(prev => [...prev, newComp]);
        setSelectedNewComponentId('');
        setNewComponentQty('1');
        setIsAddingComponent(false);
    };

    // Revert local changes
    const handleDiscardChanges = () => {
        setCompositions(JSON.parse(JSON.stringify(initialCompositions)));
        setSaveError(null);
    };

    // Save recipe changes to backend
    const handleSaveRecipe = async () => {
        if (!resource?.id || isSaving) return;
        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            const payload = compositions.map(c => ({
                component_resource_id: Number(c.component_resource_id),
                quantity: parseFloat(c.quantity) || 0,
                unit_code: c.unit_code || 'Nos'
            }));

            await resourceApi.setCompositions(resource.id, payload);
            setInitialCompositions(JSON.parse(JSON.stringify(compositions)));
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);

            if (onRecipeUpdated) {
                onRecipeUpdated();
            }
        } catch (err) {
            console.error('Failed to save recipe compositions:', err);
            setSaveError(err.response?.data?.message || err.message || 'Failed to save recipe');
        } finally {
            setIsSaving(false);
        }
    };

    // Filter available resources for addition
    const existingCompIds = new Set(compositions.map(c => String(c.component_resource_id)));
    const availableComponentResources = useMemo(() => {
        return (allResources || []).filter(r => {
            if (!r?.id) return false;
            if (String(r.id) === String(resource?.id)) return false; // cannot add self
            if (existingCompIds.has(String(r.id))) return false;
            return true;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [allResources, resource?.id, existingCompIds]);

    return (
        <div className="bg-slate-50/95 dark:bg-[#12161f] border-y border-purple-200/70 dark:border-purple-500/25 p-3 sm:p-4 text-xs font-sans transition-all animate-in fade-in duration-150">
            {/* Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                        <Layers size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                                Recipe Composition: {resource.name}
                            </span>
                            {resource.code && (
                                <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/5">
                                    #{resource.code}
                                </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/40">
                                {metrics.count} {metrics.count === 1 ? 'Component' : 'Components'}
                            </span>
                            {hasChanges && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 animate-pulse">
                                    Unsaved Recipe Edits
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Edit ingredient quantities or add components below to update this assembly recipe live.
                        </p>
                    </div>
                </div>

                {/* Right Summary Badges & Actions */}
                <div className="flex items-center gap-2 flex-wrap ml-auto">
                    {/* Material Cost Chip */}
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300">
                        <Package size={12} className="text-amber-600 dark:text-amber-400" />
                        <span>Materials:</span>
                        <span className="font-bold font-mono">₹{metrics.materialCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        <span className="text-[10px] opacity-75">({metrics.matPercent}%)</span>
                    </div>

                    {/* Labour Cost Chip */}
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-blue-800 dark:text-blue-300">
                        <Users size={12} className="text-blue-600 dark:text-blue-400" />
                        <span>Labour:</span>
                        <span className="font-bold font-mono">₹{metrics.labourCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        <span className="text-[10px] opacity-75">({metrics.labPercent}%)</span>
                    </div>

                    {/* Total Calculated Rate */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 text-purple-900 dark:text-purple-200 font-bold font-mono">
                        <span>Total: ₹{metrics.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        <span className="text-[10px] font-sans font-normal text-purple-600 dark:text-purple-400">/{resource.base_unit_code || 'unit'}</span>
                    </div>

                    {/* Action: Save Recipe Changes */}
                    {hasChanges && (
                        <>
                            <button
                                type="button"
                                onClick={handleSaveRecipe}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                title="Save updated recipe to cloud"
                            >
                                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} className="stroke-[2.5]" />}
                                <span>{isSaving ? 'Saving…' : 'Save Recipe'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleDiscardChanges}
                                disabled={isSaving}
                                className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium transition cursor-pointer"
                                title="Discard unsaved edits"
                            >
                                <RotateCcw size={12} />
                                <span>Reset</span>
                            </button>
                        </>
                    )}

                    {saveSuccess && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-md font-bold text-xs animate-in fade-in">
                            <Check size={13} className="stroke-[3]" />
                            <span>Saved!</span>
                        </div>
                    )}

                    {/* Button to jump to Recipes & History tab */}
                    {onNavigateToRecipes && (
                        <button
                            type="button"
                            onClick={() => onNavigateToRecipes(resource)}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
                            title="Edit bill of materials and recipe history"
                        >
                            <span>Open in Recipe Editor</span>
                            <ArrowRight size={12} />
                        </button>
                    )}

                    {onCollapse && (
                        <button
                            type="button"
                            onClick={onCollapse}
                            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded transition cursor-pointer"
                            title="Collapse composition breakdown"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {saveError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0 text-red-500" />
                    <span>{saveError}</span>
                </div>
            )}

            {/* Table of Components */}
            <div className="mt-2.5 overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] shadow-2xs">
                {isLoading ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-gray-400">
                        <Loader2 size={16} className="animate-spin text-purple-600" />
                        <span className="text-xs font-medium">Loading recipe components & live rates…</span>
                    </div>
                ) : compositions.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                        <Layers size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-1.5" />
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            No recipe composition configured for this item yet.
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            Composite items require component materials and labour to calculate rates automatically.
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsAddingComponent(true)}
                            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40 rounded-lg text-xs font-bold hover:bg-purple-100 transition cursor-pointer"
                        >
                            <Plus size={13} className="stroke-[3]" />
                            <span>Add First Component</span>
                        </button>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                <th className="px-3 py-2 w-10 text-center">#</th>
                                <th className="px-3 py-2 w-28">Code</th>
                                <th className="px-3 py-2">Component Name</th>
                                <th className="px-3 py-2 w-24">Type</th>
                                <th className="px-3 py-2 w-36 text-right">Quantity (Editable)</th>
                                <th className="px-3 py-2 w-20">Unit</th>
                                <th className="px-3 py-2 w-28 text-right">Unit Rate (₹)</th>
                                <th className="px-3 py-2 w-32 text-right">Subtotal (₹)</th>
                                <th className="px-3 py-2 w-12 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {compositions.map((comp, idx) => {
                                const isLabour = comp.component_type === 'labour';
                                const qty = parseFloat(comp.quantity) || 0;
                                const resMeta = resourceMap[String(comp.component_resource_id)] || {};
                                const rate = componentRates[String(comp.component_resource_id)] ??
                                    (parseFloat(comp.rate) || parseFloat(resMeta.rate) || 0);
                                const subtotal = qty * rate;

                                return (
                                    <tr
                                        key={comp.id || `comp-${idx}`}
                                        className="hover:bg-purple-50/20 dark:hover:bg-purple-950/10 transition-colors group"
                                    >
                                        <td className="px-3 py-2 text-center text-gray-400 font-mono text-[10px]">
                                            {idx + 1}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                                            {comp.component_code || '—'}
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200">
                                            {comp.component_name || `Component #${comp.component_resource_id}`}
                                        </td>
                                        <td className="px-3 py-2">
                                            {isLabour ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                                    <Users size={10} />
                                                    <span>Labour</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                                                    <Package size={10} />
                                                    <span>Material</span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <div className="inline-flex items-center justify-end">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    value={comp.quantity}
                                                    onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                                    className="w-24 px-2 py-1 bg-gray-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 focus:bg-white dark:focus:bg-[#0d1117] border border-gray-300 dark:border-white/15 focus:border-purple-500 rounded text-right font-mono font-bold text-xs text-gray-900 dark:text-white outline-none transition-all"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-gray-500 dark:text-gray-400">
                                            {comp.unit_code || 'Nos'}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                                            ₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-purple-700 dark:text-purple-300">
                                            ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveComponent(idx)}
                                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition cursor-pointer"
                                                title="Remove component from recipe"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50/90 dark:bg-white/[0.03] border-t border-gray-200 dark:border-white/10 font-bold">
                            <tr>
                                <td colSpan={4} className="px-3 py-2 text-gray-600 dark:text-gray-400 text-right uppercase text-[10px]">
                                    Calculated Cost per {resource.base_unit_code || 'Unit'}:
                                </td>
                                <td colSpan={3} className="px-3 py-2 text-right font-mono text-sm text-purple-700 dark:text-purple-300">
                                    ₹{metrics.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                )}

                {/* Inline Add Component Panel */}
                <div className="p-2.5 bg-gray-50/50 dark:bg-white/[0.01] border-t border-gray-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                    {isAddingComponent ? (
                        <div className="flex flex-wrap items-center gap-2 w-full animate-in fade-in">
                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                Add Ingredient:
                            </span>
                            <select
                                value={selectedNewComponentId}
                                onChange={(e) => setSelectedNewComponentId(e.target.value)}
                                className="flex-1 min-w-[220px] max-w-md px-2.5 py-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/15 rounded-md text-xs font-semibold text-gray-900 dark:text-white outline-none focus:border-purple-500"
                            >
                                <option value="">-- Select Material or Labour Component --</option>
                                {availableComponentResources.map(r => (
                                    <option key={r.id} value={r.id}>
                                        [{r.type?.toUpperCase()}] {r.code ? `${r.code} - ` : ''}{r.name} ({r.base_unit_code || 'unit'})
                                    </option>
                                ))}
                            </select>

                            <div className="flex items-center gap-1">
                                <span className="text-[11px] text-gray-500 font-medium">Qty:</span>
                                <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={newComponentQty}
                                    onChange={(e) => setNewComponentQty(e.target.value)}
                                    placeholder="1"
                                    className="w-20 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/15 rounded-md text-xs font-mono font-bold text-gray-900 dark:text-white text-right outline-none focus:border-purple-500"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleAddComponent}
                                disabled={!selectedNewComponentId}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-md text-xs font-bold transition cursor-pointer shadow-xs"
                            >
                                Add to Recipe
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddingComponent(false);
                                    setSelectedNewComponentId('');
                                }}
                                className="px-2 py-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded text-xs transition cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsAddingComponent(true)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-white/5 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40 rounded-md text-xs font-bold transition cursor-pointer shadow-2xs"
                        >
                            <Plus size={13} className="stroke-[3]" />
                            <span>Add Component Ingredient</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResourceCompositionSubGrid;
