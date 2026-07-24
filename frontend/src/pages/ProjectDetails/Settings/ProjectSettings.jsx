import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Users, X, Loader2, Save, Building2, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import CustomInput from '../../../components/CustomInput';
import CustomDatePicker from '../../../components/CustomDatePicker';
import CustomSelect from '../../../components/CustomSelect';
import { adminApi } from '../../../services/adminApi';
import { projectApi } from '../../../services/projectApi';
import { customToast } from '../../../utils/toast';

const COLORS = [
    'from-blue-400 to-indigo-500',
    'from-purple-400 to-pink-500',
    'from-orange-400 to-red-500',
    'from-teal-400 to-green-500',
    'from-gray-400 to-slate-500',
    'from-pink-400 to-rose-500'
];

const ProjectSettings = ({ project, canWrite, reloadProject }) => {
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [employeeOptions, setEmployeeOptions] = useState([]);

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

    // Load initial project details
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
        }
    }, [project]);

    const fetchEmployees = async () => {
        try {
            const res = await adminApi.getUsers();
            if (res.success) {
                const mappedUsers = res.users.map((u, idx) => ({
                    id: u.user_id,
                    name: u.user_name,
                    role: u.user_type,
                    initials: u.user_name.substring(0, 2).toUpperCase(),
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
            console.error("Failed to fetch employees", error);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLogoSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                customToast.error('Please upload an image file (PNG, JPG, WEBP)', 'Invalid File');
                return;
            }
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
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
                // If a new logo file was chosen, upload to S3
                if (logoFile) {
                    try {
                        await projectApi.uploadProjectLogo(project.id, logoFile);
                    } catch (logoErr) {
                        console.error("Failed to upload logo:", logoErr);
                        customToast.error("Project details updated, but logo upload failed", "Logo Error");
                    }
                }

                // Member assignments update
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

                customToast.success('Project details updated successfully', 'Settings Saved');
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
        <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-8">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-gh-border">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Building2 size={22} className="text-blue-600 dark:text-blue-400" />
                        Project Settings
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Manage project configuration, organisation logo, dates, status, and team assignments.
                    </p>
                </div>
                {canWrite && (
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Settings
                    </button>
                )}
            </div>

            {/* Main Form Sections */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Logo & Status Card */}
                <div className="space-y-6 md:col-span-1">
                    {/* Organisation Logo Box */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-5 shadow-sm space-y-4">
                        <h2 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wider">
                            Organisation Logo
                        </h2>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleLogoSelect}
                            className="hidden"
                            disabled={!canWrite}
                        />

                        {logoPreview ? (
                            <div className="relative group w-full h-36 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-xl flex items-center justify-center p-3">
                                <img
                                    src={logoPreview}
                                    alt="Project Logo Preview"
                                    className="max-h-full max-w-full object-contain rounded"
                                    onError={(e) => {
                                        console.error("Logo image failed to load:", logoPreview);
                                        // If presigned URL expired or failed, hide broken image icon gracefully
                                    }}
                                />
                                {canWrite && (
                                    <button
                                        type="button"
                                        onClick={removeLogo}
                                        className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg opacity-90 transition-opacity shadow"
                                        title="Remove Logo"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => canWrite && fileInputRef.current && fileInputRef.current.click()}
                                disabled={!canWrite}
                                className="w-full h-36 bg-white dark:bg-[#0d1117] border-2 border-dashed border-gray-200 dark:border-gh-border hover:border-blue-500 dark:hover:border-blue-400 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 transition-colors group disabled:opacity-50 cursor-pointer"
                            >
                                <div className="p-3 bg-gray-100 dark:bg-[#21262d] rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                                    <Upload size={20} />
                                </div>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                    {canWrite ? 'Click to upload Logo' : 'No logo uploaded'}
                                </span>
                            </button>
                        )}
                        <p className="text-[11px] text-gray-400">
                            This logo is used in DPR (Daily Progress Reports), exports, and headers across the project.
                        </p>
                    </div>

                    {/* Status Card */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-5 shadow-sm space-y-3">
                        <label className="block text-xs font-semibold text-gray-800 dark:text-white uppercase tracking-wider">
                            Project Status
                        </label>
                        <CustomSelect
                            value={formData.status}
                            onChange={(e) => handleInputChange('status', e.target.value)}
                            options={["active", "completed", "on-hold", "archived"]}
                            disabled={!canWrite}
                        />
                    </div>
                </div>

                {/* Right Columns: Details & Dates */}
                <div className="space-y-6 md:col-span-2">
                    {/* General Information */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-5 shadow-sm space-y-5">
                        <h2 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gh-border pb-3">
                            General Details
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <CustomInput
                                label="Project Name"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                disabled={!canWrite}
                            />
                            <CustomInput
                                label="Project Code"
                                value={formData.projectCode}
                                onChange={(e) => handleInputChange('projectCode', e.target.value)}
                                disabled={!canWrite}
                            />
                        </div>

                        <CustomInput
                            label="Description"
                            rows={3}
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            disabled={!canWrite}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <CustomInput
                                label="Location"
                                value={formData.location}
                                onChange={(e) => handleInputChange('location', e.target.value)}
                                disabled={!canWrite}
                            />
                            <CustomInput
                                label="Employer"
                                value={formData.employer}
                                onChange={(e) => handleInputChange('employer', e.target.value)}
                                disabled={!canWrite}
                            />
                        </div>

                        <CustomSelect
                            label="Client"
                            value={formData.client}
                            onChange={(e) => handleInputChange('client', e.target.value)}
                            options={["Select Client", "Client A", "Client B"]}
                            disabled={!canWrite}
                        />
                    </div>

                    {/* Schedule / Timeline */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-5 shadow-sm space-y-5">
                        <h2 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gh-border pb-3 flex items-center gap-2">
                            <Calendar size={16} className="text-blue-500" />
                            Timeline & Dates
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <CustomDatePicker
                                label="Start Date"
                                value={formData.startDate}
                                onChange={(val) => handleInputChange('startDate', val.target.value)}
                                disabled={!canWrite}
                            />
                            <CustomDatePicker
                                label="End Date"
                                value={formData.endDate}
                                onChange={(val) => handleInputChange('endDate', val.target.value)}
                                disabled={!canWrite}
                            />
                        </div>
                    </div>

                    {/* Team Members Assignment */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl p-5 shadow-sm space-y-5">
                        <h2 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gh-border pb-3 flex items-center gap-2">
                            <Users size={16} className="text-blue-500" />
                            Assigned Team Members
                        </h2>

                        {canWrite && (
                            <div className="relative" ref={employeeDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setDropdownOpen(o => !o)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:border-blue-500 transition-colors text-left"
                                >
                                    <Users size={14} className="shrink-0" />
                                    <span className="flex-1">
                                        {selectedEmployees.length > 0
                                            ? `${selectedEmployees.length} employee${selectedEmployees.length > 1 ? 's' : ''} assigned`
                                            : 'Add team members…'}
                                    </span>
                                </button>

                                {dropdownOpen && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[250px] overflow-y-auto">
                                        {employeeOptions.map(emp => {
                                            const isSelected = !!selectedEmployees.find(e => e.id === emp.id);
                                            return (
                                                <button
                                                    key={emp.id}
                                                    type="button"
                                                    onClick={() => toggleEmployee(emp)}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${isSelected ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                                >
                                                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                                                        {emp.initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{emp.name}</p>
                                                        <p className="text-xs text-gray-400">{emp.role}</p>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-white/20'}`}>
                                                        {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedEmployees.length > 0 ? (
                            <div className="flex flex-wrap gap-2.5 pt-2">
                                {selectedEmployees.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-500/30 rounded-full">
                                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                                            {emp.initials}
                                        </div>
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{emp.name}</span>
                                        {canWrite && (
                                            <button
                                                type="button"
                                                onClick={() => removeEmployee(emp.id)}
                                                className="text-blue-400 hover:text-red-500 transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic">No team members assigned yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectSettings;
