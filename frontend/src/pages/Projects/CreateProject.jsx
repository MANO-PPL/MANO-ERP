import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Building2, Calendar, MapPin, Clock, Upload, Trash2,
    Eye, Image as ImageIcon, Info, Tag, FileText,
    ArrowLeft, Plus, Loader2, Sparkles, Check
} from 'lucide-react';
import CustomInput from '../../components/CustomInput';
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomSelect from '../../components/CustomSelect';
import { projectApi } from '../../services/projectApi';
import { customToast } from '../../utils/toast';
import { useAuth } from '../../context/AuthContext';

const CreateProject = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

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

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
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
        setIsDragging(true);
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
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleLogoSelect(e.dataTransfer.files[0]);
        }
    };

    const removeLogo = () => {
        setLogoFile(null);
        setLogoPreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Auto-generate project code from project name
    const handleGenerateCode = () => {
        if (!formData.name.trim()) {
            customToast.info('Enter a project name first to generate a code', 'Notice');
            return;
        }
        const initials = formData.name
            .trim()
            .split(/\s+/)
            .map((w) => w[0]?.toUpperCase())
            .join('')
            .slice(0, 4);
        const year = new Date().getFullYear().toString().slice(-2);
        const randomNum = Math.floor(10 + Math.random() * 90);
        const generated = `${initials || 'PRJ'}-${year}${randomNum}`;
        handleInputChange('projectCode', generated);
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

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        if (!formData.name.trim()) {
            customToast.error('Project Name is required', 'Validation Error');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name.trim(),
                project_code: formData.projectCode.trim() || undefined,
                location: formData.location.trim() || undefined,
                status: formData.status,
                start_date: formData.startDate || undefined,
                end_date: formData.endDate || undefined,
                metadata: {
                    description: formData.description.trim(),
                    employer: user?.organization_name || user?.user_name || 'System'
                }
            };

            const res = await projectApi.createProject(payload);

            if (res.success && res.project) {
                const createdId = res.project.id || res.project.project_id;

                // If logo was attached, upload it
                if (logoFile && createdId) {
                    try {
                        await projectApi.uploadLogo(createdId, logoFile);
                    } catch (logoErr) {
                        console.error('Failed to upload logo image:', logoErr);
                    }
                }

                // Invalidate session cache
                sessionStorage.removeItem('crm_projects_list');
                sessionStorage.removeItem('crm_projects_list_time');

                customToast.success(`Project "${formData.name.trim()}" created successfully`, 'Project Created');
                navigate(createdId ? `/projects/${createdId}` : '/projects');
            } else {
                throw new Error(res.message || 'Failed to create project');
            }
        } catch (error) {
            console.error('Failed to create project:', error);
            const msg = error.response?.data?.message || error.message || 'Failed to create project';
            customToast.error(msg, 'Creation Failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full flex-1 overflow-y-auto bg-[#f9fafb] dark:bg-[#0d1117] min-h-full">
            {/* Top Navigation & Header Bar */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-[#0d1117]/90 backdrop-blur-md border-b border-gray-200 dark:border-gh-border px-4 sm:px-6 py-3.5 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-5xl mx-auto">
                    {/* Breadcrumbs & Title */}
                    <div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <Link
                                to="/projects"
                                className="hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                            >
                                Projects
                            </Link>
                            <span>/</span>
                            <span className="text-gray-900 dark:text-white font-semibold">Create New Project</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/projects')}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-gh-border text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                title="Back to Projects"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                                Create New Project
                            </h1>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/projects')}
                            className="px-4 py-2 border border-gray-200 dark:border-gh-border rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            Create Project
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Form Content - Full Page Width */}
            <div className="p-4 sm:p-6 w-full space-y-6">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
                    
                    {/* Left Column: Logo, Status, Timeline (5 cols) */}
                    <div className="space-y-5 lg:col-span-5 w-full">
                        
                        {/* Organisation / Project Logo */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-5 shadow-xs space-y-3.5">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-3">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <ImageIcon size={15} className="text-blue-500" />
                                    Organisation Logo
                                </h2>
                                {logoPreview && (
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                        Selected
                                    </span>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleFileInputChange}
                                className="hidden"
                            />

                            {logoPreview ? (
                                <div className="relative group w-full h-44 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-xl flex items-center justify-center p-4 transition-all">
                                    <img
                                        src={logoPreview}
                                        alt="Project Logo Preview"
                                        className="max-h-full max-w-full object-contain rounded-lg drop-shadow-sm"
                                    />

                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowFullLogoModal(true)}
                                            className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors cursor-pointer"
                                            title="View Full Logo"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={removeLogo}
                                            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
                                            title="Remove Logo"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`w-full h-44 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center transition-all cursor-pointer group ${
                                        isDragging
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-300 dark:border-gh-border hover:border-blue-500 dark:hover:border-blue-400 bg-gray-50/50 dark:bg-[#0d1117]'
                                    }`}
                                >
                                    <div className="p-3 bg-white dark:bg-[#161b22] rounded-xl shadow-xs text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all border border-gray-200 dark:border-gh-border">
                                        <Upload size={22} />
                                    </div>
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-3">
                                        {isDragging ? 'Drop logo image here' : 'Click or Drag & Drop Logo'}
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-1">
                                        PNG, JPG, WEBP or SVG (Max 5MB)
                                    </p>
                                </div>
                            )}

                            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg flex items-start gap-2.5">
                                <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                    This logo will automatically feature on all DPR (Daily Progress Reports), PDF exports, and project headers.
                                </p>
                            </div>
                        </div>

                        {/* Project Status */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-5 shadow-xs space-y-3.5">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-3">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Tag size={15} className="text-amber-500" />
                                    Initial Status
                                </h2>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Status
                                </label>
                                <CustomSelect
                                    value={formData.status}
                                    onChange={(e) => handleInputChange('status', e.target.value)}
                                    options={[
                                        { label: 'Active - Ongoing Work', value: 'active' },
                                        { label: 'Planning - Pre-construction', value: 'planning' },
                                        { label: 'On Hold - Pending Approval', value: 'on-hold' }
                                    ]}
                                />
                            </div>
                        </div>

                        {/* Timeline & Duration */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-5 shadow-xs space-y-3.5">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-3">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <Calendar size={15} className="text-blue-500" />
                                    Timeline & Schedule
                                </h2>
                            </div>

                            <div className="space-y-3.5">
                                <CustomDatePicker
                                    label="Start Date"
                                    value={formData.startDate}
                                    onChange={(val) => handleInputChange('startDate', val.target.value)}
                                />
                                <CustomDatePicker
                                    label="Target End Date"
                                    value={formData.endDate}
                                    onChange={(val) => handleInputChange('endDate', val.target.value)}
                                />

                                {durationInfo && (
                                    <div className={`p-3 rounded-lg border flex items-center gap-2.5 text-xs font-medium ${
                                        durationInfo.isNegative
                                            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400'
                                            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                    }`}>
                                        <Clock size={15} className="shrink-0" />
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
                    <div className="space-y-5 lg:col-span-7 w-full">
                        
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-6 shadow-xs space-y-5">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-3">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <FileText size={15} className="text-blue-500" />
                                    General Project Information
                                </h2>
                                <span className="text-xs text-gray-400 font-normal">Core Identification</span>
                            </div>

                            <div className="space-y-4">
                                <CustomInput
                                    label="Project Name *"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    placeholder="e.g. Skyline Residency Phase I"
                                    required
                                />

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            Project Code
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleGenerateCode}
                                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                                        >
                                            <Sparkles size={12} /> Auto Generate
                                        </button>
                                    </div>
                                    <CustomInput
                                        value={formData.projectCode}
                                        onChange={(e) => handleInputChange('projectCode', e.target.value)}
                                        placeholder="e.g. SKY-01 or PRJ-2601"
                                    />
                                </div>

                                <CustomInput
                                    label="Project Description"
                                    rows={4}
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    placeholder="Describe project scope, specifications, or key deliverables..."
                                />

                                <CustomInput
                                    label="Project Location"
                                    value={formData.location}
                                    onChange={(e) => handleInputChange('location', e.target.value)}
                                    placeholder="City / Site address (e.g. Downtown Site, Chennai)"
                                />
                            </div>
                        </div>

                        {/* Submit Actions Box */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-5 shadow-xs flex items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Ready to initialize project workspaces and sheets?
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/projects')}
                                    className="px-4 py-2 border border-gray-200 dark:border-gh-border rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Create Project
                                </button>
                            </div>
                        </div>

                    </div>
                </form>
            </div>

            {/* Full Image Preview Modal */}
            {showFullLogoModal && logoPreview && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setShowFullLogoModal(false)}>
                    <div className="relative bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl max-w-xl w-full p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gh-border mb-3">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ImageIcon size={15} className="text-blue-500" />
                                Organisation Logo Preview
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowFullLogoModal(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg cursor-pointer"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <div className="bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-xl p-6 flex items-center justify-center max-h-[380px]">
                            <img src={logoPreview} alt="Full Logo" className="max-h-[320px] max-w-full object-contain" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateProject;
