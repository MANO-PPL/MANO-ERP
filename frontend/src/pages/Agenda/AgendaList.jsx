import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Plus, ChevronRight, Calendar, ArrowLeft, Info, X, Clock, User, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const defaultAgendas = [
    { id: 10, title: 'kakooos', meetingNo: '23', venue: 'con room', date: '12 January 2026' },
    { id: 11, title: 'Gundu Mali rendu rubai', meetingNo: '70', venue: 'Residency Sarovar Portico, Mexico, dixico', date: '26 December 2025' },
    { id: 12, title: 'test agenda creation', meetingNo: '69', venue: 'dadar office', date: '26 December 2025' },
    { id: 13, title: 'Gundu Mali', meetingNo: '12', venue: 'Residency Sarovar Portico', date: '12 December 2022' },
];

const AgendaList = () => {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const [agendas, setAgendas] = useState(defaultAgendas);
    const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
    const [selectedAgenda, setSelectedAgenda] = useState(null);

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-8vh)] bg-[#fafafa] dark:bg-[#0d1117] font-sans text-gray-900 dark:text-gray-700 dark:text-gray-300 transition-colors">
            {/* Minimal Header - Project Breadcrumbs Format */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg transition-colors w-full">
                <div className="flex items-center space-x-2 text-xs">
                    {projectId ? (
                        <>
                            <button
                                onClick={() => navigate('/projects')}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium cursor-pointer"
                            >
                                Projects
                            </button>
                            <ChevronRight size={14} className="text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                            <span
                                onClick={() => navigate(`/projects/${projectId}`)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium cursor-pointer"
                            >
                                {projectId} Explore Zoho Projects!
                            </span>
                            <ChevronRight size={14} className="text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                            <span
                                onClick={() => navigate(`/projects/${projectId}?tab=General Documents`)} // Navigate to Project Details (General Documents tab will need to be active there, which is default if we used state, but for now navigate to the project dashboard)
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium cursor-pointer"
                            >
                                General Documents
                            </span>
                            <ChevronRight size={14} className="text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                            <span className="text-gray-900 dark:text-gray-200 font-semibold cursor-default">
                                Agenda of Meeting
                            </span>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => navigate('/')}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium cursor-pointer"
                            >
                                Dashboard
                            </button>
                            <ChevronRight size={14} className="text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                            <span className="text-gray-900 dark:text-gray-800 dark:text-gray-200 font-semibold cursor-default">
                                Agenda of Meeting
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 dark:border-white/10">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Agenda of Meeting</h1>
                    <p className="text-xs text-gray-500 mt-1">Upcoming meetings and their planned agendas.</p>
                </div>
                <button
                    onClick={() => navigate(projectId ? `/projects/${projectId}/agenda/new` : '/dashboard/agenda/new')}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>New Agenda</span>
                </button>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {agendas.map((agenda, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={agenda.id}
                            onClick={() => navigate(projectId ? `/projects/${projectId}/agenda/${agenda.id}` : `/dashboard/agenda/${agenda.id}`)}
                            className="group flex flex-col p-6 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 hover:border-blue-500/50 rounded-xl cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-blue-900/10 min-h-[160px]"
                        >
                            <div className="flex items-start justify-between">
                                <div className="p-3 bg-gray-100 dark:bg-gray-800/50 group-hover:bg-blue-500/20 group-hover:text-blue-400 rounded-lg text-gray-600 dark:text-gray-400 transition-colors">
                                    <FileText size={24} />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-2 text-xs bg-gray-50 dark:bg-gray-800/30 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-800 dark:text-gray-200 transition-colors">
                                        <Calendar size={13} />
                                        <span>{agenda.date}</span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAgenda(agenda);
                                            setInfoDrawerOpen(true);
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all active:scale-90"
                                    >
                                        <Info size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-5 mb-2 flex-grow">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                                    {agenda.title}
                                </h3>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10/50 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                                <span className="bg-white dark:bg-[#0d1117] px-2 py-1 rounded border border-gray-200 dark:border-white/10 whitespace-nowrap">
                                    No: {agenda.meetingNo}
                                </span>
                                <span className="bg-white dark:bg-[#0d1117] px-2 py-1 rounded border border-gray-200 dark:border-white/10 line-clamp-1 text-ellipsis flex-1 w-0 min-w-[80px]">
                                    {agenda.venue}
                                </span>
                            </div>
                        </motion.div>
                    ))}

                    {agendas.length === 0 && (
                        <div className="text-center py-20 text-gray-500">
                            No agendas found. Create a new one to get started.
                        </div>
                    )}
                </div>
            </div>
            {/* Info / Version Control Drawer */}
            <AnimatePresence>
                {infoDrawerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setInfoDrawerOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40"
                        />
                        {/* Drawer Content */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute right-0 top-0 bottom-0 w-[400px] bg-white dark:bg-[#0d1117] border-l border-gray-200 dark:border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161b22]">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                        <Info size={20} />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Version Control</h2>
                                </div>
                                <button onClick={() => setInfoDrawerOpen(false)} className="p-2 text-gray-500 hover:text-gray-900 dark:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {/* Current Version Section */}
                                <section>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-4">Initial Identification</label>
                                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-4 shadow-inner">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">Current Version</span>
                                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded border border-blue-500/30 tracking-wider">V1.0.4 FINAL</span>
                                        </div>
                                        <div className="flex items-center space-x-3 text-sm text-gray-700 dark:text-gray-300">
                                            <Clock size={16} className="text-gray-500" />
                                            <span>Last modified: 2 hours ago</span>
                                        </div>
                                        <div className="flex items-center space-x-3 text-sm text-gray-700 dark:text-gray-300">
                                            <User size={16} className="text-gray-500" />
                                            <span>Author: Admin User</span>
                                        </div>
                                    </div>
                                </section>

                                {/* Version History */}
                                <section>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-4">Audit Trail & History</label>
                                    <div className="space-y-4">
                                        {[
                                            { ver: 'V1.0.3', date: 'Yesterday', change: 'Draft refined' },
                                            { ver: 'V1.0.2', date: '2 days ago', change: 'Venue updated' },
                                            { ver: 'V1.0.1', date: 'Last week', change: 'Initial creation' }
                                        ].map((v, i) => (
                                            <div key={i} className="flex items-start space-x-4 group/item">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700 group-hover/item:bg-blue-500 transition-colors mt-1.5" />
                                                    {i !== 2 && <div className="w-px h-10 bg-gray-800 mt-2" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{v.ver}</span>
                                                        <span className="text-[10px] text-gray-500">{v.date}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500">{v.change}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Succeeding Details */}
                                <section>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-4">Succeeding Actions</label>
                                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 space-y-4">
                                        <div className="flex items-center space-x-3">
                                            <ClipboardList size={18} className="text-emerald-500" />
                                            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Next Step: Final Approval</span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic">"Approval pending from Project Manager. Once approved, MoM list will be automatically generated upon meeting completion."</p>
                                    </div>
                                </section>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AgendaList;
