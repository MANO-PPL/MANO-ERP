import React, { useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    BriefcaseBusiness,
    Calendar,
    CheckCircle2,
    ChevronRight,
    FileSpreadsheet,
    MessageSquare,
    Plus,
    ShieldAlert,
    ShieldCheck,
    Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { customToast } from '../../components/Toast';
import MobileCard from '../components/MobileCard';

const INITIAL_TASKS = [
    { id: 1, text: 'Verify structural layout alignment (Grid A-D)', completed: true, priority: 'High' },
    { id: 2, text: 'Draft Daily Progress Report for Metro Station', completed: false, priority: 'Medium' },
    { id: 3, text: 'Review concrete slump test laboratory results', completed: false, priority: 'High' },
    { id: 4, text: 'Coordinate vendor delivery slots for reinforcement steel', completed: true, priority: 'Low' },
    { id: 5, text: 'Conduct weekly pre-start safety briefing with sub-teams', completed: false, priority: 'High' },
];

const PROJECT_HEALTH = [
    { id: '1', name: 'Skyline Luxury Residences', code: 'PRJ-2026-001', status: 'Active', progress: 44, budget: '₹4.50 Cr', spent: '₹1.98 Cr', tone: 'emerald' },
    { id: '2', name: 'Metro Station B2', code: 'PRJ-2026-002', status: 'On Track', progress: 65, budget: '₹2.80 Cr', spent: '₹1.82 Cr', tone: 'emerald' },
    { id: '3', name: 'City Bridge Repair', code: 'PRJ-2026-003', status: 'At Risk', progress: 88, budget: '₹1.20 Cr', spent: '₹1.05 Cr', tone: 'amber' },
];

const ALERTS = [
    { title: 'Safety Incident', text: 'Tower A - Unsecured scaffold guard rail identified at Level 4. Work paused.', tone: 'amber' },
    { title: 'Material Delay', text: 'Rebar Yard - High-tensile steel shipment delayed by logistics check. ETA 4:00 PM.', tone: 'blue' },
    { title: 'Audit Cleared', text: 'Metro Station - Independent PMC concrete core compressive tests passed with 100% compliance.', tone: 'emerald' },
];

const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
};

