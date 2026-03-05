import React, { useState, useEffect } from 'react';
import { X, Sparkles, Save, MapPin, CheckCircle2, AlertTriangle, Clock, Package, Truck, Box } from 'lucide-react';
import { motion } from 'framer-motion';

const toDate = (s) => new Date(s);
const fmt = (d) => toDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
const fmtCurrency = (n) => { if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`; if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`; return `₹${Number(n).toLocaleString('en-IN')}`; };
const STATUSES_LIST = ['delivered', 'intransit', 'pending', 'delayed'];
const STATUS_LABELS = { delivered: 'Delivered', intransit: 'In Transit', pending: 'Pending', delayed: 'Delayed' };
const STATUS_COLORS = { delivered: '#22c55e', intransit: '#3b82f6', pending: '#f59e0b', delayed: '#ef4444' };

const InputRow = ({ label, value, onChange, type = 'text', options }) => (
    <div>
        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5 block">{label}</label>
        {options ? (
            <select value={value} onChange={e => onChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500">
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        ) : (
            <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500" />
        )}
    </div>
);

// ─── Delivery Detail / Edit Panel ──────────────────────────────────────────────
export const DeliveryPanel = ({ delivery, vendors, editing, onSave, onClose }) => {
    const [form, setForm] = useState({});
    useEffect(() => { if (delivery) setForm({ ...delivery }); }, [delivery]);
    const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
    const vendor = vendors.find(v => v.id === (form.vendor || delivery?.vendor));

    if (!delivery) return null;

    return (
        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
            className="w-[320px] min-w-[320px] bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{editing ? 'Edit Delivery' : (delivery.material || 'Delivery Details')}</h3>
                    {!editing && vendor && <p className="text-[10px] text-gray-400 flex items-center gap-1"><MapPin size={8} />{vendor.name}</p>}
                </div>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 shrink-0"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {editing ? (
                    <>
                        <InputRow label="Material" value={form.material} onChange={v => upd('material', v)} />
                        <InputRow label="Vendor" value={form.vendor} onChange={v => upd('vendor', v)} options={vendors.map(v => ({ value: v.id, label: v.name }))} />
                        <InputRow label="PO Number" value={form.po} onChange={v => upd('po', v)} />
                        <InputRow label="Quantity" value={form.qty} onChange={v => upd('qty', v)} />
                        <InputRow label="Expected Date" value={form.expected} onChange={v => upd('expected', v)} type="date" />
                        <InputRow label="Actual Date" value={form.actual} onChange={v => upd('actual', v)} type="date" />
                        <InputRow label="Status" value={form.status} onChange={v => upd('status', v)} options={STATUSES_LIST.map(s => ({ value: s, label: STATUS_LABELS[s] }))} />
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: STATUS_COLORS[delivery.status] + '20', color: STATUS_COLORS[delivery.status] }}>{STATUS_LABELS[delivery.status]}</span>
                        </div>
                        {[
                            { l: 'Material', v: delivery.material },
                            { l: 'Vendor', v: vendor?.name },
                            { l: 'Location', v: vendor?.city },
                            { l: 'PO Number', v: delivery.po },
                            { l: 'Quantity', v: delivery.qty },
                            { l: 'Expected Date', v: fmt(delivery.expected) },
                            { l: 'Actual Date', v: delivery.actual ? fmt(delivery.actual) : '—' },
                        ].map((r, i) => (
                            <div key={i} className="flex justify-between py-2 border-b border-gray-50 dark:border-white/[0.03]">
                                <span className="text-[11px] text-gray-400">{r.l}</span>
                                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{r.v}</span>
                            </div>
                        ))}
                        {delivery.actual && delivery.actual > delivery.expected && (
                            <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-3 border border-red-200 dark:border-red-500/20">
                                <p className="text-[10px] font-bold text-red-600">⚠️ Delivered {Math.round((toDate(delivery.actual) - toDate(delivery.expected)) / 86400000)} days late</p>
                            </div>
                        )}
                    </>
                )}
            </div>
            {editing && (
                <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0d1117]">
                    <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-gray-500">Cancel</button>
                    <button onClick={() => onSave(form)} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20"><Save size={12} /> Save</button>
                </div>
            )}
        </motion.div>
    );
};

