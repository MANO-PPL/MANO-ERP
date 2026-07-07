import React, { useState, useMemo } from 'react';
import {
    Plus, Trash2, Download, ChevronUp, ChevronDown, AlertCircle,
    HardHat, Zap, Droplets, Flame, PenTool, Building2, Settings2, Trees, Users, Package, AlertTriangle
} from 'lucide-react';

// ─── Icon map (matches Budget/index.jsx) ───────────────────────────────────
const ICON_MAP = {
    HardHat: <HardHat size={18} />,
    Zap: <Zap size={18} />,
    Droplets: <Droplets size={18} />,
    Flame: <Flame size={18} />,
    PenTool: <PenTool size={18} />,
    Building2: <Building2 size={18} />,
    Settings2: <Settings2 size={18} />,
    Trees: <Trees size={18} />,
    Users: <Users size={18} />,
    Package: <Package size={18} />,
    AlertTriangle: <AlertTriangle size={18} />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, dec = 2) =>
    n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const computeItem = (it, slabArea, gstRate) => {
    const resolved = it.totalRateOverride != null
        ? it.totalRateOverride
        : (Number(it.materialRate) + Number(it.labourRate));
    const basicLacs = (resolved * Number(it.quantity)) / 100_000;
    const ratePSft = slabArea > 0 ? (basicLacs * 100_000) / slabArea : 0;
    const gstLacs = basicLacs * (1 + gstRate);
    return { resolved, basicLacs, ratePSft, gstLacs };
};

