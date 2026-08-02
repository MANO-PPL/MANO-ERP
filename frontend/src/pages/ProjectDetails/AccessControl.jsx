import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
    Users, Shield, UserPlus, Trash2, CheckCircle2, 
    Save, ShieldCheck, Lock, ChevronRight, Loader2, Sparkles,
    Plus, Edit3, Info, AlertCircle, X, Sliders, FolderKey
} from 'lucide-react';
import { toast } from 'react-toastify';
import { projectApi } from '../../services/projectApi';
import { adminApi } from '../../services/adminApi';

const PROJECT_PAGES = [
    { id: 'Tasks', label: 'Tasks' },
    { id: 'WIP', label: 'Work In Progress (WIP)' },
    { id: 'Reports', label: 'Reports & Analytics' },
    { id: 'General Documents', label: 'General Documents' },
    { id: 'Drawings', label: 'Drawings & Blueprints' },
    { id: 'Planning', label: 'Project Planning' },
    { id: 'Contracts', label: 'Contracts & Agreements' },
    { id: 'Quality', label: 'Quality Control' },
    { id: 'Safety', label: 'Safety & Compliance' },
    { id: 'Billing', label: 'Billing & Invoicing' },
    { id: 'Material Management', label: 'Material Management' },
    { id: 'Approvals', label: 'Workflow Approvals' }
];

const ACCESS_LEVELS = ['None', 'Read', 'Write'];

