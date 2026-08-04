import React, { useState, useEffect, useRef } from 'react';
import {
    FileText, FlaskConical, ClipboardCheck, CheckSquare, ChevronRight,
    Plus, Camera, Image as ImageIcon, CheckCircle2, AlertCircle, Clock,
    User, MapPin, Calendar, ArrowRight, ShieldCheck, X, Upload, MessageSquare,
    BookOpen, LayoutGrid, ListChecks, Eye, Download, Trash2
} from 'lucide-react';

import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import qualityApi from '../../../services/qualityApi';
import QualityMatrix from './QualityMatrix';
import QualityMethodology from './QualityMethodology';
import QualityChecklist from './QualityChecklist';



// ─── Constants ──────────────────────────────────────────────────────────────
const STATUSES = {
    PENDING: { label: 'Pending Fix', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Clock },
    FIXED: { label: 'Fixed • Pending Approval', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: AlertCircle },
    APPROVED: { label: 'Approved', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 }
};

// ─── Sub-Components ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const s = STATUSES[status] || STATUSES.PENDING;
    const Icon = s.icon;
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.color}`}>
            <Icon size={12} />
            {s.label}
        </div>
    );
};

const PhotoSlot = ({ photo, label, note, date, user }) => (
    <div className="flex-1 min-w-0 flex flex-col">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>{label}</span>
            {date && <span className="normal-case tracking-normal opacity-60 font-medium">{date}</span>}
        </p>
        <div className="relative rounded-2xl overflow-hidden bg-gray-50/50 dark:bg-white/[0.01] border border-gray-100 dark:border-white/5 flex items-center justify-center min-h-[180px] max-h-[360px] w-full">
            {photo ? (
                <img 
                    src={photo} 
                    alt={label} 
                    className="max-h-[360px] w-auto max-w-full object-contain rounded-2xl" 
                />
            ) : (
                <div className="h-[180px] w-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <Camera size={24} className="opacity-20" />
                    <span className="text-[10px] font-medium opacity-40">Awaiting Photo</span>
                </div>
            )}
        </div>
        {note && (
            <div className="mt-3 p-3 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl border border-gray-100/50 dark:border-white/5 flex-1">
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

const QAQCObservationRow = ({ item, currentUser, canWrite, onEdit, onFix, onApprove, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const timerRef = useRef(null);

    const handleMouseEnter = () => {
        // Deliberate 400ms delay before start of elongation to prevent accidental expansion on scrolling
        timerRef.current = setTimeout(() => {
            setIsExpanded(true);
        }, 400);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setIsExpanded(false);
    };

    const toggleExpand = (e) => {
        // Prevent toggling if user clicks an action button
        if (e.target.closest('button')) return;
        setIsExpanded(prev => !prev);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const isIssuer = currentUser?.id === item.reported_by;
    const isPending = item.status === 'PENDING';
    const isFixed = item.status === 'FIXED';

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={toggleExpand}
            className="group relative bg-white dark:bg-[#161b22] rounded-2xl border border-gray-150 dark:border-white/5 overflow-hidden shadow-sm hover:shadow-lg hover:scale-[1.01] hover:border-blue-500/30 transition-[transform,border-color,box-shadow] duration-300 flex flex-col cursor-pointer text-left"
        >
            {/* Header Row */}
            <div className="h-[72px] min-h-[72px] px-8 flex items-center justify-between bg-gray-50/10 group-hover:bg-blue-50/10 dark:group-hover:bg-blue-500/[0.01] transition-colors duration-300">
                <div className="flex items-center gap-6 flex-1 min-w-0">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500 group-hover:scale-105 transition-transform duration-300">
                        <MapPin size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{item.location}</h3>
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                            <span>Reported by {item.reported_by_name || 'System'}</span>
                            <span className="opacity-40">•</span>
                            <span>{new Date(item.reported_at).toLocaleDateString()}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                    <StatusBadge status={item.status} />

                    <div className="flex items-center gap-1.5 ml-2">
                        {isPending && isIssuer && (
                            <button onClick={() => onEdit(item)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all" title="Edit Issue">
                                <FileText size={15} />
                            </button>
                        )}
                        {isPending && (
                            <button onClick={() => onFix(item)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all" title="Submit Resolution">
                                Resolve
                            </button>
                        )}
                        {isFixed && canWrite && (
                            <button onClick={() => onApprove(item.id)} className="p-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-500 rounded-lg transition-all" title="Approve Fix">
                                <ShieldCheck size={16} />
                            </button>
                        )}
                        <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Delete Observation">
                            <X size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Elongated detailed content */}
            <motion.div
                initial={false}
                animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
            >
                <div className="p-8 flex gap-8 bg-gray-50/20 dark:bg-transparent border-t border-gray-100 dark:border-white/5">
                    <PhotoSlot
                        label="Before View (Problem)"
                        photo={item.before_photo_url}
                        note={item.before_note}
                        date={new Date(item.reported_at).toLocaleString()}
                        user={item.reported_by_name}
                    />

                    {(item.status === 'FIXED' || item.status === 'APPROVED') ? (
                        <>
                            <div className="flex items-center justify-center px-2">
                                <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-center text-gray-300">
                                    <ArrowRight size={16} />
                                </div>
                            </div>

                            <PhotoSlot
                                label="After View (Resolution)"
                                photo={item.after_photo_url}
                                note={item.after_note}
                                date={item.fixed_at ? new Date(item.fixed_at).toLocaleString() : null}
                                user={item.fixed_by_name || 'Assigned Employee'}
                            />
                        </>
                    ) : (
                        <div className="flex-1 min-w-0 flex flex-col justify-center items-center border-2 border-dashed border-gray-100 dark:border-white/5 rounded-2xl p-6 bg-gray-50/10 text-gray-400">
                            <AlertCircle size={24} className="opacity-30 mb-2" />
                            <span className="text-xs font-semibold opacity-50 uppercase tracking-widest">Awaiting Rectification</span>
                            <p className="text-[10px] opacity-40 mt-1 text-center">Any assignee can resolve this issue by uploading a fix image & notes.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

const QAQCModule = ({ onBack, canWrite, project, currentUser }) => {
    const [observations, setObservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [drawerOpen, setDrawerOpen] = useState(false); // 'ADD' | 'FIX' | 'EDIT_ADD' | false
    const [selectedObs, setSelectedObs] = useState(null);

    // Form states
    const [formData, setFormData] = useState({ location: '', note: '', photo: null, file: null, clearPhoto: false });
    const fileInputRef = useRef(null);

    const loadObservations = async () => {
        setLoading(true);
        try {
            const data = await qualityApi.getObservations(project.id);
            if (data.success) {
                setObservations(data.observations || []);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load observations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadObservations();
    }, [project.id]);

    const openDrawer = (mode, item = null) => {
        setDrawerOpen(mode);
        setSelectedObs(item);
        if (item) {
            if (mode === 'EDIT_ADD') {
                setFormData({
                    location: item.location,
                    note: item.before_note || '',
                    photo: item.before_photo_url || null,
                    file: null,
                    clearPhoto: false
                });
            } else if (mode === 'FIX') {
                setFormData({
                    location: item.location,
                    note: item.after_note || '',
                    photo: item.after_photo_url || null,
                    file: null,
                    clearPhoto: false
                });
            }
        } else {
            setFormData({ location: '', note: '', photo: null, file: null, clearPhoto: false });
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({
                ...prev,
                file: file,
                photo: URL.createObjectURL(file),
                clearPhoto: false
            }));
        }
    };

    const handleRemovePhoto = () => {
        setFormData(prev => ({
            ...prev,
            file: null,
            photo: null,
            clearPhoto: true
        }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);

        // Extract drawerOpen and selectedObs to local variables since we close the drawer immediately
        const currentMode = drawerOpen;
        const currentObs = selectedObs;

        setDrawerOpen(false); // Collapse sidebar smoothly right away!

        try {
            const data = new FormData();
            if (currentMode === 'ADD' || currentMode === 'EDIT_ADD') {
                data.append('location', formData.location);
                data.append('note', formData.note);
                if (formData.file) {
                    data.append('photo', formData.file);
                }
                if (currentMode === 'EDIT_ADD') {
                    data.append('clearPhoto', formData.clearPhoto);
                }
            } else if (currentMode === 'FIX') {
                data.append('note', formData.note);
                if (formData.file) {
                    data.append('photo', formData.file);
                }
            }

            if (currentMode === 'ADD') {
                await qualityApi.createObservation(project.id, data);
                toast.success('Observation created successfully');
            } else if (currentMode === 'EDIT_ADD') {
                await qualityApi.updateObservation(project.id, currentObs.id, data);
                toast.success('Observation updated successfully');
            } else if (currentMode === 'FIX') {
                await qualityApi.submitFix(project.id, currentObs.id, data);
                toast.success('Rectification details submitted');
            }

            loadObservations();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async (obsId) => {
        try {
            await qualityApi.approveFix(project.id, obsId);
            toast.success('Observation approved successfully');
            loadObservations();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to approve fix');
        }
    };

    const handleDelete = async (obsId) => {
        if (window.confirm('Are you sure you want to delete this observation?')) {
            try {
                await qualityApi.deleteObservation(project.id, obsId);
                toast.success('Observation deleted successfully');
                loadObservations();
            } catch (err) {
                console.error(err);
                toast.error(err.response?.data?.message || 'Failed to delete');
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden Poppins">
            {/* Header */}
            <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-transparent">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-gray-150 dark:hover:bg-white/5 rounded-full transition-colors text-gray-450 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            title="Back to Dashboard"
                        >
                            <ArrowRight className="rotate-180" size={18} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">QA / QC Control</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Site Quality Observation & Resolution Tracking</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {canWrite && (
                        <button onClick={() => openDrawer('ADD')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                            <Plus size={16} />
                            New Observation
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                        <span className="loading loading-spinner loading-md mr-2"></span>
                        Loading Observations...
                    </div>
                ) : observations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-[2rem] p-12 bg-gray-50/10 text-gray-400 text-center">
                        <ShieldCheck size={48} className="opacity-20 mb-4 text-blue-500" />
                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">No Quality Issues Found</h3>
                        <p className="text-xs opacity-50 mt-1 max-w-sm">All components are currently matching quality targets. Create a new observation to log a checklist defect.</p>
                    </div>
                ) : (
                    observations.map((item) => (
                        <QAQCObservationRow
                            key={item.id}
                            item={item}
                            currentUser={currentUser}
                            canWrite={canWrite}
                            onEdit={(obs) => openDrawer('EDIT_ADD', obs)}
                            onFix={(obs) => openDrawer('FIX', obs)}
                            onApprove={handleApprove}
                            onDelete={handleDelete}
                        />
                    ))
                )}
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
                            className="w-full max-w-lg h-full bg-white dark:bg-[#1c2333] shadow-2xl rounded-[2rem] overflow-hidden flex flex-col text-left"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {drawerOpen === 'ADD' ? 'Add New Observation' :
                                            drawerOpen === 'EDIT_ADD' ? 'Edit Observation' : 'Submit Fixed Evidence'}
                                    </h3>
                                    <div className="mt-2">
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
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                                        {drawerOpen.includes('FIX') ? 'Resolution Notes' : 'Issue Description / Notes'}
                                    </label>
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
                                    
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        id="qaqc-photo-upload"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />

                                    {formData.photo ? (
                                        <div className="relative rounded-2xl overflow-hidden aspect-video border border-gray-100 dark:border-white/5 group/img">
                                            <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                <button onClick={handleRemovePhoto} className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg">Remove Photo</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <label
                                            htmlFor="qaqc-photo-upload"
                                            className="border-2 border-dashed border-gray-100 dark:border-white/10 rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 bg-gray-50/50 dark:bg-white/[0.02] hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all duration-300 cursor-pointer group shadow-inner"
                                        >
                                            <div className="w-16 h-16 bg-white dark:bg-white/5 rounded-[1.5rem] flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                                <Upload size={28} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-black text-gray-700 dark:text-gray-200">Click to upload image</p>
                                                <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest">JPEG, PNG up to 10MB</p>
                                            </div>
                                        </label>
                                    )}
                                </div>
                            </div>

                            <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] flex items-center justify-end gap-4 mt-auto">
                                <button onClick={() => setDrawerOpen(false)} disabled={isSaving} className="px-6 py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer">
                                    Cancel
                                </button>
                                <button onClick={handleSave} disabled={isSaving} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                                    {isSaving ? 'Saving...' : 
                                     drawerOpen === 'ADD' ? 'Add Observation' :
                                     drawerOpen === 'EDIT_ADD' ? 'Update Record' : 'Submit Fix'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const QualityPlaceholder = ({ title, description, onBack }) => {


    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#0d1117] h-full overflow-y-auto Poppins">
            <div className="max-w-md p-10 rounded-[2.5rem] bg-gray-50/50 dark:bg-[#161b22]/50 border border-gray-100 dark:border-white/5 shadow-inner flex flex-col items-center">
                <div className="w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center text-blue-500 mb-6 animate-pulse">
                    <ClipboardCheck size={36} />
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/20 mb-4">
                    Coming Soon
                </span>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">
                    {title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
                    {description}
                </p>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <ArrowRight className="rotate-180" size={16} />
                    Back to Quality Dashboard
                </button>
            </div>
        </div>
    );
};

const GDCard = ({ name, desc, type = 'Single Instance', icon: Icon, onClick }) => (
    <div
        onClick={onClick}
        className="group relative bg-white dark:bg-[#161b22] p-4 rounded-xl border border-gray-200/60 dark:border-white/5 shadow-sm hover:shadow-md hover:border-blue-500/40 hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[145px] overflow-hidden text-left"
    >
        {/* Background gradient glow on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-indigo-600/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative flex flex-col h-full justify-between">
            <div className="space-y-2">
                <div className="flex items-start justify-between w-full">
                    {/* Icon Container */}
                    <div className="w-10 h-10 bg-gray-50 dark:bg-white/[0.03] rounded-lg flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 shadow-inner border border-gray-100/50 dark:border-white/5 group-hover:scale-105 transition-all duration-300">
                        <Icon size={20} />
                    </div>

                    {/* Type Badge */}
                    <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-full border ${
                        type === 'Single Instance'
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            : type === 'Live Module'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                    }`}>
                        {type}
                    </span>
                </div>

                {/* Text Info */}
                <div className="space-y-1">
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight leading-tight group-hover:text-blue-500 transition-colors duration-300">
                        {name}
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-300/80 leading-relaxed font-light line-clamp-2">
                        {desc}
                    </p>
                </div>
            </div>

            {/* Action link */}
            <div className="flex items-center space-x-1.5 pt-2 border-t border-gray-100/50 dark:border-white/5 w-full">
                <span className="text-[8px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-300">
                    Open Module
                </span>
                <ChevronRight size={10} className="text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5 duration-300" />
            </div>
        </div>
    </div>
);

