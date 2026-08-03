import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Plus, Trash2, Save, RefreshCw, AlertCircle,
    ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { resourceApi } from '../../services/resourceApi';
import { UNIT_GROUPS, convert } from './resourceConstants';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';
import LogoLoader from '../../components/LogoLoader';
import { formatOrdinalDate } from '../../utils/dateUtils';

const ResourceConversionsTab = ({
    initialResourceId,
    resources = [],
    onRefreshResources,
    showToast
}) => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);

    const [selectedResourceId, setSelectedResourceId] = useState(initialResourceId ? String(initialResourceId) : '');
    const [searchQuery, setSearchQuery] = useState('');
    const [resourceDetail, setResourceDetail] = useState(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    const [convName, setConvName] = useState('');
    const [convQty, setConvQty] = useState('');
    const [convUnitCode, setConvUnitCode] = useState('');
    const [isSavingConv, setIsSavingConv] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [calcFromQty, setCalcFromQty] = useState('100');
    const [calcFromUnit, setCalcFromUnit] = useState('kg');
    const [calcToUnit, setCalcToUnit] = useState('MT');
    const [calcResult, setCalcResult] = useState(null);
    const [calcError, setCalcError] = useState('');

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
            setConvUnitCode(selectedResource.base_unit_code || 'kg');
            setCalcFromUnit(selectedResource.base_unit_code || 'kg');
        }
    }, [selectedResource]);

    const fetchResourceDetail = async () => {
        if (!selectedResourceId) return;
        setIsLoadingDetail(true);
        setErrorMsg('');
        try {
            const data = await resourceApi.getResourceById(selectedResourceId);
            setResourceDetail(data.resource);
        } catch (err) {
            console.error('Failed to load resource detail', err);
            setErrorMsg(err.response?.data?.message || 'Failed to load resource conversions');
        } finally {
            setIsLoadingDetail(false);
        }
    };

    useEffect(() => {
        if (selectedResourceId) {
            fetchResourceDetail();
        }
    }, [selectedResourceId]);

    useEffect(() => {
        setCalcError('');
        const qty = parseFloat(calcFromQty);
        if (isNaN(qty) || qty < 0) {
            setCalcResult(null);
            return;
        }
        try {
            const res = convert(calcFromUnit, calcToUnit, qty);
            setCalcResult(res);
        } catch (err) {
            setCalcError(err.message || 'Incompatible unit types');
            setCalcResult(null);
        }
    }, [calcFromQty, calcFromUnit, calcToUnit]);

    const handleAddConversion = async (e) => {
        e.preventDefault();
        if (!selectedResourceId || !convName || !convQty || !convUnitCode) return;
        setIsSavingConv(true);
        setErrorMsg('');

        try {
            await resourceApi.addConversion(selectedResourceId, {
                name: convName,
                quantity: parseFloat(convQty),
                unit_code: convUnitCode
            });

            if (showToast) showToast('success', 'Conversion Added', `Added 1 ${convName} conversion.`);
            setConvName('');
            setConvQty('');
            fetchResourceDetail();
            if (onRefreshResources) onRefreshResources();
        } catch (err) {
            console.error('Failed to add conversion', err);
            const msg = err.response?.data?.message || err.message || 'Failed to add unit conversion';
            setErrorMsg(msg);
            if (showToast) showToast('error', 'Add Failed', msg);
        } finally {
            setIsSavingConv(false);
        }
    };

    const handleDeleteConversion = (convId, name) => {
        if (!selectedResourceId) return;
        setConfirmModal({
            isOpen: true,
            title: 'Remove Conversion Scale?',
            message: `Are you sure you want to remove unit conversion scale "${name}"?`,
            confirmText: 'Remove Scale',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isLoading: true }));
                try {
                    await resourceApi.removeConversion(selectedResourceId, convId);
                    if (showToast) showToast('success', 'Conversion Removed', `Removed ${name} conversion.`);
                    fetchResourceDetail();
                    if (onRefreshResources) onRefreshResources();
                } catch (err) {
                    console.error('Failed to remove conversion', err);
                    if (showToast) showToast('error', 'Remove Failed', err.response?.data?.message || 'Failed to delete conversion');
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
                }
            }
        });
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
                {/* Header aligned to h-[88px] */}
                <div className="h-[88px] px-4 py-3 border-b border-gray-200 dark:border-white/10 flex flex-col justify-center space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Unit Conversions
                        </h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
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
                            className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 text-gray-900 dark:text-gray-100"
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
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => setSelectedResourceId(String(r.id))}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border ${isSelected
                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-500/40 text-blue-900 dark:text-blue-200 font-semibold'
                                        : 'bg-white dark:bg-[#161b22] border-gray-200/70 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-500/20 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs truncate pr-2">{r.name}</p>
                                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 shrink-0">
                                            {r.base_unit_code}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 capitalize">Type: {r.type}</p>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Workspace: Conversions */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117]">
                {!selectedResource ? (
                    <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
                        <p className="text-xs font-medium">Select a resource to configure custom unit conversion scales.</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Header aligned to h-[88px] */}
                        <div className="h-[88px] px-5 py-3 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/40 flex items-center justify-between gap-4 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                                        Conversion Scales
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
                        </div>

                        {errorMsg && (
                            <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                            {/* Form: Add New Conversion Scale */}
                            {canWrite && (
                                <div className="p-4 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#0d1117] space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                        Define Custom Conversion Alias (e.g. 1 Bag = 50 kg)
                                    </h4>

                                    <form onSubmit={handleAddConversion} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Scale Name</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Bag or Brass"
                                                value={convName}
                                                onChange={e => setConvName(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Equivalent Quantity</label>
                                            <input
                                                type="number"
                                                step="any"
                                                required
                                                min="0"
                                                placeholder="e.g. 50"
                                                value={convQty}
                                                onChange={e => setConvQty(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Target Unit</label>
                                            <select
                                                value={convUnitCode}
                                                onChange={e => setConvUnitCode(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
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
                                            <button
                                                type="submit"
                                                disabled={isSavingConv}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                                            >
                                                {isSavingConv ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                                <span>Save Alias</span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Active Conversion Scales History */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Conversion Scales Timeline ({resourceDetail?.conversions?.length || 0})
                                </h4>

                                {isLoadingDetail ? (
                                    <div className="py-12 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-[#161b22]/30">
                                        <LogoLoader text="Rendering Unit Conversions..." size="sm" fullPage={false} />
                                    </div>
                                ) : !resourceDetail?.conversions || resourceDetail.conversions.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-gray-400 bg-gray-50/50 dark:bg-[#161b22]/30 border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                                        No custom conversion scales defined for {selectedResource.name}.
                                    </div>
                                ) : (
                                    <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-gray-200 dark:before:bg-white/10">
                                        {resourceDetail.conversions.map((c, idx) => (
                                            <motion.div
                                                key={c.id}
                                                initial={{ opacity: 0, y: 12 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.25, delay: idx * 0.05 }}
                                                className="relative"
                                            >
                                                <div className="absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full bg-blue-500 shadow-xs shadow-blue-500/50 border-2 border-white dark:border-[#0d1117]" />

                                                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-500/20 bg-white dark:bg-[#161b22] shadow-xs space-y-3">
                                                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-gray-100 dark:border-white/5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                                                                ACTIVE ALIAS CONVERSION
                                                            </span>
                                                            <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
                                                                Scale #{idx + 1}
                                                            </span>
                                                            {c.created_at && (
                                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                                    Configured: <strong className="text-blue-600 dark:text-blue-400 font-mono">{formatOrdinalDate(c.created_at)}</strong>
                                                                </span>
                                                            )}
                                                        </div>

                                                        {canWrite && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteConversion(c.id, c.name)}
                                                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-500/30 transition-colors cursor-pointer"
                                                                title="Remove scale"
                                                            >
                                                                <Trash2 size={12} />
                                                                <span>Remove Scale</span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <span className="text-base font-bold text-gray-900 dark:text-white">1 {c.name}</span>
                                                        <ArrowRight size={16} className="text-blue-500 shrink-0" />
                                                        <span className="text-base font-mono font-black text-blue-600 dark:text-blue-400">
                                                            {c.quantity} {c.unit_symbol || c.unit_code}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Instant Unit Converter Engine */}
                            <div className="p-4 border border-blue-200 dark:border-blue-500/20 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                                    Instant Unit Converter Engine
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Quantity & From Unit</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="any"
                                                value={calcFromQty}
                                                onChange={e => setCalcFromQty(e.target.value)}
                                                className="w-1/2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                                            />
                                            <select
                                                value={calcFromUnit}
                                                onChange={e => setCalcFromUnit(e.target.value)}
                                                className="w-1/2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                                            >
                                                {Object.entries(UNIT_GROUPS).map(([cat, units]) => (
                                                    <optgroup key={cat} label={cat.toUpperCase()}>
                                                        {units.map(u => (
                                                            <option key={u.code} value={u.code}>{u.symbol}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="text-center pt-2">
                                        <ArrowRight size={16} className="text-blue-500 mx-auto" />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">To Target Unit</label>
                                        <select
                                            value={calcToUnit}
                                            onChange={e => setCalcToUnit(e.target.value)}
                                            className="w-full bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                                        >
                                            {Object.entries(UNIT_GROUPS).map(([cat, units]) => (
                                                <optgroup key={cat} label={cat.toUpperCase()}>
                                                    {units.map(u => (
                                                        <option key={u.code} value={u.code}>{u.symbol}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {calcError ? (
                                    <p className="text-xs text-red-500 font-semibold">{calcError}</p>
                                ) : calcResult !== null ? (
                                    <div className="px-3 py-2 bg-white dark:bg-[#161b22] border border-blue-200 dark:border-blue-500/30 rounded-lg flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Converted Value:</span>
                                        <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                                            {calcFromQty} {calcFromUnit} = {calcResult.toLocaleString('en-IN', { maximumFractionDigits: 6 })} {calcToUnit}
                                        </span>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }))}
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

export default ResourceConversionsTab;
