import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Plus, ChevronRight, Calendar, ArrowLeft, Info, X, Clock, User, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generalDocsApi } from '../../../../services/generalDocsApi';

const defaultMoMs = [
    { id: 10, title: 'kakooos', meetingNo: '23', venue: 'con room', date: '12 January 2026' },
    { id: 11, title: 'Gundu Mali rendu rubai', meetingNo: '70', venue: 'Residency Sarovar Portico, Mexico, dixico', date: '26 December 2025' },
    { id: 12, title: 'test mom creation', meetingNo: '69', venue: 'dadar office', date: '26 December 2025' },
    { id: 13, title: 'Gundu Mali', meetingNo: '12', venue: 'Residency Sarovar Portico', date: '12 December 2022' },
];

const MoMList = ({ onBack, setExtraBreadcrumbs, onSelect }) => {
    const { id: projectId } = useParams();
    const [moms, setMoms] = useState([]);
    const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
    const [selectedMoM, setSelectedMoM] = useState(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'General Documents', onClick: onBack },
            { label: 'Minutes of Meeting' }
        ]);

        const fetchMoMs = async () => {
            try {
                setLoading(true);
                const data = await generalDocsApi.getMoms(projectId);
                if (data && data.moms) {
                    const mappedMoms = data.moms.map(m => ({
                        id: m.mom_id,
                        title: m.subject,
                        meeting_no: m.meeting_no,
                        venue: m.venue,
                        date: m.date
                    }));
                    setMoms(mappedMoms);
                } else {
                    setMoms([]);
                }
            } catch (err) {
                console.error(err);
                setMoms(defaultMoMs); // Fallback on UI error
            } finally {
                setLoading(false);
            }
        };
        fetchMoMs();
    }, [onBack, setExtraBreadcrumbs, projectId]);

    return (
        <div className="flex-1 flex flex-col bg-[#fafafa] dark:bg-[#0d1117] font-sans text-gray-900 dark:text-gray-700 dark:text-gray-300 transition-colors overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 dark:border-white/10">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Minutes of Meeting</h1>
                    <p className="text-xs text-gray-500 mt-1">Recorded minutes of completed meetings.</p>
                </div>
                <button
                    onClick={() => onSelect('new')}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>New MoM</span>
                </button>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {moms.map((mom, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={mom.id}
                            onClick={() => onSelect(mom.id)}
                            className="group flex flex-col p-6 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 hover:border-blue-500/50 rounded-xl cursor-pointer transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-blue-900/10 min-h-[160px]"
                        >
                            <div className="flex items-start justify-between">
                                <div className="p-3 bg-gray-100 dark:bg-gray-800/50 group-hover:bg-blue-500/20 group-hover:text-blue-400 rounded-lg text-gray-600 dark:text-gray-400 transition-colors">
                                    <FileText size={24} />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-2 text-xs bg-gray-50 dark:bg-gray-800/30 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-800 dark:text-gray-200 transition-colors">
                                        <Calendar size={13} />
                                        <span>{mom.date ? mom.date.split('T')[0] : 'No date'}</span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedMoM(mom);
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
                                    {mom.title}
                                </h3>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10/50 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                                <span className="bg-white dark:bg-[#0d1117] px-2 py-1 rounded border border-gray-200 dark:border-white/10 whitespace-nowrap">
                                    No: {mom.meeting_no || mom.meetingNo}
                                </span>
                                <span className="bg-white dark:bg-[#0d1117] px-2 py-1 rounded border border-gray-200 dark:border-white/10 line-clamp-1 text-ellipsis flex-1 w-0 min-w-[80px]">
                                    {mom.venue}
                                </span>
                            </div>
                        </motion.div>
                    ))}

                    {loading && (
                        <div className="col-span-full text-center py-20 text-gray-500">Loading MoMs...</div>
                    )}
                    {!loading && moms.length === 0 && (
                        <div className="col-span-full text-center py-20 text-gray-500">
                            No MoMs found. Create a new one to get started.
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
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-4">Final Identification</label>
                                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-4 shadow-inner">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">Current Version</span>
                                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded border border-emerald-500/30 tracking-wider">V1.2.0 ARCHIVED</span>
                                        </div>
                                        <div className="flex items-center space-x-3 text-sm text-gray-700 dark:text-gray-300">
                                            <Clock size={16} className="text-gray-500" />
                                            <span>Published: 1 day ago</span>
                                        </div>
                                        <div className="flex items-center space-x-3 text-sm text-gray-700 dark:text-gray-300">
                                            <User size={16} className="text-gray-500" />
                                            <span>Author: Project Lead</span>
                                        </div>
                                    </div>
                                </section>

                                {/* Version History */}
                                <section>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-4">Revision History</label>
                                    <div className="space-y-4">
                                        {[
                                            { ver: 'V1.1.0', date: '3 days ago', change: 'Minutes verified' },
                                            { ver: 'V1.0.1', date: '5 days ago', change: 'Draft generated' },
                                            { ver: 'V1.0.0', date: 'Last week', change: 'Meeting started' }
                                        ].map((v, i) => (
                                            <div key={i} className="flex items-start space-x-4 group/item">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700 group-hover/item:bg-emerald-500 transition-colors mt-1.5" />
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
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] block mb-4">Action Summary</label>
                                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 space-y-4">
                                        <div className="flex items-center space-x-3">
                                            <ClipboardCheck size={18} className="text-blue-500" />
                                            <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Status: Distributed</span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic">"MoM has been distributed to all attendees. Action items have been assigned and linked to the project task board."</p>
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

export default MoMList;
