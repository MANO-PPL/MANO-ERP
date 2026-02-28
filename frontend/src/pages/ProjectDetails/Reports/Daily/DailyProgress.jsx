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

    // Mock Data for Daily Reports Archive
    const [reports, setReports] = useState([
        {
            id: 1,
            date: '2026-02-27',
            summary: 'Structural assembly of Level 4 completed. Weather remained stable throughout the shift.',
            completion: 100,
            personnel: 24,
            readiness: 'Optimal',
            audit: {
                createdAt: '2026-02-27T17:30:00Z',
                createdBy: 'Mano Bharthii',
                lastUpdated: '2026-02-27T18:15:00Z',
                formTiming: '14 mins',
                approval: { status: 'Approved', by: 'Project Director', date: '2026-02-27T19:00:00Z' }
            },
            weather: 'Sunny',
            temp: '32°C',
            humidity: '45%',
            wind: '12 km/h',
            timeSlots: [
                { id: 1, from: '08:00', to: '12:00' },
                { id: 2, from: '13:00', to: '17:30' }
            ],
            labourData: [
                { id: 1, agency: 'BuildRight Const.', mason: 8, carpenter: 4, plumber: 2, painter: 0, remarks: 'Full attendance' },
                { id: 2, agency: 'SteelForce Ltd', mason: 0, carpenter: 0, plumber: 0, painter: 0, remarks: 'Rebar team onsite' }
            ],
            todayProgress: [
                { id: 1, item: 'Slab Casting - Level 4', qty: 450, unit: 'sqft', remarks: 'Pouring completed at 16:00' },
                { id: 2, item: 'Column Shuttering', qty: 12, unit: 'nos', remarks: 'Alignment checked and approved' }
            ],
            tomorrowPlan: [
                { id: 1, item: 'Curing - Level 4 Slab', qty: 450, unit: 'sqft', remarks: 'Early morning shift' },
                { id: 2, item: 'Steel Binding - Level 5', qty: 2.5, unit: 'tons', remarks: 'Material staged' }
            ],
            generalRemarks: 'Day concluded with all primary objectives met. No safety incidents reported. Supply chain for Level 5 materials confirmed for tomorrow morning.'
        },
        {
            id: 2,
            date: '2026-02-26',
            summary: 'Foundation work for Block B initiated. Significant progress on earthworks.',
            completion: 85,
            personnel: 18,
            readiness: 'High',
            audit: {
                createdAt: '2026-02-26T17:45:00Z',
                createdBy: 'Arjun Kumar',
                lastUpdated: '2026-02-26T17:45:00Z',
                formTiming: '22 mins',
                approval: { status: 'Approved', by: 'Project Manager', date: '2026-02-26T21:30:00Z' }
            },
            weather: 'Cloudy',
            temp: '28°C',
            humidity: '60%',
            wind: '8 km/h',
            timeSlots: [{ id: 1, from: '08:30', to: '17:00' }],
            labourData: [
                { id: 1, agency: 'EarthMovers Inc', mason: 2, carpenter: 0, plumber: 0, painter: 0, remarks: 'Excavation team' }
            ],
            todayProgress: [
                { id: 1, item: 'Excavation - Block B', qty: 1200, unit: 'cum', remarks: '70% of zone A finished' }
            ],
            tomorrowPlan: [
                { id: 1, item: 'PCC Foundation Bed', qty: 200, unit: 'sqft', remarks: 'Subject to soil testing' }
            ],
            generalRemarks: 'Soil quality verified by geo-tech engineer. Stabilization is progressing as per schedule.'
        },
        {
            id: 3,
            date: '2026-02-25',
            summary: 'Monsoon-like conditions delayed afternoon shift. Waterproofing inspections conducted.',
            completion: 40,
            personnel: 12,
            readiness: 'Moderate',
            audit: {
                createdAt: '2026-02-25T18:20:00Z',
                createdBy: 'Suresh Raina',
                lastUpdated: '2026-02-25T19:10:00Z',
                formTiming: '35 mins',
                approval: { status: 'Pending', by: null, date: null }
            },
            weather: 'Rainy',
            temp: '24°C',
            humidity: '85%',
            wind: '20 km/h',
            timeSlots: [{ id: 1, from: '08:00', to: '13:00' }],
            labourData: [
                { id: 1, agency: 'BuildRight Const.', mason: 4, carpenter: 2, plumber: 6, painter: 0, remarks: 'Focus on indoor plumbing' }
            ],
            todayProgress: [
                { id: 1, item: 'Internal Piping - Wing A', qty: 120, unit: 'mtr', remarks: 'Vertical stacks installed' }
            ],
            tomorrowPlan: [
                { id: 1, item: 'Internal Piping - Wing B', qty: 100, unit: 'mtr', remarks: 'Continue indoor work if rain persists' }
            ],
            generalRemarks: 'Unfavorable weather. Site was safe but not productive for civil works.'
        },
        {
            id: 4,
            date: '2026-02-24',
            summary: 'Finishing works on Ground Floor. Painting and electrical fit-outs in progress.',
            completion: 95,
            personnel: 32,
            readiness: 'Optimal',
            audit: {
                createdAt: '2026-02-24T17:15:00Z',
                createdBy: 'Mano Bharthii',
                lastUpdated: '2026-02-24T17:15:00Z',
                formTiming: '18 mins',
                approval: { status: 'Approved', by: 'Client Rep', date: '2026-02-25T10:00:00Z' }
            },
            weather: 'Sunny',
            temp: '34°C',
            humidity: '30%',
            wind: '5 km/h',
            timeSlots: [{ id: 1, from: '08:00', to: '18:00' }],
            labourData: [
                { id: 1, agency: 'FineFinish Interiors', mason: 0, carpenter: 6, plumber: 0, painter: 12, remarks: 'High attendance' }
            ],
            todayProgress: [
                { id: 1, item: 'Wall Painting - Lobbby', qty: 1200, unit: 'sqft', remarks: 'First coat complete' }
            ],
            tomorrowPlan: [
                { id: 1, item: 'Second Coat - Lobby', qty: 1200, unit: 'sqft', remarks: 'Requires clear weather' }
            ],
            generalRemarks: 'Administrative day. All documentation ready for site break-ground.'
        },
        {
            id: 5,
            date: '2026-02-23',
            summary: 'Site cleanup and material staging for week 9. Weekly inventory audit conducted.',
            completion: 100,
            personnel: 8,
            readiness: 'Optimal',
            audit: {
                createdAt: '2026-02-23T16:00:00Z',
                createdBy: 'Arjun Kumar',
                lastUpdated: '2026-02-23T16:30:00Z',
                formTiming: '12 mins',
                approval: { status: 'Approved', by: 'Project Manager', date: '2026-02-23T17:00:00Z' }
            },
            weather: 'Windy',
            temp: '26°C',
            humidity: '50%',
            wind: '25 km/h',
            timeSlots: [{ id: 1, from: '09:00', to: '16:00' }],
            labourData: [
                { id: 1, agency: 'Logistics Pro', mason: 0, carpenter: 0, plumber: 0, painter: 0, remarks: 'Clean-up crew only' }
            ],
            todayProgress: [
                { id: 1, item: 'Inventory Management', qty: 1, unit: 'lot', remarks: 'Reconciled with BOQ' }
            ],
            tomorrowPlan: [
                { id: 1, item: 'Weekly Kickoff Meeting', qty: 1, unit: 'hr', remarks: 'All vendors required' }
            ],
            generalRemarks: 'Survey completed ahead of schedule. Machinery is in excellent condition.'
        },
        {
            id: 6,
            date: '2026-02-22',
            summary: 'Sunday shift - Limited critical path activities. Hoist maintenance successfully completed.',
            completion: 100,
            personnel: 4,
            readiness: 'Controlled',
            audit: {
                createdAt: '2026-02-22T14:30:00Z',
                createdBy: 'Suresh Raina',
                lastUpdated: '2026-02-22T14:30:00Z',
                formTiming: '8 mins',
                approval: { status: 'Approved', by: 'Site Supervisor', date: '2026-02-22T15:00:00Z' }
            },
            weather: 'Sunny',
            temp: '30°C',
            humidity: '40%',
            wind: '10 km/h',
            timeSlots: [{ id: 1, from: '10:00', to: '14:00' }],
            labourData: [
                { id: 1, agency: 'TechHoist Maintenance', mason: 0, carpenter: 0, plumber: 0, painter: 0, remarks: 'Specialist team' }
            ],
            todayProgress: [
                { id: 1, item: 'Hoist Calibration', qty: 2, unit: 'units', remarks: 'Safety certificate issued' }
            ],
            tomorrowPlan: [
                { id: 1, item: 'Full Scale Operations', qty: 1, unit: 'day', remarks: 'Target completion 100%' }
            ],
            generalRemarks: 'Administrative day. All documentation ready for site break-ground.'
        }
    ]);

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
                                <div className="w-14 h-14 bg-gray-50 dark:bg-white/[0.03] rounded-2xl flex flex-col items-center justify-center border border-gray-100 dark:border-white/5 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10 transition-colors">
                                    <span className="text-[10px] font-semibold text-blue-500 uppercase">{report.date.split('-')[1]}</span>
                                    <span className="text-xl font-medium text-gray-900 dark:text-white leading-none mt-0.5">{report.date.split('-')[2]}</span>
                                </div>
                                <div>
                                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-1">{report.date} Report</h4>
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