// ─── Equipment Detail / Edit Panel ─────────────────────────────────────────────
export const EquipmentPanel = ({ equipment, editing, onSave, onClose }) => {
    const [form, setForm] = useState({});
    useEffect(() => { if (equipment) setForm({ ...equipment }); }, [equipment]);
    const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

    if (!equipment) return null;
    const days = Math.round((toDate(equipment.assignedTo) - toDate(equipment.assignedFrom)) / 86400000);
    const cost = days * equipment.rate;

    return (
        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
            className="w-[320px] min-w-[320px] bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{editing ? 'Edit Equipment' : equipment.name}</h3>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 shrink-0"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {editing ? (
                    <>
                        <InputRow label="Equipment Name" value={form.name} onChange={v => upd('name', v)} />
                        <InputRow label="Type" value={form.type} onChange={v => upd('type', v)} />
                        <InputRow label="Assigned From" value={form.assignedFrom} onChange={v => upd('assignedFrom', v)} type="date" />
                        <InputRow label="Assigned To" value={form.assignedTo} onChange={v => upd('assignedTo', v)} type="date" />
                        <InputRow label="Rate / Day (₹)" value={form.rate} onChange={v => upd('rate', Number(v))} type="number" />
                        <InputRow label="Utilization (%)" value={form.utilization} onChange={v => upd('utilization', Math.min(100, Math.max(0, Number(v))))} type="number" />
                        <InputRow label="Status" value={form.status} onChange={v => upd('status', v)} options={[{ value: 'active', label: 'Active' }, { value: 'returned', label: 'Returned' }]} />
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${equipment.status === 'active' ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-gray-100 dark:bg-white/10 text-gray-500'}`}>{equipment.status === 'active' ? '● Active' : '● Returned'}</span>
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-500 text-[10px] font-semibold">{equipment.type}</span>
                        </div>
                        {/* Utilization ring */}
                        <div className="flex items-center gap-4 py-2">
                            <div className="relative w-14 h-14">
                                <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100 dark:text-white/10" />
                                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={equipment.utilization >= 80 ? '#22c55e' : equipment.utilization >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${equipment.utilization} ${100 - equipment.utilization}`} strokeLinecap="round" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-gray-800 dark:text-white">{equipment.utilization}%</span>
                            </div>
                            <div><p className="text-sm font-bold text-gray-800 dark:text-white">Utilization</p><p className="text-[10px] text-gray-400">{equipment.utilization >= 80 ? 'Excellent' : equipment.utilization >= 50 ? 'Moderate' : 'Low'}</p></div>
                        </div>
                        {[
                            { l: 'Equipment', v: equipment.name },
                            { l: 'Type', v: equipment.type },
                            { l: 'From', v: fmt(equipment.assignedFrom) },
                            { l: 'To', v: fmt(equipment.assignedTo) },
                            { l: 'Duration', v: `${days} days` },
                            { l: 'Rate/Day', v: `₹${Number(equipment.rate).toLocaleString('en-IN')}` },
                            { l: 'Total Cost', v: fmtCurrency(cost) },
                        ].map((r, i) => (
                            <div key={i} className="flex justify-between py-2 border-b border-gray-50 dark:border-white/[0.03]">
                                <span className="text-[11px] text-gray-400">{r.l}</span>
                                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{r.v}</span>
                            </div>
                        ))}
                    </>
                )}
            </div>
            {editing && (
                <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0d1117]">
                    <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-gray-500">Cancel</button>
                    <button onClick={() => onSave(form)} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20"><Save size={12} /> Save</button>
                </div>
            )}
        </motion.div>
    );
};

// ─── AI Summary Panel ──────────────────────────────────────────────────────────
export const LogisticAIPanel = ({ title, deliveries, equipment, onClose }) => {
    const delivered = deliveries.filter(d => d.status === 'delivered').length;
    const onTime = deliveries.filter(d => d.status === 'delivered' && d.actual && d.actual <= d.expected).length;
    const delayed = deliveries.filter(d => d.status === 'delayed').length;
    const pending = deliveries.filter(d => d.status === 'pending' || d.status === 'intransit').length;
    const avgUtil = equipment.length > 0 ? Math.round(equipment.reduce((s, e) => s + e.utilization, 0) / equipment.length) : 0;
    const activeEquip = equipment.filter(e => e.status === 'active').length;

    const insights = [
        { emoji: '📦', label: 'Deliveries', text: `${delivered}/${deliveries.length} delivered (${onTime} on time). ${pending} orders in pipeline.` },
        delayed > 0 ? { emoji: '⚠️', label: 'Delays', text: `${delayed} order(s) delayed. Escalate with vendors for expedited shipping.`, alert: true } : { emoji: '✅', label: 'No Delays', text: 'All orders are on track or delivered.' },
        { emoji: '🏗️', label: 'Equipment', text: `${activeEquip}/${equipment.length} equipment active. Average utilization: ${avgUtil}%.` },
        avgUtil < 60 ? { emoji: '💡', label: 'Optimization', text: 'Equipment utilization is below 60%. Consider releasing idle equipment to reduce costs.', alert: true } : { emoji: '📊', label: 'Efficiency', text: 'Equipment utilization is healthy. Continue monitoring for maintenance schedules.' },
        { emoji: '📅', label: 'Recommendation', text: delayed > 0 ? 'Prioritize follow-up on delayed orders. Consider alternate vendors for critical materials.' : 'Procurement pipeline is healthy. Plan ahead for finishing-stage materials.' },
    ];

    return (
        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
            className="w-[320px] min-w-[320px] bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/10 dark:to-blue-900/10">
                <div className="flex items-center gap-2 min-w-0"><Sparkles size={15} className="text-violet-500 shrink-0" /><h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{title}</h3></div>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 text-gray-400 shrink-0"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {insights.map((item, i) => (
                    <div key={i} className={`rounded-xl p-3 border ${item.alert ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-500/20' : 'bg-gray-50 dark:bg-[#0d1117] border-gray-100 dark:border-white/5'}`}>
                        <div className="flex items-center gap-2 mb-1"><span className="text-sm">{item.emoji}</span><span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{item.label}</span></div>
                        <p className="text-[11px] text-gray-700 dark:text-gray-400 leading-relaxed">{item.text}</p>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};
