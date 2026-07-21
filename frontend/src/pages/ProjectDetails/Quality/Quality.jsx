import React, { useState, useEffect } from 'react';
import {
    FileText, FlaskConical, ClipboardCheck, CheckSquare, ChevronRight,
    Plus, Camera, Image as ImageIcon, CheckCircle2, AlertCircle, Clock,
    User, MapPin, Calendar, ArrowRight, ShieldCheck, X, Upload, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants & Demo Data ──────────────────────────────────────────────────
const STATUSES = {
    PENDING: { label: 'Pending Fix', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Clock },
    FIXED: { label: 'Fixed • Pending Approval', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: AlertCircle },
    APPROVED: { label: 'Approved', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 }
};

const INITIAL_OBSERVATIONS = [
    {
        id: 'obs-1',
        location: 'Sector 4 - Column C12',
        issueDate: '2026-02-28',
        reportedBy: 'Rahul Sharma (Site Engineer)',
        beforePhoto: 'https://images.unsplash.com/photo-1590079019458-0eb5b40a3371?q=80&w=800&auto=format&fit=crop',
        beforeNote: 'Honeycombing observed in column casting after formwork removal. Needs immediate rectification before proceeding to slab.',
        status: 'FIXED',
        fixedDate: '2026-03-01',
        fixedBy: 'Vikram Singh (Site Manager)',
        afterPhoto: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=800&auto=format&fit=crop',
        afterNote: 'Chipped off loose concrete, applied bonding agent, and patched with high-strength non-shrink grout. Curing in progress.'
    },
    {
        id: 'obs-2',
        location: 'Block A - Level 2 Slab',
        issueDate: '2026-03-02',
        reportedBy: 'Amit Patel (QA/QC Inspector)',
        beforePhoto: 'https://images.unsplash.com/photo-1503387762-592dee58c160?q=80&w=800&auto=format&fit=crop',
        beforeNote: 'Reinforcement spacing not as per drawing in the junction area. Extra bars missing as per structural detail S-04.',
        status: 'PENDING',
        fixedDate: null,
        fixedBy: null,
        afterPhoto: null,
        afterNote: null
    }
];

// ─── Components ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const s = STATUSES[status];
    const Icon = s.icon;
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.color}`}>
            <Icon size={12} />
            {s.label}
        </div>
    );
};

const PhotoSlot = ({ photo, label, note, date, user }) => (
    <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>{label}</span>
            {date && <span className="normal-case tracking-normal opacity-60 font-medium">{date}</span>}
        </p>
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5 shadow-inner">
            {photo ? (
                <img src={photo} alt={label} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <Camera size={24} className="opacity-20" />
                    <span className="text-[10px] font-medium opacity-40">Awaiting Photo</span>
                </div>
            )}
        </div>
        {note && (
            <div className="mt-3 p-3 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl border border-gray-100/50 dark:border-white/5">
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic">"{note}"</p>
                {user && (
                    <p className="mt-2 text-[10px] font-semibold text-gray-400 flex items-center gap-1">
                        <User size={10} />
                        {user}
                    </p>
                )}
            </div>
        )}
    </div>
);

const QAQCModule = ({ onBack, canWrite }) => {
    const [obs, setObs] = useState(INITIAL_OBSERVATIONS);
    const [drawerOpen, setDrawerOpen] = useState(false); // 'ADD' | 'FIX' | 'EDIT_ADD' | 'EDIT_FIX' | false
    const [selectedObs, setSelectedObs] = useState(null);

    // Form states
    const [formData, setFormData] = useState({ location: '', note: '', photo: null });

    const openDrawer = (mode, item = null) => {
        setDrawerOpen(mode);
        setSelectedObs(item);
        if (item) {
            if (mode === 'EDIT_ADD' || mode === 'FIX') {
                setFormData({ location: item.location, note: item.beforeNote, photo: item.beforePhoto });
            } else if (mode === 'EDIT_FIX') {
                setFormData({ location: item.location, note: item.afterNote, photo: item.afterPhoto });
            }
        } else {
            setFormData({ location: '', note: '', photo: null });
        }
    };

    const approve = (id) => {
        setObs(prev => prev.map(o => o.id === id ? { ...o, status: 'APPROVED' } : o));
    };

    const handleSave = () => {
        if (drawerOpen === 'ADD') {
            const newObs = {
                id: `obs-${Date.now()}`,
                location: formData.location,
                issueDate: new Date().toISOString().split('T')[0],
                reportedBy: 'Admin (System)',
                beforePhoto: 'https://images.unsplash.com/photo-1541888946425-d81bb19480c5?q=80&w=800&auto=format&fit=crop',
                beforeNote: formData.note,
                status: 'PENDING',
                fixedDate: null,
                fixedBy: null,
                afterPhoto: null,
                afterNote: null
            };
            setObs([newObs, ...obs]);
        } else if (drawerOpen === 'EDIT_ADD') {
            setObs(obs.map(o => o.id === selectedObs.id ? { ...o, location: formData.location, beforeNote: formData.note } : o));
        } else if (drawerOpen === 'FIX' || drawerOpen === 'EDIT_FIX') {
            setObs(obs.map(o => o.id === selectedObs.id ? {
                ...o,
                status: 'FIXED',
                afterNote: formData.note,
                afterPhoto: 'https://images.unsplash.com/photo-1504307651254-35680f3366d4?q=80&w=800&auto=format&fit=crop',
                fixedDate: new Date().toISOString().split('T')[0],
                fixedBy: 'Vikram Singh (Site Manager)'
            } : o));
        }
        setDrawerOpen(false);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden Poppins">
            {/* Header */}
            <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-transparent">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">QA / QC Control</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Site Quality Observation & Resolution Tracking</p>
                </div>
                {canWrite && (
                    <div className="flex items-center gap-3">
                        <button onClick={() => setDrawerOpen('ADD')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                            <Plus size={16} />
                            New Observation
                        </button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                {obs.map((item) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                            if (!canWrite) return;
                            if (item.status === 'PENDING') openDrawer('FIX', item);
                            else if (item.status === 'FIXED') openDrawer('EDIT_FIX', item);
                        }}
                        className="group bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer"
                    >
                        {/* Card Header */}
                        <div className="px-8 py-5 flex items-center justify-between border-b border-gray-50 dark:border-white/5 bg-gray-50/20 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-500/5 transition-colors">
                            <div className="flex items-center gap-6">
                                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">{item.location}</h3>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider flex items-center gap-2 mt-0.5">
                                        Observed on {item.issueDate} • Reported by {item.reportedBy.split(' (')[0]}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                                <StatusBadge status={item.status} />
                                {canWrite && (
                                    <button onClick={() => openDrawer('EDIT_ADD', item)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all" title="Edit Observation">
                                        <FileText size={16} />
                                    </button>
                                )}
                                {item.status === 'FIXED' && canWrite && (
                                    <button onClick={() => approve(item.id)} className="p-2 bg-emerald-500 text-white rounded-full hover:scale-110 active:scale-90 transition-all shadow-lg shadow-emerald-500/20" title="Approve Fix">
                                        <ShieldCheck size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Comparison Grid */}
                        <div className="p-8 flex gap-8">
                            <PhotoSlot
                                label="Before View"
                                photo={item.beforePhoto}
                                note={item.beforeNote}
                                date={item.issueDate}
                                user={item.reportedBy}
                            />

                            <div className="flex items-center justify-center px-2">
                                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-center text-gray-300">
                                    <ArrowRight size={20} />
                                </div>
                            </div>

                            <PhotoSlot
                                label="After View (Resolution)"
                                photo={item.afterPhoto}
                                note={item.afterNote}
                                date={item.fixedDate}
                                user={item.fixedBy}
                            />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Drawers */}
            <AnimatePresence>
                {drawerOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-end p-4"
                        onClick={() => setDrawerOpen(false)}
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full max-w-lg h-full bg-white dark:bg-[#1c2333] shadow-2xl rounded-[2rem] overflow-hidden flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {drawerOpen === 'ADD' ? 'Add New Observation' :
                                            drawerOpen === 'EDIT_ADD' ? 'Edit Observation' :
                                                drawerOpen === 'EDIT_FIX' ? 'Edit Resolution' : 'Submit Fixed Evidence'}
                                    </h3>
                                    <div className="mt-4">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                            {drawerOpen.includes('FIX') ? 'RESOLUTION DETAILS' : 'ISSUE DETAILS'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                                {/* Form Inputs */}
                                {(drawerOpen === 'ADD' || drawerOpen === 'EDIT_ADD') && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Location / Area</label>
                                            <div className="relative group">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                                <input
                                                    type="text"
                                                    value={formData.location}
                                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                                    placeholder="e.g. Sector 4, Column C12"
                                                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 outline-none focus:ring-4 ring-blue-500/10 transition-all text-sm font-medium"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Issue Description / Notes</label>
                                    <div className="relative group">
                                        <MessageSquare className="absolute left-4 top-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                        <textarea
                                            rows={4}
                                            value={formData.note}
                                            onChange={e => setFormData({ ...formData, note: e.target.value })}
                                            placeholder={drawerOpen.includes('FIX') ? "Describe the rectification work done..." : "Describe the issue clearly..."}
                                            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 outline-none focus:ring-4 ring-blue-500/10 transition-all text-sm font-medium resize-none shadow-inner"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Upload Photo</label>
                                    {formData.photo ? (
                                        <div className="relative rounded-2xl overflow-hidden aspect-video border border-gray-100 dark:border-white/5 group/img">
                                            <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                <button onClick={() => setFormData({ ...formData, photo: null })} className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg">Remove Photo</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-2 border-dashed border-gray-100 dark:border-white/10 rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 bg-gray-50/50 dark:bg-white/[0.02] hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all duration-300 cursor-pointer group shadow-inner">
                                            <div className="w-16 h-16 bg-white dark:bg-white/5 rounded-[1.5rem] flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                                <Upload size={28} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-black text-gray-700 dark:text-gray-200">Click to upload image</p>
                                                <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest">JPEG, PNG up to 10MB</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] flex items-center justify-end gap-4 mt-auto">
                                <button onClick={() => setDrawerOpen(false)} className="px-6 py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold text-xs uppercase tracking-wider transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleSave} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                                    {drawerOpen === 'ADD' ? 'Add Observation' :
                                        drawerOpen.includes('EDIT') ? 'Update Record' : 'Submit Fix'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const GDCard = ({ name, desc, icon: Icon, type = 'Single Instance', onClick }) => (
    <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onClick}
        className="group relative bg-white dark:bg-[#161b22] p-4 rounded-xl border border-gray-200/60 dark:border-white/5 shadow-sm hover:shadow-md hover:border-blue-500/40 hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[145px] overflow-hidden"
    >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-indigo-600/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative flex flex-col h-full justify-between">
            <div className="space-y-2">
                <div className="flex items-start justify-between w-full">
                    <div className="w-10 h-10 bg-gray-50 dark:bg-white/[0.03] rounded-lg flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 shadow-inner border border-gray-100/50 dark:border-white/5 group-hover:scale-105 transition-all duration-300">
                        <Icon size={20} />
                    </div>
                    <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-full border ${
                        type === 'Single Instance'
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                    }`}>
                        {type}
                    </span>
                </div>
                <div className="space-y-1 text-left">
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight leading-tight group-hover:text-blue-500 transition-colors duration-300">
                        {name}
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-300/80 leading-relaxed font-light line-clamp-2">
                        {desc}
                    </p>
                </div>
            </div>
            <div className="flex items-center space-x-2 pt-2 border-t border-gray-100/50 dark:border-white/5 w-full">
                <span className="text-[8px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-300">
                    Open Document
                </span>
                <ChevronRight size={8} className="text-gray-400 dark:text-gh-text group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5 duration-300" />
            </div>
        </div>
    </motion.div>
);

