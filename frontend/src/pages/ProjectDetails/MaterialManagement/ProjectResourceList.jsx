import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import {
    ArrowLeft, Search, Plus, Trash2, RefreshCw, Layers, X, Download,
    RotateCcw, AlertCircle, ChevronDown, ChevronRight, Copy, Eye, CheckSquare, Square,
    ArrowUp, ArrowDown, Filter, Check, CheckCircle2, History,
    Calendar, Package, DollarSign, ArrowLeftRight, ExternalLink, HelpCircle,
    Info, SlidersHorizontal, ChevronLeft, Edit3, CornerDownRight, Database, FolderKanban,
    AlertTriangle, Edit2, Calculator, CopyCheck, Wrench, HardHat, Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExcelGrid } from '../../../components/ExcelGrid';
import { projectApi } from '../../../services/projectApi';
import { resourceApi } from '../../../services/resourceApi';
import { UNIT_OPTIONS } from '../../Resources/resourceConstants';
import CustomDatePicker from '../../../components/CustomDatePicker';
import CustomSelect from '../../../components/CustomSelect';
import CustomInput from '../../../components/CustomInput';
import ConfirmModal from '../../../components/ConfirmModal';
import { customToast } from '../../../utils/toast';

const dateOnly = (value) => (value ? String(value).slice(0, 10) : new Date().toISOString().slice(0, 10));

const TYPE_CONFIG = {
    material: {
        label: 'Material',
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-500/20',
        icon: Box
    },
    item: {
        label: 'Item (BOM)',
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200/60 dark:border-purple-500/20',
        icon: Wrench
    },
    labour: {
        label: 'Labour',
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-500/20',
        icon: HardHat
    }
};

