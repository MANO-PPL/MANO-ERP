import React, { useState, useEffect, useMemo } from 'react';
import {
    Layers, Plus, Trash2, Save, RefreshCw, AlertCircle, ArrowRight,
    CheckCircle2, Search, Calendar, ChevronDown, WandSparkles, Calculator
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { UNIT_GROUPS, UNIT_REGISTRY } from './resourceConstants';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';

const dateOnly = (val) => (val ? String(val).slice(0, 10) : new Date().toISOString().slice(0, 10));

const ResourceRecipesTab = ({
    initialResourceId,
    resources = [],
    onRefreshResources,
    showToast
}) => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);

    // List of items and available raw component resources
    const itemsList = useMemo(() => resources.filter(r => r.type === 'item'), [resources]);
    const rawComponents = useMemo(() => resources.filter(r => r.type === 'material' || r.type === 'labour'), [resources]);

    const [selectedItemId, setSelectedItemId] = useState(initialResourceId ? String(initialResourceId) : '');
    const [searchItem, setSearchItem] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState(dateOnly());

    // Selected item detail state
    const [selectedItemDetail, setSelectedItemDetail] = useState(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    // Composition recipe rows state
    const [recipeRows, setRecipeRows] = useState([]);
    const [componentRates, setComponentRates] = useState({}); // { resId: { rate, unitCode } }
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Confirmation modal state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'danger',
        isLoading: false,
        onConfirm: () => { }
    });

    // Pre-select item if initialResourceId passed or default to first item
    useEffect(() => {
        if (initialResourceId && itemsList.some(r => String(r.id) === String(initialResourceId))) {
            setSelectedItemId(String(initialResourceId));
        } else if (!selectedItemId && itemsList.length > 0) {
            setSelectedItemId(String(itemsList[0].id));
        }
    }, [initialResourceId, itemsList]);

    // Fetch detail & component rates whenever selected item changes
    const fetchItemRecipe = async () => {
        if (!selectedItemId) return;
        setIsLoadingDetail(true);
        setErrorMsg('');
        try {
            const detailRes = await resourceApi.getResourceById(selectedItemId);
            const itemData = detailRes.resource;
            setSelectedItemDetail(itemData);

            // Populate recipe rows
            if (itemData.compositions && itemData.compositions.length > 0) {
                setRecipeRows(itemData.compositions.map(c => ({
                    component_resource_id: String(c.component_resource_id),
                    quantity: String(c.quantity),
                    unit_code: c.unit_code || 'kg',
                    name: c.component_name || ''
                })));
            } else {
                setRecipeRows([]);
            }

            // Fetch live component rates for raw materials/labour
            const ratePromises = rawComponents.map(async (comp) => {
                try {
                    const rateRes = await resourceApi.getResolvedRate(comp.id, effectiveFrom);
                    return { id: String(comp.id), rate: rateRes.rate?.rate ?? 0, unitCode: rateRes.rate?.unitCode || comp.base_unit_code };
                } catch {
                    return { id: String(comp.id), rate: 0, unitCode: comp.base_unit_code };
                }
            });

            const resolvedRatesList = await Promise.all(ratePromises);
            const ratesMap = {};
            resolvedRatesList.forEach(r => { ratesMap[r.id] = r; });
            setComponentRates(ratesMap);

        } catch (err) {
            console.error('Failed to load item recipe', err);
            setErrorMsg(err.response?.data?.message || 'Failed to load item recipe');
        } finally {
            setIsLoadingDetail(false);
        }
    };

    useEffect(() => {
        if (selectedItemId) {
            fetchItemRecipe();
        }
    }, [selectedItemId, effectiveFrom]);

    // Handle adding a component row
    const handleAddRow = () => {
        const defaultComp = rawComponents[0];
        setRecipeRows(prev => [
            ...prev,
            {
                component_resource_id: defaultComp ? String(defaultComp.id) : '',
                quantity: '1',
                unit_code: defaultComp ? defaultComp.base_unit_code : 'kg',
                name: defaultComp ? defaultComp.name : ''
            }
        ]);
    };

    const handleRowChange = (index, field, value) => {
        setRecipeRows(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            if (field === 'component_resource_id') {
                const comp = rawComponents.find(c => String(c.id) === String(value));
                if (comp) {
                    next[index].unit_code = comp.base_unit_code;
                    next[index].name = comp.name;
                }
            }
            return next;
        });
    };

    const handleRemoveRow = (index) => {
        const rowToTarget = recipeRows[index];
        const compName = rowToTarget?.name || 'ingredient';
        setConfirmModal({
            isOpen: true,
            title: 'Remove Ingredient Row?',
            message: `Are you sure you want to remove "${compName}" from this recipe draft?`,
            confirmText: 'Remove Row',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: () => {
                setRecipeRows(prev => prev.filter((_, i) => i !== index));
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // Calculate real-time estimated recipe cost
    const calculatedRecipeCost = useMemo(() => {
        let total = 0;
        recipeRows.forEach(row => {
            const qty = parseFloat(row.quantity) || 0;
            const rateObj = componentRates[row.component_resource_id];
            const unitRate = rateObj ? rateObj.rate : 0;
            total += qty * unitRate;
        });
        return total;
    }, [recipeRows, componentRates]);

    // Submit Recipe
    const handleSaveRecipe = async (e) => {
        e.preventDefault();
        if (!selectedItemId) return;
        setIsSaving(true);
        setErrorMsg('');

        try {
            const formattedCompositions = recipeRows
                .filter(r => r.component_resource_id && parseFloat(r.quantity) > 0)
                .map(r => ({
                    component_resource_id: parseInt(r.component_resource_id),
                    quantity: parseFloat(r.quantity),
                    unit_code: r.unit_code,
                    effective_from: effectiveFrom
                }));

            await resourceApi.setCompositions(selectedItemId, formattedCompositions, effectiveFrom);
            if (showToast) showToast('success', 'Recipe Saved', 'Item composition saved with effective date.');
            fetchItemRecipe();
            if (onRefreshResources) onRefreshResources();
        } catch (err) {
            console.error('Failed to save recipe', err);
            const msg = err.response?.data?.message || err.message || 'Failed to save composition recipe';
            setErrorMsg(msg);
            if (showToast) showToast('error', 'Save Recipe Failed', msg);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredItems = useMemo(() => {
        if (!searchItem) return itemsList;
        const q = searchItem.toLowerCase();
        return itemsList.filter(i => i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q)));
    }, [itemsList, searchItem]);

    const selectedItem = useMemo(() => itemsList.find(i => String(i.id) === String(selectedItemId)), [itemsList, selectedItemId]);

    return (
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100">
            {/* Left Sidebar: Item Selector */}
            <div className="w-full md:w-80 border-r border-gray-200 dark:border-white/10 flex flex-col bg-gray-50/50 dark:bg-[#161b22]/50 shrink-0">
                <div className="p-4 border-b border-gray-200 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Layers size={18} className="text-purple-600 dark:text-purple-400" />
                            <h3 className="text-sm font-bold">Composite Items</h3>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold">
                            {itemsList.length} Items
                        </span>
                    </div>

                    {/* Search box */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter item recipes..."
                            value={searchItem}
                            onChange={e => setSearchItem(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                        />
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filteredItems.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-400">
                            No composite items found. Create an item resource first.
                        </div>
                    ) : (
                        filteredItems.map(item => {
                            const isSelected = String(item.id) === String(selectedItemId);
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedItemId(String(item.id))}
                                    className={`w-full text-left p-3 rounded-xl transition-all border ${isSelected
                                        ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-500/40 text-purple-900 dark:text-purple-200 shadow-sm'
                                        : 'bg-white dark:bg-[#161b22] border-gray-200/70 dark:border-white/5 hover:border-purple-200 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <p className="text-xs font-bold truncate pr-2">{item.name}</p>
                                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                                            {item.base_unit_code}
                                        </span>
                                    </div>
                                    {item.code && (
                                        <p className="text-[10px] font-mono text-gray-400 mt-1">Code: {item.code}</p>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Panel: Composition Builder Workspace */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117]">
                {!selectedItem ? (
                    <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
                        <div>
                            <Layers size={40} className="mx-auto mb-3 opacity-30 text-purple-500" />
                            <p className="text-sm font-semibold">Select an Item resource to configure its Bill of Materials (BOM) recipe.</p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSaveRecipe} className="flex-1 flex flex-col overflow-hidden">
                        {/* Header Banner */}
                        <div className="p-5 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                        Recipe Assembly
                                    </span>
                                    <h2 className="text-base font-bold">{selectedItem.name}</h2>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Base Unit: <strong className="text-gray-700 dark:text-gray-300">{selectedItem.base_unit_name || selectedItem.base_unit_code} ({selectedItem.base_unit_code})</strong>
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Effective date picker */}
                                <div className="flex items-center gap-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5">
                                    <Calendar size={13} className="text-gray-400" />
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Effective:</span>
                                    <input
                                        type="date"
                                        value={effectiveFrom}
                                        onChange={e => setEffectiveFrom(e.target.value)}
                                        className="bg-transparent text-xs font-semibold text-gray-800 dark:text-gray-200 outline-none"
                                    />
                                </div>

                                {canWrite && (
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                                    >
                                        {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                        <span>Save Recipe Version</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Error banner */}
                        {errorMsg && (
                            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {/* Recipe Table */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
                                    Sub-Components ({recipeRows.length})
                                </h3>
                                {canWrite && (
                                    <button
                                        type="button"
                                        onClick={handleAddRow}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 rounded-lg text-xs font-bold hover:bg-purple-100 transition-all cursor-pointer"
                                    >
                                        <Plus size={13} /> Add Component
                                    </button>
                                )}
                            </div>

                            {isLoadingDetail ? (
                                <div className="py-12 text-center">
                                    <RefreshCw size={24} className="animate-spin text-purple-500 mx-auto mb-2" />
                                    <p className="text-xs text-gray-400">Loading recipe components...</p>
                                </div>
                            ) : recipeRows.length === 0 ? (
                                <div className="p-8 text-center bg-gray-50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
                                    <WandSparkles size={28} className="text-gray-400 mx-auto mb-2" />
                                    <p className="text-xs font-semibold text-gray-500">No components added to recipe yet.</p>
                                    {canWrite && (
                                        <button
                                            type="button"
                                            onClick={handleAddRow}
                                            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors"
                                        >
                                            <Plus size={13} /> Add First Component
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 dark:bg-[#161b22] text-gray-400 uppercase tracking-wider text-[10px] border-b border-gray-200 dark:border-white/10">
                                            <tr>
                                                <th className="px-4 py-3">Component (Material / Labour)</th>
                                                <th className="px-4 py-3 w-32">Quantity</th>
                                                <th className="px-4 py-3 w-36">Recipe Unit</th>
                                                <th className="px-4 py-3 w-32">Unit Rate</th>
                                                <th className="px-4 py-3 w-36 text-right">Extended Cost</th>
                                                {canWrite && <th className="px-4 py-3 w-10"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-[#0d1117]">
                                            {recipeRows.map((row, idx) => {
                                                const compRateObj = componentRates[row.component_resource_id];
                                                const unitRate = compRateObj ? compRateObj.rate : 0;
                                                const qty = parseFloat(row.quantity) || 0;
                                                const extCost = qty * unitRate;

                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                                        <td className="px-4 py-3">
                                                            <select
                                                                value={row.component_resource_id}
                                                                onChange={e => handleRowChange(idx, 'component_resource_id', e.target.value)}
                                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                            >
                                                                {rawComponents.map(c => (
                                                                    <option key={c.id} value={c.id}>
                                                                        {c.name} ({c.type}) — {c.base_unit_code}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                min="0"
                                                                value={row.quantity}
                                                                onChange={e => handleRowChange(idx, 'quantity', e.target.value)}
                                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                value={row.unit_code}
                                                                onChange={e => handleRowChange(idx, 'unit_code', e.target.value)}
                                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                            >
                                                                {Object.entries(UNIT_GROUPS).map(([cat, units]) => (
                                                                    <optgroup key={cat} label={cat.toUpperCase()}>
                                                                        {units.map(u => (
                                                                            <option key={u.code} value={u.code}>{u.symbol} ({u.name})</option>
                                                                        ))}
                                                                    </optgroup>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono font-medium">
                                                            ₹{unitRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {compRateObj?.unitCode || 'unit'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                                                            ₹{extCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        {canWrite && (
                                                            <td className="px-4 py-3 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveRow(idx)}
                                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                                    title="Remove row"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Estimated Unit Rate Footer summary card */}
                            <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                                        <Calculator size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-purple-900 dark:text-purple-300">Live Estimated Unit Rate</p>
                                        <p className="text-[10px] text-purple-700/70 dark:text-purple-400">Sum of sub-component quantities × live component rates</p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-lg font-mono font-black text-purple-900 dark:text-purple-200">
                                        ₹{calculatedRecipeCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {selectedItem.base_unit_code}
                                    </p>
                                    <p className="text-[10px] text-gray-400">Calculated effective as of {effectiveFrom}</p>
                                </div>
                            </div>
                        </div>
                    </form>
                )}
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                variant={confirmModal.variant}
                isLoading={confirmModal.isLoading}
            />
        </div>
    );
};

export default ResourceRecipesTab;
