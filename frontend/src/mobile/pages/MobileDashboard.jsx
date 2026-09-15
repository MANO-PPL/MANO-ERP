import React, { useState } from 'react';
import {
    AlertTriangle,
    BarChart3,
    BriefcaseBusiness,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Plus,
    ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MobileCard, { MobileStatCard } from '../components/MobileCard';
import MobilePageHeader from '../components/MobilePageHeader';

const KPI_CARDS = [
    { label: 'Total Contract Value', value: '₹69.7L', detail: '+2.4% vs last month', icon: BarChart3, tone: 'blue' },
    { label: 'Active Projects', value: '12', detail: '3 critical, 4 delayed', icon: Clock3, tone: 'amber' },
    { label: 'Pending Approvals', value: '8', detail: 'Avg wait time: 1.2 days', icon: AlertTriangle, tone: 'red' },
    { label: 'Quality Score', value: '94%', detail: 'Top 5% of industry', icon: CheckCircle2, tone: 'green' },
];

const PROJECT_HEALTH = [
    { name: 'Metro Station B2', status: 'On Track', progress: 65, variance: '-₹1.2L', due: 'Dec 2026', tone: 'green' },
    { name: 'Skyline Tower', status: 'Delayed', progress: 42, variance: '+₹45.0L', due: 'Aug 2026', tone: 'red' },
    { name: 'City Bridge Repair', status: 'At Risk', progress: 88, variance: '₹0.0', due: 'Mar 2026', tone: 'amber' },
];

const INITIAL_TASKS = [
    { id: 1, text: 'Verify structural layout alignment (Grid A-D)', completed: true, priority: 'High' },
    { id: 2, text: 'Draft Daily Progress Report for Metro Station', completed: false, priority: 'Medium' },
    { id: 3, text: 'Review concrete slump test laboratory results', completed: false, priority: 'High' },
    { id: 4, text: 'Coordinate vendor delivery slots for reinforcement steel', completed: true, priority: 'Low' },
    { id: 5, text: 'Conduct weekly pre-start safety briefing with sub-teams', completed: false, priority: 'High' },
];

const ALERTS = [
    { title: 'Safety Incident', text: 'Site B - Fall hazard detected near Grid B. Immediate corrective action required.', tone: 'red' },
    { title: 'Material Delay', text: 'Skyline Tower - Cement carrier delayed by local logistics check. ETA updated to 4PM.', tone: 'amber' },
    { title: 'Audit Cleared', text: 'Metro Station - Structural foundation load test approved by independent audit engineer.', tone: 'green' },
];

const toneClasses = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
};