// ─── Resource Auto-Suggest Editor Component ───────────────────────────────
const ResourceAutoSuggestEditor = ({
    value,
    row,
    onChange,
    onBlur,
    rowIndex,
    onChangeValue,
    fieldKey = 'name',
    suggestions = []
}) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [isOpen, setIsOpen] = useState(true);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 320, maxHeight: 240 });
    const inputRef = useRef(null);
    const blurTimeoutRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const updateCoords = () => {
            if (inputRef.current) {
                const rect = inputRef.current.getBoundingClientRect();
                const dropdownWidth = Math.max(320, Math.min(rect.width, 420));

                // Horizontal boundary clipping protection
                let left = rect.left;
                if (left + dropdownWidth > window.innerWidth - 16) {
                    left = Math.max(16, window.innerWidth - dropdownWidth - 16);
                }
                if (left < 16) left = 16;

                // Vertical boundary clipping protection
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                let top = rect.bottom + 4;
                let maxHeight = Math.min(240, spaceBelow - 16);

                // If not enough space below and more space above, flip upwards
                if (spaceBelow < 180 && spaceAbove > spaceBelow) {
                    const availableHeight = Math.min(240, spaceAbove - 16);
                    top = Math.max(16, rect.top - availableHeight - 4);
                    maxHeight = availableHeight;
                }

                setCoords({
                    top,
                    left,
                    width: dropdownWidth,
                    maxHeight: Math.max(120, maxHeight)
                });
            }
        };

        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen, inputValue]);

    const filtered = useMemo(() => {
        const q = String(inputValue || '').trim().toLowerCase();
        if (!q) return suggestions.slice(0, 8);
        return suggestions
            .filter(
                (c) =>
                    (c.name || '').toLowerCase().includes(q) ||
                    (c.code || '').toLowerCase().includes(q) ||
                    (c.type || '').toLowerCase().includes(q)
            )
            .slice(0, 8);
    }, [inputValue, suggestions]);

    const handleSelectSuggestion = (item) => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        const chosenVal = fieldKey === 'code' ? (item.code || '') : item.name;
        setInputValue(chosenVal);
        setIsOpen(false);
        onChange(chosenVal);

        // Autofill all relevant fields for this resource row
        if (onChangeValue) {
            onChangeValue(rowIndex, 'name', item.name);
            if (item.code) onChangeValue(rowIndex, 'code', item.code);
            if (item.type) onChangeValue(rowIndex, 'type', item.type);
            if (item.base_unit_code) onChangeValue(rowIndex, 'base_unit_code', item.base_unit_code);
            if (item.description) onChangeValue(rowIndex, 'description', item.description);
            if (item.remarks) onChangeValue(rowIndex, 'remarks', item.remarks);
            if (item.master_rate !== null && item.master_rate !== undefined) {
                onChangeValue(rowIndex, 'applied_rate', item.master_rate);
            }
        }
        onBlur(chosenVal);
    };

    return (
        <div className="relative w-full h-full flex items-center">
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    onChange(e.target.value);
                    setIsOpen(true);
                    setHighlightIndex(0);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightIndex(
                            (prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length)
                        );
                    } else if (e.key === 'Enter') {
                        if (isOpen && filtered[highlightIndex]) {
                            e.preventDefault();
                            handleSelectSuggestion(filtered[highlightIndex]);
                        }
                    } else if (e.key === 'Escape') {
                        setIsOpen(false);
                    }
                }}
                onBlur={() => {
                    blurTimeoutRef.current = setTimeout(() => {
                        onBlur(inputValue);
                    }, 200);
                }}
                placeholder={fieldKey === 'code' ? 'Type item code or select from catalog...' : 'Type resource name or select from catalog...'}
                className="w-full min-w-0 bg-transparent border-0 outline-none p-0 text-xs font-semibold text-gray-900 dark:text-white"
            />

            {/* Dropdown Suggestions from Master Catalog (Portaled to prevent table cell clipping) */}
            {isOpen && filtered.length > 0 && typeof document !== 'undefined' && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        maxHeight: `${coords.maxHeight}px`,
                        zIndex: 99999,
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}
                    className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl p-1.5 space-y-1 overflow-y-auto [&::-webkit-scrollbar]:hidden animate-in fade-in zoom-in-95 select-none font-sans text-left"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between border-b border-gray-100 dark:border-white/5">
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 font-semibold">
                            Master Catalog
                        </span>
                        <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">
                            Autofills Row
                        </span>
                    </div>

                    {filtered.map((item, idx) => {
                        const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.material;
                        const Icon = cfg.icon;
                        return (
                            <div
                                key={item.id || item.resource_id || idx}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectSuggestion(item);
                                }}
                                className={`p-2 rounded-lg cursor-pointer transition text-left flex items-start justify-between gap-2 ${
                                    idx === highlightIndex
                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                        : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200'
                                }`}
                            >
                                <div className="truncate flex-1 min-w-0">
                                    <div className="text-xs font-bold truncate">{item.name}</div>
                                    <div className="text-[10px] text-gray-400 truncate flex items-center gap-2 mt-0.5">
                                        <span className="font-mono">{item.code || 'NO-CODE'}</span>
                                        <span>•</span>
                                        <span>Unit: {item.base_unit_code || 'nos'}</span>
                                        {item.master_rate !== null && item.master_rate !== undefined && (
                                            <>
                                                <span>•</span>
                                                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                                    ₹{Number(item.master_rate).toLocaleString('en-IN')}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${cfg.bg} ${cfg.color}`}>
                                    <Icon size={10} />
                                    <span>{cfg.label}</span>
                                </span>
                            </div>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

// ─── Rate Override & History Drawer Component ─────────────────────────────
const RateOverrideDrawer = ({
    resource,
    projectId,
    rateInfo,
    effectiveDate,
    canWrite,
    isOpen,
    onClose,
    onRateUpdated
}) => {
    const [rateHistory, setRateHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [mode, setMode] = useState('manual');
    const [overrideRate, setOverrideRate] = useState('');
    const [effectiveFrom, setEffectiveFrom] = useState(effectiveDate || dateOnly());
    const [effectiveTo, setEffectiveTo] = useState('');
    const [remarks, setRemarks] = useState('');

    // Editing specific past version
    const [editingHistoryId, setEditingHistoryId] = useState(null);

    const loadRateHistory = useCallback(async () => {
        if (!resource?.resource_id && !resource?.id) return;
        const resId = resource.resource_id || resource.id;
        setIsLoadingHistory(true);
        try {
            const resp = await projectApi.getResourceRateHistory(projectId, resId);
            if (resp && resp.history) {
                setRateHistory(resp.history);
            }
        } catch (err) {
            console.error('Failed to load rate history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [projectId, resource]);

    useEffect(() => {
        if (isOpen && resource) {
            const currentVal = rateInfo?.rate !== null && rateInfo?.rate !== undefined ? String(rateInfo.rate) : '';
            setOverrideRate(currentVal);
            setEffectiveFrom(effectiveDate || dateOnly());
            setEffectiveTo('');
            setRemarks('');
            setMode(resource.type === 'item' && rateInfo?.source === 'computed' ? 'computed' : 'manual');
            setEditingHistoryId(null);
            loadRateHistory();
        }
    }, [isOpen, resource, rateInfo, effectiveDate, loadRateHistory]);

    if (!isOpen || !resource) return null;

    const handleSaveOverride = async (e) => {
        if (e) e.preventDefault();
        if (mode === 'manual' && (!overrideRate || isNaN(Number(overrideRate)))) {
            customToast.error('Please enter a valid numeric rate override', 'Validation Error');
            return;
        }

        setIsSaving(true);
        const resId = resource.resource_id || resource.id;

        try {
            if (editingHistoryId) {
                // Update historical record
                await projectApi.updateResourceRate(projectId, resId, editingHistoryId, {
                    mode,
                    rate: mode === 'computed' ? null : parseFloat(overrideRate),
                    unit_code: resource.base_unit_code || 'nos',
                    effective_from: effectiveFrom,
                    effective_to: effectiveTo || null,
                    remarks: remarks || (mode === 'computed' ? 'Dynamic recipe calculation' : undefined)
                });
                customToast.success('Historical rate updated successfully', 'Rate Updated');
            } else {
                // Create new project rate record
                await projectApi.addResourceRate(projectId, resId, {
                    mode,
                    rate: mode === 'computed' ? null : parseFloat(overrideRate),
                    unit_code: resource.base_unit_code || 'nos',
                    effective_from: effectiveFrom,
                    effective_to: effectiveTo || null,
                    remarks: remarks || (mode === 'computed' ? 'Dynamic recipe calculation' : 'Project override rate')
                });
                customToast.success(`Project override rate saved for ${resource.name}`, 'Rate Override Saved');
            }

            setEditingHistoryId(null);
            await loadRateHistory();
            if (onRateUpdated) onRateUpdated(resId);
            onClose();
        } catch (err) {
            console.error('Failed to save rate override:', err);
            customToast.error(err.response?.data?.message || err.message || 'Failed to save rate override', 'Save Failed');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRevertToMaster = async () => {
        const resId = resource.resource_id || resource.id;
        setIsSaving(true);
        try {
            await projectApi.clearResourceRate(projectId, resId, effectiveFrom, null);
            customToast.success(`Reverted "${resource.name}" to Master Catalog Rate`, 'Reverted to Master');
            await loadRateHistory();
            if (onRateUpdated) onRateUpdated(resId);
            onClose();
        } catch (err) {
            console.error('Failed to revert to master rate:', err);
            customToast.error(err.response?.data?.message || 'Failed to revert rate', 'Revert Failed');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end transition-opacity" onClick={onClose}>
            <div
                className="w-full max-w-xl bg-white dark:bg-[#161b22] h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-white/10 overflow-hidden text-left"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drawer Header */}
                <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-[#0d1117]/50 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-800/40">
                            <DollarSign size={18} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {resource.name}
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                <span className="font-mono">{resource.code || 'NO-CODE'}</span>
                                <span>•</span>
                                <span className="capitalize">{resource.type}</span>
                                <span>•</span>
                                <span>Unit: {resource.base_unit_code}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Drawer Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                    {/* Active Rates Status Box */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 dark:bg-[#0d1117] rounded-xl border border-gray-200/70 dark:border-white/5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Master Catalog Rate
                            </span>
                            <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                                {resource.master_rate !== null && resource.master_rate !== undefined
                                    ? `₹${Number(resource.master_rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / ${resource.base_unit_code}`
                                    : 'Unset'}
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                                Current Applied Rate
                            </span>
                            <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mt-1">
                                {rateInfo?.rate !== null && rateInfo?.rate !== undefined
                                    ? `₹${Number(rateInfo.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / ${rateInfo.unitCode || resource.base_unit_code}`
                                    : 'Unset'}
                            </p>
                        </div>
                    </div>

                    {/* Set / Edit Override Form */}
                    {canWrite && (
                        <form onSubmit={handleSaveOverride} className="p-4 bg-gray-50 dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-white/10 space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-white/5 pb-2.5">
                                <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                    <DollarSign size={14} className="text-blue-500" />
                                    <span>{editingHistoryId ? 'Edit Rate Record' : 'Set Project Rate Override'}</span>
                                </h3>
                                {editingHistoryId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingHistoryId(null);
                                            setOverrideRate(rateInfo?.rate !== null && rateInfo?.rate !== undefined ? String(rateInfo.rate) : '');
                                        }}
                                        className="text-[11px] font-semibold text-gray-500 hover:text-red-500"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </div>

                            {resource.type === 'item' && (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setMode('manual')}
                                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                                            mode === 'manual'
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                : 'bg-white dark:bg-[#161b22] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10'
                                        }`}
                                    >
                                        Fixed Project Rate
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode('computed')}
                                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition ${
                                            mode === 'computed'
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                                : 'bg-white dark:bg-[#161b22] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10'
                                        }`}
                                    >
                                        Computed from Recipe
                                    </button>
                                </div>
                            )}

                            {mode === 'manual' && (
                                <CustomInput
                                    label={`Override Rate (₹ / ${resource.base_unit_code}) *`}
                                    type="number"
                                    step="0.01"
                                    value={overrideRate}
                                    onChange={(e) => setOverrideRate(e.target.value)}
                                    placeholder="Enter custom rate..."
                                    required
                                />
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <CustomDatePicker
                                    label="Effective From"
                                    value={effectiveFrom}
                                    onChange={(val) => setEffectiveFrom(val.target.value)}
                                />
                                <CustomDatePicker
                                    label="Effective To (Optional)"
                                    value={effectiveTo}
                                    onChange={(val) => setEffectiveTo(val.target.value)}
                                />
                            </div>

                            <CustomInput
                                label="Remarks / Justification"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="e.g. Project site rate agreement"
                            />

                            <div className="flex items-center justify-between pt-1">
                                {rateInfo?.rateScope === 'project' && !editingHistoryId && (
                                    <button
                                        type="button"
                                        onClick={handleRevertToMaster}
                                        disabled={isSaving}
                                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <RotateCcw size={12} />
                                        <span>Revert to Master</span>
                                    </button>
                                )}
                                <div className="flex items-center gap-2 ml-auto">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                    >
                                        <Check size={13} className="stroke-[3]" />
                                        <span>{isSaving ? 'Saving…' : (editingHistoryId ? 'Update Record' : 'Save Override')}</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* Historical Rate Versions List */}
                    <div className="space-y-2.5">
                        <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <History size={14} className="text-gray-400" />
                            <span>Rate History & Versions ({rateHistory.length})</span>
                        </h3>

                        {isLoadingHistory ? (
                            <div className="p-4 text-center text-xs text-gray-400">Loading history…</div>
                        ) : rateHistory.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-center text-xs text-gray-400">
                                No custom project rate history recorded yet.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {rateHistory.map((hRow) => {
                                    const isActive = !hRow.effective_to || new Date(hRow.effective_to) >= new Date();
                                    return (
                                        <div
                                            key={hRow.id}
                                            className="p-3 bg-gray-50 dark:bg-[#0d1117] rounded-xl border border-gray-200/70 dark:border-white/5 flex items-center justify-between text-xs"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                                                        {hRow.rate !== null && hRow.rate !== undefined
                                                            ? `₹${Number(hRow.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / ${hRow.unit_code || resource.base_unit_code}`
                                                            : 'Computed Dynamic Recipe'}
                                                    </span>
                                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                                        isActive
                                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/60'
                                                            : 'bg-gray-100 text-gray-400 dark:bg-white/5'
                                                    }`}>
                                                        {isActive ? 'ACTIVE' : 'CLOSED'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    {hRow.effective_from} &rarr; {hRow.effective_to || 'Present'} {hRow.remarks ? `• ${hRow.remarks}` : ''}
                                                </p>
                                            </div>

                                            {canWrite && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingHistoryId(hRow.id);
                                                        setOverrideRate(hRow.rate !== null && hRow.rate !== undefined ? String(hRow.rate) : '');
                                                        setEffectiveFrom(hRow.effective_from || dateOnly());
                                                        setEffectiveTo(hRow.effective_to || '');
                                                        setRemarks(hRow.remarks || '');
                                                        setMode(hRow.rate === null ? 'computed' : 'manual');
                                                    }}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/10 transition"
                                                    title="Edit this version"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── MAIN PROJECT RESOURCE LIST COMPONENT WITH EXCELGRID ──────────────────
const ProjectResourceList = ({
    onBack,
    setExtraBreadcrumbs,
    canWrite,
    projectId: propProjectId,
    onRefreshResources
}) => {
    const { id: paramId } = useParams();
    const projectId = propProjectId || paramId;

    // Type filter
    const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');

    // Date resolution
    const [effectiveDate, setEffectiveDate] = useState(dateOnly());

    // Import from Catalog Drawer States
    const [isImportCatalogOpen, setIsImportCatalogOpen] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogTypeFilter, setCatalogTypeFilter] = useState('All');
    const [selectedCatalogIdsToImport, setSelectedCatalogIdsToImport] = useState(new Set());
    const [isImporting, setIsImporting] = useState(false);

    // Data states
    const [projectResources, setProjectResources] = useState([]);
    const [masterResources, setMasterResources] = useState([]);
    const [resolvedRates, setResolvedRates] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [ratesLoading, setRatesLoading] = useState(true);

    // Selected Drawer State
    const [selectedResourceForDrawer, setSelectedResourceForDrawer] = useState(null);

    // Confirm Modal
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'danger',
        isLoading: false,
        onConfirm: () => {}
    });

    const closeConfirmModal = () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
    };

    // Load Resources & Master Catalog
    const fetchResources = useCallback(async (silent = false, targetDate = effectiveDate) => {
        if (!projectId) return;
        try {
            if (!silent) setIsLoading(true);
            setRatesLoading(true);

            const [projectRes, masterRes] = await Promise.all([
                projectApi.listProjectResources(projectId),
                resourceApi.getResources({ limit: 5000, include_details: 'false', include_rates: 'true' })
            ]);

            const pList = projectRes.resources || [];
            const mList = masterRes.resources || [];
            const masterById = new Map(mList.map((r) => [String(r.id), r]));
            const importedIds = new Set(pList.map((r) => String(r.resource_id || r.id)));

            // Map project items
            const mappedProject = pList.map((p) => {
                const resId = p.id || p.project_resource_id;
                const parentId = p.parent_id || p.resource_id;
                const m = masterById.get(String(parentId)) || masterById.get(String(resId)) || {};
                return {
                    ...m,
                    ...p,
                    id: resId,
                    resource_id: resId,
                    parent_id: parentId,
                    name: p.name || m.name || 'Unnamed Resource',
                    code: p.code || m.code || '',
                    type: p.type || m.type || 'material',
                    base_unit_code: p.base_unit_code || m.base_unit_code || 'nos',
                    description: p.description || m.description || '',
                    remarks: p.remarks || '',
                    master_rate: m.rate !== null && m.rate !== undefined ? Number(m.rate) : null,
                    isImported: true
                };
            });

            // Map master items
            const mappedMaster = mList.map((m) => ({
                ...m,
                id: m.id,
                resource_id: m.id,
                code: m.code || '',
                name: m.name || 'Unnamed Resource',
                type: m.type || 'material',
                base_unit_code: m.base_unit_code || 'nos',
                master_rate: m.rate !== null && m.rate !== undefined ? Number(m.rate) : null,
                isImported: importedIds.has(String(m.id))
            }));

            setProjectResources(mappedProject);
            setMasterResources(mappedMaster);

            // Fetch resolved rates for project items
            const importedResourceIds = mappedProject.map((r) => r.resource_id);
            if (importedResourceIds.length > 0) {
                try {
                    const rateResponse = await projectApi.getResolvedResourceRates(projectId, importedResourceIds, targetDate);
                    const resolvedById = new Map((rateResponse.rates || []).map((r) => [String(r.resourceId), r]));

                    const resolvedMap = {};
                    mappedProject.forEach((r) => {
                        const resId = String(r.resource_id);
                        const rateItem = resolvedById.get(resId);
                        if (rateItem) {
                            resolvedMap[resId] = rateItem;
                        } else {
                            const hasMasterRate = r.master_rate !== null && r.master_rate !== undefined;
                            resolvedMap[resId] = {
                                rate: hasMasterRate ? r.master_rate : null,
                                unitCode: r.base_unit_code,
                                source: 'master',
                                rateScope: hasMasterRate ? 'master' : null
                            };
                        }
                    });
                    setResolvedRates(resolvedMap);
                } catch (rateErr) {
                    console.error('Failed to load resolved project rates:', rateErr);
                }
            } else {
                setResolvedRates({});
            }
        } catch (err) {
            console.error('Failed to fetch resources:', err);
            customToast.error('Failed to load project resources', 'Error');
        } finally {
            setIsLoading(false);
            setRatesLoading(false);
        }
    }, [projectId, effectiveDate]);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    // Handle Effective Date Change
    const handleEffectiveDateChange = (newDate) => {
        setEffectiveDate(newDate);
        fetchResources(true, newDate);
    };

    // Calculate Summary Stats
    const stats = useMemo(() => {
        let materials = 0;
        let items = 0;
        let labour = 0;
        let overrides = 0;

        projectResources.forEach((r) => {
            if (r.type === 'material') materials++;
            else if (r.type === 'item') items++;
            else if (r.type === 'labour') labour++;

            const resId = String(r.resource_id || r.id);
            if (resolvedRates[resId]?.rateScope === 'project') {
                overrides++;
            }
        });

        return {
            total: projectResources.length,
            materials,
            items,
            labour,
            overrides
        };
    }, [projectResources, resolvedRates]);

    const filteredProjectResources = useMemo(() => {
        if (selectedTypeFilter === 'All') return projectResources;
        if (selectedTypeFilter === 'Overrides') {
            return projectResources.filter((r) => resolvedRates[String(r.resource_id || r.id)]?.rateScope === 'project');
        }
        return projectResources.filter((r) => r.type === selectedTypeFilter.toLowerCase());
    }, [projectResources, selectedTypeFilter, resolvedRates]);

    const projectResourceIdsSet = useMemo(() => {
        const ids = new Set();
        projectResources.forEach((p) => {
            if (p.parent_id) ids.add(String(p.parent_id));
            if (p.resource_id) ids.add(String(p.resource_id));
            if (p.id) ids.add(String(p.id));
        });
        return ids;
    }, [projectResources]);

    const availableCatalogResources = useMemo(() => {
        return masterResources.filter((m) => !projectResourceIdsSet.has(String(m.id)));
    }, [masterResources, projectResourceIdsSet]);

    const displayedCatalogResources = useMemo(() => {
        return availableCatalogResources.filter((r) => {
            const matchesType = catalogTypeFilter === 'All' || r.type === catalogTypeFilter.toLowerCase();
            if (!matchesType) return false;
            if (!catalogSearch) return true;
            const q = catalogSearch.toLowerCase();
            return (
                (r.name && r.name.toLowerCase().includes(q)) ||
                (r.code && r.code.toLowerCase().includes(q)) ||
                (r.type && r.type.toLowerCase().includes(q)) ||
                (r.base_unit_code && r.base_unit_code.toLowerCase().includes(q))
            );
        });
    }, [availableCatalogResources, catalogTypeFilter, catalogSearch]);

    const toggleCatalogSelect = (id) => {
        setSelectedCatalogIdsToImport((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleToggleSelectAllCatalog = () => {
        if (selectedCatalogIdsToImport.size === displayedCatalogResources.length && displayedCatalogResources.length > 0) {
            setSelectedCatalogIdsToImport(new Set());
        } else {
            setSelectedCatalogIdsToImport(new Set(displayedCatalogResources.map((r) => r.id)));
        }
    };

    const handleCommitImportCatalog = async () => {
        const ids = Array.from(selectedCatalogIdsToImport);
        if (ids.length === 0) return;
        setIsImporting(true);
        try {
            await projectApi.importResourcesBatch(projectId, ids, effectiveDate);
            customToast.success(`Imported ${ids.length} resources into project`, 'Catalog Imported');
            setIsImportCatalogOpen(false);
            setSelectedCatalogIdsToImport(new Set());
            await fetchResources(true);
            if (onRefreshResources) onRefreshResources();
        } catch (err) {
            console.error('Failed batch import, trying single imports:', err);
            try {
                for (const id of ids) {
                    await projectApi.importResource(projectId, id, effectiveDate);
                }
                customToast.success(`Imported ${ids.length} resources into project`, 'Catalog Imported');
                setIsImportCatalogOpen(false);
                setSelectedCatalogIdsToImport(new Set());
                await fetchResources(true);
                if (onRefreshResources) onRefreshResources();
            } catch (e2) {
                console.error('Failed to import resources:', e2);
                customToast.error(err.response?.data?.message || 'Failed to import resources', 'Error');
            }
        } finally {
            setIsImporting(false);
        }
    };

    const handleSaveGridBatch = async ({ created, updated, deleted }) => {
        if (!canWrite) return;
        if (deleted && deleted.length > 0) {
            for (const item of deleted) {
                const resId = item.resource_id || item.id;
                if (resId && !String(resId).startsWith('temp_')) {
                    try {
                        await projectApi.removeProjectResource(projectId, resId);
                    } catch (e) {
                        console.error('Failed to delete resource:', e);
                    }
                }
            }
        }
        if (created && created.length > 0) {
            for (const item of created) {
                if (item.name) {
                    try {
                        const createRes = await resourceApi.createResource({
                            name: item.name,
                            code: item.code || undefined,
                            type: item.type || 'material',
                            base_unit_code: item.base_unit_code || 'nos',
                            description: item.description || ''
                        });
                        if (createRes && createRes.resource) {
                            await projectApi.importResource(projectId, createRes.resource.id, effectiveDate);
                        }
                    } catch (e) {
                        console.error('Failed to create resource inline:', e);
                    }
                }
            }
        }
        if (updated && updated.length > 0) {
            for (const item of updated) {
                const resId = item.resource_id || item.id;
                if (resId) {
                    try {
                        await resourceApi.updateResource(resId, {
                            name: item.name,
                            code: item.code,
                            type: item.type,
                            base_unit_code: item.base_unit_code,
                            description: item.description
                        });
                    } catch (e) {
                        console.error('Failed to update resource inline:', e);
                    }
                }
            }
        }
        customToast.success('Changes saved successfully', 'Saved');
        await fetchResources(true);
        if (onRefreshResources) onRefreshResources();
    };

    const projectColumns = useMemo(() => {
        const unitValues = (UNIT_OPTIONS || []).map((u) => u.value || u.code || u);
        return [
            { key: 'code', label: 'Item Code', width: '130px', minWidth: '120px', aliases: ['code', 'item_code'] },
            { key: 'name', label: 'Item Name', required: true, width: '240px', minWidth: '200px', aliases: ['name', 'item_name'] },
            {
                key: 'type',
                label: 'Type',
                width: '130px',
                minWidth: '120px',
                type: 'dropdown',
                dropdownOptions: ['material', 'item', 'labour'],
                aliases: ['type', 'item_type', 'resource_type', 'category'],
                renderCell: (val) => {
                    const cfg = TYPE_CONFIG[val] || TYPE_CONFIG.material;
                    const Icon = cfg.icon;
                    return (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                            <Icon size={11} />
                            <span>{cfg.label}</span>
                        </span>
                    );
                }
            },
            {
                key: 'base_unit_code',
                label: 'Unit',
                width: '100px',
                minWidth: '90px',
                type: 'dropdown',
                dropdownOptions: unitValues,
                aliases: ['unit', 'base_unit', 'uom', 'base_unit_code']
            },
            {
                key: 'applied_rate',
                label: 'Effective Rate (₹)',
                width: '190px',
                minWidth: '170px',
                readOnly: true,
                aliases: ['rate', 'effective_rate', 'unit_rate', 'price', 'applied_rate'],
                renderCell: (val, row) => {
                    const resId = String(row.resource_id || row.id);
                    const rateObj = resolvedRates[resId];
                    if (ratesLoading) return <span className="text-gray-400 italic text-[11px]">Calculating…</span>;
                    if (!rateObj || rateObj.rate === null || rateObj.rate === undefined) {
                        return (
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-gray-400 italic text-[11px]">Unset</span>
                                {canWrite && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedResourceForDrawer(row); }} className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">+ Set</button>
                                )}
                            </div>
                        );
                    }
                    const numRate = Number(rateObj.rate);
                    const formatted = isNaN(numRate) ? String(rateObj.rate) : `₹${numRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                    const isProjectOverride = rateObj.rateScope === 'project';
                    const isComputed = rateObj.source === 'computed_recipe';
                    return (
                        <div className="flex items-center justify-between gap-1 w-full">
                            <span className="font-mono font-bold text-gray-900 dark:text-white truncate">{formatted}</span>
                            <div className="flex items-center gap-1 shrink-0">
                                {isProjectOverride ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" title="Project Specific Rate Override">PROJECT</span>
                                ) : isComputed ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" title="Dynamically Calculated Recipe (BOM)">BOM</span>
                                ) : (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400" title="Inherited from Master Organization Catalog">MASTER</span>
                                )}
                                {canWrite && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedResourceForDrawer(row); }} className="p-0.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-gray-400 hover:text-blue-600 transition" title="Configure / Override Rate"><Edit2 size={11} /></button>
                                )}
                            </div>
                        </div>
                    );
                }
            },
            { key: 'description', label: 'Description', width: '220px', minWidth: '180px', aliases: ['description', 'spec', 'details'] },
            { key: 'remarks', label: 'Remarks', width: '180px', minWidth: '160px', aliases: ['remarks', 'notes', 'comment'] }
        ];
    }, [resolvedRates, ratesLoading, canWrite]);

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117] text-left relative">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <ExcelGrid
                    data={filteredProjectResources}
                    columns={projectColumns}
                    primaryKey="id"
                    entityName="Project Resources"
                    canWrite={canWrite}
                    isLoading={isLoading}
                    onSave={handleSaveGridBatch}
                    onRefresh={() => fetchResources(true)}
                    onViewRow={(resource) => setSelectedResourceForDrawer(resource)}
                    emptyMessage="No resources assigned to this project yet"
                    extraFilters={
                        <div className="flex items-center gap-1.5 py-0.5 shrink-0">
                            {[
                                { id: 'All', label: 'All', count: stats.total },
                                { id: 'Material', label: 'Material', count: stats.materials },
                                { id: 'Item', label: 'Item', count: stats.items },
                                { id: 'Labour', label: 'Labour', count: stats.labour }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedTypeFilter(item.id)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                                        selectedTypeFilter === item.id
                                            ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                            : 'bg-white dark:bg-[#161b22] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300'
                                    }`}
                                >
                                    <span>{item.label}</span>
                                    <span className="text-[10px] font-mono opacity-75">({item.count})</span>
                                </button>
                            ))}
                            {stats.overrides > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'Overrides' ? 'All' : 'Overrides')}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                                        selectedTypeFilter === 'Overrides'
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                            : 'bg-blue-50/70 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                                    }`}
                                    title="Click to filter by project rate overrides"
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${selectedTypeFilter === 'Overrides' ? 'bg-white' : 'bg-blue-500'}`} />
                                    <span>{stats.overrides} Overrides</span>
                                </button>
                            )}
                        </div>
                    }
                    customActions={
                        <div className="flex items-center gap-3 shrink-0">
                            {/* Effective Date Resolution */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0">
                                    Effective -
                                </span>
                                <div className="w-34">
                                    <CustomDatePicker
                                        value={effectiveDate}
                                        onChange={(e) => handleEffectiveDateChange(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Import from Master Catalog Button */}
                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCatalogIdsToImport(new Set());
                                        setCatalogSearch('');
                                        setCatalogTypeFilter('All');
                                        setIsImportCatalogOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 shadow-2xs"
                                >
                                    <Database size={13} />
                                    <span>Import from Catalog</span>
                                </button>
                            )}
                        </div>
                    }
                />
            </div>

            {isImportCatalogOpen && (
                <div className="fixed inset-0 z-[5000] flex justify-end p-0 bg-black/60 backdrop-blur-xs text-left animate-in fade-in duration-200">
                    <div className="absolute inset-0 transition-opacity" onClick={() => !isImporting && setIsImportCatalogOpen(false)} />
                    <div className="relative w-full max-w-xl bg-white dark:bg-[#0d1117] shadow-2xl border-l border-gray-200 dark:border-white/10 flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
                        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0 bg-gray-50/50 dark:bg-white/[0.02]">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                    <Database size={16} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">Import from Master Catalog</h2>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">Select master organization resources to link to this project</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => !isImporting && setIsImportCatalogOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"><X size={16} /></button>
                        </div>
                        <div className="p-3 border-b border-gray-100 dark:border-white/5 space-y-2 bg-gray-50/20 dark:bg-[#161b22]/30 shrink-0">
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" placeholder="Search catalog resources..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans" />
                                {catalogSearch && <button type="button" onClick={() => setCatalogSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">✕</button>}
                            </div>
                            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                                {['All', 'Material', 'Item', 'Labour'].map((type) => {
                                    const count = type === 'All' ? availableCatalogResources.length : availableCatalogResources.filter(r => r.type === type.toLowerCase()).length;
                                    return (
                                        <button key={type} type="button" onClick={() => setCatalogTypeFilter(type)} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${catalogTypeFilter === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#0d1117] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10'}`}>
                                            <span>{type}</span>
                                            <span className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${catalogTypeFilter === type ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar table-scrollbar space-y-2">
                            {displayedCatalogResources.length === 0 ? (
                                <div className="text-center py-16">
                                    <Package size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">No catalog resources found</p>
                                </div>
                            ) : (
                                displayedCatalogResources.map((res) => {
                                    const isSelected = selectedCatalogIdsToImport.has(res.id);
                                    const cfg = TYPE_CONFIG[res.type] || TYPE_CONFIG.material;
                                    const Icon = cfg.icon;
                                    return (
                                        <div key={res.id} onClick={() => toggleCatalogSelect(res.id)} className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected ? 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-500 dark:border-blue-600 shadow-2xs' : 'bg-white dark:bg-[#161b22]/40 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'}`}>
                                            <div className="truncate flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{res.name}</span>
                                                    {res.code && (
                                                        <span className="text-[10px] font-mono text-gray-400 shrink-0">#{res.code}</span>
                                                    )}
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${cfg.bg} ${cfg.color} shrink-0`}>
                                                        <Icon size={10} />
                                                        <span>{cfg.label}</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                                    <span>Unit: <strong className="text-gray-700 dark:text-gray-300 font-mono">{res.base_unit_code}</strong></span>
                                                    {res.master_rate !== null && res.master_rate !== undefined && (
                                                        <span>Master Rate: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">₹{Number(res.master_rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                                                    )}
                                                    {res.description && (
                                                        <span className="truncate text-gray-400">• {res.description}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-white/20 hover:border-blue-500'}`}>
                                                {isSelected && <Check size={12} className="stroke-[3]" />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="p-3.5 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3 shrink-0">
                            <button type="button" onClick={handleToggleSelectAllCatalog} disabled={displayedCatalogResources.length === 0} className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-blue-600 transition cursor-pointer">
                                {selectedCatalogIdsToImport.size === displayedCatalogResources.length && displayedCatalogResources.length > 0 ? 'Deselect All' : `Select All (${displayedCatalogResources.length})`}
                            </button>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => !isImporting && setIsImportCatalogOpen(false)} className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition cursor-pointer">Cancel</button>
                                <button type="button" disabled={selectedCatalogIdsToImport.size === 0 || isImporting} onClick={handleCommitImportCatalog} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5">
                                    {isImporting ? <RefreshCw size={13} className="animate-spin" /> : <><Database size={13} /> <span>Import Selected ({selectedCatalogIdsToImport.size})</span></>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedResourceForDrawer && (
                <RateOverrideDrawer
                    resource={selectedResourceForDrawer}
                    projectId={projectId}
                    rateInfo={resolvedRates[String(selectedResourceForDrawer.resource_id || selectedResourceForDrawer.id)]}
                    effectiveDate={effectiveDate}
                    canWrite={canWrite}
                    isOpen={Boolean(selectedResourceForDrawer)}
                    onClose={() => setSelectedResourceForDrawer(null)}
                    onRateUpdated={() => fetchResources(true)}
                />
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                variant={confirmModal.variant}
                isLoading={confirmModal.isLoading}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
            />
        </div>
    );
};

export default ProjectResourceList;
