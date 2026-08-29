import React, { useState, useEffect, useRef } from 'react';
import {
    Upload, Trash2, X, Loader2, Save,
    Calendar, Clock, Image as ImageIcon, Info, Tag, Eye, FileText
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

    // Load initial project details
    useEffect(() => {
        if (project) {
            setFormData({
                name: project.name || '',
                projectCode: project.project_code || project.id || '',
                description: project.metadata?.description || '',
                location: project.location || '',
                startDate: project.start_date ? project.start_date.split('T')[0] : '',
                endDate: project.end_date ? project.end_date.split('T')[0] : '',
                status: project.status || 'active'
            });
            setLogoPreview(project.logo_url || '');
            setLogoFile(null);
        }
    }, [project]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLogoSelect = (file) => {
        if (file) {
            if (!file.type.startsWith('image/')) {
                customToast.error('Please upload a valid image file (PNG, JPG, WEBP, SVG)', 'Invalid File');
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

    // Calculate project duration
    const getProjectDuration = () => {
        if (!formData.startDate || !formData.endDate) return null;
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (isNaN(diffDays)) return null;
        if (diffDays < 0) return { text: 'End date precedes start date', isNegative: true };
        const months = (diffDays / 30.44).toFixed(1);
        return { text: `${diffDays} Days (~${months} Months)`, isNegative: false };
    };

    const durationInfo = getProjectDuration();

    const handleSave = async () => {
        if (!formData.name.trim()) {
            customToast.error('Project Name is required', 'Validation Error');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name.trim(),
                project_code: formData.projectCode.trim() || null,
                location: formData.location.trim() || null,
                status: formData.status,
                start_date: formData.startDate || null,
                end_date: formData.endDate || null,
                metadata: {
                    ...(project?.metadata || {}),
                    description: formData.description.trim()
                }
            };

            const res = await projectApi.updateProject(project.id, payload);

            if (res.success) {
                // If a new logo file was selected, upload it
                if (logoFile) {
                    try {
                        const logoRes = await projectApi.uploadLogo(project.id, logoFile);
                        if (logoRes.success && logoRes.logoUrl) {
                            setLogoPreview(logoRes.logoUrl);
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
        <div className="w-full flex-1 overflow-y-auto bg-[#f9fafb] dark:bg-[#0d1117] min-h-full">
            {/* Minimal Action Bar - Buttons Only with Tight Spacing */}
            {canWrite && (
                <div className="sticky top-0 z-20 bg-white/90 dark:bg-[#0d1117]/90 backdrop-blur-md border-b border-gray-200 dark:border-gh-border px-3 sm:px-4 py-1.5 transition-colors">
                    <div className="flex items-center justify-end gap-2.5 w-full">
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-[#161b22] px-2 py-0.5 rounded border border-gray-200 dark:border-gh-border">
                            <kbd className="font-mono text-gray-500 dark:text-gray-300">Ctrl</kbd> + <kbd className="font-mono text-gray-500 dark:text-gray-300">S</kbd>
                        </span>
                        <button
                            onClick={handleSave}
                            disabled={isSubmitting}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-xs hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            Save Settings
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Layout Grid - Tight Spacing & Full Width */}
            <div className="p-2.5 sm:p-3.5 w-full space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start w-full">
                    
                    {/* Left Column: Logo, Status, Timeline (5 cols) */}
                    <div className="space-y-3 lg:col-span-5 w-full">
                        
                        {/* Organisation Logo */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-2">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                                    <ImageIcon size={14} className="text-blue-500" />
                                    Organisation Logo
                                </h2>
                                {logoPreview && (
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                        Active Logo
                                    </span>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleFileInputChange}
                                className="hidden"
                                disabled={!canWrite}
                            />

                            {logoPreview ? (
                                <div className="relative group w-full h-36 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg flex items-center justify-center p-3 transition-all">
                                    <img
                                        src={logoPreview}
                                        alt="Project Logo Preview"
                                        className="max-h-full max-w-full object-contain rounded drop-shadow-sm"
                                        onError={() => console.error("Logo image preview load error")}
                                    />

                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowFullLogoModal(true)}
                                            className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded transition-colors cursor-pointer"
                                            title="View Full Logo"
                                        >
                                            <Eye size={15} />
                                        </button>
                                        {canWrite && (
                                            <button
                                                type="button"
                                                onClick={removeLogo}
                                                className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors cursor-pointer"
                                                title="Remove Logo"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => canWrite && fileInputRef.current?.click()}
                                    className={`w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer group ${
                                        isDragging
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-300 dark:border-gh-border hover:border-blue-500 dark:hover:border-blue-400 bg-gray-50/50 dark:bg-[#0d1117]'
                                    } ${!canWrite ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <div className="p-2 bg-white dark:bg-[#161b22] rounded-lg shadow-xs text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all border border-gray-200 dark:border-gh-border">
                                        <Upload size={18} />
                                    </div>
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-2">
                                        {canWrite ? (isDragging ? 'Drop logo image here' : 'Click or Drag & Drop Logo') : 'No Logo Uploaded'}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        PNG, JPG, WEBP or SVG (Max 5MB)
                                    </p>
                                </div>
                            )}

                            <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-md flex items-start gap-2">
                                <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                                    This logo will automatically feature on all DPR (Daily Progress Reports), PDF exports, and project headers.
                                </p>
                            </div>
                        </div>

                        {/* Project Status & Lifecycle */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-2">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                                    <Tag size={14} className="text-amber-500" />
                                    Project Status & Lifecycle
                                </h2>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    Current Status
                                </label>
                                <CustomSelect
                                    value={formData.status}
                                    onChange={(e) => handleInputChange('status', e.target.value)}
                                    options={[
                                        { label: 'Active - Ongoing Work', value: 'active' },
                                        { label: 'Completed - Handed Over', value: 'completed' },
                                        { label: 'On Hold - Temporarily Paused', value: 'on-hold' },
                                        { label: 'Archived - Closed Record', value: 'archived' }
                                    ]}
                                    disabled={!canWrite}
                                />
                            </div>
                        </div>

                        {/* Timeline & Duration */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg p-3.5 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-2">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                                    <Calendar size={14} className="text-blue-500" />
                                    Timeline & Duration
                                </h2>
                            </div>

                            <div className="space-y-2.5">
                                <CustomDatePicker
                                    label="Start Date"
                                    value={formData.startDate}
                                    onChange={(val) => handleInputChange('startDate', val.target.value)}
                                    disabled={!canWrite}
                                />
                                <CustomDatePicker
                                    label="Target End Date"
                                    value={formData.endDate}
                                    onChange={(val) => handleInputChange('endDate', val.target.value)}
                                    disabled={!canWrite}
                                />

                                {durationInfo && (
                                    <div className={`p-2.5 rounded-md border flex items-center gap-2 text-xs font-medium ${
                                        durationInfo.isNegative
                                            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400'
                                            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                    }`}>
                                        <Clock size={14} className="shrink-0" />
                                        <div>
                                            <span className="font-semibold">Project Duration: </span>
                                            <span>{durationInfo.text}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Right Column: General Information (7 cols) */}
                    <div className="space-y-3 lg:col-span-7 w-full">

                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg p-4 sm:p-4.5 shadow-xs space-y-3.5">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-2">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                                    <FileText size={14} className="text-blue-500" />
                                    General Project Information
                                </h2>
                                <span className="text-[11px] text-gray-400 font-normal">Core Identification</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <CustomInput
                                    label="Project Name *"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    placeholder="e.g. Skyline Residency Phase I"
                                    disabled={!canWrite}
                                />
                                <CustomInput
                                    label="Project Code"
                                    value={formData.projectCode}
                                    onChange={(e) => handleInputChange('projectCode', e.target.value)}
                                    placeholder="e.g. PRJ-2026-001"
                                    disabled={!canWrite}
                                />
                            </div>

                            <CustomInput
                                label="Project Description"
                                rows={3}
                                value={formData.description}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                placeholder="Describe project scope, specifications, or key deliverables..."
                                disabled={!canWrite}
                            />

                            <div>
                                <CustomInput
                                    label="Project Location"
                                    value={formData.location}
                                    onChange={(e) => handleInputChange('location', e.target.value)}
                                    placeholder="City / Site address"
                                    disabled={!canWrite}
                                />
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Full Image Preview Modal */}
            {showFullLogoModal && logoPreview && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setShowFullLogoModal(false)}>
                    <div className="relative bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg max-w-xl w-full p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 dark:border-gh-border mb-3">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ImageIcon size={14} className="text-blue-500" />
                                Organisation Logo Preview
                            </h3>
                            <button
                                onClick={() => setShowFullLogoModal(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded cursor-pointer"
                            >
                                <X size={15} />
                            </button>
                        </div>
                        <div className="bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg p-4 flex items-center justify-center max-h-[380px]">
                            <img src={logoPreview} alt="Full Logo" className="max-h-[320px] max-w-full object-contain" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectSettings;
