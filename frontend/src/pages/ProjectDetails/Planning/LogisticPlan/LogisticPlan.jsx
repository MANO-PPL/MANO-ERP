import React, { useState, useEffect } from 'react';
import {
    Download, Filter, Truck, Package, Clock, CheckCircle2,
    AlertTriangle, ChevronDown, TrendingUp, MapPin, Box,
    Plus, Edit2, Trash2, Sparkles, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeliveryPanel, EquipmentPanel, LogisticAIPanel } from './DetailPanel';

// ─── Constants ─────────────────────────────────────────────────────────────────
const STATUSES = {
    delivered: { label: 'Delivered', color: '#22c55e', bg: 'bg-green-50 dark:bg-green-900/20 text-green-600' },
    intransit: { label: 'In Transit', color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' },
    pending: { label: 'Pending', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' },
    delayed: { label: 'Delayed', color: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20 text-red-600' },
};

const VENDORS = [
    { id: 'v1', name: 'UltraTech Cement Ltd', city: 'Mumbai' },
    { id: 'v2', name: 'Tata Steel BSL', city: 'Jamshedpur' },
    { id: 'v3', name: 'RMC Readymix India', city: 'Chennai' },
    { id: 'v4', name: 'Dalmia Bharat Ltd', city: 'Delhi' },
    { id: 'v5', name: 'JSW Steel', city: 'Bellary' },
    { id: 'v6', name: 'ACC Limited', city: 'Pune' },
];

const INIT_DELIVERIES = [
    { id: 'd1', material: 'OPC 53 Cement', vendor: 'v1', po: 'PO-2026-001', qty: '120 MT', expected: '2026-03-15', actual: '2026-03-14', status: 'delivered' },
    { id: 'd2', material: 'TMT Steel 12mm', vendor: 'v2', po: 'PO-2026-002', qty: '45 MT', expected: '2026-03-20', actual: '2026-03-22', status: 'delivered' },
    { id: 'd3', material: 'M30 RMC', vendor: 'v3', po: 'PO-2026-003', qty: '200 Cu.m', expected: '2026-04-05', actual: '2026-04-05', status: 'delivered' },
    { id: 'd4', material: 'AAC Blocks 600x200', vendor: 'v4', po: 'PO-2026-004', qty: '15,000 Nos', expected: '2026-05-10', actual: '2026-05-15', status: 'delivered' },
    { id: 'd5', material: 'OPC 53 Cement', vendor: 'v1', po: 'PO-2026-005', qty: '80 MT', expected: '2026-06-01', actual: '2026-06-01', status: 'delivered' },
    { id: 'd6', material: 'TMT Steel 16mm', vendor: 'v5', po: 'PO-2026-006', qty: '30 MT', expected: '2026-06-15', actual: '2026-06-18', status: 'delivered' },
    { id: 'd7', material: 'River Sand', vendor: 'v6', po: 'PO-2026-007', qty: '150 Cu.m', expected: '2026-07-01', actual: '2026-07-01', status: 'delivered' },
    { id: 'd8', material: 'M25 RMC', vendor: 'v3', po: 'PO-2026-008', qty: '180 Cu.m', expected: '2026-07-20', actual: '2026-07-23', status: 'delivered' },
    { id: 'd9', material: 'Electrical Conduits', vendor: 'v4', po: 'PO-2026-009', qty: '2,500 m', expected: '2026-08-05', actual: null, status: 'intransit' },
    { id: 'd10', material: 'CPVC Pipes', vendor: 'v6', po: 'PO-2026-010', qty: '1,800 m', expected: '2026-08-10', actual: null, status: 'intransit' },
    { id: 'd11', material: 'Waterproofing Membrane', vendor: 'v1', po: 'PO-2026-011', qty: '500 Sq.m', expected: '2026-08-20', actual: null, status: 'pending' },
    { id: 'd12', material: 'Floor Tiles (600x600)', vendor: 'v4', po: 'PO-2026-012', qty: '3,200 Sq.m', expected: '2026-09-01', actual: null, status: 'pending' },
    { id: 'd13', material: 'OPC 53 Cement', vendor: 'v1', po: 'PO-2026-013', qty: '60 MT', expected: '2026-08-01', actual: null, status: 'delayed' },
    { id: 'd14', material: 'HVAC Ducting', vendor: 'v5', po: 'PO-2026-014', qty: '350 m', expected: '2026-08-15', actual: null, status: 'delayed' },
    { id: 'd15', material: 'Aluminium Windows', vendor: 'v6', po: 'PO-2026-015', qty: '48 Nos', expected: '2026-10-01', actual: null, status: 'pending' },
    { id: 'd16', material: 'Fire Sprinklers', vendor: 'v2', po: 'PO-2026-016', qty: '120 Nos', expected: '2026-09-15', actual: null, status: 'pending' },
];

const INIT_EQUIPMENT = [
    { id: 'e1', name: 'Tower Crane (50T)', type: 'Heavy', assignedFrom: '2026-03-01', assignedTo: '2026-09-30', utilization: 78, status: 'active', rate: 45000 },
    { id: 'e2', name: 'JCB 3DX Backhoe', type: 'Earthwork', assignedFrom: '2026-03-10', assignedTo: '2026-06-15', utilization: 92, status: 'returned', rate: 8500 },
    { id: 'e3', name: 'Transit Mixer (6 Cu.m)', type: 'Concrete', assignedFrom: '2026-04-01', assignedTo: '2026-08-30', utilization: 65, status: 'active', rate: 12000 },
    { id: 'e4', name: 'Bar Bending Machine', type: 'Steel', assignedFrom: '2026-04-15', assignedTo: '2026-08-15', utilization: 85, status: 'active', rate: 3500 },
    { id: 'e5', name: 'Concrete Pump (Boom)', type: 'Concrete', assignedFrom: '2026-05-01', assignedTo: '2026-08-31', utilization: 58, status: 'active', rate: 25000 },
    { id: 'e6', name: 'Passenger Hoist', type: 'Vertical', assignedFrom: '2026-06-01', assignedTo: '2027-02-28', utilization: 72, status: 'active', rate: 35000 },
    { id: 'e7', name: 'Scaffolding Set (200m²)', type: 'Access', assignedFrom: '2026-06-15', assignedTo: '2027-01-31', utilization: 80, status: 'active', rate: 15000 },
    { id: 'e8', name: 'DG Set 125 KVA', type: 'Power', assignedFrom: '2026-03-01', assignedTo: '2027-03-15', utilization: 45, status: 'active', rate: 18000 },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const toDate = (s) => new Date(s);
const fmt = (d) => toDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
const fmtCurrency = (n) => { if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`; if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`; return `₹${Number(n).toLocaleString('en-IN')}`; };
let idCounter = 100;
const newId = (prefix) => `${prefix}${++idCounter}`;

// ─── KPI Card ──────────────────────────────────────────────────────────────────
const KPICard = ({ label, value, sub, icon: Icon, color }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-500">
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-700" style={{ backgroundColor: color + '08' }} />
        <div className="relative">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: color + '15' }}>
                <Icon size={18} style={{ color }} />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
            {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
        </div>
    </motion.div>
);

// ─── Delivery Heatmap ──────────────────────────────────────────────────────────
const DeliveryHeatmap = ({ deliveries }) => {
    const monthCounts = MONTHS.map((m, i) => { const ms = String(i + 1).padStart(2, '0'); return deliveries.filter(d => d.expected.includes(`-${ms}-`)).length; });
    const max = Math.max(...monthCounts, 1);
    return (
        <div>
            <div className="flex gap-1.5">
                {MONTHS.map((m, i) => {
                    const intensity = monthCounts[i] / max;
                    return (
                        <div key={m} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full h-10 rounded-lg transition-all duration-300 relative group" style={{ backgroundColor: `rgba(59, 130, 246, ${0.08 + intensity * 0.72})` }}>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-[10px] font-black text-white">{monthCounts[i]}</span></div>
                            </div>
                            <span className="text-[9px] text-gray-400 font-semibold">{m}</span>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center justify-between mt-3 text-[9px] text-gray-400">
                <span>Low volume</span>
                <div className="flex items-center gap-1">{[0.1, 0.3, 0.5, 0.7, 0.9].map((o, i) => <div key={i} className="w-4 h-3 rounded" style={{ backgroundColor: `rgba(59, 130, 246, ${o})` }} />)}</div>
                <span>High volume</span>
            </div>
        </div>
    );
};

// ─── Vendor Performance ────────────────────────────────────────────────────────
const VendorPerformance = ({ deliveries }) => {
    const vendorStats = VENDORS.map(v => {
        const vd = deliveries.filter(d => d.vendor === v.id && d.status === 'delivered');
        const total = vd.length; const onTime = vd.filter(d => d.actual && d.actual <= d.expected).length;
        return { ...v, total, onTime, pct: total > 0 ? Math.round((onTime / total) * 100) : 0 };
    }).filter(v => v.total > 0).sort((a, b) => b.pct - a.pct);
    return (
        <div className="space-y-3">
            {vendorStats.map(v => (
                <div key={v.id}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 truncate">{v.name}</span>
                        <span className={`text-[10px] font-bold ${v.pct >= 80 ? 'text-green-500' : v.pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{v.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v.pct}%`, backgroundColor: v.pct >= 80 ? '#22c55e' : v.pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5">{v.onTime}/{v.total} on-time • {v.city}</p>
                </div>
            ))}
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const LogisticPlan = ({ setExtraBreadcrumbs, onBack }) => {
    const [deliveries, setDeliveries] = useState(INIT_DELIVERIES);
    const [equipment, setEquipment] = useState(INIT_EQUIPMENT);
    const [statusFilter, setStatusFilter] = useState('all');
    const [tab, setTab] = useState('deliveries');

    // Panel state
    const [panel, setPanel] = useState(null); // { type: 'delivery'|'equipment'|'ai', item?, editing? }

    useEffect(() => { setExtraBreadcrumbs([{ label: 'Planning', onClick: onBack }, { label: 'Logistic Plan' }]); }, [onBack, setExtraBreadcrumbs]);

    const closePanel = () => setPanel(null);
    const openDeliveryDetail = (d) => setPanel({ type: 'delivery', item: d, editing: false });
    const openDeliveryEdit = (d) => setPanel({ type: 'delivery', item: d, editing: true });
    const openDeliveryAdd = () => setPanel({ type: 'delivery', item: { id: newId('d'), material: '', vendor: 'v1', po: '', qty: '', expected: '', actual: null, status: 'pending' }, editing: true });
    const openEquipDetail = (e) => setPanel({ type: 'equipment', item: e, editing: false });
    const openEquipEdit = (e) => setPanel({ type: 'equipment', item: e, editing: true });
    const openEquipAdd = () => setPanel({ type: 'equipment', item: { id: newId('e'), name: '', type: '', assignedFrom: '', assignedTo: '', utilization: 0, status: 'active', rate: 0 }, editing: true });
    const openAI = () => setPanel({ type: 'ai' });

    const saveDelivery = (form) => {
        setDeliveries(prev => { const idx = prev.findIndex(d => d.id === form.id); if (idx >= 0) { const n = [...prev]; n[idx] = form; return n; } return [...prev, form]; });
        closePanel();
    };
    const deleteDelivery = (id) => { setDeliveries(prev => prev.filter(d => d.id !== id)); if (panel?.item?.id === id) closePanel(); };
    const saveEquipment = (form) => {
        setEquipment(prev => { const idx = prev.findIndex(e => e.id === form.id); if (idx >= 0) { const n = [...prev]; n[idx] = form; return n; } return [...prev, form]; });
        closePanel();
    };
    const deleteEquipment = (id) => { setEquipment(prev => prev.filter(e => e.id !== id)); if (panel?.item?.id === id) closePanel(); };

    const filteredDeliveries = statusFilter === 'all' ? deliveries : deliveries.filter(d => d.status === statusFilter);
    const delivered = deliveries.filter(d => d.status === 'delivered').length;
    const onTimeDeliveries = deliveries.filter(d => d.status === 'delivered' && d.actual && d.actual <= d.expected).length;
    const onTimePct = delivered > 0 ? Math.round((onTimeDeliveries / delivered) * 100) : 0;
    const pendingOrders = deliveries.filter(d => d.status === 'pending' || d.status === 'intransit').length;
    const delayedOrders = deliveries.filter(d => d.status === 'delayed').length;
    const totalEquipCost = equipment.reduce((s, e) => { const d = Math.round((toDate(e.assignedTo) - toDate(e.assignedFrom)) / 86400000); return s + (isNaN(d) ? 0 : d * e.rate); }, 0);
    const avgUtilization = equipment.length > 0 ? Math.round(equipment.reduce((s, e) => s + e.utilization, 0) / equipment.length) : 0;
    const activeEquip = equipment.filter(e => e.status === 'active').length;

    const exportCSV = () => {
        if (tab === 'deliveries') {
            const h = 'Material,Vendor,PO,Qty,Expected,Actual,Status';
            const rows = deliveries.map(d => `"${d.material}","${VENDORS.find(v => v.id === d.vendor)?.name}",${d.po},${d.qty},${d.expected},${d.actual || '-'},${STATUSES[d.status]?.label}`);
            const blob = new Blob([[h, ...rows].join('\n')], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Delivery_Schedule.csv'; a.click();
        } else {
            const h = 'Equipment,Type,From,To,Utilization %,Status,Rate/Day';
            const rows = equipment.map(e => `"${e.name}",${e.type},${e.assignedFrom},${e.assignedTo},${e.utilization}%,${e.status},${e.rate}`);
            const blob = new Blob([[h, ...rows].join('\n')], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Equipment_Schedule.csv'; a.click();
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center"><Truck size={16} className="text-emerald-500" /></div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Logistic Plan</h2>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">{deliveries.length} Deliveries • {equipment.length} Equipment • {VENDORS.length} Vendors</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={openAI}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-xs font-bold rounded-lg transition-colors">
                        <Sparkles size={13} /> AI Summary
                    </button>
                    <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-0.5">
                        {['deliveries', 'equipment'].map(t => (
                            <button key={t} onClick={() => { setTab(t); closePanel(); }}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${tab === t ? 'bg-white dark:bg-[#161b22] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                {t === 'deliveries' ? '📦 Deliveries' : '🏗️ Equipment'}
                            </button>
                        ))}
                    </div>
                    {tab === 'deliveries' && (
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                            className="text-xs font-semibold px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300 outline-none">
                            <option value="all">All Status</option>
                            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    )}
                    <button onClick={tab === 'deliveries' ? openDeliveryAdd : openEquipAdd}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-colors">
                        <Plus size={13} /> Add {tab === 'deliveries' ? 'Delivery' : 'Equipment'}
                    </button>
                    <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg transition-colors">
                        <Download size={13} /> Export
                    </button>
                </div>
            </div>

            {/* Main body: content + right panel */}
            <div className="flex-1 flex overflow-hidden">
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="Total Deliveries" value={deliveries.length} sub={`${delivered} delivered, ${pendingOrders} pending`} icon={Package} color="#3b82f6" />
                        <KPICard label="On-Time Delivery" value={`${onTimePct}%`} sub={`${onTimeDeliveries}/${delivered} on time`} icon={CheckCircle2} color="#22c55e" />
                        <KPICard label="Delayed Orders" value={delayedOrders} sub="Require immediate attention" icon={AlertTriangle} color="#ef4444" />
                        <KPICard label="Equipment Cost" value={fmtCurrency(totalEquipCost)} sub={`Avg utilization: ${avgUtilization}%`} icon={Truck} color="#8b5cf6" />
                    </div>

                    {tab === 'deliveries' ? (
                        <>
                            {/* Delivery Table */}
                            <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Delivery Schedule</h3>
                                    <div className="flex items-center gap-3 text-[10px]">
                                        {Object.entries(STATUSES).map(([k, v]) => {
                                            const count = deliveries.filter(d => d.status === k).length;
                                            return <div key={k} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} /><span className="text-gray-500">{v.label} ({count})</span></div>;
                                        })}
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 dark:bg-white/[0.02]">
                                            <tr>
                                                <th className="px-4 py-2.5 text-left text-gray-500 uppercase font-bold tracking-wider">Material</th>
                                                <th className="px-3 py-2.5 text-left text-gray-500 uppercase font-bold tracking-wider">Vendor</th>
                                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">PO #</th>
                                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Qty</th>
                                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Expected</th>
                                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Actual</th>
                                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Status</th>
                                                <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                            {filteredDeliveries.map(d => {
                                                const vendor = VENDORS.find(v => v.id === d.vendor);
                                                const st = STATUSES[d.status];
                                                return (
                                                    <tr key={d.id} onClick={() => openDeliveryDetail(d)}
                                                        className={`cursor-pointer transition-colors ${panel?.item?.id === d.id ? 'bg-blue-50/60 dark:bg-blue-900/10' : 'hover:bg-blue-50/30 dark:hover:bg-blue-900/5'}`}>
                                                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{d.material}</td>
                                                        <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                                                            <div>{vendor?.name}</div>
                                                            <div className="text-[9px] text-gray-400 flex items-center gap-0.5"><MapPin size={8} />{vendor?.city}</div>
                                                        </td>
                                                        <td className="px-3 py-3 text-center font-mono text-gray-500 text-[10px]">{d.po}</td>
                                                        <td className="px-3 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">{d.qty}</td>
                                                        <td className="px-3 py-3 text-center text-gray-500 tabular-nums">{fmt(d.expected)}</td>
                                                        <td className="px-3 py-3 text-center tabular-nums">
                                                            {d.actual ? <span className={d.actual > d.expected ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>{fmt(d.actual)}</span> : <span className="text-gray-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-3 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg}`}>{st.label}</span></td>
                                                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={() => openDeliveryEdit(d)} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500"><Edit2 size={12} /></button>
                                                                <button onClick={() => deleteDelivery(d.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Bottom: Heatmap + Vendor + Equipment KPIs */}
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Delivery Volume Heatmap</h3>
                                    <DeliveryHeatmap deliveries={deliveries} />
                                </div>
                                <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Vendor – On-Time Performance</h3>
                                    <VendorPerformance deliveries={deliveries} />
                                </div>
                                {/* Equipment summary KPIs */}
                                <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5 space-y-4">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Equipment Snapshot</h3>
                                    {[
                                        { label: 'Active Equipment', value: activeEquip, total: equipment.length, color: '#22c55e', icon: '🏗️' },
                                        { label: 'Avg Utilization', value: `${avgUtilization}%`, color: avgUtilization >= 70 ? '#22c55e' : '#f59e0b', icon: '📊' },
                                        { label: 'Total Equipment Cost', value: fmtCurrency(totalEquipCost), color: '#8b5cf6', icon: '💰' },
                                        { label: 'Highest Utilization', value: `${equipment.length > 0 ? [...equipment].sort((a, b) => b.utilization - a.utilization)[0]?.name : '—'}`, color: '#3b82f6', icon: '⚡' },
                                    ].map((s, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-gray-50 dark:bg-[#0d1117] rounded-xl p-3 border border-gray-100 dark:border-white/5">
                                            <span className="text-lg">{s.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">{s.label}</p>
                                                <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{typeof s.value === 'number' ? `${s.value}/${s.total}` : s.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Equipment Tab */
                        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                            <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5"><h3 className="text-sm font-bold text-gray-800 dark:text-white">Equipment Schedule & Utilization</h3></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 dark:bg-white/[0.02]">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left text-gray-500 uppercase font-bold tracking-wider">Equipment</th>
                                            <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Type</th>
                                            <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">From</th>
                                            <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">To</th>
                                            <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Rate/Day</th>
                                            <th className="px-4 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider w-36">Utilization</th>
                                            <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Status</th>
                                            <th className="px-3 py-2.5 text-center text-gray-500 uppercase font-bold tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                        {equipment.map(e => (
                                            <tr key={e.id} onClick={() => openEquipDetail(e)}
                                                className={`cursor-pointer transition-colors ${panel?.item?.id === e.id ? 'bg-blue-50/60 dark:bg-blue-900/10' : 'hover:bg-blue-50/30 dark:hover:bg-blue-900/5'}`}>
                                                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300"><div className="flex items-center gap-2"><Box size={13} className="text-gray-400" />{e.name}</div></td>
                                                <td className="px-3 py-3 text-center"><span className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-500 text-[10px] font-semibold">{e.type}</span></td>
                                                <td className="px-3 py-3 text-center text-gray-500 tabular-nums">{fmt(e.assignedFrom)}</td>
                                                <td className="px-3 py-3 text-center text-gray-500 tabular-nums">{fmt(e.assignedTo)}</td>
                                                <td className="px-3 py-3 text-center text-gray-500 tabular-nums">₹{Number(e.rate).toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${e.utilization}%`, backgroundColor: e.utilization >= 80 ? '#22c55e' : e.utilization >= 50 ? '#f59e0b' : '#ef4444' }} />
                                                        </div>
                                                        <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color: e.utilization >= 80 ? '#22c55e' : e.utilization >= 50 ? '#f59e0b' : '#ef4444' }}>{e.utilization}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    {e.status === 'active' ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-500"><CheckCircle2 size={11} /> Active</span>
                                                        : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400"><Clock size={11} /> Returned</span>}
                                                </td>
                                                <td className="px-3 py-3 text-center" onClick={e2 => e2.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => openEquipEdit(e)} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500"><Edit2 size={12} /></button>
                                                        <button onClick={() => deleteEquipment(e.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 dark:bg-white/5 border-t-2 border-gray-300 dark:border-white/10">
                                        <tr>
                                            <td className="px-4 py-3 font-black text-gray-800 dark:text-white uppercase" colSpan={4}>Total Equipment Cost</td>
                                            <td className="px-3 py-3 text-center font-black text-gray-800 dark:text-white" colSpan={4}>{fmtCurrency(totalEquipCost)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel */}
                <AnimatePresence>
                    {panel?.type === 'delivery' && <DeliveryPanel delivery={panel.item} vendors={VENDORS} editing={panel.editing} onSave={saveDelivery} onClose={closePanel} />}
                    {panel?.type === 'equipment' && <EquipmentPanel equipment={panel.item} editing={panel.editing} onSave={saveEquipment} onClose={closePanel} />}
                    {panel?.type === 'ai' && <LogisticAIPanel title="AI Logistics Summary" deliveries={deliveries} equipment={equipment} onClose={closePanel} />}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default LogisticPlan;
