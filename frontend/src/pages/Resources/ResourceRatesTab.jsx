import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search, Calendar, Save, RotateCcw, AlertCircle,
    RefreshCw, Plus, Calculator, History, AlertTriangle,
    Edit2, X, Check, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { resourceApi } from '../../services/resourceApi';
import { projectApi } from '../../services/projectApi';
import { UNIT_GROUPS } from './resourceConstants';
import { useAuth } from '../../context/AuthContext';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomSelect from '../../components/CustomSelect';
import { formatOrdinalDate } from '../../utils/dateUtils';

const dateOnly = (val) => (val ? String(val).slice(0, 10) : new Date().toISOString().slice(0, 10));

const TYPE_BADGE = {
    material: { label: 'Material', bg: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30' },
    item: { label: 'Item', bg: 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30' },
    labour: { label: 'Labour', bg: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30' }
};

const ResourceRatesTab = ({
    initialResourceId,
    resources = [],
    initialProjectId = '',
    onRefreshResources,
    showToast
}) => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);

    const [selectedResourceId, setSelectedResourceId] = useState(initialResourceId ? String(initialResourceId) : '');
    const [searchQuery, setSearchQuery] = useState('');
    const [asOfDate, setAsOfDate] = useState(dateOnly());
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ? String(initialProjectId) : '');

    const [resolvedRateInfo, setResolvedRateInfo] = useState(null);
    const [rateHistory, setRateHistory] = useState([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // In-memory cache for resolved rates and history
    const rateCacheRef = useRef({});

    const [manualRate, setManualRate] = useState('');
    const [manualUnitCode, setManualUnitCode] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState(dateOnly());
    const [remarks, setRemarks] = useState('');
    const [isSavingRate, setIsSavingRate] = useState(false);
    const [isReverting, setIsReverting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Historical Rate Editing State
    const [editingRate, setEditingRate] = useState(null);
    const [isUpdatingRate, setIsUpdatingRate] = useState(false);

    useEffect(() => {
        projectApi.listProjects()
            .then(data => setProjects(data.projects || []))
            .catch(err => console.error('Failed to load projects for rate scope', err));
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
            ...projects.map(p => ({ label: p.name, value: String(p.id) }))
        ];
    }, [projects, initialProjectId]);

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
        if (initialResourceId && resources.some(r => String(r.id) === String(initialResourceId))) {
            setSelectedResourceId(String(initialResourceId));
        } else if (!selectedResourceId && resources.length > 0) {
            setSelectedResourceId(String(resources[0].id));
        }
    }, [initialResourceId, resources]);

    const selectedResource = useMemo(
        () => resources.find(r => String(r.id) === String(selectedResourceId)),
        [resources, selectedResourceId]
    );

    useEffect(() => {
        if (selectedResource) {
            setManualUnitCode(selectedResource.base_unit_code || 'kg');
        }
    }, [selectedResource]);

    const fetchRateData = async (force = false) => {
        if (!selectedResourceId) return;
        const cacheKey = `${selectedResourceId}_${selectedProjectId || 'master'}_${asOfDate}`;
        if (!force && rateCacheRef.current[cacheKey]) {
            const cached = rateCacheRef.current[cacheKey];
            setResolvedRateInfo(cached.resolved);
            setRateHistory(cached.history);
            return;
        }

        setIsLoadingDetails(true);
        setErrorMsg('');
        try {
            const [resolvedData, historyData] = await Promise.all(
                selectedProjectId
                    ? [
                        projectApi.getResolvedResourceRate(selectedProjectId, selectedResourceId, asOfDate),
                        projectApi.getResourceRateHistory(selectedProjectId, selectedResourceId)
                    ]
                    : [
                        resourceApi.getResolvedRate(selectedResourceId, asOfDate),
                        resourceApi.getRateHistory(selectedResourceId)
                    ]
            );

            const resolved = resolvedData.rate;
            const history = historyData.rates || [];
            rateCacheRef.current[cacheKey] = { resolved, history };
            setResolvedRateInfo(resolved);
            setRateHistory(history);
        } catch (err) {
            console.error('Failed to load rate information', err);
            setErrorMsg(err.response?.data?.message || 'Failed to resolve rate');
        } finally {
            setIsLoadingDetails(false);
        }
    };

    useEffect(() => {
        if (selectedResourceId) {
            fetchRateData();
        }
    }, [selectedResourceId, asOfDate, selectedProjectId]);

    const invalidateRateCache = () => {
        rateCacheRef.current = {};
    };

    const activeManualRateRow = useMemo(
        () => rateHistory.find(row => Number(row.is_active) === 1 && row.rate !== null && row.rate !== undefined),
        [rateHistory]
    );

    const minNewRateDate = useMemo(() => {
        if (!activeManualRateRow?.effective_from) return dateOnly();
        const d = new Date(`${dateOnly(activeManualRateRow.effective_from)}T00:00:00.000Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().slice(0, 10);
    }, [activeManualRateRow]);

    useEffect(() => {
        if (minNewRateDate) {
            setEffectiveFrom(prev => (prev < minNewRateDate ? minNewRateDate : prev));
        }
    }, [minNewRateDate]);

    const handleAddManualRate = async (e) => {
        e.preventDefault();
        if (!selectedResourceId || !manualRate) return;

        if (activeManualRateRow && effectiveFrom <= dateOnly(activeManualRateRow.effective_from)) {
            const minDate = minNewRateDate;
            const msg = `New rate version start date (${effectiveFrom}) must be after current active rate (${dateOnly(activeManualRateRow.effective_from)}), starting from ${minDate}. To adjust the current rate, click "Edit Version".`;
            setErrorMsg(msg);
            if (showToast) showToast('error', 'Invalid Effective Date', msg);
            return;
        }

        setIsSavingRate(true);
        setErrorMsg('');

        try {
            const rateData = {
                rate: parseFloat(manualRate),
                unit_code: manualUnitCode || selectedResource.base_unit_code,
                effective_from: effectiveFrom,
                remarks: remarks || undefined
            };
            if (selectedProjectId) {
                await projectApi.addResourceRate(selectedProjectId, selectedResourceId, rateData);
            } else {
                await resourceApi.addRate(selectedResourceId, rateData);
            }

            if (showToast) showToast('success', 'Manual Rate Added', 'New rate version saved.');
            setManualRate('');
            setRemarks('');
            invalidateRateCache();
            fetchRateData(true);
            if (onRefreshResources) onRefreshResources();
        } catch (err) {
            console.error('Failed to add rate', err);
            const msg = err.response?.data?.message || err.message || 'Failed to add manual rate';
            setErrorMsg(msg);
            if (showToast) showToast('error', 'Add Rate Failed', msg);
        } finally {
            setIsSavingRate(false);
        }
    };

    const handleRevertToComputed = async () => {
        if (!selectedResourceId) return;
        setIsReverting(true);
        setErrorMsg('');

        try {
            await resourceApi.clearManualRate(selectedResourceId, effectiveFrom);
            if (showToast) showToast('success', 'Reverted to Computed', 'Item will dynamically compute rate from compositions.');
            invalidateRateCache();
            fetchRateData(true);
            if (onRefreshResources) onRefreshResources();
        } catch (err) {
            console.error('Failed to clear manual rate', err);
            const msg = err.response?.data?.message || err.message || 'Failed to revert rate';
            setErrorMsg(msg);
            if (showToast) showToast('error', 'Revert Failed', msg);
        } finally {
            setIsReverting(false);
        }
    };

    const handleRevertToMaster = async () => {
        if (!selectedResourceId || !selectedProjectId) return;
        setIsReverting(true);
        setErrorMsg('');
        try {
            await projectApi.clearResourceRate(selectedProjectId, selectedResourceId, effectiveFrom);
            if (showToast) showToast('success', 'Reverted to Master', 'The project now uses the master rate or recipe calculation.');
            invalidateRateCache();
            fetchRateData(true);
            if (onRefreshResources) onRefreshResources();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to revert project rate';
            setErrorMsg(msg);
            if (showToast) showToast('error', 'Revert Failed', msg);
        } finally {
            setIsReverting(false);
        }
    };

    const handleOpenEditModal = (rateItem) => {
        const isComputed = rateItem.rate === null || rateItem.rate === undefined || String(rateItem.remarks || '').toLowerCase().includes('computed');
        setEditingRate({
            id: rateItem.id,
            mode: (selectedResource?.type === 'item' && isComputed) ? 'computed' : 'manual',
            rate: rateItem.rate !== null && rateItem.rate !== undefined ? String(rateItem.rate) : '',
            unit_code: rateItem.unit_code || selectedResource?.base_unit_code || 'kg',
            effective_from: dateOnly(rateItem.effective_from),
            effective_to: rateItem.effective_to ? dateOnly(rateItem.effective_to) : '',
            remarks: rateItem.remarks || '',
            versionNumber: rateItem.versionNumber
        });
    };

    const handleSaveEditRate = async (e) => {
        e.preventDefault();
        if (!editingRate || !selectedResourceId) return;
        
        if (editingRate.effective_to && editingRate.effective_to < editingRate.effective_from) {
            const msg = 'Effective To date cannot be earlier than Effective From date';
            setErrorMsg(msg);
            if (showToast) showToast('error', 'Invalid Date Range', msg);
            return;
        }

        setIsUpdatingRate(true);
        setErrorMsg('');

        try {
            const isComputedMode = editingRate.mode === 'computed';
            const payload = {
                mode: isComputedMode ? 'computed' : 'manual',
                rate: isComputedMode ? null : parseFloat(editingRate.rate),
                unit_code: editingRate.unit_code,
                effective_from: editingRate.effective_from,
                effective_to: editingRate.effective_to || null,
                remarks: editingRate.remarks || (isComputedMode ? 'Dynamic recipe calculation' : undefined)
            };

            if (selectedProjectId) {
                await projectApi.updateResourceRate(selectedProjectId, selectedResourceId, editingRate.id, payload);
            } else {
                await resourceApi.updateRate(selectedResourceId, editingRate.id, payload);
            }

            if (showToast) showToast('success', 'Rate Version Updated', isComputedMode ? 'Switched to dynamic computed recipe.' : 'Historical rate record has been updated.');
            setEditingRate(null);
            invalidateRateCache();
            fetchRateData(true);
            if (onRefreshResources) onRefreshResources();
        } catch (err) {
            console.error('Failed to update rate record', err);
            const msg = err.response?.data?.message || err.message || 'Failed to update rate record';
            setErrorMsg(msg);
            if (showToast) showToast('error', 'Update Failed', msg);
        } finally {
            setIsUpdatingRate(false);
        }
    };

    const filteredResources = useMemo(() => {
        if (!searchQuery) return resources;
        const q = searchQuery.toLowerCase();
        return resources.filter(r => r.name.toLowerCase().includes(q) || (r.code && r.code.toLowerCase().includes(q)));
    }, [resources, searchQuery]);

    return (
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 font-sans">
            {/* Left Sidebar: Resource Selector */}
            <div className="w-full md:w-72 border-r border-gray-200 dark:border-white/10 flex flex-col bg-gray-50/50 dark:bg-[#161b22]/50 shrink-0">
                {/* Header: Search Box only */}
                <div className="h-[52px] px-3 border-b border-gray-200 dark:border-white/10 flex items-center shrink-0">
                    <div className="relative w-full">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter resources by name/code..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 text-gray-900 dark:text-gray-100"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                    {filteredResources.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-400">
                            No resources match search.
                        </div>
                    ) : (
                        filteredResources.map(res => {
                            const isSelected = String(res.id) === String(selectedResourceId);
                            const badge = TYPE_BADGE[res.type] || TYPE_BADGE.material;
                            return (
                                <button
                                    key={res.id}
                                    onClick={() => setSelectedResourceId(String(res.id))}
                                    className={`w-full text-left px-3 py-2 rounded-lg transition-all border ${isSelected
                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-500/40 text-blue-900 dark:text-blue-200 font-semibold shadow-xs'
                                        : 'bg-transparent border-transparent hover:bg-gray-100/70 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs truncate font-medium text-gray-900 dark:text-white">{res.name}</p>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${badge.bg}`}>
                                            {badge.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5 text-[10px] text-gray-400 font-mono">
                                        <span>{res.code ? `#${res.code}` : 'NO-CODE'}</span>
                                        <span className="font-sans">{res.base_unit_code}</span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Column: Rate Details & Management */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117]">
                {selectedResource ? (
                    <>
                        {/* Header Panel */}
                        <div className="h-[52px] px-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/40 flex items-center justify-between gap-3 shrink-0">
                            <div className="flex flex-col justify-center min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${TYPE_BADGE[selectedResource.type]?.bg || ''}`}>
                                        {TYPE_BADGE[selectedResource.type]?.label || selectedResource.type}
                                    </span>
                                    <h2 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                                        {selectedResource.name}
                                    </h2>
                                    {selectedResource.code && (
                                        <span className="text-[10px] font-mono text-gray-400 shrink-0">
                                            #{selectedResource.code}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                    Base Unit: <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedResource.base_unit_name || selectedResource.base_unit_code} ({selectedResource.base_unit_code})</span>
                                </p>
                            </div>

                            {/* Query scope and target date */}
                            <div className="flex items-center justify-end gap-2 shrink-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Scope:</span>
                                    <div className="w-40">
                                        <CustomSelect
                                            value={selectedProjectId}
                                            onChange={e => setSelectedProjectId(e.target.value)}
                                            options={scopeOptions}
                                            placeholder="Master / Organization"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Target Date:</span>
                                    <div className="w-36">
                                        <CustomDatePicker
                                            value={asOfDate}
                                            onChange={e => setAsOfDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="mx-3 mt-2.5 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
                            {selectedProjectId && (
                                <div className="p-2.5 px-3 border border-blue-200 dark:border-blue-500/30 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                                    <p className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Project Override</p>
                                    <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                                        Project rates apply to materials, labour, and items without allocation or import.
                                    </p>
                                </div>
                            )}

                            {/* Live Rate Summary Card */}
                            {isLoadingDetails ? (
                                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-lg flex flex-col items-center justify-center text-center">
                                    <Loader2 className="animate-spin mb-1 text-emerald-600 dark:text-emerald-400" size={20} />
                                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Resolving Effective Rate...</span>
                                </div>
                            ) : (
                                <div className="p-3 px-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                            <Calculator size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Effective Resolved Rate</h3>
                                                {resolvedRateInfo && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${resolvedRateInfo.source === 'manual'
                                                        ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30'
                                                        : 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                                                        }`}>
                                                        {resolvedRateInfo.source === 'manual' ? 'Manual Rate Override' : 'Computed from Recipe'}
                                                    </span>
                                                )}
                                            </div>
                                            {resolvedRateInfo ? (
                                                <p className="text-xl font-mono font-black text-gray-900 dark:text-white mt-0.5">
                                                    ₹{Number(resolvedRateInfo.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 ml-1">
                                                        / {resolvedRateInfo.unitCode}
                                                    </span>
                                                </p>
                                            ) : (
                                                <p className="text-xs text-gray-400 italic mt-0.5">No rate configured for this date.</p>
                                            )}
                                        </div>
                                    </div>

                                    {selectedProjectId && activeManualRateRow && canWrite ? (
                                        <button
                                            type="button"
                                            onClick={handleRevertToMaster}
                                            disabled={isReverting}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 rounded-lg text-xs font-bold hover:bg-blue-200 transition-all cursor-pointer"
                                        >
                                            {isReverting ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                            <span>Revert to Master Rate</span>
                                        </button>
                                    ) : selectedResource.type === 'item' && activeManualRateRow && canWrite && (
                                        <button
                                            type="button"
                                            onClick={handleRevertToComputed}
                                            disabled={isReverting}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 rounded-lg text-xs font-bold hover:bg-purple-200 transition-all cursor-pointer"
                                        >
                                            {isReverting ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                            <span>Revert to Computed Recipe Rate</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Detailed Composition Breakdown if Computed */}
                            {resolvedRateInfo && resolvedRateInfo.source === 'computed' && resolvedRateInfo.breakdown && (
                                <div className="border border-purple-200 dark:border-purple-500/20 rounded-lg overflow-hidden bg-purple-50/20 dark:bg-purple-950/10">
                                    <div className="px-3 py-1.5 bg-purple-100/50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-500/20 flex items-center justify-between">
                                        <h4 className="text-[10px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">
                                            Composition Cost Breakdown ({resolvedRateInfo.breakdown.length} components)
                                        </h4>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        {resolvedRateInfo.breakdown.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-gray-100 dark:border-white/5 rounded-md text-xs">
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white text-xs">{item.resourceName}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">
                                                        {item.quantity} {item.quantityUnitCode} × ₹{item.rate} / {item.rateUnitCode} ({item.source})
                                                    </p>
                                                </div>
                                                <p className="font-mono font-bold text-gray-900 dark:text-white text-xs">
                                                    + ₹{item.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Set New Rate Form */}
                            {canWrite && (
                                <div className="p-3 px-3.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#0d1117] space-y-2.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                            <Plus size={13} className="text-emerald-500" /> Set New {selectedProjectId ? 'Project' : 'Master'} Rate Version
                                        </h4>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            {selectedResource.type === 'item' && activeManualRateRow && (
                                                <button
                                                    type="button"
                                                    onClick={handleRevertToComputed}
                                                    disabled={isReverting}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 rounded-md text-xs font-bold hover:bg-purple-100 transition cursor-pointer"
                                                >
                                                    {isReverting ? <RefreshCw size={11} className="animate-spin" /> : <Calculator size={11} />}
                                                    <span>Revert to Computed Recipe</span>
                                                </button>
                                            )}

                                            {selectedProjectId && activeManualRateRow && (
                                                <button
                                                    type="button"
                                                    onClick={handleRevertToMaster}
                                                    disabled={isReverting}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 rounded-md text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
                                                >
                                                    {isReverting ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                                    <span>Revert to Master Rate</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <form onSubmit={handleAddManualRate} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 items-end">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-0.5">Rate Amount (₹)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                min="0"
                                                placeholder="e.g. 350.00"
                                                value={manualRate}
                                                onChange={e => setManualRate(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold focus:ring-1 focus:ring-emerald-500 outline-none text-gray-900 dark:text-gray-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-0.5">Rate Unit</label>
                                            <CustomSelect
                                                value={manualUnitCode}
                                                onChange={e => setManualUnitCode(e.target.value)}
                                                options={unitOptions}
                                                placeholder="Select unit"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-0.5">Effective From</label>
                                            <CustomDatePicker
                                                value={effectiveFrom}
                                                onChange={e => setEffectiveFrom(e.target.value)}
                                                minDate={minNewRateDate}
                                            />
                                        </div>

                                        <div>
                                            <button
                                                type="submit"
                                                disabled={isSavingRate}
                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                                            >
                                                {isSavingRate ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                                                <span>Save Rate</span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Rate History Table */}
                            <div className="space-y-1.5">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                    <History size={13} /> {selectedProjectId ? 'Project' : 'Master'} Rate Version History ({rateHistory.length})
                                </h4>

                                <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-[#0d1117]">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/50 text-[10px] uppercase font-bold text-gray-400">
                                                <th className="py-1.5 px-3">Version</th>
                                                <th className="py-1.5 px-3">Rate</th>
                                                <th className="py-1.5 px-3">Unit</th>
                                                <th className="py-1.5 px-3">Effective Range</th>
                                                <th className="py-1.5 px-3">Status</th>
                                                <th className="py-1.5 px-3">Remarks</th>
                                                {canWrite && <th className="py-1.5 px-3 text-right">Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {rateHistory.map((item, idx) => {
                                                const isActive = Number(item.is_active) === 1;
                                                const versionNumber = rateHistory.length - idx;
                                                return (
                                                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                                        <td className="py-2 px-3 font-mono font-bold text-gray-500">
                                                            #{versionNumber}
                                                        </td>
                                                        <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-white">
                                                            {item.rate !== null && item.rate !== undefined ? (
                                                                `₹${Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                                                    <Calculator size={10} />
                                                                    Computed
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                                                            {item.unit_code || selectedResource.base_unit_code}
                                                        </td>
                                                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-mono text-[11px]">
                                                            {formatOrdinalDate(item.effective_from)} → {item.effective_to ? formatOrdinalDate(item.effective_to) : 'Present'}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isActive
                                                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                                                }`}>
                                                                {isActive ? 'Active' : 'Archived'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 text-gray-400 italic text-[11px] truncate max-w-[150px]">
                                                            {item.remarks || '-'}
                                                        </td>
                                                        {canWrite && (
                                                            <td className="py-2 px-3 text-right">
                                                                {isActive ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEditModal({ ...item, versionNumber })}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded border border-transparent hover:border-blue-200 dark:hover:border-blue-500/30 transition cursor-pointer"
                                                                        title="Edit current active rate"
                                                                    >
                                                                        <Edit2 size={11} />
                                                                        <span>Edit Rate</span>
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-gray-400 text-[10px] italic">Locked</span>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}

                                            {rateHistory.length === 0 && (
                                                <tr>
                                                    <td colSpan={canWrite ? 7 : 6} className="py-4 text-center text-xs text-gray-400">
                                                        No rate version history recorded for this resource scope.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
                        <AlertCircle size={32} className="mb-2 opacity-50" />
                        <p className="text-sm font-semibold">No resource selected</p>
                        <p className="text-xs">Choose a resource from the catalog sidebar on the left.</p>
                    </div>
                )}
            </div>

            {/* Edit Historical Rate Modal */}
            {editingRate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-lg bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                    Edit Historical Rate Version #{editingRate.versionNumber}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {selectedResource?.name} {selectedProjectId ? '(Project Scope)' : '(Master Catalog)'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingRate(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Warning Alert Banner */}
                        <div className="p-4 mx-6 mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 rounded-xl flex items-start gap-3">
                            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                    Caution: Modifying Historical Rate Records
                                </h4>
                                <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                                    Directly updating an existing rate version alters historical records. Any calculations, purchase orders, or ledgers referencing this date period will recalculate based on these revised figures.
                                </p>
                            </div>
                        </div>

                        {/* Edit Form */}
                        <form onSubmit={handleSaveEditRate} className="p-6 space-y-4">
                            {selectedResource?.type === 'item' && (
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold uppercase text-gray-400">Rate Calculation Mode</label>
                                    <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setEditingRate(prev => ({ ...prev, mode: 'computed' }))}
                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                                editingRate.mode === 'computed'
                                                    ? 'bg-purple-600 text-white shadow-sm'
                                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <Calculator size={13} />
                                            <span>Dynamic Computed Recipe</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingRate(prev => ({ ...prev, mode: 'manual' }))}
                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                                editingRate.mode === 'manual'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <Edit2 size={13} />
                                            <span>Fixed Manual Override</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {editingRate.mode === 'computed' ? (
                                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 rounded-xl space-y-1">
                                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
                                        <Calculator size={14} />
                                        <span>Dynamic Recipe Calculation</span>
                                    </div>
                                    <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 leading-relaxed">
                                        This rate version will dynamically compute its price from the constituent materials and labour active during this date range.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Rate Amount (₹)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            min="0"
                                            value={editingRate.rate}
                                            onChange={e => setEditingRate(prev => ({ ...prev, rate: e.target.value }))}
                                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Rate Unit</label>
                                        <CustomSelect
                                            value={editingRate.unit_code}
                                            onChange={e => setEditingRate(prev => ({ ...prev, unit_code: e.target.value }))}
                                            options={unitOptions}
                                            placeholder="Select unit"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Effective From</label>
                                    <CustomDatePicker
                                        value={editingRate.effective_from}
                                        onChange={e => setEditingRate(prev => ({ ...prev, effective_from: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Effective To (Optional)</label>
                                    <CustomDatePicker
                                        value={editingRate.effective_to}
                                        onChange={e => setEditingRate(prev => ({ ...prev, effective_to: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Reason / Revision Remarks</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Corrected invoice price typo"
                                    value={editingRate.remarks}
                                    onChange={e => setEditingRate(prev => ({ ...prev, remarks: e.target.value }))}
                                    className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-200 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setEditingRate(null)}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdatingRate}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                                >
                                    {isUpdatingRate ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default ResourceRatesTab;
