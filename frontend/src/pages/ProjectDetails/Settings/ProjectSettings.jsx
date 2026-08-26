import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Upload, Trash2, X, Loader2, Save,
    Calendar, Clock, Image as ImageIcon, Info, Tag, Eye, FileText,
    MapPin, AlertCircle, ShieldAlert, RefreshCw
} from 'lucide-react';
import CustomInput from '../../../components/CustomInput';
import CustomDatePicker from '../../../components/CustomDatePicker';
import CustomSelect from '../../../components/CustomSelect';
import { projectApi } from '../../../services/projectApi';
import { customToast } from '../../../utils/toast';

const ProjectSettings = ({ project, canWrite, reloadProject }) => {
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showFullLogoModal, setShowFullLogoModal] = useState(false);

    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        name: '',
        projectCode: '',
        description: '',
        location: '',
        startDate: '',
        endDate: '',
        status: 'active'
    });

    const [initialState, setInitialState] = useState(null);

    // Load initial project details from real backend response
    useEffect(() => {
        if (project) {
            let meta = {};
            if (project.metadata) {
                try {
                    meta = typeof project.metadata === 'string' ? JSON.parse(project.metadata) : project.metadata;
                } catch (e) {
                    meta = {};
                }
            }

            const initial = {
                name: project.name || '',
                projectCode: project.project_code || project.id || '',
                description: meta.description || '',
                location: project.location || '',
                startDate: project.start_date ? project.start_date.split('T')[0] : '',
                endDate: project.end_date ? project.end_date.split('T')[0] : '',
                status: project.status || 'active'
            };

            setFormData(initial);
            setInitialState(initial);
            setLogoPreview(project.logo_url || '');
            setLogoFile(null);
        }
    }, [project]);

    // Detect unsaved changes
    const isDirty = useMemo(() => {
        if (!initialState) return false;
        const formChanged = Object.keys(formData).some(key => formData[key] !== initialState[key]);
        const logoChanged = logoFile !== null || (logoPreview !== (project?.logo_url || ''));
        return formChanged || logoChanged;
    }, [formData, initialState, logoFile, logoPreview, project]);

    // Handle Ctrl+S / Cmd+S save shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (canWrite && !isSubmitting) {
                    handleSave();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canWrite, isSubmitting, formData, logoFile, logoPreview]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleReset = () => {
        if (initialState) {
            setFormData(initialState);
            setLogoPreview(project?.logo_url || '');
            setLogoFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            customToast.info('Changes reverted to last saved state', 'Reset');
        }
    };

    const handleLogoSelect = (file) => {
        if (file) {
            if (!file.type.startsWith('image/')) {
                customToast.error('Please upload a valid image file (PNG, JPG, WEBP, SVG)', 'Invalid File');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                customToast.error('Logo file size must be less than 5MB', 'File Too Large');
                return;
            }
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleFileInputChange = (e) => {
        const file = e.target.files[0];
        handleLogoSelect(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (canWrite) setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (canWrite && e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleLogoSelect(e.dataTransfer.files[0]);
        }
    };

    const removeLogo = () => {
        setLogoFile(null);
        setLogoPreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Calculate project duration and timeline details
    const durationInfo = useMemo(() => {
        if (!formData.startDate || !formData.endDate) return null;
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        const now = new Date();
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (isNaN(diffDays)) return null;
        if (diffDays < 0) return { text: 'End date precedes start date', isNegative: true, days: 0, percentElapsed: 0 };
        
        const months = (diffDays / 30.44).toFixed(1);
        
        let percentElapsed = 0;
        if (now >= start && now <= end) {
            const elapsed = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
            percentElapsed = Math.min(100, Math.max(0, Math.round((elapsed / diffDays) * 100)));
        } else if (now > end) {
            percentElapsed = 100;
        }

        return {
            text: `${diffDays} Days (~${months} Months)`,
            days: diffDays,
            months,
            percentElapsed,
            isNegative: false
        };
    }, [formData.startDate, formData.endDate]);

    const handleSave = async () => {
        if (!formData.name.trim()) {
            customToast.error('Project Name is required', 'Validation Error');
            return;
        }

        setIsSubmitting(true);
        try {
            let existingMeta = {};
            if (project?.metadata) {
                try {
                    existingMeta = typeof project.metadata === 'string' ? JSON.parse(project.metadata) : project.metadata;
                } catch (e) {
                    existingMeta = {};
                }
            }

            const payload = {
                name: formData.name.trim(),
                project_code: formData.projectCode.trim() || null,
                location: formData.location.trim() || null,
                status: formData.status,
                start_date: formData.startDate || null,
                end_date: formData.endDate || null,
                metadata: {
                    ...existingMeta,
                    description: formData.description.trim()
                }
            };

            const res = await projectApi.updateProject(project.id, payload);

            if (res.success) {
                // If a new logo file was selected, upload it
                if (logoFile) {
                    try {
                        const logoRes = await projectApi.uploadProjectLogo(project.id, logoFile);
                        if (logoRes.success && (logoRes.logo_url || logoRes.logoUrl)) {
                            const newUrl = logoRes.logo_url || logoRes.logoUrl;
                            setLogoPreview(newUrl);
                            setLogoFile(null);
                        }
                    } catch (logoErr) {
                        console.error("Failed to upload logo image:", logoErr);
                        customToast.warning('Settings saved, but logo upload encountered an issue', 'Logo Error');
                    }
                } else if (!logoPreview && project.logo_url) {
                    // Logo was cleared
                    try {
                        await projectApi.updateProject(project.id, {
                            ...payload,
                            logo_url: null
                        });
                    } catch (e) {
                        console.error("Failed to clear logo", e);
                    }
                }

                setInitialState(formData);
                customToast.success('Project settings updated successfully', 'Settings Saved');
                if (reloadProject) reloadProject();
            }
        } catch (error) {
            console.error("Failed to update project settings", error);
            const msg = error.response?.data?.message || "Failed to update project settings";
            customToast.error(msg, "Save Failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full flex-1 bg-[#f8fafc] dark:bg-[#0d1117] min-h-full px-2 sm:px-3 py-2 overflow-x-hidden">
            
            {/* Minimal Top Action Controls (Right-aligned, no dividing line below) */}
            <div className="flex items-center justify-end gap-2 pb-2">
                {canWrite ? (
                    <div className="flex items-center gap-1.5">
                        {isDirty && (
                            <>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                    <AlertCircle size={10} />
                                    Unsaved Changes
                                </span>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#161b22] rounded-md transition-colors flex items-center gap-1 cursor-pointer border border-transparent hover:border-gray-300 dark:hover:border-gh-border"
                                    title="Discard unsaved changes"
                                >
                                    <RefreshCw size={11} />
                                    Discard
                                </button>
                            </>
                        )}

                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-white dark:bg-[#161b22] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gh-border shadow-2xs">
                            <kbd className="font-mono text-gray-500 dark:text-gray-300">Ctrl</kbd> + <kbd className="font-mono text-gray-500 dark:text-gray-300">S</kbd>
                        </span>

                        <button
                            onClick={handleSave}
                            disabled={isSubmitting}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-md shadow-xs hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Save Settings
                        </button>
                    </div>
                ) : (
                    <div className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-md text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <ShieldAlert size={12} />
                        Read-Only View
                    </div>
                )}
            </div>

            {/* Matched Height 3-Column Settings Grid with Modern Rounded Corners */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full items-stretch">
                
                {/* ================= COLUMN 1: General Project Information ================= */}
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg p-3.5 shadow-2xs flex flex-col justify-between h-full space-y-3">
                    <div>
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-2 mb-2.5">
                            <div className="flex items-center gap-1.5">
                                <FileText size={14} className="text-blue-500" />
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white">General Information</h2>
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">#{project?.id || '—'}</span>
                        </div>

                        <div className="space-y-2.5">
                            <CustomInput
                                label="Project Name *"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="e.g. Skyline Tower"
                                disabled={!canWrite}
                                className="!rounded-md !py-1.5 !px-2.5 !text-xs"
                                required
                            />

                            <div className="grid grid-cols-2 gap-2">
                                <CustomInput
                                    label="Project Code"
                                    value={formData.projectCode}
                                    onChange={(e) => handleInputChange('projectCode', e.target.value)}
                                    placeholder="e.g. SKY-01"
                                    disabled={!canWrite}
                                    className="!rounded-md !py-1.5 !px-2.5 !text-xs"
                                />
                                <CustomInput
                                    label="Project Location"
                                    value={formData.location}
                                    onChange={(e) => handleInputChange('location', e.target.value)}
                                    placeholder="e.g. Downtown Site"
                                    disabled={!canWrite}
                                    className="!rounded-md !py-1.5 !px-2.5 !text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col pt-1">
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Project Description
                            </label>
                            <span className="text-[10px] text-gray-400">{formData.description.length} chars</span>
                        </div>
                        <CustomInput
                            rows={4}
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            placeholder="Describe project scope, specifications, or key deliverables..."
                            disabled={!canWrite}
                            className="!rounded-md !py-2 !px-2.5 !text-xs flex-1 min-h-[90px]"
                        />
                    </div>
                </div>

                {/* ================= COLUMN 2: Organisation Logo & Branding ================= */}
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg p-3.5 shadow-2xs flex flex-col justify-between h-full space-y-3">
                    <div>
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-2 mb-2.5">
                            <div className="flex items-center gap-1.5">
                                <ImageIcon size={14} className="text-purple-500" />
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white">Organisation Logo</h2>
                            </div>
                            {logoPreview && (
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                                    Active Logo
                                </span>
                            )}
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={handleFileInputChange}
                            className="hidden"
                            disabled={!canWrite}
                        />

                        {logoPreview ? (
                            <div className="relative group w-full h-36 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-md flex items-center justify-center p-3 transition-all overflow-hidden">
                                <img
                                    src={logoPreview}
                                    alt="Project Logo Preview"
                                    className="max-h-full max-w-full object-contain rounded drop-shadow-2xs"
                                    onError={() => console.error("Logo image preview load error")}
                                />

                                <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowFullLogoModal(true)}
                                        className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors cursor-pointer"
                                        title="View Full Logo"
                                    >
                                        <Eye size={14} />
                                    </button>
                                    {canWrite && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer"
                                                title="Replace Logo"
                                            >
                                                <Upload size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={removeLogo}
                                                className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors cursor-pointer"
                                                title="Remove Logo"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => canWrite && fileInputRef.current?.click()}
                                className={`w-full h-36 border-2 border-dashed rounded-md flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer group ${
                                    isDragging
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-gray-300 dark:border-gh-border hover:border-blue-500 dark:hover:border-blue-400 bg-gray-50/60 dark:bg-[#0d1117]'
                                } ${!canWrite ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <div className="p-2 bg-white dark:bg-[#161b22] rounded-md shadow-2xs text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all border border-gray-200 dark:border-gh-border">
                                    <Upload size={16} />
                                </div>
                                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-2">
                                    {canWrite ? (isDragging ? 'Drop logo file here' : 'Click or Drag & Drop Logo') : 'No Logo Uploaded'}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                    PNG, JPG, WEBP or SVG (Max 5MB)
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-md flex items-start gap-2">
                            <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                                This logo will automatically feature on all DPR (Daily Progress Reports), PDF exports, and project headers.
                            </p>
                        </div>

                        {project?.employer ? (
                            <div className="p-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-md text-[11px] text-gray-600 dark:text-gray-300 flex items-center justify-between">
                                <span className="font-semibold text-gray-500">Client / Employer:</span>
                                <span className="font-bold text-gray-900 dark:text-white truncate max-w-[160px]">{project.employer}</span>
                            </div>
                        ) : (
                            <div className="p-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-md text-[11px] text-gray-400 flex items-center justify-between">
                                <span className="font-semibold text-gray-500">Client / Employer:</span>
                                <span className="italic">Direct / In-House Project</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ================= COLUMN 3: Timeline, Duration & Status ================= */}
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg p-3.5 shadow-2xs flex flex-col justify-between h-full space-y-3">
                    <div>
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-2 mb-2.5">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-emerald-500" />
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white">Timeline & Lifecycle</h2>
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                                <CustomDatePicker
                                    label="Start Date"
                                    value={formData.startDate}
                                    onChange={(val) => handleInputChange('startDate', val.target.value)}
                                    disabled={!canWrite}
                                    className="!rounded-md"
                                />
                                <CustomDatePicker
                                    label="Target End Date"
                                    value={formData.endDate}
                                    onChange={(val) => handleInputChange('endDate', val.target.value)}
                                    disabled={!canWrite}
                                    className="!rounded-md"
                                />
                            </div>

                            {durationInfo && (
                                <div className={`p-2.5 rounded-md border space-y-1.5 ${
                                    durationInfo.isNegative
                                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400'
                                        : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                                }`}>
                                    <div className="flex items-center justify-between text-xs font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={13} className="shrink-0" />
                                            <span className="font-bold">Project Duration:</span>
                                            <span>{durationInfo.text}</span>
                                        </div>
                                        {!durationInfo.isNegative && (
                                            <span className="text-[10px] font-bold">{durationInfo.percentElapsed}% Elapsed</span>
                                        )}
                                    </div>

                                    {!durationInfo.isNegative && (
                                        <div className="w-full bg-emerald-200/50 dark:bg-emerald-900/40 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-emerald-600 dark:bg-emerald-400 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${durationInfo.percentElapsed}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <CustomSelect
                                    label="Project Status"
                                    value={formData.status}
                                    onChange={(e) => handleInputChange('status', e.target.value)}
                                    options={[
                                        { label: 'Active - Ongoing Work', value: 'active' },
                                        { label: 'Completed - Handed Over', value: 'completed' },
                                        { label: 'On Hold - Temporarily Paused', value: 'on-hold' },
                                        { label: 'Archived - Closed Record', value: 'archived' }
                                    ]}
                                    disabled={!canWrite}
                                    buttonClassName="w-full flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-900 dark:text-white shadow-2xs hover:border-blue-500/40 text-left"
                                />
                            </div>
                        </div>
                    </div>

                    {/* System Metadata Record */}
                    <div className="p-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-md space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-400">
                            <span>System Record ID:</span>
                            <span className="font-mono font-bold text-gray-900 dark:text-white">#{project?.id || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-400">
                            <span>Created Date:</span>
                            <span>{project?.created_at ? new Date(project.created_at).toLocaleDateString() : 'Initial Setup'}</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Full Image Preview Modal */}
            {showFullLogoModal && logoPreview && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-2xs flex items-center justify-center p-4" onClick={() => setShowFullLogoModal(false)}>
                    <div className="relative bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl max-w-lg w-full p-4 shadow-2xl animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 dark:border-gh-border mb-3">
                            <div className="flex items-center gap-1.5">
                                <ImageIcon size={15} className="text-blue-500" />
                                <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                                    Organisation Logo Preview
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowFullLogoModal(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-[#21262d] transition-colors cursor-pointer"
                            >
                                <X size={15} />
                            </button>
                        </div>
                        <div className="bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg p-4 flex items-center justify-center min-h-[180px] max-h-[340px]">
                            <img src={logoPreview} alt="Full Logo" className="max-h-[300px] max-w-full object-contain rounded drop-shadow-xs" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectSettings;
