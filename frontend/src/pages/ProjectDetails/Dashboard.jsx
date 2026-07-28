import React, { useState, useEffect } from 'react';
import { 
    CheckCircle2, Clock, AlertTriangle, TrendingUp, Users, FileText, 
    Layers, Calendar, DollarSign, PieChart, Activity, ArrowUpRight, 
    Sparkles, Plus, ChevronRight, FileCheck, Briefcase, ShieldAlert, 
    Wrench, FolderKanban, Receipt, Package, HardHat, AlertCircle, ArrowRight, MapPin
} from 'lucide-react';
import { tasksApi } from '../../services/tasksApi';
import { projectApi } from '../../services/projectApi';
import { generalDocsApi } from '../../services/generalDocsApi';

const Dashboard = ({ project, setActiveTab, canWrite }) => {
    const [loading, setLoading] = useState(true);
    const [taskStats, setTaskStats] = useState({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        highPriority: 0,
        categories: []
    });
    const [teamMembers, setTeamMembers] = useState([]);
    const [staffCount, setStaffCount] = useState(0);
    const [vendorCount, setVendorCount] = useState(0);
    const [recentMoms, setRecentMoms] = useState([]);

    // Parse metadata
    let meta = {};
    if (project?.metadata) {
        try {
            meta = typeof project.metadata === 'string' ? JSON.parse(project.metadata) : project.metadata;
        } catch (e) {
            meta = {};
        }
    }

    const phases = meta.phases || [
        { name: 'Concept & Planning', progress: 100, status: 'Completed' },
        { name: 'Architectural & Structural Design', progress: 85, status: 'In Progress' },
        { name: 'Procurement & Vendor Onboarding', progress: 60, status: 'In Progress' },
        { name: 'Site Execution & Civil Works', progress: 40, status: 'In Progress' },
        { name: 'Quality, Testing & Handover', progress: 10, status: 'Pending' }
    ];

    const completion = meta.completion !== undefined ? meta.completion : 45;
    const projectIssues = meta.issues || 'None';
    const owner = meta.employer || 'System / Owner';

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!project?.id && !project?.dbId) return;
            const targetId = project.dbId || project.id;
            setLoading(true);

            try {
                // Fetch real-time tasks
                const tasksRes = await tasksApi.getTasks(targetId);
                const rawTasks = tasksRes?.tasks || tasksRes?.data || (Array.isArray(tasksRes) ? tasksRes : []);
                const categories = tasksRes?.categories || [];

                let completed = 0;
                let inProgress = 0;
                let pending = 0;
                let highPriority = 0;

                rawTasks.forEach(t => {
                    const st = (t.status || '').toLowerCase();
                    if (st.includes('done') || st.includes('complete')) completed++;
                    else if (st.includes('progress')) inProgress++;
                    else pending++;

                    if ((t.priority || '').toLowerCase() === 'high') highPriority++;
                });

                setTaskStats({
                    total: rawTasks.length,
                    completed,
                    inProgress,
                    pending,
                    highPriority,
                    categories
                });
            } catch (err) {
                console.error("Failed to load dashboard tasks data", err);
            }

            try {
                // Fetch real-time team members
                const membersRes = await projectApi.getProjectMembers(targetId);
                const membersList = membersRes?.members || (Array.isArray(membersRes) ? membersRes : []);
                setTeamMembers(membersList);
            } catch (err) {
                console.error("Failed to load dashboard members data", err);
            }

            try {
                // Fetch staff
                const staffRes = await generalDocsApi.getStaff(targetId);
                const staffList = staffRes?.staff || (Array.isArray(staffRes) ? staffRes : []);
                setStaffCount(staffList.length);
            } catch (err) {
                console.error("Failed to load dashboard staff data", err);
            }

            try {
                // Fetch vendors
                const vendorsRes = await generalDocsApi.getVendors(targetId);
                const vendorsList = vendorsRes?.vendors || (Array.isArray(vendorsRes) ? vendorsRes : []);
                setVendorCount(vendorsList.length);
            } catch (err) {
                console.error("Failed to load dashboard vendors data", err);
            }

            try {
                // Fetch MOMs
                const momsRes = await generalDocsApi.getMoms(targetId);
                const momsList = momsRes?.moms || (Array.isArray(momsRes) ? momsRes : []);
                setRecentMoms(momsList.slice(0, 4));
            } catch (err) {
                console.error("Failed to load dashboard MOMs data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [project]);

    // Financial Metrics (Static / Module ready format)
    const financialSummary = {
        contractValue: '$ 4,850,000',
        invoicedAmount: '$ 2,120,000',
        spentToDate: '$ 1,780,000',
        budgetMargin: '16.2%',
        utilizationPct: 43.7
    };

    // Drawing Discipline Stats
    const drawingDisciplines = [
        { name: 'Architectural', total: 24, approved: 20 },
        { name: 'Structural', total: 18, approved: 15 },
        { name: 'MEP Services', total: 14, approved: 10 },
        { name: 'Civil & Infrastructure', total: 10, approved: 8 }
    ];

    // Issues styling helper
    const getIssueBadge = (issue) => {
        switch ((issue || '').toLowerCase()) {
            case 'risk':
                return { bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertTriangle, label: 'Risk Flagged' };
            case 'blocked':
                return { bg: 'bg-red-500/10 text-red-500 border-red-500/20', icon: ShieldAlert, label: 'Blockers Reported' };
            case 'resolved':
                return { bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2, label: 'Resolved' };
            default:
                return { bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2, label: 'Healthy (No Issues)' };
        }
    };

    const issueInfo = getIssueBadge(projectIssues);
    const IssueIcon = issueInfo.icon;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar p-3.5 sm:p-4 bg-[#f8fafc] dark:bg-[#0d1117] space-y-4 text-left transition-colors">
            
            {/* ─── Top Welcome & Project Header Banner ─────────────────────────────── */}
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 dark:from-[#161b22] dark:via-[#1c2128] dark:to-[#161b22] p-4 sm:p-5 text-white shadow-md border border-blue-900/30">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-auto select-none" />
                
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                {project?.project_code || project?.id}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                                {project?.status || 'Active'}
                            </span>
                            <span className="text-xs text-slate-300 flex items-center gap-1 font-medium">
                                <MapPin size={13} className="text-blue-400 shrink-0" />
                                {project?.location || 'Main Site Location'}
                            </span>
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
                            {project?.name || 'Project Overview'}
                        </h1>
                        <p className="text-xs text-slate-300 font-medium">
                            Employer / Owner: <span className="text-white font-bold">{owner}</span>
                        </p>
                    </div>

                    {/* Quick Action Navigation Bar */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                            onClick={() => setActiveTab('Tasks')}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                        >
                            <FolderKanban size={15} />
                            <span>Tasks</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('Drawings')}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg border border-white/10 transition-all cursor-pointer"
                        >
                            <FileText size={15} />
                            <span>Drawings</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('Reports')}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg border border-white/10 transition-all cursor-pointer"
                        >
                            <Activity size={15} />
                            <span>Daily Report</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('Planning')}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg border border-white/10 transition-all cursor-pointer"
                        >
                            <TrendingUp size={15} />
                            <span>Planning</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Top KPI Executive Summary Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Overall Completion Progress */}
                <div className="p-5 rounded-lg bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Overall Completion</span>
                        <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            <PieChart size={18} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between mb-2">
                        <span className="text-2xl font-black text-gray-900 dark:text-white">{completion}%</span>
                        <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5">
                            <TrendingUp size={14} /> On Schedule
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-white/10 h-2.5 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-700" 
                            style={{ width: `${completion}%` }}
                        />
                    </div>
                </div>

                {/* 2. Real-Time Tasks Progress */}
                <div 
                    onClick={() => setActiveTab('Tasks')}
                    className="p-5 rounded-lg bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Task Progress</span>
                        <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={18} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between mb-2">
                        <span className="text-2xl font-black text-gray-900 dark:text-white">
                            {taskStats.completed} <span className="text-sm font-semibold text-gray-400">/ {taskStats.total}</span>
                        </span>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-0.5">
                            Manage <ChevronRight size={14} />
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        <span className="text-amber-500">{taskStats.inProgress} In Progress</span>
                        <span>•</span>
                        <span className="text-red-500">{taskStats.highPriority} High Priority</span>
                    </div>
                </div>

                {/* 3. Team & Staffing */}
                <div 
                    onClick={() => setActiveTab('General Documents')}
                    className="p-5 rounded-lg bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Team & Staffing</span>
                        <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                            <Users size={18} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between mb-2">
                        <span className="text-2xl font-black text-gray-900 dark:text-white">
                            {teamMembers.length || project?.memberCount || 0} <span className="text-xs font-bold text-gray-400">Members</span>
                        </span>
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:underline flex items-center gap-0.5">
                            Details <ChevronRight size={14} />
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        <span>{staffCount} Staff Roles</span>
                        <span>•</span>
                        <span>{vendorCount} Vendors</span>
                    </div>
                </div>

                {/* 4. Health & Risk Status */}
                <div className="p-5 rounded-lg bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Health & Issues</span>
                        <div className={`p-2 rounded-md border ${issueInfo.bg}`}>
                            <IssueIcon size={18} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between mb-2">
                        <span className="text-lg font-extrabold text-gray-900 dark:text-white">
                            {issueInfo.label}
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-medium">
                        Real-time site issue & blocker tracking
                    </p>
                </div>

            </div>

            {/* ─── Main 2-Column Analytics Layout ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* ─── LEFT COLUMN (2/3 width) ──────────────────────────────────────── */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Phase Progress Timeline */}
                    <div className="p-6 rounded-lg bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/5 shadow-sm">
                        <div className="flex justify-between items-center mb-5">
                            <div>
                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Project Phases Timeline</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Stage breakdown & milestone completion percentage</p>
                            </div>
                            <button
                                onClick={() => setActiveTab('Phases')}
                                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                View Phases <ArrowRight size={14} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {phases.map((ph, idx) => (
                                <div key={idx} className="space-y-1.5">
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] flex justify-center items-center font-bold">
                                                {idx + 1}
                                            </span>
                                            {ph.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                ph.progress === 100 
                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' 
                                                    : ph.progress > 0 
                                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400' 
                                                    : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                                            }`}>
                                                {ph.status || (ph.progress === 100 ? 'Completed' : ph.progress > 0 ? 'In Progress' : 'Pending')}
                                            </span>
                                            <span className="text-gray-900 dark:text-white w-10 text-right">{ph.progress}%</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                ph.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                                            }`} 
                                            style={{ width: `${ph.progress}%` }} 
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financial & Contracts Overview */}
                    <div className="p-6 rounded-lg bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/5 shadow-sm">
                        <div className="flex justify-between items-center mb-5">
                            <div>
                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Financial & Budget Summary</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Contract value, billing status & budget utilization</p>
                            </div>
                            <button
                                onClick={() => setActiveTab('Contracts')}
                                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                Billing & Contracts <ArrowRight size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                            <div className="p-3.5 rounded-md bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Contract Value</p>
                                <p className="text-base font-extrabold text-gray-900 dark:text-white">{financialSummary.contractValue}</p>
                            </div>
                            <div className="p-3.5 rounded-md bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Invoiced Amount</p>
                                <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{financialSummary.invoicedAmount}</p>
                            </div>
                            <div className="p-3.5 rounded-md bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Spent to Date</p>
                                <p className="text-base font-extrabold text-blue-600 dark:text-blue-400">{financialSummary.spentToDate}</p>
                            </div>
                            <div className="p-3.5 rounded-md bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Est. Profit Margin</p>
                                <p className="text-base font-extrabold text-purple-600 dark:text-purple-400">{financialSummary.budgetMargin}</p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-gray-600 dark:text-gray-400">Budget Utilization Rate</span>
                                <span className="text-gray-900 dark:text-white">{financialSummary.utilizationPct}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className="bg-purple-600 h-full rounded-full" style={{ width: `${financialSummary.utilizationPct}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* Technical Drawings & Documents Disciplines */}
                    <div className="p-6 rounded-lg bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/5 shadow-sm">
                        <div className="flex justify-between items-center mb-5">
                            <div>
                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Drawings & Technical Documents</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Engineering drawing approvals across disciplines</p>
                            </div>
                            <button
                                onClick={() => setActiveTab('Drawings')}
                                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                Open Drawings <ArrowRight size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {drawingDisciplines.map((item, dIdx) => {
                                const pct = Math.round((item.approved / item.total) * 100);
                                return (
                                    <div key={dIdx} className="p-4 rounded-md border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{item.name}</span>
                                            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                                                {item.approved} / {item.total} Approved
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* ─── RIGHT COLUMN (1/3 width) ─────────────────────────────────────── */}
                <div className="space-y-6">
                    
                    {/* Real-time Team Members List */}
                    <div className="p-6 rounded-lg bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/5 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Assigned Team</h3>
                            <button
                                onClick={() => setActiveTab('General Documents')}
                                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                                View All
                            </button>
                        </div>

                        {teamMembers.length === 0 ? (
                            <div className="py-6 text-center text-xs text-gray-400 font-medium">
                                No specific team members assigned yet
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {teamMembers.slice(0, 5).map((m, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex justify-center items-center text-xs font-bold text-white shadow-sm shrink-0">
                                            {(m.name || m.username || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                {m.name || m.username || 'Team Member'}
                                            </p>
                                            <p className="text-[10px] text-gray-400 truncate">
                                                {m.role || m.user_type || 'Project Member'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Meeting Minutes (MOM) & Logs */}
                    <div className="p-6 rounded-lg bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/5 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Recent Meetings (MOM)</h3>
                            <button
                                onClick={() => setActiveTab('General Documents')}
                                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                                View MOMs
                            </button>
                        </div>

                        {recentMoms.length === 0 ? (
                            <div className="p-4 text-center rounded-md bg-gray-50 dark:bg-white/[0.01] text-xs text-gray-400">
                                No meeting minutes recorded yet
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentMoms.map((mom, idx) => (
                                    <div key={idx} className="p-3 rounded-md border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">
                                                {mom.title || `Meeting #${mom.id}`}
                                            </span>
                                            <span className="text-[10px] font-mono text-gray-400 shrink-0">
                                                {mom.meeting_date ? new Date(mom.meeting_date).toLocaleDateString() : 'Recent'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                                            {mom.location || mom.attendees || 'Site Progress Review'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Access Modules Bar */}
                    <div className="p-6 rounded-lg bg-gradient-to-br from-blue-900 to-indigo-950 text-white shadow-xl space-y-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="text-blue-300" size={18} />
                            <h4 className="text-sm font-extrabold">Quick Project Modules</h4>
                        </div>
                        <p className="text-xs text-blue-200">
                            Jump straight to key management modules for this project.
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                            <button
                                onClick={() => setActiveTab('WIP')}
                                className="p-2.5 rounded-md bg-white/10 hover:bg-white/20 transition-all text-left flex items-center justify-between cursor-pointer"
                            >
                                <span>WIP Progress</span>
                                <ChevronRight size={14} />
                            </button>
                            <button
                                onClick={() => setActiveTab('Quality')}
                                className="p-2.5 rounded-md bg-white/10 hover:bg-white/20 transition-all text-left flex items-center justify-between cursor-pointer"
                            >
                                <span>Quality (QA/QC)</span>
                                <ChevronRight size={14} />
                            </button>
                            <button
                                onClick={() => setActiveTab('Safety')}
                                className="p-2.5 rounded-md bg-white/10 hover:bg-white/20 transition-all text-left flex items-center justify-between cursor-pointer"
                            >
                                <span>HSE & Safety</span>
                                <ChevronRight size={14} />
                            </button>
                            <button
                                onClick={() => setActiveTab('Approvals')}
                                className="p-2.5 rounded-md bg-white/10 hover:bg-white/20 transition-all text-left flex items-center justify-between cursor-pointer"
                            >
                                <span>Approvals</span>
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
};

export default Dashboard;
