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

    // Excel Selection & Grid State
    const [selectionAnchor, setSelectionAnchor] = useState(null);
    const [selectionFocus, setSelectionFocus] = useState(null);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [customColWidths, setCustomColWidths] = useState({});
    const undoStackRef = React.useRef([]);

    const SECTION_COLS = [
        'srNo', 'description', 'unit', 'quantity', 'materialRate', 'labourRate',
        'totalRateOverride', 'basicLacs', 'ratePSft', 'gstLacs', 'consumed',
        'remaining', 'utilisation', 'remarks'
    ];

    const COLUMN_LABELS = {
        srNo: 'Sr',
        description: 'Description',
        unit: 'Unit',
        quantity: 'Qty',
        materialRate: 'Mat. Rate',
        labourRate: 'Lab. Rate',
        totalRateOverride: 'Total Rate',
        basicLacs: 'Budget (Lacs)',
        ratePSft: 'Rate/Sqft',
        gstLacs: 'incl. GST (Lacs)',
        consumed: 'Consumed (Lacs)',
        remaining: 'Remaining',
        utilisation: 'Utilisation',
        remarks: 'Remarks'
    };

    const getBoundsFromRefs = React.useCallback(() => {
        if (!selectionAnchor || !selectionFocus) return null;
        return {
            minRow: Math.min(selectionAnchor.r, selectionFocus.r),
            maxRow: Math.max(selectionAnchor.r, selectionFocus.r),
            minCol: Math.min(selectionAnchor.c, selectionFocus.c),
            maxCol: Math.max(selectionAnchor.c, selectionFocus.c)
        };
    }, [selectionAnchor, selectionFocus]);

    const handleColumnHeaderDoubleClick = React.useCallback((colKey) => {
        let maxLen = (COLUMN_LABELS[colKey] || colKey).length;
        items.forEach(it => {
            const val = String(it[colKey] ?? '');
            if (val.length > maxLen) maxLen = val.length;
        });
        const computedWidth = Math.max(80, Math.min(450, maxLen * 8.5 + 32));
        setCustomColWidths(prev => {
            if (prev[colKey]) {
                const next = { ...prev };
                delete next[colKey];
                return next;
            }
            return { ...prev, [colKey]: `${computedWidth}px` };
        });
    }, [items]);

    const updateItem = (id, field, val) =>
        onItemsChange(items.map(it => it.id === id ? { ...it, [field]: val } : it));

    const addRow = () =>
        onItemsChange([...items, {
            id: `new_${Date.now()}`, srNo: `${items.length + 1}`, description: 'New Item', unit: 'Sqft',
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

    // Excel TSV Copy
    const handleExcelCopy = React.useCallback(() => {
        const bounds = getBoundsFromRefs();
        if (!bounds) return;
        const lines = [];
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const row = items[r];
            if (!row) continue;
            const cInfo = computeItem(row, slabArea, gstRate);
            const cells = [];
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const colKey = SECTION_COLS[c];
                if (colKey === 'basicLacs') cells.push(cInfo.basicLacs.toFixed(2));
                else if (colKey === 'ratePSft') cells.push(cInfo.ratePSft.toFixed(2));
                else if (colKey === 'gstLacs') cells.push(cInfo.gstLacs.toFixed(2));
                else if (colKey === 'totalRateOverride') cells.push(cInfo.resolved);
                else cells.push(String(row[colKey] ?? ''));
            }
            lines.push(cells.join('\t'));
        }
        navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    }, [getBoundsFromRefs, items, slabArea, gstRate]);

    // Excel Fill Down
    const handleFillDown = React.useCallback(() => {
        if (!canWrite) return;
        const bounds = getBoundsFromRefs();
        if (!bounds || bounds.minRow === bounds.maxRow) return;
        const sourceRow = items[bounds.minRow];
        if (!sourceRow) return;
        const updated = [...items];
        for (let r = bounds.minRow + 1; r <= bounds.maxRow; r++) {
            const targetRow = { ...updated[r] };
            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const colKey = SECTION_COLS[c];
                if (['unit', 'quantity', 'materialRate', 'labourRate', 'consumed', 'remarks'].includes(colKey)) {
                    targetRow[colKey] = sourceRow[colKey];
                }
            }
            updated[r] = targetRow;
        }
        onItemsChange(updated);
    }, [canWrite, getBoundsFromRefs, items, onItemsChange]);

    // Excel Fill Right
    const handleFillRight = React.useCallback(() => {
        if (!canWrite) return;
        const bounds = getBoundsFromRefs();
        if (!bounds || bounds.minCol === bounds.maxCol) return;
        const updated = [...items];
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
            const targetRow = { ...updated[r] };
            const sourceCol = SECTION_COLS[bounds.minCol];
            const sourceVal = targetRow[sourceCol];
            for (let c = bounds.minCol + 1; c <= bounds.maxCol; c++) {
                const colKey = SECTION_COLS[c];
                if (['materialRate', 'labourRate', 'consumed'].includes(colKey)) {
                    targetRow[colKey] = sourceVal;
                }
            }
            updated[r] = targetRow;
        }
        onItemsChange(updated);
    }, [canWrite, getBoundsFromRefs, items, onItemsChange]);

    // Global Keydown Handler
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            const activeEl = document.activeElement;
            const isTyping = activeEl?.tagName?.toLowerCase() === 'input' || activeEl?.tagName?.toLowerCase() === 'textarea';

            if (e.key === 'Escape') {
                setSelectionAnchor(null);
                setSelectionFocus(null);
                return;
            }

            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const mod = isMac ? e.metaKey : e.ctrlKey;

            // Ctrl+S
            if (mod && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                return;
            }

            // Insert / Ctrl++
            if (e.key === 'Insert' || (mod && (e.key === '+' || e.key === '='))) {
                e.preventDefault();
                if (canWrite) addRow();
                return;
            }

            // Ctrl+-
            if (mod && (e.key === '-' || e.key === '_')) {
                e.preventDefault();
                if (selectionAnchor && canWrite && items[selectionAnchor.r]) {
                    deleteRow(items[selectionAnchor.r].id);
                }
                return;
            }

            // Ctrl+A
            if (mod && (e.key === 'a' || e.key === 'A') && !isTyping) {
                e.preventDefault();
                setSelectionAnchor({ r: 0, c: 0 });
                setSelectionFocus({ r: items.length - 1, c: SECTION_COLS.length - 1 });
                return;
            }

            if (mod && (e.key === 'c' || e.key === 'C') && !isTyping) { e.preventDefault(); handleExcelCopy(); return; }
            if (mod && (e.key === 'd' || e.key === 'D') && !isTyping) { e.preventDefault(); handleFillDown(); return; }
            if (mod && (e.key === 'r' || e.key === 'R') && !isTyping) { e.preventDefault(); handleFillRight(); return; }

            if (isTyping) return;

            if (selectionAnchor) {
                const totalRows = items.length;
                const totalCols = SECTION_COLS.length;
                let { r, c } = selectionFocus || selectionAnchor;

                if (e.key === 'ArrowDown')  { e.preventDefault(); r = mod ? totalRows - 1 : Math.min(r + 1, totalRows - 1); }
                if (e.key === 'ArrowUp')    { e.preventDefault(); r = mod ? 0 : Math.max(r - 1, 0); }
                if (e.key === 'ArrowRight') { e.preventDefault(); c = mod ? totalCols - 1 : Math.min(c + 1, totalCols - 1); }
                if (e.key === 'ArrowLeft')  { e.preventDefault(); c = mod ? 0 : Math.max(c - 1, 0); }
                if (e.key === 'Tab')        { e.preventDefault(); c = e.shiftKey ? Math.max(c - 1, 0) : Math.min(c + 1, totalCols - 1); }
                if (e.key === 'Enter')      { e.preventDefault(); r = e.shiftKey ? Math.max(r - 1, 0) : Math.min(r + 1, totalRows - 1); }
                if (e.key === 'Home')       { e.preventDefault(); c = 0; if (mod) r = 0; }
                if (e.key === 'End')        { e.preventDefault(); c = totalCols - 1; if (mod) r = totalRows - 1; }
                if (e.key === 'PageUp')     { e.preventDefault(); r = Math.max(0, r - 10); }
                if (e.key === 'PageDown')   { e.preventDefault(); r = Math.min(totalRows - 1, r + 10); }

                // Space
                if (e.key === ' ' || e.key === 'Spacebar') {
                    if (e.shiftKey && !mod) {
                        e.preventDefault();
                        setSelectionAnchor({ r, c: 0 });
                        setSelectionFocus({ r, c: totalCols - 1 });
                        return;
                    }
                    if (mod && !e.shiftKey) {
                        e.preventDefault();
                        setSelectionAnchor({ r: 0, c });
                        setSelectionFocus({ r: totalRows - 1, c });
                        return;
                    }
                }

                if (['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Tab','Enter','Home','End','PageUp','PageDown'].includes(e.key)) {
                    if (e.shiftKey && e.key !== 'Tab' && e.key !== 'Enter') {
                        setSelectionFocus({ r, c });
                    } else {
                        setSelectionAnchor({ r, c });
                        setSelectionFocus({ r, c });
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectionAnchor, selectionFocus, items, canWrite, handleExcelCopy, handleFillDown, handleFillRight]);

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
                    <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-[#161b22] select-none">
                        <tr>
                            <th className="px-2 py-2.5 w-8"></th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('srNo')}
                                style={customColWidths['srNo'] ? { width: customColWidths['srNo'], minWidth: customColWidths['srNo'] } : {}}
                                title="Sr No - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wide w-12 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Sr</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('description')}
                                style={customColWidths['description'] ? { width: customColWidths['description'], minWidth: customColWidths['description'] } : {}}
                                title="Description - Double-click to Auto-Fit"
                                className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wide min-w-[200px] cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Description</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('unit')}
                                style={customColWidths['unit'] ? { width: customColWidths['unit'], minWidth: customColWidths['unit'] } : {}}
                                title="Unit - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wide w-16 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Unit</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('quantity')}
                                style={customColWidths['quantity'] ? { width: customColWidths['quantity'], minWidth: customColWidths['quantity'] } : {}}
                                title="Qty - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-right font-bold text-gray-500 uppercase tracking-wide w-20 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Qty</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('materialRate')}
                                style={customColWidths['materialRate'] ? { width: customColWidths['materialRate'], minWidth: customColWidths['materialRate'] } : {}}
                                title="Mat. Rate - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-right font-bold text-gray-500 uppercase tracking-wide w-24 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Mat. Rate</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('labourRate')}
                                style={customColWidths['labourRate'] ? { width: customColWidths['labourRate'], minWidth: customColWidths['labourRate'] } : {}}
                                title="Lab. Rate - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-right font-bold text-gray-500 uppercase tracking-wide w-24 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Lab. Rate</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('totalRateOverride')}
                                style={customColWidths['totalRateOverride'] ? { width: customColWidths['totalRateOverride'], minWidth: customColWidths['totalRateOverride'] } : {}}
                                title="Total Rate - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-right font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wide w-24 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Total Rate</th>
                            {/* Budget columns */}
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('basicLacs')}
                                style={customColWidths['basicLacs'] ? { width: customColWidths['basicLacs'], minWidth: customColWidths['basicLacs'] } : {}}
                                title="Budget - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-right font-bold text-indigo-500 uppercase tracking-wide w-28 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Budget (Lacs)</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('ratePSft')}
                                style={customColWidths['ratePSft'] ? { width: customColWidths['ratePSft'], minWidth: customColWidths['ratePSft'] } : {}}
                                title="Rate/Sqft - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-right font-bold text-violet-500 uppercase tracking-wide w-24 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Rate/Sqft</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('gstLacs')}
                                style={customColWidths['gstLacs'] ? { width: customColWidths['gstLacs'], minWidth: customColWidths['gstLacs'] } : {}}
                                title="incl. GST - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-right font-bold text-teal-500 uppercase tracking-wide w-28 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >incl. GST (Lacs)</th>
                            {/* Consumption columns */}
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('consumed')}
                                style={customColWidths['consumed'] ? { width: customColWidths['consumed'], minWidth: customColWidths['consumed'] } : {}}
                                title="Consumed - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-right font-bold text-orange-500 uppercase tracking-wide w-28 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Consumed (Lacs)</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('remaining')}
                                style={customColWidths['remaining'] ? { width: customColWidths['remaining'], minWidth: customColWidths['remaining'] } : {}}
                                title="Remaining - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-right font-bold text-gray-500 uppercase tracking-wide w-24 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Remaining</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('utilisation')}
                                style={customColWidths['utilisation'] ? { width: customColWidths['utilisation'], minWidth: customColWidths['utilisation'] } : {}}
                                title="Utilisation - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-center font-bold text-gray-500 uppercase tracking-wide w-28 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Utilisation</th>
                            <th
                                onDoubleClick={() => handleColumnHeaderDoubleClick('remarks')}
                                style={customColWidths['remarks'] ? { width: customColWidths['remarks'], minWidth: customColWidths['remarks'] } : {}}
                                title="Remarks - Double-click to Auto-Fit"
                                className="px-2 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition"
                            >Remarks</th>
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
                                    <td data-cell-pos={`${idx}-0`} className="px-2 py-1 text-gray-500"><EditCell value={it.srNo} onChange={v => updateItem(it.id, 'srNo', v)} readOnly={!canWrite} /></td>
                                    {/* Description */}
                                    <td data-cell-pos={`${idx}-1`} className="px-3 py-1 font-medium text-gray-800 dark:text-gray-200 whitespace-pre-line">
                                        <EditCell value={it.description} onChange={v => updateItem(it.id, 'description', v)} readOnly={!canWrite} />
                                    </td>
                                    {/* Unit */}
                                    <td data-cell-pos={`${idx}-2`} className="px-2 py-1"><EditCell value={it.unit} onChange={v => updateItem(it.id, 'unit', v)} readOnly={!canWrite} /></td>
                                    {/* Qty */}
                                    <td data-cell-pos={`${idx}-3`} className="px-2 py-1"><EditCell value={it.quantity} onChange={v => updateItem(it.id, 'quantity', v)} type="number" align="right" readOnly={!canWrite} /></td>
                                    {/* Mat Rate */}
                                    <td data-cell-pos={`${idx}-4`} className={`px-2 py-1 ${isCombined ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <EditCell value={it.materialRate} onChange={v => updateItem(it.id, 'materialRate', v)} type="number" align="right" readOnly={!canWrite} />
                                    </td>
                                    {/* Lab Rate */}
                                    <td data-cell-pos={`${idx}-5`} className={`px-2 py-1 ${isCombined ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <EditCell value={it.labourRate} onChange={v => updateItem(it.id, 'labourRate', v)} type="number" align="right" readOnly={!canWrite} />
                                    </td>
                                    {/* Total Rate */}
                                    <td data-cell-pos={`${idx}-6`} className="px-2 py-1 bg-blue-50/50 dark:bg-blue-900/10">
                                        {isCombined
                                            ? <EditCell value={it.totalRateOverride} onChange={v => updateItem(it.id, 'totalRateOverride', v)} type="number" align="right" readOnly={!canWrite} />
                                            : <span className="block text-right text-blue-600 dark:text-blue-400 font-semibold pr-1">{fmt(c.resolved, 2)}</span>
                                        }
                                    </td>
                                    {/* Budget (Basic Lacs) — computed, read-only */}
                                    <td data-cell-pos={`${idx}-7`} className="px-2 py-1 text-right text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/30 dark:bg-indigo-900/10">
                                        {fmt(c.basicLacs)}
                                    </td>
                                    {/* Rate/Sqft — computed */}
                                    <td data-cell-pos={`${idx}-8`} className="px-2 py-1 text-right text-violet-600 dark:text-violet-400 font-semibold bg-violet-50/30 dark:bg-violet-900/10">
                                        {fmt(c.ratePSft, 2)}
                                    </td>
                                    {/* incl. GST — computed */}
                                    <td data-cell-pos={`${idx}-9`} className="px-2 py-1 text-right text-teal-600 dark:text-teal-400 font-semibold bg-teal-50/30 dark:bg-teal-900/10">
                                        {fmt(c.gstLacs)}
                                    </td>
                                    {/* CONSUMED — editable by user */}
                                    <td data-cell-pos={`${idx}-10`} className="px-2 py-1 bg-orange-50/60 dark:bg-orange-900/10">
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
                                    <td data-cell-pos={`${idx}-11`} className={`px-2 py-1 text-right font-semibold ${rem < 0 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                        {rem < 0 ? '▲ ' : ''}{fmt(Math.abs(rem))}
                                    </td>
                                    {/* Utilisation bar */}
                                    <td data-cell-pos={`${idx}-12`} className="px-2 py-1">
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
                                    <td data-cell-pos={`${idx}-13`} className="px-2 py-1 text-gray-400 whitespace-pre-line">
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
