import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, Search, Calendar, Save, RotateCcw, AlertCircle,
    CheckCircle2, RefreshCw, Layers, Package, Users, History,
    HelpCircle, ChevronDown, ArrowRight, WandSparkles, Calculator, Plus
} from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { UNIT_GROUPS } from './resourceConstants';
import { useAuth } from '../../context/AuthContext';

const dateOnly = (val) => (val ? String(val).slice(0, 10) : new Date().toISOString().slice(0, 10));

const TYPE_BADGE = {
    material: { label: 'Material', bg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
    item: { label: 'Item', bg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
    labour: { label: 'Labour', bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' }
};

const ResourceRatesTab = ({
    initialResourceId,
    resources = [],
    onRefreshResources,
    showToast
}) => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);

    const [selectedResourceId, setSelectedResourceId] = useState(initialResourceId ? String(initialResourceId) : '');
    const [searchQuery, setSearchQuery] = useState('');
    const [asOfDate, setAsOfDate] = useState(dateOnly());

    // Selected Resource Details
    const [resolvedRateInfo, setResolvedRateInfo] = useState(null);
    const [rateHistory, setRateHistory] = useState([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Add Manual Rate Form State
    const [manualRate, setManualRate] = useState('');
    const [manualUnitCode, setManualUnitCode] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState(dateOnly());
    const [remarks, setRemarks] = useState('');
    const [isSavingRate, setIsSavingRate] = useState(false);
    const [isReverting, setIsReverting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

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

    // Set default unit code when selected resource changes
    useEffect(() => {
        if (selectedResource) {
            setManualUnitCode(selectedResource.base_unit_code || 'kg');
        }
    }, [selectedResource]);

    // Fetch live resolved rate & historical rate versions
    const fetchRateData = async () => {
        if (!selectedResourceId) return;
        setIsLoadingDetails(true);
        setErrorMsg('');
        try {
            const [resolvedData, historyData] = await Promise.all([
                resourceApi.getResolvedRate(selectedResourceId, asOfDate),
                resourceApi.getRateHistory(selectedResourceId)
            ]);

            setResolvedRateInfo(resolvedData.rate);
            setRateHistory(historyData.rates || []);
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
    }, [selectedResourceId, asOfDate]);

    // Add Manual Rate
    const handleAddManualRate = async (e) => {
        e.preventDefault();
        if (!selectedResourceId || !manualRate) return;
        setIsSavingRate(true);
        setErrorMsg('');

        try {
            await resourceApi.addRate(selectedResourceId, {
                rate: parseFloat(manualRate),
                unit_code: manualUnitCode || selectedResource.base_unit_code,
                effective_from: effectiveFrom,
                remarks: remarks || undefined
            });

            if (showToast) showToast('success', 'Manual Rate Added', 'New rate version saved.');
            setManualRate('');
            setRemarks('');
            fetchRateData();
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

    // Revert Item to Computed Rate
    const handleRevertToComputed = async () => {
        if (!selectedResourceId) return;
        setIsReverting(true);
        setErrorMsg('');

        try {
            await resourceApi.clearManualRate(selectedResourceId, effectiveFrom);
            if (showToast) showToast('success', 'Reverted to Computed', 'Item will now dynamically compute rate from compositions.');
            fetchRateData();
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
        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100">
            {/* Left Sidebar: Resource Selector */}
            <div className="w-full md:w-80 border-r border-gray-200 dark:border-white/10 flex flex-col bg-gray-50/50 dark:bg-[#161b22]/50 shrink-0">
                <div className="p-4 border-b border-gray-200 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
                            <h3 className="text-sm font-bold">Rates & Costing</h3>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold">
                            {resources.length} Total
                        </span>
                    </div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter resources by name/code..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
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
                                    className={`w-full text-left p-3 rounded-xl transition-all border ${isSelected
                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 shadow-sm'
                                        : 'bg-white dark:bg-[#161b22] border-gray-200/70 dark:border-white/5 hover:border-emerald-200 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <p className="text-xs font-bold truncate pr-2">{r.name}</p>
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${badge.bg}`}>
                                            {r.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                                        <span>Unit: {r.base_unit_code}</span>
                                        {r.code && <span>{r.code}</span>}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Panel: Rate Resolution Workspace */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117]">
                {!selectedResource ? (
                    <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
                        <div>
                            <DollarSign size={40} className="mx-auto mb-3 opacity-30 text-emerald-500" />
                            <p className="text-sm font-semibold">Select a resource from the list to view or configure its rate.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Header Banner */}
                        <div className="p-5 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${TYPE_BADGE[selectedResource.type]?.bg || ''}`}>
                                        {selectedResource.type}
                                    </span>
                                    <h2 className="text-base font-bold">{selectedResource.name}</h2>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Base Unit: <strong className="text-gray-700 dark:text-gray-300">{selectedResource.base_unit_name || selectedResource.base_unit_code} ({selectedResource.base_unit_code})</strong>
                                </p>
                            </div>

                            {/* Query Target Date */}
                            <div className="flex items-center gap-2 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5">
                                <Calendar size={14} className="text-emerald-500" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Target Date:</span>
                                <input
                                    type="date"
                                    value={asOfDate}
                                    onChange={e => setAsOfDate(e.target.value)}
                                    className="bg-transparent text-xs font-semibold outline-none"
                                />
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* Live Rate Summary Card */}
                            <div className="p-5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                                        <Calculator size={24} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Effective Resolved Rate</h3>
                                            {resolvedRateInfo && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${resolvedRateInfo.source === 'manual'
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                    : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                                    }`}>
                                                    {resolvedRateInfo.source === 'manual' ? 'Manual Rate Override' : 'Computed from Recipe'}
                                                </span>
                                            )}
                                        </div>
                                        {isLoadingDetails ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <RefreshCw size={14} className="animate-spin text-emerald-500" />
                                                <span className="text-xs text-gray-400">Calculating rate...</span>
                                            </div>
                                        ) : resolvedRateInfo ? (
                                            <p className="text-2xl font-mono font-black text-gray-900 dark:text-white mt-0.5">
                                                ₹{Number(resolvedRateInfo.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                <span className="text-xs font-normal text-gray-500 ml-1">per {resolvedRateInfo.unitCode}</span>
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic mt-1">No rate configured for this date.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Revert button if item has manual rate */}
                                {selectedResource.type === 'item' && activeManualRateRow && canWrite && (
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

                            {/* Detailed Cost Breakdown if Computed */}
                            {resolvedRateInfo && resolvedRateInfo.source === 'computed' && resolvedRateInfo.breakdown && (
                                <div className="border border-purple-200 dark:border-purple-500/20 rounded-2xl overflow-hidden bg-purple-50/20 dark:bg-purple-950/10">
                                    <div className="p-4 bg-purple-100/50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-500/20 flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                                            <WandSparkles size={15} /> Composition Cost Breakdown Tree
                                        </h4>
                                        <span className="text-[10px] text-purple-700 dark:text-purple-400 font-semibold">
                                            {resolvedRateInfo.breakdown.length} components
                                        </span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        {resolvedRateInfo.breakdown.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-[#161b22] border border-gray-100 dark:border-white/5 rounded-xl text-xs">
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white">{item.resourceName}</p>
                                                    <p className="text-[10px] text-gray-400">
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

                            {/* Add Manual Rate Version Form */}
                            {canWrite && (
                                <div className="p-5 border border-gray-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#0d1117] space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                        <Plus size={14} className="text-emerald-500" /> Set New Rate Version
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
                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Rate Unit</label>
                                            <select
                                                value={manualUnitCode}
                                                onChange={e => setManualUnitCode(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 outline-none"
                                            >
                                                {Object.entries(UNIT_GROUPS).map(([cat, units]) => (
                                                    <optgroup key={cat} label={cat.toUpperCase()}>
                                                        {units.map(u => (
                                                            <option key={u.code} value={u.code}>{u.symbol} ({u.name})</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Effective From</label>
                                            <input
                                                type="date"
                                                required
                                                value={effectiveFrom}
                                                onChange={e => setEffectiveFrom(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <button
                                                type="submit"
                                                disabled={isSavingRate}
                                                className="w-full flex items-center justify-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
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
                                    <History size={14} /> Rate Version History ({rateHistory.length})
                                </h4>

                                {rateHistory.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-gray-400 bg-gray-50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                                        No historical manual rate versions logged for this resource.
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
                                        <table className="w-full text-left text-xs bg-white dark:bg-[#0d1117]">
                                            <thead className="bg-gray-50 dark:bg-[#161b22] text-gray-400 uppercase tracking-wider text-[10px] border-b border-gray-200 dark:border-white/10">
                                                <tr>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3">Rate</th>
                                                    <th className="px-4 py-3">Unit</th>
                                                    <th className="px-4 py-3">Effective From</th>
                                                    <th className="px-4 py-3">Effective To</th>
                                                    <th className="px-4 py-3">Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                {rateHistory.map((r, idx) => {
                                                    const isActive = Number(r.is_active) === 1;
                                                    const isComputedMarker = r.rate === null || r.rate === undefined;

                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive
                                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                                                                    }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                                    {isActive ? 'Active' : 'Closed'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                                                                {isComputedMarker ? (
                                                                    <span className="text-purple-600 dark:text-purple-400 italic">Computed</span>
                                                                ) : (
                                                                    `₹${Number(r.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-500">{r.unit_code}</td>
                                                            <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{r.effective_from}</td>
                                                            <td className="px-4 py-3 font-mono text-gray-500">{r.effective_to || 'Present'}</td>
                                                            <td className="px-4 py-3 text-gray-400 italic">{r.remarks || '—'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
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
