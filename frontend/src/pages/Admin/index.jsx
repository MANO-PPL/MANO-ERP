import React, { useState } from 'react';
import {
    UserPlus, Search, MoreHorizontal, Filter, Download,
    Mail, Shield, Calendar, X, Upload, FileText,
    CheckCircle2, AlertCircle, FileCode, Check, Lock,
    ChevronRight, Eye, Edit3, Trash2, Info, Users,
    LayoutDashboard, Briefcase, Map, MessageSquare, Settings, ChevronDown
} from 'lucide-react';

// ─── Full App Page Tree ───────────────────────────────────────────────────────
const PAGE_TREE = [
    {
        id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard,
        children: []
    },
    {
        id: 'projects', label: 'Projects', icon: Briefcase,
        children: [
            { id: 'projects.dashboard', label: 'Project Dashboard' },
            { id: 'projects.tasks', label: 'Tasks' },
            { id: 'projects.wip', label: 'WIP' },
            { id: 'projects.reports', label: 'Reports' },
            { id: 'projects.reports.daily', label: '↳  Daily Progress' },
            { id: 'projects.reports.weekly', label: '↳  Weekly Summary' },
            { id: 'projects.reports.monthly', label: '↳  Monthly Archive' },
            { id: 'projects.reports.team', label: '↳  Team Contribution' },
            { id: 'projects.documents', label: 'General Documents' },
            { id: 'projects.drawings', label: 'Drawings' },
            { id: 'projects.planning', label: 'Planning' },
            { id: 'projects.contracts', label: 'Contracts' },
            { id: 'projects.quality', label: 'Quality' },
            { id: 'projects.safety', label: 'Safety' },
            { id: 'projects.billing', label: 'Billing' },
            { id: 'projects.materials', label: 'Material Management' },
            { id: 'projects.approvals', label: 'Approvals' },
        ]
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

const ACCESS_LEVELS = ['None', 'Read', 'Write', 'Full'];

const defaultPermissions = () => {
    const p = {};
    ALL_PERM_KEYS.forEach(k => { p[k] = 0; });
    return p;
};

const INITIAL_USERS = [
    { id: 1, name: 'Madhavan S', email: 'madhavan@mano.co.in', role: 'Super Admin', department: 'Engineering', status: 'Active', joined: 'Jan 15, 2026', permissions: { ...defaultPermissions(), dashboard: 3, projects: 3, 'projects.dashboard': 3, 'projects.tasks': 3, 'projects.wip': 3, 'projects.reports': 3, 'projects.reports.daily': 3, 'projects.reports.weekly': 3, 'projects.reports.monthly': 3, 'projects.reports.team': 3, 'projects.documents': 3, 'projects.drawings': 3, 'projects.planning': 3, 'projects.contracts': 3, 'projects.quality': 3, 'projects.safety': 3, 'projects.billing': 3, 'projects.materials': 3, vendors: 3, clients: 3, 'collaboration': 3, 'collaboration.chat': 3, 'collaboration.calendar': 3, admin: 3 } },
    { id: 2, name: 'Sathish Kumar', email: 'sathish@mano.co.in', role: 'Project Manager', department: 'Operations', status: 'Active', joined: 'Feb 10, 2026', permissions: { ...defaultPermissions(), dashboard: 2, projects: 3, 'projects.dashboard': 2, 'projects.tasks': 3, 'projects.wip': 3, 'projects.reports': 3, 'projects.reports.daily': 3, 'projects.reports.weekly': 2, 'projects.reports.monthly': 2, 'projects.reports.team': 3, 'projects.documents': 2, 'projects.drawings': 1, 'projects.planning': 2, 'projects.contracts': 1, 'projects.quality': 2, 'projects.safety': 2, 'projects.billing': 1, 'projects.materials': 2, vendors: 1, clients: 1, 'collaboration': 2, 'collaboration.chat': 3, 'collaboration.calendar': 2, admin: 0 } },
    { id: 3, name: 'Mano Kakoos', email: 'mano@mano.co.in', role: 'Site Lead', department: 'Operations', status: 'Away', joined: 'Dec 05, 2025', permissions: { ...defaultPermissions(), dashboard: 1, projects: 2, 'projects.tasks': 2, 'projects.wip': 2, 'projects.reports': 1, 'projects.reports.daily': 2, 'projects.safety': 3, 'projects.quality': 2, 'collaboration': 2, 'collaboration.chat': 2 } },
    { id: 4, name: 'Harish R', email: 'harish@mano.co.in', role: 'Viewer', department: 'Design', status: 'Offline', joined: 'Jan 20, 2026', permissions: { ...defaultPermissions(), dashboard: 1, projects: 1, 'projects.dashboard': 1, 'projects.drawings': 1, 'collaboration': 1, 'collaboration.calendar': 1 } },
    { id: 5, name: 'Admin User', email: 'admin@mano.co.in', role: 'Admin', department: 'IT', status: 'Active', joined: 'Nov 12, 2025', permissions: { ...defaultPermissions(), dashboard: 3, projects: 3, 'projects.dashboard': 3, 'projects.tasks': 3, 'projects.wip': 3, 'projects.reports': 3, 'projects.reports.daily': 3, 'projects.reports.weekly': 3, 'projects.reports.monthly': 3, 'projects.reports.team': 3, 'projects.documents': 3, 'projects.drawings': 3, 'projects.planning': 3, 'projects.contracts': 3, 'projects.quality': 3, 'projects.safety': 3, 'projects.billing': 3, 'projects.materials': 3, vendors: 3, clients: 3, 'collaboration': 3, 'collaboration.chat': 3, 'collaboration.calendar': 3, admin: 2 } },
];

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
const AddUserDrawer = ({ open, onClose, onAdd }) => {
    const [tab, setTab] = useState('form');
    const [form, setForm] = useState({ name: '', email: '', role: 'Viewer', department: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [permissions, setPermissions] = useState(() => defaultPermissions());
    const [permExpanded, setPermExpanded] = useState({ projects: false, collaboration: false });
    const [showPerms, setShowPerms] = useState(false);

    const handleDrag = (e) => { e.preventDefault(); setDragging(e.type === 'dragenter' || e.type === 'dragover'); };
    const handleDrop = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); };

    const handleAdd = () => {
        if (!form.name || !form.email) return;
        onAdd({ ...form, id: Date.now(), status: 'Active', joined: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), permissions });
        setForm({ name: '', email: '', role: 'Viewer', department: '', password: '' });
        setPermissions(defaultPermissions());
        setShowPerms(false);
        onClose();
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
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Role</label>
                                    <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none appearance-none">
                                        {['Viewer', 'Site Lead', 'Project Manager', 'Admin', 'Super Admin'].map(r => <option key={r}>{r}</option>)}
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
                                    <input type={showPw ? 'text' : 'password'} placeholder="Set initial password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
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
                                        {PAGE_TREE.map(section => {
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
                                                                return (
                                                                    <div key={child.id} className="flex items-center justify-between ml-4 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                                                                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">{child.label}</span>
                                                                        <div className="flex gap-1 shrink-0">
                                                                            {ACCESS_LEVELS.map((name, i) => (
                                                                                <button key={i}
                                                                                    onClick={() => setPermissions(p => ({ ...p, [child.id]: i }))}
                                                                                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${cLvl === i ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                                                                                    {name}
                                                                                </button>
                                                                            ))}
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
                        <button onClick={handleAdd} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                            Add User
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

// ─── User Detail Drawer ───────────────────────────────────────────────────────
const UserDetailDrawer = ({ user, open, onClose, onUpdate, initialEditing = false }) => {
    const [editing, setEditing] = useState(false);
    const [localUser, setLocalUser] = useState(null);
    const [expanded, setExpanded] = useState({ projects: true, collaboration: true });

    React.useEffect(() => { if (user) { setLocalUser(user); setEditing(initialEditing); } }, [user, initialEditing]);

    if (!user || !localUser) return null;

    const accessLevelColor = (lvl) => ['text-gray-400', 'text-blue-400', 'text-indigo-400', 'text-green-500'][lvl] || 'text-gray-400';
    const accessLevelBg = (lvl) => ['bg-gray-100 dark:bg-white/5', 'bg-blue-50 dark:bg-blue-900/20', 'bg-indigo-50 dark:bg-indigo-900/20', 'bg-green-50 dark:bg-green-900/20'][lvl] || '';

    const setLevel = (key, lvl) =>
        setLocalUser(u => ({ ...u, permissions: { ...u.permissions, [key]: lvl } }));

    const PermRow = ({ id, label, indent = false }) => {
        const lvl = localUser.permissions?.[id] ?? 0;
        return (
            <div className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] ${indent ? 'ml-6' : ''}`}>
                <div className="flex items-center gap-2.5">
                    {!indent && <Lock size={12} className="text-gray-400 shrink-0" />}
                    {indent && <span className="w-3 h-px bg-gray-300 dark:bg-white/20 inline-block mr-0.5" />}
                    <span className={`text-sm ${indent ? 'text-gray-500 dark:text-gray-400' : 'font-semibold text-gray-700 dark:text-gray-200'}`}>{label}</span>
                </div>
                {editing ? (
                    <div className="flex gap-1">
                        {ACCESS_LEVELS.map((name, i) => (
                            <button key={i} onClick={() => setLevel(id, i)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${lvl === i ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                    }`}>
                                {name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${accessLevelBg(lvl)} ${accessLevelColor(lvl)}`}>
                        {ACCESS_LEVELS[lvl]}
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
                            {PAGE_TREE.map(section => (
                                <div key={section.id} className="bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                                    {/* Section header (parent page row) */}
                                    <div className="flex items-center justify-between px-3 py-1">
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
                        <button onClick={() => { setLocalUser(user); setEditing(false); }}
                            className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                            Discard
                        </button>
                        <button onClick={() => { onUpdate(localUser); setEditing(false); }}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                            Save Changes
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

// ─── Main Admin Page ──────────────────────────────────────────────────────────
const AdminPage = () => {
    const [users, setUsers] = useState(INITIAL_USERS);
    const [search, setSearch] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editMode, setEditMode] = useState(false);

    const openView = (user) => { setSelectedUser(user); setEditMode(false); };
    const openEdit = (user) => { setSelectedUser(user); setEditMode(true); };

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    );

    const handleAddUser = (user) => setUsers(u => [...u, user]);
    const handleUpdateUser = (updated) => setUsers(u => u.map(x => x.id === updated.id ? updated : x));

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 overflow-hidden">
            {/* Header + Toolbar (single row) */}
            <div className="flex-shrink-0 px-8 py-4 flex items-center gap-3">
                <div className="flex-1" />
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, email, or role..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                    <Filter size={15} /> Filter
                </button>
                <button onClick={() => setAddOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-500/20 active:scale-95">
                    <UserPlus size={16} /> Add New User
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-white/10">
                                {['User', 'Role', 'Department', 'Status', 'Joined', 'Actions'].map((h, i) => (
                                    <th key={h} className={`px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${i === 5 ? 'text-right' : ''}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {filtered.map(user => (
                                <tr key={user.id}
                                    onClick={() => openView(user)}
                                    className="hover:bg-blue-50/20 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <Avatar name={user.name} />
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{user.name}</p>
                                                <div className="flex items-center mt-1 text-xs text-gray-400">
                                                    <Mail size={11} className="mr-1.5 opacity-70" />{user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-50/50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg w-fit border border-blue-100/50 dark:border-blue-500/20">
                                            <Shield size={13} /><span className="text-xs font-semibold">{user.role}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{user.department}</span>
                                    </td>
                                    <td className="px-6 py-5"><StatusBadge status={user.status} /></td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            <Calendar size={13} className="mr-2 opacity-50" />{user.joined}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={e => { e.stopPropagation(); openEdit(user); }}
                                                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all active:scale-90"
                                                title="Edit user">
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); setUsers(u => u.filter(x => x.id !== user.id)); }}
                                                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all active:scale-90"
                                                title="Delete user">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filtered.length === 0 && (
                        <div className="py-16 text-center">
                            <Users size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-sm text-gray-400">No users found matching your search.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="mt-5 flex justify-between items-center text-xs text-gray-400 px-1">
                    <p>Showing {filtered.length} of {users.length} users</p>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg opacity-40 cursor-not-allowed">Previous</button>
                        <button className="px-3 py-1.5 border border-blue-500/30 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold">1</button>
                        <button className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all">Next</button>
                    </div>
                </div>
            </div>

            {/* Drawers */}
            <AddUserDrawer open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddUser} />
            <UserDetailDrawer user={selectedUser} open={!!selectedUser} onClose={() => setSelectedUser(null)} onUpdate={handleUpdateUser} initialEditing={editMode} />

        </div>
    );
};

export default AdminPage;