const QualityDashboard = ({ categories }) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in text-left font-sans">
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-3 md:p-4 space-y-3 bg-gray-50/20 dark:bg-transparent">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {categories.map((cat, i) => (
                        <GDCard 
                            key={i} 
                            name={cat.name} 
                            desc={cat.desc}
                            type={cat.type}
                            icon={cat.icon} 
                            onClick={cat.onClick} 
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const QualityIndex = ({ setExtraBreadcrumbs, project, projectPermissions, isAdmin, user, canWrite }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentView = searchParams.get('view') || 'grid';

    const handleSelectView = (view) => {
        const newParams = new URLSearchParams(searchParams);
        if (view === 'grid') {
            newParams.delete('view');
        } else {
            newParams.set('view', view);
        }
        setSearchParams(newParams);
    };

    useEffect(() => {
        if (currentView === 'grid') {
            setExtraBreadcrumbs([
                { label: 'Quality' }
            ]);
        } else if (currentView === 'control') {
            setExtraBreadcrumbs([
                { label: 'Quality', onClick: () => handleSelectView('grid'), path: `/projects/${project.id}?tab=quality` },
                { label: 'QA-QC Control' }
            ]);
        } else if (currentView === 'methodology') {
            setExtraBreadcrumbs([
                { label: 'Quality', onClick: () => handleSelectView('grid'), path: `/projects/${project.id}?tab=quality` },
                { label: 'Methodology' }
            ]);
        } else if (currentView === 'matrix') {
            setExtraBreadcrumbs([
                { label: 'Quality', onClick: () => handleSelectView('grid'), path: `/projects/${project.id}?tab=quality` },
                { label: 'QA-QC Matrix' }
            ]);
        } else if (currentView === 'assurance-plan') {
            setExtraBreadcrumbs([
                { label: 'Quality', onClick: () => handleSelectView('grid'), path: `/projects/${project.id}?tab=quality` },
                { label: 'QA-QC Assurance Plan' }
            ]);
        } else if (currentView === 'check-snag') {
            setExtraBreadcrumbs([
                { label: 'Quality', onClick: () => handleSelectView('grid'), path: `/projects/${project.id}?tab=quality` },
                { label: 'Checklist & Snaglist' }
            ]);
        }
    }, [currentView, setExtraBreadcrumbs, project.id]);

    const categories = [
        {
            name: 'Methodology',
            desc: 'Standard operating procedures, quality guidelines, and execution methodologies.',
            icon: BookOpen,
            type: 'Single Instance',
            onClick: () => handleSelectView('methodology')
        },
        {
            name: 'QA/QC Matrix',
            desc: 'Detailed inspectability matrix defining parameters, frequencies, and standards.',
            icon: LayoutGrid,
            type: 'Single Instance',
            onClick: () => handleSelectView('matrix')
        },
        {
            name: 'QA/QC Assurance Plan',
            desc: 'Comprehensive project quality plan, roles, and quality assurance framework.',
            icon: ClipboardCheck,
            type: 'Single Instance',
            onClick: () => handleSelectView('assurance-plan')
        },
        {
            name: 'Checklist & Snaglist',
            desc: 'Interactive punch lists, inspectability logs, and structural checklists.',
            icon: ListChecks,
            type: 'Episodic',
            onClick: () => handleSelectView('check-snag')
        },
        {
            name: 'QA/QC Control',
            desc: 'Live site defect reporting, rectification logs, and photo verification.',
            icon: ShieldCheck,
            type: 'Live Module',
            onClick: () => handleSelectView('control')
        }
    ];

    if (currentView === 'control') {
        return (
            <QAQCModule 
                canWrite={canWrite} 
                project={project} 
                currentUser={user} 
                onBack={() => handleSelectView('grid')}
            />
        );
    }

    if (currentView === 'methodology') {
        return (
            <QualityMethodology 
                project={project} 
                canWrite={canWrite}
                onBack={() => handleSelectView('grid')}
            />
        );
    }

    if (currentView === 'matrix') {
        return (
            <QualityMatrix 
                project={project}
                canWrite={canWrite}
                onBack={() => handleSelectView('grid')}
            />
        );
    }


    if (currentView === 'assurance-plan') {
        return (
            <QualityPlaceholder 
                title="QA/QC Assurance Plan"
                description="Comprehensive project quality assurance plan outlining roles, standards, and safety assurance frameworks."
                onBack={() => handleSelectView('grid')}
            />
        );
    }

    if (currentView === 'check-snag') {
        return (
            <QualityChecklist 
                project={project} 
                canWrite={canWrite}
                onBack={() => handleSelectView('grid')}
            />
        );
    }

    return (
        <QualityDashboard categories={categories} />
    );
};


export default QualityIndex;

