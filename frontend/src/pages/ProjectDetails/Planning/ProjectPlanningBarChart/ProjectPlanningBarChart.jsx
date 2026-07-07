import React, { useState, useEffect, useMemo } from 'react';
import { Download, ChevronDown, ChevronRight, BarChart3, TrendingUp, Clock, AlertTriangle, CheckCircle2, Diamond, Eye, EyeOff, Plus, X, Trash2, Edit2, Save, Sparkles, GripVertical } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { DetailPanel, AISummaryPanel } from './DetailPanel';

// ─── Data ──────────────────────────────────────────────────────────────────────
export const DEFAULT_PHASES = [
    {
        id: 'pre-con', name: 'Pre-Construction', color: '#6366f1', icon: '📋', activities: [
            { id: 'a1', name: 'Design Approval', start: '2026-01-05', end: '2026-01-25', origStart: '2026-01-05', origEnd: '2026-01-20', progress: 100, critical: true },
            { id: 'a2', name: 'Building Permits', start: '2026-01-20', end: '2026-02-28', origStart: '2026-01-20', origEnd: '2026-02-15', progress: 100, critical: true },
            { id: 'a3', name: 'Site Survey & Soil Test', start: '2026-02-01', end: '2026-02-20', origStart: '2026-02-01', origEnd: '2026-02-18', progress: 100, critical: false },
            { id: 'a4', name: 'Mobilization', start: '2026-02-25', end: '2026-03-10', origStart: '2026-02-20', origEnd: '2026-03-05', progress: 100, critical: false },
        ]
    },
    {
        id: 'foundation', name: 'Site Work & Foundation', color: '#f59e0b', icon: '🏗️', activities: [
            { id: 'b1', name: 'Excavation', start: '2026-03-10', end: '2026-03-28', origStart: '2026-03-05', origEnd: '2026-03-22', progress: 100, critical: true },
            { id: 'b2', name: 'PCC & Waterproofing', start: '2026-03-28', end: '2026-04-12', origStart: '2026-03-22', origEnd: '2026-04-05', progress: 100, critical: true },
            { id: 'b3', name: 'Footing & Raft', start: '2026-04-12', end: '2026-05-05', origStart: '2026-04-05', origEnd: '2026-04-28', progress: 100, critical: true },
            { id: 'b4', name: 'Plinth Beam', start: '2026-05-05', end: '2026-05-22', origStart: '2026-04-28', origEnd: '2026-05-15', progress: 100, critical: false },
            { id: 'b5', name: 'Backfilling & Compaction', start: '2026-05-20', end: '2026-06-05', origStart: '2026-05-12', origEnd: '2026-05-28', progress: 100, critical: false },
        ]
    },
    {
        id: 'structural', name: 'Structural', color: '#ef4444', icon: '🔩', activities: [
            { id: 'c1', name: 'Column Casting (GF–2F)', start: '2026-06-01', end: '2026-06-28', origStart: '2026-05-25', origEnd: '2026-06-20', progress: 100, critical: true },
            { id: 'c2', name: 'Slab – Ground Floor', start: '2026-06-28', end: '2026-07-18', origStart: '2026-06-20', origEnd: '2026-07-10', progress: 90, critical: true },
            { id: 'c3', name: 'Slab – First Floor', start: '2026-07-18', end: '2026-08-08', origStart: '2026-07-10', origEnd: '2026-08-01', progress: 70, critical: true },
            { id: 'c4', name: 'Slab – Second Floor', start: '2026-08-08', end: '2026-08-30', origStart: '2026-08-01', origEnd: '2026-08-22', progress: 20, critical: true },
            { id: 'c5', name: 'Staircase & Parapet', start: '2026-08-25', end: '2026-09-15', origStart: '2026-08-18', origEnd: '2026-09-08', progress: 0, critical: false },
        ]
    },
    {
        id: 'mep', name: 'MEP Rough-in', color: '#06b6d4', icon: '⚡', activities: [
            { id: 'd1', name: 'Electrical Conduit & Wiring', start: '2026-08-01', end: '2026-09-15', origStart: '2026-07-25', origEnd: '2026-09-05', progress: 40, critical: false },
            { id: 'd2', name: 'Plumbing Lines', start: '2026-08-10', end: '2026-09-20', origStart: '2026-08-01', origEnd: '2026-09-10', progress: 30, critical: false },
            { id: 'd3', name: 'HVAC Ducting', start: '2026-09-01', end: '2026-10-10', origStart: '2026-08-25', origEnd: '2026-10-01', progress: 0, critical: false },
            { id: 'd4', name: 'Fire Protection System', start: '2026-09-15', end: '2026-10-20', origStart: '2026-09-05', origEnd: '2026-10-10', progress: 0, critical: false },
        ]
    },
    {
        id: 'masonry', name: 'Masonry & Plastering', color: '#8b5cf6', icon: '🧱', activities: [
            { id: 'e1', name: 'AAC Blockwork', start: '2026-09-10', end: '2026-10-25', origStart: '2026-09-01', origEnd: '2026-10-15', progress: 0, critical: true },
            { id: 'e2', name: 'Internal Plaster', start: '2026-10-20', end: '2026-11-20', origStart: '2026-10-10', origEnd: '2026-11-10', progress: 0, critical: false },
            { id: 'e3', name: 'External Plaster', start: '2026-11-01', end: '2026-11-30', origStart: '2026-10-22', origEnd: '2026-11-20', progress: 0, critical: false },
            { id: 'e4', name: 'Waterproofing (Terrace)', start: '2026-11-15', end: '2026-12-05', origStart: '2026-11-05', origEnd: '2026-11-25', progress: 0, critical: false },
        ]
    },
    {
        id: 'finishing', name: 'Finishing', color: '#22c55e', icon: '🎨', activities: [
            { id: 'f1', name: 'Floor Tiling', start: '2026-11-25', end: '2027-01-05', origStart: '2026-11-15', origEnd: '2026-12-25', progress: 0, critical: false },
            { id: 'f2', name: 'Painting (Int + Ext)', start: '2026-12-15', end: '2027-01-20', origStart: '2026-12-05', origEnd: '2027-01-10', progress: 0, critical: false },
            { id: 'f3', name: 'Doors, Windows & Grilles', start: '2027-01-05', end: '2027-01-25', origStart: '2026-12-25', origEnd: '2027-01-15', progress: 0, critical: false },
            { id: 'f4', name: 'Sanitary & CP Fittings', start: '2027-01-15', end: '2027-02-05', origStart: '2027-01-05', origEnd: '2027-01-25', progress: 0, critical: false },
            { id: 'f5', name: 'Electrical Fixtures', start: '2027-01-20', end: '2027-02-10', origStart: '2027-01-10', origEnd: '2027-02-01', progress: 0, critical: false },
        ]
    },
    {
        id: 'handover', name: 'Handover', color: '#14b8a6', icon: '🏁', activities: [
            { id: 'g1', name: 'Punch List & Snag Fix', start: '2027-02-10', end: '2027-02-25', origStart: '2027-02-01', origEnd: '2027-02-15', progress: 0, critical: true },
            { id: 'g2', name: 'Final Inspection', start: '2027-02-25', end: '2027-03-05', origStart: '2027-02-15', origEnd: '2027-02-25', progress: 0, critical: true, milestone: true },
            { id: 'g3', name: 'Documentation & As-built', start: '2027-02-20', end: '2027-03-08', origStart: '2027-02-10', origEnd: '2027-02-28', progress: 0, critical: false },
            { id: 'g4', name: 'Client Handover', start: '2027-03-08', end: '2027-03-15', origStart: '2027-02-28', origEnd: '2027-03-10', progress: 0, critical: true, milestone: true },
        ]
    },
];

