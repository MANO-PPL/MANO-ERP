import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Calculator,
    Layers,
    Plus,
    Edit2,
    Trash2,
    History,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    Loader2,
    FileText,
    Percent
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import catalogCache from './catalogCache';
import { showCatalogErrorToast } from './catalogErrors';
import { formatMoney, formatQuantity, formatDatePlain, getTodayDateStr } from './catalogFormat';
import { customToast } from '../../utils/toast';
import ReasonModal from './ReasonModal';
import ChangeLogSection from './ChangeLogSection';

export const PACKAGING_UNIT_CODES = new Set([
    'bag', 'bundle', 'trip', 'load', 'set', 'truck', 'tank', 'drum',
    'tin', 'pail', 'pallet', 'crate', 'carton', 'canister', 'box',
    'box10', 'box50', 'box100', 'cup', 'tbsp', 'tsp', 'bottle',
    'pack', 'packet', 'roll', 'sheet', 'coil', 'barrel', 'bale'
]);

export default function ActivityDetailView({
    activity,
    scope = 'master',
    projectId = null,
    units = [],
    onClose,
    onActivityUpdated
}) {
    const [activeSection, setActiveSection] = useState('calculator'); // 'calculator' | 'norms' | 'changelog'

    // Norms State
    const [norms, setNorms] = useState([]);
    const [normsLoading, setNormsLoading] = useState(false);

    // Available resources for norm picker (same scope, active only)
    const [availableResources, setAvailableResources] = useState([]);

    // Add Norm Form
    const [normResId, setNormResId] = useState('');
    const [normQty, setNormQty] = useState('');
    const [normUnitId, setNormUnitId] = useState('');
    const [normWastagePct, setNormWastagePct] = useState('0');
    const [normFrom, setNormFrom] = useState(getTodayDateStr());
    const [normNote, setNormNote] = useState('');
    const [savingNorm, setSavingNorm] = useState(false);

    // Norm Actions (Correct / Remove)
    const [correctingNorm, setCorrectingNorm] = useState(null);
    const [correctQty, setCorrectQty] = useState('');
    const [correctUnitId, setCorrectUnitId] = useState('');
    const [correctWastagePct, setCorrectWastagePct] = useState('0');
    const [correctFrom, setCorrectFrom] = useState('');
    const [correctTo, setCorrectTo] = useState('');
    const [correctNote, setCorrectNote] = useState('');
    const [isCorrectNormModalOpen, setIsCorrectNormModalOpen] = useState(false);

    const [removingNorm, setRemovingNorm] = useState(null);
    const [isRemoveNormModalOpen, setIsRemoveNormModalOpen] = useState(false);

    // Dynamic Cost & Usage Calculator State
    const [calcDate, setCalcDate] = useState(getTodayDateStr());
    const [calcQty, setCalcQty] = useState('1');
    const [costData, setCostData] = useState(null);
    const [usageData, setUsageData] = useState(null);
    const [calculating, setCalculating] = useState(false);

    // Load available resources for picker (same scope, active only)
    useEffect(() => {
        const fetchScopeResources = async () => {
            try {
                const cached = catalogCache.getResources(scope, projectId);
                if (cached) {
                    setAvailableResources(cached.filter(r => r.status === 'active'));
                    return;
                }
                const list = await catalogApi.listResources({
                    scope,
                    projectId: scope === 'project' ? projectId : undefined,
                    status: 'active'
                });
                setAvailableResources(list || []);
            } catch (err) {
                console.error('Failed to load resources for norm picker:', err);
            }
        };
        fetchScopeResources();
    }, [scope, projectId]);

    // Load Norms
    const loadNorms = async () => {
        if (!activity?.id) return;
        setNormsLoading(true);
        try {
            const data = await catalogApi.getNorms(activity.id);
            setNorms(data || []);
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to load composition norms');
        } finally {
            setNormsLoading(false);
        }
    };

    // Conversions for selected resource (to enable packaging units in norms)
    const [resourceConversions, setResourceConversions] = useState([]);

    const selectedNormResource = useMemo(() => {
        return availableResources.find(r => String(r.id) === String(normResId)) || null;
    }, [availableResources, normResId]);

    // Active resource for the Correct Norm modal
    const correctingNormResource = useMemo(() => {
        if (!correctingNorm) return null;
        return availableResources.find(r => Number(r.id) === Number(correctingNorm.resource_id)) || null;
    }, [availableResources, correctingNorm]);

    // Helper to extract physical metric units and packaging conversions for any resource
    const getResourceCompatibleUnits = (res, conversionsList) => {
        if (!res || !units || units.length === 0) {
            return { physicalMetricUnits: [], resourcePackagingUnits: [] };
        }

        const baseCat = res.base_unit_category;
        const baseUnitId = Number(res.base_unit_id);

        // 1. All real physical metric units belonging to the resource's physical dimension
        const physicalMetricUnits = units.filter(u => {
            if (Number(u.id) === baseUnitId) return true;
            return u.category === baseCat && !PACKAGING_UNIT_CODES.has(u.code.toLowerCase());
        });

        // 2. Resource packaging conversion units (active trade/container rules)
        const convUnitMap = new Map();
        (conversionsList || []).forEach(c => {
            const fid = Number(c.from_unit_id);
            const tid = Number(c.to_unit_id);
            if (tid === baseUnitId || c.to_unit_category === baseCat) {
                convUnitMap.set(fid, `1 ${c.from_unit_code} = ${Number(c.factor)} ${c.to_unit_code}`);
            } else if (fid === baseUnitId || c.from_unit_category === baseCat) {
                convUnitMap.set(tid, `1 ${c.from_unit_code} = ${Number(c.factor)} ${c.to_unit_code}`);
            }
        });

        const resourcePackagingUnits = [];
        units.forEach(u => {
            const uid = Number(u.id);
            if (convUnitMap.has(uid) && uid !== baseUnitId) {
                resourcePackagingUnits.push({
                    ...u,
                    ruleText: convUnitMap.get(uid)
                });
            }
        });

        return { physicalMetricUnits, resourcePackagingUnits };
    };

    const { physicalMetricUnits, resourcePackagingUnits } = useMemo(() => {
        return getResourceCompatibleUnits(selectedNormResource, resourceConversions);
    }, [selectedNormResource, units, resourceConversions]);

    const correctingCompatibleUnits = useMemo(() => {
        return getResourceCompatibleUnits(correctingNormResource, resourceConversions);
    }, [correctingNormResource, units, resourceConversions]);

    // Run Dynamic Calculation (Cost & Expected Usage)
    const runCalculation = async (asOfDate, workQty) => {
        if (!activity?.id) return;
        setCalculating(true);
        const targetDate = asOfDate || getTodayDateStr();
        const targetQty = workQty || '1';
        try {
            const [cData, uData] = await Promise.all([
                catalogApi.computeActivityCost(activity.id, targetDate),
                catalogApi.expectedUsage(activity.id, targetQty, targetDate)
            ]);
            setCostData(cData);
            setUsageData(uData);
        } catch (err) {
            showCatalogErrorToast(err, 'Cost computation failed');
        } finally {
            setCalculating(false);
        }
    };

    useEffect(() => {
        if (activity?.id) {
            loadNorms();
            runCalculation(calcDate || getTodayDateStr(), calcQty || '1');
        }
    }, [activity?.id]);

    // Auto-update calculation when calcDate or calcQty changes
    const handleRecalculate = (e) => {
        e.preventDefault();
        runCalculation(calcDate, calcQty);
    };

    // When resource selected in Add Norm, default unit to that resource's base_unit_id and load packaging conversions
    const handleNormResourceChange = async (resId) => {
        setNormResId(resId);
        setResourceConversions([]);
        const res = availableResources.find(r => String(r.id) === String(resId));
        if (res?.base_unit_id) {
            setNormUnitId(String(res.base_unit_id));
        }
        if (resId) {
            try {
                const convs = await catalogApi.listConversions(resId);
                setResourceConversions(convs || []);
            } catch (_) {
                setResourceConversions([]);
            }
        }
    };

    // Add Norm
    const handleAddNorm = async (e) => {
        e.preventDefault();
        if (!normResId || !normQty.trim() || !normUnitId || !normFrom) {
            customToast.error('Please select resource, quantity, unit, and effective date.', 'Missing Fields');
            return;
        }

        setSavingNorm(true);
        try {
            await catalogApi.setNorm(activity.id, {
                resourceId: Number(normResId),
                qtyPerUnit: normQty.trim(),
                unitId: Number(normUnitId),
                effectiveFrom: normFrom,
                note: normNote.trim() || undefined,
                wastagePct: normWastagePct.trim() || '0'
            });
            customToast.success('Composition norm added', 'Norm Saved');
            setNormQty('');
            setNormNote('');
            setNormWastagePct('0');
            await loadNorms();
            await runCalculation(calcDate, calcQty);
            if (onActivityUpdated) onActivityUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to add norm');
        } finally {
            setSavingNorm(false);
        }
    };

    // Open Correct Norm Modal
    const openCorrectNorm = async (normRow) => {
        setCorrectingNorm(normRow);
        setCorrectQty(String(normRow.qty_per_unit));
        setCorrectUnitId(String(normRow.unit_id));
        setCorrectWastagePct(String(normRow.wastage_pct ?? '0'));
        setCorrectFrom(formatDatePlain(normRow.effective_from));
        setCorrectTo(normRow.effective_to ? formatDatePlain(normRow.effective_to) : '');
        setCorrectNote(normRow.note || '');
        setIsCorrectNormModalOpen(true);
        if (normRow.resource_id) {
            try {
                const convs = await catalogApi.listConversions(normRow.resource_id);
                setResourceConversions(convs || []);
            } catch (_) {}
        }
    };

    const handleConfirmCorrectNorm = async (reason) => {
        if (!correctingNorm) return;
        try {
            await catalogApi.correctNorm(correctingNorm.id, {
                patch: {
                    qtyPerUnit: correctQty.trim(),
                    unitId: Number(correctUnitId),
                    wastagePct: correctWastagePct.trim(),
                    effectiveFrom: correctFrom,
                    effectiveTo: correctTo || null,
                    note: correctNote.trim() || undefined
                },
                reason
            });
            customToast.success('Norm line corrected with audit reason', 'Norm Corrected');
            setIsCorrectNormModalOpen(false);
            setCorrectingNorm(null);
            await loadNorms();
            await runCalculation(calcDate, calcQty);
            if (onActivityUpdated) onActivityUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to correct norm');
            throw err;
        }
    };

    // Open Remove Norm Modal
    const openRemoveNorm = (normRow) => {
        setRemovingNorm(normRow);
        setIsRemoveNormModalOpen(true);
    };

    const handleConfirmRemoveNorm = async (reason) => {
        if (!removingNorm) return;
        try {
            await catalogApi.removeNorm(removingNorm.id, reason);
            customToast.success('Norm removed', 'Norm Removed');
            setIsRemoveNormModalOpen(false);
            setRemovingNorm(null);
            await loadNorms();
            await runCalculation(calcDate, calcQty);
            if (onActivityUpdated) onActivityUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to remove norm');
            throw err;
        }
    };

    if (!activity) return null;

    return (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-3xl bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-gh-border shadow-2xl flex flex-col animate-slide-left">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-gh-subtle/50">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
                            {activity.code}
                        </span>
                        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {activity.name}
                        </h2>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Output Unit: <span className="font-mono font-medium text-gray-700 dark:text-gray-200">{activity.output_unit_code || '—'}</span> &bull; Scope: <span className="font-medium text-gray-700 dark:text-gray-200">{activity.project_id ? `Project #${activity.project_id}` : 'Master Catalog'}</span>
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gh-hover cursor-pointer"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex border-b border-gray-200 dark:border-gh-border px-6 bg-white dark:bg-[#161b22]">
                <button
                    onClick={() => setActiveSection('calculator')}
                    className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                        activeSection === 'calculator'
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <Calculator size={15} />
                    Cost & Usage Calculator
                </button>
                <button
                    onClick={() => setActiveSection('norms')}
                    className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                        activeSection === 'norms'
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <Layers size={15} />
                    Composition Norms ({norms.length})
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
                {/* ─── SECTION 1: COST & USAGE CALCULATOR ──────────────────────── */}
                {activeSection === 'calculator' && (
                    <div className="space-y-6">
                        {/* Interactive Calculator Input Bar */}
                        <form onSubmit={handleRecalculate} className="bg-gray-50 dark:bg-gh-subtle p-4 rounded-xl border border-gray-200 dark:border-gh-border">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            As-of Calculation Date
                                        </label>
                                        <input
                                            type="date"
                                            value={calcDate}
                                            onChange={(e) => {
                                                setCalcDate(e.target.value);
                                                runCalculation(e.target.value, calcQty);
                                            }}
                                            className="px-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Planned Output Quantity ({activity.output_unit_code || 'unit'})
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={calcQty}
                                            onChange={(e) => {
                                                setCalcQty(e.target.value);
                                                runCalculation(calcDate, e.target.value);
                                            }}
                                            className="w-32 px-3 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="submit"
                                        disabled={calculating}
                                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                                    >
                                        {calculating ? 'Computing...' : 'Recalculate'}
                                    </button>
                                </div>
                            </div>
                        </form>

                        {/* Cost Summary Banner */}
                        {costData && (
                            <div className={`p-4 rounded-xl border ${
                                costData.incomplete
                                    ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                                    : 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            Dynamic Computed Cost (Unit Rate)
                                        </span>
                                        <div className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 mt-0.5">
                                            ₹ {formatMoney(costData.total)}{' '}
                                            <span className="text-xs font-normal text-gray-500">
                                                / {costData.outputUnitCode}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        {costData.incomplete ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                                                <AlertTriangle size={14} /> Incomplete Rates
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
                                                <CheckCircle2 size={14} /> Fully Priced
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Warnings if missing rates */}
                                {costData.warnings && costData.warnings.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60 space-y-1">
                                        {costData.warnings.map((w, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                                                <AlertTriangle size={13} className="shrink-0" />
                                                <span>{w.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Unit Cost Breakdown Table */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                                <span>Per-Unit Cost Breakdown (Norm &times; Wastage &times; Rate)</span>
                                <span className="text-[11px] font-normal text-gray-500">
                                    Date: {calcDate}
                                </span>
                            </h4>

                            <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                        <tr>
                                            <th className="py-2.5 px-3">Resource</th>
                                            <th className="py-2.5 px-3 font-mono">Net Qty</th>
                                            <th className="py-2.5 px-3 font-mono">Wastage %</th>
                                            <th className="py-2.5 px-3 font-mono">Gross Qty</th>
                                            <th className="py-2.5 px-3 font-mono">Rate (₹)</th>
                                            <th className="py-2.5 px-3 font-mono text-right">Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                        {costData?.lines && costData.lines.length > 0 ? (
                                            costData.lines.map((ln, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gh-hover/30">
                                                    <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                        <div>{ln.resourceName}</div>
                                                        <span className="font-mono text-[11px] text-gray-400">{ln.resourceCode}</span>
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono">
                                                        {formatQuantity(ln.netQty || ln.qty)} {ln.unitCode}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">
                                                        {ln.wastagePct ?? 0}%
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono font-medium text-gray-800 dark:text-gray-200">
                                                        {formatQuantity(ln.grossQty)} {ln.unitCode}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono">
                                                        {ln.rate !== null && ln.rate !== undefined ? (
                                                            <span>₹ {formatMoney(ln.rate)}</span>
                                                        ) : (
                                                            <span className="text-amber-600 dark:text-amber-400 italic">No rate</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono font-semibold text-right text-gray-900 dark:text-gray-100">
                                                        {ln.amount !== null && ln.amount !== undefined ? (
                                                            <span>₹ {formatMoney(ln.amount)}</span>
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="py-6 text-center text-gray-400 italic">
                                                    No norms defined for this activity as of {calcDate}.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {costData?.lines && costData.lines.length > 0 && (
                                        <tfoot className="bg-gray-50 dark:bg-gh-subtle font-bold border-t border-gray-200 dark:border-gh-border text-gray-900 dark:text-gray-100">
                                            <tr>
                                                <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px]">
                                                    Total Unit Cost:
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-right text-sm text-blue-600 dark:text-blue-400">
                                                    ₹ {formatMoney(costData.total)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>

                        {/* Expected Resource Usage (BOM Generator) */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                                <span>Bill of Materials (BOM) &bull; Planned Output: {calcQty} {activity.output_unit_code}</span>
                                <span className="text-[11px] font-normal text-gray-500">
                                    From /expected-usage
                                </span>
                            </h4>

                            <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                        <tr>
                                            <th className="py-2.5 px-3">Resource</th>
                                            <th className="py-2.5 px-3 font-mono">Net Needed</th>
                                            <th className="py-2.5 px-3 font-mono">Wastage %</th>
                                            <th className="py-2.5 px-3 font-mono">Wastage Allowance</th>
                                            <th className="py-2.5 px-3 font-mono font-bold">Gross Total Required</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                        {usageData?.items && usageData.items.length > 0 ? (
                                            usageData.items.map((it, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gh-hover/30">
                                                    <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                        <div>{it.resourceName}</div>
                                                        <span className="font-mono text-[11px] text-gray-400">{it.resourceCode}</span>
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono">
                                                        {formatQuantity(it.netQty)} {it.baseUnitCode}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">
                                                        {it.wastagePct ?? 0}%
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-gray-500">
                                                        +{formatQuantity(it.allowanceQty)} {it.baseUnitCode}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                                                        {formatQuantity(it.grossQty)} {it.baseUnitCode}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-gray-400 italic">
                                                    No usage items generated.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── SECTION 2: COMPOSITION NORMS ────────────────────────────── */}
                {activeSection === 'norms' && (
                    <div className="space-y-6">
                        {/* Add Norm Form */}
                        <div className="bg-gray-50 dark:bg-gh-subtle p-4 rounded-xl border border-gray-200 dark:border-gh-border">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                                <Plus size={14} className="text-blue-500" />
                                Add Composition Norm Line
                            </h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                                Specifies how much resource is required per 1 {activity.output_unit_code || 'unit'} of output.
                            </p>
                            <form onSubmit={handleAddNorm} className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Resource ({scope === 'project' ? `Project #${projectId}` : 'Master Scope'}, Active Only) <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={normResId}
                                            onChange={(e) => handleNormResourceChange(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        >
                                            <option value="">Select Resource...</option>
                                            {availableResources.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.code} - {r.name} ({r.kind})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Effective From <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={normFrom}
                                            onChange={(e) => setNormFrom(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Qty Per Output Unit <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={normQty}
                                            onChange={(e) => setNormQty(e.target.value)}
                                            placeholder="e.g. 0.4500"
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Norm Unit <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={normUnitId}
                                            onChange={(e) => setNormUnitId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 font-mono disabled:opacity-50"
                                            required
                                            disabled={!selectedNormResource}
                                        >
                                            {!selectedNormResource ? (
                                                <option value="">Select a resource first...</option>
                                            ) : (
                                                <>
                                                    <option value="">Select Unit</option>
                                                    {physicalMetricUnits.length > 0 && (
                                                        <optgroup label={`Physical Metric Units (${selectedNormResource.base_unit_category})`}>
                                                            {physicalMetricUnits.map((u) => (
                                                                <option key={u.id} value={u.id}>
                                                                    {u.code} ({u.name}){Number(u.id) === Number(selectedNormResource?.base_unit_id) ? ' ★ Base Unit' : ''}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {resourcePackagingUnits.length > 0 && (
                                                        <optgroup label="Resource Packaging Conversions">
                                                            {resourcePackagingUnits.map((u) => (
                                                                <option key={u.id} value={u.id}>
                                                                    {u.code} ({u.name}) &mdash; {u.ruleText}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                </>
                                            )}
                                        </select>
                                        {selectedNormResource && (
                                            <div className="text-[10px] text-gray-400 mt-1 space-y-0.5">
                                                <div>
                                                    Base: <span className="font-mono font-semibold text-gray-600 dark:text-gray-300">{selectedNormResource.base_unit_code}</span> ({selectedNormResource.base_unit_category})
                                                    {resourcePackagingUnits.length > 0 && (
                                                        <span className="text-purple-600 dark:text-purple-400 ml-1.5 font-medium">
                                                            &bull; {resourcePackagingUnits.length} packaging rule(s)
                                                        </span>
                                                    )}
                                                </div>
                                                {resourcePackagingUnits.length === 0 && (
                                                    <div className="text-gray-400 dark:text-gray-500 italic">
                                                        Need packaging units like "cup" or "bag"? Add a conversion rule in {selectedNormResource.code}'s packaging tab.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Allowed Wastage %
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={normWastagePct}
                                            onChange={(e) => setNormWastagePct(e.target.value)}
                                            placeholder="0"
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={normNote}
                                        onChange={(e) => setNormNote(e.target.value)}
                                        placeholder="Optional engineering note..."
                                        className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    />
                                    <button
                                        type="submit"
                                        disabled={savingNorm || !normResId || !normQty.trim() || !normUnitId || !normFrom}
                                        className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                                    >
                                        {savingNorm && <Loader2 size={12} className="animate-spin" />}
                                        Add Norm Line
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Norms List Table */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3">
                                Active Composition Norm Lines
                            </h4>
                            {normsLoading ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Loader2 size={20} className="animate-spin mx-auto mb-1 text-blue-500" />
                                    <span className="text-xs">Loading norms...</span>
                                </div>
                            ) : norms.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 bg-gray-50 dark:bg-gh-subtle rounded-xl border border-dashed border-gray-300 dark:border-gh-border text-xs">
                                    No composition norms defined for this activity. Add required resources above.
                                </div>
                            ) : (
                                <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                            <tr>
                                                <th className="py-2.5 px-3">Resource</th>
                                                <th className="py-2.5 px-3 font-mono">Qty / Unit</th>
                                                <th className="py-2.5 px-3 font-mono">Unit</th>
                                                <th className="py-2.5 px-3 font-mono">Wastage %</th>
                                                <th className="py-2.5 px-3">Effective Period</th>
                                                <th className="py-2.5 px-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                            {norms.map((n) => (
                                                <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gh-hover/30">
                                                    <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                        <div>{n.resource_name}</div>
                                                        <span className="font-mono text-[11px] text-gray-400">{n.resource_code}</span>
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono font-semibold">
                                                        {formatQuantity(n.qty_per_unit)}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-400">
                                                        {n.unit_code}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">
                                                        {n.wastage_pct ?? 0}%
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-300">
                                                        {formatDatePlain(n.effective_from)} &rarr; {n.effective_to ? formatDatePlain(n.effective_to) : 'Open-ended'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right space-x-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => openCorrectNorm(n)}
                                                            className="px-2 py-1 text-[11px] rounded font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                                        >
                                                            Correct
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openRemoveNorm(n)}
                                                            className="px-2 py-1 text-[11px] rounded font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
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
                    <ChangeLogSection entity="activity" entityId={activity.id} />
                )}
            </div>

            {/* Correct Norm Modal */}
            {isCorrectNormModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl p-6">
                        <button
                            onClick={() => setIsCorrectNormModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={18} />
                        </button>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                            Correct Composition Norm
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Adjusting norm consumption values or dates requires a mandatory audit reason.
                        </p>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const rsn = e.target.elements.reason.value.trim();
                                if (!rsn) {
                                    customToast.error('Audit reason is required', 'Reason Required');
                                    return;
                                }
                                handleConfirmCorrectNorm(rsn);
                            }}
                            className="space-y-3"
                        >
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Qty Per Unit <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={correctQty}
                                        onChange={(e) => setCorrectQty(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Unit <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={correctUnitId}
                                        onChange={(e) => setCorrectUnitId(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        required
                                    >
                                        <option value="">Select Unit</option>
                                        {correctingCompatibleUnits.physicalMetricUnits.length > 0 && (
                                            <optgroup label="Physical Metric Units">
                                                {correctingCompatibleUnits.physicalMetricUnits.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.code} ({u.name}){Number(u.id) === Number(correctingNormResource?.base_unit_id) ? ' ★ Base' : ''}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {correctingCompatibleUnits.resourcePackagingUnits.length > 0 && (
                                            <optgroup label="Resource Packaging Conversions">
                                                {correctingCompatibleUnits.resourcePackagingUnits.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.code} ({u.name}) &mdash; {u.ruleText}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {correctingCompatibleUnits.physicalMetricUnits.length === 0 && units.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.code}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Allowed Wastage %
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={correctWastagePct}
                                        onChange={(e) => setCorrectWastagePct(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Effective From <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={correctFrom}
                                        onChange={(e) => setCorrectFrom(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Effective To
                                </label>
                                <input
                                    type="date"
                                    value={correctTo}
                                    onChange={(e) => setCorrectTo(e.target.value)}
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
                                    placeholder="Enter the reason for correcting this norm..."
                                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCorrectNormModalOpen(false)}
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

            {/* Remove Norm Reason Modal */}
            <ReasonModal
                isOpen={isRemoveNormModalOpen}
                title="Remove Norm Line"
                subtitle={`Removing norm: ${removingNorm?.resource_name} (${removingNorm?.qty_per_unit} ${removingNorm?.unit_code})`}
                confirmText="Remove Norm"
                confirmCls="bg-red-600 hover:bg-red-700 text-white"
                onClose={() => setIsRemoveNormModalOpen(false)}
                onConfirm={handleConfirmRemoveNorm}
            />
        </div>
    );
}

