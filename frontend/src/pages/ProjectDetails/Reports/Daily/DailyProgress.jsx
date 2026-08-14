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
import { dprApi } from '../../../../services/dprApi';

const DailyProgress = ({ filters, setSubBreadcrumb, view, setView, canWrite, project }) => {
    const [selectedReport, setSelectedReport] = useState(null);
    const [selectedAuditReport, setSelectedAuditReport] = useState(null);
    const [selectedAiReport, setSelectedAiReport] = useState(null);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const loadRealReports = async () => {
        const pId = project?.id || project?.dbId;
        if (!pId) {
            setReports([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const fetched = await dprApi.listDPRs(pId);
        setReports(fetched);
        setLoading(false);
    };

    useEffect(() => {
        loadRealReports();
    }, [project?.id, project?.dbId, view]);

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
            {loading ? (
                <div className="bg-white dark:bg-[#161b22] p-12 rounded-2xl border border-gray-100 dark:border-white/5 text-center text-xs text-gray-500 dark:text-zinc-400">
                    Loading Daily Progress Reports...
                </div>
            ) : filteredReports.length === 0 ? (
                <div className="bg-white dark:bg-[#161b22] p-12 rounded-2xl border border-gray-100 dark:border-white/5 text-center space-y-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">No Daily Progress Reports</h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                            There are no saved DPRs for this project yet. Click 'Create Report' to generate your first Daily Progress Report.
                        </p>
                    </div>
                </div>
            ) : (
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
            )}

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
                                    project={project}
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
        <DPRCreate 
            onBack={() => setView('list')} 
            isReadOnly={!canWrite} 
            project={project}
            onSave={(newReport) => {
                setReports([newReport, ...reports]);
                setView('list');
            }}
        />
    );

    if (view === 'create') return renderCreate();
    return renderList();
};

export default DailyProgress;
