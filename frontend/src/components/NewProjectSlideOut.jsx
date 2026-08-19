import React, { useState, useEffect, useRef } from 'react';
import { X, Users, UserMinus, Loader2, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import CustomInput from './CustomInput';
import { adminApi } from '../services/adminApi';
import { projectApi } from '../services/projectApi';
import { customToast } from '../utils/toast';

const COLORS = [
    'from-blue-400 to-indigo-500',
    'from-purple-400 to-pink-500',
    'from-orange-400 to-red-500',
    'from-teal-400 to-green-500',
    'from-gray-400 to-slate-500',
    'from-pink-400 to-rose-500'
];

const NewProjectSlideOut = ({ isOpen, onClose, onProjectCreated, projectToEdit = null }) => {
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [employeeOptions, setEmployeeOptions] = useState([]);

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        projectCode: '',
        description: '',
        location: '',
        startDate: '',
        endDate: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const employeeDropdownRef = useRef(null);
    const fileInputRef = useRef(null);

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

    useEffect(() => {
        if (isOpen) {
            if (projectToEdit) {
                const initialLogo = projectToEdit.logoUrl || projectToEdit.logo_url || projectToEdit.metadata?.logo_url || '';
                setFormData({
                    name: projectToEdit.name || '',
                    projectCode: projectToEdit.id || '',
                    description: projectToEdit.metadata?.description || '',
                    location: projectToEdit.location || '',
                    startDate: projectToEdit.startDateRaw || '',
                    endDate: projectToEdit.endDateRaw || ''
                });
                setLogoPreview(initialLogo);
                setLogoFile(null);

                if (projectToEdit.dbId) {
                    projectApi.getProject(projectToEdit.dbId).then(res => {
                        if (res && res.success && res.project) {
                            const p = res.project;
                            let meta = {};
                            if (p.metadata) {
                                try {
                                    meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
                                } catch (e) {}
                            }
                            setFormData(prev => ({
                                ...prev,
                                name: p.name || prev.name,
                                projectCode: p.project_code || prev.projectCode,
                                description: meta.description || p.description || prev.description,
                                location: p.location || prev.location,
                                startDate: p.start_date || prev.startDate,
                                endDate: p.end_date || prev.endDate
                            }));
                            if (p.logo_url) {
                                setLogoPreview(p.logo_url);
                            }
                        }
                    }).catch(err => console.error("Failed to load live edit details", err));
                }
            } else {
                setFormData({
                    name: '', projectCode: '', description: '', location: '', startDate: '', endDate: ''
                });
                setSelectedEmployees([]);
                setLogoPreview('');
                setLogoFile(null);
            }
            fetchEmployees();
        } else {
            setDropdownOpen(false);
        }
    }, [isOpen, projectToEdit]);

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

                if (projectToEdit) {
                    const membersRes = await projectApi.getProjectMembers(projectToEdit.dbId);
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

    const handleSubmit = async () => {
        if (!formData.name) return alert("Project Name is required.");
        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                project_code: formData.projectCode,
                location: formData.location,
                start_date: formData.startDate || null,
                end_date: formData.endDate || null,
                metadata: {
                    ...(projectToEdit ? projectToEdit.metadata : {}),
                    description: formData.description
                },
                ...(!projectToEdit ? { member_ids: selectedEmployees.map(e => e.id) } : {})
            };

            let res;
            if (projectToEdit) {
                res = await projectApi.updateProject(projectToEdit.dbId, payload);
            } else {
                res = await projectApi.createProject(payload);
            }

            if (res.success) {
                const projectId = projectToEdit ? projectToEdit.dbId : res.project_id;
                
                // Upload logo to S3 if a new file was selected
                if (logoFile && projectId) {
                    try {
                        await projectApi.uploadProjectLogo(projectId, logoFile);
                    } catch (logoErr) {
                        console.error("Failed to upload project logo:", logoErr);
                        customToast.error("Project saved but failed to upload logo to S3", "Logo Upload Error");
                    }
                }

                if (projectToEdit) {
                    let currentMemberIds = [];
                    const membersRes = await projectApi.getProjectMembers(projectId);
                    if (membersRes.success) {
                        currentMemberIds = membersRes.members.map(m => m.user_id);
                    }

                    const toAdd = selectedEmployees.filter(e => !currentMemberIds.includes(e.id));
                    const selectedIds = selectedEmployees.map(e => e.id);
                    const toRemove = currentMemberIds.filter(id => !selectedIds.includes(id));

                    for (const emp of toAdd) {
                        await projectApi.assignProjectMember(projectId, {
                            user_id: emp.id
                        });
                    }

                    for (const userId of toRemove) {
                        await projectApi.removeProjectMember(projectId, userId);
                    }
                }
                
                customToast.success(projectToEdit ? 'Project updated successfully' : 'New project created successfully', projectToEdit ? 'Project Updated' : 'Project Created');
                setFormData({
                    name: '', projectCode: '', description: '', location: '', startDate: '', endDate: ''
                });
                setSelectedEmployees([]);
                setLogoFile(null);
                setLogoPreview('');
                if (onProjectCreated) onProjectCreated();
                else onClose();
            }
        } catch (error) {
            console.error("Failed to save project", error);
            const msg = error.response?.data?.message || "Failed to save project details";
            customToast.error(msg, "Save Failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Slide-out Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-[550px] bg-white dark:bg-[#0D1117] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200 dark:border-[#1E2640] ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-[#1E2640]">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {projectToEdit ? 'Edit Project' : 'New Project'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1A2235] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body / Form */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                    {/* Organization Logo Section */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-[#7A8AAB] uppercase tracking-wider mb-2">
                            Project Logo
                        </label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleLogoSelect}
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                        />
                        {logoPreview ? (
                            <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A3445] bg-gray-50 dark:bg-[#1A2235] flex items-center justify-center group">
                                <img
                                    src={logoPreview}
                                    alt="Project Logo Preview"
                                    className="max-h-full max-w-full object-contain p-2"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Upload size={13} /> Change Logo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={removeLogo}
                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 cursor-pointer"
                                        title="Remove Logo"
                                    >
                                        <Trash2 size={13} /> Remove
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                                className="w-full h-24 bg-gray-50 dark:bg-[#1A2235] border-2 border-dashed border-gray-200 dark:border-[#2A3445] hover:border-blue-500 dark:hover:border-blue-400 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-[#7A8AAB] transition-colors group cursor-pointer"
                            >
                                <div className="p-2 bg-gray-100 dark:bg-[#252D3F] rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 text-gray-500 dark:text-[#7A8AAB] group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                                    <Upload size={18} />
                                </div>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                    Click to upload Project Logo
                                </span>
                            </button>
                        )}
                    </div>

                    {/* Row 1: Name and Code */}
                    <div className="grid grid-cols-2 gap-5">
                        <CustomInput label="Project Name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} />
                        <CustomInput label="Project Code" value={formData.projectCode} onChange={(e) => handleInputChange('projectCode', e.target.value)} />
                    </div>

                    {/* Row 2: Description */}
                    <CustomInput label="Description" rows={4} value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} />

                    {/* Row 3: Location */}
                    <CustomInput label="Location" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} />

                    {/* Row 4: Dates */}
                    <div className="grid grid-cols-2 gap-5">
                        <CustomDatePicker label="Start Date" value={formData.startDate} onChange={(val) => handleInputChange('startDate', val.target.value)} />
                        <CustomDatePicker label="End Date" value={formData.endDate} onChange={(val) => handleInputChange('endDate', val.target.value)} />
                    </div>

                    {/* Row 5: Add Employees */}
                    <div className="relative" ref={employeeDropdownRef}>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-[#7A8AAB] uppercase tracking-wider mb-2">
                            Add Employees
                        </label>

                        {/* Dropdown trigger */}
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(o => !o)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-[#1A2235] border border-gray-200 dark:border-[#2A3445] rounded-lg text-sm text-gray-500 dark:text-[#7A8AAB] hover:border-blue-400 transition-colors text-left"
                        >
                            <Users size={14} className="shrink-0" />
                            <span className="flex-1">
                                {selectedEmployees.length > 0
                                    ? `${selectedEmployees.length} employee${selectedEmployees.length > 1 ? 's' : ''} selected`
                                    : 'Select employees to add…'}
                            </span>
                        </button>

                        {/* Dropdown list */}
                        {dropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#1A2235] border border-gray-200 dark:border-[#2A3445] rounded-xl shadow-xl z-50 overflow-hidden max-h-[300px] overflow-y-auto">
                                {employeeOptions.map(emp => {
                                    const isSelected = !!selectedEmployees.find(e => e.id === emp.id);
                                    return (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            onClick={() => toggleEmployee(emp)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                        >
                                            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                                                {emp.initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{emp.name}</p>
                                                <p className="text-xs text-gray-400">{emp.role}</p>
                                            </div>
                                            {/* Tick indicator */}
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-white/20'}`}>
                                                {isSelected && (
                                                    <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="1,4 3.5,6.5 9,1" />
                                                    </svg>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Selected employee chips */}
                        {selectedEmployees.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedEmployees.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-500/30 rounded-full">
                                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                                            {emp.initials}
                                        </div>
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{emp.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeEmployee(emp.id)}
                                            className="text-blue-400 hover:text-red-500 transition-colors ml-0.5"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-[#2A3445] bg-gray-50 dark:bg-[#1A202C] flex justify-end gap-3 items-center">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2A3445] rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <span className="text-lg leading-none mt-[-2px]">+</span>
                        )}
                        {projectToEdit ? 'Save Changes' : 'Create Project'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default NewProjectSlideOut;