const EditCell = ({ value, onChange, type = 'text', align = 'left', placeholder = '', readOnly = false }) => (
    <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={e => !readOnly && onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        className={`w-full bg-transparent outline-none text-${align} text-xs px-1 py-0.5 rounded transition-all
            ${readOnly
                ? 'cursor-default select-text opacity-80'
                : 'focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-1 ring-blue-400'}`}
    />
);

// Utilisation colour
const utilColor = (pct) => {
    if (pct >= 100) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
    if (pct >= 80) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
    return { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
};

// ─── Main SectionView ──────────────────────────────────────────────────────────
const SectionView = ({ section, onItemsChange, slabArea, gstRate, canWrite }) => {
    const items = section.items;

    const updateItem = (id, field, val) =>
        onItemsChange(items.map(it => it.id === id ? { ...it, [field]: val } : it));

    const addRow = () =>
        onItemsChange([...items, {
            id: `new_${Date.now()}`, srNo: '', description: 'New Item', unit: 'Sqft',
            quantity: 0, materialRate: 0, labourRate: 0, totalRateOverride: null,
            remarks: '', consumed: 0,
        }]);

    const deleteRow = (id) => onItemsChange(items.filter(it => it.id !== id));

    const moveRow = (idx, dir) => {
        const arr = [...items]; const t = idx + dir;
        if (t < 0 || t >= arr.length) return;
        [arr[idx], arr[t]] = [arr[t], arr[idx]];
        onItemsChange(arr);
    };

    // ── Phase-level KPIs ────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        let budgeted = 0, consumed = 0;
        items.forEach(it => {
            const c = computeItem(it, slabArea, gstRate);
            budgeted += c.basicLacs;
            consumed += Number(it.consumed ?? 0);
        });
        const remaining = budgeted - consumed;
        const pct = budgeted > 0 ? (consumed / budgeted) * 100 : 0;
        return { budgeted, consumed, remaining, pct };
    }, [items, slabArea, gstRate]);

    // ── CSV Export ───────────────────────────────────────────────────────────
    const exportCSV = () => {
        const header = 'Sr No,Description,Unit,Qty,Mat Rate,Lab Rate,Total Rate,Budget (Lacs),Rate/Sqft,incl.GST (Lacs),Consumed (Lacs),Remaining (Lacs),Utilisation %,Remarks';
        const rows = items.map(it => {
            const c = computeItem(it, slabArea, gstRate);
            const con = Number(it.consumed ?? 0);
            const rem = c.basicLacs - con;
            const pct = c.basicLacs > 0 ? ((con / c.basicLacs) * 100).toFixed(1) : '0.0';
            return [it.srNo, `"${it.description}"`, it.unit, it.quantity,
            it.materialRate, it.labourRate, c.resolved,
            c.basicLacs.toFixed(2), c.ratePSft.toFixed(2), c.gstLacs.toFixed(2),
            con.toFixed(2), rem.toFixed(2), pct, `"${it.remarks}"`].join(',');
        });
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${section.name.replace(/ /g, '_')}_Budget_vs_Consumed.csv`; a.click();
    };

    const uc = utilColor(kpis.pct);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0d1117]">

            {/* ── Header ── */}
            <div className="px-6 py-3 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 shrink-0">
                {/* Row 1: title + action buttons */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 shadow-sm">
                            {ICON_MAP[section.iconKey] ?? <Package size={18} />}
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{section.srNo}. {section.name}</h2>
                            <p className="text-xs text-gray-400">{items.length} line items · Budget consumption tracker</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {canWrite && (
                            <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                <Plus size={13} /> Add Row
                            </button>
                        )}
                        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg transition-colors">
                            <Download size={13} /> Export
                        </button>
                    </div>
                </div>

                {/* Row 2: KPI chips + overall progress bar */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phase Budget:</span>
                        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold">
                            ₹{fmt(kpis.budgeted)} Lacs
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Consumed:</span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${uc.bg} ${uc.text}`}>
                            ₹{fmt(kpis.consumed)} Lacs
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remaining:</span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${kpis.remaining < 0
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                            : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300'
                            }`}>
                            {kpis.remaining < 0 ? '▲ Over by ' : ''}₹{fmt(Math.abs(kpis.remaining))} Lacs
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex-1 min-w-[160px] flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${uc.bar} rounded-full transition-all duration-700`}
                                style={{ width: `${Math.min(kpis.pct, 100)}%` }}
                            />
                        </div>
                        <span className={`text-xs font-black ${uc.text} w-10 text-right`}>{kpis.pct.toFixed(1)}%</span>
                        {kpis.pct >= 80 && (
                            <AlertCircle size={14} className={uc.text} title={kpis.pct >= 100 ? 'Budget exceeded!' : 'Nearing budget limit'} />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-xs min-w-[1200px]">
                    <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-[#161b22]">
                        <tr>
                            <th className="px-2 py-2.5 w-8"></th>
                            <th className="px-2 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wide w-12">Sr</th>
                            <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wide min-w-[200px]">Description</th>
                            <th className="px-2 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wide w-16">Unit</th>
                            <th className="px-2 py-2.5 text-right font-bold text-gray-500 uppercase tracking-wide w-20">Qty</th>
                            <th className="px-2 py-2.5 text-right font-bold text-gray-500 uppercase tracking-wide w-24">Mat. Rate</th>
                            <th className="px-2 py-2.5 text-right font-bold text-gray-500 uppercase tracking-wide w-24">Lab. Rate</th>
                            <th className="px-2 py-2.5 text-right font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wide w-24">Total Rate</th>
                            {/* Budget columns */}
                            <th className="px-2 py-2.5 text-right font-bold text-indigo-500 uppercase tracking-wide w-28">Budget (Lacs)</th>
                            <th className="px-2 py-2.5 text-right font-bold text-violet-500 uppercase tracking-wide w-24">Rate/Sqft</th>
                            <th className="px-2 py-2.5 text-right font-bold text-teal-500 uppercase tracking-wide w-28">incl. GST (Lacs)</th>
                            {/* Consumption columns */}
                            <th className="px-2 py-2.5 text-right font-bold text-orange-500 uppercase tracking-wide w-28">Consumed (Lacs)</th>
                            <th className="px-2 py-2.5 text-right font-bold text-gray-500 uppercase tracking-wide w-24">Remaining</th>
                            <th className="px-2 py-2.5 text-center font-bold text-gray-500 uppercase tracking-wide w-28">Utilisation</th>
                            <th className="px-2 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wide">Remarks</th>
                            <th className="px-2 py-2.5 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {items.map((it, idx) => {
                            const c = computeItem(it, slabArea, gstRate);
                            const con = Number(it.consumed ?? 0);
                            const rem = c.basicLacs - con;
                            const pct = c.basicLacs > 0 ? (con / c.basicLacs) * 100 : 0;
                            const uc = utilColor(pct);
                            const isCombined = it.totalRateOverride != null;
                            return (
                                <tr key={it.id} className="bg-white dark:bg-[#0d1117] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                    {/* Reorder */}
                                    <td className="px-1 py-1">
                                        {canWrite && (
                                            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => moveRow(idx, -1)} disabled={idx === 0} className="p-0.5 hover:text-blue-500 disabled:opacity-20 text-gray-400"><ChevronUp size={10} /></button>
                                                <button onClick={() => moveRow(idx, 1)} disabled={idx === items.length - 1} className="p-0.5 hover:text-blue-500 disabled:opacity-20 text-gray-400"><ChevronDown size={10} /></button>
                                            </div>
                                        )}
                                    </td>
                                    {/* Sr */}
                                    <td className="px-2 py-1 text-gray-500"><EditCell value={it.srNo} onChange={v => updateItem(it.id, 'srNo', v)} readOnly={!canWrite} /></td>
                                    {/* Description */}
                                    <td className="px-3 py-1 font-medium text-gray-800 dark:text-gray-200">
                                        <EditCell value={it.description} onChange={v => updateItem(it.id, 'description', v)} readOnly={!canWrite} />
                                    </td>
                                    {/* Unit */}
                                    <td className="px-2 py-1"><EditCell value={it.unit} onChange={v => updateItem(it.id, 'unit', v)} readOnly={!canWrite} /></td>
                                    {/* Qty */}
                                    <td className="px-2 py-1"><EditCell value={it.quantity} onChange={v => updateItem(it.id, 'quantity', v)} type="number" align="right" readOnly={!canWrite} /></td>
                                    {/* Mat Rate */}
                                    <td className={`px-2 py-1 ${isCombined ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <EditCell value={it.materialRate} onChange={v => updateItem(it.id, 'materialRate', v)} type="number" align="right" readOnly={!canWrite} />
                                    </td>
                                    {/* Lab Rate */}
                                    <td className={`px-2 py-1 ${isCombined ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <EditCell value={it.labourRate} onChange={v => updateItem(it.id, 'labourRate', v)} type="number" align="right" readOnly={!canWrite} />
                                    </td>
                                    {/* Total Rate */}
                                    <td className="px-2 py-1 bg-blue-50/50 dark:bg-blue-900/10">
                                        {isCombined
                                            ? <EditCell value={it.totalRateOverride} onChange={v => updateItem(it.id, 'totalRateOverride', v)} type="number" align="right" readOnly={!canWrite} />
                                            : <span className="block text-right text-blue-600 dark:text-blue-400 font-semibold pr-1">{fmt(c.resolved, 2)}</span>
                                        }
                                    </td>
                                    {/* Budget (Basic Lacs) — computed, read-only */}
                                    <td className="px-2 py-1 text-right text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/30 dark:bg-indigo-900/10">
                                        {fmt(c.basicLacs)}
                                    </td>
                                    {/* Rate/Sqft — computed */}
                                    <td className="px-2 py-1 text-right text-violet-600 dark:text-violet-400 font-semibold bg-violet-50/30 dark:bg-violet-900/10">
                                        {fmt(c.ratePSft, 2)}
                                    </td>
                                    {/* incl. GST — computed */}
                                    <td className="px-2 py-1 text-right text-teal-600 dark:text-teal-400 font-semibold bg-teal-50/30 dark:bg-teal-900/10">
                                        {fmt(c.gstLacs)}
                                    </td>
                                    {/* CONSUMED — editable by user */}
                                    <td className="px-2 py-1 bg-orange-50/60 dark:bg-orange-900/10">
                                        <EditCell
                                            value={it.consumed ?? 0}
                                            onChange={v => updateItem(it.id, 'consumed', v)}
                                            type="number"
                                            align="right"
                                            placeholder="0.00"
                                            readOnly={!canWrite}
                                        />
                                    </td>
                                    {/* Remaining */}
                                    <td className={`px-2 py-1 text-right font-semibold ${rem < 0 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                        {rem < 0 ? '▲ ' : ''}{fmt(Math.abs(rem))}
                                    </td>
                                    {/* Utilisation bar */}
                                    <td className="px-2 py-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${uc.bar} rounded-full transition-all duration-500`}
                                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                                />
                                            </div>
                                            <span className={`text-[10px] font-bold w-9 text-right ${uc.text}`}>{pct.toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    {/* Remarks */}
                                    <td className="px-2 py-1 text-gray-400">
                                        <EditCell value={it.remarks} onChange={v => updateItem(it.id, 'remarks', v)} readOnly={!canWrite} />
                                    </td>
                                    {/* Delete */}
                                    <td className="px-2 py-1">
                                        {canWrite && (
                                            <button onClick={() => deleteRow(it.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all">
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={16} className="py-16 text-center text-gray-400 text-sm">
                                    No items yet ·{' '}
                                    {canWrite && (
                                        <button onClick={addRow} className="text-blue-500 hover:underline font-semibold">Add first row</button>
                                    )}
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {/* Sticky footer totals */}
                    <tfoot className="sticky bottom-0 bg-gray-100 dark:bg-[#161b22] border-t-2 border-gray-300 dark:border-white/10">
                        <tr>
                            <td colSpan={8} className="px-3 py-3 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide text-xs">
                                Total — {section.name}
                            </td>
                            {/* Budget total */}
                            <td className="px-2 py-3 text-right text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                                {fmt(kpis.budgeted)}
                            </td>
                            <td className="px-2 py-3 text-right text-violet-700 dark:text-violet-300 font-bold text-sm">
                                {fmt(slabArea > 0 ? (kpis.budgeted * 100_000) / slabArea : 0, 2)}
                            </td>
                            <td className="px-2 py-3 text-right text-teal-700 dark:text-teal-300 font-bold text-sm">
                                {fmt(items.reduce((s, it) => s + computeItem(it, slabArea, gstRate).gstLacs, 0))}
                            </td>
                            {/* Consumed total */}
                            <td className={`px-2 py-3 text-right font-bold text-sm ${uc.text}`}>
                                {fmt(kpis.consumed)}
                            </td>
                            {/* Remaining total */}
                            <td className={`px-2 py-3 text-right font-bold text-sm ${kpis.remaining < 0 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                {fmt(kpis.remaining)}
                            </td>
                            {/* Overall utilisation */}
                            <td className="px-2 py-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div className={`h-full ${uc.bar} rounded-full transition-all`} style={{ width: `${Math.min(kpis.pct, 100)}%` }} />
                                    </div>
                                    <span className={`text-xs font-black w-10 text-right ${uc.text}`}>{kpis.pct.toFixed(1)}%</span>
                                </div>
                            </td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-6 py-2 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#0d1117] text-[10px] text-gray-400 shrink-0 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-100 dark:bg-indigo-900/40"></span> Budget (computed)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-100 dark:bg-orange-900/40"></span> Consumed (enter actual spend)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-400"></span> &lt; 80%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400"></span> 80–99%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-400"></span> ≥ 100% (over budget)</span>
                <span className="ml-auto">Orange column = editable actual spend · All other computed columns are read-only</span>
            </div>
        </div>
    );
};

export default SectionView;
