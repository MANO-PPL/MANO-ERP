import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search, Calendar, Save, RotateCcw, AlertCircle,
    RefreshCw, Plus, Calculator, History
} from 'lucide-react';
import { motion } from 'framer-motion';
import { resourceApi } from '../../services/resourceApi';
import { projectApi } from '../../services/projectApi';
import { UNIT_GROUPS } from './resourceConstants';
import { useAuth } from '../../context/AuthContext';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomSelect from '../../components/CustomSelect';
import LogoLoader from '../../components/LogoLoader';
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

    const scopeOptions = useMemo(() => [
        { label: 'Master / Organization', value: '' },
        ...projects.map(p => ({ label: p.name, value: String(p.id) }))
    ], [projects]);

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

    const handleAddManualRate = async (e) => {
        e.preventDefault();
        if (!selectedResourceId || !manualRate) return;
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

    const filteredResources = useMemo(() => {
        if (!searchQuery) return resources;
        const q = searchQuery.toLowerCase();
        return resources.filter(r => r.name.toLowerCase().includes(q) || (r.code && r.code.toLowerCase().includes(q)));
    }, [resources, searchQuery]);

    const activeManualRateRow = useMemo(
        () => rateHistory.find(row => Number(row.is_active) === 1 && row.rate !== null && row.rate !== undefined),
        [rateHistory]
    );

    return (
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 font-sans">
            {/* Left Sidebar: Resource Selector */}
            <div className="w-full md:w-72 border-r border-gray-200 dark:border-white/10 flex flex-col bg-gray-50/50 dark:bg-[#161b22]/50 shrink-0">
                {/* Header aligned to h-[88px] */}
                <div className="h-[88px] px-4 py-3 border-b border-gray-200 dark:border-white/10 flex flex-col justify-center space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Resources Rate Engine
                        </h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {resources.length} Total
                        </span>
                    </div>

                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter resources by name/code..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder:text-gray-400 text-gray-900 dark:text-gray-100"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filteredResources.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-400">No resources found.</div>
                    ) : (
                        filteredResources.map(r => {
                            const isSelected = String(r.id) === String(selectedResourceId);
                            const badge = TYPE_BADGE[r.type] || TYPE_BADGE.material;
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => setSelectedResourceId(String(r.id))}
                                    className={`w-full text-left px-3 py-2 rounded-lg transition-all border ${isSelected
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 font-semibold shadow-xs'
                                        : 'bg-transparent border-transparent hover:bg-gray-100/70 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs truncate pr-2">{r.name}</p>
                                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${badge.bg}`}>
                                            {r.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5 text-[10px] text-gray-400 font-mono">
                                        <span>Unit: {r.base_unit_code}</span>
                                        {r.code && <span>#{r.code}</span>}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Workspace: Rate Resolution */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117]">
                {!selectedResource ? (
                    <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
                        <p className="text-xs font-medium">Select a resource from the list to view or configure its rate.</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Header aligned to h-[88px] */}
                        <div className="h-[88px] px-5 py-3 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/40 flex items-center justify-between gap-4 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${TYPE_BADGE[selectedResource.type]?.bg || ''}`}>
                                        {selectedResource.type}
                                    </span>
                                    {selectedResource.code && (
                                        <span className="text-[10px] font-mono text-gray-400">
                                            Code: {selectedResource.code}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                                    {selectedResource.name}
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Base Unit: <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedResource.base_unit_name || selectedResource.base_unit_code} ({selectedResource.base_unit_code})</span>
                                </p>
                            </div>

                            {/* Query scope and target date */}
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
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">Target Date:</span>
                                    <div className="w-44">
                                        <CustomDatePicker
                                            value={asOfDate}
                                            onChange={e => setAsOfDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {selectedProjectId && (
                                <div className="p-4 border border-blue-200 dark:border-blue-500/30 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20">
                                    <p className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Project Override</p>
                                    <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-1">
                                        Project rates apply to materials, labour, and items without allocation or import.
                                    </p>
                                </div>
                            )}

                            {/* Live Rate Summary Card */}
                            {isLoadingDetails ? (
                                <div className="p-8 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl flex items-center justify-center text-center">
                                    <LogoLoader text="Resolving Effective Rate..." size="md" fullPage={false} />
                                </div>
                            ) : (
                                <div className="p-5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    {/* Left: Calculator icon + Price details grouped together */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                                            <Calculator size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Effective Resolved Rate</h3>
                                                {resolvedRateInfo && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${resolvedRateInfo.source === 'manual'
                                                        ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30'
                                                        : 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                                                        }`}>
                                                        {resolvedRateInfo.source === 'manual' ? 'Manual Rate Override' : 'Computed from Recipe'}
                                                    </span>
                                                )}
                                            </div>
                                            {resolvedRateInfo ? (
                                                <p className="text-2xl font-mono font-black text-gray-900 dark:text-white mt-0.5">
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
                                            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs font-bold hover:bg-blue-200 transition-all cursor-pointer"
                                        >
                                            {isReverting ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                                            <span>Revert to Master Rate</span>
                                        </button>
                                    ) : selectedResource.type === 'item' && activeManualRateRow && canWrite && (
                                        <button
                                            type="button"
                                            onClick={handleRevertToComputed}
                                            disabled={isReverting}
                                            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 rounded-xl text-xs font-bold hover:bg-purple-200 transition-all cursor-pointer"
                                        >
                                            {isReverting ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                                            <span>Revert to Computed Recipe Rate</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Detailed Composition Breakdown if Computed */}
                            {resolvedRateInfo && resolvedRateInfo.source === 'computed' && resolvedRateInfo.breakdown && (
                                <div className="border border-purple-200 dark:border-purple-500/20 rounded-xl overflow-hidden bg-purple-50/20 dark:bg-purple-950/10">
                                    <div className="px-4 py-2.5 bg-purple-100/50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-500/20 flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">
                                            Composition Cost Breakdown ({resolvedRateInfo.breakdown.length} components)
                                        </h4>
                                    </div>
                                    <div className="p-3 space-y-1.5">
                                        {resolvedRateInfo.breakdown.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#161b22] border border-gray-100 dark:border-white/5 rounded-lg text-xs">
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{item.resourceName}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">
                                                        {item.quantity} {item.quantityUnitCode} × ₹{item.rate} / {item.rateUnitCode} ({item.source})
                                                    </p>
                                                </div>
                                                <p className="font-mono font-bold text-gray-900 dark:text-white">
                                                    + ₹{item.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Set New Rate Form */}
                            {canWrite && (
                                <div className="p-5 border border-gray-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#0d1117] space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                        <Plus size={14} className="text-emerald-500" /> Set New {selectedProjectId ? 'Project' : 'Master'} Rate Version
                                    </h4>

                                    <form onSubmit={handleAddManualRate} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Rate Amount (₹)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                min="0"
                                                placeholder="e.g. 350.00"
                                                value={manualRate}
                                                onChange={e => setManualRate(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-emerald-500 outline-none text-gray-900 dark:text-gray-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Rate Unit</label>
                                            <CustomSelect
                                                value={manualUnitCode}
                                                onChange={e => setManualUnitCode(e.target.value)}
                                                options={unitOptions}
                                                placeholder="Select unit"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Effective From</label>
                                            <CustomDatePicker
                                                value={effectiveFrom}
                                                onChange={e => setEffectiveFrom(e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <button
                                                type="submit"
                                                disabled={isSavingRate}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                                            >
                                                {isSavingRate ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                                <span>Save Rate</span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Rate History Table */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                    <History size={14} /> {selectedProjectId ? 'Project' : 'Master'} Rate Version History ({rateHistory.length})
                                </h4>

                                {rateHistory.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-gray-400 bg-gray-50/50 dark:bg-[#161b22]/30 border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                                        No historical rate versions logged for this resource.
                                    </div>
                                ) : (
                                    <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-gray-200 dark:before:bg-white/10">
                                        {rateHistory.map((r, idx) => {
                                            const isActive = Number(r.is_active) === 1;
                                            const isComputedMarker = r.rate === null || r.rate === undefined;

                                            let dotColor = "bg-gray-400 dark:bg-gray-500";
                                            let badgeStyle = "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300";
                                            let statusTitle = "ARCHIVED REVISION";

                                            if (isActive) {
                                                dotColor = "bg-emerald-500 shadow-xs shadow-emerald-500/50";
                                                badgeStyle = "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30";
                                                statusTitle = "LIVE RATE IN PRODUCTION";
                                            } else if (idx === 0) {
                                                dotColor = "bg-blue-500";
                                                badgeStyle = "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30";
                                                statusTitle = "LATEST REVISION";
                                            }

                                            return (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, y: 12 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.25, delay: idx * 0.05 }}
                                                    className="relative"
                                                >
                                                    <div className={`absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full ${dotColor} border-2 border-white dark:border-[#0d1117]`} />

                                                    <div className={`p-4 rounded-xl border bg-white dark:bg-[#161b22] shadow-xs space-y-3 ${isActive
                                                        ? 'border-emerald-300 dark:border-emerald-500/30'
                                                        : 'border-gray-200 dark:border-white/10'
                                                        }`}>

                                                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-gray-100 dark:border-white/5">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${badgeStyle}`}>
                                                                    {statusTitle}
                                                                </span>
                                                                <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
                                                                    Version #{rateHistory.length - idx}
                                                                </span>
                                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                                    Effective: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatOrdinalDate(r.effective_from)}</strong> → <span className="font-mono">{r.effective_to ? formatOrdinalDate(r.effective_to) : 'Present'}</span>
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Rate</p>
                                                                <p className="text-lg font-mono font-black text-gray-900 dark:text-white">
                                                                    {isComputedMarker ? (
                                                                        <span className="text-purple-600 dark:text-purple-400 italic">Computed Recipe Rate</span>
                                                                    ) : (
                                                                        `₹${Number(r.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / ${r.unit_code}`
                                                                    )}
                                                                </p>
                                                            </div>

                                                            {r.remarks && (
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-[#0d1117] px-3 py-1.5 rounded-lg border border-gray-100 dark:border-white/5">
                                                                    {r.remarks}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResourceRatesTab;
