import React, { useState, useEffect, useRef } from 'react';
import {
    FileText, FlaskConical, ClipboardCheck, CheckSquare, ChevronRight,
    Plus, Camera, Image as ImageIcon, CheckCircle2, AlertCircle, Clock,
    User, MapPin, Calendar, ArrowRight, ShieldCheck, X, Upload, MessageSquare,
    BookOpen, LayoutGrid, ListChecks, Eye, Download, Trash2, Search, Info
} from 'lucide-react';

import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import qualityApi from '../../../services/qualityApi';
import QualityMatrix from './QualityMatrix';
import QualityMethodology from './QualityMethodology';
import QualityChecklist from './QualityChecklist';



import CustomInput from '../../../components/CustomInput';

// ─── Constants ──────────────────────────────────────────────────────────────
const STATUSES = {
    PENDING: { label: 'Pending Fix', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/40', icon: Clock },
    FIXED: { label: 'Fixed • Pending Approval', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/40', icon: AlertCircle },
    APPROVED: { label: 'Approved', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-950/50 border-green-200 dark:border-green-800/40', icon: CheckCircle2 }
};

// ─── Sub-Components ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const s = STATUSES[status] || STATUSES.PENDING;
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.color}`}>
            <Icon size={11} />
            {s.label}
        </span>
    );
};

const PhotoGalleryViewer = ({ photos, defaultPhotoUrl, title, badgeColor = 'amber', initialIndex = 0 }) => {
    const photoList = (photos && photos.length > 0)
        ? photos
        : (defaultPhotoUrl ? [{ url: defaultPhotoUrl, label: 'Main Photo' }] : []);

    const [activeIndex, setActiveIndex] = useState(initialIndex || 0);

    useEffect(() => {
        if (initialIndex >= 0 && initialIndex < photoList.length) {
            setActiveIndex(initialIndex);
        }
    }, [initialIndex, photoList.length]);

    if (photoList.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-black/5 dark:bg-black/20 rounded-md border border-dashed border-gray-200 dark:border-white/10">
                <Camera size={32} className="opacity-30 mb-1" />
                <span className="text-xs italic">No photo attached</span>
            </div>
        );
    }

    const currentPhoto = photoList[activeIndex] || photoList[0];

    return (
        <div className="space-y-3 text-left">
            {/* Main Image Display */}
            <div className="relative rounded-lg overflow-hidden bg-black/5 dark:bg-black/40 border border-gray-200 dark:border-white/10 flex items-center justify-center min-h-[250px] max-h-[380px]">
                <img
                    src={currentPhoto.url}
                    alt={currentPhoto.label || title}
                    className="w-full h-full object-contain max-h-[380px]"
                />

                {/* Angle Label Badge */}
                <div className={`absolute top-2 left-2 px-2.5 py-1 text-[10px] font-bold rounded shadow-md uppercase tracking-wider ${
                    badgeColor === 'emerald'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-600 text-white'
                }`}>
                    {currentPhoto.label || 'Photo Angle'}
                </div>

                {photoList.length > 1 && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold rounded">
                        {activeIndex + 1} / {photoList.length}
                    </div>
                )}
            </div>

            {/* Angle Selector Tabs */}
            {photoList.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
                    {photoList.map((p, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveIndex(idx)}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                                activeIndex === idx
                                    ? badgeColor === 'emerald'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700 shadow-xs'
                                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-700 shadow-xs'
                                    : 'bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                            }`}
                        >
                            <img src={p.url} alt="thumb" className="w-5 h-5 object-cover rounded shrink-0" />
                            <span className="whitespace-nowrap font-bold">{p.label || `Angle ${idx + 1}`}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", type = "danger", isProcessing = false }) => {
    if (!isOpen) return null;
    const isDanger = type === "danger";

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] rounded-lg shadow-2xl z-[5001] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10 text-left">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1f242d]/50">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-full ${isDanger ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'}`}>
                            {isDanger ? <AlertCircle size={18} /> : <ShieldCheck size={18} />}
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded cursor-pointer">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-2">
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-[#161b22]">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-3.5 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 rounded text-xs font-semibold cursor-pointer transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className={`px-4 py-1.5 text-white rounded text-xs font-semibold cursor-pointer transition-colors shadow-xs inline-flex items-center gap-1.5 ${
                            isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {isProcessing && <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />}
                        <span>{confirmText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const UploadProgressModal = ({ isOpen, mode, photoCount }) => {
    if (!isOpen) return null;

    const isFix = mode === 'FIX';
    const title = isFix
        ? 'Uploading Resolution Evidence...'
        : mode === 'EDIT_ADD'
        ? 'Updating Quality Observation...'
        : 'Logging Quality Observation...';

    return (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm bg-white dark:bg-[#161b22] rounded-xl shadow-2xl p-6 border border-gray-200 dark:border-white/10 text-center flex flex-col items-center space-y-4">
                {/* Animated Upload Icon Container */}
                <div className="relative flex items-center justify-center w-20 h-20">
                    <div className="absolute inset-0 rounded-full bg-blue-500/20 dark:bg-blue-500/30 animate-ping opacity-75" />
                    <div className="absolute inset-2 rounded-full bg-blue-500/30 dark:bg-blue-500/40 animate-pulse" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg">
                        <Upload className="animate-bounce" size={28} />
                    </div>
                </div>

                {/* Upload Title & Subtitle */}
                <div className="space-y-1">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {photoCount > 0
                            ? `Uploading ${photoCount} evidence ${photoCount === 1 ? 'photo' : 'photos'} & saving record...`
                            : 'Saving quality observation record...'}
                    </p>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full bg-gray-100 dark:bg-white/10 h-2 rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full animate-pulse w-full" />
                </div>

                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    Synchronizing quality data to server...
                </span>
            </div>
        </div>
    );
};

const QAQCModule = ({ onBack, canWrite, project, currentUser }) => {
    const [observations, setObservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modal inspection state for viewing photos: { type: 'BEFORE' | 'AFTER' | 'COMPARE', item } | null
    const [previewModal, setPreviewModal] = useState(null);

    // Right drawer state: 'ADD' | 'FIX' | 'EDIT_ADD' | false
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedObs, setSelectedObs] = useState(null);

    // Multi-photo Form state
    const [formData, setFormData] = useState({
        location: '',
        note: '',
        clearPhotos: false
    });
    // photoList: [{ id, file, preview, label, existingUrl }]
    const [photoList, setPhotoList] = useState([]);
    const [activePresetLabel, setActivePresetLabel] = useState('Front View');
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
        if (project?.id) {
            loadObservations();
        }
    }, [project?.id]);

    const openDrawer = (mode, item = null) => {
        setDrawerOpen(mode);
        setSelectedObs(item);
        if (item) {
            if (mode === 'EDIT_ADD') {
                setFormData({
                    location: item.location,
                    note: item.before_note || '',
                    clearPhotos: false
                });
                const existing = (item.before_photos && item.before_photos.length > 0)
                    ? item.before_photos.map((p, i) => ({ id: `existing_${i}`, preview: p.url, label: p.label || `Photo ${i+1}`, existingUrl: p.url }))
                    : (item.before_photo_url ? [{ id: 'existing_0', preview: item.before_photo_url, label: 'Main Defect Photo', existingUrl: item.before_photo_url }] : []);
                setPhotoList(existing);
            } else if (mode === 'FIX') {
                setFormData({
                    location: item.location,
                    note: item.after_note || '',
                    clearPhotos: false
                });
                const existing = (item.after_photos && item.after_photos.length > 0)
                    ? item.after_photos.map((p, i) => ({ id: `existing_${i}`, preview: p.url, label: p.label || `Resolution Photo ${i+1}`, existingUrl: p.url }))
                    : (item.after_photo_url ? [{ id: 'existing_0', preview: item.after_photo_url, label: 'Main Resolution Photo', existingUrl: item.after_photo_url }] : []);
                setPhotoList(existing);
            }
        } else {
            setFormData({ location: '', note: '', clearPhotos: false });
            setPhotoList([]);
        }
    };

    const handleAddPhotoWithPreset = (presetLabel) => {
        setActivePresetLabel(presetLabel);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const validFiles = [];
        for (const file of files) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['heic', 'heif'].includes(ext)) {
                toast.warning(`HEIC/HEIF files are not allowed (${file.name}). Please convert to JPG/PNG.`);
            } else {
                validFiles.push(file);
            }
        }

        if (validFiles.length === 0) return;

        const defaultLabels = ['Front View', 'Back View', 'Top View', 'Side View', 'Detail / Close-up'];

        const newItems = validFiles.map((file, idx) => {
            let label = activePresetLabel;
            if (validFiles.length > 1) {
                label = defaultLabels[idx % defaultLabels.length] || `Photo ${photoList.length + idx + 1}`;
            }
            return {
                id: `new_${Date.now()}_${idx}`,
                file: file,
                preview: URL.createObjectURL(file),
                label: label
            };
        });

        setPhotoList(prev => [...prev, ...newItems]);
        if (e.target) e.target.value = '';
    };

    const handleRemovePhotoItem = (id) => {
        setPhotoList(prev => prev.filter(item => item.id !== id));
    };

    const handleUpdateLabel = (id, newLabel) => {
        setPhotoList(prev => prev.map(item => item.id === id ? { ...item, label: newLabel } : item));
    };

    // Custom Confirmation Modal state
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: 'danger', title: '', message: '', confirmText: 'Confirm', onConfirm: null, isProcessing: false });

    // Upload rendering animation state
    const [uploadState, setUploadState] = useState({ isUploading: false, mode: 'ADD', photoCount: 0 });

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (isSaving) return;

        if ((drawerOpen === 'ADD' || drawerOpen === 'EDIT_ADD') && !formData.location.trim()) {
            toast.warning('Please specify the location or area');
            return;
        }

        if (drawerOpen === 'FIX' && photoList.length === 0) {
            toast.warning('Please attach at least one resolution photo for verification');
            return;
        }

        const currentMode = drawerOpen;
        const currentObs = selectedObs;
        const count = photoList.filter(p => p.file).length;

        setIsSaving(true);
        setUploadState({ isUploading: true, mode: currentMode, photoCount: count });
        setDrawerOpen(false);

        try {
            const data = new FormData();
            if (currentMode === 'ADD' || currentMode === 'EDIT_ADD') {
                data.append('location', formData.location.trim());
                data.append('note', formData.note.trim());
                if (currentMode === 'EDIT_ADD' && photoList.length === 0) {
                    data.append('clearPhotos', 'true');
                }
            } else if (currentMode === 'FIX') {
                data.append('note', formData.note.trim());
            }

            // Append photos & labels to FormData
            photoList.forEach((item, idx) => {
                if (item.file) {
                    data.append('photos', item.file);
                    data.append('labels', item.label || `Photo ${idx + 1}`);
                }
            });

            if (currentMode === 'ADD') {
                await qualityApi.createObservation(project.id, data);
                toast.success('Observation logged successfully');
            } else if (currentMode === 'EDIT_ADD') {
                await qualityApi.updateObservation(project.id, currentObs.id, data);
                toast.success('Observation record updated successfully');
            } else if (currentMode === 'FIX') {
                await qualityApi.submitFix(project.id, currentObs.id, data);
                toast.success('Resolution details submitted successfully');
            }

            await loadObservations();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to save changes');
        } finally {
            setIsSaving(false);
            setUploadState({ isUploading: false, mode: 'ADD', photoCount: 0 });
        }
    };

    const promptApprove = (item) => {
        setConfirmModal({
            isOpen: true,
            type: 'info',
            title: 'Approve Quality Resolution',
            message: `Are you sure you want to approve the resolution for "${item.location}"? Status will be updated to Approved.`,
            confirmText: 'Approve Resolution',
            isProcessing: false,
            onConfirm: () => executeApprove(item.id)
        });
    };

    const executeApprove = async (obsId) => {
        setConfirmModal(prev => ({ ...prev, isProcessing: true }));
        try {
            await qualityApi.approveFix(project.id, obsId);
            toast.success('Observation approved successfully');
            setConfirmModal({ isOpen: false, type: 'danger', title: '', message: '', confirmText: 'Confirm', onConfirm: null, isProcessing: false });
            loadObservations();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to approve fix');
            setConfirmModal(prev => ({ ...prev, isProcessing: false }));
        }
    };

    const promptDelete = (item) => {
        setConfirmModal({
            isOpen: true,
            type: 'danger',
            title: 'Delete Quality Observation',
            message: `Are you sure you want to delete the observation record for "${item.location}"? This action cannot be undone.`,
            confirmText: 'Delete Observation',
            isProcessing: false,
            onConfirm: () => executeDelete(item.id)
        });
    };

    const executeDelete = async (obsId) => {
        setConfirmModal(prev => ({ ...prev, isProcessing: true }));
        try {
            await qualityApi.deleteObservation(project.id, obsId);
            toast.success('Observation deleted successfully');
            setConfirmModal({ isOpen: false, type: 'danger', title: '', message: '', confirmText: 'Confirm', onConfirm: null, isProcessing: false });
            loadObservations();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to delete observation');
            setConfirmModal(prev => ({ ...prev, isProcessing: false }));
        }
    };

    const counts = {
        ALL: observations.length,
        PENDING: observations.filter(o => o.status === 'PENDING').length,
        FIXED: observations.filter(o => o.status === 'FIXED').length,
        APPROVED: observations.filter(o => o.status === 'APPROVED').length
    };

    const filteredObservations = observations.filter(item => {
        const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            item.location?.toLowerCase().includes(q) ||
            item.before_note?.toLowerCase().includes(q) ||
            item.after_note?.toLowerCase().includes(q) ||
            item.reported_by_name?.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
    });

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden font-sans text-left">
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-3 md:p-4 space-y-3">
                
                {/* Top Action Bar matching QualityChecklist & QualityMethodology theme */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                    
                    {/* Status Filter Pills */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-md border border-gray-200 dark:border-white/10 text-xs font-semibold">
                        <button
                            onClick={() => setStatusFilter('ALL')}
                            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                                statusFilter === 'ALL'
                                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            All ({counts.ALL})
                        </button>
                        <button
                            onClick={() => setStatusFilter('PENDING')}
                            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                                statusFilter === 'PENDING'
                                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            Pending ({counts.PENDING})
                        </button>
                        <button
                            onClick={() => setStatusFilter('FIXED')}
                            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                                statusFilter === 'FIXED'
                                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            Fixed ({counts.FIXED})
                        </button>
                        <button
                            onClick={() => setStatusFilter('APPROVED')}
                            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                                statusFilter === 'APPROVED'
                                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            Approved ({counts.APPROVED})
                        </button>
                    </div>

                    {/* Search & New Observation Action Button */}
                    <div className="flex items-center gap-2.5">
                        <div className="relative w-64 md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search location, issue, reporter..."
                                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer">
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {canWrite && (
                            <button
                                onClick={() => openDrawer('ADD')}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-md text-xs font-semibold transition-all shadow-sm shrink-0 cursor-pointer"
                            >
                                <Plus size={15} />
                                <span>New Observation</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Excel Spreadsheet-Themed Grid Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-16 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-2" />
                    </div>
                ) : filteredObservations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md text-center p-6 space-y-3">
                        <ShieldCheck size={36} className="text-gray-300 dark:text-gray-600" />
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {searchQuery || statusFilter !== 'ALL' ? 'No matching quality observations found' : 'No quality issues reported yet'}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {searchQuery || statusFilter !== 'ALL' ? 'Try clearing your search query or filter.' : 'Log site defects, punch items, or quality observations for instant tracking.'}
                            </p>
                        </div>
                        {canWrite && !searchQuery && statusFilter === 'ALL' && (
                            <button
                                onClick={() => openDrawer('ADD')}
                                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                <Plus size={14} />
                                <span>Log First Observation</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md overflow-hidden shadow-sm">
                        <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/80 dark:bg-[#1f242d] text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-white/10 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="px-3 py-2.5 border-r border-gray-200/60 dark:border-white/5 w-10 text-center">#</th>
                                        <th className="px-4 py-2.5 border-r border-gray-200/60 dark:border-white/5 w-40">Location / Area</th>
                                        <th className="px-4 py-2.5 border-r border-gray-200/60 dark:border-white/5">Defect Description (Before)</th>
                                        <th className="px-4 py-2.5 border-r border-gray-200/60 dark:border-white/5">Resolution Details (After)</th>
                                        <th className="px-3 py-2.5 border-r border-gray-200/60 dark:border-white/5 w-36 text-center">Status</th>
                                        <th className="px-4 py-2.5 border-r border-gray-200/60 dark:border-white/5 w-36">Reported By</th>
                                        <th className="px-3 py-2.5 w-28 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200/60 dark:divide-white/5 font-medium">
                                    {filteredObservations.map((item, idx) => {
                                        const isIssuer = currentUser?.id === item.reported_by;
                                        const isPending = item.status === 'PENDING';
                                        const isFixed = item.status === 'FIXED';

                                        return (
                                            <tr
                                                key={item.id || idx}
                                                className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors text-gray-800 dark:text-gray-200"
                                            >
                                                <td className="px-3 py-2.5 text-center font-bold text-gray-400 border-r border-gray-100 dark:border-white/5 text-[11px]">
                                                    {String(idx + 1).padStart(2, '0')}
                                                </td>

                                                {/* Location */}
                                                <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white border-r border-gray-100 dark:border-white/5 min-w-[160px]">
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="text-blue-500 shrink-0" size={13} />
                                                        <span className="break-words font-bold">{item.location}</span>
                                                    </div>
                                                </td>

                                                {/* Defect Description (BEFORE) */}
                                                <td className="px-4 py-3 border-r border-gray-100 dark:border-white/5 min-w-[280px]">
                                                    <div className="flex items-start gap-3">
                                                        {(item.before_photos && item.before_photos.length > 0) ? (
                                                            <div className="flex flex-col gap-1.5 shrink-0">
                                                                <div
                                                                    onClick={() => setPreviewModal({ type: 'BEFORE', item, activeIndex: 0 })}
                                                                    className="relative group shrink-0 w-36 h-24 rounded-md overflow-hidden bg-gray-100 dark:bg-white/5 border border-amber-300/80 dark:border-amber-800/40 cursor-pointer shadow-xs"
                                                                    title="Click to view Defect Photos in Sidebar"
                                                                >
                                                                    <img
                                                                        src={item.before_photos[0].url}
                                                                        alt="Before Defect"
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                    />
                                                                    {item.before_photos.length > 1 && (
                                                                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold rounded shadow-xs">
                                                                            +{item.before_photos.length - 1} photos
                                                                        </div>
                                                                    )}
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                                        <Eye size={16} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : item.before_photo_url ? (
                                                            <div
                                                                onClick={() => setPreviewModal({ type: 'BEFORE', item, activeIndex: 0 })}
                                                                className="relative group shrink-0 w-36 h-24 rounded-md overflow-hidden bg-gray-100 dark:bg-white/5 border border-amber-300/80 dark:border-amber-800/40 cursor-pointer shadow-xs"
                                                                title="Click to view Defect Photo in Sidebar"
                                                            >
                                                                <img
                                                                    src={item.before_photo_url}
                                                                    alt="Before Defect"
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                                    <Eye size={16} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="shrink-0 w-36 h-24 rounded-md bg-gray-50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center text-gray-400">
                                                                <Camera size={18} className="opacity-30 mb-0.5" />
                                                                <span className="text-[10px] font-semibold">No Photo</span>
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                                                                {item.before_note || <span className="text-gray-400 italic">No notes provided</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Resolution Details (AFTER) */}
                                                <td className="px-4 py-3 border-r border-gray-100 dark:border-white/5 min-w-[280px]">
                                                    <div className="flex items-start gap-3">
                                                        {(item.after_photos && item.after_photos.length > 0) ? (
                                                            <div className="flex flex-col gap-1.5 shrink-0">
                                                                <div
                                                                    onClick={() => setPreviewModal({ type: 'AFTER', item, activeIndex: 0 })}
                                                                    className="relative group shrink-0 w-36 h-24 rounded-md overflow-hidden bg-gray-100 dark:bg-white/5 border border-emerald-300/80 dark:border-emerald-800/40 cursor-pointer shadow-xs"
                                                                    title="Click to view Resolution Photos in Sidebar"
                                                                >
                                                                    <img
                                                                        src={item.after_photos[0].url}
                                                                        alt="Resolution After"
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                    />
                                                                    {item.after_photos.length > 1 && (
                                                                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold rounded shadow-xs">
                                                                            +{item.after_photos.length - 1} photos
                                                                        </div>
                                                                    )}
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                                        <Eye size={16} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : item.after_photo_url ? (
                                                            <div
                                                                onClick={() => setPreviewModal({ type: 'AFTER', item, activeIndex: 0 })}
                                                                className="relative group shrink-0 w-36 h-24 rounded-md overflow-hidden bg-gray-100 dark:bg-white/5 border border-emerald-300/80 dark:border-emerald-800/40 cursor-pointer shadow-xs"
                                                                title="Click to view Fix Photo in Sidebar"
                                                            >
                                                                <img
                                                                    src={item.after_photo_url}
                                                                    alt="Resolution After"
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                                    <Eye size={16} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="shrink-0 w-36 h-24 rounded-md bg-amber-50/30 dark:bg-amber-950/10 border border-dashed border-amber-200 dark:border-amber-800/30 flex flex-col items-center justify-center text-amber-500">
                                                                <AlertCircle size={18} className="opacity-60 mb-0.5" />
                                                                <span className="text-[10px] font-bold">Pending</span>
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            {item.after_note ? (
                                                                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                                                                    {item.after_note}
                                                                </p>
                                                            ) : (
                                                                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                                                                    {isPending ? 'Awaiting Rectification' : 'No fix note attached'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status Badge */}
                                                <td className="px-3 py-2.5 text-center border-r border-gray-100 dark:border-white/5">
                                                    <StatusBadge status={item.status} />
                                                </td>

                                                {/* Reporter Info */}
                                                <td className="px-4 py-2.5 border-r border-gray-100 dark:border-white/5">
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                                            {item.reported_by_name || 'System User'}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400">
                                                            {new Date(item.reported_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </td>

                                                {/* Compact Actions Column */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {/* Full Observation Info Details Button */}
                                                        <button
                                                            onClick={() => setPreviewModal({ type: 'DETAILS', item })}
                                                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer"
                                                            title="Full Observation Details"
                                                        >
                                                            <Info size={14} />
                                                        </button>

                                                        {/* Photo Comparison Trigger */}
                                                        <button
                                                            onClick={() => setPreviewModal({ type: 'COMPARE', item })}
                                                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer"
                                                            title="Compare Before & After Photos"
                                                        >
                                                            <Eye size={14} />
                                                        </button>

                                                        {/* Submit Fix Button */}
                                                        {isPending && (
                                                            <button
                                                                onClick={() => openDrawer('FIX', item)}
                                                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                                                title="Submit Fix Details"
                                                            >
                                                                Fix
                                                            </button>
                                                        )}

                                                        {/* Approve Fix Button */}
                                                        {isFixed && canWrite && (
                                                            <button
                                                                onClick={() => promptApprove(item)}
                                                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                                                title="Approve Resolution"
                                                            >
                                                                Approve
                                                            </button>
                                                        )}

                                                        {/* Delete Button */}
                                                        <button
                                                            onClick={() => promptDelete(item)}
                                                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                                                            title="Delete Observation"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Table Footer with Entries Counter */}
                        <div className="px-4 py-2.5 border-t border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center justify-end bg-gray-50/50 dark:bg-[#161b22]">
                            Showing {filteredObservations.length} of {observations.length} observations
                        </div>
                    </div>
                )}
            </div>

            {/* SINGLE & COMPARISON PHOTO RIGHT SIDEBAR DRAWER PANELS */}
            {previewModal && (
                <>
                    {/* 1. SINGLE BEFORE PHOTO RIGHT SIDEBAR DRAWER */}
                    {previewModal.type === 'BEFORE' && (
                        <div className="fixed inset-0 z-[4000] flex justify-end bg-black/50 backdrop-blur-xs">
                            <div className="absolute inset-0" onClick={() => setPreviewModal(null)} />
                            <div className="relative w-full max-w-lg bg-white dark:bg-[#161b22] h-full shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300 text-left">
                                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1f242d]/50">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                            Defect Photo Evidence (Before)
                                        </span>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                                            <MapPin className="text-blue-500" size={15} />
                                            {previewModal.item.location}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => setPreviewModal(null)}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded transition-colors cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-5 space-y-4">
                                    <PhotoGalleryViewer
                                        photos={previewModal.item.before_photos}
                                        defaultPhotoUrl={previewModal.item.before_photo_url}
                                        title="Defect Evidence"
                                        badgeColor="amber"
                                        initialIndex={previewModal.activeIndex || 0}
                                    />

                                    <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 rounded-lg text-xs text-gray-800 dark:text-gray-200 space-y-1">
                                        <p className="font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Issue Description:</p>
                                        <p className="leading-relaxed whitespace-pre-wrap">{previewModal.item.before_note || 'No notes provided.'}</p>
                                        <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-200/50 dark:border-white/5">
                                            Reported by <span className="font-semibold text-gray-700 dark:text-gray-300">{previewModal.item.reported_by_name || 'System User'}</span> on {new Date(previewModal.item.reported_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-end bg-gray-50/50 dark:bg-[#161b22]">
                                    <button
                                        onClick={() => setPreviewModal(null)}
                                        className="px-4 py-1.5 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded text-xs font-semibold cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. SINGLE AFTER PHOTO RIGHT SIDEBAR DRAWER */}
                    {previewModal.type === 'AFTER' && (
                        <div className="fixed inset-0 z-[4000] flex justify-end bg-black/50 backdrop-blur-xs">
                            <div className="absolute inset-0" onClick={() => setPreviewModal(null)} />
                            <div className="relative w-full max-w-lg bg-white dark:bg-[#161b22] h-full shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300 text-left">
                                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1f242d]/50">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                            Resolution Photo Evidence (After)
                                        </span>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                                            <MapPin className="text-blue-500" size={15} />
                                            {previewModal.item.location}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => setPreviewModal(null)}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded transition-colors cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-5 space-y-4">
                                    <PhotoGalleryViewer
                                        photos={previewModal.item.after_photos}
                                        defaultPhotoUrl={previewModal.item.after_photo_url}
                                        title="Resolution Evidence"
                                        badgeColor="emerald"
                                        initialIndex={previewModal.activeIndex || 0}
                                    />

                                    <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 rounded-lg text-xs text-gray-800 dark:text-gray-200 space-y-1">
                                        <p className="font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Rectification Details:</p>
                                        <p className="leading-relaxed whitespace-pre-wrap">{previewModal.item.after_note || 'Pending fix submission.'}</p>
                                        {previewModal.item.fixed_by_name && (
                                            <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-200/50 dark:border-white/5">
                                                Fixed by <span className="font-semibold text-gray-700 dark:text-gray-300">{previewModal.item.fixed_by_name}</span> {previewModal.item.fixed_at ? `on ${new Date(previewModal.item.fixed_at).toLocaleString()}` : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-end bg-gray-50/50 dark:bg-[#161b22]">
                                    <button
                                        onClick={() => setPreviewModal(null)}
                                        className="px-4 py-1.5 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded text-xs font-semibold cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. SIDE-BY-SIDE PHOTO COMPARISON RIGHT SIDEBAR DRAWER PANEL */}
                    {previewModal.type === 'COMPARE' && (
                        <div className="fixed inset-0 z-[4000] flex justify-end bg-black/50 backdrop-blur-xs">
                            <div className="absolute inset-0" onClick={() => setPreviewModal(null)} />
                            <div className="relative w-full max-w-xl bg-white dark:bg-[#161b22] h-full shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300 text-left">
                                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1f242d]/50">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 font-bold text-[10px] rounded uppercase tracking-wider">
                                                Before and After Comparison
                                            </span>
                                            <StatusBadge status={previewModal.item.status} />
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mt-1">
                                            <MapPin className="text-blue-500" size={16} />
                                            {previewModal.item.location}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => setPreviewModal(null)}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded transition-colors cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-5 space-y-5">
                                    {/* BEFORE CARD */}
                                    <div className="flex flex-col space-y-2.5 p-4 rounded-lg bg-gray-50 dark:bg-white/[0.01] border border-gray-200 dark:border-white/10">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                                <AlertCircle size={14} />
                                                Before (Initial Defect)
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-semibold">
                                                {new Date(previewModal.item.reported_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <PhotoGalleryViewer
                                            photos={previewModal.item.before_photos}
                                            defaultPhotoUrl={previewModal.item.before_photo_url}
                                            title="Before Defect"
                                            badgeColor="amber"
                                        />

                                        <div className="p-3 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded text-xs text-gray-800 dark:text-gray-200">
                                            <p className="font-bold text-[10px] uppercase tracking-wider text-gray-400 mb-1">Issue Description:</p>
                                            <p className="leading-relaxed whitespace-pre-wrap">{previewModal.item.before_note || 'No description notes provided.'}</p>
                                            <p className="text-[10px] text-gray-400 mt-2 font-medium">
                                                Reported by: {previewModal.item.reported_by_name || 'System User'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* AFTER CARD */}
                                    <div className="flex flex-col space-y-2.5 p-4 rounded-lg bg-gray-50 dark:bg-white/[0.01] border border-gray-200 dark:border-white/10">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                                <CheckCircle2 size={14} />
                                                After (Resolution Work)
                                            </span>
                                            {previewModal.item.fixed_at && (
                                                <span className="text-[10px] text-gray-400 font-semibold">
                                                    {new Date(previewModal.item.fixed_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>

                                        <PhotoGalleryViewer
                                            photos={previewModal.item.after_photos}
                                            defaultPhotoUrl={previewModal.item.after_photo_url}
                                            title="After Resolution"
                                            badgeColor="emerald"
                                        />

                                        <div className="p-3 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded text-xs text-gray-800 dark:text-gray-200">
                                            <p className="font-bold text-[10px] uppercase tracking-wider text-gray-400 mb-1">Rectification Details:</p>
                                            <p className="leading-relaxed whitespace-pre-wrap">{previewModal.item.after_note || 'Pending resolution work.'}</p>
                                            {previewModal.item.fixed_by_name && (
                                                <p className="text-[10px] text-gray-400 mt-2 font-medium">
                                                    Fixed by: {previewModal.item.fixed_by_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-[#161b22]">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {previewModal.item.approved_at ? `Approved on ${new Date(previewModal.item.approved_at).toLocaleDateString()}` : 'Inspection Record'}
                                    </span>
                                    <button
                                        onClick={() => setPreviewModal(null)}
                                        className="px-4 py-1.5 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded text-xs font-semibold cursor-pointer"
                                    >
                                        Close Comparison
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. FULL OBSERVATION DETAILS RIGHT SIDEBAR DRAWER PANEL */}
                    {previewModal.type === 'DETAILS' && (
                        <div className="fixed inset-0 z-[4000] flex justify-end bg-black/50 backdrop-blur-xs">
                            <div className="absolute inset-0" onClick={() => setPreviewModal(null)} />
                            <div className="relative w-full max-w-lg bg-white dark:bg-[#161b22] h-full shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300 text-left">
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1f242d]/50">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-mono text-[10px] font-bold rounded border border-blue-200 dark:border-blue-800/40">
                                            #OBS-{String(previewModal.item.id).padStart(4, '0')}
                                        </span>
                                        <StatusBadge status={previewModal.item.status} />
                                    </div>
                                    <button
                                        onClick={() => setPreviewModal(null)}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded transition-colors cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-5 space-y-4">
                                    {/* Location Info */}
                                    <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 space-y-1">
                                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                                            <MapPin size={13} className="text-blue-500" />
                                            <span>Location / Site Area</span>
                                        </div>
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{previewModal.item.location}</h4>
                                    </div>

                                    {/* Defect Section */}
                                    <div className="p-4 rounded-lg bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800/30 space-y-3">
                                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                            <AlertCircle size={14} />
                                            Defect Record (Before)
                                        </span>

                                        <PhotoGalleryViewer
                                            photos={previewModal.item.before_photos}
                                            defaultPhotoUrl={previewModal.item.before_photo_url}
                                            title="Defect Evidence"
                                            badgeColor="amber"
                                        />

                                        <div className="text-xs space-y-1 text-gray-800 dark:text-gray-200">
                                            <p className="font-semibold text-[10px] uppercase text-gray-400">Description:</p>
                                            <p className="leading-relaxed">{previewModal.item.before_note || 'No notes attached.'}</p>
                                        </div>

                                        <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/20 text-[11px] text-gray-500 space-y-0.5">
                                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Reported By:</span> {previewModal.item.reported_by_name || 'System User'}</p>
                                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Reported At:</span> {new Date(previewModal.item.reported_at).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Resolution Section */}
                                    <div className="p-4 rounded-lg bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-800/30 space-y-3">
                                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                            <CheckCircle2 size={14} />
                                            Resolution Record (After)
                                        </span>

                                        <PhotoGalleryViewer
                                            photos={previewModal.item.after_photos}
                                            defaultPhotoUrl={previewModal.item.after_photo_url}
                                            title="Resolution Evidence"
                                            badgeColor="emerald"
                                        />

                                        <div className="text-xs space-y-1 text-gray-800 dark:text-gray-200">
                                            <p className="font-semibold text-[10px] uppercase text-gray-400">Fix Notes:</p>
                                            <p className="leading-relaxed">{previewModal.item.after_note || 'Awaiting rectification work.'}</p>
                                        </div>

                                        <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-800/20 text-[11px] text-gray-500 space-y-0.5">
                                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Fixed By:</span> {previewModal.item.fixed_by_name || 'N/A'}</p>
                                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Fixed At:</span> {previewModal.item.fixed_at ? new Date(previewModal.item.fixed_at).toLocaleString() : 'N/A'}</p>
                                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Approved By:</span> {previewModal.item.approved_by_name || 'N/A'}</p>
                                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Approved At:</span> {previewModal.item.approved_at ? new Date(previewModal.item.approved_at).toLocaleString() : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-[#161b22] gap-2">
                                    <div className="flex items-center gap-2">
                                        {previewModal.item.status === 'PENDING' && (
                                            <button
                                                onClick={() => {
                                                    const item = previewModal.item;
                                                    setPreviewModal(null);
                                                    openDrawer('FIX', item);
                                                }}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                                            >
                                                <Plus size={14} />
                                                <span>Submit Fix</span>
                                            </button>
                                        )}

                                        {previewModal.item.status === 'FIXED' && canWrite && (
                                            <button
                                                onClick={() => {
                                                    const item = previewModal.item;
                                                    setPreviewModal(null);
                                                    promptApprove(item);
                                                }}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                                            >
                                                <CheckCircle2 size={14} />
                                                <span>Approve</span>
                                            </button>
                                        )}

                                        {canWrite && (
                                            <button
                                                onClick={() => {
                                                    const item = previewModal.item;
                                                    setPreviewModal(null);
                                                    openDrawer('EDIT_ADD', item);
                                                }}
                                                className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 rounded text-xs font-semibold cursor-pointer"
                                            >
                                                Edit Record
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setPreviewModal(null)}
                                        className="px-3.5 py-1.5 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded text-xs font-semibold cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Confirmation Modal Popup */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText || 'Confirm'}
                type={confirmModal.type}
                isProcessing={confirmModal.isProcessing}
            />

            {/* Uploading Rendering Animation Modal */}
            <UploadProgressModal
                isOpen={uploadState.isUploading}
                mode={uploadState.mode}
                photoCount={uploadState.photoCount}
            />

            {/* SIDEBAR POPUP (RIGHT DRAWER PANEL MATCHING APP THEME) */}
            {drawerOpen && (
                <div className="fixed inset-0 z-[4000] flex justify-end bg-black/50 backdrop-blur-xs">
                    <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] h-full shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300">
                        
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ShieldCheck className="text-blue-500" size={18} />
                                {drawerOpen === 'ADD' ? 'Log New Quality Observation' :
                                 drawerOpen === 'EDIT_ADD' ? 'Edit Observation Record' : 'Submit Resolution Evidence'}
                            </h3>
                            <button
                                onClick={() => setDrawerOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar p-4 space-y-4 text-left">
                            
                            {(drawerOpen === 'ADD' || drawerOpen === 'EDIT_ADD') && (
                                <div className="space-y-1.5">
                                    <CustomInput
                                        label="Location / Site Area"
                                        value={formData.location}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="e.g. Block A - Floor 3 Slab C14"
                                        required
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <CustomInput
                                    label={drawerOpen.includes('FIX') ? "Rectification Details / Work Done" : "Issue Description / Notes"}
                                    rows={4}
                                    value={formData.note}
                                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                                    placeholder={drawerOpen.includes('FIX') ? "Describe the rectification work done..." : "Describe the defect clearly..."}
                                />
                            </div>

                            <div className="space-y-3 pt-1">
                                <div className="flex items-center justify-between">
                                    <label className="block text-[13px] font-bold text-gray-800 dark:text-gray-200">
                                        {drawerOpen.includes('FIX') ? "Attach Resolution Evidence (Multiple Angles)" : "Attach Defect Evidence (Multiple Angles)"}
                                    </label>
                                    <span className="text-[11px] text-gray-400 font-semibold">{photoList.length} Attached</span>
                                </div>

                                {/* Preset Angle Fast Buttons */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Quick Angle Presets:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {['Front View', 'Back View', 'Top View', 'Side View', 'Detail / Close-up'].map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => handleAddPhotoWithPreset(preset)}
                                                className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-gray-700 dark:text-gray-300 hover:text-blue-600 rounded text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 border border-gray-200/80 dark:border-white/10"
                                            >
                                                <Plus size={11} />
                                                <span>{preset}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Hidden Multi-file input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/png,image/jpeg,image/gif,image/webp"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="qaqc-photo-upload-multi"
                                />

                                {/* Upload Drop Zone */}
                                <label
                                    htmlFor="qaqc-photo-upload-multi"
                                    onClick={() => setActivePresetLabel('Site Photo')}
                                    className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-md p-4 flex flex-col items-center justify-center gap-1.5 bg-gray-50/50 dark:bg-white/[0.01] hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all cursor-pointer group"
                                >
                                    <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                        <Upload size={16} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                            Click to browse & upload multiple images
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            Select photos for Front, Back, Top, or Side angles (JPG, PNG, WEBP)
                                        </p>
                                    </div>
                                </label>

                                {/* Uploaded Photos Gallery List */}
                                {photoList.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-gray-200/60 dark:border-white/5">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">Uploaded Photo Angles:</span>
                                        <div className="space-y-2">
                                            {photoList.map((item) => (
                                                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/10 text-left">
                                                    <div className="w-16 h-14 rounded overflow-hidden shrink-0 bg-black/5 border border-gray-200 dark:border-white/10">
                                                        <img src={item.preview} alt="Angle Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-1">
                                                        <input
                                                            type="text"
                                                            value={item.label}
                                                            onChange={(e) => handleUpdateLabel(item.id, e.target.value)}
                                                            placeholder="Photo Label / Angle (e.g. Front View)"
                                                            className="w-full text-xs font-semibold px-2 py-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded focus:outline-hidden focus:border-blue-500 text-gray-900 dark:text-white"
                                                        />
                                                        <p className="text-[10px] text-gray-400 truncate">
                                                            {item.file ? item.file.name : 'Existing Photo'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePhotoItem(item.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer shrink-0"
                                                        title="Remove Photo"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </form>

                        {/* Drawer Footer Actions */}
                        <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-[#161b22]">
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                {isSaving ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                                ) : (
                                    <CheckCircle2 size={14} />
                                )}
                                <span>
                                    {drawerOpen === 'ADD' ? 'Log Observation' :
                                     drawerOpen === 'EDIT_ADD' ? 'Update Record' : 'Submit Fix'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
            setExtraBreadcrumbs([]);
        } else if (currentView === 'control') {
            setExtraBreadcrumbs([
                { label: 'QA-QC Control' }
            ]);
        } else if (currentView === 'methodology') {
            setExtraBreadcrumbs([
                { label: 'Methodology' }
            ]);
        } else if (currentView === 'matrix') {
            setExtraBreadcrumbs([
                { label: 'QA-QC Matrix' }
            ]);
        } else if (currentView === 'assurance-plan') {
            setExtraBreadcrumbs([
                { label: 'QA-QC Assurance Plan' }
            ]);
        } else if (currentView === 'check-snag') {
            setExtraBreadcrumbs([
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

