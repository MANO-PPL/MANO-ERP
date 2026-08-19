import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    ArrowLeft, Search, Plus, Trash2, RefreshCw, Layers, X, Download,
    RotateCcw, AlertCircle, ChevronDown, ChevronRight, Copy, Eye, CheckSquare, Square,
    ArrowUp, ArrowDown, Filter, Sparkles, Check, CheckCircle2, History,
    Calendar, Package, DollarSign, ArrowLeftRight, ExternalLink, HelpCircle,
    Info, SlidersHorizontal, ChevronLeft, Edit3, CornerDownRight, Database, FolderKanban,
    AlertTriangle, Edit2, Calculator
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { projectApi } from '../../../services/projectApi';
import { resourceApi } from '../../../services/resourceApi';
import { UNIT_REGISTRY, UNIT_OPTIONS } from '../../Resources/resourceConstants';
import CustomDatePicker from '../../../components/CustomDatePicker';
import CustomSelect from '../../../components/CustomSelect';
import ConfirmModal from '../../../components/ConfirmModal';
import Toast from '../../../components/Toast';

const dateOnly = (value) => (value ? String(value).slice(0, 10) : new Date().toISOString().slice(0, 10));

const isItemResource = (resource) => resource?.type === 'item';

const UNIT_SELECT_OPTIONS = UNIT_OPTIONS.map(u => ({
    value: u.code,
    label: `${u.name} (${u.symbol})`
}));

// ─── MEMOIZED CHECKBOX COMPONENT ───────────────────────────────────────────────
const CustomCheckbox = React.memo(({ checked, onChange, title }) => (
    <div
        onClick={onChange}
        title={title}
        className={`w-4 h-4 rounded border transition-all flex items-center justify-center cursor-pointer select-none ${checked
            ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 shadow-xs shadow-blue-500/20'
            : 'border-gray-300 dark:border-white/20 bg-white dark:bg-[#161b22] hover:border-blue-400'
            }`}
    >
        {checked && <Check size={11} className="stroke-[3]" />}
    </div>
));

