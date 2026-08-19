import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Plus, Trash2, Save, RefreshCw, AlertCircle, ArrowRight,
    Search, Calendar, RotateCcw, Copy, WandSparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { resourceApi } from '../../services/resourceApi';
import { projectApi } from '../../services/projectApi';
import { UNIT_GROUPS, UNIT_REGISTRY } from './resourceConstants';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomSelect from '../../components/CustomSelect';
import LogoLoader from '../../components/LogoLoader';
import { formatOrdinalDate } from '../../utils/dateUtils';

const dateOnly = (val) => (val ? String(val).slice(0, 10) : new Date().toISOString().slice(0, 10));

const ResourceRecipesTab = ({
    initialResourceId,
    resources = [],
    availableComponents = [],
    initialProjectId = '',
    onRefreshResources,
    showToast
}) => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);

    const itemsList = useMemo(() => resources.filter(r => r.type === 'item'), [resources]);
    const rawComponents = useMemo(() => (availableComponents && availableComponents.length > 0 ? availableComponents : resources).filter(r => r.type === 'material' || r.type === 'labour'), [availableComponents, resources]);

    const [selectedItemId, setSelectedItemId] = useState(initialResourceId ? String(initialResourceId) : '');
    const [searchItem, setSearchItem] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState(dateOnly());
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ? String(initialProjectId) : '');
    const [isImporting, setIsImporting] = useState(false);

    const [selectedItemDetail, setSelectedItemDetail] = useState(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    const [recipeRows, setRecipeRows] = useState([]);
    const [compositionHistory, setCompositionHistory] = useState([]);
    const [componentRates, setComponentRates] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const loadRequestRef = useRef(0);

    // In-memory cache for loaded recipes
    const recipeCacheRef = useRef({});

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

    const compositionVersions = useMemo(() => {
        const grouped = new Map();
        compositionHistory.forEach(row => {
            const date = dateOnly(row.effective_from);
            if (!grouped.has(date)) grouped.set(date, []);
            grouped.get(date).push(row);
        });
        
        const sortedEntries = Array.from(grouped.entries()).sort((a, b) => new Date(b[0]) - new Date(a[0]));
        const total = sortedEntries.length;

        return sortedEntries.map(([date, rows], idx) => {
            const effectiveTo = rows.find(row => row.effective_to)?.effective_to
                ? dateOnly(rows.find(row => row.effective_to).effective_to)
                : null;
            const isActive = rows.some(row => Number(row.is_active) === 1);
            
            let versionCost = 0;
            rows.forEach(r => {
                const compRateObj = componentRates[String(r.component_resource_id)];
                const unitRate = compRateObj ? compRateObj.rate : 0;
                const qty = parseFloat(r.quantity) || 0;
                versionCost += qty * unitRate;
            });

            return {
                versionNumber: total - idx,
                date,
                rows,
                effectiveTo,
                isActive,
                isLatest: idx === 0,
                versionCost
            };
        });
    }, [compositionHistory, componentRates]);

    const latestCompositionDate = compositionVersions[0]?.date || null;
    const projectItemImported = !selectedProjectId || compositionHistory.length > 0;

    const rowsEffectiveOn = (history, date) => {
        const eligibleDates = [...new Set(history
            .map(row => dateOnly(row.effective_from))
            .filter(versionDate => versionDate <= date))].sort().reverse();
        const activeDate = eligibleDates[0];
        return activeDate ? history.filter(row => dateOnly(row.effective_from) === activeDate) : [];
    };

    useEffect(() => {
        projectApi.listProjects()
            .then(result => setProjects(result.projects || []))
            .catch(err => console.warn('Failed to load projects for recipe scope', err));
    }, []);

    useEffect(() => {
        if (initialProjectId) {
            setSelectedProjectId(String(initialProjectId));
        }
    }, [initialProjectId]);

    const scopeOptions = useMemo(() => {
        if (initialProjectId) {
            const currentProj = projects.find(p => String(p.id) === String(initialProjectId));
            return [
                { label: currentProj ? `${currentProj.name} (Current Project)` : 'Current Project', value: String(initialProjectId) },
                { label: 'Master / Organization', value: '' }
            ];
        }
        return [
            { label: 'Master / Organization', value: '' },
            ...projects.map(project => ({ label: project.name, value: String(project.id) }))
        ];
    }, [projects, initialProjectId]);

    const componentOptions = useMemo(() => rawComponents.map(c => ({
        label: `${c.name} (${c.type.toUpperCase()}) — ${c.base_unit_code}`,
        value: String(c.id)
    })), [rawComponents]);

    const unitOptions = useMemo(() => {
        const list = [];
        Object.entries(UNIT_GROUPS).forEach(([cat, units]) => {
            units.forEach(u => {
                list.push({ label: `${u.symbol} (${u.name}) — ${cat.toUpperCase()}`, value: u.code });
            });
        });
        return list;
    }, []);

    useEffect(() => {
        if (initialResourceId && itemsList.some(r => String(r.id) === String(initialResourceId))) {
            setSelectedItemId(String(initialResourceId));
        } else if (!selectedItemId && itemsList.length > 0) {
            setSelectedItemId(String(itemsList[0].id));
        }
    }, [initialResourceId, itemsList]);

    const getCompositionHistory = () => selectedProjectId
        ? projectApi.getProjectCompositionHistory(selectedProjectId, selectedItemId)
        : resourceApi.getCompositionHistory(selectedItemId);

    const getComponentRates = () => {
        const componentIds = rawComponents.map(component => component.id);
        return selectedProjectId
            ? projectApi.getResolvedResourceRates(selectedProjectId, componentIds, effectiveFrom)
            : resourceApi.getResolvedRates(componentIds, effectiveFrom);
    };

    const fetchItemRecipe = async (force = false) => {
        if (!selectedItemId) return;
        const cacheKey = `${selectedItemId}_${selectedProjectId || 'master'}_${effectiveFrom}`;
        if (!force && recipeCacheRef.current[cacheKey]) {
            const cached = recipeCacheRef.current[cacheKey];
            setSelectedItemDetail(cached.itemData);
            setCompositionHistory(cached.history);
            setRecipeRows(cached.rows);
            setComponentRates(cached.ratesMap);
            return;
        }

        const requestId = ++loadRequestRef.current;
        setIsLoadingDetail(true);
        setErrorMsg('');
        try {
            const [detailRes, historyResult, ratesResult] = await Promise.all([
                resourceApi.getResourceById(selectedItemId, effectiveFrom),
                getCompositionHistory(),
                getComponentRates()
            ]);

            if (requestId !== loadRequestRef.current) return;

            const itemData = detailRes.resource;
            const history = historyResult.compositions || [];
            setSelectedItemDetail(itemData);
            setCompositionHistory(history);

            const compositionsForDate = selectedProjectId
                ? rowsEffectiveOn(history, effectiveFrom)
                : (itemData.compositions || rowsEffectiveOn(history, effectiveFrom));

            const rowsToSet = compositionsForDate.length > 0 ? compositionsForDate.map(c => ({
                component_resource_id: String(c.component_resource_id),
                quantity: String(c.quantity),
                unit_code: c.unit_code || 'kg',
                name: c.component_name || ''
            })) : [];

            setRecipeRows(rowsToSet);

            const resolvedRates = ratesResult.rates || [];
            const ratesById = new Map(resolvedRates.map(rate => [String(rate.resourceId), rate]));
            const ratesMap = Object.fromEntries(rawComponents.map(component => {
                const rate = ratesById.get(String(component.id));
                return [String(component.id), {
                    rate: rate?.rate ?? 0,
                    unitCode: rate?.unitCode || component.base_unit_code
                }];
            }));
            setComponentRates(ratesMap);

            recipeCacheRef.current[cacheKey] = {
                itemData,
                history,
                rows: rowsToSet,
                ratesMap
            };

        } catch (err) {
            if (requestId === loadRequestRef.current) {
                console.error('Failed to load item recipe', err);
                setErrorMsg(err.response?.data?.message || 'Failed to load item recipe');
            }
        } finally {
            if (requestId === loadRequestRef.current) setIsLoadingDetail(false);
        }
    };

    useEffect(() => {
        if (selectedItemId) {
            fetchItemRecipe();
        }
    }, [selectedItemId, effectiveFrom, selectedProjectId, rawComponents]);

    const handleImportItem = async () => {
        if (!selectedProjectId || !selectedItemId) return;
        setIsImporting(true);
        setErrorMsg('');
        try {
            await projectApi.importResource(selectedProjectId, selectedItemId, effectiveFrom);
            recipeCacheRef.current = {};
            await fetchItemRecipe(true);
            if (showToast) showToast('success', 'Item Imported', 'Master composition copied into the project.');
            if (onRefreshResources) onRefreshResources();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to import item into project';
            setErrorMsg(msg);
            if (showToast) showToast('error', 'Import Failed', msg);
        } finally {
            setIsImporting(false);
        }
    };

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

    const handleDuplicateRow = (index) => {
        const rowToDup = recipeRows[index];
        if (!rowToDup) return;
        setRecipeRows(prev => [
            ...prev.slice(0, index + 1),
            { ...rowToDup },
            ...prev.slice(index + 1)
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

    const handleLoadVersionIntoEditor = (versionRows, versionDate) => {
        if (!versionRows || versionRows.length === 0) return;
        setRecipeRows(versionRows.map(r => ({
            component_resource_id: String(r.component_resource_id),
            quantity: String(r.quantity),
            unit_code: r.unit_code || 'kg',
            name: r.component_name || ''
        })));
        if (showToast) {
            showToast('info', 'Version Loaded', `Loaded composition from ${versionDate} into the draft editor.`);
        }
    };

    const recipeMetrics = useMemo(() => {
        let total = 0;
        let materialCost = 0;
        let labourCost = 0;

        recipeRows.forEach(row => {
            const qty = parseFloat(row.quantity) || 0;
            const rateObj = componentRates[row.component_resource_id];
            const unitRate = rateObj ? rateObj.rate : 0;
            const ext = qty * unitRate;

            total += ext;
            const comp = rawComponents.find(c => String(c.id) === String(row.component_resource_id));
            if (comp?.type === 'labour') {
                labourCost += ext;
            } else {
                materialCost += ext;
            }
        });

        return { total, materialCost, labourCost };
    }, [recipeRows, componentRates, rawComponents]);

    const handleSaveRecipe = async (e) => {
        e.preventDefault();
        if (!selectedItemId) return;

        if (!effectiveFrom) {
            setErrorMsg('Choose an effective-from date before saving the recipe.');
            return;
        }
        if (selectedProjectId && !projectItemImported) {
            setErrorMsg('Import this item into the selected project before saving a project composition.');
            return;
        }
        if (latestCompositionDate && effectiveFrom <= latestCompositionDate) {
            setErrorMsg(`This recipe already has a version effective ${latestCompositionDate}. Choose a later date for the new version.`);
            return;
        }

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

            if (selectedProjectId) {
                await projectApi.setProjectCompositions(selectedProjectId, selectedItemId, formattedCompositions, effectiveFrom);
            } else {
                await resourceApi.setCompositions(selectedItemId, formattedCompositions, effectiveFrom);
            }
            recipeCacheRef.current = {};
            if (showToast) showToast('success', 'Recipe Saved', 'Item composition saved with effective date.');
            await fetchItemRecipe(true);
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
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 font-sans">
            {/* Left Sidebar: Composite Item Selector */}
            <div className="w-full md:w-72 border-r border-gray-200 dark:border-white/10 flex flex-col bg-gray-50/50 dark:bg-[#161b22]/50 shrink-0">
                {/* Header aligned to exactly h-[88px] */}
                <div className="h-[88px] px-4 py-3 border-b border-gray-200 dark:border-white/10 flex flex-col justify-center space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Composite Items
                        </h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            {itemsList.length} Items
                        </span>
                    </div>

                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter recipes..."
                            value={searchItem}
                            onChange={e => setSearchItem(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none placeholder:text-gray-400 text-gray-900 dark:text-gray-100"
                        />
                        {searchItem && (
                            <button
                                onClick={() => setSearchItem('')}
                                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filteredItems.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-400">
                            No composite items found.
                        </div>
                    ) : (
                        filteredItems.map(item => {
                            const isSelected = String(item.id) === String(selectedItemId);
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedItemId(String(item.id))}
                                    className={`w-full text-left px-3 py-2 rounded-lg transition-all border ${isSelected
                                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-500/40 text-purple-900 dark:text-purple-200 font-semibold shadow-xs'
                                        : 'bg-transparent border-transparent hover:bg-gray-100/70 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs truncate pr-2">{item.name}</p>
                                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 shrink-0">
                                            {item.base_unit_code}
                                        </span>
                                    </div>
                                    {item.code && (
                                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">#{item.code}</p>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Workspace: Recipe Builder & Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117]">
                {!selectedItem ? (
                    <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
                        <p className="text-xs font-medium">Select a composite item resource to configure its recipe composition.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSaveRecipe} className="flex-1 flex flex-col overflow-hidden">
                        {/* Header aligned to exactly h-[88px] */}
                        <div className="h-[88px] px-5 py-3 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/40 flex items-center justify-between gap-4 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                        Recipe Specification & BOM
                                    </span>
                                    {selectedItem.code && (
                                        <span className="text-[10px] font-mono text-gray-400">
                                            Code: {selectedItem.code}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                                    {selectedItem.name}
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Base Output Unit: <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedItem.base_unit_name || selectedItem.base_unit_code} ({selectedItem.base_unit_code})</span>
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Scope:</span>
                                    <div className="w-48">
                                        <CustomSelect
                                            value={selectedProjectId}
                                            onChange={e => setSelectedProjectId(e.target.value)}
                                            options={scopeOptions}
                                            placeholder="Master / Organization"
                                        />
                                    </div>
                                </div>

                                {/* Effective date picker */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Effective:</span>
                                    <div className="w-44">
                                        <CustomDatePicker
                                            value={effectiveFrom}
                                            disabled={!canWrite}
                                            onChange={e => setEffectiveFrom(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {canWrite && selectedProjectId && !projectItemImported ? (
                                    <button
                                        type="button"
                                        onClick={handleImportItem}
                                        disabled={isImporting}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                                    >
                                        {isImporting ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                                        <span>Import Master Composition</span>
                                    </button>
                                ) : canWrite && (
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                                    >
                                        {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                        <span>{selectedProjectId ? 'Save Project Version' : 'Save Recipe Version'}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Error banner */}
                        {errorMsg && (
                            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center justify-between gap-2 text-xs text-red-600 dark:text-red-400">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={15} className="shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                                <button type="button" onClick={() => setErrorMsg('')} className="text-xs font-bold hover:underline">Dismiss</button>
                            </div>
                        )}

                        {selectedProjectId && !projectItemImported && (
                            <div className="mx-6 mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                                <p className="font-bold">This item is not imported into the selected project.</p>
                                <p className="mt-1">Import the current master composition once. After that, project versions are independent from master changes.</p>
                            </div>
                        )}

                        {/* Recipe Table */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
                                    Sub-Components ({recipeRows.length})
                                </h3>
                                {canWrite && projectItemImported && (
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
                                    {canWrite && projectItemImported && (
                                        <button
                                            type="button"
                                            onClick={handleAddRow}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors mt-3"
                                        >
                                            <Plus size={13} /> Add Component
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-[#0d1117]">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-50 dark:bg-[#161b22] text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px] border-b border-gray-200 dark:border-white/10 font-bold">
                                                <tr>
                                                    <th className="px-4 py-2.5">Component (Material / Labour)</th>
                                                    <th className="px-4 py-2.5 w-32">Quantity</th>
                                                    <th className="px-4 py-2.5 w-36">Recipe Unit</th>
                                                    <th className="px-4 py-2.5 w-36">Unit Rate</th>
                                                    <th className="px-4 py-2.5 w-36 text-right">Extended Cost</th>
                                                    {canWrite && <th className="px-4 py-2.5 w-16 text-center">Actions</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                {recipeRows.map((row, idx) => {
                                                    const compRateObj = componentRates[row.component_resource_id];
                                                    const unitRate = compRateObj ? compRateObj.rate : 0;
                                                    const qty = parseFloat(row.quantity) || 0;
                                                    const extCost = qty * unitRate;
                                                     return (
                                                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                                            <td className="px-4 py-2 min-w-[220px]">
                                                                <CustomSelect
                                                                    value={row.component_resource_id}
                                                                    onChange={e => handleRowChange(idx, 'component_resource_id', e.target.value)}
                                                                    options={componentOptions}
                                                                    placeholder="Select component"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    value={row.quantity}
                                                                    onChange={e => handleRowChange(idx, 'quantity', e.target.value)}
                                                                    className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 text-gray-900 dark:text-gray-100"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2 min-w-[140px]">
                                                                <CustomSelect
                                                                    value={row.unit_code}
                                                                    onChange={e => handleRowChange(idx, 'unit_code', e.target.value)}
                                                                    options={unitOptions}
                                                                    placeholder="Unit"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2 text-gray-600 dark:text-gray-300 font-mono text-xs font-medium">
                                                                ₹{unitRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {compRateObj?.unitCode || 'unit'}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono font-bold text-gray-900 dark:text-white text-xs">
                                                                ₹{extCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </td>
                                                            {canWrite && (
                                                                <td className="px-4 py-2 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDuplicateRow(idx)}
                                                                            className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                                                                            title="Duplicate row"
                                                                        >
                                                                            <Copy size={13} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveRow(idx)}
                                                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                                                            title="Remove row"
                                                                        >
                                                                            <Trash2 size={13} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Live Estimated Rate Summary Card */}
                            <div className="p-4 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">Live Estimated Unit Rate</h4>
                                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                            Computed
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                        Sum of sub-component quantities × resolved component rates.
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-gray-600 dark:text-gray-300">
                                        <span>Materials: ₹{recipeMetrics.materialCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        <span>•</span>
                                        <span>Labour: ₹{recipeMetrics.labourCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>

                                <div className="text-left sm:text-right">
                                    <p className="text-xl font-mono font-black text-purple-900 dark:text-purple-200">
                                        ₹{recipeMetrics.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">
                                            / {selectedItem.base_unit_code}
                                        </span>
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        Effective as of {effectiveFrom}
                                    </p>
                                </div>
                            </div>

                            {/* VERSION HISTORY TIMELINE */}
                            <div className="pt-4 border-t border-gray-200 dark:border-white/10 space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            Recipe Version Journey & History Timeline
                                        </h3>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                            Historical recipe releases formatted as a delivery tracking timeline.
                                        </p>
                                    </div>

                                    {latestCompositionDate && (
                                        <span className="text-[11px] font-mono font-semibold text-gray-500 dark:text-gray-400">
                                            Latest Version: {latestCompositionDate}
                                        </span>
                                    )}
                                </div>

                                {isLoadingDetail ? (
                                    <div className="py-12 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-[#161b22]/30 flex items-center justify-center text-center">
                                        <LogoLoader text="Loading Version Timeline..." size="sm" fullPage={false} />
                                    </div>
                                ) : compositionVersions.length === 0 ? (
                                    <div className="p-6 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-400">
                                        No saved composition versions found in history.
                                    </div>
                                ) : (
                                    <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-gray-200 dark:before:bg-white/10">
                                        {compositionVersions.map((version, idx) => {
                                            const isSelectedDate = dateOnly(effectiveFrom) === version.date;
                                            
                                            let dotColor = "bg-gray-400 dark:bg-gray-500";
                                            let badgeStyle = "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300";
                                            let statusTitle = "ARCHIVED REVISION";

                                            if (version.isActive) {
                                                dotColor = "bg-emerald-500 shadow-xs shadow-emerald-500/50";
                                                badgeStyle = "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30";
                                                statusTitle = "LIVE IN PRODUCTION";
                                            } else if (version.isLatest) {
                                                dotColor = "bg-purple-500";
                                                badgeStyle = "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30";
                                                statusTitle = "LATEST RELEASE";
                                            }

                                            return (
                                                <motion.div
                                                    key={version.date}
                                                    initial={{ opacity: 0, y: 12 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.25, delay: idx * 0.05 }}
                                                    className="relative"
                                                >
                                                    <div className={`absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full ${dotColor} border-2 border-white dark:border-[#0d1117]`} />

                                                    <div className={`p-4 rounded-xl border bg-white dark:bg-[#161b22] shadow-xs space-y-3 ${version.isActive
                                                        ? 'border-emerald-300 dark:border-emerald-500/30'
                                                        : isSelectedDate
                                                            ? 'border-purple-300 dark:border-purple-500/30'
                                                            : 'border-gray-200 dark:border-white/10'
                                                        }`}>
                                                        
                                                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-gray-100 dark:border-white/5">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${badgeStyle}`}>
                                                                    {statusTitle}
                                                                </span>
                                                                <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
                                                                    Version #{version.versionNumber}
                                                                </span>
                                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                                    Effective: <strong className="text-purple-600 dark:text-purple-400 font-mono">{formatOrdinalDate(version.date)}</strong> → <span className="font-mono">{version.effectiveTo ? formatOrdinalDate(version.effectiveTo) : 'Present'}</span>
                                                                </span>
                                                            </div>

                                                            {canWrite && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLoadVersionIntoEditor(version.rows, version.date)}
                                                                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-white/5 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-gray-700 dark:text-gray-300 hover:text-purple-600 text-xs font-semibold border border-gray-200 dark:border-white/10 transition-colors cursor-pointer"
                                                                >
                                                                    <RotateCcw size={12} />
                                                                    <span>Restore to Draft</span>
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                                Components ({version.rows.length})
                                                            </p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {version.rows.length === 0 ? (
                                                                    <span className="text-[10px] italic text-gray-400">Empty composition</span>
                                                                ) : (
                                                                    version.rows.map(row => (
                                                                        <span key={row.id || row.component_resource_id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0d1117] text-[11px]">
                                                                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                                                                                {row.component_name || `Resource #${row.component_resource_id}`}
                                                                            </span>
                                                                            <span className="font-mono text-gray-500">
                                                                                {row.quantity} {row.unit_code}
                                                                            </span>
                                                                        </span>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
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
