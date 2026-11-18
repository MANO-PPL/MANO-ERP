import React, { useState, useEffect } from 'react';
import {
    X,
    Package,
    Loader2,
    DollarSign,
    Calendar,
    Layers,
    FileText,
    ArrowRightLeft,
    Info,
    HardHat,
    Truck,
    Plus
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import catalogCache from './catalogCache';
import { showCatalogErrorToast } from './catalogErrors';
import { formatDatePlain, getTodayDateStr } from './catalogFormat';
import { customToast } from '../../utils/toast';

export default function ResourceDrawer({
    isOpen,
    resource = null, // null for create, object for edit
    scope = 'master',
    projectId = null,
    units = [],
    onClose,
    onSuccess
}) {
    const isEditing = Boolean(resource);

    // ─── Core Resource State ──────────────────────────────────────────────────
    const [kind, setKind] = useState('material');
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [baseUnitId, setBaseUnitId] = useState('');
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');

    // ─── Baseline Rate & Costing State (Optional) ─────────────────────────────
    const [rateValue, setRateValue] = useState('');
    const [rateUnitId, setRateUnitId] = useState('');
    const [rateFrom, setRateFrom] = useState(getTodayDateStr());
    const [rateNote, setRateNote] = useState('');
    const [initialLoadedRate, setInitialLoadedRate] = useState(null);
    const [rateLoading, setRateLoading] = useState(false);

    // ─── Operational Packaging & Conversion State (Optional) ──────────────────
    const [pkgUnitId, setPkgUnitId] = useState('');
    const [pkgFactor, setPkgFactor] = useState('');
    const [pkgReason, setPkgReason] = useState('');
    const [initialLoadedConversion, setInitialLoadedConversion] = useState(null);

    // ─── Quick Unit Modal State (On-the-fly Unit Creation) ───────────────────
    const [showQuickUnitModal, setShowQuickUnitModal] = useState(false);
    const [quickUnitTarget, setQuickUnitTarget] = useState('pkg'); // 'pkg' | 'base'
    const [quickUnitCode, setQuickUnitCode] = useState('');
    const [quickUnitName, setQuickUnitName] = useState('');
    const [quickUnitCategory, setQuickUnitCategory] = useState('count');
    const [quickUnitFactor, setQuickUnitFactor] = useState('1');
    const [quickUnitCreating, setQuickUnitCreating] = useState(false);

    const [submitting, setSubmitting] = useState(false);

    // ─── Available Units (Maintained locally & refreshed on open) ───────────
    const [availableUnits, setAvailableUnits] = useState(units || []);

    useEffect(() => {
        if (units && units.length > 0) {
            setAvailableUnits(units);
        }
    }, [units]);

    // Live refresh units from server whenever drawer opens to ensure newly created custom units appear
    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        catalogApi.listUnits().then(fresh => {
            if (active && Array.isArray(fresh) && fresh.length > 0) {
                setAvailableUnits(fresh);
            }
        }).catch(() => {});
        return () => { active = false; };
    }, [isOpen]);

    // Sync state on drawer open or resource change
    useEffect(() => {
        if (!isOpen) return;

        const effectiveUnits = availableUnits.length > 0 ? availableUnits : units;

        if (resource) {
            // Edit Mode: Pre-populate existing resource details
            setKind(resource.kind || 'material');
            setCode(resource.code || '');
            setName(resource.name || '');
            const rBaseUnit = resource.base_unit_id ? String(resource.base_unit_id) : (effectiveUnits[0]?.id ? String(effectiveUnits[0].id) : '');
            setBaseUnitId(rBaseUnit);
            setDescription(resource.description || '');
            setRemarks(resource.remarks || '');

            // Fetch existing rate and packaging conversions in background
            let isMounted = true;
            setRateLoading(true);
            Promise.all([
                catalogApi.getRate(resource.id).catch(() => null),
                catalogApi.listConversions(resource.id).catch(() => [])
            ]).then(([rateData, convData]) => {
                if (!isMounted) return;

                if (rateData) {
                    setRateValue(String(rateData.rate));
                    setRateUnitId(String(rateData.unit_id));
                    setRateFrom(formatDatePlain(rateData.effective_from));
                    setRateNote(rateData.note || '');
                    setInitialLoadedRate(rateData);
                } else {
                    setRateValue('');
                    setRateUnitId(rBaseUnit);
                    setRateFrom(getTodayDateStr());
                    setRateNote('');
                    setInitialLoadedRate(null);
                }

                if (convData && convData.length > 0) {
                    const firstConv = convData[0];
                    setPkgUnitId(String(firstConv.from_unit_id));
                    setPkgFactor(String(Number(firstConv.factor)));
                    setPkgReason(firstConv.reason || '');
                    setInitialLoadedConversion(firstConv);
                } else {
                    setPkgUnitId('');
                    setPkgFactor('');
                    setPkgReason('');
                    setInitialLoadedConversion(null);
                }
            }).finally(() => {
                if (isMounted) setRateLoading(false);
            });

            return () => { isMounted = false; };
        } else {
            // Create Mode: Start with blank / default values
            setKind('material');
            setCode('');
            setName('');
            const defaultUnitId = effectiveUnits[0]?.id ? String(effectiveUnits[0].id) : '';
            setBaseUnitId(defaultUnitId);
            setDescription('');
            setRemarks('');

            // Baseline rate defaults
            setRateValue('');
            setRateUnitId(defaultUnitId);
            setRateFrom(getTodayDateStr());
            setRateNote('');
            setInitialLoadedRate(null);

            // Packaging defaults
            setPkgUnitId('');
            setPkgFactor('');
            setPkgReason('');
            setInitialLoadedConversion(null);

            setRateLoading(false);
        }
    }, [isOpen, resource, availableUnits, units]);

    // Update rateUnitId if user changes baseUnitId and rateUnitId wasn't customized
    const handleBaseUnitChange = (val) => {
        setBaseUnitId(val);
        if (!rateUnitId || rateUnitId === baseUnitId) {
            setRateUnitId(val);
        }
    };

    if (!isOpen) return null;

    // Separate Custom Operational Units from Global Standard System Units
    const customUnits = availableUnits.filter(u => u.org_id !== null && u.org_id !== undefined);
    const standardUnits = availableUnits.filter(u => u.org_id === null || u.org_id === undefined);

    // Derived unit helpers
    const selectedBaseUnit = availableUnits.find(u => String(u.id) === String(baseUnitId));
    const selectedRateUnit = availableUnits.find(u => String(u.id) === String(rateUnitId || baseUnitId));
    const selectedPkgUnit = availableUnits.find(u => String(u.id) === String(pkgUnitId));

    // Quick Create Unit on-the-fly
    const handleQuickCreateUnit = async (e) => {
        if (e) e.preventDefault();
        const trimmedCode = quickUnitCode.trim().toLowerCase().replace(/\s+/g, '');
        const trimmedName = quickUnitName.trim();
        if (!trimmedCode || !trimmedName) {
            customToast.error('Unit code and name are required', 'Missing fields');
            return;
        }
        const factorNum = parseFloat(quickUnitFactor);
        if (isNaN(factorNum) || factorNum <= 0) {
            customToast.error('Conversion factor must be greater than 0', 'Invalid factor');
            return;
        }

        setQuickUnitCreating(true);
        try {
            const created = await catalogApi.createUnit({
                code: trimmedCode,
                name: trimmedName,
                category: quickUnitCategory,
                symbol: trimmedCode,
                toBaseFactor: String(quickUnitFactor).trim()
            });
            customToast.success(`Unit '${trimmedCode}' created`, 'Unit Registered');

            // Refresh units list
            const fresh = await catalogApi.listUnits().catch(() => []);
            if (fresh && fresh.length > 0) {
                setAvailableUnits(fresh);
            } else if (created) {
                setAvailableUnits(prev => [...prev, created]);
            }

            // Auto-select in the target field
            if (quickUnitTarget === 'base') {
                setBaseUnitId(String(created.id));
                if (!rateUnitId || rateUnitId === baseUnitId) {
                    setRateUnitId(String(created.id));
                }
            } else {
                setPkgUnitId(String(created.id));
            }

            setShowQuickUnitModal(false);
            setQuickUnitCode('');
            setQuickUnitName('');
            setQuickUnitCategory('count');
            setQuickUnitFactor('1');
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to create unit');
        } finally {
            setQuickUnitCreating(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedCode = code.trim().toUpperCase();
        const trimmedName = name.trim();

        // 1. Mandatory validation
        if (!trimmedCode || !trimmedName || !baseUnitId) {
            customToast.error('Code, Name, and Base Unit are required.', 'Missing Fields');
            return;
        }

        // 2. Optional Rate validation (only if filled)
        const trimmedRate = rateValue.trim();
        if (trimmedRate) {
            const parsedRate = parseFloat(trimmedRate);
            if (isNaN(parsedRate) || parsedRate < 0) {
                customToast.error('Rate must be a positive number or 0.', 'Invalid Rate');
                return;
            }
        }

        // 3. Optional Packaging validation (only if filled)
        const trimmedPkgFactor = pkgFactor.trim();
        if (pkgUnitId || trimmedPkgFactor) {
            if (!pkgUnitId || !trimmedPkgFactor) {
                customToast.error('Both Packaging Unit and Factor must be provided if defining packaging.', 'Incomplete Packaging');
                return;
            }
            const parsedFactor = parseFloat(trimmedPkgFactor);
            if (isNaN(parsedFactor) || parsedFactor <= 0) {
                customToast.error('Packaging factor must be greater than 0.', 'Invalid Factor');
                return;
            }
            if (String(pkgUnitId) === String(baseUnitId)) {
                customToast.error('Packaging unit must be different from Base Unit.', 'Duplicate Unit');
                return;
            }
        }

        setSubmitting(true);
        try {
            let targetResourceId = resource?.id;

            // ── A. Save / Update Resource ───────────────────────────────────
            if (isEditing) {
                await catalogApi.updateResource(resource.id, {
                    code: trimmedCode,
                    name: trimmedName,
                    baseUnitId: Number(baseUnitId),
                    description: description.trim() || undefined,
                    remarks: remarks.trim() || undefined
                });
                customToast.success(`Resource ${trimmedCode} updated`, 'Resource Updated');
            } else {
                const created = await catalogApi.createResource({
                    projectId: scope === 'project' && projectId ? Number(projectId) : null,
                    kind,
                    code: trimmedCode,
                    name: trimmedName,
                    baseUnitId: Number(baseUnitId),
                    description: description.trim() || undefined,
                    remarks: remarks.trim() || undefined
                });
                targetResourceId = created.id;
                customToast.success(`Resource ${trimmedCode} created`, 'Resource Created');
            }

            // ── B. Save Baseline Rate (Optional) ─────────────────────────────
            if (trimmedRate && targetResourceId) {
                const hasRateChanged = !initialLoadedRate ||
                    String(Number(initialLoadedRate.rate)) !== String(Number(trimmedRate)) ||
                    String(initialLoadedRate.unit_id) !== String(rateUnitId || baseUnitId) ||
                    (initialLoadedRate.note || '') !== rateNote.trim();

                if (hasRateChanged) {
                    try {
                        await catalogApi.setRate(targetResourceId, {
                            rate: trimmedRate,
                            unitId: Number(rateUnitId || baseUnitId),
                            effectiveFrom: rateFrom || getTodayDateStr(),
                            note: rateNote.trim() || (isEditing ? 'Updated baseline rate' : 'Initial baseline rate')
                        });
                        catalogCache.invalidateRate(targetResourceId);
                    } catch (rErr) {
                        showCatalogErrorToast(rErr, 'Resource saved, but rate could not be set');
                    }
                }
            }

            // ── C. Save Operational Packaging (Optional) ─────────────────────
            if (pkgUnitId && trimmedPkgFactor && targetResourceId) {
                const hasConvChanged = !initialLoadedConversion ||
                    String(initialLoadedConversion.from_unit_id) !== String(pkgUnitId) ||
                    String(Number(initialLoadedConversion.factor)) !== String(Number(trimmedPkgFactor));

                if (hasConvChanged) {
                    try {
                        await catalogApi.setConversion(targetResourceId, {
                            fromUnitId: Number(pkgUnitId),
                            toUnitId: Number(baseUnitId),
                            factor: trimmedPkgFactor,
                            reason: pkgReason.trim() || 'Standard packaging'
                        });
                    } catch (cErr) {
                        showCatalogErrorToast(cErr, 'Resource saved, but packaging conversion failed');
                    }
                }
            }

            catalogCache.invalidateResources(scope, projectId);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            showCatalogErrorToast(err, isEditing ? 'Failed to update resource' : 'Failed to create resource');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-gh-border shadow-2xl flex flex-col animate-slide-left">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-gh-subtle/50 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        {kind === 'labour' ? <HardHat size={20} /> : kind === 'equipment' ? <Truck size={20} /> : <Package size={20} />}
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {isEditing ? `Edit Resource: ${resource.code}` : 'Declare New Resource'}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Scope: {scope === 'project' && projectId ? `Project #${projectId}` : 'Master Catalog'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    disabled={submitting}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
                    {/* ─── SECTION 1: CORE IDENTIFICATION (MANDATORY) ─────────── */}
                    <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border pb-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <Layers size={14} className="text-blue-500" />
                                1. Core Specification
                            </span>
                            <span className="text-[10px] text-gray-400">
                                Fields marked <span className="text-red-500 font-bold">*</span> are required
                            </span>
                        </div>

                        {/* Kind (Immutable after creation) */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                Resource Kind <span className="text-red-500">*</span>
                                {isEditing && <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400 lowercase ml-1">(immutable)</span>}
                            </label>
                            <select
                                value={kind}
                                onChange={(e) => setKind(e.target.value)}
                                disabled={isEditing}
                                className={`w-full px-3 py-2 text-xs border rounded-lg ${
                                    isEditing
                                        ? 'bg-gray-100 dark:bg-gh-subtle text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gh-border'
                                        : 'bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500'
                                }`}
                            >
                                <option value="material">Material (Raw materials, fixtures, consumables)</option>
                                <option value="labour">Labour (Trade workers, operators, specialists)</option>
                                <option value="equipment">Equipment (Heavy machinery, tools, vehicles)</option>
                            </select>
                        </div>

                        {/* Code & Name (2 Columns) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                    Resource Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="e.g. MAT-CEM-OPC53"
                                    className="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 uppercase focus:ring-1 focus:ring-blue-500"
                                    required
                                />
                                <span className="text-[10px] text-gray-400">Unique alphanumeric code</span>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                        Base Unit of Measure <span className="text-red-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuickUnitTarget('base');
                                            setQuickUnitCategory('weight');
                                            setQuickUnitFactor('1');
                                            setShowQuickUnitModal(true);
                                        }}
                                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={11} />
                                        New Unit
                                    </button>
                                </div>
                                <select
                                    value={baseUnitId}
                                    onChange={(e) => handleBaseUnitChange(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 font-mono focus:ring-1 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Select base unit of measure...</option>
                                    {customUnits.length > 0 && (
                                        <optgroup label="⭐ Custom Organization Units">
                                            {customUnits.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.code} &mdash; {u.name} (Custom {u.category})
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="Global Standard System Units">
                                        {standardUnits.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.code} &mdash; {u.name} ({u.category})
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                                <span className="text-[10px] text-gray-400">Primary consumption measure</span>
                            </div>
                        </div>

                        {/* Resource Name */}
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                Resource Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Ordinary Portland Cement 53 Grade"
                                className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>

                    {/* ─── SECTION 2: BASELINE RATE & PRICING (OPTIONAL) ──────── */}
                    <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/15 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
                                2. Baseline Rate &amp; Pricing
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                Optional — can submit empty
                            </span>
                        </div>

                        {rateLoading ? (
                            <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                                <Loader2 size={13} className="animate-spin text-emerald-600" />
                                Loading rate history...
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Rate Value (₹)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-xs font-bold text-gray-400">₹</span>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                value={rateValue}
                                                onChange={(e) => setRateValue(e.target.value)}
                                                placeholder="e.g. 450.00"
                                                className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-semibold border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-400">Unit baseline price</span>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Quoted Rate Unit
                                        </label>
                                        <select
                                            value={rateUnitId || baseUnitId}
                                            onChange={(e) => setRateUnitId(e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-emerald-500"
                                        >
                                            {customUnits.length > 0 && (
                                                <optgroup label="⭐ Custom Organization Units">
                                                    {customUnits.map((u) => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.code} &mdash; {u.name} (Custom {u.category})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            <optgroup label="Global Standard System Units">
                                                {standardUnits.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.code} &mdash; {u.name} ({u.category})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        <span className="text-[10px] text-gray-400">Unit for this rate quote</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Effective From Date
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                value={rateFrom}
                                                onChange={(e) => setRateFrom(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-400">Inclusive start date</span>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                            Rate Reference / Note
                                        </label>
                                        <input
                                            type="text"
                                            value={rateNote}
                                            onChange={(e) => setRateNote(e.target.value)}
                                            placeholder="e.g. Q1 Vendor contract price"
                                            className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-emerald-500"
                                        />
                                        <span className="text-[10px] text-gray-400">Tender or supplier note</span>
                                    </div>
                                </div>

                                {rateValue.trim() && (
                                    <div className="p-2 rounded-lg bg-white dark:bg-[#0d1117] border border-emerald-200 dark:border-emerald-900/50 text-[11px] font-mono flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                                        <span>Quoted Rate:</span>
                                        <span className="font-bold">
                                            ₹ {rateValue} / {selectedRateUnit?.code || 'unit'} (Effective {rateFrom})
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ─── SECTION 3: OPERATIONAL PACKAGING (OPTIONAL) ────────── */}
                    <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/15 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                                <ArrowRightLeft size={14} className="text-purple-600 dark:text-purple-400" />
                                3. Operational Packaging / Trade Unit
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                                Optional
                            </span>
                        </div>

                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Define standard procurement trade units (e.g. 1 Bag = 50 kg, 1 Drum = 200 L, 1 Bundle = 100 kg).
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                                        Packaging Trade Unit
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuickUnitTarget('pkg');
                                            setQuickUnitCategory('count');
                                            setQuickUnitFactor('1');
                                            setShowQuickUnitModal(true);
                                        }}
                                        className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={11} />
                                        New Unit
                                    </button>
                                </div>
                                <select
                                    value={pkgUnitId}
                                    onChange={(e) => setPkgUnitId(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500"
                                >
                                    <option value="">None / Base unit only</option>
                                    {customUnits.filter(u => String(u.id) !== String(baseUnitId)).length > 0 && (
                                        <optgroup label="⭐ Custom Operational Units">
                                            {customUnits
                                                .filter(u => String(u.id) !== String(baseUnitId))
                                                .map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.code} &mdash; {u.name} (Custom {u.category})
                                                    </option>
                                                ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="Standard System Units">
                                        {standardUnits
                                            .filter(u => String(u.id) !== String(baseUnitId))
                                            .map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.code} &mdash; {u.name} ({u.category})
                                                </option>
                                            ))}
                                    </optgroup>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Factor (Quantity in Base Unit)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    min="0.0000000001"
                                    value={pkgFactor}
                                    onChange={(e) => setPkgFactor(e.target.value)}
                                    placeholder="e.g. 50 (for 50 kg bag)"
                                    className="w-full px-3 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                        </div>

                        {pkgUnitId && pkgFactor && selectedPkgUnit && selectedBaseUnit && (
                            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-xs space-y-2 font-mono">
                                <div className="flex items-center justify-between text-purple-900 dark:text-purple-200">
                                    <span className="flex items-center gap-1.5 font-bold">
                                        <Package size={13} className="text-purple-600 dark:text-purple-400" />
                                        Packaging Rule:
                                    </span>
                                    <span className="font-bold text-purple-800 dark:text-purple-300 text-xs bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded">
                                        1 {selectedPkgUnit.code} = {pkgFactor} {selectedBaseUnit.code}
                                    </span>
                                </div>

                                {rateValue && !isNaN(parseFloat(rateValue)) && parseFloat(pkgFactor) > 0 && (
                                    <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/40 text-[11px] flex flex-wrap items-center justify-between gap-2">
                                        {String(rateUnitId) === String(pkgUnitId) ? (
                                            <>
                                                <span className="text-purple-700 dark:text-purple-300">
                                                    Quoted: ₹{parseFloat(rateValue).toFixed(2)} / {selectedPkgUnit.code}
                                                </span>
                                                <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                                                    ⚡ Effective Base: ₹{(parseFloat(rateValue) / parseFloat(pkgFactor)).toFixed(2)} / {selectedBaseUnit.code}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-purple-700 dark:text-purple-300">
                                                    Quoted: ₹{parseFloat(rateValue).toFixed(2)} / {selectedBaseUnit.code}
                                                </span>
                                                <span className="font-bold text-purple-900 dark:text-purple-200 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded">
                                                    📦 Package Price: ₹{(parseFloat(rateValue) * parseFloat(pkgFactor)).toFixed(2)} / {selectedPkgUnit.code}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ─── SECTION 4: TECHNICAL SPECS & REMARKS (OPTIONAL) ─────── */}
                    <div className="space-y-3 pt-1">
                        <div className="border-b border-gray-100 dark:border-gh-border pb-1.5 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <FileText size={14} className="text-gray-500" />
                                4. Technical Specs &amp; Remarks
                            </span>
                            <span className="text-[10px] text-gray-400">Optional</span>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                Technical Specifications / Description
                            </label>
                            <textarea
                                rows={2}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g. High early strength OPC complying with IS 12269:2013..."
                                className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">
                                Procurement / Handling Remarks
                            </label>
                            <input
                                type="text"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="e.g. Requires moisture-proof covered storage on wooden pallets"
                                className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-gh-subtle/50">
                    <span className="text-[11px] text-gray-400">
                        {rateValue.trim() ? 'Includes initial rate' : 'No rate specified (can be added later)'}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gh-hover border border-gray-300 dark:border-gh-border rounded-lg hover:bg-gray-100 dark:hover:bg-gh-subtle cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !code.trim() || !name.trim() || !baseUnitId}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            {isEditing ? 'Save Changes' : 'Create Resource'}
                        </button>
                    </div>
                </div>
            </form>

            {/* ─── QUICK ADD CUSTOM UNIT MODAL (INLINE) ──────────────────────── */}
            {showQuickUnitModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
                    <div className="relative w-full max-w-sm bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl p-5 space-y-4">
                        <button
                            type="button"
                            onClick={() => setShowQuickUnitModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                Create New Unit
                            </h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                Add a custom unit to your organization.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Unit Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={quickUnitCode}
                                        onChange={(e) => setQuickUnitCode(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                                        placeholder="e.g. tin, pail"
                                        className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={quickUnitCategory}
                                        onChange={(e) => {
                                            setQuickUnitCategory(e.target.value);
                                            if (e.target.value === 'count') setQuickUnitFactor('1');
                                        }}
                                        className="w-full px-2 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500"
                                    >
                                        <option value="count">Count (nos)</option>
                                        <option value="weight">Weight (kg)</option>
                                        <option value="volume">Volume (m³)</option>
                                        <option value="length">Length (m)</option>
                                        <option value="area">Area (m²)</option>
                                        <option value="time">Time (hr)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Unit Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={quickUnitName}
                                    onChange={(e) => setQuickUnitName(e.target.value)}
                                    placeholder="e.g. Tin Container"
                                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Base Multiplier <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    min="0.0000000001"
                                    value={quickUnitFactor}
                                    onChange={(e) => setQuickUnitFactor(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gh-border">
                            <button
                                type="button"
                                onClick={() => setShowQuickUnitModal(false)}
                                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-hover rounded-lg cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleQuickCreateUnit}
                                disabled={quickUnitCreating || !quickUnitCode.trim() || !quickUnitName.trim()}
                                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {quickUnitCreating && <Loader2 size={12} className="animate-spin" />}
                                Save Unit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