// ─── MEMOIZED PAGE SIZE DROPDOWN (OPENS DOWNWARDS) ──────────────────────────────
const CustomPageSizeDropdown = React.memo(({ pageSize, setPageSize }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const options = [50, 100, 250, 500, 'All'];

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg border border-gray-200/60 dark:border-white/10 transition-colors cursor-pointer"
            >
                <span>Rows: <strong className="text-gray-900 dark:text-white font-bold">{pageSize}</strong></span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-24 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl py-1 z-[9999] text-xs font-medium">
                    {options.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => {
                                setPageSize(opt);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${pageSize === opt ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-white/[0.02]' : 'text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <span>{opt}</span>
                            {pageSize === opt && <Check size={12} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

// ─── MEMOIZED PROJECT RESOURCE ROW COMPONENT ──────────────────────────────────
const ProjectResourceRow = React.memo(({
    resource,
    rowIndex,
    isSelected,
    isExpanded,
    rate,
    ratesLoading,
    rowDetail,
    canWrite,
    onToggleSelect,
    onToggleExpand,
    onContextMenu,
    onSaveInlineRate,
    onRevertInlineRate,
    onRevertToComputed,
    onRemoveResource,
    onFormChange,
    onEditRateHistory
}) => {
    const resId = String(resource.resource_id);
    const hasOverride = rate?.rateScope === 'project';
    const hasMaster = rate?.rateScope === 'master';

    return (
        <React.Fragment>
            <tr
                onContextMenu={(e) => onContextMenu(e, rowIndex)}
                className={`hover:bg-blue-50/20 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 cursor-pointer ${isSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                    } ${isExpanded ? 'bg-blue-50/25 dark:bg-blue-950/20' : ''}`}
            >
                {/* Checkbox Cell */}
                <td className="px-3 py-2 text-center border-r border-gray-100 dark:border-white/5 select-none">
                    <div className="flex justify-center">
                        <CustomCheckbox
                            checked={isSelected}
                            onChange={(e) => onToggleSelect(e, resource.resource_id)}
                            title="Select Row"
                        />
                    </div>
                </td>

                {/* Row # & Accordion Expand Button */}
                <td className="px-2 py-2 text-center font-mono text-[10px] text-gray-400 border-r border-gray-100 dark:border-white/5 select-none bg-gray-50/50 dark:bg-white/[0.01]">
                    <div className="flex items-center justify-center gap-1">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpand(resource);
                            }}
                            className="p-0.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition cursor-pointer"
                            title={isExpanded ? "Collapse Rate Details" : "Expand Rate History & Override Editor"}
                        >
                            {isExpanded ? <ChevronDown size={13} className="text-blue-600 stroke-[3]" /> : <ChevronRight size={13} />}
                        </button>
                        <span>{rowIndex + 1}</span>
                    </div>
                </td>

                {/* Item Code */}
                <td className="px-3 py-2 font-mono text-[11px] font-medium text-gray-600 dark:text-gray-400 border-r border-gray-100 dark:border-white/5">
                    {resource.code ? (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 border border-gray-200/50 dark:border-white/5">
                            {resource.code}
                        </span>
                    ) : (
                        <span className="text-gray-400 italic">No code</span>
                    )}
                </td>

                {/* Item Name */}
                <td className="px-4 py-2 border-r border-gray-100 dark:border-white/5">
                    <div className="font-bold text-gray-900 dark:text-white truncate max-w-xs">
                        {resource.name}
                    </div>
                    {resource.description && (
                        <div className="text-[10px] text-gray-400 truncate max-w-xs mt-0.5">
                            {resource.description}
                        </div>
                    )}
                </td>

                {/* Unit */}
                <td className="px-3 py-2 border-r border-gray-150 dark:border-white/5 font-medium text-gray-600 dark:text-gray-300">
                    <span className="px-1.5 py-0.5 rounded bg-gray-50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 font-mono text-[11px]">
                        {resource.base_unit_code || '—'}
                    </span>
                </td>

                {/* Final Applied Effective Rate */}
                <td className="px-4 py-2 border-r border-gray-150 dark:border-white/5 font-mono font-bold text-gray-900 dark:text-white">
                    {ratesLoading ? (
                        <span className="text-gray-400 font-normal italic">Resolving…</span>
                    ) : rate?.rate !== null && rate?.rate !== undefined ? (
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xs font-bold ${hasOverride ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    ₹{Number(rate.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-[10px] font-normal text-gray-400">
                                    / {rate.unitCode || resource.base_unit_code}
                                </span>
                            </div>
                            {hasOverride && canWrite && (
                                <div className="flex items-center gap-0.5">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleExpand(resource);
                                        }}
                                        className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/10 cursor-pointer"
                                        title="Edit project override"
                                    >
                                        <Edit3 size={11} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRevertInlineRate(resource);
                                        }}
                                        className="p-1 rounded text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer"
                                        title="Revert to master rate"
                                    >
                                        <RotateCcw size={11} />
                                    </button>
                                </div>
                            )}
                            {!hasOverride && canWrite && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleExpand(resource);
                                    }}
                                    className="opacity-0 group-hover/row:opacity-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/10 rounded transition cursor-pointer"
                                    title="Set project override rate"
                                >
                                    + Override
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-1">
                            <span className="text-gray-400 font-normal italic text-[11px]">Unset</span>
                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleExpand(resource);
                                    }}
                                    className="px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/10 rounded transition cursor-pointer"
                                >
                                    + Set Rate
                                </button>
                            )}
                        </div>
                    )}
                </td>

                {/* Rate Source */}
                <td className="px-3 py-2 border-r border-gray-150 dark:border-white/5">
                    {hasOverride ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-500/20">
                            <Sparkles size={10} />
                            <span>Project Override</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Master Rate</span>
                        </span>
                    )}
                </td>

                {/* Actions Cell */}
                <td className="px-4 py-2 text-center select-none">
                    <div className="inline-flex items-center justify-center gap-1.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpand(resource);
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-[11px] transition active:scale-95 cursor-pointer shadow-xs ${isExpanded
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                }`}
                            title={isExpanded ? "Hide Rate Details" : "View Rate Details & History"}
                        >
                            <History size={11} /> {isExpanded ? 'Close' : 'Rates'}
                        </button>

                        {canWrite && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveResource(resource);
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                                title="Remove item from project"
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </td>
            </tr>

            {/* ─── INLINE EXPANDED SUB-SHEET (INSTANT RENDER WITH CUSTOM DATEPICKER & CUSTOM SELECT) ─── */}
            {isExpanded && (
                <tr className="bg-gray-50/70 dark:bg-[#161b22]/70 border-b-2 border-blue-500/30">
                    <td colSpan={8} className="p-0">
                        <div className="p-4 md:p-5 space-y-4 border-l-4 border-blue-600 dark:border-blue-500 bg-gradient-to-r from-blue-50/30 via-white/50 to-transparent dark:from-blue-950/20 dark:via-[#161b22]/50">
                            {/* Comparison Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200/80 dark:border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                        <Layers size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                                            Rate Management · {resource.name}
                                        </h3>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                            Item Code: <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{resource.code || 'None'}</span> · Base Unit: <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{resource.base_unit_code}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-xs font-mono">
                                    <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#0d1117] border border-gray-200/80 dark:border-white/10 shadow-xs">
                                        <span className="text-[10px] font-medium text-gray-400 block">Master Fallback Rate</span>
                                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                                            {resource.master_rate !== null && resource.master_rate !== undefined ? `₹${Number(resource.master_rate).toFixed(2)}` : 'Not configured'}
                                        </span>
                                    </div>

                                    <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#0d1117] border border-blue-200 dark:border-blue-500/30 shadow-xs">
                                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 block">Final Effective Rate</span>
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                            {rate?.rate !== null && rate?.rate !== undefined ? `₹${Number(rate.rate).toFixed(2)} / ${rate.unitCode || resource.base_unit_code}` : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Inline Override Form with Custom Components */}
                            {canWrite && (
                                <div className="p-3.5 rounded-xl bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 shadow-xs space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                            <Sparkles size={12} className="text-blue-500" />
                                            <span>Set Project Override Rate</span>
                                        </span>
                                        <span className="text-[11px] text-gray-400">
                                            Overrides master rate for this project only
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                                                Override Rate (₹) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                placeholder="0.00"
                                                value={rowDetail?.form?.rate ?? ''}
                                                onChange={(e) => onFormChange(resId, 'rate', e.target.value)}
                                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-xs font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 h-[34px]"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                                                Unit <span className="text-red-500">*</span>
                                            </label>
                                            <CustomSelect
                                                options={UNIT_SELECT_OPTIONS}
                                                value={rowDetail?.form?.unitCode ?? resource.base_unit_code ?? 'nos'}
                                                onChange={(val) => onFormChange(resId, 'unitCode', val)}
                                                placeholder="Select unit"
                                                direction="down"
                                                alwaysOpenDownward={true}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                                                Effective From <span className="text-red-500">*</span>
                                            </label>
                                            <CustomDatePicker
                                                value={rowDetail?.form?.effectiveFrom ?? ''}
                                                onChange={(e) => onFormChange(resId, 'effectiveFrom', e.target.value)}
                                                className="w-full"
                                            />
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <button
                                                type="button"
                                                disabled={rowDetail?.saving || !rowDetail?.form?.rate}
                                                onClick={() => onSaveInlineRate(resource)}
                                                className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 h-[34px]"
                                            >
                                                {rowDetail?.saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} className="stroke-[3]" />}
                                                <span>Save Rate</span>
                                            </button>

                                            {isItemResource(resource) && rowDetail?.activeProjectRate && (
                                                <button
                                                    type="button"
                                                    disabled={rowDetail?.saving}
                                                    onClick={() => onRevertToComputed && onRevertToComputed(resource)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-300 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-bold transition active:scale-95 cursor-pointer h-[34px]"
                                                    title="Revert project item to dynamic recipe calculation"
                                                >
                                                    <Calculator size={12} />
                                                    <span>Revert to Computed Recipe</span>
                                                </button>
                                            )}

                                            {rowDetail?.activeProjectRate && (
                                                <button
                                                    type="button"
                                                    disabled={rowDetail?.saving}
                                                    onClick={() => onRevertInlineRate(resource)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-bold transition active:scale-95 cursor-pointer h-[34px]"
                                                    title="Revert project override to master catalog rate"
                                                >
                                                    <RotateCcw size={12} />
                                                    <span>Revert to Master Rate</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* History Nested Table */}
                            <div className="space-y-1.5">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <History size={13} className="text-gray-400" />
                                    <span>Rate History Versions ({rowDetail?.history?.length || 0})</span>
                                </span>

                                {rowDetail?.loading && (!rowDetail?.history || rowDetail.history.length === 0) ? (
                                    <div className="p-4 text-center text-xs text-gray-400">Loading history…</div>
                                ) : !rowDetail?.history || rowDetail.history.length === 0 ? (
                                    <div className="p-3 text-center rounded-lg border border-dashed border-gray-200 dark:border-white/10 text-xs text-gray-400">
                                        No project override history recorded yet. Inheriting rates from master catalog.
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-[#0d1117]">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400 text-[11px] font-semibold border-b border-gray-150 dark:border-white/5">
                                                <tr>
                                                    <th className="px-3 py-1.5">Status</th>
                                                    <th className="px-3 py-1.5">Override Rate</th>
                                                    <th className="px-3 py-1.5">Effective From</th>
                                                    <th className="px-3 py-1.5">Effective To</th>
                                                    <th className="px-3 py-1.5">Remarks</th>
                                                    <th className="px-3 py-1.5 text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-sans text-xs">
                                                {rowDetail.history.map((hRow) => {
                                                    const isActive = Number(hRow.is_active) === 1;
                                                    return (
                                                        <tr key={hRow.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                                                            <td className="px-3 py-1.5">
                                                                {isActive ? (
                                                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
                                                                        ACTIVE
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold bg-gray-100 text-gray-400 dark:bg-white/5">
                                                                        CLOSED
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-1.5 font-mono font-bold text-gray-900 dark:text-white">
                                                                {hRow.rate !== null && hRow.rate !== undefined ? (
                                                                    <>₹{Number(hRow.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-gray-400 font-normal text-[10px]">/ {hRow.unit_code}</span></>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                                                        <Calculator size={10} />
                                                                        Computed
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-1.5 font-mono text-[10px] text-gray-600 dark:text-gray-400">{hRow.effective_from}</td>
                                                            <td className="px-3 py-1.5 font-mono text-[10px] text-gray-600 dark:text-gray-400">{hRow.effective_to || 'Present'}</td>
                                                            <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-[11px] truncate max-w-xs">{hRow.remarks || '—'}</td>
                                                            <td className="px-3 py-1.5 text-center">
                                                                {canWrite && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (onEditRateHistory) onEditRateHistory(resource, hRow);
                                                                        }}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 hover:bg-blue-50 dark:bg-white/5 dark:hover:bg-blue-950/40 rounded border border-gray-200 dark:border-white/10 transition cursor-pointer"
                                                                        title="Edit this rate record"
                                                                    >
                                                                        <Edit2 size={10} />
                                                                        <span>Edit</span>
                                                                    </button>
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
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
});

// ─── MEMOIZED MASTER RESOURCE ROW COMPONENT ───────────────────────────────────
const MasterResourceRow = React.memo(({
    resource,
    rowIndex,
    isSelected,
    canWrite,
    onToggleSelect,
    onContextMenu,
    onAddResource,
    onRemoveResource
}) => {
    return (
        <tr
            onContextMenu={(e) => onContextMenu(e, rowIndex)}
            className={`hover:bg-blue-50/20 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 cursor-pointer ${isSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                }`}
        >
            {/* Checkbox Cell */}
            <td className="px-3 py-2 text-center border-r border-gray-100 dark:border-white/5 select-none">
                <div className="flex justify-center">
                    <CustomCheckbox
                        checked={isSelected}
                        onChange={(e) => onToggleSelect(e, resource.resource_id)}
                        title="Select Row"
                    />
                </div>
            </td>

            {/* Row # */}
            <td className="px-2 py-2 text-center font-mono text-[10px] text-gray-400 border-r border-gray-100 dark:border-white/5 select-none bg-gray-50/50 dark:bg-white/[0.01]">
                <span>{rowIndex + 1}</span>
            </td>



            {/* Item Code */}
            <td className="px-3 py-2 font-mono text-[11px] font-medium text-gray-600 dark:text-gray-400 border-r border-gray-100 dark:border-white/5">
                {resource.code ? (
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 border border-gray-200/50 dark:border-white/5">
                        {resource.code}
                    </span>
                ) : (
                    <span className="text-gray-400 italic">No code</span>
                )}
            </td>

            {/* Item Name */}
            <td className="px-4 py-2 border-r border-gray-100 dark:border-white/5">
                <div className="font-bold text-gray-900 dark:text-white truncate max-w-xs">
                    {resource.name}
                </div>
                {resource.description && (
                    <div className="text-[10px] text-gray-400 truncate max-w-xs mt-0.5">
                        {resource.description}
                    </div>
                )}
            </td>

            {/* Unit */}
            <td className="px-3 py-2 border-r border-gray-150 dark:border-white/5 font-medium text-gray-600 dark:text-gray-300">
                <span className="px-1.5 py-0.5 rounded bg-gray-50 dark:bg-white/[0.02] border border-gray-200/50 dark:border-white/5 font-mono text-[11px]">
                    {resource.base_unit_code || '—'}
                </span>
            </td>

            {/* Master Catalog Rate (₹) */}
            <td className="px-3 py-2 border-r border-gray-150 dark:border-white/5 font-mono text-gray-700 dark:text-gray-300">
                {resource.master_rate !== null && resource.master_rate !== undefined ? (
                    <span>₹{Number(resource.master_rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                ) : (
                    <span className="text-gray-400 italic text-[11px]">Unset</span>
                )}
            </td>

            {/* Project Status */}
            <td className="px-3 py-2 border-r border-gray-150 dark:border-white/5">
                {resource.isImported ? (
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Check size={12} className="stroke-[3]" />
                        <span>In Project</span>
                    </span>
                ) : (
                    <span className="text-[11px] text-gray-400">Not in project</span>
                )}
            </td>

            {/* Actions Cell */}
            <td className="px-4 py-2 text-center select-none">
                <div className="inline-flex items-center justify-center gap-1.5">
                    {canWrite && (
                        resource.isImported ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveResource(resource);
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                                title="Remove from project"
                            >
                                <Trash2 size={13} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddResource(resource);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs active:scale-95 transition cursor-pointer"
                                title="Add this catalog item to project"
                            >
                                <Plus size={11} className="stroke-[3]" /> Add to Project
                            </button>
                        )
                    )}
                </div>
            </td>
        </tr>
    );
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const ProjectResourceList = ({ onBack, setExtraBreadcrumbs, canWrite, projectId: propProjectId, onRefreshResources }) => {
    const { id: paramId } = useParams();
    const projectId = propProjectId || paramId;

    // Active View Tab: 'project' (Project Resources) or 'master' (Master Data)
    const [activeTab, setActiveTab] = useState('project');

    // Seed initial cached data from sessionStorage for instant rendering
    const getInitialCache = () => {
        try {
            const cached = sessionStorage.getItem(`mano_proj_grid_${projectId}`);
            if (cached) return JSON.parse(cached);
        } catch (e) { }
        return null;
    };
    const initialCache = getInitialCache();

    // Data states
    const [resources, setResources] = useState(() => initialCache?.resources || []);
    const [allResources, setAllResources] = useState(() => initialCache?.allResources || []);
    const [resolvedRates, setResolvedRates] = useState(() => initialCache?.resolvedRates || {});
    const [loading, setLoading] = useState(() => !initialCache);
    const [ratesLoading, setRatesLoading] = useState(() => !initialCache);
    const [error, setError] = useState('');

    // Date resolution
    const [effectiveDate, setEffectiveDate] = useState(dateOnly());

    // Search, Filter & Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    // Expandable In-Table Row Details
    const [expandedRowIds, setExpandedRowIds] = useState(new Set());
    const [rowRateDetails, setRowRateDetails] = useState({});

    // Selection & Excel Grid State
    const [selectedIds, setSelectedIds] = useState(new Set());
    const tableContainerRef = useRef(null);
    const searchInputRef = useRef(null);

    // Rate History Editing State
    const [editingRateHistory, setEditingRateHistory] = useState(null);
    const [isSavingHistoryEdit, setIsSavingHistoryEdit] = useState(false);

    // Toast & Confirm Modal
    const [toast, setToast] = useState(null);
    const showToast = useCallback((type, title, message, duration = 3000) => {
        setToast({ type, title, message, duration, id: Date.now() });
    }, []);

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

    const closeConfirmModal = useCallback(() => {
        setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }, []);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, rowIndex: 0 });

    useEffect(() => {
        const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    // Clear selection when switching tabs
    useEffect(() => {
        setSelectedIds(new Set());
        setCurrentPage(1);
    }, [activeTab]);

    // Breadcrumbs
    useEffect(() => {
        if (onBack && setExtraBreadcrumbs) {
            setExtraBreadcrumbs([
                { label: 'Material Management', onClick: onBack },
                { label: 'Project Resources & Rates' }
            ]);
        }
    }, [onBack, setExtraBreadcrumbs]);

    // Load resolved rates for project items
    const loadResolvedRates = useCallback(async (projectResources, masterResources, targetDate = effectiveDate) => {
        const masterById = new Map(masterResources.map(resource => [String(resource.id), resource]));
        const importedResourceIds = projectResources.map(resource => resource.resource_id);

        let resolvedById = new Map();
        if (importedResourceIds.length > 0) {
            try {
                const rateResponse = await projectApi.getResolvedResourceRates(projectId, importedResourceIds, targetDate);
                resolvedById = new Map((rateResponse.rates || []).map(rate => [String(rate.resourceId), rate]));
            } catch (err) {
                console.error('Failed to load project rates batch', err);
            }
        }

        const entries = projectResources.map(resource => {
            const resId = String(resource.resource_id);
            const masterRes = masterById.get(resId);
            const resolved = resolvedById.get(resId);

            if (resolved) {
                return [resId, resolved];
            }

            const hasMasterRate = masterRes?.rate_source === 'manual'
                && masterRes?.rate !== null
                && masterRes?.rate !== undefined;

            return [resId, {
                rate: hasMasterRate ? Number(masterRes.rate) : null,
                unitCode: masterRes?.rate_unit_code || masterRes?.base_unit_code || resource.base_unit_code,
                source: masterRes?.rate_source || null,
                rateScope: hasMasterRate ? 'master' : null
            }];
        });

        const resolvedMap = Object.fromEntries(entries);
        setResolvedRates(resolvedMap);

        try {
            const currentCache = JSON.parse(sessionStorage.getItem(`mano_proj_grid_${projectId}`) || '{}');
            sessionStorage.setItem(`mano_proj_grid_${projectId}`, JSON.stringify({
                ...currentCache,
                resolvedRates: resolvedMap
            }));
        } catch (e) { }
    }, [projectId, effectiveDate]);

    // Fetch initial dataset
    const fetchResources = useCallback(async (silent = false, targetDate = effectiveDate) => {
        try {
            if (!silent) setLoading(true);
            setRatesLoading(true);
            setError('');

            const [projectResponse, masterResponse] = await Promise.all([
                projectApi.listProjectResources(projectId),
                resourceApi.getResources({ type: 'item', limit: 5000, include_details: 'false', include_rates: 'false' })
            ]);

            const projectResources = projectResponse.resources || [];
            const masterResources = masterResponse.resources || [];
            const masterById = new Map(masterResources.map(resource => [String(resource.id), resource]));
            const importedIds = new Set(projectResources.map(resource => String(resource.resource_id)));

            // Project Items list
            const projectItems = projectResources
                .filter(isItemResource)
                .map(pRes => {
                    const masterRes = masterById.get(String(pRes.resource_id)) || {};
                    return {
                        ...masterRes,
                        ...pRes,
                        id: pRes.id || pRes.resource_id,
                        resource_id: pRes.resource_id || pRes.id,
                        name: pRes.name || masterRes.name || 'Unnamed Item',
                        code: pRes.code || masterRes.code || '',
                        base_unit_code: pRes.base_unit_code || masterRes.base_unit_code || 'nos',
                        description: pRes.description || masterRes.description || '',
                        master_rate: masterRes.rate !== null && masterRes.rate !== undefined ? Number(masterRes.rate) : null,
                        rate: masterRes.rate,
                        isImported: true
                    };
                });

            // Master Items list
            const allMasterItems = masterResources
                .filter(isItemResource)
                .map(mRes => ({
                    ...mRes,
                    resource_id: mRes.id,
                    master_rate: mRes.rate !== null && mRes.rate !== undefined ? Number(mRes.rate) : null,
                    isImported: importedIds.has(String(mRes.id))
                }));

            setAllResources(allMasterItems);
            setResources(projectItems);
            setLoading(false);

            try {
                const currentCache = JSON.parse(sessionStorage.getItem(`mano_proj_grid_${projectId}`) || '{}');
                sessionStorage.setItem(`mano_proj_grid_${projectId}`, JSON.stringify({
                    ...currentCache,
                    resources: projectItems,
                    allResources: allMasterItems
                }));
            } catch (e) { }

            try {
                await loadResolvedRates(projectResources, masterResources, targetDate);
            } catch (rateError) {
                console.error('Failed to resolve resource rates', rateError);
                setResolvedRates({});
            } finally {
                setRatesLoading(false);
            }
        } catch (err) {
            console.error('Failed to load project resources', err);
            setError(err.response?.data?.message || 'Failed to load project resources');
            showToast('error', 'Load Failed', err.response?.data?.message || 'Failed to load project resources');
        } finally {
            setLoading(false);
            setRatesLoading(false);
        }
    }, [projectId, effectiveDate, loadResolvedRates, showToast]);

    useEffect(() => {
        if (projectId) fetchResources();
    }, [projectId, fetchResources]);

    // Date change handler
    const handleDateChange = useCallback((newDate) => {
        setEffectiveDate(newDate);
        fetchResources(true, newDate);
        showToast('info', 'Date Filter Applied', `Resolving rates as of ${newDate}`);
    }, [fetchResources, showToast]);

    // Summary KPI statistics (Memoized)
    const stats = useMemo(() => {
        if (activeTab === 'project') {
            const total = resources.length;
            let overrides = 0;
            let masterRates = 0;
            let unconfigured = 0;

            for (const r of resources) {
                const rate = resolvedRates[String(r.resource_id)];
                if (!rate || rate.rate === null || rate.rate === undefined) {
                    unconfigured++;
                } else if (rate.rateScope === 'project') {
                    overrides++;
                } else if (rate.rateScope === 'master') {
                    masterRates++;
                }
            }
            return { total, overrides, masterRates, unconfigured };
        } else {
            const total = allResources.length;
            let imported = 0;
            let configured = 0;
            for (const r of allResources) {
                if (r.isImported) imported++;
                if (r.master_rate !== null && r.master_rate !== undefined) configured++;
            }
            return { total, imported, available: total - imported, configured };
        }
    }, [activeTab, resources, allResources, resolvedRates]);

    // Active dataset based on selected tab
    const activeDataset = useMemo(() => {
        return activeTab === 'project' ? resources : allResources;
    }, [activeTab, resources, allResources]);

    // Filter and Sort Data
    const filteredResources = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return activeDataset;

        return activeDataset.filter(resource => {
            const rate = resolvedRates[String(resource.resource_id)];
            const nameMatch = resource.name?.toLowerCase().includes(query);
            const codeMatch = resource.code?.toLowerCase().includes(query);
            const unitMatch = resource.base_unit_code?.toLowerCase().includes(query);
            const descMatch = resource.description?.toLowerCase().includes(query);
            const rateVal = rate?.rate !== null && rate?.rate !== undefined ? String(rate.rate) : '';
            const masterRateVal = resource.master_rate !== null && resource.master_rate !== undefined ? String(resource.master_rate) : '';
            const rateMatch = rateVal.includes(query) || masterRateVal.includes(query);

            return nameMatch || codeMatch || unitMatch || descMatch || rateMatch;
        });
    }, [activeDataset, resolvedRates, searchTerm]);

    const sortedResources = useMemo(() => {
        if (!sortConfig.key) return filteredResources;

        return [...filteredResources].sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (sortConfig.key === 'rate') {
                const aRate = resolvedRates[String(a.resource_id)]?.rate;
                const bRate = resolvedRates[String(b.resource_id)]?.rate;
                aVal = aRate !== null && aRate !== undefined ? Number(aRate) : -Infinity;
                bVal = bRate !== null && bRate !== undefined ? Number(bRate) : -Infinity;
            } else if (sortConfig.key === 'rateScope') {
                aVal = resolvedRates[String(a.resource_id)]?.rateScope || '';
                bVal = resolvedRates[String(b.resource_id)]?.rateScope || '';
            } else if (sortConfig.key === 'master_rate') {
                aVal = a.master_rate !== null && a.master_rate !== undefined ? Number(a.master_rate) : -Infinity;
                bVal = b.master_rate !== null && b.master_rate !== undefined ? Number(b.master_rate) : -Infinity;
            } else if (sortConfig.key === 'isImported') {
                aVal = a.isImported ? 1 : 0;
                bVal = b.isImported ? 1 : 0;
            }

            if (aVal === bVal) return 0;
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            const comparison = typeof aVal === 'string'
                ? aVal.localeCompare(String(bVal))
                : aVal > bVal ? 1 : -1;

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [filteredResources, sortConfig, resolvedRates]);

    // Pagination
    const totalPages = pageSize === 'All' ? 1 : Math.ceil(sortedResources.length / Number(pageSize)) || 1;
    const paginatedResources = useMemo(() => {
        if (pageSize === 'All') return sortedResources;
        const start = (currentPage - 1) * Number(pageSize);
        return sortedResources.slice(start, start + Number(pageSize));
    }, [sortedResources, pageSize, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(1);
    }, [totalPages, currentPage]);

    // Sorting Handler
    const handleSort = useCallback((columnKey) => {
        setSortConfig(prev => ({
            key: columnKey,
            direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, []);

    // Instant Row Selection Handlers
    const handleSelectAll = useCallback(() => {
        setSelectedIds(prev => {
            if (prev.size === paginatedResources.length && paginatedResources.length > 0) {
                return new Set();
            } else {
                return new Set(paginatedResources.map(r => r.resource_id));
            }
        });
    }, [paginatedResources]);

    const handleToggleSelectRow = useCallback((e, id) => {
        e?.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // Form change in nested sub-row
    const handleFormChange = useCallback((resId, field, value) => {
        setRowRateDetails(prev => ({
            ...prev,
            [resId]: {
                ...prev[resId],
                form: {
                    ...prev[resId]?.form,
                    [field]: value
                }
            }
        }));
    }, []);

    // ─── INSTANT ACCORDION RENDER (0ms SYNCHRONOUS INIT + BACKGROUND HISTORY) ───
    const loadInlineRateDetails = useCallback(async (resource) => {
        const resId = String(resource.resource_id ?? resource.id);
        try {
            const [resolvedResponse, historyResponse] = await Promise.all([
                projectApi.getResolvedResourceRate(projectId, resource.resource_id, effectiveDate).catch(() => ({ rate: null })),
                projectApi.getResourceRateHistory(projectId, resource.resource_id).catch(() => ({ rates: [] }))
            ]);
            const history = historyResponse?.rates || [];
            const activeProjectRate = history.find(row => Number(row.is_active) === 1 && row.rate !== null && row.rate !== undefined);

            setRowRateDetails(prev => ({
                ...prev,
                [resId]: {
                    ...prev[resId],
                    loading: false,
                    saving: false,
                    resolved: resolvedResponse.rate || null,
                    history,
                    activeProjectRate,
                    form: {
                        rate: activeProjectRate ? activeProjectRate.rate : (prev[resId]?.form?.rate ?? ''),
                        unitCode: activeProjectRate?.unit_code || prev[resId]?.form?.unitCode || resource.base_unit_code || 'nos',
                        effectiveFrom: activeProjectRate ? dateOnly(activeProjectRate.effective_from) : (prev[resId]?.form?.effectiveFrom || effectiveDate),
                        remarks: activeProjectRate?.remarks || ''
                    }
                }
            }));
        } catch (err) {
            console.error('Failed to load inline rate details', err);
            setRowRateDetails(prev => ({
                ...prev,
                [resId]: {
                    ...prev[resId],
                    loading: false
                }
            }));
        }
    }, [projectId, effectiveDate]);

    const toggleExpandRow = useCallback((resource) => {
        const resId = String(resource.resource_id ?? resource.id);
        const isExpanding = !expandedRowIds.has(resId);

        setExpandedRowIds(prev => {
            const next = new Set(prev);
            if (next.has(resId)) next.delete(resId);
            else next.add(resId);
            return next;
        });

        if (isExpanding) {
            // SYNCHRONOUSLY PRE-INITIALIZE FORM SO IT RENDERS IN 0ms INSTANTLY
            const currentRate = resolvedRates[resId]?.rate;
            const currentUnit = resolvedRates[resId]?.unitCode || resource.base_unit_code || 'nos';
            setRowRateDetails(prev => ({
                ...prev,
                [resId]: {
                    loading: !prev[resId]?.history,
                    saving: false,
                    history: prev[resId]?.history || [],
                    activeProjectRate: prev[resId]?.activeProjectRate || (resolvedRates[resId]?.rateScope === 'project' ? { rate: currentRate, unit_code: currentUnit } : null),
                    form: prev[resId]?.form || {
                        rate: currentRate !== null && currentRate !== undefined ? currentRate : '',
                        unitCode: currentUnit,
                        effectiveFrom: effectiveDate,
                        remarks: ''
                    }
                }
            }));

            // Fetch history in background without blocking UI
            loadInlineRateDetails(resource);
        }
    }, [expandedRowIds, resolvedRates, effectiveDate, loadInlineRateDetails]);

    const handleSaveInlineRate = useCallback(async (resource) => {
        const resId = String(resource.resource_id ?? resource.id);
        const detail = rowRateDetails[resId];
        if (!detail || detail.form.rate === '') return;

        setRowRateDetails(prev => ({
            ...prev,
            [resId]: { ...prev[resId], saving: true }
        }));

        try {
            await projectApi.addResourceRate(projectId, resource.resource_id, {
                rate: Number(detail.form.rate),
                unit_code: detail.form.unitCode,
                effective_from: detail.form.effectiveFrom,
                remarks: detail.form.remarks || undefined
            });
            showToast('success', 'Project Rate Saved', `Override rate saved for ${resource.name}.`);

            // Update resolvedRates locally for instant UI update
            setResolvedRates(prev => ({
                ...prev,
                [resId]: {
                    rate: Number(detail.form.rate),
                    unitCode: detail.form.unitCode,
                    source: 'manual',
                    rateScope: 'project'
                }
            }));

            await loadInlineRateDetails(resource);
        } catch (err) {
            showToast('error', 'Failed to Save Rate', err.response?.data?.message || 'Failed to save project rate');
            setRowRateDetails(prev => ({
                ...prev,
                [resId]: { ...prev[resId], saving: false }
            }));
        }
    }, [projectId, rowRateDetails, loadInlineRateDetails, showToast]);

    const handleRevertInlineRate = useCallback(async (resource) => {
        const resId = String(resource.resource_id ?? resource.id);
        const detail = rowRateDetails[resId];
        if (!detail || !detail.activeProjectRate) return;

        setConfirmModal({
            isOpen: true,
            title: 'Revert to Master Rate?',
            message: `Are you sure you want to clear the project override for "${resource.name}"? The item will automatically fall back to its master catalog rate.`,
            confirmText: 'Revert to Master',
            cancelText: 'Cancel',
            variant: 'warning',
            isLoading: false,
            onConfirm: async () => {
                setRowRateDetails(prev => ({
                    ...prev,
                    [resId]: { ...prev[resId], saving: true }
                }));
                try {
                    await projectApi.clearResourceRate(projectId, resource.resource_id, detail.form.effectiveFrom);
                    showToast('success', 'Reverted to Master Rate', `Project rate override cleared for ${resource.name}.`);
                    closeConfirmModal();

                    // Update resolvedRates locally
                    setResolvedRates(prev => ({
                        ...prev,
                        [resId]: {
                            rate: resource.master_rate,
                            unitCode: resource.base_unit_code,
                            source: 'manual',
                            rateScope: resource.master_rate !== null && resource.master_rate !== undefined ? 'master' : null
                        }
                    }));

                    await loadInlineRateDetails(resource);
                } catch (err) {
                    showToast('error', 'Revert Failed', err.response?.data?.message || 'Failed to revert project rate');
                    closeConfirmModal();
                    setRowRateDetails(prev => ({
                        ...prev,
                        [resId]: { ...prev[resId], saving: false }
                    }));
                }
            }
        });
    }, [projectId, rowRateDetails, closeConfirmModal, loadInlineRateDetails, showToast]);

    // ─── EDIT HISTORICAL RATE VERSION ──────────────────────────────────────────
    const handleOpenEditRateHistory = useCallback((resource, historyRow) => {
        const isComputed = historyRow.rate === null || historyRow.rate === undefined || String(historyRow.remarks || '').toLowerCase().includes('computed');
        setEditingRateHistory({
            resource,
            id: historyRow.id,
            mode: (resource?.type === 'item' && isComputed) ? 'computed' : 'manual',
            rate: historyRow.rate !== null && historyRow.rate !== undefined ? String(historyRow.rate) : '',
            unit_code: historyRow.unit_code || resource.base_unit_code || 'nos',
            effective_from: dateOnly(historyRow.effective_from),
            effective_to: historyRow.effective_to ? dateOnly(historyRow.effective_to) : '',
            remarks: historyRow.remarks || ''
        });
    }, []);

    const handleSaveRateHistoryEdit = useCallback(async (e) => {
        e.preventDefault();
        if (!editingRateHistory) return;
        setIsSavingHistoryEdit(true);

        const { resource, id, mode, rate, unit_code, effective_from, effective_to, remarks } = editingRateHistory;
        const resId = String(resource.resource_id ?? resource.id);
        const isComputedMode = mode === 'computed';

        try {
            await projectApi.updateResourceRate(projectId, resource.resource_id, id, {
                mode: isComputedMode ? 'computed' : 'manual',
                rate: isComputedMode ? null : parseFloat(rate),
                unit_code,
                effective_from,
                effective_to: effective_to || null,
                remarks: remarks || (isComputedMode ? 'Dynamic recipe calculation' : undefined)
            });

            showToast('success', 'Rate Version Updated', isComputedMode ? 'Switched to dynamic computed recipe.' : `Historical rate record updated for ${resource.name}.`);
            setEditingRateHistory(null);

            // Reload row history and rate details
            await loadInlineRateDetails(resource);

            // Re-resolve rate for this item
            const rateResp = await projectApi.getResolvedResourceRate(projectId, resource.resource_id, effectiveDate);
            if (rateResp?.rate) {
                setResolvedRates(prev => ({ ...prev, [resId]: rateResp.rate }));
            }
        } catch (err) {
            showToast('error', 'Update Failed', err.response?.data?.message || err.message || 'Failed to update rate record');
        } finally {
            setIsSavingHistoryEdit(false);
        }
    }, [projectId, editingRateHistory, effectiveDate, loadInlineRateDetails, showToast]);

    // ─── REVERT PROJECT ITEM TO COMPUTED RECIPE ────────────────────────────────
    const handleRevertToComputedInline = useCallback(async (resource) => {
        const resId = String(resource.resource_id ?? resource.id);
        const detail = rowRateDetails[resId];
        const effFrom = detail?.form?.effectiveFrom || effectiveDate;

        setConfirmModal({
            isOpen: true,
            title: 'Revert to Computed Recipe Rate?',
            message: `Are you sure you want to clear the manual rate override for "${resource.name}"? The project item will calculate dynamically from its composition recipe.`,
            confirmText: 'Revert to Computed',
            cancelText: 'Cancel',
            variant: 'primary',
            isLoading: false,
            onConfirm: async () => {
                setRowRateDetails(prev => ({
                    ...prev,
                    [resId]: { ...prev[resId], saving: true }
                }));
                try {
                    await projectApi.clearResourceRate(projectId, resource.resource_id, effFrom, 'computed');
                    showToast('success', 'Reverted to Computed Recipe', `Project item "${resource.name}" now calculates dynamically from recipe.`);
                    closeConfirmModal();

                    // Re-resolve rate for this item
                    const rateResp = await projectApi.getResolvedResourceRate(projectId, resource.resource_id, effectiveDate);
                    if (rateResp?.rate) {
                        setResolvedRates(prev => ({ ...prev, [resId]: rateResp.rate }));
                    }
                    await loadInlineRateDetails(resource);
                } catch (err) {
                    showToast('error', 'Revert Failed', err.response?.data?.message || 'Failed to revert to computed rate');
                    closeConfirmModal();
                    setRowRateDetails(prev => ({
                        ...prev,
                        [resId]: { ...prev[resId], saving: false }
                    }));
                }
            }
        });
    }, [projectId, rowRateDetails, effectiveDate, closeConfirmModal, loadInlineRateDetails, showToast]);

    // ─── HIGH SPEED ADD SINGLE RESOURCE (OPTIMISTIC & INSTANT) ─────────────────
    const handleAddResource = useCallback(async (resource) => {
        const resId = resource.id || resource.resource_id;

        // Optimistically update local state immediately with type-tolerant comparisons
        setAllResources(prev => {
            const next = prev.map(item => String(item.id) === String(resId) ? { ...item, isImported: true } : item);
            try {
                const currentCache = JSON.parse(sessionStorage.getItem(`mano_proj_grid_${projectId}`) || '{}');
                sessionStorage.setItem(`mano_proj_grid_${projectId}`, JSON.stringify({ ...currentCache, allResources: next }));
            } catch (e) { }
            return next;
        });

        setResources(prev => {
            if (prev.some(r => String(r.resource_id) === String(resId))) return prev;
            const next = [...prev, {
                ...resource,
                id: resId,
                resource_id: resId,
                isImported: true
            }];
            try {
                const currentCache = JSON.parse(sessionStorage.getItem(`mano_proj_grid_${projectId}`) || '{}');
                sessionStorage.setItem(`mano_proj_grid_${projectId}`, JSON.stringify({ ...currentCache, resources: next }));
            } catch (e) { }
            return next;
        });

        showToast('success', 'Resource Imported', `${resource.name} added to project.`);

        try {
            await projectApi.importResource(projectId, resId, effectiveDate);

            // Notify parent to refresh counts without blocking UI
            if (onRefreshResources) onRefreshResources();

            // Resolve rate in background for new item (isolated try/catch so unresolved rate doesn't abort import)
            try {
                const rateResp = await projectApi.getResolvedResourceRate(projectId, resId, effectiveDate);
                if (rateResp?.rate) {
                    setResolvedRates(prev => ({ ...prev, [String(resId)]: rateResp.rate }));
                }
            } catch (rateErr) {
                console.warn('Rate not yet configured for imported item:', rateErr);
            }
        } catch (err) {
            console.error('Failed to import resource into project:', err);
            showToast('error', 'Import Failed', err.response?.data?.message || 'Failed to import resource into project');
            // Rollback on genuine import failure
            setAllResources(prev => prev.map(item => String(item.id) === String(resId) ? { ...item, isImported: false } : item));
            setResources(prev => prev.filter(r => String(r.resource_id) !== String(resId)));
        }
    }, [projectId, effectiveDate, showToast, onRefreshResources]);

    // ─── HIGH SPEED BULK IMPORT (SINGLE BATCH API CALL) ────────────────────────
    const handleBulkImport = useCallback(async () => {
        const unimportedSelected = paginatedResources.filter(r => selectedIds.has(r.resource_id) && !r.isImported);
        if (unimportedSelected.length === 0) {
            showToast('info', 'Already In Project', 'All selected items are already imported to this project.');
            return;
        }

        const idsToImport = unimportedSelected.map(r => r.resource_id);
        const idsSet = new Set(idsToImport.map(String));

        // Optimistically mark items as imported immediately!
        setAllResources(prev => {
            const next = prev.map(item => idsSet.has(String(item.id)) ? { ...item, isImported: true } : item);
            try {
                const currentCache = JSON.parse(sessionStorage.getItem(`mano_proj_grid_${projectId}`) || '{}');
                sessionStorage.setItem(`mano_proj_grid_${projectId}`, JSON.stringify({ ...currentCache, allResources: next }));
            } catch (e) { }
            return next;
        });

        setResources(prev => {
            const existingIds = new Set(prev.map(r => String(r.resource_id)));
            const newItems = unimportedSelected
                .filter(r => !existingIds.has(String(r.resource_id)))
                .map(r => ({ ...r, isImported: true }));
            const next = [...prev, ...newItems];
            try {
                const currentCache = JSON.parse(sessionStorage.getItem(`mano_proj_grid_${projectId}`) || '{}');
                sessionStorage.setItem(`mano_proj_grid_${projectId}`, JSON.stringify({ ...currentCache, resources: next }));
            } catch (e) { }
            return next;
        });

        setSelectedIds(new Set());
        showToast('success', 'Importing Items...', `Importing ${idsToImport.length} item(s) in batch...`);

        try {
            await projectApi.importResourcesBatch(projectId, idsToImport, effectiveDate);
            showToast('success', 'Bulk Import Complete', `Successfully imported ${idsToImport.length} item(s) to project.`);

            // Notify parent to refresh counts
            if (onRefreshResources) onRefreshResources();

            // Resolve rates in background for imported batch (isolated try/catch)
            try {
                const ratesResp = await projectApi.getResolvedResourceRates(projectId, idsToImport, effectiveDate);
                if (ratesResp?.rates) {
                    const newRates = Object.fromEntries((ratesResp.rates || []).map(r => [String(r.resourceId), r]));
                    setResolvedRates(prev => ({ ...prev, ...newRates }));
                }
            } catch (ratesErr) {
                console.warn('Failed resolving batch rates:', ratesErr);
            }
        } catch (err) {
            showToast('error', 'Bulk Import Error', err.response?.data?.message || 'Error occurred during bulk import.');
            fetchResources(true);
        }
    }, [paginatedResources, selectedIds, projectId, effectiveDate, showToast, fetchResources, onRefreshResources]);

    // Remove Single Resource from Project
    const handleRemoveResource = useCallback((resource) => {
        setConfirmModal({
            isOpen: true,
            title: 'Remove Item from Project?',
            message: `Are you sure you want to remove "${resource.name}" from this project? Project-specific rates will be removed.`,
            confirmText: 'Remove Item',
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                const resId = resource.resource_id;
                try {
                    await projectApi.removeProjectResource(projectId, resId);
                    showToast('success', 'Item Removed', `${resource.name} removed from project.`);
                    closeConfirmModal();

                    // Update state locally
                    setResources(prev => {
                        const next = prev.filter(r => String(r.resource_id) !== String(resId));
                        try {
                            const currentCache = JSON.parse(sessionStorage.getItem(`mano_proj_grid_${projectId}`) || '{}');
                            sessionStorage.setItem(`mano_proj_grid_${projectId}`, JSON.stringify({ ...currentCache, resources: next }));
                        } catch (e) { }
                        return next;
                    });
                    setAllResources(prev => {
                        const next = prev.map(item => String(item.id) === String(resId) ? { ...item, isImported: false } : item);
                        try {
                            const currentCache = JSON.parse(sessionStorage.getItem(`mano_proj_grid_${projectId}`) || '{}');
                            sessionStorage.setItem(`mano_proj_grid_${projectId}`, JSON.stringify({ ...currentCache, allResources: next }));
                        } catch (e) { }
                        return next;
                    });
                    setResolvedRates(prev => {
                        const next = { ...prev };
                        delete next[String(resId)];
                        return next;
                    });
                    if (onRefreshResources) onRefreshResources();
                } catch (err) {
                    showToast('error', 'Removal Failed', err.response?.data?.message || 'Failed to remove resource from project');
                    closeConfirmModal();
                }
            }
        });
    }, [projectId, closeConfirmModal, showToast, onRefreshResources]);

    // Bulk Remove Resources from Project
    const handleBulkRemove = useCallback(() => {
        const selectedItems = paginatedResources.filter(r => selectedIds.has(r.resource_id) && r.isImported);
        if (selectedItems.length === 0) return;

        setConfirmModal({
            isOpen: true,
            title: `Remove ${selectedItems.length} Items from Project?`,
            message: `Are you sure you want to remove ${selectedItems.length} item(s) from this project?`,
            confirmText: `Remove (${selectedItems.length})`,
            cancelText: 'Cancel',
            variant: 'danger',
            isLoading: false,
            onConfirm: async () => {
                const idsToRemove = new Set(selectedItems.map(r => r.resource_id));
                try {
                    for (const item of selectedItems) {
                        try {
                            await projectApi.removeProjectResource(projectId, item.resource_id);
                        } catch (e) {
                            console.error(`Failed to remove item ${item.name}`, e);
                        }
                    }
                    showToast('success', 'Bulk Removal Complete', `Removed ${selectedItems.length} item(s) from project.`);
                    setSelectedIds(new Set());
                    closeConfirmModal();

                    // Update state locally
                    setResources(prev => prev.filter(r => !idsToRemove.has(r.resource_id)));
                    setAllResources(prev => prev.map(item => idsToRemove.has(item.id) ? { ...item, isImported: false } : item));
                } catch (err) {
                    showToast('error', 'Bulk Remove Failed', err.message || 'Failed to complete bulk removal');
                    closeConfirmModal();
                }
            }
        });
    }, [paginatedResources, selectedIds, projectId, closeConfirmModal, showToast]);

    // Export CSV Handler
    const handleExportCSV = useCallback(() => {
        const headers = activeTab === 'project'
            ? ['Code', 'Item Name', 'Unit', 'Master Rate (INR)', 'Applied Rate (INR)', 'Rate Source', 'Effective As Of']
            : ['Code', 'Item Name', 'Type', 'Unit', 'Master Rate (INR)', 'Project Status'];

        const dataToExport = selectedIds.size > 0
            ? sortedResources.filter(r => selectedIds.has(r.resource_id))
            : sortedResources;

        const csvRows = dataToExport.map(r => {
            const rate = resolvedRates[String(r.resource_id)];
            const masterRateStr = r.master_rate !== null && r.master_rate !== undefined ? String(r.master_rate) : '';
            const rateStr = rate?.rate !== null && rate?.rate !== undefined ? String(rate.rate) : '';
            const rateScopeStr = rate?.rateScope === 'project' ? 'Project Override' : rate?.rateScope === 'master' ? 'Master Rate' : 'Not Configured';

            if (activeTab === 'project') {
                return [
                    r.code || '',
                    r.name || '',
                    r.base_unit_code || '',
                    masterRateStr,
                    rateStr,
                    rateScopeStr,
                    effectiveDate
                ];
            } else {
                return [
                    r.code || '',
                    r.name || '',
                    r.type || 'item',
                    r.base_unit_code || '',
                    masterRateStr,
                    r.isImported ? 'Imported to Project' : 'Available'
                ];
            }
        });

        const csvString = [
            headers.join(','),
            ...csvRows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${activeTab === 'project' ? `project_${projectId}_resources` : 'master_catalog_items'}_${effectiveDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('sparkle', 'Export Complete', `Exported ${dataToExport.length} item(s) to CSV.`);
    }, [activeTab, selectedIds, sortedResources, resolvedRates, effectiveDate, projectId, showToast]);

    // Context menu handlers
    const handleContextMenu = useCallback((e, rowIndex) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            visible: true,
            x: Math.min(e.clientX, window.innerWidth - 220),
            y: Math.min(e.clientY, window.innerHeight - 260),
            rowIndex
        });
    }, []);

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full relative Poppins text-left">
            {/* Custom Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={closeConfirmModal}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                variant={confirmModal.variant}
                isLoading={confirmModal.isLoading}
            />

            {/* Toast Notification */}
            <Toast toast={toast} onClose={() => setToast(null)} />

            {/* Top Navigation Header */}
            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between shrink-0 bg-white dark:bg-[#0d1117] z-20">
                <div className="flex items-center space-x-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition-all active:scale-95 cursor-pointer"
                            title="Back to Material Management"
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">Material Management</h1>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20">
                                {activeTab === 'project' ? 'Project Items' : 'Master Catalog'}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                            {activeTab === 'project'
                                ? 'Items configured for this project with real-time rate resolution and master fallback.'
                                : 'Organization master catalog data. Browse and add items to this project.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Export CSV */}
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-700 hover:text-gray-900 border border-gray-200 dark:text-gray-300 dark:hover:text-white dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition active:scale-95 cursor-pointer shadow-xs"
                        title="Export current table to CSV"
                    >
                        <Download size={13} />
                        <span>Export CSV</span>
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={() => fetchResources(false)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer shadow-xs"
                        title="Refresh items and rates"
                    >
                        <RefreshCw size={14} className={loading || ratesLoading ? 'animate-spin text-blue-600' : ''} />
                    </button>
                </div>
            </div>

            {/* Stats Header (Excel-Theme KPI Cards) */}
            <div className="px-3 pt-2 pb-2 border-b border-gray-200 dark:border-white/5 shrink-0 bg-gray-50/40 dark:bg-[#161b22]/30">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {activeTab === 'project' ? (
                        [
                            { id: 'total', label: 'Project Items', value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-white dark:bg-white/[0.03]' },
                            { id: 'overrides', label: 'Project Overrides', value: stats.overrides, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
                            { id: 'masterRates', label: 'Inheriting Master Rates', value: stats.masterRates, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
                            { id: 'unconfigured', label: 'Unconfigured Rates', value: stats.unconfigured, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50/50 dark:bg-purple-900/10' },
                        ].map((s) => (
                            <div key={s.id} className={`${s.bg} rounded-lg p-2 px-3 border border-gray-200/60 dark:border-white/5 shadow-xs`}>
                                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                                <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
                            </div>
                        ))
                    ) : (
                        [
                            { id: 'total', label: 'Total Master Items', value: stats.total, color: 'text-gray-900 dark:text-white', bg: 'bg-white dark:bg-white/[0.03]' },
                            { id: 'imported', label: 'Already in Project', value: stats.imported, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
                            { id: 'available', label: 'Available to Import', value: stats.available, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-900/10' },
                            { id: 'configured', label: 'Master Rates Set', value: stats.configured, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
                        ].map((s) => (
                            <div key={s.id} className={`${s.bg} rounded-lg p-2 px-3 border border-gray-200/60 dark:border-white/5 shadow-xs`}>
                                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                                <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Toolbar - Search, TWO Clean Tabs & CustomDatePicker for Effective Date */}
            <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-200 dark:border-white/5 shrink-0 gap-3 bg-white dark:bg-[#0d1117]">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Search Input */}
                    <div className="relative w-64 shrink-0">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={activeTab === 'project' ? "Search project items..." : "Search master catalog..."}
                            className="w-full pl-7 pr-7 py-1.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* TWO PRIMARY CLEAN OPTIONS */}
                    <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 shrink-0 select-none">
                        <button
                            type="button"
                            onClick={() => setActiveTab('project')}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${activeTab === 'project'
                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            Project Resources ({resources.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('master')}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${activeTab === 'master'
                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            Master Data ({allResources.length})
                        </button>
                    </div>
                </div>


            </div>

            {/* Error banner if any */}
            {error && (
                <div className="mx-3 mt-2 p-2.5 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-300 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button onClick={() => setError('')} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded cursor-pointer"><X size={12} /></button>
                </div>
            )}

            {/* Floating Bottom Action Toaster Dock (Bulk Actions) */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[6500] bg-gray-900/95 dark:bg-[#161b22]/95 border border-blue-500/40 text-white shadow-2xl backdrop-blur-md rounded-2xl px-4 py-2 flex items-center gap-3 select-none text-xs"
                    >
                        <div className="flex items-center gap-2 pr-3 border-r border-white/10 font-semibold">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 rounded-xl font-bold text-xs text-white shadow-xs">
                                <CheckSquare size={13} />
                                {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {canWrite && activeTab === 'master' && (
                                <button
                                    onClick={handleBulkImport}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-md shadow-blue-500/20"
                                    title="Import selected items to project"
                                >
                                    <Plus size={13} className="stroke-[3]" />
                                    Add Selected to Project
                                </button>
                            )}

                            {canWrite && activeTab === 'project' && (
                                <button
                                    onClick={handleBulkRemove}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                                    title="Remove selected items from project"
                                >
                                    <Trash2 size={13} />
                                    Remove from Project
                                </button>
                            )}

                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition text-white active:scale-95 cursor-pointer"
                                title="Export selected items to CSV"
                            >
                                <Download size={13} />
                                Export Selected
                            </button>

                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition ml-1 cursor-pointer"
                                title="Deselect all rows"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Spreadsheet Grid Container */}
            <div ref={tableContainerRef} className="flex-1 min-h-0 flex overflow-hidden w-full relative">
                <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    <table className="w-full min-w-[1200px] text-left whitespace-nowrap text-xs border-collapse bg-white dark:bg-[#0d1117] select-none">
                        <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-20 border-b border-gray-200 dark:border-white/5 tracking-wider text-[10px] uppercase font-bold select-none shadow-xs">
                            <tr>
                                {/* Checkbox Header */}
                                <th className="px-3 py-3 w-10 text-center border-r border-gray-150 dark:border-white/5">
                                    <div className="flex justify-center">
                                        <CustomCheckbox
                                            checked={paginatedResources.length > 0 && selectedIds.size === paginatedResources.length}
                                            onChange={handleSelectAll}
                                            title="Select All on Current Page"
                                        />
                                    </div>
                                </th>

                                {/* Row # & Expand Header */}
                                <th className="px-2 py-3 w-14 text-center border-r border-gray-150 dark:border-white/5">#</th>

                                {/* Item Code */}
                                <th
                                    onClick={() => handleSort('code')}
                                    className="px-3 py-3 w-36 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span>Item Code</span>
                                        {sortConfig.key === 'code' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>

                                {/* Item Name */}
                                <th
                                    onClick={() => handleSort('name')}
                                    className="px-4 py-3 min-w-[240px] border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span>Item Name</span>
                                        {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>

                                {/* Unit */}
                                <th
                                    onClick={() => handleSort('base_unit_code')}
                                    className="px-3 py-3 w-20 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <span>Unit</span>
                                        {sortConfig.key === 'base_unit_code' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </div>
                                </th>

                                {activeTab === 'project' && (
                                    <>
                                        {/* Applied Effective Rate */}
                                        <th
                                            onClick={() => handleSort('rate')}
                                            className="px-4 py-3 w-48 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>Applied Rate (₹)</span>
                                                {sortConfig.key === 'rate' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                            </div>
                                        </th>

                                        {/* Rate Source */}
                                        <th
                                            onClick={() => handleSort('rateScope')}
                                            className="px-3 py-3 w-36 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>Rate Source</span>
                                                {sortConfig.key === 'rateScope' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                            </div>
                                        </th>
                                    </>
                                )}

                                {activeTab === 'master' && (
                                    <>
                                        {/* Master Rate (INR) */}
                                        <th
                                            onClick={() => handleSort('master_rate')}
                                            className="px-3 py-3 w-36 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>Master Rate (₹)</span>
                                                {sortConfig.key === 'master_rate' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('isImported')}
                                            className="px-3 py-3 w-36 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>Project Status</span>
                                                {sortConfig.key === 'isImported' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                            </div>
                                        </th>
                                    </>
                                )}

                                <th className="px-4 py-3 w-32 text-center">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-sans">
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`skel-row-${i}`} className="animate-pulse">
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <td key={`skel-cell-${i}-${j}`} className="px-3 py-3.5 border-r border-gray-100 dark:border-white/5">
                                                <div className="h-3 bg-gray-100 dark:bg-white/5 rounded"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : paginatedResources.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Package className="text-gray-300 dark:text-white/10" size={44} />
                                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                                                {activeTab === 'project' ? 'No project resources configured' : 'No master catalog items found'}
                                            </p>
                                            <p className="text-xs text-gray-400 max-w-sm">
                                                {searchTerm
                                                    ? 'Try adjusting your search query.'
                                                    : activeTab === 'project'
                                                        ? 'Click "Master Data" tab above to view and add items into this project.'
                                                        : 'No items in the organization master catalog.'}
                                            </p>
                                            {canWrite && !searchTerm && activeTab === 'project' && (
                                                <button
                                                    onClick={() => setActiveTab('master')}
                                                    className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-blue-500/20 cursor-pointer"
                                                >
                                                    <Database size={14} /> Open Master Data
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedResources.map((resource, index) => {
                                    const rowIndex = pageSize === 'All' ? index : (currentPage - 1) * Number(pageSize) + index;
                                    const resId = String(resource.resource_id);
                                    const isRowSelected = selectedIds.has(resource.resource_id);

                                    if (activeTab === 'project') {
                                        return (
                                            <ProjectResourceRow
                                                key={resource.resource_id || `p-row-${rowIndex}`}
                                                resource={resource}
                                                rowIndex={rowIndex}
                                                isSelected={isRowSelected}
                                                isExpanded={expandedRowIds.has(resId)}
                                                rate={resolvedRates[resId]}
                                                ratesLoading={ratesLoading}
                                                rowDetail={rowRateDetails[resId]}
                                                canWrite={canWrite}
                                                onToggleSelect={handleToggleSelectRow}
                                                onToggleExpand={toggleExpandRow}
                                                onContextMenu={handleContextMenu}
                                                onSaveInlineRate={handleSaveInlineRate}
                                                onRevertInlineRate={handleRevertInlineRate}
                                                onRevertToComputed={handleRevertToComputedInline}
                                                onRemoveResource={handleRemoveResource}
                                                onFormChange={handleFormChange}
                                                onEditRateHistory={handleOpenEditRateHistory}
                                            />
                                        );
                                    } else {
                                        return (
                                            <MasterResourceRow
                                                key={resource.resource_id || `m-row-${rowIndex}`}
                                                resource={resource}
                                                rowIndex={rowIndex}
                                                isSelected={isRowSelected}
                                                canWrite={canWrite}
                                                onToggleSelect={handleToggleSelectRow}
                                                onContextMenu={handleContextMenu}
                                                onAddResource={handleAddResource}
                                                onRemoveResource={handleRemoveResource}
                                            />
                                        );
                                    }
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Excel Status Bar & Pagination Footer */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-white/5 flex items-center justify-between shrink-0 bg-[#f9fafb] dark:bg-[#161b22] text-xs text-gray-500 dark:text-gray-400 select-none">
                <div className="flex items-center gap-4">
                    <span className="font-mono text-[11px]">
                        Showing <strong className="text-gray-900 dark:text-white">{sortedResources.length > 0 ? (currentPage - 1) * (pageSize === 'All' ? sortedResources.length : Number(pageSize)) + 1 : 0}</strong> to <strong className="text-gray-900 dark:text-white">{pageSize === 'All' ? sortedResources.length : Math.min(currentPage * Number(pageSize), sortedResources.length)}</strong> of <strong className="text-gray-900 dark:text-white">{sortedResources.length}</strong> items
                        {activeDataset.length !== sortedResources.length && (
                            <span className="text-gray-400 ml-1 font-sans">(filtered from {activeDataset.length} total)</span>
                        )}
                    </span>

                    {selectedIds.size > 0 && (
                        <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                            <CheckSquare size={12} /> {selectedIds.size} selected
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <CustomPageSizeDropdown
                        pageSize={pageSize}
                        setPageSize={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                    />

                    {pageSize !== 'All' && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                className="p-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer text-gray-600 dark:text-gray-300"
                                title="Previous page"
                            >
                                <ChevronLeft size={14} />
                            </button>

                            <span className="px-2 text-xs font-semibold text-gray-700 dark:text-gray-300 font-mono">
                                {currentPage} / {totalPages}
                            </span>

                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                className="p-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer text-gray-600 dark:text-gray-300"
                                title="Next page"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Click Context Menu */}
            {contextMenu.visible && (
                <div
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    className="fixed z-[8000] bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl py-1 text-xs font-semibold w-52 overflow-hidden"
                >
                    {(() => {
                        const target = paginatedResources[contextMenu.rowIndex];
                        if (!target) return null;

                        return (
                            <>
                                <div className="px-3 py-1.5 border-b border-gray-100 dark:border-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">
                                    {target.name}
                                </div>

                                {activeTab === 'project' && (
                                    <button
                                        onClick={() => {
                                            setContextMenu(prev => ({ ...prev, visible: false }));
                                            toggleExpandRow(target);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-white/5 transition cursor-pointer"
                                    >
                                        <History size={13} className="text-blue-500" />
                                        <span>Expand Rate Details</span>
                                    </button>
                                )}

                                {canWrite && (
                                    target.isImported ? (
                                        <button
                                            onClick={() => {
                                                setContextMenu(prev => ({ ...prev, visible: false }));
                                                handleRemoveResource(target);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-white/5 transition cursor-pointer"
                                        >
                                            <Trash2 size={13} />
                                            <span>Remove from Project</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setContextMenu(prev => ({ ...prev, visible: false }));
                                                handleAddResource(target);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/5 transition cursor-pointer"
                                        >
                                            <Plus size={13} />
                                            <span>Add to Project</span>
                                        </button>
                                    )
                                )}

                                <button
                                    onClick={() => {
                                        setContextMenu(prev => ({ ...prev, visible: false }));
                                        const rate = resolvedRates[String(target.resource_id)];
                                        const text = `Item: ${target.name}\nCode: ${target.code || 'N/A'}\nUnit: ${target.base_unit_code}\nMaster Rate: ₹${target.master_rate ?? 'N/A'}\nApplied Rate: ₹${rate?.rate ?? 'N/A'}`;
                                        navigator.clipboard.writeText(text);
                                        showToast('sparkle', 'Copied Details', `Copied info for "${target.name}".`);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 border-t border-gray-100 dark:border-white/5 transition cursor-pointer"
                                >
                                    <Copy size={13} />
                                    <span>Copy Item Info</span>
                                </button>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Edit Historical Rate Modal with Warning Banner */}
            {editingRateHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="w-full max-w-lg bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                    Edit Project Rate Record
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {editingRateHistory.resource?.name}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingRateHistory(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Warning Alert Banner */}
                        <div className="p-4 mx-6 mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 rounded-xl flex items-start gap-3">
                            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                    Caution: Modifying Historical Rate Records
                                </h4>
                                <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                                    Directly updating an existing rate version alters historical records. Any calculations, purchase orders, or ledgers referencing this date period will recalculate based on these revised figures.
                                </p>
                            </div>
                        </div>

                        {/* Edit Form */}
                        <form onSubmit={handleSaveRateHistoryEdit} className="p-6 space-y-4">
                            {editingRateHistory.resource?.type === 'item' && (
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold uppercase text-gray-400">Rate Calculation Mode</label>
                                    <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setEditingRateHistory(prev => ({ ...prev, mode: 'computed' }))}
                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                                editingRateHistory.mode === 'computed'
                                                    ? 'bg-purple-600 text-white shadow-sm'
                                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <Calculator size={13} />
                                            <span>Dynamic Computed Recipe</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingRateHistory(prev => ({ ...prev, mode: 'manual' }))}
                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                                editingRateHistory.mode === 'manual'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                            }`}
                                        >
                                            <Edit2 size={13} />
                                            <span>Fixed Manual Override</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {editingRateHistory.mode === 'computed' ? (
                                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 rounded-xl space-y-1">
                                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
                                        <Calculator size={14} />
                                        <span>Dynamic Recipe Calculation</span>
                                    </div>
                                    <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 leading-relaxed">
                                        This rate version will dynamically compute its price from the constituent materials and labour active during this date range.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Override Rate (₹)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            min="0"
                                            value={editingRateHistory.rate}
                                            onChange={e => setEditingRateHistory(prev => ({ ...prev, rate: e.target.value }))}
                                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Unit</label>
                                        <CustomSelect
                                            options={UNIT_SELECT_OPTIONS}
                                            value={editingRateHistory.unit_code}
                                            onChange={val => setEditingRateHistory(prev => ({ ...prev, unit_code: val }))}
                                            placeholder="Select unit"
                                            direction="down"
                                            alwaysOpenDownward={true}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Effective From</label>
                                    <CustomDatePicker
                                        value={editingRateHistory.effective_from}
                                        onChange={e => setEditingRateHistory(prev => ({ ...prev, effective_from: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Effective To (Optional)</label>
                                    <CustomDatePicker
                                        value={editingRateHistory.effective_to}
                                        onChange={e => setEditingRateHistory(prev => ({ ...prev, effective_to: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Reason / Revision Remarks</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Corrected project site invoice typo"
                                    value={editingRateHistory.remarks}
                                    onChange={e => setEditingRateHistory(prev => ({ ...prev, remarks: e.target.value }))}
                                    className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-200 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setEditingRateHistory(null)}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingHistoryEdit}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                                >
                                    {isSavingHistoryEdit ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default ProjectResourceList;
