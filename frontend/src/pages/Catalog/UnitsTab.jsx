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
    // Partition units into real physical metric dimensions and packaging/trade measures
    const physicalMetricUnits = useMemo(() => units.filter(u => !isPackagingUnit(u)), [units]);
    const packagingUnits = useMemo(() => units.filter(u => isPackagingUnit(u)), [units]);
    const isLoading = units.length === 0;

    // Filter states
    const [metricCategoryFilter, setMetricCategoryFilter] = useState('all');
    const [metricSearch, setMetricSearch] = useState('');
    const [packagingSearch, setPackagingSearch] = useState('');

    // Create / Edit Unit Modal State
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [creationMode, setCreationMode] = useState('physical'); // 'physical' | 'packaging'
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

    // Filtered lists for both panels
    const filteredMetricUnits = useMemo(() => {
        return physicalMetricUnits.filter(u => {
            if (metricCategoryFilter !== 'all' && u.category !== metricCategoryFilter) return false;
            if (metricSearch.trim()) {
                const s = metricSearch.trim().toLowerCase();
                const matchCode = (u.code || '').toLowerCase().includes(s);
                const matchName = (u.name || '').toLowerCase().includes(s);
                const matchSymbol = (u.symbol || '').toLowerCase().includes(s);
                if (!matchCode && !matchName && !matchSymbol) return false;
            }
            return true;
        });
    }, [physicalMetricUnits, metricCategoryFilter, metricSearch]);

    const filteredPackagingUnits = useMemo(() => {
        return packagingUnits.filter(u => {
            if (packagingSearch.trim()) {
                const s = packagingSearch.trim().toLowerCase();
                const matchCode = (u.code || '').toLowerCase().includes(s);
                const matchName = (u.name || '').toLowerCase().includes(s);
                const matchSymbol = (u.symbol || '').toLowerCase().includes(s);
                if (!matchCode && !matchName && !matchSymbol) return false;
            }
            return true;
        });
    }, [packagingUnits, packagingSearch]);

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

    // Open Unit Modal for Physical Metrics or Packaging Containers
    const openCreatePhysicalUnit = () => {
        setEditingUnit(null);
        setCreationMode('physical');
        setUnitCode('');
        setUnitName('');
        setUnitCategory(metricCategoryFilter !== 'all' ? metricCategoryFilter : 'volume');
        setUnitSymbol('');
        setUnitFactor('1');
        setIsUnitModalOpen(true);
    };

    const openCreatePackagingUnit = () => {
        setEditingUnit(null);
        setCreationMode('packaging');
        setUnitCode('');
        setUnitName('');
        setUnitCategory('count');
        setUnitSymbol('');
        setUnitFactor('1');
        setIsUnitModalOpen(true);
    };

    const openEditUnit = (u) => {
        setEditingUnit(u);
        setCreationMode(isPackagingUnit(u) ? 'packaging' : 'physical');
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
                {/* ─── Left Panel: Physical Metric Dimensions ("Real Metrics") ─── */}
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-gray-200 dark:border-gh-border shadow-xs space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                                <Scale size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                    Physical Metric Dimensions
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                        {filteredMetricUnits.length}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Continuous physical SI units (Volume, Weight, Length, Area, Time, Count)
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={openCreatePhysicalUnit}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs cursor-pointer shrink-0"
                        >
                            <Plus size={14} />
                            Add Metric Unit
                        </button>
                    </div>

                    {/* Category Filter Pills & Search */}
                    <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap gap-1">
                            {['all', 'volume', 'weight', 'length', 'area', 'time', 'count'].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setMetricCategoryFilter(cat)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                                        metricCategoryFilter === cat
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gh-subtle dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-hover'
                                    }`}
                                >
                                    {cat === 'all' ? 'All Metrics' : CATEGORY_CONFIG[cat]?.label?.split(' ')[0] || cat}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                value={metricSearch}
                                onChange={(e) => setMetricSearch(e.target.value)}
                                placeholder="Filter metric units by code or name..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <Loader2 size={20} className="animate-spin mb-2 text-blue-500" />
                            <span className="text-xs">Loading physical metric units...</span>
                        </div>
                    ) : filteredMetricUnits.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 dark:bg-gh-subtle rounded-xl border border-dashed border-gray-300 dark:border-gh-border text-gray-400 text-xs">
                            No physical metric units match your filter.
                        </div>
                    ) : (
                        <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50/80 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase sticky top-0 z-10">
                                        <tr>
                                            <th className="py-2 px-3 font-mono">Code</th>
                                            <th className="py-2 px-3">Name</th>
                                            <th className="py-2 px-3">Dimension</th>
                                            <th className="py-2 px-3">Symbol</th>
                                            <th className="py-2 px-3">Base Ratio</th>
                                            <th className="py-2 px-3 text-right">Scope / Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                        {filteredMetricUnits.map((u) => {
                                            const catBase = CATEGORY_CONFIG[u.category]?.baseCode || 'base';
                                            const isBase = Number(u.is_base) === 1;
                                            const isCustom = u.org_id !== null && u.org_id !== undefined;

                                            return (
                                                <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-gh-hover/30">
                                                    <td className="py-2 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                                                        {u.code}
                                                    </td>
                                                    <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                        {u.name}
                                                    </td>
                                                    <td className="py-2 px-3 capitalize">
                                                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gh-subtle text-gray-700 dark:text-gray-300">
                                                            {u.category || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 font-mono text-gray-600 dark:text-gray-400">
                                                        {u.symbol || u.code}
                                                    </td>
                                                    <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300 text-xs">
                                                        {isBase ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                Base (1.0)
                                                            </span>
                                                        ) : (
                                                            <span>1 {u.code} = {Number(u.to_base_factor)} {catBase}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3 text-right whitespace-nowrap">
                                                        {isCustom ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 mr-1">
                                                                    Custom
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEditUnit(u)}
                                                                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                                    title="Edit Unit"
                                                                >
                                                                    <Edit2 size={13} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setUnitToDelete(u)}
                                                                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                                    title="Delete Unit"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                                                                <ShieldCheck size={11} className="text-gray-400" /> System
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
                    )}
                </div>

                {/* ─── Right Panel: Packaging & Trade Measures ───────────────── */}
                <div className="bg-white dark:bg-[#161b22] p-5 rounded-xl border border-gray-200 dark:border-gh-border shadow-xs space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
                                <Package size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                    Packaging &amp; Trade Measures
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                        {filteredPackagingUnits.length}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Containers, multipacks &amp; cross-category trade units (cup, bag, drum, bottle, box...)
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={openCreatePackagingUnit}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs cursor-pointer shrink-0"
                        >
                            <Plus size={14} />
                            Add Packaging Unit
                        </button>
                    </div>

                    {/* Explanatory Info Card */}
                    <div className="p-2.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 text-[11px] text-purple-900 dark:text-purple-300 leading-relaxed flex items-start gap-2">
                        <Info size={14} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                        <span>
                            <strong>Packaging Units</strong> represent trade containers or multi-packs. Their material-specific capacity (e.g. <em>1 cup = 250 ml</em>, <em>1 bag = 50 kg</em>) is defined per resource under <strong>Resource Details &rarr; Packaging Conversions</strong>.
                        </span>
                    </div>

                    {/* Search bar */}
                    <div className="relative pt-1">
                        <Search size={14} className="absolute left-2.5 top-3 text-gray-400" />
                        <input
                            type="text"
                            value={packagingSearch}
                            onChange={(e) => setPackagingSearch(e.target.value)}
                            placeholder="Filter packaging units by code or container name..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <Loader2 size={20} className="animate-spin mb-2 text-purple-500" />
                            <span className="text-xs">Loading packaging units...</span>
                        </div>
                    ) : filteredPackagingUnits.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 dark:bg-gh-subtle rounded-xl border border-dashed border-gray-300 dark:border-gh-border text-gray-400 text-xs">
                            No packaging units match your search.
                        </div>
                    ) : (
                        <div className="border border-gray-200 dark:border-gh-border rounded-xl overflow-hidden">
                            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50/80 dark:bg-gh-subtle border-b border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-400 font-semibold uppercase sticky top-0 z-10">
                                        <tr>
                                            <th className="py-2 px-3 font-mono">Code</th>
                                            <th className="py-2 px-3">Name</th>
                                            <th className="py-2 px-3">Registry Ratio</th>
                                            <th className="py-2 px-3">Symbol</th>
                                            <th className="py-2 px-3 text-right">Scope / Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gh-border">
                                        {filteredPackagingUnits.map((u) => {
                                            const isCustom = u.org_id !== null && u.org_id !== undefined;

                                            return (
                                                <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-gh-hover/30">
                                                    <td className="py-2 px-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                                                        {u.code}
                                                    </td>
                                                    <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                                                        {u.name}
                                                    </td>
                                                    <td className="py-2 px-3 font-mono text-gray-600 dark:text-gray-300 text-xs">
                                                        1 {u.code} = {Number(u.to_base_factor || 1)} count
                                                    </td>
                                                    <td className="py-2 px-3 font-mono text-gray-600 dark:text-gray-400">
                                                        {u.symbol || u.code}
                                                    </td>
                                                    <td className="py-2 px-3 text-right whitespace-nowrap">
                                                        {isCustom ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 mr-1">
                                                                    Custom
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEditUnit(u)}
                                                                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                                    title="Edit Unit"
                                                                >
                                                                    <Edit2 size={13} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setUnitToDelete(u)}
                                                                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gh-hover transition-colors cursor-pointer"
                                                                    title="Delete Unit"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                                                                <ShieldCheck size={11} className="text-gray-400" /> System
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
                    )}
                </div>
            </div>

            {/* Create/Edit Unit Modal */}
            {isUnitModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsUnitModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        >
                            &times;
                        </button>

                        <div className="mb-4">
                            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                                {editingUnit
                                    ? `Edit Unit: ${editingUnit.code}`
                                    : creationMode === 'packaging'
                                    ? 'Add Packaging / Trade Container Unit'
                                    : 'Add Physical Metric Dimension Unit'}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {creationMode === 'packaging'
                                    ? 'Define a container, measure, or multipack. Link its capacity per material under Resource Details.'
                                    : 'Define a physical scientific unit with an invariant ratio to the canonical SI base.'}
                            </p>
                        </div>

                        {/* Mode Switcher (only for new units) */}
                        {!editingUnit && (
                            <div className="flex rounded-lg bg-gray-100 dark:bg-gh-subtle p-1 mb-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreationMode('physical');
                                        setUnitCategory('volume');
                                    }}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                        creationMode === 'physical'
                                            ? 'bg-white dark:bg-[#161b22] text-blue-600 dark:text-blue-400 shadow-xs'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                    }`}
                                >
                                    Physical Metric Unit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreationMode('packaging');
                                        setUnitCategory('count');
                                    }}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                        creationMode === 'packaging'
                                            ? 'bg-white dark:bg-[#161b22] text-purple-600 dark:text-purple-400 shadow-xs'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                    }`}
                                >
                                    Packaging / Trade Container
                                </button>
                            </div>
                        )}

                        {/* Quick Presets */}
                        {!editingUnit && (
                            <div className="mb-4 p-3 bg-gray-50 dark:bg-gh-subtle rounded-xl border border-gray-200 dark:border-gh-border">
                                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                                    {creationMode === 'packaging' ? 'Common Packaging Presets (Click to autofill):' : `Common ${currentCategoryConfig.label} Presets:`}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {(creationMode === 'packaging' ? PACKAGING_PRESETS : (currentCategoryConfig.presets || [])).map((p) => (
                                        <button
                                            key={p.code}
                                            type="button"
                                            onClick={() => handleApplyPreset(p)}
                                            className="px-2 py-1 text-[11px] rounded bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border text-gray-800 dark:text-gray-200 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 transition-colors cursor-pointer"
                                            title={p.note}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

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
                                        placeholder="e.g. ml, cup, drum"
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
                                        placeholder="e.g. ml, cup, drm"
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
                                    placeholder="e.g. Millilitre or Cup Container (~250 ml)"
                                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            {creationMode === 'physical' ? (
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
                            ) : null}

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
                                        {creationMode === 'packaging'
                                            ? 'Count Multiplier (1 for single container, N for multipack)'
                                            : `Conversion Multiplier to Base Unit (${currentCategoryConfig.baseCode})`} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.0000000001"
                                        value={unitFactor}
                                        onChange={(e) => setUnitFactor(e.target.value)}
                                        placeholder="e.g. 0.000001, 1, or 10"
                                        className="w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-white dark:bg-[#0d1117] border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                                        required
                                    />
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                        {creationMode === 'packaging'
                                            ? 'Containers default to 1 count. Multipacks (like box of 10) have multiplier = 10.'
                                            : `How many ${currentCategoryConfig.baseCode} equal 1 ${unitCode.trim() || 'unit'}?`}
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
                                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 ${
                                        creationMode === 'packaging' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    {submittingUnit && <Loader2 size={12} className="animate-spin" />}
                                    {editingUnit ? 'Save Changes' : creationMode === 'packaging' ? 'Create Packaging Unit' : 'Create Metric Unit'}
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

