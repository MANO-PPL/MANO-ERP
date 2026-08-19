import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Plus, ChevronRight, Calendar, ArrowLeft, Info, X, Clock, User, ClipboardList, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generalDocsApi } from '../../../../services/generalDocsApi';

const AgendaList = ({ onBack, setExtraBreadcrumbs, onSelect, canWrite }) => {
    const { id: projectId } = useParams();
    const [agendas, setAgendas] = useState([]);
    const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
    const [selectedAgenda, setSelectedAgenda] = useState(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Agenda of Meeting' }
        ]);
        
        const fetchAgendas = async () => {
            try {
                setLoading(true);
                const data = await generalDocsApi.getAgendas(projectId);
                if (data && data.agendas) {
                    const mappedAgendas = data.agendas.map(a => ({
                        id: a.agenda_id,
                        title: a.subject,
                        meeting_no: a.meeting_no,
                        venue: a.venue,
                        date: a.date,
                        instance_id: a.instance_id,
                        instance_status: a.instance_status
                    }));
                    setAgendas(mappedAgendas);
                } else {
                    setAgendas([]);
                }
            } catch (err) {
                console.error("Failed to fetch Agendas:", err);
                setAgendas([]);
            } finally {
                setLoading(false);
            }
        };
        fetchAgendas();
    }, [onBack, setExtraBreadcrumbs, projectId]);

    return (
        <div className="flex-1 flex flex-col bg-[#fafafa] dark:bg-[#0d1117] font-sans text-gray-900 dark:text-gray-700 dark:text-gray-300 transition-colors overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] z-20">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg transition-all active:scale-95 group cursor-pointer"
                        title="Back to list"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Agenda of Meeting</h1>
                        <p className="text-xs text-gray-500 mt-1">Upcoming meetings and their planned agendas.</p>
                    </div>
                </div>
                {canWrite && (
                    <button
                        onClick={() => onSelect('new')}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm cursor-pointer"
                    >
                        <Plus size={18} />
                        <span>New Agenda</span>
                    </button>
                )}
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Loader2 className="animate-spin mb-3 text-blue-500" size={28} />
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Loading meeting agendas...</p>
                    </div>
                ) : agendas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#161b22]/30 p-12 text-center my-4">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                            <FileText size={26} />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">No Agendas Created Yet</h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                            There are currently no meeting agendas scheduled for this project.
                        </p>
                        {canWrite && (
                            <button
                                onClick={() => onSelect('new')}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                            >
                                <Plus size={15} />
                                <span>Create First Agenda</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {agendas.map((agenda, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                key={agenda.id}
                                onClick={() => onSelect(agenda.id)}
                                className="group flex flex-col p-6 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 hover:border-blue-500/50 rounded-xl cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-blue-900/10 min-h-[160px]"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-3 bg-gray-100 dark:bg-gray-800/50 group-hover:bg-blue-500/20 group-hover:text-blue-400 rounded-lg text-gray-600 dark:text-gray-400 transition-colors">
                                            <FileText size={24} />
                                        </div>
                                        {agenda.instance_status && (
                                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded border ${
                                                agenda.instance_status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                agenda.instance_status === 'in_review' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                agenda.instance_status === 'rejected' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                agenda.instance_status === 'cancelled' ? 'bg-gray-500/10 text-gray-500 border-gray-500/20' :
                                                'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                            }`}>
                                                {agenda.instance_status === 'drafting' ? 'DRAFT' :
                                                 agenda.instance_status === 'in_review' ? 'UNDER REVIEW' :
                                                 agenda.instance_status.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-1 rounded-full text-gray-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all">
                                        <ChevronRight size={18} />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                            {agenda.meeting_no ? `Meeting #${agenda.meeting_no}` : 'Meeting'}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1 group-hover:text-blue-500 transition-colors line-clamp-1">
                                        {agenda.title || 'Untitled Agenda'}
                                    </h3>
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center space-x-1.5">
                                        <Calendar size={14} className="text-gray-400" />
                                        <span>{agenda.date || 'Date TBD'}</span>
                                    </div>
                                    <span className="truncate max-w-[120px] font-medium">{agenda.venue || 'No venue specified'}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
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