const PHASE_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#22c55e', '#14b8a6', '#ec4899', '#f97316', '#64748b'];
const PHASE_ICONS = ['📋', '🏗️', '🔩', '⚡', '🧱', '🎨', '🏁', '📐', '🚧', '🔧'];
const toDate = (s) => new Date(s);
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const fmt = (d) => toDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
let _c = Date.now(); const uid = () => `id_${_c++}`;

const KPICard = ({ label, value, sub, icon: Icon, color }) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5 hover:shadow-lg transition-all duration-500">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: color + '15' }}><Icon size={18} style={{ color }} /></div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </motion.div>
);

// ─── Phase Drawer ──────────────────────────────────────────────────────────────
const PhaseDrawer = ({ open, onClose, phases, setPhases, editingPhase }) => {
    const isEdit = !!editingPhase;
    const existing = isEdit ? phases.find(p => p.id === editingPhase) : null;
    const [name, setName] = useState(''); const [color, setColor] = useState(PHASE_COLORS[0]);
    const [icon, setIcon] = useState(PHASE_ICONS[0]); const [activities, setActivities] = useState([]);

    useEffect(() => {
        if (isEdit && existing) { setName(existing.name); setColor(existing.color); setIcon(existing.icon); setActivities(existing.activities.map(a => ({ ...a }))); }
        else { setName(''); setColor(PHASE_COLORS[phases.length % PHASE_COLORS.length]); setIcon(PHASE_ICONS[phases.length % PHASE_ICONS.length]); setActivities([]); }
    }, [open, editingPhase]);

    const addAct = () => { const t = new Date().toISOString().split('T')[0]; const n = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]; setActivities(p => [...p, { id: uid(), name: '', start: t, end: n, origStart: t, origEnd: n, progress: 0, critical: false, milestone: false }]); };
    const updAct = (i, f, v) => setActivities(p => p.map((a, j) => j === i ? { ...a, [f]: f === 'progress' ? Math.min(100, Math.max(0, Number(v))) : f === 'critical' || f === 'milestone' ? !a[f] : v } : a));
    const rmAct = (i) => setActivities(p => p.filter((_, j) => j !== i));
    const save = () => { if (!name.trim()) return; if (isEdit) setPhases(p => p.map(ph => ph.id === editingPhase ? { ...ph, name, color, icon, activities } : ph)); else setPhases(p => [...p, { id: uid(), name, color, icon, activities }]); onClose(); };
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
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Foundation Work"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-blue-500" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 block">Color</label>
                                <div className="flex flex-wrap gap-1.5">{PHASE_COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#161b22] scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />)}</div></div>
                            <div><label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 block">Icon</label>
                                <div className="flex flex-wrap gap-1.5">{PHASE_ICONS.map(ic => <button key={ic} onClick={() => setIcon(ic)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${icon === ic ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}>{ic}</button>)}</div></div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between"><h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tasks ({activities.length})</h3>
                            <button onClick={addAct} className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-600"><Plus size={12} /> Add Task</button></div>
                        {activities.length === 0 && <div className="text-center py-8 text-gray-400"><p className="text-xs">No tasks yet. Click "Add Task" to get started.</p></div>}
                        {activities.map((act, idx) => (
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
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] text-gray-500 mb-0.5 block">Original Start</label><input type="date" value={act.origStart} onChange={e => updAct(idx, 'origStart', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500" /></div>
                                    <div><label className="text-[10px] text-gray-500 mb-0.5 block">Original End</label><input type="date" value={act.origEnd} onChange={e => updAct(idx, 'origEnd', e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500" /></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1"><label className="text-[10px] text-gray-500 mb-0.5 block">Progress (%)</label>
                                        <input type="number" min={0} max={100} value={act.progress} onChange={e => updAct(idx, 'progress', e.target.value)}
                                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500" /></div>
                                    <label className="flex items-center gap-1.5 cursor-pointer pt-4"><input type="checkbox" checked={act.critical} onChange={() => updAct(idx, 'critical')} className="w-3.5 h-3.5 rounded accent-red-500" /><span className="text-[10px] font-semibold text-gray-500">High Priority</span></label>
                                    <label className="flex items-center gap-1.5 cursor-pointer pt-4"><input type="checkbox" checked={act.milestone || false} onChange={() => updAct(idx, 'milestone')} className="w-3.5 h-3.5 rounded accent-amber-500" /><span className="text-[10px] font-semibold text-gray-500">Key Deliverable</span></label>
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

// ─── Main Component ────────────────────────────────────────────────────────────
const ProjectPlanningBarChart = ({ setExtraBreadcrumbs, onBack, canWrite }) => {
    const [phases, setPhases] = useState(DEFAULT_PHASES);
    const [expandedPhases, setExpandedPhases] = useState(Object.fromEntries(DEFAULT_PHASES.map(p => [p.id, true])));
    const [showOrigPlan, setShowOrigPlan] = useState(true);
    const [hoveredActivity, setHoveredActivity] = useState(null);
    const [phaseFilter, setPhaseFilter] = useState('all');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingPhase, setEditingPhase] = useState(null);
    const [detailType, setDetailType] = useState(null); // 'phase' | 'task'
    const [detailPhase, setDetailPhase] = useState(null);
    const [detailActivity, setDetailActivity] = useState(null);
    const [aiPanel, setAiPanel] = useState(null); // { title, phases } or null

    useEffect(() => { setExtraBreadcrumbs([{ label: 'Planning', onClick: onBack }, { label: 'Project Planning & Bar Chart' }]); }, [onBack, setExtraBreadcrumbs]);
    useEffect(() => { setExpandedPhases(prev => { const n = { ...prev }; phases.forEach(p => { if (n[p.id] === undefined) n[p.id] = true; }); return n; }); }, [phases]);

    const togglePhase = (id) => setExpandedPhases(prev => ({ ...prev, [id]: !prev[id] }));
    const openAddDrawer = () => { if (!canWrite) return; setEditingPhase(null); setDrawerOpen(true); };
    const openEditDrawer = (id) => { if (!canWrite) return; setEditingPhase(id); setDrawerOpen(true); };
    const showPhaseDetail = (phase) => { setAiPanel(null); setDetailType('phase'); setDetailPhase(phase); setDetailActivity(null); };
    const showTaskDetail = (phase, act) => { setAiPanel(null); setDetailType('task'); setDetailPhase(phase); setDetailActivity(act); };
    const closeDetail = () => { setDetailType(null); setDetailPhase(null); setDetailActivity(null); setAiPanel(null); };
    const showAiPanel = (title, phs, macroFlag = false) => { setDetailType(null); setDetailPhase(null); setDetailActivity(null); setAiPanel({ title, phases: phs, macro: macroFlag }); };

    const allActivities = phases.flatMap(p => p.activities);
    const allDates = allActivities.flatMap(a => [a.start, a.end, a.origStart, a.origEnd]);
    const projectStart = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => toDate(d).getTime()))) : new Date('2026-01-01');
    const projectEnd = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => toDate(d).getTime()))) : new Date('2027-01-01');
    const TODAY = new Date('2026-08-15');
    const totalDays = Math.max(daysBetween(projectStart.toISOString().split('T')[0], projectEnd.toISOString().split('T')[0]), 30);
    const dayOffset = (d) => Math.round((toDate(d) - projectStart) / 86400000);
    const todayOffset = Math.round((TODAY - projectStart) / 86400000);

    const monthLabels = useMemo(() => {
        const labels = []; const d = new Date(projectStart); d.setDate(1);
        while (d <= projectEnd) { const off = Math.max(0, dayOffset(d.toISOString().split('T')[0])); const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); labels.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), offset: off, width: dim }); d.setMonth(d.getMonth() + 1); }
        return labels;
    }, [projectStart, projectEnd]);

    const totalActs = allActivities.length;
    const completedActs = allActivities.filter(a => a.progress === 100).length;
    const overallProgress = totalActs > 0 ? Math.round(allActivities.reduce((s, a) => s + a.progress, 0) / totalActs) : 0;
    const behindSchedule = allActivities.filter(a => toDate(a.end) > toDate(a.origEnd) && a.progress < 100).length;
    const daysToCompletion = daysBetween(TODAY.toISOString().split('T')[0], projectEnd.toISOString().split('T')[0]);

    const filteredPhases = phaseFilter === 'all' ? phases : phases.filter(p => p.id === phaseFilter);

    const rows = useMemo(() => {
        const list = [];
        filteredPhases.forEach(phase => { list.push({ type: 'phase', phase }); if (expandedPhases[phase.id] && phase.activities.length > 0) phase.activities.forEach(act => list.push({ type: 'activity', activity: act, phase })); });
        return list;
    }, [filteredPhases, expandedPhases]);

    const PX = 3.2; const chartWidth = totalDays * PX; const ROW_H = 36; const PHASE_H = 34;

    const exportCSV = () => {
        const h = 'Phase,Activity,Start,End,Original Start,Original End,Progress %,High Priority';
        const r = phases.flatMap(p => p.activities.map(a => `"${p.name}","${a.name}",${a.start},${a.end},${a.origStart},${a.origEnd},${a.progress},${a.critical ? 'Yes' : 'No'}`));
        const b = new Blob([[h, ...r].join('\n')], { type: 'text/csv' }); const el = document.createElement('a'); el.href = URL.createObjectURL(b); el.download = 'Project_Planning_Schedule.csv'; el.click();
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins">
            <PhaseDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} phases={phases} setPhases={setPhases} editingPhase={editingPhase} />

            {/* Toolbar — no back button */}
            <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center"><BarChart3 size={16} className="text-indigo-500" /></div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Project Planning & Bar Chart</h2>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">{totalActs} Tasks • {phases.length} Phases</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => showAiPanel('AI Project Summary', phases, true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-xs font-bold rounded-lg transition-colors">
                        <Sparkles size={13} /> AI Summary
                    </button>
                    {canWrite && (
                        <button onClick={openAddDrawer} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20">
                            <Plus size={13} /> Add Phase
                        </button>
                    )}
                    <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)} className="text-xs font-semibold px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500">
                        <option value="all">All Phases</option>{phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={() => setShowOrigPlan(!showOrigPlan)} className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all ${showOrigPlan ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-white/10 text-gray-500'}`}>
                        {showOrigPlan ? <Eye size={13} /> : <EyeOff size={13} />} Original Plan</button>
                    <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg"><Download size={13} /> Export</button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 pb-4">
                        <KPICard label="Overall Progress" value={`${overallProgress}%`} sub={`${completedActs}/${totalActs} tasks complete`} icon={TrendingUp} color="#3b82f6" />
                        <KPICard label="On Schedule" value={`${totalActs - behindSchedule}/${totalActs}`} sub="Tasks on or ahead of plan" icon={CheckCircle2} color="#22c55e" />
                        <KPICard label="Behind Schedule" value={behindSchedule} sub="Tasks past original end date" icon={AlertTriangle} color="#ef4444" />
                        <KPICard label="Days to Completion" value={daysToCompletion} sub={`Target: ${projectEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`} icon={Clock} color="#8b5cf6" />
                    </div>

                    {/* Gantt */}
                    <div className="mx-6 mb-6 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Construction Schedule – Gantt View</h3>
                            <div className="flex items-center gap-4 text-[10px]">
                                <div className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-blue-500" /><span className="text-gray-500">Current</span></div>
                                <div className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-green-500" /><span className="text-gray-500">Progress</span></div>
                                {showOrigPlan && <div className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-gray-400" /><span className="text-gray-500">Original Plan</span></div>}
                                <div className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-400" /><span className="text-gray-500">High Priority</span></div>
                                <div className="flex items-center gap-1.5"><span className="text-amber-500 text-sm">◆</span><span className="text-gray-500">Key Deliverable</span></div>
                            </div>
                        </div>

                        <div className="flex overflow-x-auto custom-scrollbar">
                            {/* Left Panel */}
                            <div className="w-[300px] min-w-[300px] border-r border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#0d1117]/50">
                                <div className="h-[42px] px-4 flex items-center border-b border-gray-200 dark:border-white/10 bg-gray-100/80 dark:bg-white/[0.03]">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">WBS / Task</span>
                                </div>
                                <Reorder.Group axis="y" values={phases} onReorder={canWrite ? setPhases : () => {}}>
                                    {rows.map((row) => {
                                        if (row.type === 'phase') {
                                            const p = row.phase;
                                            const pp = p.activities.length > 0 ? Math.round(p.activities.reduce((s, a) => s + a.progress, 0) / p.activities.length) : 0;
                                            return (
                                                <Reorder.Item key={p.id} value={p} dragListener={false}>
                                                    <div className="flex items-center gap-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5" style={{ height: PHASE_H }}>
                                                        <GripVertical size={11} className={`text-gray-300 dark:text-gray-600 shrink-0 ${canWrite ? 'cursor-grab' : 'pointer-events-none opacity-40'}`} style={{ cursor: canWrite ? 'grab' : undefined }}
                                                            onPointerDown={(e) => { if (canWrite) e.currentTarget.parentElement.parentElement.style.cursor = 'grabbing'; }}
                                                            onPointerUp={(e) => { if (e.currentTarget.parentElement?.parentElement) e.currentTarget.parentElement.parentElement.style.cursor = ''; }} />
                                                        <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={() => togglePhase(p.id)}>
                                                            {expandedPhases[p.id] ? <ChevronDown size={12} style={{ color: p.color }} /> : <ChevronRight size={12} className="text-gray-400" />}
                                                            <span className="text-xs">{p.icon}</span>
                                                            <span className="text-[11px] font-bold truncate flex-1" style={{ color: expandedPhases[p.id] ? p.color : undefined }}>{p.name}</span>
                                                        </div>
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: p.color + '20', color: p.color }}>{pp}%</span>
                                                        <button onClick={(e) => { e.stopPropagation(); showAiPanel(`AI: ${p.name}`, [p]); }}
                                                            className="p-0.5 rounded hover:bg-violet-50 dark:hover:bg-violet-900/20 text-gray-400 hover:text-violet-500 shrink-0"><Sparkles size={11} /></button>
                                                        {canWrite && (
                                                            <button onClick={(e) => { e.stopPropagation(); openEditDrawer(p.id); }}
                                                                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 hover:text-blue-500 shrink-0"><Edit2 size={11} /></button>
                                                        )}
                                                    </div>
                                                </Reorder.Item>
                                            );
                                        }
                                        const a = row.activity;
                                        return (
                                            <div key={a.id}
                                                className={`flex items-center gap-2 px-4 pl-9 border-b border-gray-50 dark:border-white/[0.03] transition-colors cursor-pointer ${hoveredActivity === a.id ? 'bg-blue-50/50 dark:bg-blue-500/5' : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'}`}
                                                style={{ height: ROW_H }}
                                                onMouseEnter={() => setHoveredActivity(a.id)} onMouseLeave={() => setHoveredActivity(null)}
                                                onClick={() => showTaskDetail(row.phase, a)}>
                                                {a.critical && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" title="High Priority" />}
                                                {a.milestone && <Diamond size={10} className="text-amber-500 shrink-0" title="Key Deliverable" />}
                                                <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate flex-1">{a.name || '(untitled)'}</span>
                                                <span className="text-[9px] font-semibold text-gray-400 tabular-nums w-8 text-right">{a.progress}%</span>
                                            </div>
                                        );
                                    })}
                                </Reorder.Group>
                            </div>

                            {/* Right Panel - Chart (no phase bars) */}
                            <div className="flex-1 overflow-x-auto">
                                <div style={{ width: chartWidth, minWidth: '100%' }}>
                                    <div className="h-[42px] flex items-end border-b border-gray-200 dark:border-white/10 bg-gray-100/80 dark:bg-white/[0.03] relative">
                                        {monthLabels.map((m, i) => <div key={i} className="text-[9px] font-bold text-gray-400 uppercase tracking-wider border-l border-gray-200/60 dark:border-white/5 px-1.5 pb-1.5 flex items-end" style={{ width: m.width * PX, minWidth: 0 }}>{m.label}</div>)}
                                    </div>
                                    {rows.map((row) => {
                                        if (row.type === 'phase') {
                                            return (
                                                <div key={row.phase.id} className="relative border-b border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                                                    style={{ height: PHASE_H }} onClick={() => showPhaseDetail(row.phase)}>
                                                    <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: todayOffset * PX, borderLeft: '2px dashed #ef4444' }} />
                                                </div>
                                            );
                                        }
                                        const a = row.activity; const p = row.phase;
                                        const aS = dayOffset(a.start); const aD = Math.max(daysBetween(a.start, a.end), 1);
                                        const oS = dayOffset(a.origStart); const oD = Math.max(daysBetween(a.origStart, a.origEnd), 1);
                                        const pW = aD * PX * (a.progress / 100); const hov = hoveredActivity === a.id;
                                        return (
                                            <div key={a.id} className={`relative border-b border-gray-50 dark:border-white/[0.03] cursor-pointer ${hov ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''}`}
                                                style={{ height: ROW_H }} onMouseEnter={() => setHoveredActivity(a.id)} onMouseLeave={() => setHoveredActivity(null)}
                                                onClick={() => showTaskDetail(p, a)}>
                                                {showOrigPlan && <div className="absolute top-1/2 rounded-sm border border-dashed border-gray-400 dark:border-gray-600" style={{ left: oS * PX, width: oD * PX, height: 10, marginTop: -13 }} />}
                                                <div className="absolute top-1/2 -translate-y-1/2 rounded-[3px] transition-all duration-200" style={{ left: aS * PX, width: aD * PX, height: a.milestone ? 0 : 14, backgroundColor: a.critical ? '#f87171' : p.color, opacity: hov ? 0.9 : 0.35 }} />
                                                {a.progress > 0 && !a.milestone && <div className="absolute top-1/2 -translate-y-1/2 rounded-[3px]" style={{ left: aS * PX, width: pW, height: 14, backgroundColor: '#22c55e', opacity: hov ? 0.95 : 0.7 }} />}
                                                {a.milestone && <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: aS * PX }}><Diamond size={14} className="text-amber-500 fill-amber-500" /></div>}
                                                {hov && !a.milestone && <div className="absolute top-1/2 -translate-y-1/2 text-[8px] font-bold text-white z-10 pointer-events-none" style={{ left: aS * PX + 4 }}>{a.progress}%</div>}
                                                <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: todayOffset * PX, borderLeft: '2px dashed #ef4444' }} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Phase Summary */}
                    <div className="mx-6 mb-6 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5"><h3 className="text-sm font-bold text-gray-800 dark:text-white">Phase Summary</h3></div>
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-white/[0.02]"><tr>
                                <th className="px-4 py-2.5 text-left text-gray-500 uppercase font-bold tracking-wider">Phase</th>
                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Tasks</th>
                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Start</th>
                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">End</th>
                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Duration</th>
                                <th className="px-4 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider w-48">Progress</th>
                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Status</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {phases.map(p => {
                                    if (p.activities.length === 0) return (<tr key={p.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5"><td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300"><div className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} /><span>{p.icon}</span><span>{p.name}</span></div></td><td className="px-3 py-3 text-center text-gray-400" colSpan={6}>No tasks</td></tr>);
                                    const pr = Math.round(p.activities.reduce((s, a) => s + a.progress, 0) / p.activities.length);
                                    const ps = p.activities.reduce((m, a) => a.start < m ? a.start : m, p.activities[0].start);
                                    const pe = p.activities.reduce((m, a) => a.end > m ? a.end : m, p.activities[0].end);
                                    return (
                                        <tr key={p.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5 cursor-pointer" onClick={() => showPhaseDetail(p)}>
                                            <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300"><div className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} /><span>{p.icon}</span><span>{p.name}</span></div></td>
                                            <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400 font-semibold">{p.activities.length}</td>
                                            <td className="px-3 py-3 text-center text-gray-500 tabular-nums">{fmt(ps)}</td>
                                            <td className="px-3 py-3 text-center text-gray-500 tabular-nums">{fmt(pe)}</td>
                                            <td className="px-3 py-3 text-center text-gray-500">{daysBetween(ps, pe)} days</td>
                                            <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pr}%`, backgroundColor: p.color }} /></div><span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color: p.color }}>{pr}%</span></div></td>
                                            <td className="px-3 py-3 text-center">{pr === 100 ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-500"><CheckCircle2 size={11} /> Done</span> : pr > 0 ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500"><TrendingUp size={11} /> Active</span> : <span className="text-[10px] font-bold text-gray-400">Upcoming</span>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail Panel (right side) */}
                <AnimatePresence>
                    {detailType && <DetailPanel type={detailType} phase={detailPhase} activity={detailActivity} onClose={closeDetail} showAiPanel={showAiPanel} />}
                    {aiPanel && <AISummaryPanel title={aiPanel.title} phases={aiPanel.phases} macro={aiPanel.macro} onClose={closeDetail} />}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ProjectPlanningBarChart;
