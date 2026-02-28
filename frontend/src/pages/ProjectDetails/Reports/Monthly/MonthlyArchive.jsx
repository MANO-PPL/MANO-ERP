import React from 'react';
import { BarChart3, Download, Zap, Clock, ChevronRight, Info, Sparkles, ShieldCheck, X, AlignLeft, Calendar } from 'lucide-react';
import AISummaryDrawer from '../AISummaryDrawer';

const MonthlyArchive = ({ filters, setSubBreadcrumb, view, setView }) => {
    const [selectedReport, setSelectedReport] = React.useState(null);
    const [showDrawer, setShowDrawer] = React.useState(false);
    const [selectedAuditReport, setSelectedAuditReport] = React.useState(null);
    const [selectedAiReport, setSelectedAiReport] = React.useState(null);

    const monthlyData = [
        {
            month: 'February 2026',
            overallProgress: 42,
            budgetUsed: '₹4.2L',
            resources: 14,
            efficiency: '+8%',
            audit: {
                createdAt: '2026-03-01T10:00:00Z',
                createdBy: 'Mano Bharthii',
                approval: { status: 'Approved', by: 'Finance Director' }
            }
        },
        {
            month: 'January 2026',
            overallProgress: 28,
            budgetUsed: '₹3.1L',
            resources: 12,
            efficiency: '+5%',
            audit: {
                createdAt: '2026-02-01T09:30:00Z',
                createdBy: 'Arjun Kumar',
                approval: { status: 'Approved', by: 'Client Rep' }
            }
        },
    ];

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

    const filteredData = monthlyData.filter(m => {
        return !filters.month || m.month.toLowerCase().includes(filters.month.toLowerCase());
    });

    return (
        <div className="space-y-6 anim-fade-in text-left w-full relative overflow-visible">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredData.map((m, i) => (
                    <div
                        key={i}
                        onClick={() => {
                            setSelectedReport(m);
                            setShowDrawer(true);
                        }}
                        className="group p-8 rounded-2xl bg-white dark:bg-gray-50 dark:bg-[#161b22] border border-gray-100 dark:border-white/5 hover:border-blue-500/30 transition-all flex flex-col justify-between gap-8 cursor-pointer shadow-sm hover:shadow-md relative overflow-visible"
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex items-center">
                                <div className="w-14 h-14 bg-gray-50 dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-center text-blue-600 shadow-sm group-hover:shadow-md transition-all">
                                    <BarChart3 size={24} strokeWidth={1.5} />
                                </div>
                                <div className="ml-5">
                                    <h4 className="text-base font-medium text-gray-900 dark:text-white">{m.month}</h4>
                                    <div className="flex items-center mt-2 space-x-4 text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                        <span className="flex items-center">
                                            <Zap size={11} className="mr-1.5 text-yellow-500" />
                                            {m.efficiency}
                                        </span>
                                        <span className="flex items-center">
                                            <Clock size={11} className="mr-1.5 text-blue-500/60" />
                                            {m.resources} Slots
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 z-10">
                                <button
                                    className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAiReport(m);
                                    }}
                                >
                                    <Sparkles size={18} strokeWidth={1.5} />
                                </button>
                                <button
                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAuditReport(m);
                                    }}
                                >
                                    <Info size={18} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-2">
                            <div className="text-right">
                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-2">Utilization</p>
                                <p className="text-base font-medium text-gray-900 dark:text-white">{m.budgetUsed}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Premium Audit Metadata Drawer */}
            {selectedAuditReport && (
                <div className="fixed inset-0 z-[2000] flex justify-end overflow-hidden anim-fade-in group/drawer text-left">
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
                                <div className="p-6 rounded-3xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 text-left text-left">
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
                                    <div className="relative pl-8 border-l-2 border-dashed border-gray-100 dark:border-white/5 text-left text-left">
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
        </div>
    );
};

export default MonthlyArchive;
