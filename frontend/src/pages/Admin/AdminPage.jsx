import React, { useState, useEffect, useRef } from 'react';
import {
    UserPlus, Search, MoreHorizontal, Filter, Download,
    Mail, Shield, Calendar, X, Upload, FileText,
    CheckCircle2, AlertCircle, FileCode, Check, Lock,
    ChevronRight, Eye, Edit3, Trash2, Info, Users,
    LayoutDashboard, Briefcase, Map, MessageSquare, Settings, ChevronDown, Loader2,
    Package, ArrowLeftRight, GripVertical, UploadCloud, Pencil
} from 'lucide-react';
import { toast } from 'react-toastify';
import { adminApi } from '../../services/adminApi';
import { projectApi } from '../../services/projectApi';


// ─── Full App Page Tree ───────────────────────────────────────────────────────
const PAGE_TREE = [
    {
        id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard,
        children: []
    },
    {
        id: 'projects', label: 'Projects', icon: Briefcase,
        children: []
    },
    {
        id: 'vendors', label: 'Vendors', icon: Map,
        children: []
    },
    {
        id: 'clients', label: 'Clients', icon: Users,
        children: []
    },
    {
        id: 'resources', label: 'Resources', icon: Package,
        children: []
    },
    {
        id: 'units', label: 'Units', icon: ArrowLeftRight,
        children: []
    },
    {
        id: 'collaboration', label: 'Collaboration', icon: MessageSquare,
        children: [
            { id: 'collaboration.chat', label: 'Chat' },
            { id: 'collaboration.calendar', label: 'Calendar' },
        ]
    },
    {
        id: 'admin', label: 'Admin Panel', icon: Shield,
        children: []
    },
];

// Flat list of all permission keys derived from tree
const allPermKeys = (tree) => {
    const keys = [];
    tree.forEach(node => {
        keys.push(node.id);
        (node.children || []).forEach(c => keys.push(c.id));
    });
    return keys;
};

const ALL_PERM_KEYS = allPermKeys(PAGE_TREE);

const ACCESS_LEVELS = ['None', 'Read', 'Write'];

const defaultPermissions = () => {
    const p = {};
    ALL_PERM_KEYS.forEach(k => { p[k] = 0; });
    return p;
};

const getPresetPermissions = (templateName) => {
    const p = defaultPermissions();
    if (templateName === 'Admin') {
        ALL_PERM_KEYS.forEach(k => { p[k] = 2; });
    } else if (templateName === 'Employee') {
        ALL_PERM_KEYS.forEach(k => {
            if (k === 'admin') p[k] = 0;
            else p[k] = 2;
        });
    } else if (templateName === 'Client') {
        ALL_PERM_KEYS.forEach(k => {
            if (['projects', 'dashboard', 'collaboration'].includes(k)) p[k] = 1;
            else p[k] = 0;
        });
    }
    return p;
};

const getDynamicPageTree = (projectsList) => {
    return PAGE_TREE.map(node => {
        if (node.id === 'projects') {
            return {
                ...node,
                children: (projectsList || []).map(p => ({
                    id: `project_${p.id}`,
                    label: p.name
                }))
            };
        }
        return node;
    });
};

