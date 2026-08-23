import React, { useState } from 'react';
import { 
    BarChart3, AlertTriangle, CheckCircle, Clock, Users, DollarSign,
    Briefcase, ShieldAlert, Award, FileText, CheckSquare, Plus, ArrowUpRight,
    Play, Calendar, Activity, ChevronRight, TrendingUp, Compass, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DashboardCard = ({ title, value, subtext, icon: Icon, color, index }) => (
    <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        whileHover={{ y: -3, transition: { duration: 0.15 } }}
        className="bg-white dark:bg-gh-subtle p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gh-border transition-colors relative overflow-hidden group cursor-default"
    >
        <div className="flex justify-between items-start">
            <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2 transition-colors">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg bg-gradient-to-br ${color} text-white shadow-md shadow-gray-200 dark:shadow-none`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
        <div className="flex items-center gap-1 mt-4 text-xs text-gray-500 dark:text-[#7A8AAB]">
            <span className="font-medium">{subtext}</span>
        </div>
        
        {/* Hover light highlight */}
        <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-transparent via-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </motion.div>
);

const Dashboard = () => {
    const { user, isAdmin, isClient, hasPermission } = useAuth();
    const navigate = useNavigate();
    
    // Interactive daily tasks checklist
    const [tasks, setTasks] = useState([
        { id: 1, text: 'Verify structural layout alignment (Grid A-D)', completed: true, priority: 'High' },
        { id: 2, text: 'Draft Daily Progress Report for Metro Station', completed: false, priority: 'Medium' },
        { id: 3, text: 'Review concrete slump test laboratory results', completed: false, priority: 'High' },
        { id: 4, text: 'Coordinate vendor delivery slots for reinforcement steel', completed: true, priority: 'Low' },
        { id: 5, text: 'Conduct weekly pre-start safety briefing with sub-teams', completed: false, priority: 'High' }
    ]);

    const toggleTask = (id) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    return (
        <div className="p-4 space-y-4 w-full text-left">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <DashboardCard
                    title="Total Contract Value"
                    value="₹69.7L"
                    subtext="+2.4% vs last month"
                    icon={BarChart3}
                    color="from-blue-500 to-indigo-600"
                    index={0}
                />
                <DashboardCard
                    title="Active Projects"
                    value="12"
                    subtext="3 critical, 4 delayed"
                    icon={Clock}
                    color="from-amber-500 to-orange-600"
                    index={1}
                />
                <DashboardCard
                    title="Pending Approvals"
                    value="8"
                    subtext="Avg wait time: 1.2 days"
                    icon={AlertTriangle}
                    color="from-rose-500 to-red-600"
                    index={2}
                />
                <DashboardCard
                    title="Quality Score"
                    value="94%"
                    subtext="Top 5% of industry"
                    icon={CheckCircle}
                    color="from-emerald-500 to-green-600"
                    index={3}
                />
            </div>

            {/* Two Column Main Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column: Project Health Table & Daily Task Checklist */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Project Health Table */}
                    <div className="bg-white dark:bg-gh-subtle rounded-xl shadow-sm border border-gray-100 dark:border-gh-border p-6 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">Project Health Overview</h2>
                            {hasPermission('projects', 1) && (
                                <button 
                                    onClick={() => navigate('/projects')}
                                    className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 font-semibold flex items-center gap-0.5 cursor-pointer"
                                >
                                    View all <ChevronRight size={14} />
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 dark:border-gh-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        <th className="pb-3">Project Name</th>
                                        <th className="pb-3">Status</th>
                                        <th className="pb-3">Progress</th>
                                        <th className="pb-3 text-right">Cost Variance</th>
                                        <th className="pb-3 text-right">Due Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gh-border text-sm text-gray-600 dark:text-[#7A8AAB]">
                                    <tr className="group hover:bg-gray-50 dark:hover:bg-gh-hover transition-colors">
                                        <td className="py-4 font-semibold text-gray-900 dark:text-white">Metro Station B2</td>
                                        <td className="py-4">
                                            <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-semibold">
                                                On Track
                                            </span>
                                        </td>
                                        <td className="py-4 w-1/4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                                                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: '65%' }}></div>
                                                </div>
                                                <span className="text-xs font-bold w-8">65%</span>
                                            </div>
                                        </td>
                                        <td className="py-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">-₹1.2L</td>
                                        <td className="py-4 text-right text-xs">Dec 2026</td>
                                    </tr>
                                    <tr className="group hover:bg-gray-50 dark:hover:bg-gh-hover transition-colors">
                                        <td className="py-4 font-semibold text-gray-900 dark:text-white">Skyline Tower</td>
                                        <td className="py-4">
                                            <span className="px-2.5 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full text-xs font-semibold">
                                                Delayed
                                            </span>
                                        </td>
                                        <td className="py-4 w-1/4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                                                    <div className="bg-rose-500 h-2 rounded-full transition-all duration-500" style={{ width: '42%' }}></div>
                                                </div>
                                                <span className="text-xs font-bold w-8">42%</span>
                                            </div>
                                        </td>
                                        <td className="py-4 text-right font-semibold text-rose-600 dark:text-rose-400">+₹45.0L</td>
                                        <td className="py-4 text-right text-xs">Aug 2026</td>
                                    </tr>
                                    <tr className="group hover:bg-gray-50 dark:hover:bg-gh-hover transition-colors">
                                        <td className="py-4 font-semibold text-gray-900 dark:text-white">City Bridge Repair</td>
                                        <td className="py-4">
                                            <span className="px-2.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-xs font-semibold">
                                                At Risk
                                            </span>
                                        </td>
                                        <td className="py-4 w-1/4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                                                    <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: '88%' }}></div>
                                                </div>
                                                <span className="text-xs font-bold w-8">88%</span>
                                            </div>
                                        </td>
                                        <td className="py-4 text-right font-semibold text-gray-600 dark:text-white">₹0.0</td>
                                        <td className="py-4 text-right text-xs">Mar 2026</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Daily Task Checklist */}
                    <div className="bg-white dark:bg-gh-subtle rounded-xl shadow-sm border border-gray-100 dark:border-gh-border p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <CheckSquare className="w-5 h-5 text-blue-500" />
                                <h2 className="text-base font-bold text-gray-900 dark:text-white">Daily Operational Checklist</h2>
                            </div>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                                {tasks.filter(t => t.completed).length} / {tasks.length} Completed
                            </span>
                        </div>

                        <div className="divide-y divide-gray-50 dark:divide-gh-border space-y-1">
                            {tasks.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => toggleTask(t.id)}
                                    className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gh-hover transition-colors cursor-pointer group"
                                >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${t.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-white/20'}`}>
                                        {t.completed && (
                                            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="1,4 3.5,6.5 9,1" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-sm flex-1 truncate transition-all ${t.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-white font-medium'}`}>
                                        {t.text}
                                    </span>
                                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                                        t.priority === 'High' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                                        t.priority === 'Medium' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                        'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {t.priority}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Alerts, Safety & Notices */}
                <div className="space-y-4">
                    {/* Alerts / Notifications */}
                    <div className="bg-white dark:bg-gh-subtle rounded-xl shadow-sm border border-gray-100 dark:border-gh-border p-6 transition-colors">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Critical Site Alerts</h2>
                        <div className="space-y-3">
                            <div className="flex items-start p-3.5 bg-rose-50 dark:bg-rose-500/5 rounded-lg border border-rose-100/50 dark:border-rose-500/20">
                                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 mr-3" />
                                <div>
                                    <h4 className="text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider">Safety Incident</h4>
                                    <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">Site B - Fall hazard detected near Grid B. Immediate corrective action required.</p>
                                </div>
                            </div>
                            <div className="flex items-start p-3.5 bg-amber-50 dark:bg-amber-500/5 rounded-lg border border-amber-100/50 dark:border-amber-500/20">
                                <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 mr-3" />
                                <div>
                                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Material Delay</h4>
                                    <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">Skyline Tower - Cement carrier delayed by local logistics check. ETA updated to 4PM.</p>
                                </div>
                            </div>
                            <div className="flex items-start p-3.5 bg-emerald-50 dark:bg-emerald-500/5 rounded-lg border border-emerald-100/50 dark:border-emerald-500/20">
                                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 mr-3" />
                                <div>
                                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Audit Cleared</h4>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-1">Metro Station - Structural foundation load test approved by independent audit engineer.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Safety compliance Panel */}
                    <div className="bg-white dark:bg-gh-subtle rounded-xl shadow-sm border border-gray-100 dark:border-gh-border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldAlert className="text-amber-500 w-5 h-5" />
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">Safety Compliance</h2>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 dark:text-[#7A8AAB]">PPE Check-in status</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Verified (08:30 AM)</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 dark:text-[#7A8AAB]">Incident-free streak</span>
                                <span className="font-semibold text-gray-800 dark:text-white">248 Days Clean</span>
                            </div>
                            <div className="p-3 bg-amber-500/5 border border-amber-500/25 rounded-lg text-xs text-amber-700 dark:text-amber-400 mt-1">
                                <strong>Wind Advisory:</strong> Wind speeds expected to exceed 40 km/h after 2:30 PM. Secure crane operations & high scaffold boards.
                            </div>
                        </div>
                    </div>

                    {/* Announcement card */}
                    <div className="bg-white dark:bg-gh-subtle rounded-xl shadow-sm border border-gray-100 dark:border-gh-border p-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">Notice Board</h2>
                        <div className="text-xs space-y-3">
                            <div className="pb-3 border-b border-gray-100 dark:border-gh-border">
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">HR Announcement</span>
                                <p className="font-semibold text-gray-950 dark:text-white mt-0.5">Quarterly Site-Audit Review Schedule</p>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">Review sessions are planned from July 10 to July 15. Maintain task logs.</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Equipment notice</span>
                                <p className="font-semibold text-gray-950 dark:text-white mt-0.5">Concrete Batch Mixer Maintenance</p>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">Batching mixer #2 will go offline tonight between 11 PM and 3 AM for scheduled checkups.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
