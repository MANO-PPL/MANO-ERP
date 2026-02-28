import React from 'react';
import { ArrowUpRight, Target, Info, Sparkles, ShieldCheck, ChevronRight, X, AlignLeft, Calendar, Clock } from 'lucide-react';
import AISummaryDrawer from '../AISummaryDrawer';

const WeeklySummary = ({ filters, setSubBreadcrumb, view, setView }) => {
    const [selectedReport, setSelectedReport] = React.useState(null);
    const [showDrawer, setShowDrawer] = React.useState(false);
    const [selectedAuditReport, setSelectedAuditReport] = React.useState(null);
    const [selectedAiReport, setSelectedAiReport] = React.useState(null);

    const weeklyData = [
        {
            week: 'Week 8 (Feb 22-28)',
            completion: 68,
            tasksDone: 12,
            milestone: 'Level 1 Structural Integrity',
            audit: {
                createdAt: '2026-02-28T18:00:00Z',
                createdBy: 'Arjun Kumar',
                approval: { status: 'Approved', by: 'Project Manager' }
            }
        },
        {
            week: 'Week 7 (Feb 15-21)',
            completion: 92,
            tasksDone: 18,
            milestone: 'Excavation Phase 2',
            audit: {
                createdAt: '2026-02-21T17:30:00Z',
                createdBy: 'Mano Bharthii',
                approval: { status: 'Approved', by: 'Client Rep' }
            }
        },
    ];

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

    return (
        <div className="space-y-4 anim-fade-in text-left w-full relative overflow-visible">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredData.map((w, i) => (
                    <div
                        key={i}
                        onClick={() => {
                            setSelectedReport(w);
                            setShowDrawer(true);
                        }}
                        className="bg-white dark:bg-gray-50 dark:bg-[#161b22] p-8 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all cursor-pointer relative group/card overflow-visible"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <span className="text-[13px] font-medium text-gray-900 dark:text-white tracking-tight">{w.week}</span>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center text-green-500 font-medium text-xs bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-lg">
                                    <ArrowUpRight size={14} className="mr-1.5" strokeWidth={1.5} />
                                    Efficiency Growth
                                </div>

                                <div className="flex items-center space-x-2 z-10">
                                    <button
                                        className="p-1 text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAiReport(w);
                                        }}
                                    >
                                        <Sparkles size={16} strokeWidth={1.5} />
                                    </button>
                                    <button
                                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAuditReport(w);
                                        }}
                                    >
                                        <Info size={16} strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center mt-8 p-5 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 transition-colors">
                            <Target size={18} className="text-blue-500 mr-4 shrink-0" strokeWidth={1.5} />
                            <div className="overflow-hidden">
                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest leading-none mb-1.5">Core Achievement</p>
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{w.milestone}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

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