// INITIAL_USERS removed. Fetching live from DB.

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const cfg = {
        Active: { dot: 'bg-green-500', bg: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
        Away: { dot: 'bg-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
        Offline: { dot: 'bg-gray-400', bg: 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400' },
    }[status] || { dot: 'bg-gray-400', bg: 'bg-gray-100 text-gray-500' };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cfg.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dot}`} /> {status}
        </span>
    );
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 10 }) => (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm shadow-sm ring-2 ring-white dark:ring-[#161b22] shrink-0`}>
        {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
    </div>
);

// ─── Add User Drawer ──────────────────────────────────────────────────────────
const AddUserDrawer = ({ open, onClose, onAdd, allProjects = [], templates = [], initialTab = 'form' }) => {
    const [tab, setTab] = useState(initialTab);
    const [form, setForm] = useState({ name: '', email: '', role: 'Employee', department: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [permissions, setPermissions] = useState(() => defaultPermissions());
    const [permExpanded, setPermExpanded] = useState({ projects: false, collaboration: false });
    const [showPerms, setShowPerms] = useState(false);

    const dynamicPageTree = getDynamicPageTree(allProjects);

    useEffect(() => {
        if (open) {
            setTab(initialTab);
            const p = defaultPermissions();
            allProjects.forEach(proj => {
                p[`project_${proj.id}`] = 0;
            });
            setPermissions(p);
            setShowPerms(false);
        }
    }, [open, allProjects]);

    const handleDrag = (e) => { e.preventDefault(); setDragging(e.type === 'dragenter' || e.type === 'dragover'); };
    const handleDrop = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAdd = async () => {
        if (!form.name || !form.email || !form.password) {
            toast.error("Name, email and password are required.");
            return;
        }
        setIsSubmitting(true);
        try {
            const selectedProjectIds = Object.keys(permissions)
                .filter(k => k.startsWith('project_') && permissions[k] > 0)
                .map(k => parseInt(k.replace('project_', '')));

            await onAdd({ 
                ...form, 
                id: Date.now(), 
                status: 'Active', 
                joined: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), 
                permissions,
                project_ids: selectedProjectIds
            });
            setForm({ name: '', email: '', role: 'Viewer', department: '', password: '' });
            setShowPerms(false);
            onClose();
        } catch (e) {
            // Handled by parent
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />
            {/* Drawer */}
            <div className={`fixed top-0 right-0 h-full w-[480px] bg-white dark:bg-[#161b22] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-7 py-6 border-b border-gray-100 dark:border-white/10 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add New User</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Fill the form or upload in bulk</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
                    {/* Toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                        {[['form', 'Fill Form'], ['bulk', 'Bulk Upload']].map(([id, label]) => (
                            <button key={id} onClick={() => setTab(id)}
                                className={`flex-1 py-2.5 text-sm font-semibold transition-all ${tab === id ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {tab === 'form' ? (
                        <div className="space-y-4">
                            {[
                                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'e.g. John Doe' },
                                { label: 'Email Address', key: 'email', type: 'email', placeholder: 'e.g. john@mano.co.in' },
                            ].map(({ label, key, type, placeholder }) => (
                                <div key={key}>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
                                    <input type={type} placeholder={placeholder} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" />
                                </div>
                            ))}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Permission Template</label>
                                    <select value={form.role || 'Employee'} onChange={e => {
                                            const val = e.target.value;
                                            setForm(p => ({ ...p, role: val }));
                                            if (val !== 'Custom') {
                                                setPermissions(getPresetPermissions(val));
                                                setShowPerms(false);
                                            } else {
                                                setShowPerms(true);
                                            }
                                        }}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none appearance-none">
                                        <option value="Admin">Admin</option>
                                        <option value="Employee">Employee</option>
                                        <option value="Client">Client</option>
                                        <option value="Custom">Custom</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Department</label>
                                    <input type="text" placeholder="e.g. Engineering" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Password</label>
                                <div className="relative">
                                    <input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Set initial password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                        className="w-full px-4 py-2.5 pr-10 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" />
                                    <button onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        <Eye size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Assign Page Permissions */}
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
                                <button
                                    onClick={() => setShowPerms(p => !p)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#0d1117] hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                        <Shield size={14} className="text-blue-500" /> Assign Page Permissions
                                    </div>
                                    <ChevronDown size={15} className={`text-gray-400 transition-transform ${showPerms ? 'rotate-180' : ''}`} />
                                </button>

                                {showPerms && (
                                    <div className="px-3 pb-3 pt-2 space-y-2 border-t border-gray-100 dark:border-white/5">
                                        {dynamicPageTree.map(section => {
                                            const lvl = permissions[section.id] ?? 0;
                                            return (
                                                <div key={section.id} className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden">
                                                    <div className="flex items-center justify-between px-3 py-2">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <Lock size={11} className="text-gray-400 shrink-0" />
                                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-1 truncate">{section.label}</span>
                                                            <div className="flex gap-1 shrink-0">
                                                                {ACCESS_LEVELS.map((name, i) => (
                                                                    <button key={i}
                                                                        type="button"
                                                                        onClick={() => setPermissions(p => ({ ...p, [section.id]: i }))}
                                                                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${lvl === i ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                                                                        {name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        {section.children.length > 0 && (
                                                            <button onClick={() => setPermExpanded(e => ({ ...e, [section.id]: !e[section.id] }))}
                                                                className="ml-2 p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                                                                <ChevronDown size={13} className={`transition-transform ${permExpanded[section.id] ? 'rotate-180' : ''}`} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {section.children.length > 0 && permExpanded[section.id] && (
                                                        <div className="border-t border-gray-100 dark:border-white/5 px-3 pb-2 pt-1 space-y-0.5">
                                                            {section.children.map(child => {
                                                                const cLvl = permissions[child.id] ?? 0;
                                                                const isProjectNode = child.id.startsWith('project_');
                                                                const levelsToUse = isProjectNode ? ['None', 'Access'] : ACCESS_LEVELS;
                                                                return (
                                                                    <div key={child.id} className="flex items-center justify-between ml-4 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                                                                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">{child.label}</span>
                                                                        <div className="flex gap-1 shrink-0">
                                                                            {levelsToUse.map((name, i) => {
                                                                                const isActive = isProjectNode ? (i === 0 ? cLvl === 0 : cLvl > 0) : cLvl === i;
                                                                                return (
                                                                                    <button key={i}
                                                                                        type="button"
                                                                                        onClick={() => setPermissions(p => ({ ...p, [child.id]: isProjectNode ? (i === 0 ? 0 : 1) : i }))}
                                                                                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                                                                                        {name}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div
                                onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all ${dragging ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-white/10 hover:border-blue-400'}`}>
                                {!file ? (
                                    <>
                                        <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 flex items-center justify-center text-blue-500 mb-4">
                                            <Upload size={24} />
                                        </div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">Drag & drop your file here</p>
                                        <p className="text-xs text-gray-400 mt-1 mb-5">CSV or XLSX, max 10MB</p>
                                        <label className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all">
                                            Browse Files
                                            <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
                                        </label>
                                    </>
                                ) : (
                                    <div className="w-full space-y-3">
                                        <div className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-500/30 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <FileText size={20} className="text-blue-500" />
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[220px]">{file.name}</p>
                                                    <p className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setFile(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                                        </div>
                                        <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95">
                                            Start Import
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#0d1117] border border-gray-100 dark:border-white/10 space-y-3">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Required columns</p>
                                {['Full Name', 'Email', 'Password', 'Department', 'Role'].map(c => (
                                    <div key={c} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <CheckCircle2 size={13} className="text-green-500 shrink-0" /> {c}
                                    </div>
                                ))}
                                <button className="flex items-center gap-2 mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400">
                                    <Download size={13} /> Download CSV template
                                </button>
                            </div>


                        </div>
                    )}
                </div>

                {/* Footer */}
                {tab === 'form' && (
                    <div className="px-7 py-5 border-t border-gray-100 dark:border-white/10 flex gap-3 shrink-0">
                        <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                            Cancel
                        </button>
                        <button onClick={handleAdd} disabled={isSubmitting} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-50">
                            {isSubmitting ? 'Adding...' : 'Add User'}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

// ─── User Detail Drawer ───────────────────────────────────────────────────────
const UserDetailDrawer = ({ user, open, onClose, onUpdate, onDelete, initialEditing = false, allProjects = [], templates = [] }) => {
    const [editing, setEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [localUser, setLocalUser] = useState(null);
    const [expanded, setExpanded] = useState({ projects: true, collaboration: true });

    const dynamicPageTree = getDynamicPageTree(allProjects);

    React.useEffect(() => {
        if (user) {
            // Map permissions to frontend integer format
            const basePerms = user.permissions || {};
            const mapped = {};
            const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };
            for (const [k, v] of Object.entries(basePerms)) {
                if (typeof v === 'string') {
                    mapped[k] = map[v.toLowerCase()] ?? 0;
                } else {
                    mapped[k] = v;
                }
            }
            // For each project, if it's assigned but not in system_permissions, default to 1 (Read)
            const assigned = user.assigned_projects || [];
            allProjects.forEach(proj => {
                const key = `project_${proj.id}`;
                if (mapped[key] === undefined) {
                    mapped[key] = assigned.includes(proj.id) ? 1 : 0;
                }
            });

            setLocalUser({
                ...user,
                permissions: mapped
            });
            setEditing(initialEditing);
        }
    }, [user, initialEditing, allProjects]);

    if (!user || !localUser) return null;

    const accessLevelColor = (lvl) => ['text-gray-400', 'text-blue-400', 'text-green-500'][lvl] || 'text-gray-400';
    const accessLevelBg = (lvl) => ['bg-gray-100 dark:bg-white/5', 'bg-blue-50 dark:bg-blue-900/20', 'bg-green-50 dark:bg-green-900/20'][lvl] || '';

    const setLevel = (key, lvl) =>
        setLocalUser(u => ({ ...u, permissions: { ...u.permissions, [key]: lvl } }));

    const PermRow = ({ id, label, indent = false }) => {
        const lvl = localUser.permissions?.[id] ?? 0;
        const isProjectNode = id.startsWith('project_');
        const levelsToUse = isProjectNode ? ['None', 'Access'] : ACCESS_LEVELS;
        return (
            <div className={`flex-1 flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] ${indent ? 'ml-6' : ''}`}>
                <div className="flex items-center gap-2.5">
                    {!indent && <Lock size={12} className="text-gray-400 shrink-0" />}
                    {indent && <span className="w-3 h-px bg-gray-300 dark:bg-white/20 inline-block mr-0.5" />}
                    <span className={`text-sm ${indent ? 'text-gray-500 dark:text-gray-400' : 'font-semibold text-gray-700 dark:text-gray-200'}`}>{label}</span>
                </div>
                {editing ? (
                    <div className="flex gap-1">
                        {levelsToUse.map((name, i) => {
                            const isActive = isProjectNode ? (i === 0 ? lvl === 0 : lvl > 0) : lvl === i;
                            return (
                                <button key={i} type="button" onClick={() => setLevel(id, isProjectNode ? (i === 0 ? 0 : 1) : i)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                        }`}>
                                    {name}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${isProjectNode ? (lvl > 0 ? accessLevelBg(1) : accessLevelBg(0)) : accessLevelBg(lvl)} ${isProjectNode ? (lvl > 0 ? accessLevelColor(1) : accessLevelColor(0)) : accessLevelColor(lvl)}`}>
                        {isProjectNode ? (lvl > 0 ? 'Access' : 'None') : ACCESS_LEVELS[lvl]}
                    </span>
                )}
            </div>
        );
    };

    const toggleGroup = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

    return (
        <>
            <div
                className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />
            <div className={`fixed top-0 right-0 h-full w-[560px] bg-white dark:bg-[#161b22] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 dark:border-white/10 shrink-0">
                    <div className="flex items-center gap-4">
                        <Avatar name={user.name} size={12} />
                        <div>
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">{user.name}</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setEditing(e => !e)}
                            className={`px-3 py-1.5 rounded-xl transition-all text-sm font-semibold flex items-center gap-1.5 ${editing ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                            <Edit3 size={14} /> {editing ? 'Editing…' : 'Edit'}
                        </button>
                        {onDelete && (
                            <button
                                onClick={() => onDelete(user)}
                                className="px-3 py-1.5 rounded-xl transition-all text-sm font-semibold flex items-center gap-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                title="Delete Employee"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
                    {/* Profile Info */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Role', value: user.role },
                            { label: 'Department', value: user.department },
                            { label: 'Status', value: user.status },
                            { label: 'Joined', value: user.joined },
                        ].map(({ label, value }) => (
                            <div key={label} className="p-4 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-100 dark:border-white/5">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
                                {label === 'Status' ? <StatusBadge status={value} /> :
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{value}</p>}
                            </div>
                        ))}
                    </div>

                    {/* Template Selector (only when editing) */}
                    {editing && (
                        <div className="p-4 bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-100 dark:border-white/5">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Permission Template</label>
                            <select 
                                value={localUser.role || 'Employee'}
                                onChange={e => {
                                    const val = e.target.value;
                                    const presetPerms = val !== 'Custom' ? getPresetPermissions(val) : localUser.permissions;
                                    setLocalUser(u => ({
                                        ...u,
                                        role: val,
                                        permissions: {
                                            ...u.permissions,
                                            ...presetPerms
                                        }
                                    }));
                                    toast.info(`Applied template: ${val}`);
                                }}
                                className="w-full px-4 py-2.5 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none appearance-none"
                            >
                                <option value="Admin">Admin</option>
                                <option value="Employee">Employee</option>
                                <option value="Client">Client</option>
                                <option value="Custom">Custom</option>
                            </select>
                        </div>
                    )}

                    {/* Permissions */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Shield size={14} className="text-blue-500" /> Page Permissions
                            </h3>
                            {editing && (
                                <span className="text-[10px] text-blue-500 font-semibold bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">Click levels to change</span>
                            )}
                        </div>

                        <div className="space-y-3">
                            {dynamicPageTree.map(section => (
                                <div key={section.id} className="bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                                    {/* Section header (parent page row) */}
                                    <div className="flex items-center w-full px-3 py-1">
                                        <PermRow id={section.id} label={section.label} />
                                        {section.children.length > 0 && (
                                            <button onClick={() => toggleGroup(section.id)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0">
                                                <ChevronDown size={14} className={`transition-transform ${expanded[section.id] ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}
                                    </div>
                                    {/* Sub-pages */}
                                    {section.children.length > 0 && expanded[section.id] && (
                                        <div className="border-t border-gray-100 dark:border-white/5 px-3 pb-2 pt-1 space-y-0.5">
                                            {section.children.map(child => (
                                                <PermRow key={child.id} id={child.id} label={child.label} indent />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                {editing && (
                    <div className="px-7 py-5 border-t border-gray-100 dark:border-white/10 flex gap-3 shrink-0">
                        <button onClick={async () => {
                                setIsSaving(true);
                                try {
                                    const selectedProjectIds = Object.keys(localUser.permissions)
                                        .filter(k => k.startsWith('project_') && localUser.permissions[k] > 0)
                                        .map(k => parseInt(k.replace('project_', '')));
 
                                    await onUpdate({
                                        ...localUser,
                                        project_ids: selectedProjectIds
                                    });
                                    setEditing(false);
                                } catch(e) {} finally { setIsSaving(false); }
                            }}
                            disabled={isSaving}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-50">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

// Helper to map backend user model to frontend model
const mapUserFromBackend = (u) => {
    const basePerms = u.system_permissions ? (typeof u.system_permissions === 'string' ? JSON.parse(u.system_permissions) : u.system_permissions) : defaultPermissions();
    const mappedPerms = {};
    const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };
    for (const [k, v] of Object.entries(basePerms || {})) {
        if (typeof v === 'string') {
            mappedPerms[k] = map[v.toLowerCase()] ?? 0;
        } else {
            mappedPerms[k] = v;
        }
    }
    const typeLabel = u.user_type ? u.user_type.charAt(0).toUpperCase() + u.user_type.slice(1).toLowerCase() : 'Employee';
    return {
        ...u,
        id: u.user_id || u.id,
        name: u.user_name || u.name,
        email: u.email || u.email_id,
        role: u.role || typeLabel,
        department: u.departmentName || u.department || '-',
        status: u.user_status || u.status || 'Active',
        joined: u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'}) : '-',
        permissions: mappedPerms
    };
};

// ─── Employee Filter Modal ───────────────────────────────────────────────────
const EmployeeFilterModal = ({ open, onClose, activeFilters, setActiveFilters, allRoles, allDepartments }) => {
    if (!open) return null;

    const toggleFilter = (type, value) => {
        setActiveFilters(prev => {
            const list = prev[type] || [];
            const updated = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
            return { ...prev, [type]: updated };
        });
    };

    const clearAll = () => {
        setActiveFilters({ roles: [], status: [], departments: [] });
    };

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 p-6 z-10 text-left">
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-white/10">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Filter Employees</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg">
                        <X size={18} />
                    </button>
                </div>

                <div className="py-4 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {/* Roles */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Role</p>
                        <div className="flex flex-wrap gap-2">
                            {allRoles.map(role => {
                                const isSel = activeFilters.roles.includes(role);
                                return (
                                    <button
                                        key={role}
                                        onClick={() => toggleFilter('roles', role)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                            isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        {role}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {['Active', 'Away', 'Offline'].map(status => {
                                const isSel = activeFilters.status.includes(status);
                                return (
                                    <button
                                        key={status}
                                        onClick={() => toggleFilter('status', status)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                            isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        {status}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Department */}
                    {allDepartments.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Department</p>
                            <div className="flex flex-wrap gap-2">
                                {allDepartments.map(dept => {
                                    if (!dept || dept === '-') return null;
                                    const isSel = activeFilters.departments.includes(dept);
                                    return (
                                        <button
                                            key={dept}
                                            onClick={() => toggleFilter('departments', dept)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                                isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            {dept}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-white/10">
                    <button onClick={clearAll} className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                        Reset All
                    </button>
                    <button onClick={onClose} className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md">
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Admin Page (Employees Management) ──────────────────────────────────
const AdminPage = () => {
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [systemTemplates, setSystemTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter & Search States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState({ roles: [], status: [], departments: [] });
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [drawerTab, setDrawerTab] = useState('form');

    const [addOpen, setAddOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsManageDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchUsers = async (force = false) => {
        const cacheKey = 'crm_employees_list';
        const cacheTimeKey = 'crm_employees_list_time';
        const CACHE_TTL = 50000; // 50 seconds

        if (force) {
            sessionStorage.removeItem(cacheKey);
            sessionStorage.removeItem(cacheTimeKey);
        }

        const cached = sessionStorage.getItem(cacheKey);
        const cachedTime = sessionStorage.getItem(cacheTimeKey);
        const now = Date.now();

        if (cached && cachedTime) {
            try {
                const parsed = JSON.parse(cached);
                setUsers(parsed);
                setIsLoading(false);
                if (now - parseInt(cachedTime) < CACHE_TTL) {
                    return;
                }
            } catch (e) {
                console.error("Failed to parse cached employees", e);
            }
        } else {
            setIsLoading(true);
        }

        try {
            const res = await adminApi.getUsers();
            if (res.success && res.users) {
                const mappedUsers = res.users.map(u => mapUserFromBackend(u));
                setUsers(mappedUsers);
                sessionStorage.setItem(cacheKey, JSON.stringify(mappedUsers));
                sessionStorage.setItem(cacheTimeKey, now.toString());
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch users');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            const [projRes, templRes] = await Promise.all([
                projectApi.listProjects(),
                adminApi.getPermissionTemplates('system')
            ]);
            if (projRes.success && projRes.projects) {
                setProjects(projRes.projects);
            }
            if (templRes.success && templRes.templates) {
                setSystemTemplates(templRes.templates);
            }
        } catch (err) {
            console.error('Failed to load projects/templates:', err);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchInitialData();
    }, []);

    const openView = async (user) => {
        setSelectedUser({
            ...user,
            assigned_projects: user.assigned_projects || []
        });
        setEditMode(false);
        try {
            const res = await adminApi.getUser(user.id);
            if (res.success && res.user) {
                const mapped = mapUserFromBackend(res.user);
                setSelectedUser({
                    ...mapped,
                    assigned_projects: res.user.assigned_projects || []
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const openEdit = async (user) => {
        setSelectedUser({
            ...user,
            assigned_projects: user.assigned_projects || []
        });
        setEditMode(true);
        try {
            const res = await adminApi.getUser(user.id);
            if (res.success && res.user) {
                const mapped = mapUserFromBackend(res.user);
                setSelectedUser({
                    ...mapped,
                    assigned_projects: res.user.assigned_projects || []
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const allRoles = Array.from(new Set(users.map(u => u.role).filter(Boolean)));
    if (allRoles.length === 0) allRoles.push('Viewer', 'Site Lead', 'Project Manager', 'Admin', 'Super Admin');

    const allDepartments = Array.from(new Set(users.map(u => u.department).filter(d => d && d !== '-')));

    const filtered = users.filter(u => {
        const matchSearch = !searchTerm || 
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.department.toLowerCase().includes(searchTerm.toLowerCase());

        const matchActiveRoles = activeFilters.roles.length === 0 || activeFilters.roles.includes(u.role);
        const matchActiveStatus = activeFilters.status.length === 0 || activeFilters.status.includes(u.status);
        const matchActiveDepts = activeFilters.departments.length === 0 || activeFilters.departments.includes(u.department);

        return matchSearch && matchActiveRoles && matchActiveStatus && matchActiveDepts;
    });

    const activeFilterCount = activeFilters.roles.length + activeFilters.status.length + activeFilters.departments.length;

    const handleAddUser = async (user) => {
        try {
            const backendPerms = {};
            const map = { 0: 'none', 1: 'view', 2: 'edit', 3: 'edit' };
            for (const [k, v] of Object.entries(user.permissions || {})) {
                if (typeof v === 'number') {
                    backendPerms[k] = map[v] || 'none';
                } else {
                    backendPerms[k] = v;
                }
            }

            await adminApi.createUser({
                name: user.name,
                email: user.email,
                password: user.password,
                role: user.role,
                department: user.department,
                status: user.status,
                system_permissions: backendPerms,
                project_ids: user.project_ids
            });
            toast.success('User created successfully');
            fetchUsers(true);
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Failed to create user';
            toast.error(msg);
            throw error;
        }
    };

    const handleUpdateUser = async (updated) => {
        try {
            const backendPerms = {};
            const map = { 0: 'none', 1: 'view', 2: 'edit', 3: 'edit' };
            for (const [k, v] of Object.entries(updated.permissions || {})) {
                if (typeof v === 'number') {
                    backendPerms[k] = map[v] || 'none';
                } else {
                    backendPerms[k] = v;
                }
            }

            await adminApi.updateUser(updated.id, {
                name: updated.name,
                email: updated.email,
                role: updated.role,
                department: updated.department,
                status: updated.status,
                system_permissions: backendPerms,
                project_ids: updated.project_ids
            });
            toast.success('User updated successfully');
            fetchUsers(true);
            setSelectedUser(updated);
        } catch (error) {
            console.error(error);
            toast.error('Failed to update user');
            throw error;
        }
    };

    const handleDeleteUser = async (e, user) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) return;
        try {
            await adminApi.deleteUser(user.id);
            toast.success('User deleted successfully');
            fetchUsers(true);
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete user');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 overflow-hidden font-sans">
            {/* Top Toolbar matching single search bar layout */}
            <div className="px-6 py-3.5 flex flex-col md:flex-row items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#0d1117] shrink-0 gap-3">
                <div className="flex-1" />

                <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                    <div className="relative w-64 md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                            type="text"
                            placeholder="Search employees by name, email, role..."
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setIsFilterModalOpen(true)}
                        className={`flex items-center space-x-2 px-6 py-2 border rounded-lg text-sm font-medium transition-all ${
                            activeFilterCount > 0
                                ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'border-blue-500 bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                        <span>Filter</span>
                        <Filter size={16} fill="currentColor" className={activeFilterCount > 0 ? '' : 'text-white'} />
                        {activeFilterCount > 0 && (
                            <span className="ml-1 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsManageDropdownOpen(!isManageDropdownOpen)}
                            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                        >
                            <span>Manage Employees</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isManageDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isManageDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#161b22] rounded-lg shadow-xl border border-gray-200 dark:border-white/10 z-[5000] anim-fade-in overflow-hidden">
                                <button
                                    onClick={() => { setDrawerTab('form'); setAddOpen(true); setIsManageDropdownOpen(false); }}
                                    className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <UserPlus size={16} className="mr-3 text-emerald-500" />
                                    Add Manual Employee
                                </button>
                                <button
                                    onClick={() => { setDrawerTab('bulk'); setAddOpen(true); setIsManageDropdownOpen(false); }}
                                    className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border-t border-gray-100 dark:border-white/5 transition-colors"
                                >
                                    <UploadCloud size={16} className="mr-3 text-blue-500" />
                                    Bulk Upload CSV
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Table Area matching Vendors & Clients standard */}
            <div className="flex-1 overflow-auto custom-scrollbar p-0">
                <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                    <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-widest text-[10px] uppercase font-bold">
                        <tr>
                            <th className="pl-2 pr-0.5 py-2.5 w-4"></th>
                            <th className="pl-0.5 pr-2 py-2.5 text-center">SR NO</th>
                            <th className="px-4 py-2.5">EMPLOYEE NAME</th>
                            <th className="px-4 py-2.5">ROLE</th>
                            <th className="px-4 py-2.5">DEPARTMENT</th>
                            <th className="px-4 py-2.5">EMAIL ID</th>
                            <th className="px-4 py-2.5">STATUS</th>
                            <th className="px-4 py-2.5">JOINED DATE</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-[#0d1117]">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 8 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-3 bg-gray-100 dark:bg-white/5 rounded"></div>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : filtered.length > 0 ? (
                            filtered.map((user, idx) => (
                                <tr
                                    key={user.id}
                                    className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 relative cursor-pointer"
                                    onMouseEnter={() => setHoveredRow(idx)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                    onClick={() => openView(user)}
                                >
                                    <td className="pl-2 pr-0.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                                        <GripVertical size={14} className="text-transparent group-hover/row:text-gray-400 dark:group-hover/row:text-gray-500 hover:!text-blue-500 transition-colors mx-auto cursor-grab active:cursor-grabbing" />
                                    </td>
                                    <td className="pl-0.5 pr-2 py-1.5 text-center font-mono text-gray-400">{idx + 1}</td>
                                    <td className="px-4 py-1.5 font-medium text-gray-900 dark:text-gray-100">
                                        <div className="flex items-center gap-3">
                                            <Avatar name={user.name} size={8} />
                                            <span className="font-semibold">{user.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-1.5">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold">
                                            <Shield size={12} /> {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-1.5">{user.department}</td>
                                    <td className="px-4 py-1.5 text-gray-700 dark:text-gray-300">{user.email}</td>
                                    <td className="px-4 py-1.5">
                                        <StatusBadge status={user.status} />
                                    </td>
                                    <td className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400">{user.joined}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="8" className="py-12 text-center text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                            <Users className="text-gray-400" size={24} />
                                        </div>
                                        <p className="text-sm font-semibold mb-1">No employees found</p>
                                        <p className="text-xs text-gray-400">Try adjusting your filters or search terms</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer matching Vendors & Clients standard */}
            <div className="px-6 py-3.5 border-t border-gray-200 dark:border-white/5 flex justify-between items-center text-xs text-gray-400 shrink-0 bg-white dark:bg-[#0d1117]">
                <p>Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{filtered.length}</span> of <span className="font-semibold text-gray-700 dark:text-gray-300">{users.length}</span> employees</p>
                <div className="flex gap-2">
                    <button className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg opacity-40 cursor-not-allowed">Previous</button>
                    <button className="px-3 py-1.5 border border-blue-500/30 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold">1</button>
                    <button className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all">Next</button>
                </div>
            </div>

            {/* Filter Modal */}
            <EmployeeFilterModal
                open={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                allRoles={allRoles}
                allDepartments={allDepartments}
            />

            {/* Drawers */}
            <AddUserDrawer open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddUser} allProjects={projects} templates={systemTemplates} initialTab={drawerTab} />
            <UserDetailDrawer
                user={selectedUser}
                open={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                onUpdate={handleUpdateUser}
                onDelete={(u) => {
                    setSelectedUser(null);
                    handleDeleteUser({ stopPropagation: () => {} }, u);
                }}
                initialEditing={editMode}
                allProjects={projects}
                templates={systemTemplates}
            />
        </div>
    );
};

export default AdminPage;