const QualityIndex = ({ setExtraBreadcrumbs }) => {
    const [view, setView] = useState('index'); // 'index' | 'qaqc'

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'Quality', onClick: () => setView('index') },
            ...(view === 'qaqc' ? [{ label: 'QA/QC Control' }] : [])
        ]);
    }, [setExtraBreadcrumbs, view]);

    const docs = [
        { id: 'methodology', name: 'Methodology', desc: 'Construction methodology documents outlining execution approach, sequencing, and technical specifications.', icon: FileText, type: 'Single Instance' },
        { id: 'qaqc', name: 'QA/QC', desc: 'Site quality observation and resolution tracking — log defects, before/after photos, and approval workflow.', icon: FlaskConical, type: 'Episodic' },
        { id: 'lab', name: 'Quality Control Lab Setup', desc: 'Lab configuration, test procedures, equipment registers, and material testing protocols.', icon: FlaskConical, type: 'Single Instance' },
        { id: 'checklist', name: 'Checklist & Snaglist', desc: 'Inspection checklists and snag lists for each project phase, tracking open and resolved items.', icon: CheckSquare, type: 'Episodic' },
    ];

    if (view === 'qaqc') {
        return <QAQCModule onBack={() => setView('index')} />;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="w-full space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {docs.map((d) => (
                            <GDCard
                                key={d.id}
                                name={d.name}
                                desc={d.desc}
                                icon={d.icon}
                                type={d.type}
                                onClick={() => d.id === 'qaqc' && setView('qaqc')}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QualityIndex;
