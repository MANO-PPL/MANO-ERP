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
                                <button onClick={() => setDrawerOpen(false)} disabled={isSaving} className="px-6 py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50">
                                    Cancel
                                </button>
                                <button onClick={handleSave} disabled={isSaving} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
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

const QualityMethodology = ({ onBack, canWrite, project }) => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);


    const loadMethodologies = async () => {
        setLoading(true);
        try {
            const res = await qualityApi.getMethodologies(project.id);
            if (res.success) {
                setDocs(res.methodologies || []);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load methodology documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMethodologies();
    }, [project.id]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['heic', 'heif'].includes(ext)) {
                toast.error('HEIC/HEIF files are not allowed. Please convert to JPG/PNG before uploading.');
                if (e.target) e.target.value = '';
                setSelectedFile(null);
                return;
            }
            setSelectedFile(file);
            if (!title) {
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                setTitle(nameWithoutExt);
            }
        }
    };


    const handleUpload = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Please enter a document title');
            return;
        }
        if (!selectedFile) {
            toast.error('Please select a file to upload');
            return;
        }

        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('file', selectedFile);

            const res = await qualityApi.uploadMethodology(project.id, formData);
            if (res.success) {
                toast.success('Document uploaded successfully');
                setTitle('');
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setDrawerOpen(false);
                loadMethodologies();
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to upload document');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (docId) => {
        if (window.confirm('Are you sure you want to delete this document?')) {
            try {
                await qualityApi.deleteMethodology(project.id, docId);
                toast.success('Document deleted successfully');
                loadMethodologies();
            } catch (err) {
                console.error(err);
                toast.error('Failed to delete document');
            }
        }
    };

    const handlePreview = (doc) => {
        const type = doc.file_type?.toLowerCase() || '';
        const url = doc.file_url;

        if (['heic', 'heif'].includes(type)) {
            toast.info('No preview available for .HEIC files. Downloading instead.');
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.title;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        if (['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) {
            window.open(url, '_blank');
        } else if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(type)) {
            const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
            window.open(embedUrl, '_blank');
        } else {
            toast.info(`No preview available for .${type.toUpperCase()} files. Downloading instead.`);
            window.open(url, '_blank');
        }
    };


    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden Poppins">
            {/* Header */}
            <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-transparent">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-150 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        title="Back to Dashboard"
                    >
                        <ArrowRight className="rotate-180" size={18} />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Methodology Documents</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Project Quality Guidelines & Standard Execution Operating Procedures</p>
                    </div>
                </div>
                {canWrite && (
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Plus size={16} />
                        Upload Document
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                        <span className="loading loading-spinner loading-md mr-2"></span>
                        Loading Documents...
                    </div>
                ) : docs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-[2rem] p-12 bg-gray-50/5 text-gray-400 text-center">
                        <BookOpen size={48} className="opacity-20 mb-4 text-blue-500" />
                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">No Methodology Files Found</h3>
                        <p className="text-xs opacity-50 mt-1 max-w-sm">Upload execution guidelines, standard practices, or quality protocols for this project.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#161b22] border border-gray-150 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-sm">
                        <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#161b22]">
                            <thead className="bg-[#f9fafb] dark:bg-[#0d1117] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-150 dark:border-white/5 tracking-wider text-[10px] uppercase font-bold">
                                <tr>
                                    <th className="px-6 py-4">Document Title</th>
                                    <th className="px-4 py-4 w-28 text-center">Format</th>
                                    <th className="px-4 py-4 w-32 text-right">Size</th>
                                    <th className="px-6 py-4">Uploaded By</th>
                                    <th className="px-6 py-4">Upload Date</th>
                                    <th className="px-6 py-4 w-32 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {docs.map((doc) => (
                                    <tr
                                        key={doc.id}
                                        className="hover:bg-blue-50/10 dark:hover:bg-white/[0.01] transition-colors group/row text-gray-700 dark:text-gray-300"
                                    >
                                        <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-gray-100 truncate max-w-xs">{doc.title}</td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-full ${
                                                doc.file_type === 'PDF' 
                                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                                    : ['DOCX', 'DOC'].includes(doc.file_type) 
                                                    ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                                                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                            }`}>
                                                {doc.file_type || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-mono text-xs">{formatBytes(doc.file_size)}</td>
                                        <td className="px-6 py-3.5 font-semibold text-gray-500 dark:text-gray-400">{doc.uploaded_by_name || 'System'}</td>
                                        <td className="px-6 py-3.5 font-semibold text-gray-500 dark:text-gray-400">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-3.5 text-center">
                                            <div className="flex items-center justify-center space-x-2">
                                                <button
                                                    onClick={() => handlePreview(doc)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded transition-all"
                                                    title="Preview File"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                <a
                                                    href={doc.file_url}
                                                    download
                                                    className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-all"
                                                    title="Download File"
                                                >
                                                    <Download size={15} />
                                                </a>
                                                {canWrite && (
                                                    <button
                                                        onClick={() => handleDelete(doc.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                                        title="Delete File"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>


            {/* Upload Slider Drawer */}
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
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Upload Methodology Document</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Add details & files</p>
                                </div>
                                <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleUpload} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar flex flex-col justify-between">
                                <div className="space-y-6">
                                    {/* Title */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Document Title</label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="e.g. Concrete Pouring Methodology"
                                            className="w-full px-4 py-3.5 rounded-2xl bg-gray-50/50 dark:bg-white/5 border border-gray-150 dark:border-white/10 outline-none focus:ring-4 ring-blue-500/10 transition-all text-sm font-medium"
                                            required
                                        />
                                    </div>

                                    {/* File Uploader */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Select File</label>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/png,image/jpeg,image/gif,image/webp"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="methodology-file-upload"
                                        />

                                        {selectedFile ? (
                                            <div className="relative rounded-2xl p-4 bg-blue-50/20 border border-blue-500/20 flex items-center justify-between">
                                                <div className="flex items-center space-x-3 truncate">
                                                    <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="truncate text-left">
                                                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{selectedFile.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-semibold">{formatBytes(selectedFile.size)}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-red-500 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label
                                                htmlFor="methodology-file-upload"
                                                className="border-2 border-dashed border-gray-150 dark:border-white/10 rounded-[2rem] p-10 flex flex-col items-center justify-center gap-4 bg-gray-50/50 dark:bg-white/[0.01] hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all duration-350 cursor-pointer group shadow-inner"
                                            >
                                                <div className="w-14 h-14 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                                    <Upload size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs font-black text-gray-700 dark:text-gray-200">Click to upload file</p>
                                                    <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-widest">PDF, DOCX, XLSX, Images up to 25MB (HEIC NOT ALLOWED)</p>
                                                </div>
                                            </label>
                                        )}

                                    </div>
                                </div>

                                <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] flex items-center justify-end gap-4 mt-auto rounded-b-[2rem]">
                                    <button
                                        type="button"
                                        onClick={() => setDrawerOpen(false)}
                                        disabled={isSaving}
                                        className="px-6 py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {isSaving ? 'Uploading...' : 'Upload File'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const QualityChecklist = ({ onBack, canWrite, project }) => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    const loadChecklists = async () => {
        setLoading(true);
        try {
            const res = await qualityApi.getChecklists(project.id);
            if (res.success) {
                setDocs(res.checklists || []);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load checklist & snaglist documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadChecklists();
    }, [project.id]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['heic', 'heif'].includes(ext)) {
                toast.error('HEIC/HEIF files are not allowed. Please convert to JPG/PNG before uploading.');
                if (e.target) e.target.value = '';
                setSelectedFile(null);
                return;
            }
            setSelectedFile(file);
            if (!title) {
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                setTitle(nameWithoutExt);
            }
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Please enter a document title');
            return;
        }
        if (!selectedFile) {
            toast.error('Please select a file to upload');
            return;
        }

        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('title', title.trim());
            formData.append('file', selectedFile);

            const res = await qualityApi.uploadChecklist(project.id, formData);
            if (res.success) {
                toast.success('Document uploaded successfully');
                setTitle('');
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setDrawerOpen(false);
                loadChecklists();
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to upload document');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (docId) => {
        if (window.confirm('Are you sure you want to delete this document?')) {
            try {
                await qualityApi.deleteChecklist(project.id, docId);
                toast.success('Document deleted successfully');
                loadChecklists();
            } catch (err) {
                console.error(err);
                toast.error('Failed to delete document');
            }
        }
    };

    const handlePreview = (doc) => {
        const type = doc.file_type?.toLowerCase() || '';
        const url = doc.file_url;

        if (['heic', 'heif'].includes(type)) {
            toast.info('No preview available for .HEIC files. Downloading instead.');
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.title;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        if (['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) {
            window.open(url, '_blank');
        } else if (['docx', 'doc', 'xlsx', 'xls'].includes(type)) {
            const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
            window.open(embedUrl, '_blank');
        } else if (['pptx', 'ppt'].includes(type)) {
            const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
            window.open(googleViewerUrl, '_blank');
        } else {
            toast.info(`No preview available for .${type.toUpperCase()} files. Downloading instead.`);
            window.open(url, '_blank');
        }
    };

    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden Poppins">
            {/* Header */}
            <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-transparent">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-150 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        title="Back to Dashboard"
                    >
                        <ArrowRight className="rotate-180" size={18} />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Checklist & Snaglist</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Interactive Inspectability Checklists and Site Snag Trackers</p>
                    </div>
                </div>
                {canWrite && (
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Plus size={16} />
                        Upload Document
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                        <span className="loading loading-spinner loading-md mr-2"></span>
                        Loading Documents...
                    </div>
                ) : docs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-[2rem] p-12 bg-gray-50/5 text-gray-400 text-center">
                        <BookOpen size={48} className="opacity-20 mb-4 text-blue-500" />
                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">No Checklist Files Found</h3>
                        <p className="text-xs opacity-50 mt-1 max-w-sm">Upload standard checklists, punch lists, inspectability logs, or snag records for this project.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#161b22] border border-gray-150 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-sm">
                        <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#161b22]">
                            <thead className="bg-[#f9fafb] dark:bg-[#0d1117] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-150 dark:border-white/5 tracking-wider text-[10px] uppercase font-bold">
                                <tr>
                                    <th className="px-6 py-4">Document Title</th>
                                    <th className="px-4 py-4 w-28 text-center">Format</th>
                                    <th className="px-4 py-4 w-32 text-right">Size</th>
                                    <th className="px-6 py-4">Uploaded By</th>
                                    <th className="px-6 py-4">Upload Date</th>
                                    <th className="px-6 py-4 w-32 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {docs.map((doc) => (
                                    <tr
                                        key={doc.id}
                                        className="hover:bg-blue-50/10 dark:hover:bg-white/[0.01] transition-colors group/row text-gray-700 dark:text-gray-300"
                                    >
                                        <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-gray-100 truncate max-w-xs">{doc.title}</td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-full ${
                                                doc.file_type === 'PDF' 
                                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                                    : ['DOCX', 'DOC'].includes(doc.file_type) 
                                                    ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                                                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                            }`}>
                                                {doc.file_type || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-mono text-xs">{formatBytes(doc.file_size)}</td>
                                        <td className="px-6 py-3.5 font-semibold text-gray-500 dark:text-gray-400">{doc.uploaded_by_name || 'System'}</td>
                                        <td className="px-6 py-3.5 font-semibold text-gray-500 dark:text-gray-400">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-3.5 text-center">
                                            <div className="flex items-center justify-center space-x-2">
                                                <button
                                                    onClick={() => handlePreview(doc)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded transition-all"
                                                    title="Preview File"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                <a
                                                    href={doc.file_url}
                                                    download
                                                    className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded transition-all"
                                                    title="Download File"
                                                >
                                                    <Download size={15} />
                                                </a>
                                                {canWrite && (
                                                    <button
                                                        onClick={() => handleDelete(doc.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                                        title="Delete File"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Upload Slider Drawer */}
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
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Upload Checklist Document</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Add details & files</p>
                                </div>
                                <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-gray-150 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleUpload} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar flex flex-col justify-between">
                                <div className="space-y-6">
                                    {/* Title */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Document Title</label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="e.g. Masonry Snag Checklist"
                                            className="w-full px-4 py-3.5 rounded-2xl bg-gray-50/50 dark:bg-white/5 border border-gray-150 dark:border-white/10 outline-none focus:ring-4 ring-blue-500/10 transition-all text-sm font-medium"
                                            required
                                        />
                                    </div>

                                    {/* File Uploader */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Select File</label>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/png,image/jpeg,image/gif,image/webp"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="checklist-file-upload"
                                        />

                                        {selectedFile ? (
                                            <div className="relative rounded-2xl p-4 bg-blue-50/20 border border-blue-500/20 flex items-center justify-between">
                                                <div className="flex items-center space-x-3 truncate">
                                                    <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="truncate text-left">
                                                        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{selectedFile.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-semibold">{formatBytes(selectedFile.size)}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-red-500 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label
                                                htmlFor="checklist-file-upload"
                                                className="border-2 border-dashed border-gray-150 dark:border-white/10 rounded-[2rem] p-10 flex flex-col items-center justify-center gap-4 bg-gray-50/50 dark:bg-white/[0.01] hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all duration-350 cursor-pointer group shadow-inner"
                                            >
                                                <div className="w-14 h-14 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                                    <Upload size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs font-black text-gray-700 dark:text-gray-200">Click to upload file</p>
                                                    <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-widest">PDF, DOCX, XLSX, Images up to 25MB (HEIC NOT ALLOWED)</p>
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] flex items-center justify-end gap-4 mt-auto rounded-b-[2rem]">
                                    <button
                                        type="button"
                                        onClick={() => setDrawerOpen(false)}
                                        disabled={isSaving}
                                        className="px-6 py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {isSaving ? 'Uploading...' : 'Upload File'}
                                    </button>
                                </div>
                            </form>
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

const GDCard = ({ name, subtitle = 'Click to explore archive', icon: Icon, onClick }) => (
    <div
        onClick={onClick}
        className="group relative bg-white dark:bg-[#161b22] p-4 rounded-xl border border-gray-200/60 dark:border-white/5 shadow-sm hover:shadow-md hover:border-blue-500/40 hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[145px] overflow-hidden"
    >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/0 to-blue-600/[0.02] group-hover:via-blue-600/[0.04] transition-all duration-700" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-gray-200 dark:bg-white/10 rounded-r-full group-hover:h-16 group-hover:bg-blue-500 transition-all duration-500" />
        <div className="relative flex items-center w-full">
            <div className="w-16 h-16 bg-gray-50 dark:bg-white/[0.03] rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner border border-transparent group-hover:border-blue-400/50 group-hover:rotate-[10deg] group-hover:scale-110">
                <Icon size={24} />
            </div>
            <div className="ml-8 flex-1 text-left">
                <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-tight group-hover:text-blue-500 transition-colors uppercase mb-1.5">{name}</h3>
                <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">Click to explore archive</span>
                    <div className="h-px w-12 bg-gray-100 dark:bg-white/10 group-hover:w-24 group-hover:bg-blue-500/30 transition-all duration-700" />
                </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                <div className="w-10 h-10 rounded-full border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                    <ChevronRight size={18} />
                </div>
            </div>
        </div>
    </div>
);

const QualityDashboard = ({ categories }) => {
    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {categories.map((cat, i) => (
                        <GDCard 
                            key={i} 
                            name={cat.name} 
                            icon={cat.icon} 
                            onClick={cat.onClick} 
                            subtitle="Click to explore archive"
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
                { label: 'Quality', path: `/projects/${project.id}?tab=quality` },
                { label: 'QA-QC Control' }
            ]);
        } else if (currentView === 'methodology') {
            setExtraBreadcrumbs([
                { label: 'Quality', path: `/projects/${project.id}?tab=quality` },
                { label: 'Methodology' }
            ]);
        } else if (currentView === 'matrix') {
            setExtraBreadcrumbs([
                { label: 'Quality', path: `/projects/${project.id}?tab=quality` },
                { label: 'QA-QC Matrix' }
            ]);
        } else if (currentView === 'assurance-plan') {
            setExtraBreadcrumbs([
                { label: 'Quality', path: `/projects/${project.id}?tab=quality` },
                { label: 'QA-QC Assurance Plan' }
            ]);
        } else if (currentView === 'check-snag') {
            setExtraBreadcrumbs([
                { label: 'Quality', path: `/projects/${project.id}?tab=quality` },
                { label: 'Checklist & Snaglist' }
            ]);
        }
    }, [currentView, setExtraBreadcrumbs, project.id]);

    const categories = [
        {
            name: 'Methodology',
            desc: 'Standard operating procedures, quality guidelines, and execution methodologies.',
            icon: BookOpen,
            actionText: 'Explore Guidelines',
            onClick: () => handleSelectView('methodology')
        },
        {
            name: 'QA/QC Matrix',
            desc: 'Detailed inspectability matrix defining parameters, frequencies, and standards.',
            icon: LayoutGrid,
            actionText: 'View Parameters',
            onClick: () => handleSelectView('matrix')
        },
        {
            name: 'QA/QC Assurance Plan',
            desc: 'Comprehensive project quality plan, roles, and quality assurance framework.',
            icon: ClipboardCheck,
            actionText: 'Open Assurance Plan',
            onClick: () => handleSelectView('assurance-plan')
        },
        {
            name: 'Checklist & Snaglist',
            desc: 'Interactive punch lists, inspectability logs, and structural checklists.',
            icon: ListChecks,
            actionText: 'Manage Snaglist',
            onClick: () => handleSelectView('check-snag')
        },
        {
            name: 'QA/QC Control',
            desc: 'Live site defect reporting, rectification logs, and photo verification.',
            icon: ShieldCheck,
            actionText: 'Open Site Tracker',
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

