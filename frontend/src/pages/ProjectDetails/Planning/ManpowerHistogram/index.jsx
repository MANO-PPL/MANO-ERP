import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Download, Filter, Users, BarChart3,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
    ChevronDown, Clock, UserCheck, Plus, X, Trash2, Edit2, Save, Sparkles, GripVertical, Calendar, Briefcase, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { DEFAULT_PHASES as PROJECT_PHASES } from '../ProjectPlanningBarChart';

// ─── Trade Data ─────────────────────────────────────────────────────────────────
const TRADES = [
    { id: 'mason', name: 'Mason', color: '#6366f1', icon: '🧱', rate: 850 },
    { id: 'carpenter', name: 'Carpenter', color: '#f59e0b', icon: '🪚', rate: 800 },
    { id: 'steelfitter', name: 'Steel Fitter / Bar Bender', color: '#ef4444', icon: '🔩', rate: 900 },
    { id: 'plumber', name: 'Plumber', color: '#06b6d4', icon: '🔧', rate: 750 },
    { id: 'electrician', name: 'Electrician', color: '#8b5cf6', icon: '⚡', rate: 800 },
    { id: 'helper', name: 'Helper / Unskilled', color: '#64748b', icon: '👷', rate: 500 },
    { id: 'painter', name: 'Painter', color: '#22c55e', icon: '🎨', rate: 700 },
    { id: 'supervisor', name: 'Supervisor / Engineer', color: '#ec4899', icon: '📋', rate: 1500 },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PHASE_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#22c55e', '#14b8a6', '#ec4899', '#f97316', '#64748b'];
const PHASE_ICONS = ['📋', '🏗️', '🔩', '⚡', '🧱', '🎨', '🏁', '📐', '🚧', '🔧'];

const toDate = (s) => new Date(s);
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
let _c = Date.now(); const uid = () => `id_${_c++}`;

// ─── Initial Demo Data ──────────────────────────────────────────────────────────
const DEFAULT_PHASES = [
    {
        id: 'p1', name: 'Substructure', color: '#6366f1', icon: '🏗️', tasks: [
            { id: 't1', name: 'Excavation', start: '2026-01-05', end: '2026-02-15', manpower: { helper: 15, supervisor: 2 } },
            { id: 't2', name: 'Foundation', start: '2026-02-10', end: '2026-04-20', manpower: { mason: 12, helper: 20, electrician: 2, supervisor: 3 } },
        ]
    },
    {
        id: 'p2', name: 'Superstructure', color: '#f59e0b', icon: '🔩', tasks: [
            { id: 't3', name: 'RCC Columns', start: '2026-04-15', end: '2026-07-30', manpower: { steelfitter: 18, carpenter: 15, helper: 30, supervisor: 4 } },
            { id: 't4', name: 'Brickwork', start: '2026-07-01', end: '2026-10-15', manpower: { mason: 25, helper: 35, plumber: 5, electrician: 4, supervisor: 5 } },
        ]
    },
    {
        id: 'p3', name: 'Finishing', color: '#22c55e', icon: '🎨', tasks: [
            { id: 't5', name: 'Plastering', start: '2026-09-15', end: '2026-11-30', manpower: { mason: 15, helper: 25, supervisor: 3 } },
            { id: 't6', name: 'Painting & Flooring', start: '2026-11-01', end: '2026-12-31', manpower: { painter: 15, helper: 20, supervisor: 2 } },
        ]
    }
];

// ─── Phase Requirement Drawer ──────────────────────────────────────────────────
const ManpowerRequirementDrawer = ({ open, onClose, tasks, setTasks, targetTask }) => {
    const task = tasks.find(t => t.id === targetTask);
    const [localManpower, setLocalManpower] = useState({});

    useEffect(() => {
        if (task) setLocalManpower(task.manpower || {});
    }, [task, open]);

    const updateHeadcount = (tid, val) => {
        setLocalManpower(prev => ({ ...prev, [tid]: Math.max(0, parseInt(val) || 0) }));
    };

    const save = () => {
        setTasks(prev => prev.map(t => t.id === targetTask ? { ...t, manpower: localManpower } : t));
        onClose();
    };

    return (
        <AnimatePresence>
            {open && task && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-[#161b22] shadow-2xl z-[70] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/5 shrink-0">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 dark:text-white">Plan Manpower</h2>
                                <p className="text-[10px] text-gray-400">{task.name}</p>
                            </div>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Trade-wise Headcount</h3>
                            <div className="space-y-2">
                                {TRADES.map(trade => (
                                    <div key={trade.id} className="flex items-center gap-4 px-4 py-3 bg-gray-50 dark:bg-[#0d1117] rounded-xl border border-gray-100 dark:border-white/5">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: trade.color + '20' }}>{trade.icon}</span>
                                            <div>
                                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{trade.name}</p>
                                                <p className="text-[10px] text-gray-400">₹{trade.rate}/day</p>
                                            </div>
                                        </div>
                                        <div className="w-24">
                                            <input type="number" value={localManpower[trade.id] || 0} onChange={(e) => updateHeadcount(trade.id, e.target.value)}
                                                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-sm text-center font-bold text-gray-800 dark:text-gray-200 focus:border-blue-500 outline-none" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#0d1117] flex gap-3">
                            <button onClick={onClose} className="flex-1 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                            <button onClick={save} className="flex-2 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20">Apply Plan</button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ─── Phase Drawer ──────────────────────────────────────────────────────────────
const PhaseDrawer = ({ open, onClose, phases, setPhases, editingPhase }) => {
    const isEdit = !!editingPhase;
    const existing = isEdit ? phases.find(p => p.id === editingPhase) : null;
    const [name, setName] = useState(''); const [icon, setIcon] = useState(PHASE_ICONS[0]); const [tasks, setTasks] = useState([]);

    useEffect(() => {
        if (isEdit && existing) { setName(existing.name); setIcon(existing.icon); setTasks(existing.tasks.map(a => ({ ...a }))); }
        else { setName(''); setIcon(PHASE_ICONS[phases.length % PHASE_ICONS.length]); setTasks([]); }
    }, [open, editingPhase]);

    const addAct = () => { const t = '2026-01-01'; const n = '2026-01-10'; setTasks(p => [...p, { id: uid(), name: '', start: t, end: n, manpower: {} }]); };
    const updAct = (i, f, v) => setTasks(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a));
    const rmAct = (i) => setTasks(p => p.filter((_, j) => j !== i));
    const save = () => {
        if (!name.trim()) return;
        const color = PHASE_COLORS[phases.length % PHASE_COLORS.length];
        if (isEdit) setPhases(p => p.map(ph => ph.id === editingPhase ? { ...ph, name, color, icon, tasks } : ph));
        else setPhases(p => [...p, { id: uid(), name, color, icon, tasks }]);
        onClose();
    };
    const del = () => { setPhases(p => p.filter(ph => ph.id !== editingPhase)); onClose(); };

    return (
        <AnimatePresence>{open && (<>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-white dark:bg-[#161b22] shadow-2xl z-50 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/5 shrink-0">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">{isEdit ? 'Edit Phase' : 'Add New Phase'}</h2>
                    <div className="flex items-center gap-2">
                        {isEdit && <button onClick={del} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 size={16} /></button>}
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X size={16} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Phase Details</h3>
                        <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Phase Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Substructure"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-blue-500" /></div>
                        <div className="grid grid-cols-1 gap-4">
                            <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 block">Icon</label>
                                <div className="flex flex-wrap gap-1.5">{PHASE_ICONS.map(ic => <button key={ic} onClick={() => setIcon(ic)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${icon === ic ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}>{ic}</button>)}</div></div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between"><h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tasks ({tasks.length})</h3>
                            <button onClick={addAct} className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-600"><Plus size={12} /> Add Task</button></div>
                        {tasks.map((act, idx) => (
                            <motion.div key={act.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-gray-50 dark:bg-[#0d1117] rounded-xl border border-gray-100 dark:border-white/5 p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <input value={act.name} onChange={e => updAct(idx, 'name', e.target.value)} placeholder="Task name"
                                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-blue-500" />
                                    <button onClick={() => rmAct(idx)} className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] text-gray-500 mb-0.5 block">Start Date</label><input type="date" value={act.start} onChange={e => updAct(idx, 'start', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500" /></div>
                                    <div><label className="text-[10px] text-gray-500 mb-0.5 block">End Date</label><input type="date" value={act.end} onChange={e => updAct(idx, 'end', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500" /></div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/5 shrink-0 bg-gray-50 dark:bg-[#0d1117]">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                    <button onClick={save} className="flex items-center gap-1.5 px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20"><Save size={13} /> {isEdit ? 'Save Changes' : 'Add Phase'}</button>
                </div>
            </motion.div>
        </>)}</AnimatePresence>
    );
};

// ─── Import Modal ──────────────────────────────────────────────────────────────
const ProjectPlanImportModal = ({ open, onClose, onImport }) => {
    const [selected, setSelected] = useState({}); // { [phaseId]: { [taskId]: true } }

    useEffect(() => {
        if (open) {
            const initial = {};
            PROJECT_PHASES.forEach(p => {
                initial[p.id] = {};
                (p.activities || []).forEach(a => { initial[p.id][a.id] = true; });
            });
            setSelected(initial);
        }
    }, [open]);

    const togglePhase = (pid) => {
        const phase = PROJECT_PHASES.find(p => p.id === pid);
        const allOn = Object.values(selected[pid] || {}).every(v => v);
        const next = { ...selected[pid] };
        (phase.activities || []).forEach(a => { next[a.id] = !allOn; });
        setSelected(p => ({ ...p, [pid]: next }));
    };

    const toggleTask = (pid, tid) => {
        setSelected(p => ({
            ...p,
            [pid]: { ...p[pid], [tid]: !p[pid][tid] }
        }));
    };

    const handleImport = () => {
        const phasesToImport = PROJECT_PHASES.filter(p => Object.values(selected[p.id] || {}).some(v => v))
            .map(p => ({
                id: uid(),
                name: p.name,
                color: p.color,
                icon: p.icon,
                tasks: (p.activities || []).filter(a => selected[p.id][a.id]).map(a => ({
                    id: uid(),
                    name: a.name,
                    start: a.start,
                    end: a.end,
                    manpower: {}
                }))
            }));
        onImport(phasesToImport);
        onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[100]" onClick={onClose} />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-white dark:bg-[#161b22] shadow-2xl z-[110] flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Import from Project Plan</h3>
                                <p className="text-[10px] text-gray-400">Select phases and tasks to include in your resource plan</p>
                            </div>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {PROJECT_PHASES.map(phase => (
                                <div key={phase.id} className="border border-gray-100 dark:border-white/5 rounded-xl overflow-hidden bg-white dark:bg-[#0d1117]">
                                    <div className="px-4 py-2 bg-gray-50 dark:bg-white/[0.02] flex items-center gap-3 border-b border-gray-100 dark:border-white/5">
                                        <input type="checkbox" checked={Object.values(selected[phase.id] || {}).every(v => v)} onChange={() => togglePhase(phase.id)} className="w-4 h-4 rounded accent-blue-500" />
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                            <span className="w-5 h-5 rounded flex items-center justify-center text-[10px]" style={{ backgroundColor: phase.color + '20' }}>{phase.icon}</span>
                                            {phase.name}
                                        </span>
                                    </div>
                                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(phase.activities || []).map(act => (
                                            <label key={act.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all ${selected[phase.id]?.[act.id] ? 'bg-blue-50/50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20' : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                                <input type="checkbox" checked={selected[phase.id]?.[act.id]} onChange={() => toggleTask(phase.id, act.id)} className="w-3.5 h-3.5 rounded accent-blue-500" />
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">{act.name}</p>
                                                    <p className="text-[9px] text-gray-400">{fmt(act.start)} — {fmt(act.end)}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#0d1117] flex justify-end gap-3 shrink-0">
                            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                            <button onClick={handleImport} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20">Import Selection</button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ─── Utility ───────────────────────────────────────────────────────────────────
const fmt = (n) => n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-IN');
const fmtCurrency = (n) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${fmt(n)}`;
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KPICard = ({ label, value, sub, icon: Icon, color, trend }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-500">
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-700" style={{ backgroundColor: color + '08' }} />
        <div className="relative">
            <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
                    <Icon size={18} style={{ color }} />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-green-50 dark:bg-green-900/20 text-green-500'}`}>
                        {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        <span>{Math.abs(trend).toFixed(1)}%</span>
                    </div>
                )}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
            {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
        </div>
    </motion.div>
);

// ─── Stacked Bar Chart ─────────────────────────────────────────────────────────
const StackedBarChart = ({ data, activeTrades, hoveredMonth, setHoveredMonth, showPlanned }) => {
    const W = 900, H = 360, PAD_L = 55, PAD_R = 20, PAD_T = 20, PAD_B = 55;
    const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B;

    const monthlyStacks = MONTHS.map((m, i) => {
        const planned = [], actual = [];
        activeTrades.forEach(tid => {
            const d = data[tid]?.[i];
            if (d) { planned.push({ id: tid, value: d.planned }); actual.push({ id: tid, value: d.actual }); }
        });
        return { month: m, planned, actual, totalPlanned: planned.reduce((s, x) => s + x.value, 0), totalActual: actual.reduce((s, x) => s + x.value, 0) };
    });

    const maxVal = Math.max(...monthlyStacks.map(d => Math.max(d.totalPlanned, d.totalActual)), 1);
    const yScale = chartH / maxVal;
    const barGroupW = chartW / 12;
    const barW = showPlanned ? barGroupW * 0.32 : barGroupW * 0.5;
    const gap = barGroupW * 0.06;

    const yTicks = 5;
    const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxVal / yTicks) * i));

    // Cumulative S-curve
    let cumP = 0, cumA = 0;
    const cumData = monthlyStacks.map(d => { cumP += d.totalPlanned; cumA += d.totalActual; return { cumP, cumA }; });
    const maxCum = Math.max(cumP, cumA, 1);
    const cumScale = chartH / maxCum;
    const cumPlannedPath = cumData.map((d, i) => `${i === 0 ? 'M' : 'L'}${PAD_L + i * barGroupW + barGroupW / 2},${PAD_T + chartH - d.cumP * cumScale}`).join(' ');
    const cumActualPath = cumData.map((d, i) => `${i === 0 ? 'M' : 'L'}${PAD_L + i * barGroupW + barGroupW / 2},${PAD_T + chartH - d.cumA * cumScale}`).join(' ');

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: 280 }}>
                {yTickVals.map((val, i) => {
                    const y = PAD_T + chartH - val * yScale;
                    return (<g key={i}>
                        <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="currentColor" strokeOpacity={0.06} strokeDasharray="4 4" />
                        <text x={PAD_L - 8} y={y + 4} textAnchor="end" className="fill-gray-400 dark:fill-gray-600" fontSize="9" fontFamily="monospace">{val}</text>
                    </g>);
                })}

                {monthlyStacks.map((d, i) => {
                    const isHov = hoveredMonth === i;
                    const xBase = PAD_L + i * barGroupW + (showPlanned ? (barGroupW - barW * 2 - gap) / 2 : (barGroupW - barW) / 2);

                    // Build stacked rects
                    const buildStack = (stack, xOff, opacity) => {
                        let cumY = 0;
                        return stack.map(seg => {
                            const h = seg.value * yScale;
                            const y = PAD_T + chartH - cumY - h;
                            cumY += h;
                            const trade = TRADES.find(t => t.id === seg.id);
                            return <rect key={seg.id} x={xOff} y={y} width={barW} height={Math.max(h, 0)} fill={trade?.color || '#999'} fillOpacity={isHov ? 1 : opacity} rx={2} className="transition-all duration-200" />;
                        });
                    };

                    return (
                        <g key={d.month} onMouseEnter={() => setHoveredMonth(i)} onMouseLeave={() => setHoveredMonth(null)} className="cursor-pointer">
                            {isHov && <rect x={PAD_L + i * barGroupW} y={PAD_T} width={barGroupW} height={chartH} fill="currentColor" fillOpacity={0.03} rx={4} />}
                            {showPlanned && buildStack(d.planned, xBase, 0.55)}
                            {buildStack(d.actual, showPlanned ? xBase + barW + gap : xBase, 0.75)}
                            <text x={PAD_L + i * barGroupW + barGroupW / 2} y={H - PAD_B + 18} textAnchor="middle"
                                className={`${isHov ? 'fill-blue-500 font-bold' : 'fill-gray-500 dark:fill-gray-400'}`} fontSize="10" fontWeight={isHov ? 700 : 500}>{d.month}</text>
                            {isHov && <text x={PAD_L + i * barGroupW + barGroupW / 2} y={PAD_T + chartH - d.totalActual * yScale - 6} textAnchor="middle"
                                className="fill-gray-700 dark:fill-gray-300" fontSize="9" fontWeight="700">{d.totalActual}</text>}
                        </g>
                    );
                })}

                <path d={cumPlannedPath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" opacity={0.5} />
                <path d={cumActualPath} fill="none" stroke="#22c55e" strokeWidth={2} opacity={0.6} />
                {cumData.map((d, i) => {
                    const x = PAD_L + i * barGroupW + barGroupW / 2;
                    return (<g key={`dots-${i}`}>
                        <circle cx={x} cy={PAD_T + chartH - d.cumP * cumScale} r={2.5} fill="#3b82f6" opacity={0.6} />
                        {d.cumA > 0 && <circle cx={x} cy={PAD_T + chartH - d.cumA * cumScale} r={2.5} fill="#22c55e" opacity={0.7} />}
                    </g>);
                })}

                <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + chartH} stroke="currentColor" strokeOpacity={0.1} />
                <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="currentColor" strokeOpacity={0.1} />
                <text x={12} y={H / 2} textAnchor="middle" className="fill-gray-400" fontSize="8" fontWeight="600" transform={`rotate(-90, 12, ${H / 2})`}>HEADCOUNT</text>
            </svg>

            {/* Tooltip */}
            <AnimatePresence>
                {hoveredMonth !== null && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="absolute top-2 right-4 bg-white dark:bg-[#1c2333] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl p-4 z-10 min-w-[220px]">
                        <p className="text-xs font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wider">{MONTHS[hoveredMonth]} 2026</p>
                        <div className="space-y-1">
                            {activeTrades.map(tid => {
                                const d = DEMO_DATA[tid]?.[hoveredMonth];
                                const trade = TRADES.find(t => t.id === tid);
                                if (!d || (d.planned === 0 && d.actual === 0)) return null;
                                return (
                                    <div key={tid} className="flex items-center justify-between text-[11px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: trade?.color }} />
                                            <span className="text-gray-500 dark:text-gray-400">{trade?.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {showPlanned && <span className="text-gray-400 tabular-nums">{d.planned}</span>}
                                            <span className="font-bold text-gray-800 dark:text-gray-200 tabular-nums">{d.actual}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5 flex justify-between text-xs">
                            <span className="text-gray-400">Total</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                                {monthlyStacks[hoveredMonth]?.totalActual} workers
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Donut Chart ───────────────────────────────────────────────────────────────
const DonutChart = ({ data, activeTrades }) => {
    const vals = TRADES.filter(t => activeTrades.includes(t.id)).map(trade => {
        const total = data[trade.id]?.reduce((s, d) => s + d.actual, 0) || 0;
        return { ...trade, value: total };
    }).filter(d => d.value > 0);

    const total = vals.reduce((s, d) => s + d.value, 0);
    const r = 54, cx = 70, cy = 70, strokeW = 20;
    const circ = 2 * Math.PI * r;
    let cum = 0;
    const slices = vals.map(d => { const pct = d.value / total; const dash = pct * circ; const offset = circ - cum * circ; cum += pct; return { ...d, dash, offset, pct }; });

    return (
        <div className="flex items-center gap-6">
            <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity={0.06} strokeWidth={strokeW} />
                {slices.map((s, i) => <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={strokeW} strokeDasharray={`${s.dash} ${circ - s.dash}`} strokeDashoffset={s.offset} transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />)}
                <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400" fontSize="7" fontWeight="600">TOTAL</text>
                <text x={cx} y={cy + 10} textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="12" fontWeight="800">{fmt(total)}</text>
                <text x={cx} y={cy + 22} textAnchor="middle" className="fill-gray-400" fontSize="7">man-days</text>
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
const ManpowerHistogram = ({ setExtraBreadcrumbs, onBack }) => {
    const [view, setView] = useState('histogram'); // 'histogram' | 'planning'
    const [phases, setPhases] = useState(DEFAULT_PHASES);
    const [activeTrades, setActiveTrades] = useState(TRADES.map(t => t.id));
    const [hoveredMonth, setHoveredMonth] = useState(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [showPlanned, setShowPlanned] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingPhase, setEditingPhase] = useState(null);
    const [reqDrawerOpen, setReqDrawerOpen] = useState(false);
    const [reqTargetTask, setReqTargetTask] = useState(null);
    const [importModalOpen, setImportModalOpen] = useState(false);

    // ─── URL Sync ───
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const savedView = params.get('mpView');
        if (savedView && ['histogram', 'planning'].includes(savedView)) {
            setView(savedView);
        }
    }, []);

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('mpView', view);
        window.history.replaceState({}, '', url);
    }, [view]);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Planning', onClick: onBack },
            { label: 'Manpower Histogram' }
        ]);
    }, [onBack, setExtraBreadcrumbs]);

    const toggleTrade = (id) => setActiveTrades(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

    const importProjectPlan = (importedPhases) => {
        setPhases(prev => [...prev, ...importedPhases]);
    };

    // ─── Data Calculation Engine ───────────────────────────────────────────────
    const computedData = useMemo(() => {
        const result = {};
        TRADES.forEach(t => {
            result[t.id] = MONTHS.map(m => ({ month: m, planned: 0, actual: 0 }));
        });

        phases.forEach(phase => {
            phase.tasks.forEach(task => {
                const start = toDate(task.start);
                const end = toDate(task.end);

                MONTHS.forEach((m, idx) => {
                    const monthStart = new Date(2026, idx, 1);
                    const monthEnd = new Date(2026, idx + 1, 0);

                    const overlapStart = new Date(Math.max(start, monthStart));
                    const overlapEnd = new Date(Math.min(end, monthEnd));

                    if (overlapStart <= overlapEnd) {
                        const overlapDays = (overlapEnd - overlapStart) / 86400000 + 1;
                        Object.entries(task.manpower || {}).forEach(([tid, count]) => {
                            if (result[tid]) {
                                result[tid][idx].planned += Math.round(count * overlapDays);
                            }
                        });
                    }
                });
            });
        });

        // Demo: Actual data based on plan
        TRADES.forEach(t => {
            result[t.id].forEach((m, idx) => {
                if (idx < 8) m.actual = Math.round(m.planned * (0.85 + Math.random() * 0.3));
            });
        });

        return result;
    }, [phases]);

    // KPI aggregations
    let totalPlanned = 0, totalActual = 0, totalPlannedCost = 0, totalActualCost = 0;
    TRADES.forEach(trade => {
        computedData[trade.id]?.forEach((d) => {
            totalPlanned += d.planned;
            totalActual += d.actual;
            totalPlannedCost += d.planned * trade.rate;
            totalActualCost += d.actual * trade.rate;
        });
    });
    const variancePct = totalPlannedCost > 0 ? ((totalActualCost - totalPlannedCost) / totalPlannedCost) * 100 : 0;

    const monthlyTotals = MONTHS.map((_, i) => TRADES.reduce((s, t) => s + (computedData[t.id]?.[i]?.planned || 0), 0));
    const peakVal = Math.max(...monthlyTotals, 0);
    const peakMonth = MONTHS[monthlyTotals.indexOf(peakVal)] || 'N/A';

    const tableData = TRADES.map(trade => {
        const rows = computedData[trade.id] || [];
        const planned = rows.reduce((s, d) => s + d.planned, 0);
        const actual = rows.reduce((s, d) => s + d.actual, 0);
        const varianceQty = actual - planned;
        const vPct = planned > 0 ? (varianceQty / planned) * 100 : 0;
        return { ...trade, planned, actual, varianceQty, variancePct: vPct, costPlanned: planned * trade.rate, costActual: actual * trade.rate };
    });

    const exportCSV = () => {
        const header = 'Trade,Daily Rate (₹),Planned Man-days,Actual Man-days,Variance,Var %,Cost (Planned),Cost (Actual)';
        const rows = tableData.map(d => `"${d.name}",${d.rate},${d.planned},${d.actual},${d.varianceQty},${d.variancePct.toFixed(1)}%,${d.costPlanned},${d.costActual}`);
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Manpower_Planning_Report.csv'; a.click();
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins">
            <PhaseDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} phases={phases} setPhases={setPhases} editingPhase={editingPhase} />
            <ManpowerRequirementDrawer open={reqDrawerOpen} onClose={() => setReqDrawerOpen(false)}
                tasks={phases.flatMap(p => p.tasks)}
                setTasks={(updater) => {
                    const allTasks = phases.flatMap(p => p.tasks);
                    const newAllTasks = typeof updater === 'function' ? updater(allTasks) : updater;
                    setPhases(prev => prev.map(ph => ({
                        ...ph,
                        tasks: newAllTasks.filter(t => ph.tasks.some(pt => pt.id === t.id))
                    })));
                }}
                targetTask={reqTargetTask} />

            <ProjectPlanImportModal
                open={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onImport={importProjectPlan}
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                        <Users size={16} className="text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">{view === 'histogram' ? 'Manpower Histogram' : 'Manpower Planning'}</h2>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">{view === 'histogram' ? 'Planned vs Actual Workforce Deployment • FY 2026' : 'Define and manage phase-wise manpower allocation'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl mr-2">
                        <button onClick={() => setView('histogram')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'histogram' ? 'bg-white dark:bg-[#161b22] text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <BarChart3 size={14} /> Histogram
                        </button>
                        <button onClick={() => setView('planning')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'planning' ? 'bg-white dark:bg-[#161b22] text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Calendar size={14} /> Planning
                        </button>
                    </div>

                    {view === 'histogram' ? (
                        <>
                            <button onClick={() => setShowPlanned(!showPlanned)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all ${showPlanned ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600' : 'border-gray-200 dark:border-white/10 text-gray-500'}`}>
                                {showPlanned ? 'Planned Visible' : 'Show Planned'}
                            </button>
                            <div className="relative">
                                <button onClick={() => setFilterOpen(!filterOpen)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all ${filterOpen ? 'border-blue-500 ring-2 ring-blue-500/20 text-blue-600 bg-blue-50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300'}`}>
                                    <Filter size={13} /> Trades
                                    {activeTrades.length < TRADES.length && <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[9px] font-bold">{activeTrades.length}</span>}
                                    <ChevronDown size={12} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {filterOpen && (
                                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                            className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 p-3 space-y-1">
                                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-white/5">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Filter Trades</span>
                                                <button onClick={() => setActiveTrades(activeTrades.length === TRADES.length ? [] : TRADES.map(t => t.id))}
                                                    className="text-[10px] text-blue-500 hover:text-blue-600 font-bold cursor-pointer">
                                                    {activeTrades.length === TRADES.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            {TRADES.map(trade => (
                                                <label key={trade.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                                                    <input type="checkbox" checked={activeTrades.includes(trade.id)} onChange={() => toggleTrade(trade.id)}
                                                        className="w-3.5 h-3.5 rounded accent-blue-500" />
                                                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: trade.color }} />
                                                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium flex-1">{trade.name}</span>
                                                    <span className="text-[10px] text-gray-400">₹{trade.rate}/day</span>
                                                </label>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={() => setImportModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg border border-indigo-200 dark:border-indigo-500/20 transition-all">
                                <Plus size={13} /> Import from Project Plan
                            </button>
                            <button onClick={() => { setEditingPhase(null); setDrawerOpen(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20">
                                <Plus size={13} /> Add Phase
                            </button>
                        </div>
                    )}
                    <button onClick={exportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg transition-colors">
                        <Download size={13} /> Export
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {view === 'histogram' ? (
                    <>
                        {/* KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard label="Total Man-days (Plan)" value={fmt(totalPlanned)} sub={`${TRADES.length} trades tracked`} icon={Users} color="#3b82f6" />
                            <KPICard label="Total Man-days (Actual)" value={fmt(totalActual)} sub="Estimated usage" icon={UserCheck} color="#22c55e" />
                            <KPICard label="Peak Resource Load" value={fmtCurrency(totalPlannedCost / 365)} sub={`Avg daily budget`} icon={TrendingUp} color="#f59e0b" />
                            <KPICard label="Est. Labor Cost" value={fmtCurrency(totalPlannedCost)} sub={`For ${phases.length} project phases`} icon={Clock} color="#8b5cf6" trend={variancePct} />
                        </div>

                        {/* Chart */}
                        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Monthly Resource Distribution</h3>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Stacked bars = headcount requirement • Cumulative S-curve tracking</p>
                                </div>
                                <div className="flex items-center gap-4 text-[10px]">
                                    {showPlanned && <div className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-blue-500 opacity-50" /><span className="text-gray-500 font-medium">Planned</span></div>}
                                    <div className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-indigo-500 opacity-75" /><span className="text-gray-500 font-medium">Actual</span></div>
                                    <div className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-blue-400" /><span className="text-gray-500 font-medium">Cum. Plan</span></div>
                                </div>
                            </div>
                            <div className="p-4">
                                <StackedBarChart data={computedData} activeTrades={activeTrades} hoveredMonth={hoveredMonth} setHoveredMonth={setHoveredMonth} showPlanned={showPlanned} />
                            </div>
                        </div>

                        {/* Bottom: Table + Donut */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="xl:col-span-2 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Trade-wise Resource Budget</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 dark:bg-white/[0.02]">
                                            <tr>
                                                <th className="px-4 py-2.5 text-left text-gray-500 uppercase font-bold tracking-wider">Trade</th>
                                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Rate/Day</th>
                                                <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold tracking-wider">Planned</th>
                                                <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold tracking-wider">Actual</th>
                                                <th className="px-3 py-2.5 text-right text-gray-500 uppercase font-bold tracking-wider">Cost (Plan)</th>
                                                <th className="px-4 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                            {tableData.map(d => (
                                                <tr key={d.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                                            <span>{d.icon}</span><span>{d.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-center text-gray-500 tabular-nums">₹{d.rate}</td>
                                                    <td className="px-3 py-3 text-right font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{fmt(d.planned)}</td>
                                                    <td className="px-3 py-3 text-right font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{fmt(d.actual)}</td>
                                                    <td className="px-3 py-3 text-right font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{fmtCurrency(d.costPlanned)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {d.planned > 0 ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-500"><CheckCircle2 size={11} /> OK</span> : <span className="text-[10px] font-bold text-gray-400">No Allocation</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-100 dark:bg-white/5 border-t-2 border-gray-300 dark:border-white/10">
                                            <tr>
                                                <td className="px-4 py-3 font-black text-gray-800 dark:text-white uppercase" colSpan={2}>Grand Total</td>
                                                <td className="px-3 py-3 text-right font-black text-blue-600 dark:text-blue-400 tabular-nums">{fmt(totalPlanned)}</td>
                                                <td className="px-3 py-3 text-right font-black text-green-600 dark:text-green-400 tabular-nums">{fmt(totalActual)}</td>
                                                <td className="px-3 py-3 text-right font-black text-gray-800 dark:text-gray-200 tabular-nums">{fmtCurrency(totalPlannedCost)}</td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-5">Resource Composition</h3>
                                <DonutChart data={computedData} activeTrades={activeTrades} />
                                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/5 text-[11px] space-y-2">
                                    <div className="flex justify-between text-gray-500"><span className="flex items-center gap-1.5"><Sparkles size={12} /> Optimization Tip</span></div>
                                    <p className="text-gray-400 leading-relaxed font-medium italic">Based on your plan, consider cross-training Helpers for Masonry peak to reduce dependency on external hires.</p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Planning View */
                    <div className="space-y-6 w-full">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white">Manpower Resource Plan</h3>
                                <p className="text-xs text-gray-500">Define trade requirements for each project activity</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {phases.map(phase => (
                                <div key={phase.id} className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                                    <div className="px-5 py-4 bg-gray-50/50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: phase.color + '15' }}>{phase.icon}</div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{phase.name}</h4>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{phase.tasks.length} Tasks</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => { setEditingPhase(phase.id); setDrawerOpen(true); }}
                                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-blue-500 transition-colors"><Edit2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-gray-50 dark:divide-white/5">
                                        {phase.tasks.length === 0 && <div className="px-6 py-8 text-center text-gray-400 text-xs italic">No tasks added to this phase.</div>}
                                        {phase.tasks.map(task => {
                                            const totalHC = Object.values(task.manpower || {}).reduce((s, v) => s + v, 0);
                                            const duration = daysBetween(task.start, task.end) || 1;
                                            const totalManDays = totalHC * duration;

                                            return (
                                                <div key={task.id} className="px-6 py-4 flex items-center gap-8 hover:bg-gray-50/30 dark:hover:bg-white/[0.01] transition-colors group border-b last:border-0 border-gray-50 dark:border-white/5">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-500 transition-colors uppercase tracking-wide">{task.name || '(Untitled Task)'}</p>
                                                        <div className="flex items-center gap-4 mt-1.5">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                                                                <Calendar size={12} className="text-gray-300" /> {fmt(task.start)} — {fmt(task.end)}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                                                                <Clock size={12} className="text-gray-300" /> {duration} Days
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="hidden sm:flex items-center gap-6">
                                                        <div className="text-center">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Duration</p>
                                                            <p className="text-xs font-black text-gray-700 dark:text-gray-300">{duration}d</p>
                                                        </div>
                                                        <div className="h-6 w-px bg-gray-100 dark:bg-white/5" />
                                                        <div className="text-center">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total Load</p>
                                                            <p className="text-xs font-black text-indigo-500 tabular-nums">{fmt(totalManDays)} <span className="text-[9px] font-medium opacity-60">man-days</span></p>
                                                        </div>
                                                    </div>

                                                    <div className="flex -space-x-1.5 overflow-hidden">
                                                        {Object.entries(task.manpower || {}).filter(([_, count]) => count > 0).slice(0, 5).map(([tid, count]) => {
                                                            const trade = TRADES.find(t => t.id === tid);
                                                            return (
                                                                <div key={tid} className="w-8 h-8 rounded-xl border-2 border-white dark:border-[#161b22] flex items-center justify-center text-xs shadow-sm bg-white dark:bg-[#0d1117] relative group/trade"
                                                                    style={{ color: trade?.color }}>
                                                                    {trade?.icon}
                                                                    <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 bg-blue-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white dark:border-[#161b22]">
                                                                        {count}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {Object.entries(task.manpower || {}).filter(([_, count]) => count > 0).length > 5 && (
                                                            <div className="w-8 h-8 rounded-xl border-2 border-white dark:border-[#161b22] bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                                +{Object.entries(task.manpower || {}).filter(([_, count]) => count > 0).length - 5}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="text-right w-24">
                                                        <p className="text-lg font-black text-gray-900 dark:text-white leading-none">{totalHC}</p>
                                                        <p className="text-[9px] text-gray-400 uppercase font-black tracking-tighter mt-1">Workers Req.</p>
                                                    </div>

                                                    <button onClick={() => { setReqTargetTask(task.id); setReqDrawerOpen(true); }}
                                                        className="px-5 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-blue-500 hover:text-white text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-indigo-200 dark:border-indigo-500/20 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/25">
                                                        <Sparkles size={14} className="group-hover:animate-pulse" /> Allocate Resources <ChevronRight size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManpowerHistogram;
