import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft,
    Layers,
    Calculator,
    Edit2,
    Trash2,
    Archive,
    RotateCcw,
    GitCompare,
    History,
    Plus,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    X,
    Info,
    Calendar,
    Save,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import catalogCache from './catalogCache';
import { showCatalogErrorToast } from './catalogErrors';
import { formatMoney, formatQuantity, formatDatePlain, getTodayDateStr } from './catalogFormat';
import { customToast } from '../../utils/toast';
import ReasonModal from './ReasonModal';
import ChangeLogSection from './ChangeLogSection';
import { PACKAGING_UNIT_CODES } from './ActivityDetailView';

export default function ActivityDetailPage({
    activity: initialActivity,
    scope = 'master',
    projectId = null,
    units = [],
    onBack,
    onActivityUpdated,
    onAction,
    onSync
}) {
    const [activity, setActivity] = useState(initialActivity);
    const [activeSection, setActiveSection] = useState('calculator'); // 'calculator' | 'norms' | 'changelog'
    const [showDetails, setShowDetails] = useState(true); // Toggle to collapse/expand activity details panel

    // ─── Edit Activity Mode State ─────────────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false);
    const [editCode, setEditCode] = useState(activity?.code || '');
    const [editName, setEditName] = useState(activity?.name || '');
    const [editOutputUnitId, setEditOutputUnitId] = useState(String(activity?.output_unit_id || ''));
    const [editDescription, setEditDescription] = useState(activity?.description || '');
    const [editRemarks, setEditRemarks] = useState(activity?.remarks || '');
    const [savingDetails, setSavingDetails] = useState(false);

    // ─── Norms State ──────────────────────────────────────────────────────────
    const [norms, setNorms] = useState([]);
    const [normsLoading, setNormsLoading] = useState(true);

    // Available resources for norm picker (same scope, active only)
    const [availableResources, setAvailableResources] = useState([]);

    // Add Norm Form State
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

    // ─── Dynamic Cost & Usage Calculator State ────────────────────────────────
    const [calcDate, setCalcDate] = useState(getTodayDateStr());
    const [calcQty, setCalcQty] = useState('1');
    const [costData, setCostData] = useState(null);
    const [usageData, setUsageData] = useState(null);
    const [calculating, setCalculating] = useState(true);

    // Conversions for selected resource (to enable packaging units in norms)
    const [resourceConversions, setResourceConversions] = useState([]);

    // Refresh Activity details from server
    const reloadActivity = async () => {
        if (!activity?.id) return;
        try {
            const list = await catalogApi.listActivities({
                scope,
                projectId: scope === 'project' ? projectId : undefined
            });
            const updated = (list || []).find(a => a.id === activity.id);
            if (updated) {
                setActivity(updated);
                setEditCode(updated.code);
                setEditName(updated.name);
                setEditOutputUnitId(String(updated.output_unit_id));
                setEditDescription(updated.description || '');
                setEditRemarks(updated.remarks || '');
            }
        } catch (_) {}
    };

    // Load available resources for picker
    useEffect(() => {
        let active = true;
        const fetchScopeResources = async () => {
            try {
                const cached = catalogCache.getResources(scope, projectId);
                if (cached && active) {
                    setAvailableResources(cached.filter(r => r.status === 'active'));
                    return;
                }
                const list = await catalogApi.listResources({
                    scope,
                    projectId: scope === 'project' ? projectId : undefined,
                    status: 'active'
                });
                if (active) setAvailableResources(list || []);
            } catch (err) {
                console.error('Failed to load resources for norm picker:', err);
            }
        };
        fetchScopeResources();
        return () => { active = false; };
    }, [scope, projectId]);

    // Load Norms
    const loadNorms = useCallback(async () => {
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
    }, [activity?.id]);

    useEffect(() => {
        loadNorms();
    }, [loadNorms]);

    const selectedNormResource = useMemo(() => {
        return availableResources.find(r => String(r.id) === String(normResId)) || null;
    }, [availableResources, normResId]);

    const correctingNormResource = useMemo(() => {
        if (!correctingNorm) return null;
        return availableResources.find(r => Number(r.id) === Number(correctingNorm.resource_id)) || null;
    }, [availableResources, correctingNorm]);

    // Fetch packaging conversions whenever norm resource changes
    useEffect(() => {
        const targetRes = correctingNormResource || selectedNormResource;
        if (!targetRes?.id) {
            setResourceConversions([]);
            return;
        }

        let active = true;
        catalogApi.listConversions(targetRes.id).then(resList => {
            if (active) setResourceConversions(resList || []);
        }).catch(() => {
            if (active) setResourceConversions([]);
        });

        return () => { active = false; };
    }, [selectedNormResource, correctingNormResource]);

    // Helper to extract physical metric units and packaging conversions for any resource
    const getResourceCompatibleUnits = useCallback((res, conversionsList) => {
        if (!res || !units || units.length === 0) {
            return { physicalMetricUnits: [], resourcePackagingUnits: [] };
        }

        const baseCat = res.base_unit_category;
        const baseUnitId = Number(res.base_unit_id);

        const physicalMetricUnits = units.filter(u => {
            if (Number(u.id) === baseUnitId) return true;
            return u.category === baseCat && !PACKAGING_UNIT_CODES.has(u.code.toLowerCase());
        });

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
    }, [units]);

    const { physicalMetricUnits, resourcePackagingUnits } = useMemo(() => {
        return getResourceCompatibleUnits(selectedNormResource, resourceConversions);
    }, [selectedNormResource, resourceConversions, getResourceCompatibleUnits]);

    const correctingCompatibleUnits = useMemo(() => {
        return getResourceCompatibleUnits(correctingNormResource, resourceConversions);
    }, [correctingNormResource, resourceConversions, getResourceCompatibleUnits]);

    // Auto-select resource base unit when selecting a new resource
    useEffect(() => {
        if (selectedNormResource) {
            setNormUnitId(String(selectedNormResource.base_unit_id || ''));
        }
    }, [selectedNormResource]);

    // Run Dynamic Calculation (Fetch Unit Cost & 1-Unit BOM Factors)
    const runCalculation = useCallback(async (asOfDate) => {
        if (!activity?.id) return;
        setCalculating(true);
        const targetDate = asOfDate || getTodayDateStr();

        try {
            const [costRes, usageRes] = await Promise.all([
                catalogApi.computeActivityCost(activity.id, targetDate),
                catalogApi.expectedUsage(activity.id, '1', targetDate)
            ]);
            setCostData(costRes);
            setUsageData(usageRes);
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to compute activity cost or usage');
        } finally {
            setCalculating(false);
        }
    }, [activity?.id]);

    useEffect(() => {
        if (activity?.id) {
            runCalculation(calcDate);
        }
    }, [activity?.id, runCalculation]);

    const handleRecalculate = (e) => {
        if (e) e.preventDefault();
        runCalculation(calcDate);
    };

    // Planned quantity parsed from input (default: 1)
    const plannedQty = useMemo(() => {
        const parsed = parseFloat(calcQty);
        return (!isNaN(parsed) && parsed > 0) ? parsed : 1;
    }, [calcQty]);

    // Merged Dynamic Cost & BOM Analysis rows (calculated client-side instantly)
    const mergedAnalysis = useMemo(() => {
        const costLines = costData?.lines || [];
        const usageItems = usageData?.items || [];
        if (costLines.length === 0 && usageItems.length === 0) return [];

        const usageMap = new Map();
        usageItems.forEach(it => {
            usageMap.set(String(it.resourceId), it);
        });

        const rows = costLines.map(cl => {
            const ui = usageMap.get(String(cl.resourceId));
            const baseNormQty = Number(cl.netQty || 0);
            const baseGrossQty = Number(cl.grossQty || 0);
            const baseBomNetQty = ui ? Number(ui.netQty || 0) : baseNormQty;
            const baseBomAllowanceQty = ui ? Number(ui.allowanceQty || 0) : Math.max(0, baseGrossQty - baseNormQty);
            const baseBomGrossQty = ui ? Number(ui.grossQty || 0) : baseGrossQty;
            const rate = (cl.rate !== null && cl.rate !== undefined) ? Number(cl.rate) : null;
            const baseAmount = (cl.amount !== null && cl.amount !== undefined) ? Number(cl.amount) : null;

            const scaledRecipeNet = baseNormQty * plannedQty;
            const scaledRecipeGross = baseGrossQty * plannedQty;
            const scaledBomNet = baseBomNetQty * plannedQty;
            const scaledBomAllowance = baseBomAllowanceQty * plannedQty;
            const scaledBomGross = baseBomGrossQty * plannedQty;
            const scaledAmount = baseAmount !== null ? baseAmount * plannedQty : (rate !== null ? scaledRecipeGross * rate : null);

            return {
                resourceId: cl.resourceId,
                resourceCode: cl.resourceCode,
                resourceName: cl.resourceName,
                kind: cl.kind,
                // Common norm recipe (per 1 unit)
                normQty: baseNormQty,
                normUnitCode: cl.unitCode,
                wastagePct: cl.wastagePct ?? 0,
                // Scaled Recipe quantities
                recipeNetPlanned: scaledRecipeNet,
                recipeGrossPlanned: scaledRecipeGross,
                // Economics
                costGrossQty: scaledRecipeGross,
                costRate: rate,
                costAmount: scaledAmount,
                unitCostAmount: baseAmount,
                // Warehouse BOM quantities
                bomNetQty: scaledBomNet,
                bomAllowanceQty: scaledBomAllowance,
                bomGrossQty: scaledBomGross,
                bomBaseUnitCode: ui?.unitCode || ui?.baseUnitCode || cl.unitCode,
                isNormConverted: Boolean(ui?.normUnitCode && ui?.normUnitCode !== (ui?.unitCode || ui?.baseUnitCode))
            };
        });

        // Edge case: usage items not in cost lines
        usageItems.forEach(ui => {
            if (!costLines.some(cl => String(cl.resourceId) === String(ui.resourceId))) {
                const baseNormQty = Number(ui.normQtyPerUnit || 0);
                const baseBomNetQty = Number(ui.netQty || 0);
                const baseBomAllowanceQty = Number(ui.allowanceQty || 0);
                const baseBomGrossQty = Number(ui.grossQty || 0);

                rows.push({
                    resourceId: ui.resourceId,
                    resourceCode: ui.resourceCode,
                    resourceName: ui.resourceName,
                    normQty: baseNormQty,
                    normUnitCode: ui.normUnitCode || ui.unitCode,
                    wastagePct: ui.wastagePct ?? 0,
                    recipeNetPlanned: baseNormQty * plannedQty,
                    recipeGrossPlanned: baseNormQty * (1 + (ui.wastagePct || 0) / 100) * plannedQty,
                    costGrossQty: null,
                    costRate: null,
                    costAmount: null,
                    unitCostAmount: null,
                    bomNetQty: baseBomNetQty * plannedQty,
                    bomAllowanceQty: baseBomAllowanceQty * plannedQty,
                    bomGrossQty: baseBomGrossQty * plannedQty,
                    bomBaseUnitCode: ui.unitCode || ui.baseUnitCode,
                    isNormConverted: Boolean(ui.normUnitCode && ui.normUnitCode !== (ui.unitCode || ui.baseUnitCode))
                });
            }
        });

        return rows;
    }, [costData, usageData, plannedQty]);

    // Dynamic total cost across all lines for the planned quantity
    const dynamicTotalCost = useMemo(() => {
        return (costData?.total || 0) * plannedQty;
    }, [costData?.total, plannedQty]);

    // Save Activity Details Edit
    const handleSaveActivityDetails = async (e) => {
        e.preventDefault();
        const cleanName = editName.trim();
        const cleanCode = editCode.trim().toUpperCase();
        if (!cleanName || !cleanCode || !editOutputUnitId) {
            customToast.error('Code, Name, and Output Unit are required.', 'Missing Fields');
            return;
        }

        setSavingDetails(true);
        try {
            await catalogApi.updateActivity(activity.id, {
                code: cleanCode,
                name: cleanName,
                outputUnitId: Number(editOutputUnitId),
                description: editDescription.trim() || null,
                remarks: editRemarks.trim() || null
            });

            customToast.success('Activity details updated successfully', 'Activity Saved');
            setIsEditing(false);
            await reloadActivity();
            if (onActivityUpdated) onActivityUpdated();
            runCalculation(calcDate);
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to update activity');
        } finally {
            setSavingDetails(false);
        }
    };

    // Add Norm Line
    const handleAddNorm = async (e) => {
        e.preventDefault();
        if (!normResId || !normQty.trim() || !normUnitId) {
            customToast.error('Please select resource, unit, and enter quantity.', 'Missing Fields');
            return;
        }

        setSavingNorm(true);
        try {
            await catalogApi.setNorm(activity.id, {
                resourceId: Number(normResId),
                qtyPerUnit: normQty.trim(),
                unitId: Number(normUnitId),
                wastagePct: normWastagePct.trim() || '0',
                effectiveFrom: normFrom || getTodayDateStr(),
                note: normNote.trim() || null
            });

            customToast.success('Composition norm added', 'Norm Added');
            setNormResId('');
            setNormQty('');
            setNormUnitId('');
            setNormWastagePct('0');
            setNormNote('');
            await loadNorms();
            runCalculation(calcDate);
            if (onActivityUpdated) onActivityUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to add norm');
        } finally {
            setSavingNorm(false);
        }
    };

    // Open Correct Norm Modal
    const handleOpenCorrectNorm = (norm) => {
        setCorrectingNorm(norm);
        setCorrectQty(String(Number(norm.qty_per_unit)));
        setCorrectUnitId(String(norm.unit_id));
        setCorrectWastagePct(String(Number(norm.wastage_pct || 0)));
        setCorrectFrom(norm.effective_from ? formatDatePlain(norm.effective_from) : getTodayDateStr());
        setCorrectTo(norm.effective_to ? formatDatePlain(norm.effective_to) : '');
        setCorrectNote(norm.note || '');
        setIsCorrectNormModalOpen(true);
    };

    // Save Corrected Norm
    const handleSaveCorrectNorm = async (e) => {
        e.preventDefault();
        if (!correctingNorm || !correctQty.trim() || !correctUnitId) return;

        try {
            await catalogApi.correctNorm(correctingNorm.id, {
                patch: {
                    qtyPerUnit: correctQty.trim(),
                    unitId: Number(correctUnitId),
                    wastagePct: correctWastagePct.trim() || '0',
                    effectiveFrom: correctFrom,
                    effectiveTo: correctTo.trim() || null,
                    note: correctNote.trim() || null
                },
                reason: 'Corrected recipe composition'
            });

            customToast.success('Composition norm corrected', 'Norm Corrected');
            setIsCorrectNormModalOpen(false);
            setCorrectingNorm(null);
            await loadNorms();
            runCalculation(calcDate);
            if (onActivityUpdated) onActivityUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to correct norm');
        }
    };

    // Remove Norm Line
    const handleConfirmRemoveNorm = async (reason) => {
        if (!removingNorm) return;
        try {
            await catalogApi.removeNorm(removingNorm.id, reason);
            customToast.success('Norm line removed', 'Norm Removed');
            setIsRemoveNormModalOpen(false);
            setRemovingNorm(null);
            await loadNorms();
            runCalculation(calcDate);
            if (onActivityUpdated) onActivityUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to remove norm');
            throw err;
        }
    };

    const isBehind = scope === 'project' && activity.parent_id && Number(activity.master_version) > Number(activity.synced_version || 0);

    return (
        <div className="flex-1 min-h-0 flex flex-col space-y-4 animate-fade-in">
            {/* ─── OPEN & MODERN ACTIVITY HEADER (NO CARD) ─── */}
            <div className="space-y-3">
                {/* Header Row: Title & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                title="Back to Activities list"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                                {activity.name}
                            </h1>
                            <span className="font-mono font-bold text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gh-subtle px-2 py-0.5 rounded border border-gray-200 dark:border-gh-border">
                                {activity.code}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                activity.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                            }`}>
                                {activity.status}
                            </span>
                        </div>
                    </div>

                    {/* Top-Right Action Buttons */}
                    <div className="flex items-center gap-2">
                        {scope === 'project' && isBehind && onSync && (
                            <button
                                type="button"
                                onClick={() => onSync(activity)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer shadow-xs animate-pulse"
                            >
                                <GitCompare size={12} /> Sync with Master
                            </button>
                        )}

                        {!isEditing && (
                            <button
                                type="button"
                                onClick={() => setShowDetails(prev => !prev)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gh-subtle dark:hover:bg-gh-hover text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gh-border transition-colors cursor-pointer shadow-2xs"
                                title={showDetails ? "Hide Activity Overview" : "Show Activity Overview"}
                            >
                                {showDetails ? (
                                    <>
                                        <ChevronUp size={13} />
                                        <span>Hide Details</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={13} />
                                        <span>Show Details</span>
                                    </>
                                )}
                            </button>
                        )}

                        {!isEditing && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditCode(activity.code);
                                    setEditName(activity.name);
                                    setEditOutputUnitId(String(activity.output_unit_id));
                                    setEditDescription(activity.description || '');
                                    setEditRemarks(activity.remarks || '');
                                    setIsEditing(true);
                                    setShowDetails(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gh-subtle dark:hover:bg-gh-hover text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gh-border transition-colors cursor-pointer shadow-2xs"
                            >
                                <Edit2 size={12} />
                                Edit Activity
                            </button>
                        )}

                        {onAction && !isEditing && (
                            activity.status === 'active' ? (
                                <button
                                    type="button"
                                    onClick={() => onAction(activity, 'archive')}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                    title="Archive Activity"
                                >
                                    <Archive size={15} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onAction(activity, 'restore')}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                    title="Restore Activity"
                                >
                                    <RotateCcw size={15} />
                                </button>
                            )
                        )}
                    </div>
                </div>

                {/* View Mode vs Edit Mode */}
                {!isEditing ? (
                    showDetails ? (
                        /* The exact 2-column structure preserved, but borderless and seamless without card box */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3.5 pt-2">
                            {/* Left Column */}
                            <div className="space-y-3">
                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Activity Code
                                    </span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gh-subtle/80 px-2 py-0.5 rounded text-xs border border-gray-200 dark:border-gh-border inline-block">
                                        {activity.code}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Output Unit
                                    </span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-xs">
                                            {activity.output_unit_code || '—'}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            ({activity.output_unit_name || 'Output Unit'})
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Scope
                                    </span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300 text-xs">
                                        {activity.project_id ? `Project #${activity.project_id}` : 'Master Standard'}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Status
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        activity.status === 'active'
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                                    }`}>
                                        {activity.status}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Description &amp; Scope Notes
                                    </span>
                                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                        {activity.description || <span className="text-gray-400 italic">None specified</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-3">
                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Dynamic Unit Cost (As of Today)
                                    </span>
                                    {calculating || !costData ? (
                                        <span className="text-xs text-gray-400 italic flex items-center gap-1.5">
                                            <Loader2 size={12} className="animate-spin text-blue-500" /> Computing unit rate...
                                        </span>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100">
                                                    ₹ {formatMoney(costData.total || 0)}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    / {activity.output_unit_code || 'unit'}
                                                </span>
                                                {costData.complete ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                                                        <CheckCircle2 size={11} /> Fully Priced
                                                    </span>
                                                ) : costData.warnings && costData.warnings.length > 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                                                        <AlertTriangle size={11} /> {costData.warnings.length} Rate{costData.warnings.length === 1 ? '' : 's'} Missing
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Recipe Composition
                                    </span>
                                    {normsLoading ? (
                                        <span className="text-xs text-gray-400 italic flex items-center gap-1.5">
                                            <Loader2 size={12} className="animate-spin text-blue-500" /> Loading recipe norms...
                                        </span>
                                    ) : (
                                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                                            {norms.length} resource norm lines active
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-0.5">
                                        Remarks
                                    </span>
                                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                        {activity.remarks || <span className="text-gray-400 italic">No execution notes</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Compact 1-line Summary when details are collapsed */
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400 pt-1 pb-1">
                            <span>Output: <strong className="font-mono text-gray-800 dark:text-gray-200">{activity.output_unit_code || '—'}</strong> ({activity.output_unit_name || 'Unit'})</span>
                            <span>&bull;</span>
                            <span>Scope: <strong className="text-gray-800 dark:text-gray-200">{activity.project_id ? `Project #${activity.project_id}` : 'Master Standard'}</strong></span>
                            <span>&bull;</span>
                            <span>Unit Cost: <strong className="font-mono text-gray-800 dark:text-gray-200">{calculating || !costData ? 'Computing...' : `₹ ${formatMoney(costData?.total || 0)} / ${activity.output_unit_code || 'unit'}`}</strong></span>
                            <span>&bull;</span>
                            <span>Recipe: <strong className="text-blue-600 dark:text-blue-400">{normsLoading ? 'Loading...' : `${norms.length} lines`}</strong></span>
                        </div>
                    )
                ) : (
                    /* In-Place Inline Activity Edit Form with dedicated clean styling */
                    <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/10">
                        <form onSubmit={handleSaveActivityDetails} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Activity Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editCode}
                                        onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. LEMONADE"
                                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Activity Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="e.g. Lemonade"
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Output Unit <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={editOutputUnitId}
                                        onChange={(e) => setEditOutputUnitId(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        required
                                    >
                                        <option value="">Select Output Unit</option>
                                        {units.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.code} &mdash; {u.name} ({u.category})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        rows={2}
                                        placeholder="Specification and execution description..."
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Remarks
                                    </label>
                                    <textarea
                                        value={editRemarks}
                                        onChange={(e) => setEditRemarks(e.target.value)}
                                        rows={2}
                                        placeholder="Internal notes or machinery remarks..."
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gh-border/50">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    disabled={savingDetails}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gh-subtle dark:hover:bg-gh-hover text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingDetails}
                                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                    {savingDetails ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* ─── TAB NAVIGATION: UNDERLINE TABS (NO BOX, NO GAPS) ─── */}
            <div className="border-b border-gray-200 dark:border-gh-border pt-1">
                <div className="flex gap-6 -mb-px">
                    <button
                        type="button"
                        onClick={() => setActiveSection('calculator')}
                        className={`pb-2.5 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                            activeSection === 'calculator'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <Calculator size={15} />
                        Cost &amp; Usage Calculator
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('norms')}
                        className={`pb-2.5 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                            activeSection === 'norms'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <Layers size={15} />
                        Composition Norms {normsLoading ? '' : `(${norms.length})`}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('changelog')}
                        className={`pb-2.5 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                            activeSection === 'changelog'
                                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <History size={15} />
                        Audit Change Log
                    </button>
                </div>
            </div>

            {/* ─── TAB CONTENT PANELS (FRAMELESS & CRISP) ─── */}
            <div className="pt-2">
                {/* ─── SECTION 1: COST & USAGE CALCULATOR ─── */}
                {activeSection === 'calculator' && (
                    <div className="space-y-4">
                        {/* Section Header with Smart Formulation Status Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                            <div className="flex items-center gap-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                    Cost &amp; Bill of Materials (BOM)
                                </h4>
                                {calculating ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-gh-subtle dark:text-gray-400">
                                        <Loader2 size={12} className="animate-spin text-blue-500" /> Computing rates...
                                    </span>
                                ) : costData?.complete ? (
                                    <span
                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                        title={`All formulation resources have active rates in force for ${costData?.date || calcDate}`}
                                    >
                                        <CheckCircle2 size={13} /> Fully Priced
                                    </span>
                                ) : costData && costData.warnings && costData.warnings.length > 0 ? (
                                    <span
                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                        title={costData?.warnings?.map(w => w.message).join('\n')}
                                    >
                                        <AlertTriangle size={13} /> {costData.warnings.length} Rate{costData.warnings.length === 1 ? '' : 's'} Missing
                                    </span>
                                ) : null}
                            </div>

                            {!calculating && costData?.warnings && costData.warnings.length > 0 && (
                                <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800/60">
                                    <AlertTriangle size={12} className="shrink-0" />
                                    <span className="truncate max-w-md">{costData.warnings[0].message}{costData.warnings.length > 1 ? ` (+${costData.warnings.length - 1} more)` : ''}</span>
                                </div>
                            )}
                        </div>

                        {/* Cost & BOM Calculation Table with Fixed Locked Columns */}
                        <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden shadow-xs bg-white dark:bg-gh-bg">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left min-w-[950px] table-fixed border-collapse">
                                    {/* Strictly Locked Column Widths to Prevent Dynamic Jitter */}
                                    <colgroup>
                                        <col className="w-[22%]" /> {/* 1. Resource */}
                                        <col className="w-[11%]" /> {/* 2. Norm Qty */}
                                        <col className="w-[8%]" />  {/* 3. Wastage % */}
                                        <col className="w-[9%]" />  {/* 4. Rate */}
                                        <col className="w-[15%]" /> {/* 5. Net Needed */}
                                        <col className="w-[11%]" /> {/* 6. Wastage (+) */}
                                        <col className="w-[14%]" /> {/* 7. Total Required */}
                                        <col className="w-[10%]" /> {/* 8. Cost */}
                                    </colgroup>

                                    <thead>
                                        {/* Tier 1 Super Headers with In-Header Inputs */}
                                        <tr className="border-b border-gray-200 dark:border-gh-border text-[11px] font-bold uppercase tracking-wider">
                                            {/* Left Header: Recipe Norms + As-of Date Input */}
                                            <th colSpan={4} className="py-2.5 px-3 bg-gray-100/90 dark:bg-gh-subtle text-gray-700 dark:text-gray-300">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span>Composition Norms (Recipe)</span>
                                                    <div className="flex items-center gap-1.5 normal-case font-normal text-xs text-gray-600 dark:text-gray-300">
                                                        <Calendar size={13} className="text-gray-400 shrink-0" />
                                                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">As of:</span>
                                                        <input
                                                            type="date"
                                                            value={calcDate}
                                                            onChange={(e) => {
                                                                setCalcDate(e.target.value);
                                                                runCalculation(e.target.value);
                                                            }}
                                                            className="px-2 py-0.5 text-xs font-mono border rounded bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 cursor-pointer shadow-2xs"
                                                        />
                                                    </div>
                                                </div>
                                            </th>

                                            {/* Right Header: Dynamic BOM + Planned Output Quantity Input */}
                                            <th colSpan={4} className="py-2.5 px-3 bg-blue-50/80 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-l-2 border-gray-300 dark:border-gh-border">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span>Dynamic Requirements &amp; Cost (BOM)</span>
                                                    <div className="flex items-center gap-2 normal-case font-normal text-xs text-blue-900 dark:text-blue-200">
                                                        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Planned Output:</span>
                                                        <div className="inline-flex items-center gap-1 bg-white dark:bg-[#0d1117] border border-blue-300 dark:border-blue-700 rounded px-1.5 py-0.5 shadow-2xs">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                value={calcQty}
                                                                onChange={(e) => setCalcQty(e.target.value)}
                                                                className="w-16 text-center text-xs font-mono font-bold text-gray-900 dark:text-gray-100 bg-transparent focus:outline-none"
                                                            />
                                                            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">{activity.output_unit_code || 'unit'}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => runCalculation(calcDate)}
                                                            title="Verify against latest rates from server"
                                                            disabled={calculating}
                                                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-200/50 dark:hover:bg-blue-900/50 rounded transition-colors disabled:opacity-50 cursor-pointer"
                                                        >
                                                            <RotateCcw size={13} className={calculating ? 'animate-spin' : ''} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </th>
                                        </tr>

                                        {/* Tier 2 Column Headers */}
                                        <tr className="border-b border-gray-200 dark:border-gh-border bg-gray-50 dark:bg-gh-subtle/50 text-[11px] font-semibold uppercase text-gray-600 dark:text-gray-400">
                                            {/* Recipe Norms & Unit Rates */}
                                            <th className="py-2 px-3">Resource</th>
                                            <th className="py-2 px-3 font-mono">Norm Qty</th>
                                            <th className="py-2 px-3 font-mono">Wastage %</th>
                                            <th className="py-2 px-3 font-mono">
                                                <span className="inline-flex items-center gap-1 group relative cursor-help">
                                                    Rate (₹)
                                                    <Info size={12} className="text-gray-400 group-hover:text-blue-500" />
                                                    <span className="hidden group-hover:block absolute bottom-full left-0 mb-1 z-30 w-48 p-1.5 bg-gray-900 text-white text-[10px] rounded shadow-lg pointer-events-none normal-case font-normal">
                                                        Active catalog purchase / market rate for this resource.
                                                    </span>
                                                </span>
                                            </th>

                                            {/* Dynamic Requirements & Batch Cost */}
                                            <th className="py-2 px-3 font-mono border-l-2 border-gray-300 dark:border-gh-border">Net Needed</th>
                                            <th className="py-2 px-3 font-mono">Wastage (+)</th>
                                            <th className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">Total Required</th>
                                            <th className="py-2 px-3 font-mono text-right font-bold">
                                                <span className="inline-flex items-center gap-1 justify-end group relative cursor-help">
                                                    Cost (₹)
                                                    <Info size={12} className="text-gray-400 group-hover:text-blue-500" />
                                                    <span className="hidden group-hover:block absolute bottom-full right-0 mb-1 z-30 w-52 p-1.5 bg-gray-900 text-white text-[10px] rounded shadow-lg pointer-events-none normal-case font-normal text-left">
                                                        Calculated line cost = Total Required Quantity &times; Rate.
                                                    </span>
                                                </span>
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                        {calculating || normsLoading ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-gray-400">
                                                    <Loader2 size={20} className="animate-spin mx-auto mb-2 text-blue-500" />
                                                    <span className="text-xs font-medium">Computing cost &amp; BOM requirements...</span>
                                                </td>
                                            </tr>
                                        ) : mergedAnalysis && mergedAnalysis.length > 0 ? (
                                            mergedAnalysis.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/80 dark:hover:bg-gh-hover/30 transition-colors">
                                                    {/* Common Resource */}
                                                    <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                        <div className="font-semibold truncate" title={row.resourceName}>{row.resourceName}</div>
                                                        <span className="font-mono text-[11px] text-gray-400">{row.resourceCode}</span>
                                                    </td>
                                                    {/* Common Norm Net Qty */}
                                                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                                                        {formatQuantity(row.normQty)} {row.normUnitCode}
                                                    </td>
                                                    {/* Common Wastage % */}
                                                    <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
                                                        {row.wastagePct ?? 0}%
                                                    </td>
                                                    {/* Rate */}
                                                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                                                        {row.costRate !== null ? (
                                                            <span className="group relative cursor-help">
                                                                ₹ {formatMoney(row.costRate)}
                                                                <span className="hidden group-hover:block absolute bottom-full left-0 mb-1 z-30 w-44 p-1.5 bg-gray-900 text-white text-[10px] rounded shadow-lg pointer-events-none normal-case">
                                                                    Rate: ₹ {formatMoney(row.costRate)} per {row.normUnitCode}
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-500 italic">No rate</span>
                                                        )}
                                                    </td>

                                                    {/* Net Needed (Base unit + Recipe context) */}
                                                    <td className="py-2.5 px-3 font-mono border-l-2 border-gray-300 dark:border-gh-border">
                                                        <div>
                                                            <div className="font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                                {formatQuantity(row.bomNetQty)} {row.bomBaseUnitCode}
                                                            </div>
                                                            {row.isNormConverted && (
                                                                <div className="text-[10px] text-gray-400 font-sans truncate" title={`norm: ${formatQuantity(row.recipeNetPlanned)} ${row.normUnitCode}`}>
                                                                    norm: {formatQuantity(row.recipeNetPlanned)} {row.normUnitCode}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Wastage Allowance */}
                                                    <td className="py-2.5 px-3 font-mono text-gray-500 whitespace-nowrap">
                                                        {row.bomAllowanceQty !== undefined ? `+${formatQuantity(row.bomAllowanceQty)} ${row.bomBaseUnitCode}` : '—'}
                                                    </td>

                                                    {/* Gross Total Required (Base unit + Recipe unit) */}
                                                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                                                        <div>
                                                            <div className="text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                                                {formatQuantity(row.bomGrossQty)} {row.bomBaseUnitCode}
                                                            </div>
                                                            {row.isNormConverted && (
                                                                <div className="text-[10px] text-gray-400 font-normal font-sans truncate" title={`gross: ${formatQuantity(row.recipeGrossPlanned)} ${row.normUnitCode}`}>
                                                                    gross: {formatQuantity(row.recipeGrossPlanned)} {row.normUnitCode}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Amount with Hover Formula */}
                                                    <td className="py-2.5 px-3 font-mono text-right font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                        {row.costAmount !== null ? (
                                                            <span className="group relative cursor-help inline-block">
                                                                ₹ {formatMoney(row.costAmount)}
                                                                <span className="hidden group-hover:block absolute bottom-full right-0 mb-1 z-30 w-64 p-1.5 bg-gray-900 text-white text-[10px] rounded shadow-lg pointer-events-none normal-case text-left">
                                                                    <div className="font-semibold text-emerald-300 mb-0.5">Calculation Formula:</div>
                                                                    <div>
                                                                        {formatQuantity(row.costGrossQty)} {row.normUnitCode} &times; ₹ {formatMoney(row.costRate)}/{row.normUnitCode} = <strong className="text-white">₹ {formatMoney(row.costAmount)}</strong>
                                                                    </div>
                                                                    {plannedQty !== 1 && (
                                                                        <div className="text-[9px] text-gray-300 mt-0.5">
                                                                            (Unit cost ₹ {formatMoney(row.unitCostAmount || 0)} &times; {plannedQty} {activity.output_unit_code || 'unit'})
                                                                        </div>
                                                                    )}
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="py-8 text-center text-gray-400 italic">
                                                    No composition norms defined for this activity. Add norm lines to see cost and BOM calculations.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>

                                    {!calculating && !normsLoading && mergedAnalysis && mergedAnalysis.length > 0 && (
                                        <tfoot className="bg-gray-50 dark:bg-gh-subtle font-bold border-t border-gray-200 dark:border-gh-border text-xs">
                                            <tr>
                                                {/* Common footer: Composition Norms */}
                                                <td colSpan={4} className="py-2.5 px-3 text-gray-500 dark:text-gray-400">
                                                    {mergedAnalysis.length} Norm Resources
                                                </td>
                                                {/* BOM footer: Net Needed, Wastage */}
                                                <td colSpan={2} className="py-2.5 px-3 border-l-2 border-gray-300 dark:border-gh-border text-gray-600 dark:text-gray-300">
                                                    <div className="flex items-center justify-between pr-2">
                                                        <span>Total requirements for {plannedQty} {activity.output_unit_code || 'unit'}</span>
                                                        <span className="text-[11px] font-mono font-normal text-gray-500 dark:text-gray-400">
                                                            Unit Rate: <strong className="text-gray-800 dark:text-gray-200 font-semibold">₹ {formatMoney(costData?.total || 0)}</strong> / {activity.output_unit_code || 'unit'}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* Cost label */}
                                                <td className="py-2.5 px-2 text-right text-gray-700 dark:text-gray-300 font-bold whitespace-nowrap text-[11px]">
                                                    {plannedQty === 1 ? 'Total Unit Cost:' : 'Total Cost:'}
                                                </td>
                                                {/* Cost total value */}
                                                <td className="py-2.5 px-3 font-mono text-right text-blue-600 dark:text-blue-400 text-sm font-bold whitespace-nowrap">
                                                    ₹ {formatMoney(dynamicTotalCost)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── SECTION 2: COMPOSITION NORMS RECIPE ─── */}
                {activeSection === 'norms' && (
                    <div className="space-y-6">
                        {/* Add Norm Line Form */}
                        <div className="bg-gray-50 dark:bg-gh-subtle p-4 rounded-xl border border-gray-200 dark:border-gh-border">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                                <Plus size={14} className="text-blue-500" />
                                Add Composition Norm Line
                            </h4>

                            <form onSubmit={handleAddNorm} className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Resource <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={normResId}
                                            onChange={(e) => setNormResId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        >
                                            <option value="">Select Resource</option>
                                            {availableResources.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.code} &mdash; {r.name} ({r.kind}, base: {r.base_unit_code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Net Qty per 1 {activity.output_unit_code || 'unit'} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0.000001"
                                            value={normQty}
                                            onChange={(e) => setNormQty(e.target.value)}
                                            placeholder="1.0"
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Consumption Unit <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={normUnitId}
                                            onChange={(e) => setNormUnitId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        >
                                            <option value="">Select Unit</option>
                                            {physicalMetricUnits.length > 0 && (
                                                <optgroup label={`Physical Metric Units (${selectedNormResource?.base_unit_category || 'Metrics'})`}>
                                                    {physicalMetricUnits.map((u) => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.code} &mdash; {u.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            {resourcePackagingUnits.length > 0 && (
                                                <optgroup label="Resource Packaging Conversions">
                                                    {resourcePackagingUnits.map((u) => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.code} &mdash; {u.name} ({u.ruleText})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Wastage / Allowance %
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            max="100"
                                            value={normWastagePct}
                                            onChange={(e) => setNormWastagePct(e.target.value)}
                                            placeholder="0"
                                            className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Effective From
                                        </label>
                                        <input
                                            type="date"
                                            value={normFrom}
                                            onChange={(e) => setNormFrom(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                            Notes / Ratio Reason
                                        </label>
                                        <input
                                            type="text"
                                            value={normNote}
                                            onChange={(e) => setNormNote(e.target.value)}
                                            placeholder="e.g. Standard mix allowance"
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="submit"
                                        disabled={savingNorm}
                                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                                    >
                                        {savingNorm && <Loader2 size={12} className="animate-spin" />}
                                        Add Norm Line
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Existing Norms Table */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                Active Composition Recipe {normsLoading ? '' : `(${norms.length} Lines)`}
                            </h4>

                            <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                                {normsLoading ? (
                                    <div className="flex items-center justify-center py-8 text-gray-400 text-xs">
                                        <Loader2 size={16} className="animate-spin mr-2" /> Loading norms...
                                    </div>
                                ) : norms.length === 0 ? (
                                    <div className="py-8 text-center text-gray-400 text-xs italic">
                                        No composition norms defined for this activity yet. Add your first ingredient above.
                                    </div>
                                ) : (
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-100 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase">
                                            <tr>
                                                <th className="py-2.5 px-3">Resource</th>
                                                <th className="py-2.5 px-3 font-mono">Net Qty</th>
                                                <th className="py-2.5 px-3 font-mono">Unit</th>
                                                <th className="py-2.5 px-3 font-mono">Wastage %</th>
                                                <th className="py-2.5 px-3">Effective Period</th>
                                                <th className="py-2.5 px-3">Note</th>
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
                                                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-gray-100">
                                                        {formatQuantity(n.qty_per_unit)}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400">
                                                        {n.unit_code}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">
                                                        {Number(n.wastage_pct || 0)}%
                                                    </td>
                                                    <td className="py-2.5 px-3 text-[11px] text-gray-500 font-mono">
                                                        {formatDatePlain(n.effective_from)} &rarr; {n.effective_to ? formatDatePlain(n.effective_to) : 'Present'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-[11px] text-gray-500">
                                                        {n.note || '—'}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right space-x-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenCorrectNorm(n)}
                                                            className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                            title="Correct Norm"
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setRemovingNorm(n);
                                                                setIsRemoveNormModalOpen(true);
                                                            }}
                                                            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                            title="Remove Norm"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── SECTION 3: AUDIT CHANGE LOG ─── */}
                {activeSection === 'changelog' && (
                    <ChangeLogSection
                        entity="activity"
                        entityId={activity.id}
                    />
                )}
            </div>

            {/* ─── MODAL: CORRECT NORM LINE ─────────────────────────────────── */}
            {isCorrectNormModalOpen && correctingNorm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsCorrectNormModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
                            Correct Norm: {correctingNorm.resource_name}
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            Update quantity, unit, or wastage for this recipe ingredient.
                        </p>

                        <form onSubmit={handleSaveCorrectNorm} className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Quantity per 1 {activity.output_unit_code || 'unit'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    min="0.000001"
                                    value={correctQty}
                                    onChange={(e) => setCorrectQty(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
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
                                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    required
                                >
                                    {correctingCompatibleUnits.physicalMetricUnits.length > 0 && (
                                        <optgroup label={`Physical Metric Units (${correctingNormResource?.base_unit_category || 'Metrics'})`}>
                                            {correctingCompatibleUnits.physicalMetricUnits.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.code} &mdash; {u.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {correctingCompatibleUnits.resourcePackagingUnits.length > 0 && (
                                        <optgroup label="Resource Packaging Conversions">
                                            {correctingCompatibleUnits.resourcePackagingUnits.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.code} &mdash; {u.name} ({u.ruleText})
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Wastage / Allowance %
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    max="100"
                                    value={correctWastagePct}
                                    onChange={(e) => setCorrectWastagePct(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Effective From
                                    </label>
                                    <input
                                        type="date"
                                        value={correctFrom}
                                        onChange={(e) => setCorrectFrom(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Effective To (Optional)
                                    </label>
                                    <input
                                        type="date"
                                        value={correctTo}
                                        onChange={(e) => setCorrectTo(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Correction Note
                                </label>
                                <input
                                    type="text"
                                    value={correctNote}
                                    onChange={(e) => setCorrectNote(e.target.value)}
                                    placeholder="e.g. Adjusted according to lab mix"
                                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gh-border">
                                <button
                                    type="button"
                                    onClick={() => setIsCorrectNormModalOpen(false)}
                                    className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-hover rounded-lg cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
                                >
                                    Save Correction
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── MODAL: REMOVE NORM AUDIT CONFIRMATION ─────────────────────── */}
            <ReasonModal
                isOpen={isRemoveNormModalOpen}
                title="Remove Norm Line"
                subtitle={removingNorm ? `Removing norm: ${removingNorm.resource_name} (${formatQuantity(removingNorm.qty_per_unit)} ${removingNorm.unit_code})` : ''}
                confirmText="Remove Norm"
                confirmCls="bg-red-600 hover:bg-red-700 text-white"
                onClose={() => {
                    setIsRemoveNormModalOpen(false);
                    setRemovingNorm(null);
                }}
                onConfirm={handleConfirmRemoveNorm}
            />
        </div>
    );
}
