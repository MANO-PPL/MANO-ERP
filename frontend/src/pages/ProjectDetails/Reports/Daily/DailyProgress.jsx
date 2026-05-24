import React, { useState, useEffect } from 'react';
import {
    Clock,
    Plus,
    ChevronRight,
    ArrowLeft,
    Download,
    CheckCircle,
    Activity,
    Users,
    ChevronDown,
    Trash2,
    Info,
    Sparkles,
    ShieldCheck,
    X,
    AlignLeft,
    Calendar
} from 'lucide-react';

// Custom UI Components
import CustomDatePicker from '../../../../components/CustomDatePicker';
import CustomInput from '../../../../components/CustomInput';
import DPRCreate from './DPRCreate';
import AISummaryDrawer from '../AISummaryDrawer';

const DailyProgress = ({ filters, setSubBreadcrumb, view, setView }) => {
    const [selectedReport, setSelectedReport] = useState(null);
    const [selectedAuditReport, setSelectedAuditReport] = useState(null);
    const [selectedAiReport, setSelectedAiReport] = useState(null);

    // Update breadcrumbs based on view
    useEffect(() => {
        if (view === 'details' && selectedReport) {
            setSubBreadcrumb(selectedReport.date);
        } else if (view === 'create') {
            setSubBreadcrumb('Create Report');
        } else {
            setSubBreadcrumb('');
        }
    }, [view, selectedReport, setSubBreadcrumb]);

    // Generate date range from Feb 28 to Apr 28 with unique reports
    const generateReports = () => {
        const reports = [];
        const startDate = new Date('2026-02-28');
        const endDate = new Date('2026-04-28');
        let reportId = 1;

        // Construction progression phases and task sequencing
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

        const weather = ['sunny', 'cloudy', 'rainy', 'windy'];
        const temps = [28, 30, 32, 34, 25, 26, 24, 23];
        const humidity = [35, 40, 45, 50, 55, 60, 65, 70, 75];
        const winds = [5, 8, 10, 12, 15, 18, 20, 25];
        const supervisors = ['Mano Bharthii', 'Arjun Kumar', 'Suresh Raina', 'Latika SSR', 'Rajesh Nair'];
        const approvers = ['Project Director', 'Project Manager', 'Client Rep', 'Site Supervisor', 'Finance Director'];

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dayOfWeek = d.getDay();

            // Skip some days or have limited weekend activity
            if (dayOfWeek === 0 && Math.random() > 0.3) continue; // Most Sundays off
            if (dayOfWeek === 6 && Math.random() > 0.4) continue; // Some Saturdays off

            const weatherType = weather[Math.floor(Math.random() * weather.length)];
            const tempIdx = Math.floor(Math.random() * temps.length);
            const supervisor = supervisors[Math.floor(Math.random() * supervisors.length)];
            const approver = approvers[Math.floor(Math.random() * approvers.length)];

            // Determine phase
            let phase = phases['Feb-Mar'];
            if (d > new Date('2026-03-15')) phase = phases['Mar-Apr'];
            if (d > new Date('2026-04-10')) phase = phases['Late-Apr'];

            const taskSet = phase.tasks;
            const currentTaskIdx = Math.floor((reportId % taskSet.length));
            const task = taskSet[currentTaskIdx];

            const personnel = dayOfWeek === 0 ? Math.floor(Math.random() * 10) + 5 : dayOfWeek === 6 ? Math.floor(Math.random() * 15) + 20 : Math.floor(Math.random() * 30) + 40;
            const completion = dayOfWeek === 0 ? Math.floor(Math.random() * 60) + 30 : Math.floor(Math.random() * 25) + 70;

            const progressQty = Math.floor(task.baseQty * (0.6 + Math.random() * 0.8));
            const planQty = Math.floor(task.baseQty * (0.7 + Math.random() * 0.6));

            const labourAgencies = [
                { ...task, trades: task.trades },
                { name: 'Support Agency', trades: { mason: Math.floor(Math.random() * 8) + 3, carpenter: Math.floor(Math.random() * 7) + 2, plumber: Math.floor(Math.random() * 4) + 1, painter: Math.floor(Math.random() * 5) + 2 } }
            ];

            const isApproved = Math.random() > 0.15; // 85% approved

            reports.push({
                id: reportId++,
                date: dateStr,
                summary: `${task.name} progressing well. ${progressQty} ${task.unit} completed today. ${personnel} personnel on site.`,
                completion,
                personnel,
                readiness: completion > 80 ? 'Optimal' : completion > 60 ? 'High' : 'Moderate',
                audit: {
                    createdAt: new Date(d.getTime() + 17 * 3600000).toISOString(),
                    createdBy: supervisor,
                    lastUpdated: new Date(d.getTime() + 18 * 3600000).toISOString(),
                    formTiming: Math.floor(Math.random() * 30) + 10 + ' mins',
                    approval: {
                        status: isApproved ? 'Approved' : 'Pending',
                        by: isApproved ? approver : null,
                        date: isApproved ? new Date(d.getTime() + 20 * 3600000).toISOString() : null
                    }
                },
                weather: weatherType,
                temp: temps[tempIdx] + '°C',
                humidity: humidity[Math.floor(Math.random() * humidity.length)] + '%',
                wind: winds[Math.floor(Math.random() * winds.length)] + ' km/h',
                timeSlots: dayOfWeek === 0 ? [{ id: 1, from: '10:00', to: '14:00' }] : [
                    { id: 1, from: '08:00', to: '12:00' },
                    { id: 2, from: '13:00', to: '17:30' }
                ],
                labourData: labourAgencies.map((ag, idx) => ({
                    id: idx + 1,
                    agency: ag.name || task.agency,
                    mason: ag.trades.mason || 0,
                    carpenter: ag.trades.carpenter || 0,
                    plumber: ag.trades.plumber || 0,
                    painter: ag.trades.painter || 0,
                    remarks: idx === 0 ? 'Primary contractor' : 'Support team'
                })),
                todayProgress: [
                    { id: 1, item: task.name, qty: progressQty, unit: task.unit, remarks: `${Math.floor(Math.random() * 30) + 70}% completion rate` }
                ],
                tomorrowPlan: [
                    { id: 1, item: taskSet[(currentTaskIdx + 1) % taskSet.length].name, qty: planQty, unit: taskSet[(currentTaskIdx + 1) % taskSet.length].unit, remarks: 'Ready to commence' }
                ],
                generalRemarks: weatherType === 'rainy' ? 'Weather delayed afternoon activities. Indoor work prioritized.' : 'Day progressed as scheduled. No safety incidents.'
            });
        }

        return reports.sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    // Mock Data for Daily Reports Archive
    const [reports, setReports] = useState(generateReports());

    const formatReportTitle = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    };

    // Apply Filters & Sort
    const filteredReports = reports
        .filter(report => {
            if (!filters || !filters.date) return true;
            return report.date === filters.date;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const renderList = () => (
        <div className="space-y-6 anim-fade-in text-left">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredReports.map(report => (
                    <div
                        key={report.id}
                        onClick={() => {
                            setSelectedReport(report);
                            setView('details');
                        }}
                        className="group bg-white dark:bg-[#161b22] p-8 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all cursor-pointer flex flex-col justify-between relative overflow-visible"
                    >
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center space-x-5">
                                <div className="w-14 h-14 bg-gray-50 dark:bg-white/[0.03] rounded-2xl flex relative items-center justify-center border border-gray-100 dark:border-white/5 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10 transition-colors">
                                    <Calendar size={28} className="text-blue-500 stroke-[1.5]" />
                                    <span className="absolute top-[22px] text-[11px] font-bold text-blue-500">
                                        {report.date.split('-')[2]}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-1">{formatReportTitle(report.date)} Report</h4>
                                    <div className="flex items-center space-x-3 text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                                        <div className="flex items-center">
                                            <Users size={12} className="mr-1.5 text-blue-500" />
                                            {report.personnel} Personnel
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 z-10">
                                <button
                                    className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAiReport(report);
                                    }}
                                >
                                    <Sparkles size={16} strokeWidth={1.5} />
                                </button>
                                <button
                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAuditReport(report);
                                    }}
                                >
                                    <Info size={16} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>

                        <p className="text-sm text-gray-500 font-normal mt-2 mb-8 line-clamp-2 leading-relaxed">
                            {report.summary}
                        </p>

                    </div>
                ))}
            </div>

            {/* Premium Detail Side Drawer */}
            {view === 'details' && selectedReport && (
                <div className="fixed inset-0 z-[1000] overflow-hidden">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                        onClick={() => setView('list')}
                    ></div>
                    <div className="absolute inset-y-0 right-0 max-w-[80%] w-full flex">
                        <div className="relative w-full h-full bg-white dark:bg-[#0d1117] shadow-2xl anim-slide-left">
                            <div className="h-full overflow-y-auto custom-scrollbar">
                                <DPRCreate
                                    onBack={() => setView('list')}
                                    initialData={selectedReport}
                                    isReadOnly={true}
                                />
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
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#0d1117] shadow-2xl anim-slide-left flex flex-col h-full border-l border-gray-200 dark:border-white/5">

                        {/* Drawer Header */}
                        <div className="p-10 bg-gradient-to-br from-blue-600/10 to-transparent dark:from-blue-900/20 border-b border-gray-100 dark:border-white/5 text-left relative overflow-hidden text-left">
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
                                <span className="text-[10px] font-bold text-blue-500 tracking-[0.2em]">Report oversight</span>
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{selectedAuditReport.date}</h2>
                            <p className="text-gray-500 text-sm mt-2">Detailed audit trail and administrative lifecycle data</p>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-12">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 rounded-3xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 text-left">
                                    <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-2 flex items-center text-left">
                                        <Clock size={12} className="mr-2 text-blue-500" />
                                        Form timing
                                    </p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedAuditReport.audit.formTiming}</p>
                                </div>
                                <div className="p-6 rounded-3xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 text-left">
                                    <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-2 flex items-center text-left">
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
                                            <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1 text-left">Creation</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Drafted and submitted by <span className="text-blue-500 font-bold">{selectedAuditReport.audit.createdBy}</span></p>
                                            <p className="text-xs text-gray-500 mt-2 flex items-center">
                                                <Clock size={12} className="mr-1.5" />
                                                {new Date(selectedAuditReport.audit.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    {selectedAuditReport.audit.lastUpdated && (
                                        <div className="relative pl-8 border-l-2 border-dashed border-gray-100 dark:border-white/5 text-left">
                                            <div className="absolute top-0 -left-[9px] w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-[#0d1117] shadow-lg shadow-indigo-500/20"></div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1 text-left">Last sync</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Cloud database synchronization complete</p>
                                                <p className="text-xs text-gray-500 mt-2 flex items-center text-left">
                                                    <Clock size={12} className="mr-1.5" />
                                                    {new Date(selectedAuditReport.audit.lastUpdated).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedAuditReport.audit.approval.by && (
                                        <div className="relative pl-8 text-left">
                                            <div className="absolute top-0 -left-[9px] w-4 h-4 rounded-full bg-green-500 ring-4 ring-white dark:ring-[#0d1117] shadow-lg shadow-green-500/20"></div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-1 text-left">Approval</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-medium">Reviewed and authorized by <span className="text-green-500 font-bold">{selectedAuditReport.audit.approval.by}</span></p>
                                                <p className="text-xs text-gray-500 mt-2 flex items-center">
                                                    <ShieldCheck size={12} className="mr-1.5" />
                                                    {new Date(selectedAuditReport.audit.approval.date || selectedAuditReport.audit.createdAt).toLocaleString()}
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
                reportType="Daily Progress"
            />
        </div>
    );

    const renderCreate = () => (
        <DPRCreate onBack={() => setView('list')} />
    );

    if (view === 'create') return renderCreate();
    return renderList();
};

export default DailyProgress;
