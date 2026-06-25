import React from 'react';
import { ArrowUpRight, Target, Info, Sparkles, ShieldCheck, ChevronRight, X, AlignLeft, Calendar, Clock, Cloud, Users } from 'lucide-react';
import AISummaryDrawer from '../AISummaryDrawer';

const WeeklySummary = ({ filters, setSubBreadcrumb, view, setView }) => {
    const [selectedReport, setSelectedReport] = React.useState(null);
    const [showDrawer, setShowDrawer] = React.useState(false);
    const [selectedAuditReport, setSelectedAuditReport] = React.useState(null);
    const [selectedAiReport, setSelectedAiReport] = React.useState(null);

    // Generate daily reports and group by week
    const generateWeeklyData = () => {
        const reports = [];
        const startDate = new Date('2026-02-28');
        const endDate = new Date('2026-04-28');

        const phases = {
            'Feb-Mar': {
                tasks: [
                    { name: 'Slab Casting - Level 5', unit: 'sqft', baseQty: 500, agency: 'BuildRight Const.', trades: { mason: 18, carpenter: 10, plumber: 5 } },
                    { name: 'Column Shuttering - Level 5', unit: 'nos', baseQty: 15, agency: 'SteelForce Ltd', trades: { mason: 15, carpenter: 18 } },
                    { name: 'Steel Binding - Level 5', unit: 'tons', baseQty: 3, agency: 'SteelForce Ltd', trades: { mason: 12, carpenter: 15 } },
                    { name: 'PCC Work - Foundation', unit: 'cum', baseQty: 200, agency: 'EarthMovers Inc', trades: { mason: 20 } }
                ]
            },
            'Mar-Apr': {
                tasks: [
                    { name: 'Internal Electrical - Wing A', unit: 'mtr', baseQty: 300, agency: 'ElectroWorks Inc', trades: { carpenter: 16, painter: 0 } },
                    { name: 'Internal Plumbing - Wing B', unit: 'mtr', baseQty: 250, agency: 'BuildRight Const.', trades: { plumber: 20, carpenter: 12 } },
                    { name: 'HVAC Installation - Main Block', unit: 'nos', baseQty: 12, agency: 'CoolAir Systems', trades: { carpenter: 14 } },
                    { name: 'Wall Painting - All Wings', unit: 'sqft', baseQty: 2000, agency: 'FineFinish Interiors', trades: { painter: 28, mason: 10 } }
                ]
            },
            'Late-Apr': {
                tasks: [
                    { name: 'Flooring Work - Ground Floor', unit: 'sqft', baseQty: 3000, agency: 'Premium Flooring Ltd', trades: { carpenter: 18, mason: 12 } },
                    { name: 'Fixture Installation', unit: 'nos', baseQty: 45, agency: 'FineFinish Interiors', trades: { carpenter: 14, painter: 10 } },
                    { name: 'Final Inspections', unit: 'lot', baseQty: 1, agency: 'Quality Audits Pro', trades: {} }
                ]
            }
        };

        const supervisors = ['Mano Bharthii', 'Arjun Kumar', 'Suresh Raina', 'Latika SSR', 'Rajesh Nair'];
        const approvers = ['Project Director', 'Project Manager', 'Client Rep', 'Site Supervisor', 'Finance Director'];

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dayOfWeek = d.getDay();

            if (dayOfWeek === 0 && Math.random() > 0.3) continue;
            if (dayOfWeek === 6 && Math.random() > 0.4) continue;

            const supervisor = supervisors[Math.floor(Math.random() * supervisors.length)];
            const approver = approvers[Math.floor(Math.random() * approvers.length)];

            let phase = phases['Feb-Mar'];
            if (d > new Date('2026-03-15')) phase = phases['Mar-Apr'];
            if (d > new Date('2026-04-10')) phase = phases['Late-Apr'];

            const taskSet = phase.tasks;
            const currentTaskIdx = Math.floor((reports.length % taskSet.length));
            const task = taskSet[currentTaskIdx];

            const progressQty = Math.floor(task.baseQty * (0.6 + Math.random() * 0.8));
            const planQty = Math.floor(task.baseQty * (0.7 + Math.random() * 0.6));

            const weatherOptions = ['sunny', 'cloudy', 'rainy', 'windy'];
            const weatherType = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
            const personnel = dayOfWeek === 0 ? Math.floor(Math.random() * 10) + 5 : dayOfWeek === 6 ? Math.floor(Math.random() * 15) + 20 : Math.floor(Math.random() * 30) + 40;
            const completion = dayOfWeek === 0 ? Math.floor(Math.random() * 60) + 30 : Math.floor(Math.random() * 25) + 70;
            const nextTask = taskSet[(currentTaskIdx + 1) % taskSet.length];

            const labourAgencies = [
              { ...task, trades: task.trades },
              { name: 'Support Agency', trades: { mason: Math.floor(Math.random() * 8) + 3, carpenter: Math.floor(Math.random() * 7) + 2, plumber: Math.floor(Math.random() * 4) + 1, painter: Math.floor(Math.random() * 5) + 2 } }
            ];

            reports.push({
                date: dateStr,
                dayOfWeek,
                task: task.name,
                unit: task.unit,
                executedQty: progressQty,
                plannedQty: planQty,
                totalQty: task.baseQty,
                agency: task.agency,
                personnel,
                completion,
                summary: `${task.name} executed ${progressQty} ${task.unit} today.`,
                tomorrowPlan: [{ item: nextTask.name, qty: planQty, unit: nextTask.unit }],
                weather: weatherType,
                labourData: labourAgencies.map((ag, idx) => ({
                    id: idx + 1,
                    agency: ag.name || task.agency,
                    mason: ag.trades.mason || 0,
                    carpenter: ag.trades.carpenter || 0,
                    plumber: ag.trades.plumber || 0,
                    painter: ag.trades.painter || 0,
                })),
                audit: {
                    createdAt: new Date(d.getTime() + 17 * 3600000).toISOString(),
                    createdBy: supervisor,
                    approval: { status: Math.random() > 0.15 ? 'Approved' : 'Pending', by: approver }
                }
            });
        }

        return reports;
    };

    const dailyReports = generateWeeklyData();

    // Group reports by week
    const groupByWeek = () => {
        const weeks = {};
        const startDate = new Date('2026-02-28');

        dailyReports.forEach(report => {
            const reportDate = new Date(report.date);
            const daysDiff = Math.floor((reportDate - startDate) / (1000 * 60 * 60 * 24));
            const weekNum = Math.floor(daysDiff / 7) + 9; // Week 9 is Feb 28 week
            const weekStart = new Date(startDate);
            weekStart.setDate(weekStart.getDate() + (weekNum - 9) * 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            const weekKey = `Week ${weekNum} (${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;

            if (!weeks[weekKey]) {
                weeks[weekKey] = [];
            }
            weeks[weekKey].push(report);
        });

        return weeks;
    };

    const weeklyGroups = groupByWeek();
    const weeklyKeys = Object.keys(weeklyGroups).reverse(); // Newest first

    const aggregateWeekData = (weekReports) => {
        const aggregated = {};

        weekReports.forEach(report => {
            if (!aggregated[report.task]) {
                aggregated[report.task] = {
                    task: report.task,
                    unit: report.unit,
                    agency: report.agency,
                    totalQty: report.totalQty,
                    executedQty: 0,
                    plannedQty: 0,
                    days: []
                };
            }
            aggregated[report.task].executedQty += report.executedQty;
            aggregated[report.task].plannedQty += report.plannedQty;
            aggregated[report.task].days.push(report);
        });

        return Object.values(aggregated);
    };

    const weeklyData = weeklyKeys.map((weekKey, idx) => {
        const weekReports = weeklyGroups[weekKey];
        const items = aggregateWeekData(weekReports);

        let totalPersonnel = 0;
        let totalMasons = 0;
        let totalCarpenters = 0;
        let totalPlumbers = 0;
        let totalPainters = 0;
        let totalCompletion = 0;
        const weatherCounts = {};
        const dailySummaries = [];
        const nextWeekPlans = new Set();

        weekReports.forEach(report => {
            totalPersonnel += report.personnel;
            totalCompletion += report.completion;
            weatherCounts[report.weather] = (weatherCounts[report.weather] || 0) + 1;
            
            if (report.summary && !dailySummaries.includes(report.summary)) {
                dailySummaries.push(report.summary);
            }
            if (report.tomorrowPlan) {
                report.tomorrowPlan.forEach(plan => nextWeekPlans.add(`${plan.item} (${plan.qty} ${plan.unit})`));
            }
            
            if (report.labourData) {
                report.labourData.forEach(ld => {
                    totalMasons += ld.mason;
                    totalCarpenters += ld.carpenter;
                    totalPlumbers += ld.plumber;
                    totalPainters += ld.painter;
                });
            }
        });

        const dominantWeather = Object.keys(weatherCounts).length > 0 
            ? Object.entries(weatherCounts).sort((a,b)=>b[1]-a[1])[0][0] 
            : 'sunny';
            
        const averageCompletion = Math.round(totalCompletion / weekReports.length);
        const uniquePlans = Array.from(nextWeekPlans).slice(0, 3); // Top 3 strategic targets

        return {
            week: weekKey,
            items,
            dailyReports: weekReports,
            reportCount: weekReports.length,
            dateRange: {
                start: weekReports[0]?.date,
                end: weekReports[weekReports.length - 1]?.date,
            },
            stats: {
                totalPersonnel,
                totalMasons,
                totalCarpenters,
                totalPlumbers,
                totalPainters,
                dominantWeather,
                averageCompletion,
                dailySummaries: dailySummaries.slice(-3), // Take last 3 notable events
                strategicPlans: uniquePlans.length > 0 ? uniquePlans : ['Continue ongoing phase execution']
            },
            audit: {
                createdAt: weekReports[0]?.audit.createdAt,
                createdBy: weekReports[0]?.audit.createdBy,
                approval: { status: 'Approved', by: weekReports[0]?.audit.approval.by }
            }
        };
    });

    // Sync Breadcrumb for Creation Mode
    React.useEffect(() => {
        if (view === 'create') {
            setSubBreadcrumb('Create Weekly Summary');
        } else {
            setSubBreadcrumb('');
        }
    }, [view, setSubBreadcrumb]);

    if (view === 'create') {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] anim-fade-in text-center p-12">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-6">
                    <Calendar size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Initialize Weekly Compilation</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
                    Preparing the environment for weekly data aggregation. This module will consolidate daily progress logs into a structured weekly performance summary.
                </p>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setView('list')}
                        className="px-8 py-3 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                        Discard
                    </button>
                    <button className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 transition-all">
                        Launch Summarizer
                    </button>
                </div>
            </div>
        );
    }

    const filteredData = weeklyData.filter(w => {
        return !filters.week || w.week.toLowerCase().includes(filters.week.toLowerCase());
    });

    const selectedWeekIndex = selectedReport ? weeklyData.findIndex(w => w.week === selectedReport.week) : -1;

    const getPreviousExecutedQty = (taskName) => {
        if (selectedWeekIndex < 0) return 0;

        return weeklyData
            .slice(selectedWeekIndex + 1)
            .reduce((sum, week) => {
                const row = week.items.find(item => item.task === taskName);
                return sum + (row ? row.executedQty : 0);
            }, 0);
    };

    const getWeeklyTableRows = () => {
        if (!selectedReport) return [];

        return selectedReport.items.map((item, index) => {
            const previousExecuted = getPreviousExecutedQty(item.task);
            const cumulativeExecuted = previousExecuted + item.executedQty;

            return {
                id: index + 1,
                activity: item.task,
                description: `${item.days.length} daily entries consolidated for ${selectedReport.week}`,
                unit: item.unit,
                totalQty: item.totalQty,
                executedLastWeek: previousExecuted,
                plannedThisWeek: Math.round(item.plannedQty),
                executedThisWeek: Math.round(item.executedQty),
                balanceThisWeek: Math.max(0, item.totalQty - Math.round(cumulativeExecuted)),
                cumulativeExecuted: Math.round(cumulativeExecuted),
                plannedNextWeek: Math.max(0, Math.round(item.plannedQty) - Math.round(item.executedQty)),
                remarks: item.days.length > 1 ? `Progress captured on ${item.days.length} days` : 'Single-day entry'
            };
        });
    };

    const formatDateRange = (startDate, endDate) => {
        if (!startDate || !endDate) return 'N/A';

        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        };

        return `${formatDate(startDate)} to ${formatDate(endDate)}`;
    };

    const getWeeklyTotals = () => {
        if (!selectedReport) return { totalExecuted: 0, totalPlanned: 0, totalTasks: 0 };

        return selectedReport.items.reduce((accumulator, item) => {
            accumulator.totalExecuted += Math.round(item.executedQty);
            accumulator.totalPlanned += Math.round(item.plannedQty);
            accumulator.totalTasks += 1;
            return accumulator;
        }, { totalExecuted: 0, totalPlanned: 0, totalTasks: 0 });
    };

    const weeklyTotals = getWeeklyTotals();

    return (
        <div className="space-y-6 anim-fade-in text-left">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredData.map((weekData, idx) => (
                    <div
                        key={idx}
                        onClick={() => {
                            setSelectedReport(weekData);
                            setShowDrawer(true);
                        }}
                        className="group bg-white dark:bg-[#161b22] p-8 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all cursor-pointer flex flex-col justify-between relative overflow-visible"
                    >
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center space-x-5">
                                <div className="w-14 h-14 bg-gray-50 dark:bg-white/[0.03] rounded-2xl flex relative items-center justify-center border border-gray-100 dark:border-white/5 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10 transition-colors">
                                    <Calendar size={28} className="text-blue-500 stroke-[1.5]" />
                                    <span className="absolute top-[22px] text-[11px] font-bold text-blue-500">
                                        W{weekData.week.match(/\d+/)[0]}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-1">{weekData.week}</h4>
                                    <div className="flex items-center space-x-3 text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                                        <div className="flex items-center">
                                            <Target size={12} className="mr-1.5 text-blue-500" />
                                            {weekData.items.length} Activities
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 z-10">
                                <button
                                    className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAiReport(weekData);
                                    }}
                                >
                                    <Sparkles size={16} strokeWidth={1.5} />
                                </button>
                                <button
                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAuditReport(weekData);
                                    }}
                                >
                                    <Info size={16} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>

                        <p className="text-sm text-gray-500 font-normal mt-2 mb-8 line-clamp-2 leading-relaxed">
                            {weekData.items.length} construction activities completed. Total execution: {Math.round(weekData.items.reduce((sum, item) => sum + item.executedQty, 0))} units across {weekData.reportCount} working days.
                        </p>

                    </div>
                ))}
            </div>

            {showDrawer && selectedReport && (
                <div className="fixed inset-0 z-[1500] overflow-hidden anim-fade-in">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => {
                            setShowDrawer(false);
                            setSelectedReport(null);
                        }}
                    ></div>

                    <div className="absolute inset-y-0 right-0 w-full max-w-[75%] flex justify-end">
                        <div className="relative w-full h-full bg-white dark:bg-[#0d1117] shadow-2xl overflow-y-auto custom-scrollbar">
                            <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur border-b border-gray-200 dark:border-white/5 px-8 py-5 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-blue-500 tracking-[0.25em] uppercase">Weekly Progress Report</p>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{selectedReport.week}</h2>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowDrawer(false);
                                        setSelectedReport(null);
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="px-8 py-6 space-y-6">


                                <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#161b22] shadow-sm custom-scrollbar">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 uppercase tracking-wider text-xs text-gray-500 font-bold text-center">
                                            <tr>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5">Activity / Item</th>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5">Description</th>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5">Unit</th>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5">Total Qty</th>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5 min-w-[120px]">Executed Qty<br/>upto last Week</th>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5 min-w-[120px]">Planned Qty<br/>for this Week</th>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5 text-emerald-600 dark:text-emerald-400 min-w-[120px]">Executed Qty<br/>in this Week</th>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5 text-red-600 dark:text-red-400 min-w-[120px]">Balance Qty<br/>for this Week</th>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5 text-indigo-600 dark:text-indigo-400 min-w-[140px]">Cumulative Qty<br/>Executed upto<br/>this Week</th>
                                                <th className="px-4 py-3 align-middle border-r border-gray-100 dark:border-white/5 min-w-[120px]">Planned Qty<br/>for next Week</th>
                                                <th className="px-4 py-3 align-middle">Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {getWeeklyTableRows().map((row) => (
                                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-4 py-4 font-semibold text-gray-900 dark:text-white border-r border-gray-100 dark:border-white/5 max-w-[200px] truncate" title={row.activity}>{row.activity}</td>
                                                    <td className="px-4 py-4 text-gray-500 border-r border-gray-100 dark:border-white/5 max-w-[200px] truncate" title={row.description}>{row.description}</td>
                                                    <td className="px-4 py-4 text-gray-500 font-medium text-center border-r border-gray-100 dark:border-white/5">{row.unit}</td>
                                                    <td className="px-4 py-4 font-semibold text-blue-600 dark:text-blue-400 text-center border-r border-gray-100 dark:border-white/5">{row.totalQty}</td>
                                                    <td className="px-4 py-4 font-medium text-gray-700 dark:text-gray-300 text-center border-r border-gray-100 dark:border-white/5">{row.executedLastWeek}</td>
                                                    <td className="px-4 py-4 font-medium text-orange-600 dark:text-orange-400 text-center border-r border-gray-100 dark:border-white/5">{row.plannedThisWeek}</td>
                                                    <td className="px-4 py-4 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/5 text-center border-r border-gray-100 dark:border-white/5">{row.executedThisWeek}</td>
                                                    <td className="px-4 py-4 font-semibold text-red-600 dark:text-red-400 text-center border-r border-gray-100 dark:border-white/5">{row.balanceThisWeek}</td>
                                                    <td className="px-4 py-4 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-500/5 text-center border-r border-gray-100 dark:border-white/5">{row.cumulativeExecuted}</td>
                                                    <td className="px-4 py-4 font-medium text-gray-700 dark:text-gray-300 text-center border-r border-gray-100 dark:border-white/5">{row.plannedNextWeek}</td>
                                                    <td className="px-4 py-4 text-gray-500 max-w-[150px] truncate" title={row.remarks}>{row.remarks}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Accumulated Daily Subpoints */}
                                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] p-6">
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center">
                                            <Users size={16} className="mr-2 text-blue-500" />
                                            Accumulated Manpower (7 Days)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Total Personnel</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedReport.stats.totalPersonnel}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Total Masons</p>
                                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedReport.stats.totalMasons}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Total Carpenters</p>
                                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{selectedReport.stats.totalCarpenters}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Total Plumbers & Painters</p>
                                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{selectedReport.stats.totalPlumbers + selectedReport.stats.totalPainters}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] p-6">
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center">
                                            <Cloud size={16} className="mr-2 text-blue-500" />
                                            Site Conditions (7 Days Summary)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Dominant Weather</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{selectedReport.stats.dominantWeather}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Total Working Days</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedReport.reportCount} Days</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Weekly Note</p>
                                                <p className="text-sm text-gray-500">Data consolidated from {selectedReport.reportCount} daily site reports across {selectedReport.items.length} primary activities.</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Project Progression & Strategic Planning */}
                                    <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] p-6 lg:col-span-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center">
                                                    <Target size={16} className="mr-2 text-blue-500" />
                                                    Weekly Project Progression
                                                </h4>
                                                <div className="flex items-center space-x-3 mb-4">
                                                    <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5">
                                                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${selectedReport.stats.averageCompletion}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{selectedReport.stats.averageCompletion}%</span>
                                                </div>
                                                <ul className="space-y-3">
                                                    {selectedReport.stats.dailySummaries.map((summary, idx) => (
                                                        <li key={idx} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 mr-2.5 flex-shrink-0"></div>
                                                            <span className="leading-relaxed">{summary}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center">
                                                    <ArrowUpRight size={16} className="mr-2 text-orange-500" />
                                                    Strategic Planning (Next Week)
                                                </h4>
                                                <div className="bg-orange-50/50 dark:bg-orange-500/5 rounded-xl border border-orange-100 dark:border-orange-500/10 p-5">
                                                    <ul className="space-y-3">
                                                        {selectedReport.stats.strategicPlans.map((plan, idx) => (
                                                            <li key={idx} className="flex items-start text-sm text-orange-800 dark:text-orange-200">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 mr-2.5 flex-shrink-0"></div>
                                                                <span className="leading-relaxed font-medium">{plan}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-white/5 text-[10px] font-medium uppercase tracking-widest text-gray-400">
                                    <span>Prepared By: Mano Project Consultants Pvt. Ltd.</span>
                                    <span>Mr. Tushar Lad</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Audit Metadata Drawer */}
            {selectedAuditReport && (
                <div className="fixed inset-0 z-[2000] flex justify-end overflow-hidden anim-fade-in group/drawer">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                        onClick={() => setSelectedAuditReport(null)}
                    ></div>
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#0d1117] shadow-2xl anim-slide-left flex flex-col h-full border-l border-gray-200 dark:border-white/5 text-left">

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
                                <span className="text-[10px] font-bold text-blue-500 tracking-[0.2em]">Weekly oversight</span>
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{selectedAuditReport.week}</h2>
                            <p className="text-gray-500 text-sm mt-2">Comprehensive audit trail for the weekly summary compile</p>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-12">
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
                            <div className="space-y-8">
                                <h3 className="text-xs font-bold text-gray-900 dark:text-white tracking-widest flex items-center border-b border-gray-100 dark:border-white/5 pb-4 text-left">
                                    <AlignLeft size={14} className="mr-3 text-blue-500" />
                                    Submission records
                                </h3>
                                <div className="space-y-6">
                                    <div className="relative pl-8 border-l-2 border-dashed border-gray-100 dark:border-white/5 text-left">
                                        <div className="absolute top-0 -left-[9px] w-4 h-4 rounded-full bg-blue-500 ring-4 ring-white dark:ring-[#0d1117] shadow-lg shadow-blue-500/20"></div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">Compilation</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Weekly data batch processed by <span className="text-blue-500 font-bold">{selectedAuditReport.audit.createdBy}</span></p>
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
                                                <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">Authorization</p>
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
                reportType="Weekly Summary"
            />
        </div>
    );
};

export default WeeklySummary;