// ─── Delete Project Template Modal ──────────────────────────────────────────────
const DeleteTemplateModal = ({ open, onClose, onConfirm, template, isDeleting }) => {
    if (!open || !template) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 text-center space-y-4">
                    <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-200/50 dark:border-amber-500/30 shadow-xs">
                        <AlertCircle size={28} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Project Template?</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                            Are you sure you want to delete template <span className="font-bold text-gray-900 dark:text-white">"{template.name}"</span>?
                        </p>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 dark:bg-[#0d1117] border-t border-gray-100 dark:border-white/10 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" /> Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 size={14} /> Delete Template
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Project Template Editor Modal ─────────────────────────────────────────────
const ProjectTemplateEditorModal = ({ open, onClose, onSave, templateToEdit, isSaving, initialPermissions }) => {
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState({});

    useEffect(() => {
        if (templateToEdit) {
            setName(templateToEdit.name || '');
            const perms = templateToEdit.permissions || {};
            setPermissions(typeof perms === 'string' ? JSON.parse(perms) : { ...perms });
        } else {
            setName('');
            const initPerms = initialPermissions && Object.keys(initialPermissions).length > 0 ? { ...initialPermissions } : {};
            PROJECT_PAGES.forEach(m => {
                if (initPerms[m.id] === undefined) initPerms[m.id] = 2;
            });
            setPermissions(initPerms);
        }
    }, [templateToEdit, open, initialPermissions]);

    const handlePreset = (level) => {
        const updated = {};
        PROJECT_PAGES.forEach(m => {
            updated[m.id] = level;
        });
        setPermissions(updated);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Please enter a template name');
            return;
        }
        onSave({
            id: templateToEdit?.id,
            name: name.trim(),
            type: 'project',
            permissions
        });
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 bg-gray-50/80 dark:bg-[#0d1117]/80 border-b border-gray-200 dark:border-white/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/50 dark:border-emerald-500/20">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {templateToEdit ? 'Edit Project Template' : 'Create Project Permission Template'}
                            </h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Configure page access levels reusable for project team members
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg">
                        <X size={18} />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Template Name *</label>
                        <input
                            type="text"
                            placeholder="e.g. Site Engineer (Project)"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3.5 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                            required
                        />
                    </div>

                    {/* Presets Toolbar */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0d1117] rounded-xl border border-gray-200 dark:border-white/10 text-xs">
                        <span className="font-bold text-gray-700 dark:text-gray-300">Presets:</span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => handlePreset(2)}
                                className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg text-[11px] font-bold border border-emerald-200/50 dark:border-emerald-500/30 hover:bg-emerald-100 transition-all"
                            >
                                All Write
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePreset(1)}
                                className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg text-[11px] font-bold border border-blue-200/50 dark:border-blue-500/30 hover:bg-blue-100 transition-all"
                            >
                                All Read
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePreset(0)}
                                className="px-2.5 py-1 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 rounded-lg text-[11px] font-bold hover:bg-gray-200 transition-all"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>

                    {/* Module List */}
                    <div className="space-y-1.5">
                        {PROJECT_PAGES.map(mod => {
                            const lvl = permissions[mod.id] ?? 0;
                            return (
                                <div key={mod.id} className="p-2.5 bg-gray-50/50 dark:bg-[#161b22]/50 rounded-xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{mod.label}</span>
                                    <div className="flex gap-1">
                                        {ACCESS_LEVELS.map((name, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setPermissions(p => ({ ...p, [mod.id]: i }))}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                                    lvl === i
                                                        ? i === 2 ? 'bg-emerald-600 text-white shadow-xs' : i === 1 ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-600 text-white'
                                                        : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200'
                                                }`}
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" /> Saving...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} /> {templateToEdit ? 'Save Changes' : 'Create Project Template'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Main Access Control Component ─────────────────────────────────────────────
const AccessControl = () => {
    const { id } = useParams(); // project_id
    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [selectedMember, setSelectedMember] = useState(null);
    const [localPermissions, setLocalPermissions] = useState({});
    
    const [selectedNewUser, setSelectedNewUser] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Template Modals
    const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
    const [templateToEdit, setTemplateToEdit] = useState(null);
    const [deletingTemplate, setDeletingTemplate] = useState(null);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [membersRes, usersRes, templatesRes] = await Promise.all([
                projectApi.getProjectMembers(id),
                adminApi.getUsers(),
                adminApi.getPermissionTemplates('project')
            ]);
            
            if (membersRes.success) {
                const mappedMembers = membersRes.members.map(m => {
                    const basePerms = m.project_permissions ? (typeof m.project_permissions === 'string' ? JSON.parse(m.project_permissions) : m.project_permissions) : {};
                    const mappedPerms = {};
                    const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };
                    for (const [k, v] of Object.entries(basePerms || {})) {
                        if (typeof v === 'string') {
                            mappedPerms[k] = map[v.toLowerCase()] ?? 0;
                        } else {
                            mappedPerms[k] = v;
                        }
                    }
                    return {
                        ...m,
                        permissions: mappedPerms
                    };
                });
                setMembers(mappedMembers);
                
                if (selectedMember) {
                    const updated = mappedMembers.find(x => x.user_id === selectedMember.user_id);
                    if (updated) {
                        setSelectedMember(updated);
                        setLocalPermissions(updated.permissions);
                    }
                } else if (mappedMembers.length > 0) {
                    setSelectedMember(mappedMembers[0]);
                    setLocalPermissions(mappedMembers[0].permissions);
                }
            }
            
            if (usersRes.success) {
                setAllUsers(usersRes.users);
            }
            
            if (templatesRes.success && templatesRes.templates) {
                setTemplates(templatesRes.templates.filter(t => t.type === 'project'));
            }
        } catch (err) {
            console.error('Failed to load access control details:', err);
            toast.error('Failed to load project members or templates');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleSelectMember = (member) => {
        setSelectedMember(member);
        setLocalPermissions(member.permissions || {});
    };

    const handleLevelChange = (page, level) => {
        setLocalPermissions(p => ({
            ...p,
            [page]: level
        }));
    };

    const handleApplyTemplate = (templateId) => {
        const template = templates.find(t => String(t.id) === String(templateId));
        if (template) {
            const perms = typeof template.permissions === 'string' ? JSON.parse(template.permissions) : template.permissions;
            const newPerms = {};
            const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };
            for (const [k, v] of Object.entries(perms || {})) {
                newPerms[k] = typeof v === 'string' ? (map[v.toLowerCase()] ?? 0) : Number(v);
            }
            setLocalPermissions(newPerms);
            toast.success(`Applied template permissions: "${template.name}"`);
        }
    };

    const handleSavePermissions = async () => {
        if (!selectedMember) return;
        setIsSaving(true);
        try {
            const backendPerms = {};
            const map = { 0: 'none', 1: 'view', 2: 'edit' };
            for (const [k, v] of Object.entries(localPermissions)) {
                if (typeof v === 'number') {
                    backendPerms[k] = map[v] || 'none';
                } else {
                    backendPerms[k] = v;
                }
            }

            await projectApi.assignProjectMember(id, {
                user_id: selectedMember.user_id,
                permissions: backendPerms
            });
            toast.success(`Successfully saved permissions for ${selectedMember.user_name}`);
            await loadData();
        } catch (err) {
            console.error(err);
            toast.error('Failed to save permissions');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTemplate = async (templateData) => {
        setIsSavingTemplate(true);
        try {
            if (templateData.id) {
                await adminApi.updatePermissionTemplate(templateData.id, templateData);
                toast.success(`Project template "${templateData.name}" updated!`);
            } else {
                await adminApi.createPermissionTemplate(templateData);
                toast.success(`Project template "${templateData.name}" created!`);
            }
            setTemplateEditorOpen(false);
            setTemplateToEdit(null);
            await loadData();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save template');
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const confirmDeleteTemplate = async () => {
        if (!deletingTemplate) return;
        setIsDeletingTemplate(true);
        try {
            await adminApi.deleteTemplate(deletingTemplate.id);
            toast.success(`Template "${deletingTemplate.name}" deleted successfully`);
            setDeletingTemplate(null);
            await loadData();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to delete template');
        } finally {
            setIsDeletingTemplate(false);
        }
    };

    const handleAddMember = async () => {
        if (!selectedNewUser) return;
        setIsAdding(true);
        try {
            await projectApi.assignProjectMember(id, {
                user_id: parseInt(selectedNewUser),
                permissions: {}
            });
            toast.success('Member assigned to project');
            setSelectedNewUser('');
            await loadData();
        } catch (err) {
            console.error(err);
            toast.error('Failed to add member');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (userId, name) => {
        if (!window.confirm(`Are you sure you want to remove ${name} from this project?`)) return;
        try {
            await projectApi.removeProjectMember(id, userId);
            toast.success(`${name} removed from project`);
            if (selectedMember && selectedMember.user_id === userId) {
                setSelectedMember(null);
            }
            await loadData();
        } catch (err) {
            console.error(err);
            toast.error('Failed to remove member');
        }
    };

    const memberUserIds = new Set(members.map(m => m.user_id));
    const nonMembers = allUsers.filter(u => !memberUserIds.has(u.user_id || u.id));

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white dark:bg-[#0d1117]">
                <Loader2 size={36} className="text-blue-500 animate-spin mb-4" />
                <p className="text-sm text-gray-400">Loading access control parameters...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex overflow-hidden bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100">
            {/* Left Panel: Members list */}
            <div className="w-[320px] border-r border-gray-200 dark:border-white/10 flex flex-col bg-gray-50/50 dark:bg-transparent">
                {/* Add member section */}
                <div className="p-4 border-b border-gray-200 dark:border-white/10 space-y-3">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Add Team Member</label>
                    <div className="flex gap-2">
                        <select
                            value={selectedNewUser}
                            onChange={e => setSelectedNewUser(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none appearance-none font-medium truncate"
                        >
                            <option value="">Select a user...</option>
                            {nonMembers.map(u => (
                                <option key={u.user_id || u.id} value={u.user_id || u.id}>
                                    {u.user_name || u.name} ({u.email || u.email_id})
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleAddMember}
                            disabled={!selectedNewUser || isAdding}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-all flex items-center justify-center shrink-0 active:scale-95 shadow-sm"
                            title="Add member"
                        >
                            {isAdding ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                        </button>
                    </div>
                </div>

                {/* Members list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    <div className="px-2 mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Project Members ({members.length})</span>
                    </div>
                    {members.length === 0 ? (
                        <div className="py-8 text-center text-xs text-gray-400">
                            No team members assigned to this project.
                        </div>
                    ) : (
                        members.map(member => (
                            <div
                                key={member.user_id}
                                onClick={() => handleSelectMember(member)}
                                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer group transition-all ${
                                    selectedMember?.user_id === member.user_id
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-500/30'
                                        : 'hover:bg-gray-100 dark:hover:bg-white/[0.02] border border-transparent'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0 shadow-sm">
                                        {member.user_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-xs font-bold truncate ${selectedMember?.user_id === member.user_id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                            {member.user_name}
                                        </p>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                            {member.email}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveMember(member.user_id, member.user_name);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    title="Remove from project"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Permissions Editor & Project Templates */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-8">
                {selectedMember ? (
                    <div className="w-full space-y-6">
                        {/* Member Details Header */}
                        <div className="flex items-center justify-between bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 p-5 rounded-2xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                                    {selectedMember.user_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{selectedMember.user_name}</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">{selectedMember.email} • {selectedMember.user_type}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={16} className="text-green-500" />
                                <span className="text-xs font-bold text-green-500 uppercase tracking-wide">Project Member</span>
                            </div>
                        </div>

                        {/* Interactive Project Templates Bar */}
                        <div className="p-4 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100/60 dark:border-emerald-500/20 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                    <Sparkles size={15} className="text-emerald-500" />
                                    <span>Project Permission Templates</span>
                                    <span className="px-2 py-0.2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] rounded-full font-bold">
                                        {templates.length} Available
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTemplateToEdit(null);
                                            setTemplateEditorOpen(true);
                                        }}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1"
                                    >
                                        <Plus size={13} /> Create Template
                                    </button>
                                </div>
                            </div>

                            {/* Templates Quick Cards */}
                            {templates.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                                    {templates.map(t => (
                                        <div
                                            key={t.id}
                                            className="p-3 bg-white dark:bg-[#161b22] border border-gray-200/80 dark:border-white/10 rounded-xl hover:border-emerald-400 transition-all flex flex-col justify-between group shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <h5 className="text-xs font-bold text-gray-900 dark:text-white truncate">{t.name}</h5>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setTemplateToEdit(t);
                                                            setTemplateEditorOpen(true);
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-emerald-600 rounded transition-colors"
                                                        title="Edit Template"
                                                    >
                                                        <Edit3 size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeletingTemplate(t)}
                                                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                                        title="Delete Template"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleApplyTemplate(t.id)}
                                                className="w-full py-1 mt-1 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-400 text-[11px] font-bold rounded-lg transition-all border border-emerald-200/50 dark:border-emerald-500/30 flex items-center justify-center gap-1"
                                            >
                                                <Sparkles size={11} /> Apply to Member
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic py-1">No project templates created yet. Click "Create Template" to add one.</p>
                            )}
                        </div>

                        {/* Permissions Grid */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Lock size={12} /> Page Level Access in Project
                                </h4>
                                <span className="text-[10px] text-gray-400">Configure permission level for each page</span>
                            </div>

                            <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-white/5">
                                {PROJECT_PAGES.map(page => {
                                    const lvl = localPermissions[page.id] ?? 0;
                                    return (
                                        <div key={page.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors">
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{page.label}</span>
                                            <div className="flex gap-1.5">
                                                {ACCESS_LEVELS.map((name, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => handleLevelChange(page.id, i)}
                                                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                                                            lvl === i 
                                                                ? 'bg-blue-600 text-white shadow-sm' 
                                                                : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                                        }`}
                                                    >
                                                        {name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Save Actions */}
                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setTemplateToEdit(null);
                                    setTemplateEditorOpen(true);
                                }}
                                className="px-4 py-2 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                                <Sparkles size={14} /> Save Current Access as Template
                            </button>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setLocalPermissions(selectedMember.permissions || {})}
                                    className="px-5 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                                >
                                    Reset Changes
                                </button>
                                <button
                                    onClick={handleSavePermissions}
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-md shadow-blue-500/20 flex items-center gap-2"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save Permissions
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <Users size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No Member Selected</h3>
                        <p className="text-xs text-gray-400 mt-1 max-w-[280px]">Select a project member on the left or add a new team member to configure specific page access levels.</p>
                    </div>
                )}
            </div>

            {/* Template Editor Modal */}
            <ProjectTemplateEditorModal
                open={templateEditorOpen}
                onClose={() => {
                    setTemplateEditorOpen(false);
                    setTemplateToEdit(null);
                }}
                onSave={handleSaveTemplate}
                templateToEdit={templateToEdit}
                isSaving={isSavingTemplate}
                initialPermissions={localPermissions}
            />

            {/* Delete Template Modal */}
            <DeleteTemplateModal
                open={!!deletingTemplate}
                onClose={() => setDeletingTemplate(null)}
                onConfirm={confirmDeleteTemplate}
                template={deletingTemplate}
                isDeleting={isDeletingTemplate}
            />
        </div>
    );
};

export default AccessControl;