export default function MobileDashboard({ authOverride, onNavigate }) {
    const auth = useAuth();
    const navigate = useNavigate();
    const activeAuth = authOverride || auth;
    const [tasks, setTasks] = useState(INITIAL_TASKS);
    const canReadProjects = activeAuth.hasPermission('projects', 1);
    const canWriteProjects = activeAuth.hasPermission('projects', 2);
    const goToProjects = () => (onNavigate ? onNavigate('/projects') : navigate('/projects'));
    const goToCreateProject = () => (onNavigate ? onNavigate('/projects/create') : navigate('/projects/create'));

    return (
        <div data-mobile-page="dashboard" className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28">
            <MobilePageHeader
                eyebrow="Operations overview"
                title={`Welcome${activeAuth.user?.user_name ? `, ${activeAuth.user.user_name.split(' ')[0]}` : ''}`}
                subtitle="Your current enterprise dashboard overview."
                actions={canReadProjects ? (
                    <button type="button" onClick={goToProjects} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                        Projects <ChevronRight size={16} aria-hidden="true" />
                    </button>
                ) : null}
            />

            <div className="grid grid-cols-2 gap-3">
                {KPI_CARDS.map((item) => <MobileStatCard key={item.label} {...item} />)}
            </div>

            {canReadProjects && (
                <MobileCard>
                    <h2 className="mb-3 text-sm font-bold">Quick actions</h2>
                    <div className={`grid gap-2 ${canWriteProjects ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <button type="button" onClick={goToProjects} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-700 dark:border-gh-border dark:text-gh-text">
                            <BriefcaseBusiness size={17} aria-hidden="true" />View projects
                        </button>
                        {canWriteProjects && (
                            <button type="button" onClick={goToCreateProject} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white">
                                <Plus size={17} aria-hidden="true" />Create project
                            </button>
                        )}
                    </div>
                </MobileCard>
            )}

            <MobileCard>
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold">Project health overview</h2>
                    {canReadProjects && <button type="button" onClick={goToProjects} className="min-h-11 px-2 text-xs font-bold text-blue-600 dark:text-blue-400">View all</button>}
                </div>
                <div className="space-y-3">
                    {PROJECT_HEALTH.map((project) => (
                        <article key={project.name} className="rounded-xl border border-gray-100 p-3 dark:border-gh-border">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="truncate text-sm font-bold">{project.name}</h3>
                                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gh-muted">Due {project.due} · Variance {project.variance}</p>
                                </div>
                                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${toneClasses[project.tone]}`}>{project.status}</span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${project.progress}%` }} />
                                </div>
                                <span className="w-9 text-right text-xs font-bold">{project.progress}%</span>
                            </div>
                        </article>
                    ))}
                </div>
            </MobileCard>

            <MobileCard>
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold">Daily operational checklist</h2>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        {tasks.filter((task) => task.completed).length}/{tasks.length}
                    </span>
                </div>
                <div className="space-y-1">
                    {tasks.map((task) => (
                        <button
                            key={task.id}
                            type="button"
                            aria-pressed={task.completed}
                            onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))}
                            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-gh-hover"
                        >
                            <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${task.completed ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                {task.completed && <CheckCircle2 size={14} aria-hidden="true" />}
                            </span>
                            <span className={`min-w-0 flex-1 text-xs leading-5 ${task.completed ? 'text-gray-400 line-through' : 'font-medium'}`}>{task.text}</span>
                            <span className="shrink-0 text-[9px] font-bold uppercase text-gray-400">{task.priority}</span>
                        </button>
                    ))}
                </div>
            </MobileCard>

            <MobileCard>
                <h2 className="mb-3 text-sm font-bold">Critical site alerts</h2>
                <div className="space-y-2">
                    {ALERTS.map((alert) => (
                        <div key={alert.title} className={`rounded-xl border p-3 ${toneClasses[alert.tone]}`}>
                            <p className="text-[10px] font-extrabold uppercase tracking-wider">{alert.title}</p>
                            <p className="mt-1 text-xs leading-5">{alert.text}</p>
                        </div>
                    ))}
                </div>
            </MobileCard>

            <MobileCard>
                <div className="mb-3 flex items-center gap-2"><ShieldAlert size={18} aria-hidden="true" className="text-amber-500" /><h2 className="text-sm font-bold">Safety compliance</h2></div>
                <dl className="space-y-3 text-xs">
                    <div className="flex justify-between gap-4"><dt className="text-gray-500 dark:text-gh-muted">PPE check-in status</dt><dd className="text-right font-bold text-emerald-600 dark:text-emerald-400">Verified (08:30 AM)</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-gray-500 dark:text-gh-muted">Incident-free streak</dt><dd className="text-right font-bold">248 Days Clean</dd></div>
                </dl>
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"><strong>Wind advisory:</strong> Wind speeds expected to exceed 40 km/h after 2:30 PM. Secure crane operations and high scaffold boards.</p>
            </MobileCard>

            <MobileCard>
                <h2 className="mb-3 text-sm font-bold">Notice board</h2>
                <div className="space-y-3 text-xs leading-5">
                    <div><p className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">HR announcement</p><p className="font-bold">Quarterly Site-Audit Review Schedule</p><p className="text-gray-500 dark:text-gh-muted">Review sessions are planned from July 10 to July 15. Maintain task logs.</p></div>
                    <div className="border-t border-gray-100 pt-3 dark:border-gh-border"><p className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">Equipment notice</p><p className="font-bold">Concrete Batch Mixer Maintenance</p><p className="text-gray-500 dark:text-gh-muted">Batching mixer #2 will go offline tonight between 11 PM and 3 AM for scheduled checkups.</p></div>
                </div>
            </MobileCard>
        </div>
    );
}
