import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
    Users, Shield, UserPlus, Trash2, CheckCircle2, 
    Save, ShieldCheck, Lock, ChevronRight, Loader2, Sparkles 
} from 'lucide-react';
import { toast } from 'react-toastify';
import { projectApi } from '../../services/projectApi';
import { adminApi } from '../../services/adminApi';

const PROJECT_PAGES = [
    'Tasks', 'WIP', 'Reports', 'General Documents', 'Drawings', 
    'Planning', 'Contracts', 'Quality', 'Safety', 'Billing', 
    'Material Management', 'Approvals'
];

const ACCESS_LEVELS = ['None', 'Read', 'Write'];

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
                
                // Keep selected member reference updated
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
            
            if (templatesRes.success) {
                setTemplates(templatesRes.templates);
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
        const template = templates.find(t => t.id === parseInt(templateId));
        if (template) {
            const perms = typeof template.permissions === 'string' ? JSON.parse(template.permissions) : template.permissions;
            setLocalPermissions(perms);
            toast.success(`Loaded template permissions for "${template.name}"`);
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

    // Filter list of users in organization who are not already project members
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

    const accessLevelColor = (lvl) => ['text-gray-400', 'text-blue-400', 'text-green-500'][lvl] || 'text-gray-400';
    const accessLevelBg = (lvl) => ['bg-gray-100 dark:bg-white/5', 'bg-blue-50 dark:bg-blue-900/20', 'bg-green-50 dark:bg-green-900/20'][lvl] || '';

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

            {/* Right Panel: Permissions Editor */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-8">
                {selectedMember ? (
                    <div className="w-full space-y-6">
                        {/* Member Details */}
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

                        {/* Template Quick Actions */}
                        {templates.length > 0 && (
                            <div className="p-4 bg-blue-50/20 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-500/20 rounded-2xl flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                                    <Sparkles size={14} /> Quick Apply Project Template
                                </div>
                                <select 
                                    onChange={e => {
                                        if (e.target.value) {
                                            handleApplyTemplate(e.target.value);
                                            e.target.value = ''; // Reset select after applying
                                        }
                                    }}
                                    defaultValue=""
                                    className="px-3 py-1.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>-- Select a template --</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

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
                                    const lvl = localPermissions[page] ?? 0;
                                    return (
                                        <div key={page} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors">
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{page}</span>
                                            <div className="flex gap-1.5">
                                                {ACCESS_LEVELS.map((name, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => handleLevelChange(page, i)}
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

                        {/* Save Trigger */}
                        <div className="flex justify-end gap-3 pt-2">
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
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <Users size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">No Member Selected</h3>
                        <p className="text-xs text-gray-400 mt-1 max-w-[280px]">Select a project member on the left or add a new team member to configure specific page access levels.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccessControl;
