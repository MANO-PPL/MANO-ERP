import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft, Download, Filter, Package, Layers, BarChart3,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
    ChevronDown, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Demo Data ─────────────────────────────────────────────────────────────────
const MATERIALS = [
    { id: 'cement', name: 'Cement (OPC 53)', unit: 'MT', color: '#3b82f6', icon: '🏗️' },
    { id: 'steel', name: 'Steel / Rebar', unit: 'MT', color: '#ef4444', icon: '🔩' },
    { id: 'rmc', name: 'Ready-Mix Concrete', unit: 'Cu.m', color: '#06b6d4', icon: '🧱' },
    { id: 'sand', name: 'River Sand', unit: 'Cu.m', color: '#f59e0b', icon: '🏖️' },
    { id: 'aggregate', name: 'Coarse Aggregate', unit: 'Cu.m', color: '#8b5cf6', icon: '🪨' },
    { id: 'bricks', name: 'AAC Blocks / Bricks', unit: 'Nos', color: '#14b8a6', icon: '🧱' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const generateData = () => {
    const data = {};
    MATERIALS.forEach(mat => {
        data[mat.id] = MONTHS.map((m, i) => {
            const base = mat.id === 'cement' ? 120 : mat.id === 'steel' ? 85 : mat.id === 'rmc' ? 200 : mat.id === 'sand' ? 150 : mat.id === 'aggregate' ? 180 : 5000;
            const wave = Math.sin((i / 11) * Math.PI) * 0.4 + 0.6;
            const planned = Math.round(base * wave + (Math.random() * base * 0.15));
            const variance = (Math.random() - 0.4) * 0.25;
            const actual = i <= 7 ? Math.round(planned * (1 + variance)) : 0;
            return { month: m, planned, actual };
        });
    });
    return data;
};

const DEMO_DATA = generateData();

const RATES = { cement: 380, steel: 58000, rmc: 5200, sand: 1800, aggregate: 1400, bricks: 55 };

// ─── Utility ───────────────────────────────────────────────────────────────────
const fmt = (n) => n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-IN');
const fmtCurrency = (n) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${fmt(n)}`;
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KPICard = ({ label, value, sub, icon: Icon, color, trend }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white dark:bg-[#161b22] rounded-2xl border border-${color}-100 dark:border-${color}-500/20 p-5 relative overflow-hidden group hover:shadow-lg hover:shadow-${color}-500/5 transition-all duration-500`}
    >
        <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/5 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-700`} />
        <div className="relative">
            <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl bg-${color}-50 dark:bg-${color}-500/10 flex items-center justify-center`}>
                    <Icon size={18} className={`text-${color}-500`} />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-green-50 dark:bg-green-900/20 text-green-500'}`}>
                        {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        <span>{Math.abs(trend).toFixed(1)}%</span>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black text-gray-900 dark:text-white tracking-tight`}>{value}</p>
            {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
        </div>
    </motion.div>
);

// ─── SVG Histogram ─────────────────────────────────────────────────────────────
const Histogram = ({ data, activeMaterials, hoveredMonth, setHoveredMonth }) => {
    const svgRef = useRef(null);
    const W = 900, H = 340, PAD_L = 60, PAD_R = 20, PAD_T = 20, PAD_B = 50;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    // Aggregate planned & actual per month
    const monthlyData = MONTHS.map((m, i) => {
        let totalPlanned = 0, totalActual = 0;
        activeMaterials.forEach(matId => {
            const d = data[matId]?.[i];
            if (d) {
                totalPlanned += d.planned * (RATES[matId] || 1);
                totalActual += d.actual * (RATES[matId] || 1);
            }
        });
        return { month: m, planned: totalPlanned, actual: totalActual };
    });

    const maxVal = Math.max(...monthlyData.map(d => Math.max(d.planned, d.actual)), 1);
    const yScale = chartH / maxVal;
    const barGroupW = chartW / 12;
    const barW = barGroupW * 0.3;
    const gap = barGroupW * 0.08;

    // Y-axis ticks
    const yTicks = 5;
    const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal / yTicks) * i);

    // Cumulative S-curve
    let cumPlanned = 0, cumActual = 0;
    const cumData = monthlyData.map(d => {
        cumPlanned += d.planned;
        cumActual += d.actual;
        return { cumPlanned, cumActual };
    });
    const maxCum = Math.max(cumPlanned, cumActual, 1);
    const cumScale = chartH / maxCum;

    const cumPlannedPath = cumData.map((d, i) => {
        const x = PAD_L + i * barGroupW + barGroupW / 2;
        const y = PAD_T + chartH - d.cumPlanned * cumScale;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    const cumActualPath = cumData.map((d, i) => {
        const x = PAD_L + i * barGroupW + barGroupW / 2;
        const y = PAD_T + chartH - d.cumActual * cumScale;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    return (
        <div className="relative">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto"
                style={{ minHeight: 280 }}
            >
                {/* Grid lines */}
                {yTickVals.map((val, i) => {
                    const y = PAD_T + chartH - val * yScale;
                    return (
                        <g key={i}>
                            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="currentColor" strokeOpacity={0.06} strokeDasharray="4 4" />
                            <text x={PAD_L - 8} y={y + 4} textAnchor="end" className="fill-gray-400 dark:fill-gray-600" fontSize="9" fontFamily="monospace">
                                {fmtCurrency(val)}
                            </text>
                        </g>
                    );
                })}

                {/* Bars */}
                {monthlyData.map((d, i) => {
                    const x = PAD_L + i * barGroupW + (barGroupW - barW * 2 - gap) / 2;
                    const pH = d.planned * yScale;
                    const aH = d.actual * yScale;
                    const isHovered = hoveredMonth === i;

                    return (
                        <g
                            key={d.month}
                            onMouseEnter={() => setHoveredMonth(i)}
                            onMouseLeave={() => setHoveredMonth(null)}
                            className="cursor-pointer"
                        >
                            {/* Hover bg */}
                            {isHovered && (
                                <rect
                                    x={PAD_L + i * barGroupW}
                                    y={PAD_T}
                                    width={barGroupW}
                                    height={chartH}
                                    fill="currentColor"
                                    fillOpacity={0.03}
                                    rx={4}
                                />
                            )}
                            {/* Planned bar */}
                            <rect
                                x={x}
                                y={PAD_T + chartH - pH}
                                width={barW}
                                height={pH}
                                fill="#3b82f6"
                                fillOpacity={isHovered ? 1 : 0.75}
                                rx={3}
                                className="transition-all duration-200"
                            />
                            {/* Actual bar */}
                            <rect
                                x={x + barW + gap}
                                y={PAD_T + chartH - aH}
                                width={barW}
                                height={aH}
                                fill="#22c55e"
                                fillOpacity={isHovered ? 1 : 0.75}
                                rx={3}
                                className="transition-all duration-200"
                            />
                            {/* Month label */}
                            <text
                                x={PAD_L + i * barGroupW + barGroupW / 2}
                                y={H - PAD_B + 18}
                                textAnchor="middle"
                                className={`${isHovered ? 'fill-blue-500 font-bold' : 'fill-gray-500 dark:fill-gray-400'}`}
                                fontSize="10"
                                fontWeight={isHovered ? 700 : 500}
                            >
                                {d.month}
                            </text>
                        </g>
                    );
                })}

                {/* S-Curve lines */}
                <path d={cumPlannedPath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" opacity={0.5} />
                <path d={cumActualPath} fill="none" stroke="#22c55e" strokeWidth={2} opacity={0.6} />

                {/* S-Curve dots */}
                {cumData.map((d, i) => {
                    const x = PAD_L + i * barGroupW + barGroupW / 2;
                    return (
                        <g key={`dots-${i}`}>
                            <circle cx={x} cy={PAD_T + chartH - d.cumPlanned * cumScale} r={2.5} fill="#3b82f6" opacity={0.6} />
                            {d.cumActual > 0 && <circle cx={x} cy={PAD_T + chartH - d.cumActual * cumScale} r={2.5} fill="#22c55e" opacity={0.7} />}
                        </g>
                    );
                })}

                {/* Axis lines */}
                <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + chartH} stroke="currentColor" strokeOpacity={0.1} />
                <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="currentColor" strokeOpacity={0.1} />
            </svg>

            {/* Tooltip */}
            <AnimatePresence>
                {hoveredMonth !== null && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-2 right-4 bg-white dark:bg-[#1c2333] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-4 z-10 min-w-[200px]"
                    >
                        <p className="text-xs font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wider">
                            {MONTHS[hoveredMonth]} 2026
                        </p>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center space-x-2">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                                    <span className="text-gray-500 dark:text-gray-400">Planned</span>
                                </div>
                                <span className="font-bold text-gray-800 dark:text-gray-200">{fmtCurrency(monthlyData[hoveredMonth].planned)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center space-x-2">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-green-500" />
                                    <span className="text-gray-500 dark:text-gray-400">Actual</span>
                                </div>
                                <span className="font-bold text-gray-800 dark:text-gray-200">{fmtCurrency(monthlyData[hoveredMonth].actual)}</span>
                            </div>
                            {monthlyData[hoveredMonth].actual > 0 && (
                                <div className="pt-1.5 border-t border-gray-100 dark:border-white/5 mt-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-400">Variance</span>
                                        <span className={`font-bold ${monthlyData[hoveredMonth].actual > monthlyData[hoveredMonth].planned ? 'text-red-500' : 'text-green-500'}`}>
                                            {((monthlyData[hoveredMonth].actual - monthlyData[hoveredMonth].planned) / monthlyData[hoveredMonth].planned * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Donut Chart ───────────────────────────────────────────────────────────────
const DonutChart = ({ data, activeMaterials }) => {
    const vals = MATERIALS.filter(m => activeMaterials.includes(m.id)).map(mat => {
        const total = data[mat.id]?.reduce((s, d) => s + d.actual * (RATES[mat.id] || 1), 0) || 0;
        return { ...mat, value: total };
    }).filter(d => d.value > 0);

    const total = vals.reduce((s, d) => s + d.value, 0);
    const r = 54, cx = 70, cy = 70, strokeW = 20;
    const circ = 2 * Math.PI * r;
    let cum = 0;

    const slices = vals.map(d => {
        const pct = d.value / total;
        const dash = pct * circ;
        const offset = circ - cum * circ;
        cum += pct;
        return { ...d, dash, offset, pct };
    });

    return (
        <div className="flex items-center gap-6">
            <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity={0.06} strokeWidth={strokeW} />
                {slices.map((s, i) => (
                    <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                        stroke={s.color} strokeWidth={strokeW}
                        strokeDasharray={`${s.dash} ${circ - s.dash}`}
                        strokeDashoffset={s.offset}
                        transform={`rotate(-90 ${cx} ${cy})`}
                        style={{ transition: 'stroke-dasharray 0.6s ease' }}
                    />
                ))}
                <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400" fontSize="7" fontWeight="600">TOTAL</text>
                <text x={cx} y={cy + 10} textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="10" fontWeight="800">
                    {fmtCurrency(total)}
                </text>
            </svg>
            <div className="flex-1 space-y-2">
                {slices.map(s => (
                    <div key={s.id} className="flex items-center gap-2.5 text-xs group">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white dark:ring-[#161b22] shadow-sm" style={{ backgroundColor: s.color }} />
                        <span className="text-gray-600 dark:text-gray-400 truncate flex-1 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{s.name}</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200 tabular-nums">{(s.pct * 100).toFixed(1)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const MaterialHistogram = ({ setExtraBreadcrumbs, onBack }) => {
    const [data] = useState(DEMO_DATA);
    const [activeMaterials, setActiveMaterials] = useState(MATERIALS.map(m => m.id));
    const [hoveredMonth, setHoveredMonth] = useState(null);
    const [filterOpen, setFilterOpen] = useState(false);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Planning', onClick: onBack },
            { label: 'Material Histogram' }
        ]);
    }, [onBack, setExtraBreadcrumbs]);

    const toggleMaterial = (id) => {
        setActiveMaterials(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    // Aggregate KPIs
    let totalPlanned = 0, totalActual = 0, totalPlannedCost = 0, totalActualCost = 0;
    MATERIALS.forEach(mat => {
        data[mat.id]?.forEach(d => {
            totalPlanned += d.planned;
            totalActual += d.actual;
            totalPlannedCost += d.planned * (RATES[mat.id] || 1);
            totalActualCost += d.actual * (RATES[mat.id] || 1);
        });
    });
    const overallVariancePct = totalPlannedCost > 0 ? ((totalActualCost - totalPlannedCost) / totalPlannedCost) * 100 : 0;

    // Per-material table data
    const tableData = MATERIALS.map(mat => {
        const rows = data[mat.id] || [];
        const planned = rows.reduce((s, d) => s + d.planned, 0);
        const actual = rows.reduce((s, d) => s + d.actual, 0);
        const varianceQty = actual - planned;
        const variancePct = planned > 0 ? (varianceQty / planned) * 100 : 0;
        const costPlanned = planned * (RATES[mat.id] || 1);
        const costActual = actual * (RATES[mat.id] || 1);
        return { ...mat, planned, actual, varianceQty, variancePct, costPlanned, costActual };
    });

    const exportCSV = () => {
        const header = 'Material,Unit,Planned Qty,Actual Qty,Variance,Variance %,Planned Cost,Actual Cost';
        const rows = tableData.map(d =>
            `"${d.name}",${d.unit},${d.planned},${d.actual},${d.varianceQty},${d.variancePct.toFixed(1)}%,${d.costPlanned},${d.costActual}`
        );
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Material_Histogram_Report.csv';
        a.click();
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors">
                        <ArrowLeft size={16} />
                    </button>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                        <BarChart3 size={16} className="text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Material Histogram</h2>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">Planned vs Actual Material Consumption • FY 2026</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Filter Button */}
                    <div className="relative">
                        <button
                            onClick={() => setFilterOpen(!filterOpen)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all ${filterOpen ? 'border-blue-500 ring-2 ring-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            <Filter size={13} />
                            Materials
                            {activeMaterials.length < MATERIALS.length && (
                                <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[9px] font-bold">{activeMaterials.length}</span>
                            )}
                            <ChevronDown size={12} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                            {filterOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 p-3 space-y-1"
                                >
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-white/5">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Filter Materials</span>
                                        <button
                                            onClick={() => setActiveMaterials(activeMaterials.length === MATERIALS.length ? [] : MATERIALS.map(m => m.id))}
                                            className="text-[10px] text-blue-500 hover:text-blue-600 font-bold cursor-pointer"
                                        >
                                            {activeMaterials.length === MATERIALS.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    {MATERIALS.map(mat => (
                                        <label key={mat.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={activeMaterials.includes(mat.id)}
                                                onChange={() => toggleMaterial(mat.id)}
                                                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500 accent-blue-500"
                                            />
                                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: mat.color }} />
                                            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium flex-1">{mat.name}</span>
                                            <span className="text-[10px] text-gray-400">{mat.unit}</span>
                                        </label>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg transition-colors"
                    >
                        <Download size={13} /> Export
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                        label="Total Planned (Cost)"
                        value={fmtCurrency(totalPlannedCost)}
                        sub={`${fmt(totalPlanned)} units across ${MATERIALS.length} materials`}
                        icon={Package}
                        color="blue"
                    />
                    <KPICard
                        label="Total Actual (Cost)"
                        value={fmtCurrency(totalActualCost)}
                        sub={`${fmt(totalActual)} units consumed till Aug 2026`}
                        icon={Layers}
                        color="green"
                    />
                    <KPICard
                        label="Overall Variance"
                        value={`${overallVariancePct >= 0 ? '+' : ''}${overallVariancePct.toFixed(1)}%`}
                        sub={overallVariancePct > 5 ? 'Above planned – review procurement' : overallVariancePct < -5 ? 'Below planned – check progress' : 'Within acceptable range'}
                        icon={overallVariancePct > 5 ? AlertTriangle : CheckCircle2}
                        color={overallVariancePct > 5 ? 'red' : 'green'}
                        trend={overallVariancePct}
                    />
                    <KPICard
                        label="Cost Variance"
                        value={fmtCurrency(Math.abs(totalActualCost - totalPlannedCost))}
                        sub={totalActualCost > totalPlannedCost ? 'Over budget' : 'Under budget'}
                        icon={TrendingUp}
                        color="purple"
                    />
                </div>

                {/* Main Chart */}
                <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Monthly Consumption Overview</h3>
                            <p className="text-[10px] text-gray-400 mt-0.5">Bars = monthly cost value • Dashed line = cumulative planned S-curve • Solid line = cumulative actual</p>
                        </div>
                        <div className="flex items-center gap-4 text-[10px]">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-2 rounded-sm bg-blue-500 opacity-75" />
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Planned</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-2 rounded-sm bg-green-500 opacity-75" />
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Actual</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-5 border-t-2 border-dashed border-blue-400" />
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Cum. Planned</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-5 border-t-2 border-green-500" />
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Cum. Actual</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-4">
                        <Histogram
                            data={data}
                            activeMaterials={activeMaterials}
                            hoveredMonth={hoveredMonth}
                            setHoveredMonth={setHoveredMonth}
                        />
                    </div>
                </div>

                {/* Bottom Grid: Table + Donut */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Material Breakdown Table */}
                    <div className="xl:col-span-2 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Material-wise Breakdown</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 dark:bg-white/[0.02]">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left text-gray-500 uppercase font-bold tracking-wider">Material</th>
                                        <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Unit</th>
                                        <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold tracking-wider">Planned</th>
                                        <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold tracking-wider">Actual</th>
                                        <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold tracking-wider">Variance</th>
                                        <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold tracking-wider">Var %</th>
                                        <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold tracking-wider">Cost (Plan)</th>
                                        <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold tracking-wider">Cost (Act)</th>
                                        <th className="px-4 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                    {tableData.map(d => (
                                        <tr key={d.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                                    <span>{d.icon}</span>
                                                    <span>{d.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center text-gray-500">{d.unit}</td>
                                            <td className="px-3 py-3 text-right font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{fmt(d.planned)}</td>
                                            <td className="px-3 py-3 text-right font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{fmt(d.actual)}</td>
                                            <td className={`px-3 py-3 text-right font-semibold tabular-nums ${d.varianceQty > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {d.varianceQty > 0 ? '+' : ''}{fmt(d.varianceQty)}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${d.variancePct > 5 ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : d.variancePct < -5 ? 'bg-green-50 dark:bg-green-900/20 text-green-500' : 'bg-gray-100 dark:bg-white/10 text-gray-500'}`}>
                                                    {d.variancePct >= 0 ? '+' : ''}{d.variancePct.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right text-gray-500 tabular-nums">{fmtCurrency(d.costPlanned)}</td>
                                            <td className="px-3 py-3 text-right font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{fmtCurrency(d.costActual)}</td>
                                            <td className="px-4 py-3 text-center">
                                                {d.variancePct > 10 ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500">
                                                        <AlertTriangle size={11} /> Over
                                                    </span>
                                                ) : d.variancePct < -10 ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500">
                                                        <TrendingDown size={11} /> Under
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-500">
                                                        <CheckCircle2 size={11} /> OK
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 dark:bg-white/5 border-t-2 border-gray-300 dark:border-white/10">
                                    <tr>
                                        <td className="px-4 py-3 font-black text-gray-800 dark:text-white uppercase" colSpan={2}>Grand Total</td>
                                        <td className="px-3 py-3 text-right font-black text-blue-600 dark:text-blue-400 tabular-nums">{fmt(tableData.reduce((s, d) => s + d.planned, 0))}</td>
                                        <td className="px-3 py-3 text-right font-black text-green-600 dark:text-green-400 tabular-nums">{fmt(tableData.reduce((s, d) => s + d.actual, 0))}</td>
                                        <td colSpan={2} />
                                        <td className="px-3 py-3 text-right font-bold text-gray-500 tabular-nums">{fmtCurrency(totalPlannedCost)}</td>
                                        <td className="px-3 py-3 text-right font-black text-gray-800 dark:text-gray-200 tabular-nums">{fmtCurrency(totalActualCost)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Donut Chart */}
                    <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-5">Cost Distribution</h3>
                        <DonutChart data={data} activeMaterials={activeMaterials} />
                        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Highest Spend</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                    {tableData.sort((a, b) => b.costActual - a.costActual)[0]?.name}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs mt-1.5">
                                <span className="text-gray-500">Lowest Spend</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                    {[...tableData].sort((a, b) => a.costActual - b.costActual)[0]?.name}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaterialHistogram;
