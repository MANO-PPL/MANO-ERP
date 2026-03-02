import React from 'react';
import { ArrowLeft, Download, TrendingUp } from 'lucide-react';

const fmt = (n, dec = 2) =>
    n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const computeSection = (section, slabArea, gstRate) => {
    let basic = 0;
    section.items.forEach(it => {
        const resolved = it.totalRateOverride != null
            ? it.totalRateOverride
            : (Number(it.materialRate) + Number(it.labourRate));
        basic += (resolved * Number(it.quantity)) / 100_000;
    });
    const gst = basic * (1 + gstRate);
    const ratePSft = slabArea > 0 ? (basic * 100_000) / slabArea : 0;
    return { basic, gst, ratePSft };
};

// Simple SVG horizontal bar chart
const BarChart = ({ sections, slabArea, gstRate }) => {
    const data = sections.map(s => {
        const { basic } = computeSection(s, slabArea, gstRate);
        return { name: s.name, icon: s.icon, value: basic, color: s.color };
    });
    const max = Math.max(...data.map(d => d.value), 1);
    const COLORS = [
        '#3b82f6', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6',
        '#14b8a6', '#64748b', '#22c55e', '#6366f1', '#f97316', '#ec4899',
    ];
    return (
        <div className="space-y-2">
            {data.map((d, i) => (
                <div key={d.name} className="flex items-center gap-3">
                    <span className="text-sm w-5 text-center">{d.icon}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400 w-36 truncate">{d.name}</span>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-white/5 rounded-lg overflow-hidden">
                        <div
                            className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                            style={{ width: `${(d.value / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] + 'cc' }}
                        >
                            {d.value > max * 0.15 && (
                                <span className="text-[10px] font-bold text-white">₹{fmt(d.value, 1)} L</span>
                            )}
                        </div>
                    </div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-24 text-right">
                        ₹{fmt(d.value, 1)} Lacs
                    </span>
                </div>
            ))}
        </div>
    );
};

// Simple SVG donut chart
const DonutChart = ({ sections, slabArea, gstRate }) => {
    const data = sections.map((s, i) => {
        const { basic } = computeSection(s, slabArea, gstRate);
        return { name: s.name, icon: s.icon, value: basic };
    });
    const total = data.reduce((s, d) => s + d.value, 0);
    const COLORS = ['#3b82f6', '#f59e0b', '#06b6d4', '#ef4444', '#8b5cf6', '#14b8a6', '#64748b', '#22c55e', '#6366f1', '#f97316', '#ec4899'];
    const r = 60, cx = 80, cy = 80, strokeW = 24;
    const circ = 2 * Math.PI * r;

    let cumulative = 0;
    const slices = data.filter(d => d.value > 0).map((d, i) => {
        const pct = d.value / total;
        const dash = pct * circ;
        const offset = circ - cumulative * circ;
        cumulative += pct;
        return { ...d, dash, offset, color: COLORS[i % COLORS.length] };
    });

    const top3 = [...data].sort((a, b) => b.value - a.value).slice(0, 5);

    return (
        <div className="flex items-center gap-6">
            <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeW} className="dark:stroke-white/10" />
                {slices.map((s, i) => (
                    <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                        stroke={s.color} strokeWidth={strokeW}
                        strokeDasharray={`${s.dash} ${circ - s.dash}`}
                        strokeDashoffset={s.offset}
                        transform={`rotate(-90 ${cx} ${cy})`}
                        style={{ transition: 'stroke-dasharray 0.5s' }}
                    />
                ))}
                <text x={cx} y={cy - 6} textAnchor="middle" className="fill-gray-700 dark:fill-gray-300" fontSize="9" fontWeight="bold">TOTAL</text>
                <text x={cx} y={cy + 8} textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="11" fontWeight="bold">
                    ₹{fmt(total, 0)} L
                </text>
            </svg>
            <div className="space-y-1.5">
                {top3.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }}></span>
                        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[130px]">{d.name}</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 ml-auto">₹{fmt(d.value, 1)} L</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Main Summary View ────────────────────────────────────────────────────────
const Summary = ({ sections, slabArea, gstRate, onBack, onGoToSection }) => {
    const sectionTotals = sections.map(s => ({ ...s, ...computeSection(s, slabArea, gstRate) }));
    const grandBasic = sectionTotals.reduce((s, t) => s + t.basic, 0);
    const grandGST = sectionTotals.reduce((s, t) => s + t.gst, 0);
    const grandRatePSft = slabArea > 0 ? (grandBasic * 100_000) / slabArea : 0;

    const exportCSV = () => {
        const header = 'Sr No,Section,Basic Amount (Lacs),Rate/Sqft (₹),Amount incl. GST (Lacs)';
        const rows = sectionTotals.map(s =>
            [s.srNo, `"${s.name}"`, s.basic.toFixed(2), s.ratePSft.toFixed(2), s.gst.toFixed(2)].join(',')
        );
        const footer = `,,TOTAL,${grandBasic.toFixed(2)},${grandRatePSft.toFixed(2)},${grandGST.toFixed(2)}`;
        const blob = new Blob([[header, ...rows, footer].join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'Project_Budget_Summary.csv'; a.click();
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0d1117]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
                        <ArrowLeft size={16} />
                    </button>
                    <TrendingUp size={18} className="text-blue-500" />
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Budget Summary</h2>
                        <p className="text-xs text-gray-400">All sections combined</p>
                    </div>
                </div>
                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg transition-colors">
                    <Download size={13} /> Export Summary
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* KPI cards */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Grand Total (Basic)', value: `₹ ${fmt(grandBasic, 2)} Lacs`, sub: `≈ ₹ ${fmt(grandBasic / 100, 2)} Cr`, color: 'blue' },
                        { label: 'Grand Total (incl. 18% GST)', value: `₹ ${fmt(grandGST, 2)} Lacs`, sub: `≈ ₹ ${fmt(grandGST / 100, 2)} Cr`, color: 'green' },
                        { label: 'Blended Rate / Sqft', value: `₹ ${fmt(grandRatePSft, 2)}`, sub: `For ${Number(slabArea).toLocaleString('en-IN')} Sqft`, color: 'purple' },
                    ].map(k => (
                        <div key={k.label} className={`bg-white dark:bg-[#161b22] rounded-2xl border border-${k.color}-100 dark:border-${k.color}-500/20 p-5`}>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{k.label}</p>
                            <p className={`text-2xl font-black text-${k.color}-600 dark:text-${k.color}-400`}>{k.value}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-6">
                    {/* Section breakdown table */}
                    <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Section-wise Breakdown</h3>
                        </div>
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-white/[0.02]">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-gray-500 uppercase font-bold">Section</th>
                                    <th className="px-4 py-2.5 text-right text-gray-500 uppercase font-bold">Basic (₹ Lacs)</th>
                                    <th className="px-4 py-2.5 text-right text-gray-500 uppercase font-bold">Rate/Sqft</th>
                                    <th className="px-4 py-2.5 text-right text-gray-500 uppercase font-bold">incl. GST</th>
                                    <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {sectionTotals.map(s => (
                                    <tr key={s.id}
                                        onClick={() => onGoToSection(s.id)}
                                        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group">
                                        <td className="px-4 py-2.5 flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                            <span>{s.icon}</span>{s.srNo}. {s.name}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-gray-800 dark:text-gray-200">{fmt(s.basic)}</td>
                                        <td className="px-4 py-2.5 text-right text-gray-500">{fmt(s.ratePSft, 2)}</td>
                                        <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400 font-semibold">{fmt(s.gst)}</td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded font-semibold text-[10px]">
                                                {grandBasic > 0 ? ((s.basic / grandBasic) * 100).toFixed(1) : 0}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 dark:bg-white/5 border-t-2 border-gray-300 dark:border-white/10">
                                <tr>
                                    <td className="px-4 py-3 font-black text-gray-800 dark:text-white text-sm uppercase">GRAND TOTAL</td>
                                    <td className="px-4 py-3 text-right font-black text-blue-600 dark:text-blue-400 text-sm">{fmt(grandBasic)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-600 dark:text-gray-300 text-sm">{fmt(grandRatePSft, 2)}</td>
                                    <td className="px-4 py-3 text-right font-black text-green-600 dark:text-green-400 text-sm">{fmt(grandGST)}</td>
                                    <td className="px-3 py-3 text-right font-bold text-gray-500">100%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Charts */}
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Distribution</h3>
                            <DonutChart sections={sections} slabArea={slabArea} gstRate={gstRate} />
                        </div>
                        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Section Comparison</h3>
                            <BarChart sections={sections} slabArea={slabArea} gstRate={gstRate} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Summary;
