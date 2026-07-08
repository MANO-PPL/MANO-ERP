import React, { useState } from 'react';
import { 
    BarChart3, AlertTriangle, CheckCircle, Clock, Users, DollarSign,
    Briefcase, ShieldAlert, Award, FileText, CheckSquare, Plus, ArrowUpRight,
    Play, Calendar, Activity, ChevronRight, TrendingUp, Compass, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const DashboardCard = ({ title, value, subtext, icon: Icon, color, index }) => (
    <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        whileHover={{ y: -3, transition: { duration: 0.15 } }}
        className="bg-white dark:bg-[#1A2232] p-6 rounded-xl shadow-sm border border-gray-100 dark:border-[#2A3445] transition-colors relative overflow-hidden group cursor-default"
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
    const { user } = useAuth();
    const role = (user?.user_type || '').toLowerCase();
    
    const isAdmin = ['admin', 'super admin', 'superadmin', 'super_admin'].includes(role);
    const isClient = role === 'client';
    
    // Checklist state for employee dashboard
    const [employeeTasks, setEmployeeTasks] = useState([
        { id: 1, text: 'Verify structural layout alignment (Grid A-D)', completed: true, priority: 'High' },
        { id: 2, text: 'Draft Daily Progress Report for Metro Station', completed: false, priority: 'Medium' },
        { id: 3, text: 'Review concrete slump test laboratory results', completed: false, priority: 'High' },
        { id: 4, text: 'Coordinate vendor delivery slots for reinforcement steel', completed: true, priority: 'Low' },
        { id: 5, text: 'Conduct weekly pre-start safety briefing with sub-teams', completed: false, priority: 'High' }
    ]);

    const toggleTask = (id) => {
        setEmployeeTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    // Render Admin Layout
    if (isAdmin || role === '') {
        return (
            <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Operations Control</h1>
                        <p className="text-xs text-gray-500 dark:text-[#7A8AAB]">Real-time organization-wide project metrics & financials</p>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

                {/* Two Column Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Project Health Table */}
                    <div className="lg:col-span-2 bg-white dark:bg-[#1A2232] rounded-xl shadow-sm border border-gray-100 dark:border-[#2A3445] p-6 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">Project Health Overview</h2>
                            <button className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                                View all <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 dark:border-[#2A3445] text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        <th className="pb-3">Project Name</th>
                                        <th className="pb-3">Status</th>
                                        <th className="pb-3">Progress</th>
                                        <th className="pb-3 text-right">Cost Variance</th>
                                        <th className="pb-3 text-right">Due Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-[#2A3445] text-sm text-gray-600 dark:text-[#7A8AAB]">
                                    <tr className="group hover:bg-gray-50 dark:hover:bg-[#202A3C] transition-colors">
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
                                    <tr className="group hover:bg-gray-50 dark:hover:bg-[#202A3C] transition-colors">
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
                                    <tr className="group hover:bg-gray-50 dark:hover:bg-[#202A3C] transition-colors">
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

                    {/* Alerts / Notifications */}
                    <div className="bg-white dark:bg-[#1A2232] rounded-xl shadow-sm border border-gray-100 dark:border-[#2A3445] p-6 transition-colors">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Critical Site Alerts</h2>
                        <div className="space-y-4">
                            <div className="flex items-start p-4 bg-rose-50 dark:bg-rose-500/5 rounded-lg border border-rose-100/50 dark:border-rose-500/20">
                                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 mr-3" />
                                <div>
                                    <h4 className="text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider">Safety Incident</h4>
                                    <p className="text-xs text-rose-600 dark:text-gray-400 mt-1">Site B - Fall hazard detected near Grid B. Immediate corrective action required.</p>
                                </div>
                            </div>
                            <div className="flex items-start p-4 bg-amber-50 dark:bg-amber-500/5 rounded-lg border border-amber-100/50 dark:border-amber-500/20">
                                <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 mr-3" />
                                <div>
                                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Material Delay</h4>
                                    <p className="text-xs text-amber-600 dark:text-gray-400 mt-1">Skyline Tower - Cement carrier delayed by local logistics check. ETA updated to 4PM.</p>
                                </div>
                            </div>
                            <div className="flex items-start p-4 bg-emerald-50 dark:bg-emerald-500/5 rounded-lg border border-emerald-100/50 dark:border-emerald-500/20">
                                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 mr-3" />
                                <div>
                                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Audit Cleared</h4>
                                    <p className="text-xs text-emerald-600 dark:text-gray-400 mt-1">Metro Station - Structural foundation load test approved by independent audit engineer.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render Client Layout
    if (isClient) {
        return (
            <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Client Progress Center</h1>
                        <p className="text-xs text-gray-500 dark:text-[#7A8AAB]">High-level project roadmap, milestones, and shared updates</p>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <DashboardCard
                        title="Active Under Construction"
                        value="3 Projects"
                        subtext="Metro B2, Skyline, City Bridge"
                        icon={Briefcase}
                        color="from-indigo-500 to-blue-600"
                        index={0}
                    />
                    <DashboardCard
                        title="Average Progress"
                        value="74.2%"
                        subtext="Overall target pace reached"
                        icon={TrendingUp}
                        color="from-emerald-500 to-teal-600"
                        index={1}
                    />
                    <DashboardCard
                        title="Budget Consumed"
                        value="41.6%"
                        subtext="₹519.3L of total budget"
                        icon={DollarSign}
                        color="from-purple-500 to-indigo-600"
                        index={2}
                    />
                    <DashboardCard
                        title="Audit Compliance"
                        value="98.5%"
                        subtext="Zero critical infractions"
                        icon={Award}
                        color="from-sky-500 to-blue-600"
                        index={3}
                    />
                </div>

                {/* Main section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Milestone Roadmap */}
                    <div className="lg:col-span-2 bg-white dark:bg-[#1A2232] rounded-xl shadow-sm border border-gray-100 dark:border-[#2A3445] p-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-6">Upcoming Milestone Roadmap</h2>
                        <div className="relative border-l border-gray-100 dark:border-[#2A3445] ml-4 pl-6 space-y-6">
                            
                            {/* Milestone 1 */}
                            <div className="relative">
                                <div className="absolute -left-[31px] top-0.5 bg-emerald-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md shadow-emerald-500/20">
                                    ✓
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-gray-950 dark:text-white">Milestone 1 — Civil Excavation & Foundation</h3>
                                        <span className="px-2 py-0.5 text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold rounded">Completed</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Excavation, mudmat laying, and foundation reinforcement piling finished. Inspected & certified.</p>
                                    <p className="text-[10px] text-gray-400">Certified date: June 18, 2026</p>
                                </div>
                            </div>

                            {/* Milestone 2 */}
                            <div className="relative">
                                <div className="absolute -left-[31px] top-0.5 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md shadow-blue-500/20 animate-pulse">
                                    •
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-gray-950 dark:text-white">Milestone 2 — Main Slab Casting (Level 1-3)</h3>
                                        <span className="px-2 py-0.5 text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold rounded">In Progress (68%)</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Concrete pouring and structural pillars construction for level 1 and 2 completed. Level 3 formwork ongoing.</p>
                                    <p className="text-[10px] text-gray-400">Target date: August 15, 2026</p>
                                </div>
                            </div>

                            {/* Milestone 3 */}
                            <div className="relative">
                                <div className="absolute -left-[31.5px] top-1 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A2232] rounded-full w-4.5 h-4.5 flex items-center justify-center text-[10px] font-bold" />
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-gray-500 dark:text-[#7A8AAB]">Milestone 3 — MEP Rough-Ins & Piping</h3>
                                        <span className="px-2 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 rounded">Scheduled</span>
                                    </div>
                                    <p className="text-xs text-gray-400">Installation of electrical conduit tubing, drainage pipes, and HVAC venting layout structures.</p>
                                    <p className="text-[10px] text-gray-400">Target date: October 20, 2026</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Shared docs / approvals */}
                    <div className="bg-white dark:bg-[#1A2232] rounded-xl shadow-sm border border-gray-100 dark:border-[#2A3445] p-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Pending Client Actions</h2>
                        <div className="space-y-4">
                            
                            <div className="p-4 bg-blue-500/5 hover:bg-blue-500/10 rounded-lg border border-blue-500/20 transition-all group cursor-pointer">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Approval Required</h4>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-1">Invoice Payment Request #4</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Milestone 1 release billing authorization: $450,000.</p>
                                    </div>
                                    <ArrowUpRight size={16} className="text-blue-500 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-[#202A3C] rounded-lg border border-gray-200 dark:border-[#2A3445]">
                                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recent Documents Shared</h4>
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-[#7A8AAB]">
                                        <FileText size={14} className="text-indigo-500" />
                                        <span className="font-medium underline truncate cursor-pointer hover:text-indigo-500">Structural_Design_Approval_v2.pdf</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-[#7A8AAB]">
                                        <FileText size={14} className="text-indigo-500" />
                                        <span className="font-medium underline truncate cursor-pointer hover:text-indigo-500">Concrete_Quality_Audit_July.pdf</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render Employee Layout
    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Workspace Dashboard</h1>
                    <p className="text-xs text-gray-500 dark:text-[#7A8AAB]">My assigned tasks, safety check-in, and site activities</p>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard
                    title="My Pending Tasks"
                    value={employeeTasks.filter(t => !t.completed).length.toString()}
                    subtext="3 high-priority, 2 review"
                    icon={CheckSquare}
                    color="from-blue-500 to-indigo-600"
                    index={0}
                />
                <DashboardCard
                    title="Hours Logged Today"
                    value="6.5 / 8.0 hrs"
                    subtext="Synced to timesheet"
                    icon={Activity}
                    color="from-teal-500 to-emerald-600"
                    index={1}
                />
                <DashboardCard
                    title="Workspace Safety"
                    value="Accident-Free"
                    subtext="248 days streak counter"
                    icon={ShieldCheck}
                    color="from-emerald-500 to-green-600"
                    index={2}
                />
                <DashboardCard
                    title="Tasks Done This Week"
                    value="14 tasks"
                    subtext="+4 compared to avg"
                    icon={CheckCircle}
                    color="from-purple-500 to-indigo-600"
                    index={3}
                />
            </div>

            {/* Content body */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Task Checklist */}
                <div className="lg:col-span-2 bg-white dark:bg-[#1A2232] rounded-xl shadow-sm border border-gray-100 dark:border-[#2A3445] p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">My Daily Task Checklist</h2>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                            {employeeTasks.filter(t => t.completed).length} / {employeeTasks.length} Completed
                        </span>
                    </div>

                    <div className="divide-y divide-gray-50 dark:divide-[#2A3445] space-y-1">
                        {employeeTasks.map(t => (
                            <div 
                                key={t.id} 
                                onClick={() => toggleTask(t.id)}
                                className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-[#202A3C] transition-colors cursor-pointer group"
                            >
                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${t.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-white/20'}`}>
                                    {t.completed && (
                                        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="1,4 3.5,6.5 9,1" />
                                        </svg>
                                    )}
                                </div>
                                <span className={`text-sm flex-1 truncate transition-all ${t.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-white'}`}>
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

                {/* Safety check and announcements */}
                <div className="space-y-6">
                    
                    {/* Safety compliance Panel */}
                    <div className="bg-white dark:bg-[#1A2232] rounded-xl shadow-sm border border-gray-100 dark:border-[#2A3445] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldAlert className="text-amber-500 w-5 h-5" />
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">Safety Compliance</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 dark:text-[#7A8AAB]">PPE Check-in status</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Verified (08:30 AM)</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 dark:text-[#7A8AAB]">Incidents streaks</span>
                                <span className="font-semibold text-gray-800 dark:text-white">248 Days Clean</span>
                            </div>
                            <div className="p-3 bg-amber-500/5 border border-amber-500/25 rounded-lg text-xs text-amber-700 dark:text-amber-400 mt-2">
                                <strong>Wind Advisory:</strong> Wind speeds expected to exceed 40 km/h after 2:30 PM. Secure crane operations & high pile scaffold boards.
                            </div>
                        </div>
                    </div>

                    {/* Announcement card */}
                    <div className="bg-white dark:bg-[#1A2232] rounded-xl shadow-sm border border-gray-100 dark:border-[#2A3445] p-6">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">Notice Board</h2>
                        <div className="text-xs space-y-3">
                            <div className="pb-3 border-b border-gray-100 dark:border-[#2A3445]">
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">HR Announcement</span>
                                <p className="font-semibold text-gray-950 dark:text-white mt-0.5">Quarterly Site-Audit Review Schedule</p>
                                <p className="text-gray-400 mt-1">Review sessions are planned from July 10 to July 15. Maintain task logs.</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Equipment notice</span>
                                <p className="font-semibold text-gray-950 dark:text-white mt-0.5">Concrete Batch Mixer Maintenance</p>
                                <p className="text-gray-400 mt-1">Batching mixer #2 will go offline tonight between 11 PM and 3 AM for scheduled checkups.</p>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default Dashboard;
