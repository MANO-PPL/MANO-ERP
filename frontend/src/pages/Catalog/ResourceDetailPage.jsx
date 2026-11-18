import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft,
    Package,
    Edit2,
    Trash2,
    Archive,
    RotateCcw,
    DollarSign,
    Calendar,
    History,
    Plus,
    Loader2,
    GitCompare,
    X
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import { showCatalogErrorToast } from './catalogErrors';
import { formatMoney, formatDatePlain, getTodayDateStr } from './catalogFormat';
import { customToast } from '../../utils/toast';
import ReasonModal from './ReasonModal';
import ChangeLogSection from './ChangeLogSection';

export default function ResourceDetailPage({
    resource: initialResource,
    scope = 'master',
    projectId = null,
    units = [],
    onBack,
    onResourceUpdated,
    onAction,
    onSync
}) {
    const [resource, setResource] = useState(initialResource);
    const [activeTab, setActiveTab] = useState('rates'); // 'rates' | 'packaging' | 'history'

    // Units cache
    const [availableUnits, setAvailableUnits] = useState(units || []);

    // ─── Edit Mode State ──────────────────────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(resource?.name || '');
    const [editBaseUnitId, setEditBaseUnitId] = useState(String(resource?.base_unit_id || ''));
    const [editDescription, setEditDescription] = useState(resource?.description || '');
    const [editRemarks, setEditRemarks] = useState(resource?.remarks || '');
    const [savingDetails, setSavingDetails] = useState(false);

    // ─── Rates State ──────────────────────────────────────────────────────────
    const [rates, setRates] = useState([]);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [rateInspectDate, setRateInspectDate] = useState(getTodayDateStr());

    // Add Rate Form State
    const [showAddRateForm, setShowAddRateForm] = useState(false);
    const [newRateValue, setNewRateValue] = useState('');
    const [newRateUnitId, setNewRateUnitId] = useState('');
    const [newRateFrom, setNewRateFrom] = useState(getTodayDateStr());
    const [newRateNote, setNewRateNote] = useState('');
    const [savingRate, setSavingRate] = useState(false);

    // Rate Modals (Correct / Remove)
    const [correctingRate, setCorrectingRate] = useState(null);
    const [correctRateValue, setCorrectRateValue] = useState('');
    const [correctRateFrom, setCorrectRateFrom] = useState('');
    const [correctRateTo, setCorrectRateTo] = useState('');
    const [correctRateNote, setCorrectRateNote] = useState('');
    const [isCorrectRateModalOpen, setIsCorrectRateModalOpen] = useState(false);

    const [removingRate, setRemovingRate] = useState(null);
    const [isRemoveRateModalOpen, setIsRemoveRateModalOpen] = useState(false);

    // ─── Conversions State ────────────────────────────────────────────────────
    const [conversions, setConversions] = useState([]);
    const [conversionsLoading, setConversionsLoading] = useState(false);

    // Add Conversion Form State
    const [showAddConvForm, setShowAddConvForm] = useState(false);
    const [fromUnitId, setFromUnitId] = useState('');
    const [toUnitId, setToUnitId] = useState('');
    const [convFactor, setConvFactor] = useState('');
    const [convReason, setConvReason] = useState('');
    const [savingConv, setSavingConv] = useState(false);

    const [removingConv, setRemovingConv] = useState(null);
    const [isRemoveConvModalOpen, setIsRemoveConvModalOpen] = useState(false);

    const todayStr = useMemo(() => getTodayDateStr(), []);

    // Load available units
    useEffect(() => {
        if (units && units.length > 0) setAvailableUnits(units);
        catalogApi.listUnits().then(fresh => {
            if (Array.isArray(fresh) && fresh.length > 0) setAvailableUnits(fresh);
        }).catch(() => {});
    }, [units]);

    // Refresh Resource details from server
    const reloadResource = async () => {
        if (!resource?.id) return;
        try {
            const list = await catalogApi.listResources({
                scope,
                projectId: scope === 'project' ? projectId : undefined
            });
            const updated = (list || []).find(r => r.id === resource.id);
            if (updated) {
                setResource(updated);
                setEditName(updated.name);
                setEditBaseUnitId(String(updated.base_unit_id));
                setEditDescription(updated.description || '');
                setEditRemarks(updated.remarks || '');
            }
        } catch (_) {}
    };

    // Load Rates
    const loadRates = async () => {
        if (!resource?.id) return;
        setRatesLoading(true);
        try {
            const data = await catalogApi.listRates(resource.id);
            setRates(data || []);
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to load rates');
        } finally {
            setRatesLoading(false);
        }
    };

    // Load Conversions
    const loadConversions = async () => {
        if (!resource?.id) return;
        setConversionsLoading(true);
        try {
            const data = await catalogApi.listConversions(resource.id);
            setConversions(data || []);
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to load packaging units');
        } finally {
            setConversionsLoading(false);
        }
    };

    useEffect(() => {
        if (resource?.id) {
            loadRates();
            loadConversions();
            if (resource.base_unit_id) {
                setNewRateUnitId(String(resource.base_unit_id));
                setToUnitId(String(resource.base_unit_id));
            }
        }
    }, [resource?.id]);

    // Active rate on today or selected inspect date
    const inspectedRate = useMemo(() => {
        if (!rates || rates.length === 0) return null;
        const targetDate = rateInspectDate || todayStr;
        return rates.find(r => {
            const from = formatDatePlain(r.effective_from);
            const to = r.effective_to ? formatDatePlain(r.effective_to) : null;
            return from <= targetDate && (!to || to >= targetDate);
        }) || null;
    }, [rates, rateInspectDate, todayStr]);

    const activeTodayRate = useMemo(() => {
        if (!rates || rates.length === 0) return null;
        return rates.find(r => {
            const from = formatDatePlain(r.effective_from);
            const to = r.effective_to ? formatDatePlain(r.effective_to) : null;
            return from <= todayStr && (!to || to >= todayStr);
        }) || null;
    }, [rates, todayStr]);

    // Primary Packaging Conversion (if any)
    const primaryPackaging = useMemo(() => {
        if (!conversions || conversions.length === 0) return null;
        return conversions[0];
    }, [conversions]);

    // ─── Save Resource Core Details ───────────────────────────────────────────
    const handleSaveDetails = async (e) => {
        e.preventDefault();
        const trimmedName = editName.trim();
        if (!trimmedName) {
            customToast.error('Resource name cannot be empty', 'Missing Name');
            return;
        }

        setSavingDetails(true);
        try {
            await catalogApi.updateResource(resource.id, {
                name: trimmedName,
                baseUnitId: Number(editBaseUnitId),
                description: editDescription.trim() || undefined,
                remarks: editRemarks.trim() || undefined
            });
            customToast.success('Resource updated', 'Updated');
            setIsEditing(false);
            await reloadResource();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to update resource');
        } finally {
            setSavingDetails(false);
        }
    };

    // ─── Rate Actions ─────────────────────────────────────────────────────────
    const handleAddRate = async (e) => {
        e.preventDefault();
        if (!newRateValue.trim() || !newRateUnitId || !newRateFrom) {
            customToast.error('Please specify rate value, unit, and effective date', 'Missing Fields');
            return;
        }

        setSavingRate(true);
        try {
            await catalogApi.setRate(resource.id, {
                rate: newRateValue.trim(),
                unitId: Number(newRateUnitId),
                effectiveFrom: newRateFrom,
                note: newRateNote.trim() || undefined
            });
            customToast.success('Rate saved', 'Rate Saved');
            setNewRateValue('');
            setNewRateNote('');
            setShowAddRateForm(false);
            await loadRates();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to add rate');
        } finally {
            setSavingRate(false);
        }
    };

    const handleConfirmCorrectRate = async (reason) => {
        if (!correctingRate) return;
        try {
            await catalogApi.correctRate(correctingRate.id, {
                patch: {
                    rate: correctRateValue.trim(),
                    effectiveFrom: correctRateFrom,
                    effectiveTo: correctRateTo || null,
                    note: correctRateNote.trim() || undefined
                },
                reason
            });
            customToast.success('Rate updated', 'Rate Updated');
            setIsCorrectRateModalOpen(false);
            setCorrectingRate(null);
            await loadRates();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to update rate');
            throw err;
        }
    };

    const handleConfirmRemoveRate = async (reason) => {
        if (!removingRate) return;
        try {
            await catalogApi.removeRate(removingRate.id, reason);
            customToast.success('Rate removed', 'Rate Removed');
            setIsRemoveRateModalOpen(false);
            setRemovingRate(null);
            await loadRates();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to remove rate');
            throw err;
        }
    };

    // ─── Conversion Actions ───────────────────────────────────────────────────
    const handleAddConversion = async (e) => {
        e.preventDefault();
        if (!fromUnitId || !toUnitId || !convFactor.trim()) {
            customToast.error('Please specify unit, target unit, and factor', 'Missing Fields');
            return;
        }
        if (fromUnitId === toUnitId) {
            customToast.error('Units must be different', 'Invalid Units');
            return;
        }

        setSavingConv(true);
        try {
            await catalogApi.setConversion(resource.id, {
                fromUnitId: Number(fromUnitId),
                toUnitId: Number(toUnitId),
                factor: convFactor.trim(),
                reason: convReason.trim() || undefined
            });
            customToast.success('Packaging rule saved', 'Saved');
            setConvFactor('');
            setConvReason('');
            setShowAddConvForm(false);
            await loadConversions();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to add packaging rule');
        } finally {
            setSavingConv(false);
        }
    };

    const handleConfirmRemoveConv = async (reason) => {
        if (!removingConv) return;
        try {
            await catalogApi.removeConversion(removingConv.id, reason);
            customToast.success('Packaging rule removed', 'Removed');
            setIsRemoveConvModalOpen(false);
            setRemovingConv(null);
            await loadConversions();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to remove packaging rule');
            throw err;
        }
    };

    const isBehind = scope === 'project' && resource.parent_id && Number(resource.master_version) > Number(resource.synced_version || 0);

    return (
        <div className="flex-1 min-h-0 flex flex-col space-y-4 animate-fade-in">
            {/* ─── SINGLE UNIFIED RESOURCE CARD (DETAILS & TABS IN ONE CARD) ─── */}
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 space-y-3">
                    {/* Header Row: Title & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            {onBack && (
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="p-1 rounded-md text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                    title="Back to Resources list"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                            )}
                            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                                {resource.name}
                            </h1>
                        </div>

                        {/* Top-Right Action Buttons */}
                        <div className="flex items-center gap-2">
                            {scope === 'project' && isBehind && onSync && (
                                <button
                                    type="button"
                                    onClick={() => onSync(resource)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer shadow-xs animate-pulse"
                                >
                                    <GitCompare size={12} /> Sync with Master
                                </button>
                            )}

                            {!isEditing && (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs"
                                >
                                    <Edit2 size={12} />
                                    Edit
                                </button>
                            )}

                            {onAction && !isEditing && (
                                resource.status === 'active' ? (
                                    <button
                                        type="button"
                                        onClick={() => onAction(resource, 'archive')}
                                        className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                        title="Archive Resource"
                                    >
                                        <Archive size={15} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onAction(resource, 'restore')}
                                        className="p-1 rounded text-gray-400 hover:text-teal-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                        title="Restore Resource"
                                    >
                                        <RotateCcw size={15} />
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    {/* View Mode vs Edit Mode */}
                    {!isEditing ? (
                        /* Unified 2-Column Horizontal Split with Vertically Stacked Data */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 pt-3 pb-2 border-t border-gray-100 dark:border-gh-border/50">
                            {/* Left Column */}
                            <div className="space-y-3.5">
                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Code
                                    </span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gh-subtle/80 px-2 py-0.5 rounded text-xs border border-gray-200 dark:border-gh-border inline-block">
                                        {resource.code}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Category
                                    </span>
                                    <span className="capitalize font-semibold text-gray-900 dark:text-gray-100 text-xs">
                                        {resource.kind}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Status
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        resource.status === 'active'
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                                    }`}>
                                        {resource.status}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Base Unit
                                    </span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-xs">
                                            {resource.base_unit_code || '—'}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            ({resource.base_unit_name || 'Standard Unit'})
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Description &amp; Specs
                                    </span>
                                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                        {resource.description || <span className="text-gray-400 italic">None specified</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-3.5">
                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Current Rate
                                    </span>
                                    {activeTodayRate ? (
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                            ₹ {formatMoney(activeTodayRate.rate)}{' '}
                                            <span className="text-[11px] font-normal text-gray-500">/ {activeTodayRate.unit_code}</span>
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">No rate active</span>
                                    )}
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Packaging
                                    </span>
                                    {primaryPackaging ? (
                                        <span className="font-mono font-bold text-purple-700 dark:text-purple-300 text-xs">
                                            1 {primaryPackaging.from_unit_code} = {Number(primaryPackaging.factor)} {primaryPackaging.to_unit_code}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">None</span>
                                    )}
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Version
                                    </span>
                                    <span className="font-mono text-gray-800 dark:text-gray-200 font-semibold text-xs">
                                        v{resource.version}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Scope
                                    </span>
                                    <span className="text-gray-800 dark:text-gray-200 font-semibold text-xs">
                                        {scope === 'master' ? 'Master Catalog' : 'Project Local'}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Remarks
                                    </span>
                                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                        {resource.remarks || <span className="text-gray-400 italic">None specified</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                    /* Seamless Inline Edit Form */
                    <form onSubmit={handleSaveDetails} className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Resource Name *
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Base Unit
                                </label>
                                <select
                                    value={editBaseUnitId}
                                    onChange={(e) => setEditBaseUnitId(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                >
                                    {availableUnits.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.code} &mdash; {u.name} ({u.category})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Description &amp; Specs
                                </label>
                                <textarea
                                    rows={2}
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Specifications, standard compliance..."
                                    className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Remarks
                                </label>
                                <textarea
                                    rows={2}
                                    value={editRemarks}
                                    onChange={(e) => setEditRemarks(e.target.value)}
                                    placeholder="Procurement or handling notes..."
                                    className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gh-border">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                disabled={savingDetails}
                                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-hover rounded-lg cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={savingDetails || !editName.trim()}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {savingDetails && <Loader2 size={13} className="animate-spin" />}
                                Save Changes
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* ─── TABS: RATES | PACKAGING | HISTORY (INSIDE SAME CARD) ───────── */}
            <div className="border-t border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-gh-subtle/20 px-5 pt-3 pb-0 border-b border-gray-200 dark:border-gh-border flex gap-6 select-none overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('rates')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
                            activeTab === 'rates'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <DollarSign size={14} />
                        Rates ({rates.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('packaging')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
                            activeTab === 'packaging'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <Package size={14} />
                        Packaging ({conversions.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
                            activeTab === 'history'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <History size={14} />
                        History
                    </button>
                </div>

                {/* ─── TAB 1: RATES ─────────────────────────────────────────── */}
                {activeTab === 'rates' && (
                    <div className="p-5 space-y-4">
                        {/* Compact Rate Inspector & Action Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gh-subtle/40 border border-gray-100 dark:border-gh-border text-xs">
                            <div className="flex items-center gap-2 font-mono">
                                <span className="text-gray-500 font-sans font-medium">Rate on:</span>
                                <input
                                    type="date"
                                    value={rateInspectDate}
                                    onChange={(e) => setRateInspectDate(e.target.value)}
                                    className="px-2 py-1 text-xs border rounded-md bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => setRateInspectDate(todayStr)}
                                    className="px-2 py-1 text-[11px] font-sans font-semibold text-blue-600 hover:underline cursor-pointer"
                                >
                                    Today
                                </button>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                {inspectedRate ? (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        ₹ {formatMoney(inspectedRate.rate)} / {inspectedRate.unit_code}
                                    </span>
                                ) : (
                                    <span className="text-gray-400 italic font-sans">No rate active</span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowAddRateForm(!showAddRateForm)}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
                            >
                                <Plus size={12} />
                                {showAddRateForm ? 'Close' : 'Add Rate'}
                            </button>
                        </div>

                        {/* Add Rate Form */}
                        {showAddRateForm && (
                            <form onSubmit={handleAddRate} className="p-4 rounded-xl border border-gray-200 dark:border-gh-border bg-gray-50/60 dark:bg-gh-subtle/30 space-y-3 animate-fade-in">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Rate (₹) *
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            value={newRateValue}
                                            onChange={(e) => setNewRateValue(e.target.value)}
                                            placeholder="e.g. 380.00"
                                            className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Unit *
                                        </label>
                                        <select
                                            value={newRateUnitId}
                                            onChange={(e) => setNewRateUnitId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                            required
                                        >
                                            {availableUnits.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.code} &mdash; {u.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Effective From *
                                        </label>
                                        <input
                                            type="date"
                                            value={newRateFrom}
                                            onChange={(e) => setNewRateFrom(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Note / Reference
                                        </label>
                                        <input
                                            type="text"
                                            value={newRateNote}
                                            onChange={(e) => setNewRateNote(e.target.value)}
                                            placeholder="e.g. Q1 Contract PO-892"
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddRateForm(false)}
                                        className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingRate || !newRateValue.trim()}
                                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer shadow-xs"
                                    >
                                        {savingRate && <Loader2 size={12} className="animate-spin" />}
                                        Save Rate
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Rate History Table */}
                        <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                    <tr>
                                        <th className="py-2 px-3.5">Status</th>
                                        <th className="py-2 px-3.5">Rate / Unit</th>
                                        <th className="py-2 px-3.5">Effective Window</th>
                                        <th className="py-2 px-3.5">Reference</th>
                                        <th className="py-2 px-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                    {ratesLoading ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-400">
                                                <Loader2 size={18} className="animate-spin mx-auto mb-1 text-blue-500" />
                                                Loading rates...
                                            </td>
                                        </tr>
                                    ) : rates.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                                                No rates recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        rates.map((r) => {
                                            const from = formatDatePlain(r.effective_from);
                                            const to = r.effective_to ? formatDatePlain(r.effective_to) : null;
                                            const isCurrent = from <= todayStr && (!to || to >= todayStr);
                                            const isFuture = from > todayStr;
                                            const isPast = to && to < todayStr;

                                            return (
                                                <tr key={r.id} className="hover:bg-gray-50/70 dark:hover:bg-gh-hover/30 transition-colors">
                                                    <td className="py-2.5 px-3.5">
                                                        {isCurrent && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                                Active
                                                            </span>
                                                        )}
                                                        {isFuture && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                                                Scheduled
                                                            </span>
                                                        )}
                                                        {isPast && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                                                Past
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 font-mono font-bold text-gray-900 dark:text-gray-100">
                                                        ₹ {formatMoney(r.rate)}{' '}
                                                        <span className="text-xs font-normal text-gray-500">
                                                            / {r.unit_code}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3.5 font-mono text-gray-600 dark:text-gray-300 text-xs">
                                                        {from} &rarr; {to || <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Present</span>}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 text-gray-600 dark:text-gray-400">
                                                        {r.note || <span className="italic text-gray-400">—</span>}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 text-right space-x-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setCorrectingRate(r);
                                                                setCorrectRateValue(String(r.rate));
                                                                setCorrectRateFrom(formatDatePlain(r.effective_from));
                                                                setCorrectRateTo(r.effective_to ? formatDatePlain(r.effective_to) : '');
                                                                setCorrectRateNote(r.note || '');
                                                                setIsCorrectRateModalOpen(true);
                                                            }}
                                                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setRemovingRate(r);
                                                                setIsRemoveRateModalOpen(true);
                                                            }}
                                                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-red-600 hover:underline cursor-pointer"
                                                        >
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── TAB 2: PACKAGING ─────────────────────────────────────── */}
                {activeTab === 'packaging' && (
                    <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                Trade Packaging Rules
                            </span>

                            <button
                                type="button"
                                onClick={() => setShowAddConvForm(!showAddConvForm)}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
                            >
                                <Plus size={12} />
                                {showAddConvForm ? 'Close' : 'Add Unit'}
                            </button>
                        </div>

                        {/* Add Conversion Form */}
                        {showAddConvForm && (
                            <form onSubmit={handleAddConversion} className="p-4 rounded-xl border border-gray-200 dark:border-gh-border bg-gray-50/60 dark:bg-gh-subtle/30 space-y-3 animate-fade-in">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Packaging Unit (From) *
                                        </label>
                                        <select
                                            value={fromUnitId}
                                            onChange={(e) => setFromUnitId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                            required
                                        >
                                            <option value="">Select unit...</option>
                                            {availableUnits.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.code} &mdash; {u.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Base Unit (To) *
                                        </label>
                                        <select
                                            value={toUnitId}
                                            onChange={(e) => setToUnitId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                            required
                                        >
                                            {availableUnits.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.code} &mdash; {u.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Quantity in Base Unit *
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0.0000000001"
                                            value={convFactor}
                                            onChange={(e) => setConvFactor(e.target.value)}
                                            placeholder="e.g. 50 (for 50 kg)"
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Packaging Note
                                        </label>
                                        <input
                                            type="text"
                                            value={convReason}
                                            onChange={(e) => setConvReason(e.target.value)}
                                            placeholder="e.g. 50 kg bag packaging"
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddConvForm(false)}
                                        className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingConv || !convFactor.trim() || !fromUnitId}
                                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer shadow-xs"
                                    >
                                        {savingConv && <Loader2 size={12} className="animate-spin" />}
                                        Save Packaging
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Conversions Table */}
                        <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                    <tr>
                                        <th className="py-2 px-3.5">Packaging Unit</th>
                                        <th className="py-2 px-3.5">Ratio to Base</th>
                                        <th className="py-2 px-3.5">Note</th>
                                        <th className="py-2 px-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                    {conversionsLoading ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-gray-400">
                                                <Loader2 size={18} className="animate-spin mx-auto mb-1 text-blue-500" />
                                                Loading packaging units...
                                            </td>
                                        </tr>
                                    ) : conversions.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-gray-400 italic">
                                                No packaging units declared for this resource.
                                            </td>
                                        </tr>
                                    ) : (
                                        conversions.map((c) => (
                                            <tr key={c.id} className="hover:bg-gray-50/70 dark:hover:bg-gh-hover/30 transition-colors">
                                                <td className="py-2.5 px-3.5 font-mono font-bold text-gray-900 dark:text-gray-100">
                                                    1 {c.from_unit_code}
                                                </td>
                                                <td className="py-2.5 px-3.5 font-mono text-gray-700 dark:text-gray-300">
                                                    = {Number(c.factor)} {c.to_unit_code}
                                                </td>
                                                <td className="py-2.5 px-3.5 text-gray-600 dark:text-gray-400">
                                                    {c.reason || <span className="italic text-gray-400">—</span>}
                                                </td>
                                                <td className="py-2.5 px-3.5 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setRemovingConv(c);
                                                            setIsRemoveConvModalOpen(true);
                                                        }}
                                                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                        title="Remove"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── TAB 3: HISTORY ───────────────────────────────────────── */}
                {activeTab === 'history' && (
                    <div className="p-5">
                        <ChangeLogSection
                            entity="resource"
                            entityId={resource.id}
                        />
                    </div>
                )}
            </div>

            {/* ─── AUDIT REASON MODALS ─────────────────────────────────────────── */}
            <ReasonModal
                isOpen={isCorrectRateModalOpen}
                title="Edit Rate"
                subtitle="Modifying historical rate records requires an audit reason."
                confirmText="Save Rate"
                onClose={() => {
                    setIsCorrectRateModalOpen(false);
                    setCorrectingRate(null);
                }}
                onConfirm={handleConfirmCorrectRate}
            />

            <ReasonModal
                isOpen={isRemoveRateModalOpen}
                title="Remove Rate"
                subtitle="Are you sure you want to remove this scheduled rate?"
                confirmText="Remove"
                confirmCls="bg-red-600 hover:bg-red-700 text-white"
                onClose={() => {
                    setIsRemoveRateModalOpen(false);
                    setRemovingRate(null);
                }}
                onConfirm={handleConfirmRemoveRate}
            />

            <ReasonModal
                isOpen={isRemoveConvModalOpen}
                title="Remove Packaging Rule"
                subtitle="Are you sure you want to remove this packaging conversion?"
                confirmText="Remove"
                confirmCls="bg-red-600 hover:bg-red-700 text-white"
                onClose={() => {
                    setIsRemoveConvModalOpen(false);
                    setRemovingConv(null);
                }}
                onConfirm={handleConfirmRemoveConv}
            />
        </div>
    );
}
