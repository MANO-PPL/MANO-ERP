import React, { useState, useEffect, useRef } from 'react';
import {
    Upload, Trash2, Users, X, Loader2, Save, Building2,
    Calendar, CheckCircle2, MapPin, User, Clock, Search,
    Image as ImageIcon, Info, Check, ShieldAlert, Sparkles, Copy, Eye
} from 'lucide-react';
import CustomInput from '../../../components/CustomInput';
import CustomDatePicker from '../../../components/CustomDatePicker';
import CustomSelect from '../../../components/CustomSelect';
import { adminApi } from '../../../services/adminApi';
import { projectApi } from '../../../services/projectApi';
import { clientApi } from '../../../services/clientApi';
import { customToast } from '../../../utils/toast';

const COLORS = [
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-pink-600',
    'from-amber-500 to-red-600',
    'from-teal-500 to-emerald-600',
    'from-slate-500 to-gray-700',
    'from-pink-500 to-rose-600'
];

const ProjectSettings = ({ project, canWrite, reloadProject }) => {
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showFullLogoModal, setShowFullLogoModal] = useState(false);

    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [employeeOptions, setEmployeeOptions] = useState([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [clientOptions, setClientOptions] = useState(['Select Client']);

    const fileInputRef = useRef(null);
    const employeeDropdownRef = useRef(null);

    const [formData, setFormData] = useState({
        name: '',
        projectCode: '',
        description: '',
        location: '',
        employer: '',
        client: 'Select Client',
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
    }, [canWrite, isSubmitting, formData, logoFile, logoPreview, selectedEmployees]);

    // Close employee dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load initial project details and clients
    useEffect(() => {
        if (project) {
            setFormData({
                name: project.name || '',
                projectCode: project.project_code || project.id || '',
                description: project.metadata?.description || '',
                location: project.location || '',
                employer: project.metadata?.employer || '',
                client: project.metadata?.client || 'Select Client',
                startDate: project.start_date ? project.start_date.split('T')[0] : '',
                endDate: project.end_date ? project.end_date.split('T')[0] : '',
                status: project.status || 'active'
            });
            setLogoPreview(project.logo_url || '');
            setLogoFile(null);
            fetchEmployees();
            fetchClients();
        }
    }, [project]);

    const fetchClients = async () => {
        try {
            const res = await clientApi.getClients({ limit: 100 });
            const list = Array.isArray(res) ? res : (res?.clients || res?.data || []);
            if (list.length > 0) {
                const names = list.map(c => c.name || c.company_name || c.client_name).filter(Boolean);
                const uniqueClients = ['Select Client', ...Array.from(new Set(names))];
                setClientOptions(uniqueClients);
            } else {
                setClientOptions(['Select Client', 'Client A', 'Client B']);
            }
        } catch (error) {
            console.error('Failed to fetch clients:', error);
            setClientOptions(['Select Client', 'Client A', 'Client B']);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await adminApi.getUsers();
            if (res.success) {
                const mappedUsers = res.users.map((u, idx) => ({
                    id: u.user_id,
                    name: u.user_name,
                    role: u.user_type || 'Team Member',
                    initials: u.user_name ? u.user_name.substring(0, 2).toUpperCase() : 'U',
                    color: COLORS[idx % COLORS.length]
                }));
                setEmployeeOptions(mappedUsers);

                if (project?.id) {
                    const membersRes = await projectApi.getProjectMembers(project.id);
                    if (membersRes.success) {
                        const assignedIds = membersRes.members.map(m => m.user_id);
                        const assignedEmployees = mappedUsers.filter(u => assignedIds.includes(u.id));
                        setSelectedEmployees(assignedEmployees);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch employees', error);
        }
    };

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
        if (!canWrite) return;
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleLogoSelect(files[0]);
        }
    };

    const removeLogo = () => {
        setLogoFile(null);
        setLogoPreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const toggleEmployee = (emp) => {
        setSelectedEmployees(prev =>
            prev.find(e => e.id === emp.id)
                ? prev.filter(e => e.id !== emp.id)
                : [...prev, emp]
        );
    };

    const removeEmployee = (id) => setSelectedEmployees(prev => prev.filter(e => e.id !== id));

    const selectAllEmployees = () => setSelectedEmployees(employeeOptions);
    const clearAllEmployees = () => setSelectedEmployees([]);

    const calculateDuration = (start, end) => {
        if (!start || !end) return null;
        const s = new Date(start);
        const e = new Date(end);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
        const diffTime = e - s;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { days: 0, text: 'End date precedes start date', isNegative: true };
        const months = (diffDays / 30.4375).toFixed(1);
        return { days: diffDays, months, text: `${diffDays} Days (~${months} Months)`, isNegative: false };
    };

    const durationInfo = calculateDuration(formData.startDate, formData.endDate);

    const getStatusConfig = (status) => {
        switch (status) {
            case 'active':
                return { label: 'Active', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' };
            case 'completed':
                return { label: 'Completed', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30', dot: 'bg-blue-500' };
            case 'on-hold':
                return { label: 'On Hold', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', dot: 'bg-amber-500' };
            case 'archived':
                return { label: 'Archived', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30', dot: 'bg-slate-500' };
            default:
                return { label: status, bg: 'bg-blue-500/10 text-blue-600 border-blue-500/30', dot: 'bg-blue-500' };
        }
    };

    const statusConfig = getStatusConfig(formData.status);

    const filteredEmployeeOptions = employeeOptions.filter(emp =>
        emp.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        emp.role.toLowerCase().includes(memberSearchQuery.toLowerCase())
    );

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!formData.name) return customToast.error("Project Name is required", "Validation Error");
        if (!project?.id) return;

        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                project_code: formData.projectCode,
                location: formData.location,
                status: formData.status,
                start_date: formData.startDate || null,
                end_date: formData.endDate || null,
                logo_url: logoFile ? undefined : (logoPreview || null),
                metadata: {
                    ...(project.metadata || {}),
                    description: formData.description,
                    employer: formData.employer,
                    client: formData.client === 'Select Client' ? '' : formData.client
                }
            };

            const res = await projectApi.updateProject(project.id, payload);

            if (res.success) {
                // Upload logo if newly attached
                if (logoFile) {
                    try {
                        await projectApi.uploadProjectLogo(project.id, logoFile);
                    } catch (logoErr) {
                        console.error("Failed to upload logo:", logoErr);
                        customToast.error("Project saved, but logo upload failed", "Logo Upload Error");
                    }
                }

                // Update project member assignments
                let currentMemberIds = [];
                const membersRes = await projectApi.getProjectMembers(project.id);
                if (membersRes.success) {
                    currentMemberIds = membersRes.members.map(m => m.user_id);
                }

                const toAdd = selectedEmployees.filter(e => !currentMemberIds.includes(e.id));
                const selectedIds = selectedEmployees.map(e => e.id);
                const toRemove = currentMemberIds.filter(id => !selectedIds.includes(id));

                for (const emp of toAdd) {
                    await projectApi.assignProjectMember(project.id, {
                        user_id: emp.id,
                        permissions: { role: emp.role }
                    });
                }

                for (const userId of toRemove) {
                    await projectApi.removeProjectMember(project.id, userId);
                }

                customToast.success('Project settings updated successfully', 'Settings Saved');
                if (reloadProject) reloadProject();
            }
        } catch (error) {
            console.error("Failed to update project settings", error);
            customToast.error("Failed to update project settings", "Save Failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full flex-1 overflow-y-auto bg-[#f9fafb] dark:bg-[#0d1117] min-h-full">
            {/* Top Bar Header */}
            <div className="sticky top-0 z-20 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-md border-b border-gray-200 dark:border-gh-border px-3 sm:px-4 py-3 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-500/20">
                            <Building2 size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                                    Project Settings
                                </h1>
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${statusConfig.bg}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} animate-pulse`} />
                                    {statusConfig.label}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                Configure project metadata, organisation logo, timeline schedule, and team access.
                            </p>
                        </div>
                    </div>

                    {canWrite && (
                        <div className="flex items-center gap-2.5">
                            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-[#161b22] px-2 py-1 rounded border border-gray-200 dark:border-gh-border">
                                <kbd className="font-mono text-gray-500 dark:text-gray-300">Ctrl</kbd> + <kbd className="font-mono text-gray-500 dark:text-gray-300">S</kbd> to save
                            </span>
                            <button
                                onClick={handleSave}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                Save Settings
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Layout Grid - Tight Sidebar Distance & Rectangular Styling */}
            <div className="p-3 sm:p-4 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                    
                    {/* Left Column: Logo & Status & Timeline (1 column) */}
                    <div className="space-y-4 lg:col-span-1">
                        
                        {/* Card 1: Logo Management */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-md p-4 shadow-xs transition-all space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <ImageIcon size={15} className="text-blue-500" />
                                    Organisation Logo
                                </h2>
                                {logoPreview && (
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                        Uploaded
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
                                <div className="relative group w-full h-40 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-md flex items-center justify-center p-3 transition-all">
                                    <img
                                        src={logoPreview}
                                        alt="Project Logo Preview"
                                        className="max-h-full max-w-full object-contain rounded drop-shadow-sm"
                                        onError={() => console.error("Logo image preview load error")}
                                    />

                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
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
                                    className={`w-full h-40 border-2 border-dashed rounded-md flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer group ${
                                        isDragging
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-300 dark:border-gh-border hover:border-blue-500 dark:hover:border-blue-400 bg-gray-50/50 dark:bg-[#0d1117]'
                                    } ${!canWrite ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <div className="p-2.5 bg-white dark:bg-[#161b22] rounded-md shadow-xs text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all border border-gray-200 dark:border-gh-border">
                                        <Upload size={20} />
                                    </div>
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-2.5">
                                        {canWrite ? (isDragging ? 'Drop logo image here' : 'Click or Drag & Drop Logo') : 'No Logo Uploaded'}
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        PNG, JPG, WEBP or SVG (Max 5MB)
                                    </p>
                                </div>
                            )}

                            <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-md flex items-start gap-2">
                                <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                                    This logo will automatically feature on all DPR (Daily Progress Reports), PDF exports, and project headers.
                                </p>
                            </div>
                        </div>

                        {/* Card 2: Status Config */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-md p-4 shadow-xs space-y-3">
                            <h2 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <Sparkles size={15} className="text-amber-500" />
                                Project Status & Lifecycle
                            </h2>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    Current Status
                                </label>
                                <CustomSelect
                                    value={formData.status}
                                    onChange={(e) => handleInputChange('status', e.target.value)}
                                    options={[
                                        { label: '🟢 Active - Ongoing Work', value: 'active' },
                                        { label: '🔵 Completed - Handed Over', value: 'completed' },
                                        { label: '🟡 On Hold - Temporarily Paused', value: 'on-hold' },
                                        { label: '⚪ Archived - Closed Record', value: 'archived' }
                                    ]}
                                    disabled={!canWrite}
                                />
                            </div>
                        </div>

                        {/* Card 3: Timeline & Duration */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-md p-4 shadow-xs space-y-3">
                            <h2 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <Calendar size={15} className="text-blue-500" />
                                Timeline & Duration
                            </h2>

                            <div className="space-y-3">
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
                                    <div className={`p-2.5 rounded-md border flex items-center gap-2 text-xs ${
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

                    {/* Right Column: General Information & Team Assignments (2 columns) */}
                    <div className="space-y-4 lg:col-span-2">

                        {/* Card 4: General Details */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-md p-4 sm:p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gh-border/60 pb-2.5">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Building2 size={15} className="text-blue-500" />
                                    General Project Information
                                </h2>
                                <span className="text-[11px] text-gray-400 font-normal">Core Identification</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <CustomInput
                                    label="Project Location"
                                    value={formData.location}
                                    onChange={(e) => handleInputChange('location', e.target.value)}
                                    placeholder="City / Site address"
                                    disabled={!canWrite}
                                />
                                <CustomInput
                                    label="Employer / Developer"
                                    value={formData.employer}
                                    onChange={(e) => handleInputChange('employer', e.target.value)}
                                    placeholder="e.g. Horizon Commercial Developers"
                                    disabled={!canWrite}
                                />
                            </div>

                            <div>
                                <CustomSelect
                                    label="Primary Client"
                                    value={formData.client}
                                    onChange={(e) => handleInputChange('client', e.target.value)}
                                    options={clientOptions}
                                    disabled={!canWrite}
                                />
                            </div>
                        </div>

                        {/* Card 5: Team Members Assignment */}
                        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-md p-4 sm:p-5 shadow-xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gh-border/60 pb-2.5">
                                <h2 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Users size={15} className="text-blue-500" />
                                    Assigned Team Members ({selectedEmployees.length})
                                </h2>
                                {canWrite && employeeOptions.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllEmployees}
                                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-gray-300 dark:text-gray-600">•</span>
                                        <button
                                            type="button"
                                            onClick={clearAllEmployees}
                                            className="text-[11px] font-semibold text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                )}
                            </div>

                            {canWrite && (
                                <div className="relative" ref={employeeDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setDropdownOpen(o => !o)}
                                        className="w-full flex items-center justify-between px-3.5 py-2 bg-gray-50/70 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border hover:border-blue-500/50 rounded-md text-xs text-gray-700 dark:text-gray-200 transition-all cursor-pointer text-left"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <Users size={15} className="text-gray-400 shrink-0" />
                                            <span className="font-medium truncate">
                                                {selectedEmployees.length > 0
                                                    ? `${selectedEmployees.length} member${selectedEmployees.length > 1 ? 's' : ''} assigned to this project`
                                                    : 'Search and assign team members…'}
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">
                                            + Manage
                                        </span>
                                    </button>

                                    {dropdownOpen && (
                                        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-md shadow-2xl z-50 overflow-hidden flex flex-col max-h-[300px] anim-fade-in">
                                            {/* Search box inside dropdown */}
                                            <div className="p-2.5 border-b border-gray-100 dark:border-gh-border/60 bg-gray-50 dark:bg-[#0d1117] flex items-center gap-2">
                                                <Search size={14} className="text-gray-400 shrink-0" />
                                                <input
                                                    type="text"
                                                    value={memberSearchQuery}
                                                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                                                    placeholder="Filter by name or role..."
                                                    className="w-full bg-transparent text-xs text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                                                    autoFocus
                                                />
                                                {memberSearchQuery && (
                                                    <button type="button" onClick={() => setMemberSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Employee List */}
                                            <div className="overflow-y-auto divide-y divide-gray-50 dark:divide-gh-border/30 flex-1">
                                                {filteredEmployeeOptions.length > 0 ? (
                                                    filteredEmployeeOptions.map(emp => {
                                                        const isSelected = !!selectedEmployees.find(e => e.id === emp.id);
                                                        return (
                                                            <button
                                                                key={emp.id}
                                                                type="button"
                                                                onClick={() => toggleEmployee(emp)}
                                                                className={`w-full flex items-center gap-2.5 px-3 py-2 transition-all text-left ${
                                                                    isSelected
                                                                        ? 'bg-blue-50/60 dark:bg-blue-950/40'
                                                                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                                                }`}
                                                            >
                                                                <div className={`w-7 h-7 rounded bg-gradient-to-br ${emp.color} flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs`}>
                                                                    {emp.initials}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{emp.name}</p>
                                                                    <p className="text-[10px] text-gray-400 truncate">{emp.role}</p>
                                                                </div>
                                                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                                                                    isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gh-border'
                                                                }`}>
                                                                    {isSelected && <Check size={11} className="text-white stroke-[3]" />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-4 text-center text-xs text-gray-400">
                                                        No employees found matching "{memberSearchQuery}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Selected Members Badges */}
                            {selectedEmployees.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                                    {selectedEmployees.map(emp => (
                                        <div
                                            key={emp.id}
                                            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-md transition-all hover:border-blue-300 dark:hover:border-blue-900/50"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-6 h-6 rounded bg-gradient-to-br ${emp.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-xs`}>
                                                    {emp.initials}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{emp.name}</p>
                                                    <p className="text-[10px] text-gray-400 truncate">{emp.role}</p>
                                                </div>
                                            </div>
                                            {canWrite && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeEmployee(emp.id)}
                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors shrink-0 ml-1.5 cursor-pointer"
                                                    title="Remove Member"
                                                >
                                                    <X size={13} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 border border-dashed border-gray-200 dark:border-gh-border rounded-md text-center text-xs text-gray-400 space-y-1">
                                    <Users size={18} className="mx-auto text-gray-300 dark:text-gray-600 mb-1" />
                                    <p className="font-semibold text-gray-600 dark:text-gray-300">No team members assigned</p>
                                    <p className="text-[11px] text-gray-400">Click '+ Manage' above to assign staff members to this project.</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Full Image Preview Modal */}
            {showFullLogoModal && logoPreview && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowFullLogoModal(false)}>
                    <div className="relative bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-md max-w-xl w-full p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 dark:border-gh-border mb-3">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ImageIcon size={15} className="text-blue-500" />
                                Organisation Logo Preview
                            </h3>
                            <button
                                onClick={() => setShowFullLogoModal(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded"
                            >
                                <X size={15} />
                            </button>
                        </div>
                        <div className="bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-md p-6 flex items-center justify-center max-h-[380px]">
                            <img src={logoPreview} alt="Full Logo" className="max-h-[320px] max-w-full object-contain" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectSettings;