export default function MobileDashboard({ authOverride, onNavigate }) {
    const auth = useAuth();
    const navigate = useNavigate();
    const activeAuth = authOverride || auth;
    const [tasks, setTasks] = useState(INITIAL_TASKS);
    const canReadProjects = activeAuth.hasPermission('projects', 1);
    const canWriteProjects = activeAuth.hasPermission('projects', 2);
    const go = (path) => (onNavigate ? onNavigate(path) : navigate(path));

    const todayDateString = new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date()).toUpperCase();

    return (
        <div data-mobile-page="dashboard" className="w-full min-w-0 space-y-3 px-2 sm:px-3 pb-24 pt-2">
            {/* Vibrant Welcome Banner matching MANO-App dashboard_page.dart */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] p-4 text-white shadow-lg">
                <div className="relative z-10">
                    <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-white/80">
                        <Calendar size={11} /> {todayDateString}
                    </p>
                    <h1 className="mt-1 text-lg font-black tracking-tight">
                        MANO Construction ERP
                    </h1>
                    <p className="mt-0.5 text-xs text-white/80">
                        Real-time Site Intelligence & Portfolio Governance
                    </p>
                </div>
                {/* Subtle decorative glow */}
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-xl" />
            </div>

            {/* 4 Executive KPI Cards in a 2x2 grid matching MANO-App */}
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gh-border dark:bg-[#161B22]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gh-muted">Active Projects</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                            <BriefcaseBusiness size={15} />
                        </span>
                    </div>
                    <p className="mt-1.5 font-mono text-xl font-extrabold text-gray-900 dark:text-gh-text">12</p>
                    <p className="mt-0.5 text-[10.5px] text-gray-500 dark:text-gh-muted">15 Total in Portfolio</p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gh-border dark:bg-[#161B22]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gh-muted">Portfolio Value</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <Wallet size={15} />
                        </span>
                    </div>
                    <p className="mt-1.5 font-mono text-xl font-extrabold text-emerald-600 dark:text-emerald-400">₹8.50 Cr</p>
                    <p className="mt-0.5 text-[10.5px] text-gray-500 dark:text-gh-muted">Spent: ₹4.85 Cr</p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gh-border dark:bg-[#161B22]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gh-muted">Safety Streak</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <ShieldCheck size={15} />
                        </span>
                    </div>
                    <p className="mt-1.5 font-mono text-xl font-extrabold text-gray-900 dark:text-gh-text">248 Days</p>
                    <p className="mt-0.5 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">Zero LTI Incidents</p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gh-border dark:bg-[#161B22]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gh-muted">QA Compliance</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                            <CheckCircle2 size={15} />
                        </span>
                    </div>
                    <p className="mt-1.5 font-mono text-xl font-extrabold text-blue-600 dark:text-blue-400">97.8%</p>
                    <p className="mt-0.5 text-[10.5px] text-gray-500 dark:text-gh-muted">48 of 49 Tests Passed</p>
                </div>
            </div>

            {/* Quick Action Shortcuts matching MANO-App */}
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gh-border dark:bg-[#161B22]">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">
                    Quick Actions
                </h2>
                <div className="grid grid-cols-2 gap-2">
                    {canReadProjects && (
                        <button
                            type="button"
                            onClick={() => go('/projects')}
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card"
                        >
                            <BriefcaseBusiness size={15} className="text-blue-600 dark:text-blue-400" />
                            View Projects
                        </button>
                    )}
                    {canWriteProjects && (
                        <button
                            type="button"
                            onClick={() => go('/projects/create')}
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                        >
                            <Plus size={15} />
                            Create Project
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => go('/collaboration')}
                        className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card"
                    >
                        <MessageSquare size={15} className="text-purple-600 dark:text-purple-400" />
                        Team Chat
                    </button>
                    <button
                        type="button"
                        onClick={() => go('/spreadsheets')}
                        className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card"
                    >
                        <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
                        Spreadsheets
                    </button>
                </div>
            </div>

            {/* Active Site Progress matching MANO-App */}
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gh-border dark:bg-[#161B22]">
                <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">
                        Active Site Progress
                    </h2>
                    {canReadProjects && (
                        <button
                            type="button"
                            onClick={() => go('/projects')}
                            className="flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                            View All <ChevronRight size={14} />
                        </button>
                    )}
                </div>

                <div className="space-y-2">
                    {PROJECT_HEALTH.map((p) => (
                        <button
                            key={p.name}
                            type="button"
                            onClick={() => go(`/projects/${p.id}`)}
                            className="group block w-full rounded-xl border border-gray-100 p-2.5 text-left transition hover:border-blue-200 hover:bg-gray-50/50 dark:border-gh-border dark:hover:bg-gh-card"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="truncate text-xs font-bold text-gray-900 group-hover:text-blue-600 dark:text-gh-text dark:group-hover:text-blue-400">
                                        {p.name}
                                    </h3>
                                    <p className="mt-0.5 font-mono text-[10px] text-gray-500 dark:text-gh-muted">
                                        {p.code} • Budget: {p.budget}
                                    </p>
                                </div>
                                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-bold uppercase ${
                                    p.tone === 'emerald'
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                }`}>
                                    {p.status}
                                </span>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                    <div
                                        className="h-full rounded-full bg-blue-600"
                                        style={{ width: `${p.progress}%` }}
                                    />
                                </div>
                                <span className="font-mono text-xs font-bold text-gray-700 dark:text-gh-text">
                                    {p.progress}%
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Daily Operational Checklist */}
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gh-border dark:bg-[#161B22]">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">
                        Operational Checklist
                    </h2>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {tasks.filter((t) => t.completed).length}/{tasks.length} Done
                    </span>
                </div>
                <div className="space-y-1">
                    {tasks.map((task) => (
                        <button
                            key={task.id}
                            type="button"
                            aria-pressed={task.completed}
                            onClick={() => {
                                const nextCompleted = !task.completed;
                                setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: nextCompleted } : item));
                                if (nextCompleted) {
                                    customToast.success(`Marked "${task.text}" as completed`, 'Checklist');
                                } else {
                                    customToast.info(`Reopened "${task.text}"`, 'Checklist');
                                }
                            }}
                            className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left hover:bg-gray-50 dark:hover:bg-gh-card"
                        >
                            <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${task.completed ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                {task.completed && <CheckCircle2 size={12} />}
                            </span>
                            <span className={`min-w-0 flex-1 text-xs leading-5 ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gh-text'}`}>
                                {task.text}
                            </span>
                            <span className="shrink-0 text-[9px] font-semibold uppercase text-gray-400">
                                {task.priority}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Critical Site Alerts */}
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gh-border dark:bg-[#161B22]">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">
                    Critical Site Alerts
                </h2>
                <div className="space-y-2">
                    {ALERTS.map((alert) => (
                        <div key={alert.title} className={`rounded-xl border p-2.5 ${toneClasses[alert.tone]}`}>
                            <p className="text-[10px] font-bold uppercase tracking-wider">{alert.title}</p>
                            <p className="mt-0.5 text-xs leading-relaxed">{alert.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
