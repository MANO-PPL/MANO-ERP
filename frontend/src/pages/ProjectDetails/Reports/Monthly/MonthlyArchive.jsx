import React from 'react';
import { 
    BarChart3, Download, Zap, Clock, ChevronRight, Info, Sparkles, 
    ShieldCheck, X, AlignLeft, Calendar, Users, Cloud, Target, 
    ArrowUpRight, ArrowLeft, ArrowRight, Eye, MoreHorizontal, CheckCircle,
    Presentation, Package, Activity, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Donut Chart Component (Premium SVG with Framer Motion) ---
const DonutChart = ({ data, title, totalLabel }) => {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    if (total === 0) return null;
    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-white/[0.03] rounded-3xl border border-gray-100 dark:border-white/5"
        >
            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">{title}</h5>
            <div className="relative w-48 h-48">
                <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                    {data.map((slice, i) => {
                        const startPercent = cumulativePercent;
                        const slicePercent = slice.value / total;
                        cumulativePercent += slicePercent;

                        const [startX, startY] = getCoordinatesForPercent(startPercent);
                        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                        const largeArcFlag = slicePercent > 0.5 ? 1 : 0;
                        const pathData = `M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;

                        return (
                            <motion.path
                                key={i}
                                d={pathData}
                                fill={slice.color}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="hover:opacity-80 transition-opacity cursor-pointer"
                            />
                        );
                    })}
                    <circle r="0.7" fill="currentColor" className="text-white dark:text-[#0d1117]" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{totalLabel}</span>
                    <span className="text-lg font-black text-gray-900 dark:text-white">₹{(total / 100000).toFixed(2)}L</span>
                </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                {data.map((slice, i) => (
                    <div key={i} className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-400 uppercase truncate max-w-[100px]">{slice.label}</span>
                            <span className="text-[10px] font-black text-gray-900 dark:text-white">₹{(slice.value / 1000).toFixed(1)}k</span>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};
import AISummaryDrawer from '../AISummaryDrawer';
import PPTEditor from './PPTEditor';

const MonthlyArchive = ({ filters, setSubBreadcrumb, view, setView }) => {
    const [selectedReport, setSelectedReport] = React.useState(null);
    const [showDrawer, setShowDrawer] = React.useState(false);
    const [selectedAuditReport, setSelectedAuditReport] = React.useState(null);
    const [selectedAiReport, setSelectedAiReport] = React.useState(null);
    const [isProgressionExpanded, setIsProgressionExpanded] = React.useState(false);
    const [isLabourChartExpanded, setIsLabourChartExpanded] = React.useState(false);
    const [isMaterialChartExpanded, setIsMaterialChartExpanded] = React.useState(false);
    const [isPptMode, setIsPptMode] = React.useState(false);

    // Mock data generation for February 2026 - Synchronized with Weekly/Daily Phase Logic
    const generateMonthlyData = () => {
        const tasks = [
            { id: 1, name: 'Excavation for footings', unit: 'cum', totalQty: 5000, plannedMonthly: 1200 },
            { id: 2, name: 'PCC for footings', unit: 'cum', totalQty: 1200, plannedMonthly: 400 },
            { id: 3, name: 'Site Clearing & Levelling', unit: 'sqm', totalQty: 15000, plannedMonthly: 5000 },
            { id: 4, name: 'Anti-termite Treatment', unit: 'sqm', totalQty: 8000, plannedMonthly: 2000 }
        ];

        // Generate 4 weeks for February with detailed financial audits
        const weeks = [];
        for (let w = 0; w < 4; w++) {
            const weekNum = w + 5;
            const startDate = new Date('2026-02-01');
            startDate.setDate(startDate.getDate() + w * 7);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);

            // Generate weekly financial breakdown - Detailed for Pie Chart distribution
            const weeklyLabour = [
                { trade: '"U" Know Urban (Labour)', predicted: 145000, actual: 142000 + (Math.random() * 5000), color: '#3b82f6' },
                { trade: 'T Apple (Masons)', predicted: 95000, actual: 98000 + (Math.random() * 4000), color: '#6366f1' },
                { trade: 'SW Design Studio (Tech)', predicted: 55000, actual: 52000 + (Math.random() * 3000), color: '#8b5cf6' },
                { trade: 'Site Supervision', predicted: 40000, actual: 42000 + (Math.random() * 1000), color: '#ec4899' }
            ];

            const weeklyMaterials = [
                { item: 'OPC Cement', predicted: 180000, actual: 175000 + (Math.random() * 8000), color: '#f59e0b' },
                { item: 'TMT Steel', predicted: 240000, actual: 255000 + (Math.random() * 10000), color: '#ef4444' },
                { item: 'River Sand', predicted: 95000, actual: 92000 + (Math.random() * 4000), color: '#10b981' },
                { item: 'Gravel / Aggregates', predicted: 110000, actual: 108000 + (Math.random() * 5000), color: '#06b6d4' }
            ];

            weeks.push({
                week: `Week ${weekNum}`,
                dateRange: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                completion: 35 + (w * 15) + Math.floor(Math.random() * 10),
                weather: ['Sunny', 'Cloudy', 'Rainy', 'Windy'][Math.floor(Math.random() * 4)],
                labour: weeklyLabour,
                materials: weeklyMaterials
            });
        }

        const items = tasks.map((task, idx) => {
            const plannedTotal = task.plannedMonthly;
            const weeklyBreakdown = Array.from({ length: 4 }, () => Math.round((plannedTotal / 4) * (0.8 + Math.random() * 0.4)));
            const executedTotal = weeklyBreakdown.reduce((s, i) => s + i, 0);
            
            const startDay = (idx * 3) + 1;
            const endDay = Math.min(28, startDay + 22 + Math.floor(Math.random() * 4));
            const actualStartOffset = Math.floor(Math.random() * 2);
            const actualEndOffset = Math.floor(Math.random() * 3) - 2;

            return {
                task: task.name,
                unit: task.unit,
                totalQty: task.totalQty,
                plannedQty: plannedTotal,
                executedQty: executedTotal,
                weeklyBreakdown,
                variance: (((executedTotal - plannedTotal) / plannedTotal) * 100).toFixed(1),
                duration: `${20 + idx * 2} Working Days`,
                completionPercentage: Math.min(100, Math.round((executedTotal / plannedTotal) * 100)),
                plannedStart: `Feb ${startDay < 10 ? '0' + startDay : startDay}, 2026`,
                actualStart: `Feb ${(startDay + actualStartOffset) < 10 ? '0' + (startDay + actualStartOffset) : (startDay + actualStartOffset)}, 2026`,
                plannedEnd: `Feb ${endDay < 10 ? '0' + endDay : endDay}, 2026`,
                actualEnd: `Feb ${(endDay + actualEndOffset) < 10 ? '0' + (endDay + actualEndOffset) : (endDay + actualEndOffset)}, 2026`
            };
        });

        // Calculate dynamic summary metrics
        const totalActualCost = weeks.reduce((acc, w) => {
            const lTotal = w.labour.reduce((sum, l) => sum + l.actual, 0);
            const mTotal = w.materials.reduce((sum, m) => sum + m.actual, 0);
            return acc + lTotal + mTotal;
        }, 0);

        const avgProgress = Math.round(items.reduce((acc, item) => acc + item.completionPercentage, 0) / items.length);
        const totalPlannedQty = items.reduce((acc, i) => acc + i.plannedQty, 0);
        const totalExecutedQty = items.reduce((acc, i) => acc + i.executedQty, 0);
        const dynamicEfficiency = (((totalExecutedQty - totalPlannedQty) / totalPlannedQty) * 100);
        const totalMonthlyPersonnel = 450 + Math.floor((totalExecutedQty / totalPlannedQty) * 50);

        const inspectionsConducted = Math.floor(totalExecutedQty / 50) + 20;
        const failedInspections = Math.floor(Math.random() * 4) + 1;
        const passedInspections = inspectionsConducted - failedInspections;
        const ncrRaised = failedInspections + Math.floor(Math.random() * 2);
        const ncrResolved = Math.max(0, ncrRaised - Math.floor(Math.random() * 2));

        return {
            month: 'February 2026',
            projectName: 'New Airport Terminal - Phase 1',
            client: 'Airports Authority of India',
            overallProgress: avgProgress,
            budgetUsed: `₹${(totalActualCost / 100000).toFixed(1)}L`,
            resources: 12,
            efficiency: `${dynamicEfficiency > 0 ? '+' : ''}${dynamicEfficiency.toFixed(1)}%`,
            items,
            weeks,
            stats: {
                totalPersonnel: totalMonthlyPersonnel,
                totalMasons: Math.round(totalMonthlyPersonnel * 0.25),
                totalCarpenters: Math.round(totalMonthlyPersonnel * 0.18),
                totalPlumbers: Math.round(totalMonthlyPersonnel * 0.09),
                totalPainters: Math.round(totalMonthlyPersonnel * 0.06),
                dominantWeather: 'Mostly Sunny',
                reportCount: 28,
                strategicPlans: [
                    'Complete Level 5 Slab Casting by mid-March',
                    'Initiate Level 6 Reinforcement procurement',
                    'Mobilize additional 15 specialized shuttering carpenters'
                ]
            },
            audit: {
                createdAt: '2026-03-01T10:00:00Z',
                createdBy: 'Mano Bharthii',
                approval: { status: 'Approved', by: 'Finance Director' }
            },
            qaqc: {
                inspectionsConducted,
                passed: passedInspections,
                failed: failedInspections,
                ncrRaised,
                ncrResolved,
                keyObservations: [
                    { test: 'Concrete Compressive Strength (M30)', location: 'Level 5 Slab', status: 'Passed', remark: 'Achieved 32 MPa at 28 days' },
                    { test: 'Steel Reinforcement Overlap Length', location: 'Columns C4-C8', status: 'Failed', remark: 'Overlap insufficient by 150mm. Rectified.' },
                    { test: 'Slump Test (RMC)', location: 'Foundation Raft', status: 'Passed', remark: 'Slump maintained at 120mm' },
                    { test: 'Formwork Verticality', location: 'Shear Wall SW-1', status: 'Passed', remark: 'Within permissible limits (+/- 3mm)' }
                ]
            }
        };
    };

    const monthlyArchiveData = React.useMemo(() => [generateMonthlyData()], []);

    // Tooltip Helpers (similar to WeeklySummary)

    const renderProgressionDetails = () => {
        if (!selectedReport) return null;

        return (
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-10 space-y-10"
            >
                {/* Variance Analysis */}
                <div className="space-y-4">
                    <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Monthly Variance Analysis</h5>
                    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-black/20">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 font-bold uppercase tracking-widest border-b border-gray-100 dark:border-white/5">
                                <tr>
                                    <th className="px-4 py-4">Task Activity</th>
                                    <th className="px-4 py-4 text-center">Planned (Monthly)</th>
                                    <th className="px-4 py-4 text-center">Actual (Monthly)</th>
                                    <th className="px-4 py-4 text-center">Variance</th>
                                    <th className="px-4 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {selectedReport.items.map((item, idx) => {
                                    const isAhead = parseFloat(item.variance) >= 0;
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors">
                                            <td className="px-4 py-4 font-semibold text-gray-900 dark:text-white">{item.task}</td>
                                            <td className="px-4 py-4 text-center text-gray-500">{item.plannedQty} {item.unit}</td>
                                            <td className="px-4 py-4 text-center font-bold text-gray-900 dark:text-white">{item.executedQty} {item.unit}</td>
                                            <td className={`px-4 py-4 text-center font-bold ${isAhead ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {isAhead ? '+' : ''}{item.variance}%
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-tighter ${isAhead ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    {isAhead ? 'On Track' : 'Delayed'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Monthly Timeline */}
                <div className="space-y-6 pt-4 border-t border-gray-100 dark:border-white/5">
                    <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Interactive 4-Week Progression</h5>
                    <div className="relative pt-12 pb-6 px-4">
                        <div className="absolute top-[60px] left-8 right-8 h-0.5 bg-gray-100 dark:bg-white/5" />
                        <div className="flex justify-between items-center relative">
                            {selectedReport.weeks.map((w, idx) => (
                                <div key={idx} className="flex flex-col items-center group/node relative">
                                    <div className="absolute -top-12 opacity-0 group-hover/node:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-xl z-10">
                                        {w.completion}% Completion
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45" />
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border-2 transition-all duration-300 relative z-1 ${w.completion >= 50 ? 'bg-emerald-500 border-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-blue-500 border-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)]'} group-hover/node:scale-150 cursor-pointer`} />
                                    <div className="mt-4 text-center">
                                        <p className="text-[9px] font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{w.week}</p>
                                        <p className="text-[8px] text-gray-400 font-medium">{w.dateRange}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    // Sync Breadcrumb for Creation Mode
    React.useEffect(() => {
        if (view === 'create') {
            setSubBreadcrumb('Create Monthly Archive');
        } else {
            setSubBreadcrumb('');
        }
    }, [view, setSubBreadcrumb]);

    if (view === 'create') {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] anim-fade-in text-center p-12">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-6">
                    <BarChart3 size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Generate Monthly Executive Archive</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
                    Preparing the project data for monthly consolidation. This process will aggregate all weekly summaries and resource utilization metrics into a comprehensive executive archive.
                </p>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setView('list')}
                        className="px-8 py-3 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                        Discard
                    </button>
                    <button className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 transition-all">
                        Build Archive
                    </button>
                </div>
            </div>
        );
    }

    const filteredData = (monthlyArchiveData || []).filter(m => {
        const searchTerm = filters?.month?.toLowerCase() || '';
        return !searchTerm || m.month.toLowerCase().includes(searchTerm);
    });

    return (
        <div className="space-y-6 anim-fade-in text-left w-full relative overflow-visible">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {filteredData.map((m, i) => (
                    <div
                        key={i}
                        onClick={() => {
                            setSelectedReport(m);
                            setShowDrawer(true);
                        }}
                        className="group p-8 rounded-3xl bg-white dark:bg-[#161b22] border border-gray-100 dark:border-white/5 hover:border-blue-500/30 transition-all flex flex-col justify-between gap-8 cursor-pointer shadow-sm hover:shadow-xl relative overflow-visible"
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex items-center">
                                <div className="w-16 h-16 bg-blue-500/5 dark:bg-blue-500/10 rounded-2xl border border-blue-500/10 flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                    <BarChart3 size={28} strokeWidth={1.5} />
                                </div>
                                <div className="ml-6">
                                    <h4 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{m.month}</h4>
                                    <div className="flex items-center mt-2 space-x-4 text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
                                        <span className="flex items-center text-emerald-500">
                                            <Zap size={11} className="mr-1.5" />
                                            {m.efficiency} Efficiency
                                        </span>
                                        <span className="flex items-center">
                                            <Clock size={11} className="mr-1.5 text-blue-500" />
                                            {m.stats.reportCount} Days Logged
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 z-10">
                                <button
                                    className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAiReport(m);
                                    }}
                                >
                                    <Sparkles size={20} strokeWidth={1.5} />
                                </button>
                                <button
                                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAuditReport(m);
                                    }}
                                    title="Audit Log"
                                >
                                    <ShieldCheck size={20} strokeWidth={1.5} />
                                </button>
                                <button
                                    className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        alert('Generating PPT Presentation for ' + m.month);
                                    }}
                                    title="Generate PPT"
                                >
                                    <Presentation size={20} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-100 dark:border-white/5">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Overall Progress</p>
                                <div className="flex items-center space-x-3">
                                    <div className="flex-1 bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${m.overallProgress}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-900 dark:text-white">{m.overallProgress}%</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Resource Utilization</p>
                                <p className="text-base font-bold text-gray-900 dark:text-white">{m.budgetUsed}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detailed Monthly Executive View Drawer */}
            <AnimatePresence>
                {showDrawer && selectedReport && (
                    <div className="fixed inset-0 z-[2500] flex justify-end overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowDrawer(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-[70%] bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col h-full border-l border-gray-200 dark:border-white/5"
                        >
                            {/* Drawer Header */}
                            <div className="p-8 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent dark:from-blue-900/20 border-b border-gray-100 dark:border-white/5 relative overflow-hidden text-left">
                                <div className="absolute top-6 right-8 flex items-center space-x-3">
                                    <button
                                        onClick={() => setIsPptMode(true)}
                                        className="flex items-center space-x-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 rounded-xl transition-all group/ppt-btn"
                                    >
                                        <Presentation size={16} className="group-hover/ppt-btn:scale-110 transition-transform" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Generate PPT</span>
                                    </button>
                                    <button
                                        className="flex items-center space-x-2 px-4 py-2 bg-gray-500/10 hover:bg-gray-500/20 text-gray-500 rounded-xl transition-all group/pdf-btn"
                                    >
                                        <Download size={16} className="group-hover/pdf-btn:translate-y-0.5 transition-transform" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Export PDF</span>
                                    </button>
                                    <button
                                        onClick={() => setSelectedAiReport(selectedReport)}
                                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-xl transition-all group/ai-btn"
                                    >
                                        <Sparkles size={16} className="group-hover/ai-btn:rotate-12 transition-transform" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">AI Analysis</span>
                                    </button>
                                    <button
                                        onClick={() => setShowDrawer(false)}
                                        className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all hover:rotate-90 bg-white/50 dark:bg-white/5 rounded-full"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="flex items-center space-x-4 mb-4">
                                    <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/20 text-white">
                                        <BarChart3 size={24} />
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-3 mb-0.5">
                                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">Monthly Executive Summary</span>
                                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[7px] font-bold uppercase tracking-tighter border border-blue-500/20">Archived</span>
                                        </div>
                                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{selectedReport.month}</h2>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-6 mt-6">
                                    <div className="flex items-center space-x-3 bg-white/50 dark:bg-white/5 px-4 py-2.5 rounded-xl border border-white/50 dark:border-white/10">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                            <Target size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Monthly Progress</p>
                                            <p className="text-sm font-black text-gray-900 dark:text-white">{selectedReport.overallProgress}%</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3 bg-white/50 dark:bg-white/5 px-4 py-2.5 rounded-xl border border-white/50 dark:border-white/10">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                            <Zap size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Efficiency</p>
                                            <p className="text-sm font-black text-gray-900 dark:text-white">{selectedReport.efficiency}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3 bg-white/50 dark:bg-white/5 px-4 py-2.5 rounded-xl border border-white/50 dark:border-white/10">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                                            <Users size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Workforce</p>
                                            <p className="text-sm font-black text-gray-900 dark:text-white">{selectedReport.stats.totalPersonnel}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Drawer Body */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-12 space-y-12 bg-gray-50/30 dark:bg-[#0a0d11] text-left">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">


                                    {/* Monthly Project Progression */}
                                    <div 
                                        className={`rounded-3xl border transition-all duration-500 cursor-pointer ${isProgressionExpanded ? 'border-blue-500/50 bg-white dark:bg-blue-500/5 ring-1 ring-blue-500/20' : 'border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04]'} p-8 lg:col-span-2 relative overflow-visible shadow-sm`}
                                        onClick={() => setIsProgressionExpanded(!isProgressionExpanded)}
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-6 flex items-center">
                                                    <Target size={18} className="mr-3 text-blue-500" />
                                                    Task-wise Weekly Progression Matrix
                                                </h4>
                                                <div className="flex items-center space-x-4 mb-6 bg-gray-50 dark:bg-white/5 p-4 rounded-2xl">
                                                    <div className="flex-1 bg-gray-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                                                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${selectedReport.overallProgress}%` }} />
                                                    </div>
                                                    <span className="text-sm font-black text-blue-500">{selectedReport.overallProgress}% Overall</span>
                                                </div>
                                                <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/5">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-gray-50 dark:bg-white/[0.03]">
                                                                <th className="px-4 py-3 text-[8px] font-black text-gray-400 uppercase tracking-widest">Construction Task</th>
                                                                {selectedReport.weeks.map((w, idx) => (
                                                                    <th key={idx} className="px-3 py-3 text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">{w.week.split(' ')[1]}</th>
                                                                ))}
                                                                <th className="px-4 py-3 text-[8px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                            {selectedReport.items.map((item, idx) => (
                                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                                                    <td className="px-4 py-4">
                                                                        <div className="flex items-center space-x-2">
                                                                            <p className="text-[10px] font-bold text-gray-900 dark:text-white leading-tight">{item.task}</p>
                                                                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-[7px] font-bold text-gray-400 uppercase">{item.unit}</span>
                                                                        </div>
                                                                    </td>
                                                                    {item.weeklyBreakdown.map((qty, qIdx) => (
                                                                        <td key={qIdx} className="px-3 py-4 text-[10px] font-black text-gray-600 dark:text-gray-400 text-center">{qty}</td>
                                                                    ))}
                                                                    <td className="px-4 py-4 text-[10px] font-black text-blue-600 text-right">{item.executedQty}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-6 flex items-center">
                                                    <ArrowUpRight size={18} className="mr-3 text-orange-500" />
                                                    Strategic Roadmap (Upcoming Month)
                                                </h4>
                                                <div className="space-y-4">
                                                    {selectedReport.stats.strategicPlans.map((plan, idx) => (
                                                        <div key={idx} className="flex items-start bg-orange-500/5 p-4 rounded-2xl border border-orange-500/10">
                                                            <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 mr-3 flex-shrink-0" />
                                                            <span className="text-sm text-gray-700 dark:text-orange-200 font-bold leading-relaxed">{plan}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <AnimatePresence>{isProgressionExpanded && renderProgressionDetails()}</AnimatePresence>
                                    </div>

                                    {/* NEW: Monthly Execution Timeline Table */}
                                    <div className="lg:col-span-2 space-y-6 pt-6">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                                <Calendar size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Monthly Execution Timeline</h4>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Planned vs. Actual Milestone Audit</p>
                                            </div>
                                        </div>

                                        <div className="overflow-hidden rounded-3xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50 dark:bg-white/[0.03]">
                                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Construction Task</th>
                                                        <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Total Duration</th>
                                                        <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">% Completed</th>
                                                        <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Planned Start</th>
                                                        <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Actual Start</th>
                                                        <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Planned End</th>
                                                        <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Actual End</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                    {selectedReport.items.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors group">
                                                            <td className="px-6 py-5">
                                                                <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight">{item.task}</p>
                                                                <p className="text-[9px] text-gray-400 font-bold uppercase">{item.unit}</p>
                                                            </td>
                                                            <td className="px-4 py-5 text-center">
                                                                <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-[10px] font-bold text-gray-600 dark:text-gray-400">
                                                                    {item.duration}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-5 text-center">
                                                                <div className="flex flex-col items-center space-y-1.5">
                                                                    <span className="text-[11px] font-black text-blue-600">{item.completionPercentage}%</span>
                                                                    <div className="w-16 h-1 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                                                                            style={{ width: `${item.completionPercentage}%` }} 
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-5 text-center">
                                                                <p className="text-[10px] font-bold text-gray-400">{item.plannedStart}</p>
                                                            </td>
                                                            <td className="px-4 py-5 text-center">
                                                                <p className="text-[10px] font-black text-gray-900 dark:text-white">{item.actualStart}</p>
                                                            </td>
                                                            <td className="px-4 py-5 text-center">
                                                                <p className="text-[10px] font-bold text-gray-400">{item.plannedEnd}</p>
                                                            </td>
                                                            <td className="px-4 py-5 text-center">
                                                                <div className="flex flex-col items-center">
                                                                    <p className="text-[10px] font-black text-emerald-500">{item.actualEnd}</p>
                                                                    <span className="text-[8px] font-bold text-emerald-500/60 uppercase tracking-tighter">Ahead of Schedule</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 space-y-12 py-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                                                    <Zap size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Financial Performance Audit</h4>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Weekly Comparative Analysis</p>
                                                </div>
                                            </div>
                                            <div className="px-5 py-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
                                                <span className="text-[11px] font-black text-white uppercase tracking-widest">Consolidated View</span>
                                            </div>
                                        </div>


                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                                            {/* Consolidated Weekly Labour Table */}
                                            <div 
                                                className={`bg-white dark:bg-white/[0.02] rounded-[2rem] border transition-all duration-500 overflow-hidden ${isLabourChartExpanded ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-gray-200 dark:border-white/5'} p-8 shadow-sm`}
                                            >
                                                <div 
                                                    className="flex items-center justify-between mb-8 cursor-pointer group/header"
                                                    onClick={() => setIsLabourChartExpanded(!isLabourChartExpanded)}
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <Users size={18} className="text-blue-500" />
                                                        <h6 className="text-[12px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Weekly Labour Expenditure</h6>
                                                    </div>
                                                    <div className={`p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 group-hover/header:text-blue-500 transition-all ${isLabourChartExpanded ? 'rotate-180' : ''}`}>
                                                        <ArrowRight size={14} className="rotate-90" />
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {isLabourChartExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="mb-8"
                                                        >
                                                            <DonutChart 
                                                                title="MONTHLY LABOUR DISTRIBUTION"
                                                                totalLabel="TOTAL MONTHLY"
                                                                data={(() => {
                                                                    const monthlyMap = {};
                                                                    selectedReport.weeks.forEach(w => {
                                                                        w.labour.forEach(l => {
                                                                            if (!monthlyMap[l.trade]) monthlyMap[l.trade] = { value: 0, color: l.color };
                                                                            monthlyMap[l.trade].value += l.actual;
                                                                        });
                                                                    });
                                                                    return Object.entries(monthlyMap).map(([label, info]) => ({ label, ...info }));
                                                                })()}
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                                <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/5">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-gray-50 dark:bg-white/[0.03]">
                                                                <th className="px-5 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Time Period</th>
                                                                <th className="px-5 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Predicted</th>
                                                                <th className="px-5 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Actual</th>
                                                                <th className="px-5 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Variance</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium text-[10px]">
                                                            {selectedReport.weeks.map((week, idx) => {
                                                                const totalActual = week.labour.reduce((s, l) => s + l.actual, 0);
                                                                const totalPredicted = week.labour.reduce((s, l) => s + l.predicted, 0);
                                                                const variance = (((totalActual - totalPredicted) / totalPredicted) * 100).toFixed(1);

                                                                return (
                                                                    <tr key={idx} className="hover:bg-blue-500/5 transition-all">
                                                                        <td className="px-5 py-5 font-black text-gray-900 dark:text-white uppercase tracking-tight">{week.week}</td>
                                                                        <td className="px-5 py-5 text-right text-gray-400">₹{(totalPredicted / 1000).toFixed(1)}k</td>
                                                                        <td className="px-5 py-5 text-right font-black text-gray-900 dark:text-white">₹{(totalActual / 1000).toFixed(1)}k</td>
                                                                        <td className="px-5 py-5 text-right">
                                                                            <span className={`font-black ${variance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                                {variance > 0 ? '+' : ''}{variance}%
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="bg-blue-600/5 dark:bg-blue-600/10">
                                                                <td className="px-5 py-5 text-[10px] font-black text-blue-600 uppercase">Monthly Total</td>
                                                                <td className="px-5 py-5 text-[11px] font-black text-blue-600 text-right">
                                                                    ₹{(selectedReport.weeks.reduce((acc, w) => acc + w.labour.reduce((s, i) => s + i.predicted, 0), 0) / 100000).toFixed(2)}L
                                                                </td>
                                                                <td className="px-5 py-5 text-[11px] font-black text-blue-600 text-right">
                                                                    ₹{(selectedReport.weeks.reduce((acc, w) => acc + w.labour.reduce((s, i) => s + i.actual, 0), 0) / 100000).toFixed(2)}L
                                                                </td>
                                                                <td className="px-5 py-5 text-[10px] font-black text-blue-600 text-right">Audit Pass</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Consolidated Weekly Materials Table */}
                                            <div 
                                                className={`bg-white dark:bg-white/[0.02] rounded-[2rem] border transition-all duration-500 overflow-hidden ${isMaterialChartExpanded ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-gray-200 dark:border-white/5'} p-8 shadow-sm`}
                                            >
                                                <div 
                                                    className="flex items-center justify-between mb-8 cursor-pointer group/header"
                                                    onClick={() => setIsMaterialChartExpanded(!isMaterialChartExpanded)}
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <Package size={18} className="text-amber-500" />
                                                        <h6 className="text-[12px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Weekly Material Resource Consumption</h6>
                                                    </div>
                                                    <div className={`p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 group-hover/header:text-amber-500 transition-all ${isMaterialChartExpanded ? 'rotate-180' : ''}`}>
                                                        <ArrowRight size={14} className="rotate-90" />
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {isMaterialChartExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="mb-8"
                                                        >
                                                            <DonutChart 
                                                                title="MONTHLY MATERIAL CONSUMPTION"
                                                                totalLabel="TOTAL MONTHLY"
                                                                data={(() => {
                                                                    const monthlyMap = {};
                                                                    selectedReport.weeks.forEach(w => {
                                                                        w.materials.forEach(m => {
                                                                            if (!monthlyMap[m.item]) monthlyMap[m.item] = { value: 0, color: m.color };
                                                                            monthlyMap[m.item].value += m.actual;
                                                                        });
                                                                    });
                                                                    return Object.entries(monthlyMap).map(([label, info]) => ({ label, ...info }));
                                                                })()}
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                                <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/5">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-gray-50 dark:bg-white/[0.03]">
                                                                <th className="px-5 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Time Period</th>
                                                                <th className="px-5 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Predicted</th>
                                                                <th className="px-5 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Actual</th>
                                                                <th className="px-5 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Variance</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-medium text-[10px]">
                                                            {selectedReport.weeks.map((week, idx) => {
                                                                const totalActual = week.materials.reduce((s, m) => s + m.actual, 0);
                                                                const totalPredicted = week.materials.reduce((s, m) => s + m.predicted, 0);
                                                                const variance = (((totalActual - totalPredicted) / totalPredicted) * 100).toFixed(1);

                                                                return (
                                                                    <tr key={idx} className="hover:bg-amber-500/5 transition-all">
                                                                        <td className="px-5 py-5 font-black text-gray-900 dark:text-white uppercase tracking-tight">{week.week}</td>
                                                                        <td className="px-5 py-5 text-right text-gray-400">₹{(totalPredicted / 1000).toFixed(1)}k</td>
                                                                        <td className="px-5 py-5 text-right font-black text-gray-900 dark:text-white">₹{(totalActual / 1000).toFixed(1)}k</td>
                                                                        <td className="px-5 py-5 text-right">
                                                                            <span className={`font-black ${variance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                                {variance > 0 ? '+' : ''}{variance}%
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="bg-amber-500/5 dark:bg-amber-500/10">
                                                                <td className="px-5 py-5 text-[10px] font-black text-amber-600 uppercase">Monthly Total</td>
                                                                <td className="px-5 py-5 text-[11px] font-black text-amber-600 text-right">
                                                                    ₹{(selectedReport.weeks.reduce((acc, w) => acc + w.materials.reduce((s, i) => s + i.predicted, 0), 0) / 100000).toFixed(2)}L
                                                                </td>
                                                                <td className="px-5 py-5 text-[11px] font-black text-amber-600 text-right">
                                                                    ₹{(selectedReport.weeks.reduce((acc, w) => acc + w.materials.reduce((s, i) => s + i.actual, 0), 0) / 100000).toFixed(2)}L
                                                                </td>
                                                                <td className="px-5 py-5 text-[10px] font-black text-amber-600 text-right">Audit Pass</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* NEW: Quality Assurance Audit Section */}
                                    <div className="lg:col-span-2 space-y-8 py-6 border-t border-gray-100 dark:border-white/5">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                                <ShieldCheck size={24} />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Quality Assurance Audit</h4>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Monthly Inspection & Compliance Metrics</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                            {/* QA Stats Cards */}
                                            <div className="space-y-4 flex flex-col justify-center">
                                                <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 p-6 rounded-3xl flex items-center justify-between shadow-sm hover:border-emerald-500/30 transition-all cursor-pointer">
                                                    <div>
                                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Inspections</p>
                                                        <p className="text-2xl font-black text-gray-900 dark:text-white">{selectedReport.qaqc.inspectionsConducted}</p>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                        <Activity size={20} />
                                                    </div>
                                                </div>
                                                <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 p-6 rounded-3xl flex items-center justify-between shadow-sm hover:border-rose-500/30 transition-all cursor-pointer">
                                                    <div>
                                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">NCRs Active</p>
                                                        <p className="text-2xl font-black text-rose-500">{selectedReport.qaqc.ncrRaised - selectedReport.qaqc.ncrResolved}</p>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                                                        <X size={20} />
                                                    </div>
                                                </div>
                                                <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 p-6 rounded-3xl flex items-center justify-between shadow-sm hover:border-emerald-500/30 transition-all cursor-pointer">
                                                    <div>
                                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">NCRs Resolved</p>
                                                        <p className="text-2xl font-black text-emerald-500">{selectedReport.qaqc.ncrResolved}</p>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                        <CheckCircle size={20} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Key Observations List */}
                                            <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-3xl p-8 shadow-sm xl:col-span-2 flex flex-col">
                                                <div className="flex items-center space-x-3 mb-6">
                                                    <Eye size={18} className="text-blue-500" />
                                                    <h6 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Key Site Observations</h6>
                                                </div>
                                                <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                                    {selectedReport.qaqc.keyObservations.map((obs, idx) => (
                                                        <div key={idx} className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 relative overflow-hidden group/obs">
                                                            <div className={`absolute top-0 left-0 w-1 h-full ${obs.status === 'Passed' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                            <div className="flex justify-between items-start mb-2">
                                                                <p className="text-[10px] font-bold text-gray-900 dark:text-white uppercase tracking-tight">{obs.test}</p>
                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${obs.status === 'Passed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                                    {obs.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-500 font-medium mb-1"><MapPin size={10} className="inline mr-1" />{obs.location}</p>
                                                            <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 italic">{obs.remark}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            {/* Premium Audit Metadata Drawer */}
            {selectedAuditReport && (
                <div className="fixed inset-0 z-[3000] flex justify-end overflow-hidden anim-fade-in group/drawer text-left">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                        onClick={() => setSelectedAuditReport(null)}
                    ></div>
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#0d1117] shadow-2xl anim-slide-left flex flex-col h-full border-l border-gray-200 dark:border-white/5">

                        {/* Drawer Header */}
                        <div className="p-10 bg-gradient-to-br from-blue-600/10 to-transparent dark:from-blue-900/20 border-b border-gray-100 dark:border-white/5 text-left relative overflow-hidden">
                            <button
                                onClick={() => setSelectedAuditReport(null)}
                                className="absolute top-8 right-8 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all hover:rotate-90"
                            >
                                <X size={20} />
                            </button>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
                                    <ShieldCheck size={24} />
                                </div>
                                <span className="text-[10px] font-bold text-blue-500 tracking-[0.2em]">Monthly oversight</span>
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{selectedAuditReport.month}</h2>
                            <p className="text-gray-500 text-sm mt-2">Executive audit trail for the monthly project consolidation</p>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-12 text-left">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 rounded-3xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 text-left">
                                    <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-2 flex items-center">
                                        <Calendar size={12} className="mr-2 text-green-500" />
                                        Status
                                    </p>
                                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold tracking-tighter ${selectedAuditReport.audit.approval.status === 'Approved'
                                        ? 'bg-green-500/10 text-green-500'
                                        : 'bg-orange-500/10 text-orange-500'
                                        }`}>
                                        {selectedAuditReport.audit.approval.status}
                                    </span>
                                </div>
                            </div>

                            {/* Detailed Audit Logs */}
                            <div className="space-y-8 text-left">
                                <h3 className="text-xs font-bold text-gray-900 dark:text-white tracking-widest flex items-center border-b border-gray-100 dark:border-white/5 pb-4">
                                    <AlignLeft size={14} className="mr-3 text-blue-500" />
                                    Submission records
                                </h3>
                                <div className="space-y-6">
                                    <div className="relative pl-8 border-l-2 border-dashed border-gray-100 dark:border-white/5 text-left">
                                        <div className="absolute top-0 -left-[9px] w-4 h-4 rounded-full bg-blue-500 ring-4 ring-white dark:ring-[#0d1117] shadow-lg shadow-blue-500/20"></div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1 text-left">Consolidation</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Monthly archive finalized by <span className="text-blue-500 font-bold">{selectedAuditReport.audit.createdBy}</span></p>
                                            <p className="text-xs text-gray-500 mt-2 flex items-center">
                                                <Clock size={12} className="mr-1.5" />
                                                {new Date(selectedAuditReport.audit.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    {selectedAuditReport.audit.approval.by && (
                                        <div className="relative pl-8 text-left">
                                            <div className="absolute top-0 -left-[9px] w-4 h-4 rounded-full bg-green-500 ring-4 ring-white dark:ring-[#0d1117] shadow-lg shadow-green-500/20"></div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Authorization</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Reviewed and authorized by <span className="text-green-500 font-bold">{selectedAuditReport.audit.approval.by}</span></p>
                                                <p className="text-xs text-gray-500 mt-2 flex items-center">
                                                    <ShieldCheck size={12} className="mr-1.5" />
                                                    {new Date(selectedAuditReport.audit.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-8 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5 flex justify-end">
                            <button
                                onClick={() => setSelectedAuditReport(null)}
                                className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-md text-[10px] font-bold tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                            >
                                Close audit view
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Summarization Drawer */}
            <AISummaryDrawer
                isOpen={!!selectedAiReport}
                onClose={() => setSelectedAiReport(null)}
                reportData={selectedAiReport}
                reportType="Monthly Archive"
            />

            {/* PPT Editor Overlay */}
            {isPptMode && selectedReport && (
                <PPTEditor 
                    reportData={selectedReport} 
                    onClose={() => setIsPptMode(false)} 
                />
            )}
        </div>
    );
};

export default MonthlyArchive;
