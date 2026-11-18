import React, { useState, useEffect, useMemo } from 'react';
import {
    Scale,
    Package,
    Plus,
    Edit2,
    Trash2,
    ArrowRightLeft,
    Check,
    AlertCircle,
    Loader2,
    ShieldCheck,
    Wrench,
    Info,
    Search
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import catalogCache from './catalogCache';
import { showCatalogErrorToast } from './catalogErrors';
import { customToast } from '../../utils/toast';
import ConfirmModal from '../../components/ConfirmModal';

export const PACKAGING_CODES = new Set([
    'bag', 'bundle', 'trip', 'load', 'set', 'truck', 'tank', 'drum',
    'tin', 'pail', 'pallet', 'crate', 'carton', 'canister', 'box',
    'box10', 'box50', 'box100', 'cup', 'tbsp', 'tsp', 'bottle',
    'pack', 'packet', 'roll', 'sheet', 'coil', 'barrel', 'bale'
]);

export function isPackagingUnit(u) {
    if (!u) return false;
    const code = (u.code || '').toLowerCase();
    if (PACKAGING_CODES.has(code)) return true;
    if (u.category === 'count' && !['nos', 'pcs', 'pair', 'dozen'].includes(code)) return true;
    return false;
}

export const PACKAGING_PRESETS = [
    { label: 'cup (Cup ~250 ml)', code: 'cup', name: 'Cup Container', symbol: 'cup', factor: '1', note: '1 container = 1 count' },
    { label: 'tbsp (Tablespoon ~15 ml)', code: 'tbsp', name: 'Tablespoon Measure', symbol: 'tbsp', factor: '1', note: '1 measure = 1 count' },
    { label: 'tsp (Teaspoon ~5 ml)', code: 'tsp', name: 'Teaspoon Measure', symbol: 'tsp', factor: '1', note: '1 measure = 1 count' },
    { label: 'bottle (Bottle)', code: 'bottle', name: 'Bottle Container', symbol: 'btl', factor: '1', note: '1 bottle = 1 count' },
    { label: 'drum (Drum / Barrel)', code: 'drum', name: 'Drum Container', symbol: 'drm', factor: '1', note: '1 drum = 1 count' },
    { label: 'bag (Bag)', code: 'bag', name: 'Bag Container', symbol: 'bag', factor: '1', note: '1 bag = 1 count' },
    { label: 'tin (Tin / Can)', code: 'tin', name: 'Tin Container', symbol: 'tin', factor: '1', note: '1 tin = 1 count' },
    { label: 'pail (Pail / Bucket)', code: 'pail', name: 'Pail Container', symbol: 'pail', factor: '1', note: '1 pail = 1 count' },
    { label: 'canister (Canister)', code: 'canister', name: 'Canister Container', symbol: 'can', factor: '1', note: '1 canister = 1 count' },
    { label: 'carton (Carton Box)', code: 'carton', name: 'Carton Box', symbol: 'ctn', factor: '1', note: '1 carton = 1 count' },
    { label: 'crate (Crate)', code: 'crate', name: 'Crate Box', symbol: 'crt', factor: '1', note: '1 crate = 1 count' },
    { label: 'pallet (Pallet)', code: 'pallet', name: 'Wooden Pallet', symbol: 'plt', factor: '1', note: '1 pallet = 1 count' },
    { label: 'box10 (Box of 10)', code: 'box10', name: 'Box of 10 Pieces', symbol: 'bx10', factor: '10', note: '1 box = 10 count' },
    { label: 'box50 (Box of 50)', code: 'box50', name: 'Box of 50 Pieces', symbol: 'bx50', factor: '50', note: '1 box = 50 count' },
    { label: 'box100 (Box of 100)', code: 'box100', name: 'Box of 100 Pieces', symbol: 'bx100', factor: '100', note: '1 box = 100 count' },
];

export const CATEGORY_CONFIG = {
    volume: {
        label: 'Volume',
        baseCode: 'm3',
        baseName: 'Cubic Meter',
        baseSymbol: 'm³',
        description: 'Measures liquid volume, fluid capacity, and bulk space.',
        presets: [
            { label: 'ml (Millilitre)', code: 'ml', name: 'Millilitre', symbol: 'ml', factor: '0.000001', note: '1 m³ = 1,000,000 ml' },
            { label: 'litre (Litre)', code: 'litre', name: 'Litre', symbol: 'L', factor: '0.001', note: '1 m³ = 1,000 L' },
            { label: 'cft (Cubic Foot)', code: 'cft', name: 'Cubic Foot', symbol: 'cft', factor: '0.0283168466', note: '1 cft ≈ 0.028317 m³' },
            { label: 'bbl (Barrel)', code: 'bbl', name: 'Barrel', symbol: 'bbl', factor: '0.1589873', note: '1 bbl ≈ 158.99 L' },
            { label: 'gal (US Gallon)', code: 'gal', name: 'US Gallon', symbol: 'gal', factor: '0.00378541', note: '1 gal ≈ 3.785 L' },
        ]
    },
    weight: {
        label: 'Weight / Mass',
        baseCode: 'kg',
        baseName: 'Kilogram',
        baseSymbol: 'kg',
        description: 'Measures physical mass and heaviness.',
        presets: [
            { label: 'g (Gram)', code: 'g', name: 'Gram', symbol: 'g', factor: '0.001', note: '1 kg = 1,000 g' },
            { label: 'mg (Milligram)', code: 'mg', name: 'Milligram', symbol: 'mg', factor: '0.000001', note: '1 kg = 1,000,000 mg' },
            { label: 'quintal (100 kg)', code: 'quintal', name: 'Quintal', symbol: 'q', factor: '100', note: '1 quintal = 100 kg' },
            { label: 'tonne (1000 kg)', code: 'tonne', name: 'Metric Tonne', symbol: 't', factor: '1000', note: '1 tonne = 1,000 kg' },
            { label: 'lb (Pound)', code: 'lb', name: 'Pound', symbol: 'lb', factor: '0.45359237', note: '1 lb ≈ 0.4536 kg' },
        ]
    },
    count: {
        label: 'Count / Quantity',
        baseCode: 'nos',
        baseName: 'Numbers / Pieces',
        baseSymbol: 'nos',
        description: 'Measures discrete items, packs, and bundled quantities.',
        presets: [
            { label: 'tin (Tin/Can)', code: 'tin', name: 'Tin Container', symbol: 'tin', factor: '1', note: '1 container = 1 nos (capacity is set per material)' },
            { label: 'pail (Pail/Bucket)', code: 'pail', name: 'Pail Container', symbol: 'pail', factor: '1', note: '1 container = 1 nos (capacity is set per material)' },
            { label: 'pallet (Pallet)', code: 'pallet', name: 'Wooden Pallet', symbol: 'plt', factor: '1', note: '1 pallet = 1 nos (capacity is set per material)' },
            { label: 'crate (Crate)', code: 'crate', name: 'Crate Box', symbol: 'crt', factor: '1', note: '1 crate = 1 nos (capacity is set per material)' },
            { label: 'carton (Carton)', code: 'carton', name: 'Carton Box', symbol: 'ctn', factor: '1', note: '1 carton = 1 nos (capacity is set per material)' },
            { label: 'canister (Canister)', code: 'canister', name: 'Canister', symbol: 'can', factor: '1', note: '1 canister = 1 nos (capacity is set per material)' },
            { label: 'pcs (Piece)', code: 'pcs', name: 'Piece', symbol: 'pcs', factor: '1', note: '1 piece = 1 nos' },
            { label: 'pair (2 pcs)', code: 'pair', name: 'Pair', symbol: 'pr', factor: '2', note: '1 pair = 2 nos' },
            { label: 'dozen (12 pcs)', code: 'dozen', name: 'Dozen', symbol: 'dz', factor: '12', note: '1 dozen = 12 nos' },
            { label: 'box10 (Box of 10)', code: 'box10', name: 'Box of 10 Pieces', symbol: 'bx10', factor: '10', note: '1 box = 10 nos' },
            { label: 'box50 (Box of 50)', code: 'box50', name: 'Box of 50 Pieces', symbol: 'bx50', factor: '50', note: '1 box = 50 nos' },
            { label: 'box100 (Box of 100)', code: 'box100', name: 'Box of 100 Pieces', symbol: 'bx100', factor: '100', note: '1 box = 100 nos' },
            { label: 'gross (144 pcs)', code: 'gross', name: 'Gross', symbol: 'grs', factor: '144', note: '1 gross = 144 nos' },
        ]
    },
    length: {
        label: 'Length / Distance',
        baseCode: 'm',
        baseName: 'Meter',
        baseSymbol: 'm',
        description: 'Measures linear span, height, depth, and distance.',
        presets: [
            { label: 'mm (Millimeter)', code: 'mm', name: 'Millimeter', symbol: 'mm', factor: '0.001', note: '1 m = 1,000 mm' },
            { label: 'cm (Centimeter)', code: 'cm', name: 'Centimeter', symbol: 'cm', factor: '0.01', note: '1 m = 100 cm' },
            { label: 'in (Inch)', code: 'in', name: 'Inch', symbol: 'in', factor: '0.0254', note: '1 in = 25.4 mm' },
            { label: 'ft (Foot)', code: 'ft', name: 'Foot', symbol: 'ft', factor: '0.3048', note: '1 ft = 0.3048 m' },
            { label: 'yd (Yard)', code: 'yd', name: 'Yard', symbol: 'yd', factor: '0.9144', note: '1 yd = 0.9144 m' },
            { label: 'km (Kilometer)', code: 'km', name: 'Kilometer', symbol: 'km', factor: '1000', note: '1 km = 1,000 m' },
            { label: 'rm (Running Meter)', code: 'rm', name: 'Running Meter', symbol: 'rm', factor: '1', note: '1 rm = 1 m' },
        ]
    },
    area: {
        label: 'Area / Surface',
        baseCode: 'm2',
        baseName: 'Square Meter',
        baseSymbol: 'm²',
        description: 'Measures two-dimensional floor and surface coverage.',
        presets: [
            { label: 'sqft (Square Foot)', code: 'sqft', name: 'Square Foot', symbol: 'sqft', factor: '0.09290304', note: '1 sqft ≈ 0.0929 m²' },
            { label: 'sqyd (Square Yard)', code: 'sqyd', name: 'Square Yard', symbol: 'sqyd', factor: '0.83612736', note: '1 sqyd ≈ 0.8361 m²' },
            { label: 'acre (Acre)', code: 'acre', name: 'Acre', symbol: 'ac', factor: '4046.85642', note: '1 acre ≈ 4,046.86 m²' },
            { label: 'ha (Hectare)', code: 'ha', name: 'Hectare', symbol: 'ha', factor: '10000', note: '1 hectare = 10,000 m²' },
        ]
    },
    time: {
        label: 'Time / Duration',
        baseCode: 'hr',
        baseName: 'Hour',
        baseSymbol: 'hr',
        description: 'Measures labour shifts, equipment runtime, and task duration.',
        presets: [
            { label: 'min (Minute)', code: 'min', name: 'Minute', symbol: 'min', factor: '0.0166666667', note: '60 min = 1 hr' },
            { label: 'shift (8 hr)', code: 'day8', name: 'Work Shift (8 hr)', symbol: 'shift', factor: '8', note: '1 shift = 8 hr' },
            { label: 'day (24 hr)', code: 'day24', name: 'Full Day (24 hr)', symbol: 'day', factor: '24', note: '1 day = 24 hr' },
            { label: 'wk (48 hr)', code: 'wk48', name: 'Work Week (48 hr)', symbol: 'wk', factor: '48', note: '1 work week = 48 hr' },
        ]
    }
};

export default function UnitsTab({
    units = [],
    onUnitsUpdated
}) {
    // Separate standard units (global, org_id is null) from custom tenant units (org_id is set)
    const standardUnits = units.filter(u => u.org_id === null || u.org_id === undefined);
    const customUnits = units.filter(u => u.org_id !== null && u.org_id !== undefined);

    // Create / Edit Custom Unit Modal State
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [unitCode, setUnitCode] = useState('');
    const [unitName, setUnitName] = useState('');
    const [unitCategory, setUnitCategory] = useState('volume');
    const [unitSymbol, setUnitSymbol] = useState('');
    const [unitFactor, setUnitFactor] = useState('1');
    const [submittingUnit, setSubmittingUnit] = useState(false);

    // Delete Custom Unit State
    const [unitToDelete, setUnitToDelete] = useState(null);
    const [deletingUnit, setDeletingUnit] = useState(false);

    // Converter Tool State
    const [convertQty, setConvertQty] = useState('1');
    const [convertFrom, setConvertFrom] = useState(units[0]?.code || 'kg');
    const [convertTo, setConvertTo] = useState(units[1]?.code || 'tonne');
    const [convertResourceId, setConvertResourceId] = useState('');
    const [availableResources, setAvailableResources] = useState([]);
    const [convertResult, setConvertResult] = useState(null);
    const [converting, setConverting] = useState(false);
    const [convertError, setConvertError] = useState('');

    // Load resources for converter optional resource picker
    useEffect(() => {
        const fetchResources = async () => {
            try {
                const cached = catalogCache.getResources('master');
                if (cached) {
                    setAvailableResources(cached.filter(r => r.status === 'active'));
                    return;
                }
                const list = await catalogApi.listResources({ scope: 'master', status: 'active' });
                setAvailableResources(list || []);
            } catch (_) {}
        };
        fetchResources();
    }, []);

    // Set initial converter units when units list loads
    useEffect(() => {
        if (units.length >= 2 && !convertFrom && !convertTo) {
            setConvertFrom(units[0].code);
            setConvertTo(units[1].code);
        }
    }, [units]);

    // Handle Unit Conversion
    const handleConvert = async (e) => {
        if (e) e.preventDefault();
        if (!convertQty.trim() || !convertFrom || !convertTo) return;

        setConverting(true);
        setConvertError('');
        setConvertResult(null);

        try {
            const res = await catalogApi.convertUnits({
                qty: convertQty.trim(),
                from: convertFrom,
                to: convertTo,
                resourceId: convertResourceId ? Number(convertResourceId) : undefined
            });
            setConvertResult(res);
        } catch (err) {
            const msg = showCatalogErrorToast(err, 'Conversion failed');
            setConvertError(msg);
        } finally {
            setConverting(false);
        }
    };

    // Swap From and To
    const handleSwapUnits = () => {
        const temp = convertFrom;
        setConvertFrom(convertTo);
        setConvertTo(temp);
        setConvertResult(null);
    };

    // Unit Form helpers
    const currentCategoryConfig = CATEGORY_CONFIG[unitCategory] || CATEGORY_CONFIG.volume;

    const handleCodeChange = (e) => {
        const val = e.target.value.toLowerCase().replace(/\s+/g, '');
        setUnitCode(val);
        // If symbol is empty or matched previous code, keep in sync
        if (!unitSymbol || unitSymbol.toLowerCase() === unitCode.toLowerCase()) {
            setUnitSymbol(val);
        }
    };

    const handleApplyPreset = (p) => {
        if (!editingUnit) {
            if (!unitCode || unitCode === 'unit') setUnitCode(p.code);
            if (!unitName) setUnitName(p.name);
        }
        setUnitSymbol(p.symbol);
        setUnitFactor(p.factor);
    };

    // Open Unit Drawer
    const openCreateUnit = () => {
        setEditingUnit(null);
        setUnitCode('');
        setUnitName('');
        setUnitCategory('volume');
        setUnitSymbol('');
        setUnitFactor('1');
        setIsUnitModalOpen(true);
    };

    const openEditUnit = (u) => {
        setEditingUnit(u);
        setUnitCode(u.code);
        setUnitName(u.name);
        setUnitCategory(u.category || 'volume');
        setUnitSymbol(u.symbol || u.code || '');
        setUnitFactor(u.to_base_factor ? String(Number(u.to_base_factor)) : '1');
        setIsUnitModalOpen(true);
    };

    const handleSaveUnit = async (e) => {
        e.preventDefault();
        const trimmedCode = unitCode.trim().toLowerCase();
        const trimmedName = unitName.trim();
        const trimmedSymbol = unitSymbol.trim() || trimmedCode;
        const factorNum = parseFloat(unitFactor);

        if (!trimmedCode || !trimmedName) {
            customToast.error('Code and Name are required.', 'Missing Fields');
            return;
        }

        if (isNaN(factorNum) || factorNum <= 0) {
            customToast.error('Conversion factor must be a positive number greater than 0.', 'Invalid Factor');
            return;
        }

        setSubmittingUnit(true);
        try {
            if (editingUnit) {
                await catalogApi.updateUnit(editingUnit.id, {
                    name: trimmedName,
                    category: unitCategory,
                    symbol: trimmedSymbol,
                    toBaseFactor: unitFactor.trim()
                });
                customToast.success(`Unit ${trimmedCode} updated`, 'Unit Saved');
            } else {
                await catalogApi.createUnit({
                    code: trimmedCode,
                    name: trimmedName,
                    category: unitCategory,
                    symbol: trimmedSymbol,
                    toBaseFactor: unitFactor.trim()
                });
                customToast.success(`Custom unit ${trimmedCode} created`, 'Unit Created');
            }

            setIsUnitModalOpen(false);
            if (onUnitsUpdated) onUnitsUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to save unit');
        } finally {
            setSubmittingUnit(false);
        }
    };

    const handleConfirmDeleteUnit = async () => {
        if (!unitToDelete) return;
        setDeletingUnit(true);
        try {
            await catalogApi.deleteUnit(unitToDelete.id);
            customToast.success(`Custom unit "${unitToDelete.code}" deleted successfully`, 'Unit Deleted');
            setUnitToDelete(null);
            if (onUnitsUpdated) onUnitsUpdated();
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to delete unit');
        } finally {
            setDeletingUnit(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ─── Exact Decimal Unit Converter Card ─────────────────────────── */}
            <div className="bg-white dark:bg-[#161b22] p-6 rounded-xl border border-gray-200 dark:border-gh-border shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        <ArrowRightLeft size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            Exact Decimal Unit Converter
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Powered by the Catalog exact 10-decimal conversion engine. Supports metric, imperial, time, and custom resource packaging conversions.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleConvert} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-3">
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                Quantity
                            </label>
                            <input
                                type="text"
                                value={convertQty}
                                onChange={(e) => setConvertQty(e.target.value)}
                                placeholder="1"
                                className="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                                required
                            />
                        </div>

                        <div className="sm:col-span-3">
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                From Unit
                            </label>
                            <select
                                value={convertFrom}
                                onChange={(e) => setConvertFrom(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                            >
                                {units.map((u) => (
                                    <option key={u.id} value={u.code}>
                                        {u.code} &mdash; {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="sm:col-span-1 flex justify-center pb-1">
                            <button
                                type="button"
                                onClick={handleSwapUnits}
                                className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors"
                                title="Swap units"
                            >
                                <ArrowRightLeft size={16} />
                            </button>
                        </div>

                        <div className="sm:col-span-3">
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                To Unit
                            </label>
                            <select
                                value={convertTo}
                                onChange={(e) => setConvertTo(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100"
                            >
                                {units.map((u) => (
                                    <option key={u.id} value={u.code}>
                                        {u.code} &mdash; {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <button
                                type="submit"
                                disabled={converting || !convertQty.trim()}
                                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                            >
                                {converting && <Loader2 size={12} className="animate-spin" />}
                                Convert
                            </button>
                        </div>
                    </div>

                    {/* Optional Resource Link for Packaging Conversions */}
                    <div className="flex items-center gap-3 pt-1">
                        <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            Resource Context (optional for bag &harr; kg conversions):
                        </label>
                        <select
                            value={convertResourceId}
                            onChange={(e) => setConvertResourceId(e.target.value)}
                            className="px-2.5 py-1 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 max-w-xs"
                        >
                            <option value="">No resource (standard conversions only)</option>
                            {availableResources.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.code} - {r.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Result Display */}
                    {convertResult !== null && (
                        <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Check size={18} className="text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <span className="text-xs text-gray-600 dark:text-gray-300">Converted Value:</span>
                                    <div className="text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                        {convertQty} {convertFrom} = {convertResult} {convertTo}
                                    </div>
                                </div>
                            </div>
                            <span className="text-[11px] font-mono text-gray-500">
                                Exact 10-decimal result
                            </span>
                        </div>
                    )}

                    {convertError && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{convertError}</span>
                        </div>
                    )}
                </form>
            </div>

            {/* ─── Units Registry: Side-by-Side Responsive Grid ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* ─── Custom Organization Operational Units ─────────────────── */}
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-gray-200 dark:border-gh-border shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
                                <Wrench size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    Custom Operational Units
                                </h3>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Tenant packaging &amp; trade measures
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={openCreateUnit}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs cursor-pointer shrink-0"
                        >
                            <Plus size={14} />
                            New Custom Unit
                        </button>
                    </div>

                    {customUnits.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gh-subtle rounded-xl border border-dashed border-gray-300 dark:border-gh-border text-gray-400 text-xs">
                            No custom units defined yet. Click "New Custom Unit" to add organization-specific units.
                        </div>
                    ) : (
                        <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50/80 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase sticky top-0 z-10">
                                        <tr>
                                            <th className="py-2.5 px-3.5 font-mono">Code</th>
                                            <th className="py-2.5 px-3.5">Name</th>
                                            <th className="py-2.5 px-3.5">Category</th>
                                            <th className="py-2.5 px-3.5">Symbol</th>
                                            <th className="py-2.5 px-3.5">Base Ratio</th>
                                            <th className="py-2.5 px-3.5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                        {customUnits.map((u) => {
                                            const catBase = CATEGORY_CONFIG[u.category]?.baseCode || 'base';
                                            return (
                                                <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-gh-hover/30">
                                                    <td className="py-2.5 px-3.5 font-mono font-bold text-purple-600 dark:text-purple-400">
                                                        {u.code}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 font-medium text-gray-900 dark:text-gray-100">
                                                        {u.name}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 capitalize text-gray-600 dark:text-gray-300">
                                                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                                            {u.category || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3.5 font-mono text-gray-600 dark:text-gray-400">
                                                        {u.symbol || u.code}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 font-mono text-gray-700 dark:text-gray-300 text-xs">
                                                        1 {u.code} = {Number(u.to_base_factor)} {catBase}
                                                    </td>
                                                    <td className="py-2.5 px-3.5 text-right space-x-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditUnit(u)}
                                                            className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                            title="Edit Unit"
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setUnitToDelete(u)}
                                                            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                            title="Delete Unit"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Standard System Units (Read-Only) ─────────────────────── */}
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-gray-200 dark:border-gh-border shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gh-subtle text-gray-700 dark:text-gray-300 shrink-0">
                                <ShieldCheck size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    Global Standard System Units
                                </h3>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    IS &amp; metric standard system registry
                                </p>
                            </div>
                        </div>
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gh-subtle text-gray-600 dark:text-gray-300 shrink-0">
                            {standardUnits.length} units
                        </span>
                    </div>

                    <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50/80 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="py-2.5 px-3.5 font-mono">Code</th>
                                        <th className="py-2.5 px-3.5">Name</th>
                                        <th className="py-2.5 px-3.5">Category</th>
                                        <th className="py-2.5 px-3.5">Symbol</th>
                                        <th className="py-2.5 px-3.5 text-right">Base Conversion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                    {standardUnits.map((u) => {
                                        const catBase = CATEGORY_CONFIG[u.category]?.baseCode || 'base';
                                        const isBase = Number(u.is_base) === 1;
                                        return (
                                            <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-gh-hover/30">
                                                <td className="py-2.5 px-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                                                    {u.code}
                                                </td>
                                                <td className="py-2.5 px-3.5 font-medium text-gray-900 dark:text-gray-100">
                                                    {u.name}
                                                </td>
                                                <td className="py-2.5 px-3.5 capitalize text-gray-600 dark:text-gray-300">
                                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gh-subtle text-gray-700 dark:text-gray-300">
                                                        {u.category || '—'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3.5 font-mono text-gray-600 dark:text-gray-400">
                                                    {u.symbol || u.code}
                                                </td>
                                                <td className="py-2.5 px-3.5 font-mono text-right">
                                                    {isBase ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            Canonical Base (1.0)
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-600 dark:text-gray-400 text-xs">
                                                            1 {u.code} = {Number(u.to_base_factor)} {catBase}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create/Edit Custom Unit Modal */}
            {isUnitModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsUnitModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                            &times;
                        </button>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                            {editingUnit ? `Edit Custom Unit: ${editingUnit.code}` : 'Create Custom Operational Unit'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Custom units are scoped to your organization with mathematically verified conversion factors.
                        </p>

                        <form onSubmit={handleSaveUnit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Unit Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={unitCode}
                                        onChange={handleCodeChange}
                                        disabled={Boolean(editingUnit)}
                                        placeholder="e.g. ml, box10, drum"
                                        className={`w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg ${
                                            editingUnit
                                                ? 'bg-gray-100 dark:bg-gh-subtle text-gray-400 cursor-not-allowed'
                                                : 'bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500'
                                        }`}
                                        required
                                    />
                                    <span className="text-[10px] text-gray-400">Unique identifier</span>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Display Symbol <span className="text-gray-400 font-normal">(for reports/print)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={unitSymbol}
                                        onChange={(e) => setUnitSymbol(e.target.value)}
                                        placeholder="e.g. ml, bx10, drm"
                                        className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                    />
                                    <span className="text-[10px] text-gray-400">Notation label</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Unit Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={unitName}
                                    onChange={(e) => setUnitName(e.target.value)}
                                    placeholder="e.g. Millilitre or Box of 10 Pieces"
                                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Physical Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={unitCategory}
                                    onChange={(e) => setUnitCategory(e.target.value)}
                                    disabled={Boolean(editingUnit)}
                                    className={`w-full px-2.5 py-1.5 text-xs border rounded-lg ${
                                        editingUnit
                                            ? 'bg-gray-100 dark:bg-gh-subtle text-gray-400 cursor-not-allowed'
                                            : 'bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500'
                                    }`}
                                >
                                    <option value="volume">Volume (Canonical Base: m³)</option>
                                    <option value="weight">Weight / Mass (Canonical Base: kg)</option>
                                    <option value="count">Count / Quantity (Canonical Base: nos)</option>
                                    <option value="length">Length / Distance (Canonical Base: m)</option>
                                    <option value="area">Area / Surface (Canonical Base: m²)</option>
                                    <option value="time">Time / Duration (Canonical Base: hr)</option>
                                </select>
                            </div>

                            {/* Dynamic Base Unit & Conversion Factor Card */}
                            <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                        <Info size={13} className="text-blue-500" />
                                        Category Canonical Base:
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                        {currentCategoryConfig.baseCode} ({currentCategoryConfig.baseName})
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Conversion Multiplier to Base Unit ({currentCategoryConfig.baseCode}) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.0000000001"
                                        value={unitFactor}
                                        onChange={(e) => setUnitFactor(e.target.value)}
                                        placeholder="e.g. 0.000001, 10, or 1000"
                                        className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                        required
                                    />
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                        How many <strong>{currentCategoryConfig.baseCode}</strong> equal 1 <strong>{unitCode.trim() || 'unit'}</strong>?
                                    </p>
                                </div>

                                {/* Live Formula Display */}
                                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0d1117] border border-blue-100 dark:border-blue-900/40 text-xs flex items-center justify-between font-mono">
                                    <span className="text-gray-500 dark:text-gray-400 text-[11px]">Live Ratio:</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                        1 <span className="text-blue-600 dark:text-blue-400">{unitCode.trim() || 'unit'}</span> = <span className="text-emerald-600 dark:text-emerald-400 font-bold">{unitFactor || '?'}</span> {currentCategoryConfig.baseCode}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsUnitModalOpen(false)}
                                    disabled={submittingUnit}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gh-hover rounded-lg hover:bg-gray-200 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingUnit || !unitCode.trim() || !unitName.trim()}
                                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                    {submittingUnit && <Loader2 size={12} className="animate-spin" />}
                                    {editingUnit ? 'Save Changes' : 'Create Unit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Delete Confirmation Modal ─────────────────────────────────── */}
            <ConfirmModal
                isOpen={Boolean(unitToDelete)}
                onClose={() => setUnitToDelete(null)}
                onConfirm={handleConfirmDeleteUnit}
                title={`Delete Custom Unit "${unitToDelete?.code}"?`}
                message={
                    <span>
                        Are you sure you want to permanently delete custom unit <strong className="text-gray-900 dark:text-white">{unitToDelete?.name} ({unitToDelete?.code})</strong>?
                        <br />
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 block">
                            Units can only be deleted if they are not in use by any resource, activity norm, commercial rate, or packaging conversion.
                        </span>
                    </span>
                }
                confirmText="Delete Unit"
                cancelText="Cancel"
                variant="danger"
                isLoading={deletingUnit}
            />
        </div>
    );
}

