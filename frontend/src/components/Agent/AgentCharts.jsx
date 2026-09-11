import React, { useState } from 'react';
import { BarChart3, PieChart, Table2, Layers, TrendingUp, LineChart } from 'lucide-react';

const PALETTE = [
    { color: '#3B82F6', fill: 'from-blue-500 to-indigo-600', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', pillBg: 'bg-blue-50 dark:bg-blue-950/50', border: 'border-blue-200 dark:border-blue-800' },
    { color: '#10B981', fill: 'from-emerald-500 to-teal-600', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', pillBg: 'bg-emerald-50 dark:bg-emerald-950/50', border: 'border-emerald-200 dark:border-emerald-800' },
    { color: '#8B5CF6', fill: 'from-purple-500 to-violet-600', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500', pillBg: 'bg-purple-50 dark:bg-purple-950/50', border: 'border-purple-200 dark:border-purple-800' },
    { color: '#F59E0B', fill: 'from-amber-500 to-orange-600', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', pillBg: 'bg-amber-50 dark:bg-amber-950/50', border: 'border-amber-200 dark:border-amber-800' },
    { color: '#EC4899', fill: 'from-pink-500 to-rose-600', text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-500', pillBg: 'bg-pink-50 dark:bg-pink-950/50', border: 'border-pink-200 dark:border-pink-800' },
    { color: '#06B6D4', fill: 'from-cyan-500 to-sky-600', text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500', pillBg: 'bg-cyan-50 dark:bg-cyan-950/50', border: 'border-cyan-200 dark:border-cyan-800' },
    { color: '#F97316', fill: 'from-orange-500 to-amber-600', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500', pillBg: 'bg-orange-50 dark:bg-orange-950/50', border: 'border-orange-200 dark:border-orange-800' },
    { color: '#6366F1', fill: 'from-indigo-500 to-blue-600', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500', pillBg: 'bg-indigo-50 dark:bg-indigo-950/50', border: 'border-indigo-200 dark:border-indigo-800' },
];

export function AgentBarChart({ data, total, selectedSegment, onSelect }) {
    const [hoveredIdx, setHoveredIdx] = useState(null);
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const hasActiveFilter = Boolean(selectedSegment);

    return (
        <div className="space-y-1.5 py-0.5">
            {data.map((item, index) => {
                const palette = PALETTE[index % PALETTE.length];
                const widthPercent = Math.max(Math.round((item.value / maxValue) * 100), 4);
                const isHovered = hoveredIdx === index;
                const isSelected = selectedSegment && item.label.toLowerCase() === selectedSegment.toLowerCase();
                const isDimmed = hasActiveFilter && !isSelected;

                return (
                    <div
                        key={index}
                        onClick={() => onSelect && onSelect(isSelected ? null : item.label)}
                        className={`group rounded-md p-1 transition-all cursor-pointer ${
                            isSelected
                                ? 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-400 dark:ring-amber-500'
                                : isHovered
                                ? 'bg-gray-50 dark:bg-gh-hover/50'
                                : ''
                        } ${isDimmed ? 'opacity-40 hover:opacity-80' : 'opacity-100'}`}
                        onMouseEnter={() => setHoveredIdx(index)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        title={onSelect ? `${isSelected ? 'Clear filter' : `Filter by ${item.label}`}` : undefined}
                    >
                        <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                                {item.label}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-bold text-gray-900 dark:text-gray-100">{item.value.toLocaleString()}</span>
                                <span className={`text-[10px] font-semibold px-1 py-0.1 rounded-full border ${palette.pillBg} ${palette.text} ${palette.border}`}>
                                    {item.percentage}%
                                </span>
                            </div>
                        </div>
                        <div className="h-2 w-full bg-gray-100 dark:bg-gray-800/80 rounded-full overflow-hidden p-0.5">
                            <div
                                className={`h-full rounded-full bg-gradient-to-r ${palette.fill} transition-all duration-500 ease-out`}
                                style={{ width: `${widthPercent}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function AgentDonutChart({ data, total, selectedSegment, onSelect }) {
    const [hoveredIdx, setHoveredIdx] = useState(null);
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    let accumulatedAngle = 0;

    const hasActiveFilter = Boolean(selectedSegment);
    const selectedItem = selectedSegment
        ? data.find(d => d.label.toLowerCase() === selectedSegment.toLowerCase())
        : null;
    const activeItem = hoveredIdx !== null ? data[hoveredIdx] : selectedItem;

    return (
        <div className="flex flex-col sm:flex-row items-center gap-3 py-1">
            {/* SVG Donut */}
            <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        className="stroke-gray-100 dark:stroke-gray-800 fill-none"
                        strokeWidth="13"
                    />
                    {data.map((item, index) => {
                        const palette = PALETTE[index % PALETTE.length];
                        const strokeDash = (item.percentage / 100) * circumference;
                        const strokeOffset = accumulatedAngle;
                        accumulatedAngle += strokeDash;
                        const isHovered = hoveredIdx === index;
                        const isSelected = selectedSegment && item.label.toLowerCase() === selectedSegment.toLowerCase();
                        const isDimmed = hasActiveFilter && !isSelected;

                        return (
                            <circle
                                key={index}
                                cx="50"
                                cy="50"
                                r={radius}
                                stroke={palette.color}
                                strokeWidth={isSelected ? "17" : isHovered ? "15" : "13"}
                                strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                                strokeDashoffset={-strokeOffset}
                                className={`fill-none transition-all duration-300 cursor-pointer ${
                                    isDimmed ? 'opacity-35 hover:opacity-80' : 'opacity-100'
                                }`}
                                onClick={() => onSelect && onSelect(isSelected ? null : item.label)}
                                onMouseEnter={() => setHoveredIdx(index)}
                                onMouseLeave={() => setHoveredIdx(null)}
                            />
                        );
                    })}
                </svg>
                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                    {activeItem ? (
                        <>
                            <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100 leading-tight">
                                {activeItem.value}
                            </span>
                            <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                                {activeItem.percentage}%
                            </span>
                            <span className="text-[8px] text-gray-500 dark:text-gh-muted truncate max-w-[55px]">
                                {activeItem.label}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100 leading-tight">
                                {total.toLocaleString()}
                            </span>
                            <span className="text-[9px] font-medium text-gray-500 dark:text-gh-muted uppercase tracking-wider">
                                Total
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Compact Legend */}
            <div className="flex-1 w-full space-y-1 max-h-40 overflow-y-auto pr-0.5 custom-scrollbar">
                {data.map((item, index) => {
                    const palette = PALETTE[index % PALETTE.length];
                    const isHovered = hoveredIdx === index;
                    const isSelected = selectedSegment && item.label.toLowerCase() === selectedSegment.toLowerCase();
                    const isDimmed = hasActiveFilter && !isSelected;

                    return (
                        <div
                            key={index}
                            onClick={() => onSelect && onSelect(isSelected ? null : item.label)}
                            className={`flex items-center justify-between text-xs py-0.5 px-1.5 rounded cursor-pointer transition-colors ${
                                isSelected
                                    ? 'bg-amber-50 dark:bg-amber-950/50 ring-1 ring-amber-400 font-bold'
                                    : isHovered
                                    ? 'bg-gray-100 dark:bg-gh-hover'
                                    : 'hover:bg-gray-50 dark:hover:bg-gh-hover/50'
                            } ${isDimmed ? 'opacity-40 hover:opacity-80' : 'opacity-100'}`}
                            onMouseEnter={() => setHoveredIdx(index)}
                            onMouseLeave={() => setHoveredIdx(null)}
                        >
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${palette.bg}`} />
                                <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px] font-medium text-[11px]">
                                    {item.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 text-right">
                                <span className="font-semibold text-gray-900 dark:text-gray-100 text-[11px]">{item.value}</span>
                                <span className="text-[10px] text-gray-500 dark:text-gh-muted font-medium w-8 text-right">
                                    {item.percentage}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function AgentAnalyticsTable({ data, total }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gh-border mt-1">
            <table className="w-full text-left text-xs">
                <thead>
                    <tr className="bg-gray-50/80 dark:bg-gh-hover/50 text-gray-600 dark:text-gh-muted border-b border-gray-200/80 dark:border-gh-border">
                        <th scope="col" className="py-1.5 px-2 font-semibold w-8">#</th>
                        <th scope="col" className="py-1.5 px-2 font-semibold">Segment</th>
                        <th scope="col" className="py-1.5 px-2 font-semibold text-right">Count</th>
                        <th scope="col" className="py-1.5 px-2 font-semibold text-right">Share</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gh-border">
                    {data.map((item, index) => {
                        const palette = PALETTE[index % PALETTE.length];
                        return (
                            <tr key={index} className="hover:bg-gray-50/60 dark:hover:bg-gh-hover/40 transition-colors">
                                <td className="py-1.5 px-2 text-gray-400 font-mono text-[10px]">{index + 1}</td>
                                <td className="py-1.5 px-2 font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${palette.bg}`} />
                                    <span className="truncate max-w-[140px] text-[11px]">{item.label}</span>
                                </td>
                                <td className="py-1.5 px-2 text-right font-bold text-gray-900 dark:text-gray-100 text-xs">{item.value.toLocaleString()}</td>
                                <td className="py-1.5 px-2 text-right">
                                    <span className={`inline-block text-[10px] font-semibold px-1 py-0.2 rounded ${palette.pillBg} ${palette.text} ${palette.border} border`}>
                                        {item.percentage}%
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export function AgentLineChart({ data, total }) {
    const [hoveredIdx, setHoveredIdx] = useState(null);

    if (!data || data.length === 0) return null;

    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    // SVG coordinate space
    const width = 460;
    const height = 170;
    const padding = { top: 15, right: 25, bottom: 30, left: 30 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const points = data.map((d, i) => {
        const x = data.length > 1
            ? padding.left + (i / (data.length - 1)) * innerWidth
            : padding.left + innerWidth / 2;
        const y = padding.top + innerHeight - ((d.value - minValue) / range) * innerHeight;
        return { x, y, ...d, index: i };
    });

    const pathD = points.length === 1
        ? `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y}`
        : points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');

    const areaD = points.length > 1
        ? `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + innerHeight} L ${points[0].x.toFixed(1)} ${padding.top + innerHeight} Z`
        : '';

    const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

    return (
        <div className="py-1">
            <div className="relative w-full overflow-hidden">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-auto overflow-visible select-none"
                >
                    <defs>
                        <linearGradient id="agentLineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* Horizontal grid lines */}
                    {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                        const y = padding.top + innerHeight * (1 - ratio);
                        const val = Math.round(minValue + ratio * range);
                        return (
                            <g key={idx} className="opacity-40 dark:opacity-20">
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={width - padding.right}
                                    y2={y}
                                    stroke="currentColor"
                                    strokeDasharray="3 3"
                                    strokeWidth="1"
                                    className="text-gray-300 dark:text-gray-600"
                                />
                                <text
                                    x={padding.left - 4}
                                    y={y + 3}
                                    textAnchor="end"
                                    className="text-[9px] fill-gray-400 dark:fill-gray-500 font-mono"
                                >
                                    {val}
                                </text>
                            </g>
                        );
                    })}

                    {/* Gradient fill area under the line */}
                    {areaD && (
                        <path
                            d={areaD}
                            fill="url(#agentLineGrad)"
                        />
                    )}

                    {/* The stroke line */}
                    <path
                        d={pathD}
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-all duration-300"
                    />

                    {/* Points */}
                    {points.map((p, idx) => {
                        const isHovered = hoveredIdx === idx;
                        return (
                            <g key={idx} className="cursor-pointer"
                                onMouseEnter={() => setHoveredIdx(idx)}
                                onMouseLeave={() => setHoveredIdx(null)}>
                                <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={isHovered ? 5 : 3.5}
                                    className={`fill-white stroke-blue-600 transition-all ${isHovered ? 'stroke-[3]' : 'stroke-2'}`}
                                />
                                <text
                                    x={p.x}
                                    y={height - 8}
                                    textAnchor="middle"
                                    className={`text-[9px] ${isHovered ? 'fill-blue-600 dark:fill-blue-400 font-bold' : 'fill-gray-500 dark:fill-gray-400 font-medium'}`}
                                >
                                    {p.label}
                                </text>
                            </g>
                        );
                    })}
                </svg>

                {/* Hover Tooltip display */}
                {activePoint && (
                    <div
                        className="absolute top-1 bg-gray-900/95 text-white dark:bg-gray-100 dark:text-gray-900 rounded-lg px-2 py-0.5 text-[11px] shadow-lg pointer-events-none transition-all flex items-center gap-1.5 border border-gray-700/50 dark:border-gray-200"
                        style={{
                            left: `${Math.min(Math.max((activePoint.x / width) * 100, 12), 88)}%`,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <span className="font-semibold">{activePoint.label}:</span>
                        <span className="font-bold text-blue-400 dark:text-blue-600">{activePoint.value.toLocaleString()}</span>
                        <span className="text-[10px] opacity-75">({activePoint.percentage}%)</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export function AgentChartCard({ chart, preview = false }) {
    const initialView = chart.chartType === 'donut' ? 'donut' : chart.chartType === 'line' ? 'line' : chart.chartType === 'table' ? 'table' : 'bar';
    const [viewMode, setViewMode] = useState(initialView);

    const data = chart.data || [];
    const total = chart.total || data.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <section
            className="rounded-xl border border-gray-200/90 bg-white p-3 text-xs shadow-2xs dark:border-gh-border dark:bg-gh-subtle transition-all"
            aria-label={`Analytics Visualization: ${chart.title || 'Chart'}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-gray-100 dark:border-gh-border">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                        <TrendingUp size={13} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xs truncate">
                            {chart.title || 'Breakdown'}
                        </h3>
                        <p className="text-[10px] text-gray-500 dark:text-gh-muted">
                            {total} total
                        </p>
                    </div>
                </div>

                {/* View Switcher Toggle */}
                <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gh-hover text-[10px]">
                    <button
                        type="button"
                        onClick={() => setViewMode('bar')}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold transition-all ${
                            viewMode === 'bar'
                                ? 'bg-white text-blue-600 shadow-2xs dark:bg-gh-subtle dark:text-blue-400'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gh-muted dark:hover:text-gray-200'
                        }`}
                        title="Bar View"
                    >
                        <BarChart3 size={11} />
                        <span>Bar</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('donut')}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold transition-all ${
                            viewMode === 'donut'
                                ? 'bg-white text-blue-600 shadow-2xs dark:bg-gh-subtle dark:text-blue-400'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gh-muted dark:hover:text-gray-200'
                        }`}
                        title="Donut View"
                    >
                        <PieChart size={11} />
                        <span>Donut</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold transition-all ${
                            viewMode === 'table'
                                ? 'bg-white text-blue-600 shadow-2xs dark:bg-gh-subtle dark:text-blue-400'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gh-muted dark:hover:text-gray-200'
                        }`}
                        title="Table View"
                    >
                        <Table2 size={11} />
                        <span>Table</span>
                    </button>
                </div>
            </div>

            {/* Chart Area */}
            {data.length === 0 ? (
                <div className="py-4 text-center text-gray-400 text-xs">
                    No data available.
                </div>
            ) : viewMode === 'line' ? (
                <AgentLineChart data={data} total={total} />
            ) : viewMode === 'donut' ? (
                <AgentDonutChart data={data} total={total} />
            ) : viewMode === 'bar' ? (
                <AgentBarChart data={data} total={total} />
            ) : (
                <AgentAnalyticsTable data={data} total={total} />
            )}
        </section>
    );
}

export function AgentMultiChartCard({ multiChart, preview = false }) {
    const charts = Array.isArray(multiChart?.charts) ? multiChart.charts : [];
    const totalRecords = charts.reduce((sum, c) => sum + (c.total || 0), 0);

    return (
        <section
            className="rounded-xl border border-gray-200/90 bg-white p-3 shadow-2xs dark:border-gh-border dark:bg-gh-subtle space-y-2.5 transition-all"
            aria-label="Multi-Entity ERP Overview"
        >
            {/* Multi-chart Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-gh-border">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/50 text-blue-600 dark:text-blue-400">
                        <BarChart3 size={14} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xs truncate">
                            {multiChart?.title || 'ERP Overview'}
                        </h3>
                        <p className="text-[10px] text-gray-500 dark:text-gh-muted">
                            {charts.length} entities · {totalRecords.toLocaleString()} rows
                        </p>
                    </div>
                </div>
            </div>

            {/* Direct Compact Grid of Chart Tiles (No nested AgentChartCard toolbars) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {charts.map((chart, idx) => (
                    <div
                        key={idx}
                        className="rounded-lg border border-gray-200/80 bg-gray-50/40 p-2 dark:border-gh-border dark:bg-gh-hover/20"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-800 dark:text-gray-200 text-[11px] truncate">
                                {chart.title}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-500 dark:text-gh-muted shrink-0">
                                {chart.total || (chart.data || []).reduce((a, b) => a + b.value, 0)}
                            </span>
                        </div>
                        {chart.chartType === 'donut' ? (
                            <AgentDonutChart data={chart.data || []} total={chart.total || 0} />
                        ) : (
                            <AgentBarChart data={chart.data || []} total={chart.total || 0} />
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
