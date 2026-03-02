import React, { useState } from 'react';
import { X, Sparkles, TrendingUp, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const toDate = (s) => new Date(s);
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const fmt = (d) => toDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

// ─── AI Summary Panel (Right side) ─────────────────────────────────────────────
export const AISummaryPanel = ({ title, phases, onClose }) => {
    const allActs = phases.flatMap(p => p.activities);
    const total = allActs.length;
    const done = allActs.filter(a => a.progress === 100).length;
    const inProg = allActs.filter(a => a.progress > 0 && a.progress < 100).length;
    const notStarted = allActs.filter(a => a.progress === 0).length;
    const highPri = allActs.filter(a => a.critical).length;
    const behind = allActs.filter(a => toDate(a.end) > toDate(a.origEnd) && a.progress < 100).length;
    const avgProg = total > 0 ? Math.round(allActs.reduce((s, a) => s + a.progress, 0) / total) : 0;
    const completedPhases = phases.filter(p => p.activities.length > 0 && p.activities.every(a => a.progress === 100)).length;

    const insights = [
        { emoji: '📊', label: 'Overall Progress', text: `${avgProg}% complete — ${done} done, ${inProg} in progress, ${notStarted} not started` },
        { emoji: '⚡', label: 'High Priority Tasks', text: `${highPri} out of ${total} tasks are marked high priority` },
        behind > 0
            ? { emoji: '⚠️', label: 'Schedule Alert', text: `${behind} task(s) are running behind the original plan`, alert: true }
            : { emoji: '✅', label: 'On Track', text: 'All tasks are on or ahead of schedule' },
        phases.length > 1 ? { emoji: '🏗️', label: 'Phases', text: `${completedPhases}/${phases.length} phases fully complete` } : null,
        { emoji: '📅', label: 'Recommendation', text: behind > 0 ? 'Focus resources on delayed high-priority tasks to recover schedule.' : avgProg < 50 ? 'Maintain current pace and monitor upcoming high-priority tasks.' : 'Project is progressing well. Continue monitoring key deliverables.' },
    ].filter(Boolean);

    return (
        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
            className="w-[320px] min-w-[320px] bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/10 dark:to-blue-900/10">
                <div className="flex items-center gap-2 min-w-0">
                    <Sparkles size={15} className="text-violet-500 shrink-0" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{title}</h3>
                </div>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 text-gray-400 shrink-0"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {/* Progress ring */}
                <div className="flex items-center gap-4 pb-3 border-b border-gray-100 dark:border-white/5">
                    <div className="relative w-14 h-14">
                        <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100 dark:text-white/10" />
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#8b5cf6" strokeWidth="3" strokeDasharray={`${avgProg} ${100 - avgProg}`} strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-gray-800 dark:text-white">{avgProg}%</span>
                    </div>
                    <div>
                        <p className="text-base font-black text-gray-900 dark:text-white">{done}/{total}</p>
                        <p className="text-[10px] text-gray-400">Tasks Complete</p>
                    </div>
                </div>
                {/* Insights */}
                {insights.map((item, i) => (
                    <div key={i} className={`rounded-xl p-3 border ${item.alert ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-500/20' : 'bg-gray-50 dark:bg-[#0d1117] border-gray-100 dark:border-white/5'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{item.emoji}</span>
                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{item.label}</span>
                        </div>
                        <p className="text-[11px] text-gray-700 dark:text-gray-400 leading-relaxed">{item.text}</p>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

// ─── Phase/Task Detail Panel (Right side) ──────────────────────────────────────
export const DetailPanel = ({ type, phase, activity, onClose }) => {
    if (!type) return null;

    if (type === 'phase' && phase) {
        const acts = phase.activities;
        const total = acts.length;
        const progress = total > 0 ? Math.round(acts.reduce((s, a) => s + a.progress, 0) / total) : 0;
        const done = acts.filter(a => a.progress === 100).length;
        const highPri = acts.filter(a => a.critical).length;
        const behind = acts.filter(a => toDate(a.end) > toDate(a.origEnd) && a.progress < 100).length;
        const pStart = total > 0 ? acts.reduce((m, a) => a.start < m ? a.start : m, acts[0].start) : null;
        const pEnd = total > 0 ? acts.reduce((m, a) => a.end > m ? a.end : m, acts[0].end) : null;

        return (
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                className="w-[320px] min-w-[320px] bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/5 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
                        <span className="text-xs">{phase.icon}</span>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{phase.name}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 shrink-0"><X size={14} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {/* Progress circle */}
                    <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16">
                            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100 dark:text-white/10" />
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke={phase.color} strokeWidth="3" strokeDasharray={`${progress} ${100 - progress}`} strokeLinecap="round" />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-gray-800 dark:text-white">{progress}%</span>
                        </div>
                        <div>
                            <p className="text-lg font-black text-gray-900 dark:text-white">{done}/{total}</p>
                            <p className="text-[10px] text-gray-400">Tasks Complete</p>
                        </div>
                    </div>
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Start', value: pStart ? fmt(pStart) : '—', icon: Clock, color: '#3b82f6' },
                            { label: 'End', value: pEnd ? fmt(pEnd) : '—', icon: Clock, color: '#8b5cf6' },
                            { label: 'High Priority', value: highPri, icon: AlertTriangle, color: '#ef4444' },
                            { label: 'Behind Plan', value: behind, icon: TrendingUp, color: '#f59e0b' },
                        ].map((s, i) => (
                            <div key={i} className="bg-gray-50 dark:bg-[#0d1117] rounded-xl p-3 border border-gray-100 dark:border-white/5">
                                <s.icon size={12} style={{ color: s.color }} />
                                <p className="text-sm font-bold text-gray-800 dark:text-white mt-1">{s.value}</p>
                                <p className="text-[9px] text-gray-400 uppercase tracking-wider">{s.label}</p>
                            </div>
                        ))}
                    </div>
                    {/* Task list */}
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Tasks</p>
                        <div className="space-y-1.5">
                            {acts.map(a => (
                                <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-[#0d1117] border border-gray-100 dark:border-white/5">
                                    {a.critical && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />}
                                    <span className="text-[11px] text-gray-700 dark:text-gray-300 flex-1 truncate">{a.name || '(untitled)'}</span>
                                    <div className="w-10 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${a.progress}%` }} />
                                    </div>
                                    <span className="text-[9px] font-bold text-gray-400 w-7 text-right">{a.progress}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    if (type === 'task' && activity && phase) {
        const a = activity;
        const dur = daysBetween(a.start, a.end);
        const origDur = daysBetween(a.origStart, a.origEnd);
        const delayed = toDate(a.end) > toDate(a.origEnd);
        const delayDays = delayed ? daysBetween(a.origEnd, a.end) : 0;

        return (
            <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                className="w-[320px] min-w-[320px] bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/5 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{a.name || '(untitled)'}</h3>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: phase.color }} />{phase.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 shrink-0"><X size={14} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {/* Progress */}
                    <div className="bg-gray-50 dark:bg-[#0d1117] rounded-xl p-4 border border-gray-100 dark:border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Progress</span>
                            <span className="text-lg font-black" style={{ color: a.progress === 100 ? '#22c55e' : phase.color }}>{a.progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${a.progress}%`, backgroundColor: a.progress === 100 ? '#22c55e' : phase.color }} />
                        </div>
                    </div>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                        {a.critical && <span className="text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">⚡ HIGH PRIORITY</span>}
                        {a.milestone && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">🎯 KEY DELIVERABLE</span>}
                        {delayed && <span className="text-[9px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">⏳ DELAYED {delayDays}d</span>}
                    </div>
                    {/* Dates */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Schedule</p>
                        {[
                            { label: 'Current Start', value: fmt(a.start) },
                            { label: 'Current End', value: fmt(a.end) },
                            { label: 'Original Start', value: fmt(a.origStart) },
                            { label: 'Original End', value: fmt(a.origEnd) },
                            { label: 'Duration', value: `${dur} days` },
                            { label: 'Original Duration', value: `${origDur} days` },
                        ].map((r, i) => (
                            <div key={i} className="flex justify-between py-1.5 border-b border-gray-50 dark:border-white/[0.03]">
                                <span className="text-[11px] text-gray-400">{r.label}</span>
                                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{r.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        );
    }

    return null;
};
