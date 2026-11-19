import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Clock,
    Plus,
    Edit2,
    Trash2,
    ArrowRightLeft,
    History,
    CheckCircle2,
    AlertCircle,
    Info,
    Calendar,
    Loader2
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import { showCatalogErrorToast } from './catalogErrors';
import { formatMoney, formatDatePlain, getTodayDateStr } from './catalogFormat';
import { customToast } from '../../utils/toast';
import ReasonModal from './ReasonModal';
import ChangeLogSection from './ChangeLogSection';

export default function ResourceDetailPanel({
    resource,
    units = [],
    onClose,
    onResourceUpdated,
    onEdit
}) {
    const [activeSection, setActiveSection] = useState('rates'); // 'rates' | 'conversions' | 'changelog'

    // Available Units (Maintained locally and refreshed on open)
    const [availableUnits, setAvailableUnits] = useState(units || []);

    useEffect(() => {
        if (units && units.length > 0) setAvailableUnits(units);
    }, [units]);

    useEffect(() => {
        if (resource?.id) {
            catalogApi.listUnits().then(data => {
                if (data && Array.isArray(data) && data.length > 0) {
                    setAvailableUnits(data);
                }
            }).catch(() => {});
        }
    }, [resource?.id]);

    const customUnits = availableUnits.filter(u => u.org_id !== null && u.org_id !== undefined);
    const standardUnits = availableUnits.filter(u => u.org_id === null || u.org_id === undefined);

    // Rates State
    const [rates, setRates] = useState([]);
    const [ratesLoading, setRatesLoading] = useState(true);
    const [newRateValue, setNewRateValue] = useState('');
    const [newRateUnitId, setNewRateUnitId] = useState('');
    const [newRateFrom, setNewRateFrom] = useState(getTodayDateStr());
    const [newRateNote, setNewRateNote] = useState('');
    const [savingRate, setSavingRate] = useState(false);

    // Rate Action Modals
    const [correctingRate, setCorrectingRate] = useState(null); // Rate object
    const [correctRateValue, setCorrectRateValue] = useState('');
    const [correctRateFrom, setCorrectRateFrom] = useState('');
    const [correctRateTo, setCorrectRateTo] = useState('');
    const [correctRateNote, setCorrectRateNote] = useState('');
    const [isCorrectModalOpen, setIsCorrectModalOpen] = useState(false);

    const [removingRate, setRemovingRate] = useState(null);
    const [isRemoveRateModalOpen, setIsRemoveRateModalOpen] = useState(false);

    // Conversions State
    const [conversions, setConversions] = useState([]);
    const [conversionsLoading, setConversionsLoading] = useState(true);
    const [fromUnitId, setFromUnitId] = useState('');
    const [toUnitId, setToUnitId] = useState('');
    const [conversionFactor, setConversionFactor] = useState('');
    const [conversionReason, setConversionReason] = useState('');
    const [savingConversion, setSavingConversion] = useState(false);

    const [removingConversion, setRemovingConversion] = useState(null);
    const [isRemoveConvModalOpen, setIsRemoveConvModalOpen] = useState(false);

    const todayStr = useMemo(() => getTodayDateStr(), []);

    // Load Rates
    const loadRates = async () => {
        if (!resource?.id) return;
        setRatesLoading(true);
        try {
            const data = await catalogApi.listRates(resource.id);
            // Sort timeline oldest to newest
            const sorted = (data || []).slice().sort((a, b) => a.effective_from.localeCompare(b.effective_from));
            setRates(sorted);
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
            showCatalogErrorToast(err, 'Failed to load packaging conversions');
        } finally {
            setConversionsLoading(false);
        }
    };

    useEffect(() => {
        if (resource?.id) {
            loadRates();
            loadConversions();
            // Default new rate unit to resource base unit
            if (resource.base_unit_id) {
                setNewRateUnitId(String(resource.base_unit_id));
                setToUnitId(String(resource.base_unit_id));
            }
        }
    }, [resource?.id]);

    if (!resource) return null;

    // Handle Add Rate
    const handleAddRate = async (e) => {
        e.preventDefault();
        if (!newRateValue.trim() || !newRateUnitId || !newRateFrom) {
            customToast.error('Please enter rate value, unit, and effective from date.', 'Missing Fields');
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
            customToast.success('Rate established successfully', 'Rate Saved');
            setNewRateValue('');
            setNewRateNote('');
            await loadRates();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to set rate');
        } finally {
            setSavingRate(false);
        }
    };

    // Handle Open Correct Rate
    const openCorrectRate = (rateRow) => {
        setCorrectingRate(rateRow);
        setCorrectRateValue(String(rateRow.rate));
        setCorrectRateFrom(formatDatePlain(rateRow.effective_from));
        setCorrectRateTo(rateRow.effective_to ? formatDatePlain(rateRow.effective_to) : '');
        setCorrectRateNote(rateRow.note || '');
        setIsCorrectModalOpen(true);
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
            customToast.success('Rate corrected with audit reason', 'Rate Corrected');
            setIsCorrectModalOpen(false);
            setCorrectingRate(null);
            await loadRates();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to correct rate');
            throw err;
        }
    };

    // Handle Open Remove Rate
    const openRemoveRate = (rateRow) => {
        setRemovingRate(rateRow);
        setIsRemoveRateModalOpen(true);
    };

    const handleConfirmRemoveRate = async (reason) => {
        if (!removingRate) return;
        try {
            await catalogApi.removeRate(removingRate.id, reason);
            customToast.success('Scheduled rate removed', 'Rate Removed');
            setIsRemoveRateModalOpen(false);
            setRemovingRate(null);
            await loadRates();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to remove rate');
            throw err;
        }
    };

    // Handle Add Conversion
    const handleAddConversion = async (e) => {
        e.preventDefault();
        if (!fromUnitId || !toUnitId || !conversionFactor.trim()) {
            customToast.error('Please specify source unit, target unit, and factor.', 'Missing Fields');
            return;
        }

        if (fromUnitId === toUnitId) {
            customToast.error('Source unit and target unit must be different.', 'Invalid Units');
            return;
        }

        setSavingConversion(true);
        try {
            await catalogApi.setConversion(resource.id, {
                fromUnitId: Number(fromUnitId),
                toUnitId: Number(toUnitId),
                factor: conversionFactor.trim(),
                reason: conversionReason.trim() || undefined
            });
            customToast.success('Packaging conversion rule added', 'Conversion Saved');
            setConversionFactor('');
            setConversionReason('');
            await loadConversions();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to set conversion');
        } finally {
            setSavingConversion(false);
        }
    };

    const handleConfirmRemoveConversion = async (reason) => {
        if (!removingConversion) return;
        try {
            await catalogApi.removeConversion(removingConversion.id, reason);
            customToast.success('Conversion rule removed', 'Removed');
            setIsRemoveConvModalOpen(false);
            setRemovingConversion(null);
            await loadConversions();
            if (onResourceUpdated) onResourceUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to remove conversion');
            throw err;
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-gh-border shadow-2xl flex flex-col animate-slide-left">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-gh-subtle/50">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
                            {resource.code}
                        </span>
                        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {resource.name}
                        </h2>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Kind: <span className="capitalize font-medium text-gray-700 dark:text-gray-200">{resource.kind}</span> &bull; Base Unit: <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{resource.base_unit_code || '—'}</span> &bull; Scope: <span className="font-medium text-gray-700 dark:text-gray-200">{resource.project_id ? `Project #${resource.project_id}` : 'Master Catalog'}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {onEdit && (
                        <button
                            type="button"
                            onClick={() => onEdit(resource)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                            title="Edit Resource Details & Rates"
                        >
                            <Edit2 size={13} />
                            Edit
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gh-hover cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex border-b border-gray-200 dark:border-gh-border px-6 bg-white dark:bg-[#161b22]">
                <button
                    onClick={() => setActiveSection('rates')}
                    className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                        activeSection === 'rates'
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <Clock size={15} />
                    Rates Timeline ({rates.length})
                </button>
                <button
                    onClick={() => setActiveSection('conversions')}
                    className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                        activeSection === 'conversions'
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <ArrowRightLeft size={15} />
                    Packaging Conversions ({conversions.length})
                </button>
                <button
                    onClick={() => setActiveSection('changelog')}
                    className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                        activeSection === 'changelog'
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <History size={15} />
                    Change Log
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* ─── SECTION 1: RATES ─────────────────────────────────────────── */}
                {activeSection === 'rates' && (
                    <div className="space-y-6">
                        {/* Add Rate Form */}
                        <div className="bg-gray-50 dark:bg-gh-subtle p-4 rounded-xl border border-gray-200 dark:border-gh-border">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                                <Plus size={14} className="text-blue-500" />
                                Add Rate From Date
                            </h4>
                            <form onSubmit={handleAddRate} className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Rate Value <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newRateValue}
                                            onChange={(e) => setNewRateValue(e.target.value)}
                                            placeholder="e.g. 380.0000"
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Pricing Unit <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={newRateUnitId}
                                            onChange={(e) => setNewRateUnitId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 font-mono"
                                            required
                                        >
                                            <option value="">Select Unit</option>
                                            {customUnits.length > 0 && (
                                                <optgroup label="⭐ Custom Operational Units">
                                                    {customUnits.map((u) => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.code} ({u.name})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            <optgroup label="Standard System Units">
                                                {standardUnits.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.code} ({u.name})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Effective From <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={newRateFrom}
                                            onChange={(e) => setNewRateFrom(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={newRateNote}
                                        onChange={(e) => setNewRateNote(e.target.value)}
                                        placeholder="Optional note / supplier contract reference..."
                                        className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    />
                                    <button
                                        type="submit"
                                        disabled={savingRate || !newRateValue.trim() || !newRateUnitId || !newRateFrom}
                                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                                    >
                                        {savingRate && <Loader2 size={12} className="animate-spin" />}
                                        Save Rate
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Rates Timeline */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center justify-between">
                                <span>Rate Period Ledger (Oldest to Newest)</span>
                                <span className="text-[11px] font-normal text-gray-500">
                                    Green highlight indicates active rate as of today ({todayStr})
                                </span>
                            </h4>

                            {ratesLoading ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Loader2 size={20} className="animate-spin mx-auto mb-1 text-blue-500" />
                                    <span className="text-xs">Loading rates ledger...</span>
                                </div>
                            ) : rates.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 bg-gray-50 dark:bg-gh-subtle rounded-xl border border-dashed border-gray-300 dark:border-gh-border text-xs">
                                    No rates have been defined for this resource yet.
                                </div>
                            ) : (
                                <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                            <tr>
                                                <th className="py-2.5 px-3">Effective Period</th>
                                                <th className="py-2.5 px-3">Rate</th>
                                                <th className="py-2.5 px-3">Unit</th>
                                                <th className="py-2.5 px-3">Note</th>
                                                <th className="py-2.5 px-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                            {rates.map((r) => {
                                                const fromDate = formatDatePlain(r.effective_from);
                                                const toDate = r.effective_to ? formatDatePlain(r.effective_to) : 'Open-ended';
                                                const isCurrent = fromDate <= todayStr && (!r.effective_to || formatDatePlain(r.effective_to) >= todayStr);
                                                const isPast = r.effective_to && formatDatePlain(r.effective_to) < todayStr;
                                                const isFuture = fromDate > todayStr;

                                                return (
                                                    <tr
                                                        key={r.id}
                                                        className={`transition-colors ${
                                                            isCurrent
                                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/20 font-medium'
                                                                : 'hover:bg-gray-50 dark:hover:bg-gh-hover/30'
                                                        }`}
                                                    >
                                                        <td className="py-2.5 px-3">
                                                            <div className="flex items-center gap-1.5">
                                                                {isCurrent && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shrink-0">
                                                                        Current
                                                                    </span>
                                                                )}
                                                                <span className="font-mono text-gray-900 dark:text-gray-100">
                                                                    {fromDate} &rarr; {toDate}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono font-semibold text-gray-900 dark:text-gray-100">
                                                            ₹ {formatMoney(r.rate)}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-400">
                                                            {r.unit_code || '—'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                                            {r.note || '—'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right space-x-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => openCorrectRate(r)}
                                                                className="px-2 py-1 text-[11px] rounded font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                                                title="Correct rate value or dates (Reason required)"
                                                            >
                                                                Correct
                                                            </button>
                                                            {isFuture ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openRemoveRate(r)}
                                                                    className="px-2 py-1 text-[11px] rounded font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                                    title="Remove scheduled future rate"
                                                                >
                                                                    Remove
                                                                </button>
                                                            ) : (
                                                                <span
                                                                    className="inline-block px-2 py-1 text-[11px] text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                                                    title="Past and active rates cannot be deleted as they preserve historical audit integrity. Use Correct instead."
                                                                >
                                                                    Remove
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── SECTION 2: CONVERSIONS ───────────────────────────────────── */}
                {activeSection === 'conversions' && (
                    <div className="space-y-6">
                        {/* Add Conversion Form */}
                        <div className="bg-gray-50 dark:bg-gh-subtle p-4 rounded-xl border border-gray-200 dark:border-gh-border">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                                <Plus size={14} className="text-blue-500" />
                                Add Packaging Conversion Rule
                            </h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                                Formula: 1 [Source Unit] = [Factor] &times; [Target Unit] (e.g. 1 bag = 50 kg).
                            </p>
                            <form onSubmit={handleAddConversion} className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            1 &times; Source Unit <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={fromUnitId}
                                            onChange={(e) => setFromUnitId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 font-mono"
                                            required
                                        >
                                            <option value="">Select Unit (e.g. bag)</option>
                                            {customUnits.length > 0 && (
                                                <optgroup label="⭐ Custom Operational Units">
                                                    {customUnits.map((u) => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.code} ({u.name})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            <optgroup label="Standard System Units">
                                                {standardUnits.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.code} ({u.name})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Factor <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={conversionFactor}
                                            onChange={(e) => setConversionFactor(e.target.value)}
                                            placeholder="e.g. 50.0000"
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Target Unit <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={toUnitId}
                                            onChange={(e) => setToUnitId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 font-mono"
                                            required
                                        >
                                            <option value="">Select Unit (e.g. kg)</option>
                                            {customUnits.length > 0 && (
                                                <optgroup label="⭐ Custom Operational Units">
                                                    {customUnits.map((u) => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.code} ({u.name})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            <optgroup label="Standard System Units">
                                                {standardUnits.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.code} ({u.name})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={conversionReason}
                                        onChange={(e) => setConversionReason(e.target.value)}
                                        placeholder="Reason (e.g. Standard 50kg cement bag packaging)..."
                                        className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    />
                                    <button
                                        type="submit"
                                        disabled={savingConversion || !fromUnitId || !toUnitId || !conversionFactor.trim()}
                                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                                    >
                                        {savingConversion && <Loader2 size={12} className="animate-spin" />}
                                        Save Rule
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Conversions List */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3">
                                Active Packaging Conversions
                            </h4>
                            {conversionsLoading ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Loader2 size={20} className="animate-spin mx-auto mb-1 text-blue-500" />
                                    <span className="text-xs">Loading conversions...</span>
                                </div>
                            ) : conversions.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 bg-gray-50 dark:bg-gh-subtle rounded-xl border border-dashed border-gray-300 dark:border-gh-border text-xs">
                                    No packaging conversions configured for this resource.
                                </div>
                            ) : (
                                <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                            <tr>
                                                <th className="py-2.5 px-3">Rule Definition</th>
                                                <th className="py-2.5 px-3">Factor</th>
                                                <th className="py-2.5 px-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                            {conversions.map((c) => (
                                                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gh-hover/30">
                                                    <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100 font-mono">
                                                        1 {c.from_unit_code} = {c.factor} {c.to_unit_code}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-400">
                                                        {c.factor}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setRemovingConversion(c);
                                                                setIsRemoveConvModalOpen(true);
                                                            }}
                                                            className="text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                                                        >
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── SECTION 3: CHANGE LOG ────────────────────────────────────── */}
                {activeSection === 'changelog' && (
                    <ChangeLogSection entity="resource" entityId={resource.id} />
                )}
            </div>

            {/* Correct Rate Modal */}
            {isCorrectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl p-6">
                        <button
                            onClick={() => setIsCorrectModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={18} />
                        </button>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                            Correct Rate Period
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Adjusting rate values or dates requires a mandatory audit reason.
                        </p>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const rsn = e.target.elements.reason.value.trim();
                                if (!rsn) {
                                    customToast.error('Audit reason is required', 'Reason Required');
                                    return;
                                }
                                handleConfirmCorrectRate(rsn);
                            }}
                            className="space-y-3"
                        >
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Rate Value <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={correctRateValue}
                                    onChange={(e) => setCorrectRateValue(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Effective From <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={correctRateFrom}
                                        onChange={(e) => setCorrectRateFrom(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Effective To
                                    </label>
                                    <input
                                        type="date"
                                        value={correctRateTo}
                                        onChange={(e) => setCorrectRateTo(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Note
                                </label>
                                <input
                                    type="text"
                                    value={correctRateNote}
                                    onChange={(e) => setCorrectRateNote(e.target.value)}
                                    placeholder="Optional note..."
                                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Mandatory Audit Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    name="reason"
                                    rows={2}
                                    placeholder="Enter the reason for correcting this rate..."
                                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCorrectModalOpen(false)}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gh-hover rounded-lg hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    Submit Correction
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Remove Rate Reason Modal */}
            <ReasonModal
                isOpen={isRemoveRateModalOpen}
                title="Remove Scheduled Rate"
                subtitle={`Removing scheduled rate ₹${formatMoney(removingRate?.rate)} / ${removingRate?.unit_code} from ${formatDatePlain(removingRate?.effective_from)}`}
                confirmText="Remove Rate"
                confirmCls="bg-red-600 hover:bg-red-700 text-white"
                onClose={() => setIsRemoveRateModalOpen(false)}
                onConfirm={handleConfirmRemoveRate}
            />

            {/* Remove Conversion Reason Modal */}
            <ReasonModal
                isOpen={isRemoveConvModalOpen}
                title="Remove Conversion Rule"
                subtitle={`Removing packaging conversion 1 ${removingConversion?.from_unit_code} = ${removingConversion?.factor} ${removingConversion?.to_unit_code}`}
                confirmText="Remove Rule"
                confirmCls="bg-red-600 hover:bg-red-700 text-white"
                onClose={() => setIsRemoveConvModalOpen(false)}
                onConfirm={handleConfirmRemoveConversion}
            />
        </div>
    );
}

