import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    UserPlus, Search, MoreHorizontal, Filter, Download,
    Mail, Shield, Calendar, X, Upload, FileText,
    CheckCircle2, AlertCircle, FileCode, Check, Lock,
    ChevronRight, Eye, Edit3, Trash2, Info, Users,
    LayoutDashboard, Briefcase, Map, MessageSquare, Settings, ChevronDown, Loader2,
    Package, ArrowLeftRight, GripVertical, UploadCloud, Sparkles, Layers,
    Plus, Sliders, FolderKey, Copy, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'react-toastify';
import { adminApi } from '../../services/adminApi';
import { projectApi } from '../../services/projectApi';
import { ExcelGrid } from '../../components/ExcelGrid';
import { useAuth } from '../../context/AuthContext';

// ─── Base Page Tree Structure (System Modules) ─────────────────────────────
const BASE_PAGE_TREE = [
    { id: 'projects', label: 'Projects', icon: Briefcase, children: [] },
    { id: 'vendors', label: 'Vendors', icon: Map, children: [] },
    { id: 'clients', label: 'Clients', icon: Users, children: [] },
    { id: 'resources', label: 'Resources', icon: Package, children: [] },
    { id: 'spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet, children: [] },
    { id: 'units', label: 'Units', icon: ArrowLeftRight, children: [] },
    {
        id: 'collaboration', label: 'Collaboration', icon: MessageSquare,
        children: [
            { id: 'collaboration.chat', label: 'Chat' },
            { id: 'collaboration.calendar', label: 'Calendar' },
        ]
    },
    { id: 'admin', label: 'Admin Panel', icon: Shield, children: [] },
];

const ACCESS_LEVELS = ['None', 'Read', 'Write'];

const PROJECT_MODULES_LIST = [
    { id: 'Tasks', label: 'Tasks' },
    { id: 'WIP', label: 'Work In Progress (WIP)' },
    { id: 'Reports', label: 'Reports & Analytics' },
    { id: 'General Documents', label: 'General Documents' },
    { id: 'Spreadsheets', label: 'Project Spreadsheets' },
    { id: 'Drawings', label: 'Drawings & Blueprints' },
    { id: 'Planning', label: 'Project Planning' },
    { id: 'Phases', label: 'Phases & Milestones' },
    { id: 'Contracts', label: 'Contracts & Agreements' },
    { id: 'Quality', label: 'Quality Control' },
    { id: 'Safety', label: 'Safety & Compliance' },
    { id: 'Billing', label: 'Billing & Invoicing' },
    { id: 'Material Management', label: 'Material Management' },
    { id: 'Transactions', label: 'Transactions & Ledger' },
    { id: 'Approvals', label: 'Workflow Approvals' }
];

const getDynamicPageTree = (projectsList) => {
    return BASE_PAGE_TREE.map(node => {
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

const defaultPermissions = () => {
    const p = {};
    BASE_PAGE_TREE.forEach(node => {
        p[node.id] = 0;
        (node.children || []).forEach(c => { p[c.id] = 0; });
    });
    return p;
};

// ─── Delete Employee Confirmation Modal ───────────────────────────────────────
const DeleteConfirmationModal = ({ open, onClose, onConfirm, user, isDeleting }) => {
    if (!open || !user) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-md flex items-center justify-center mx-auto border border-red-200/50 dark:border-red-500/30 shadow-xs">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Employee Account?</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                            Are you sure you want to permanently delete <span className="font-bold text-gray-900 dark:text-white">{user.name}</span> ({user.email})? This action will remove all platform access and project memberships immediately.
                        </p>
                    </div>
                    <div className="p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-500/20 rounded-md text-[11px] text-red-600 dark:text-red-400 font-semibold flex items-center justify-center gap-1.5">
                        <AlertCircle size={14} className="shrink-0" /> This action cannot be undone.
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 dark:bg-[#0d1117] border-t border-gray-100 dark:border-white/10 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-md text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold transition-all shadow-md shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" /> Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 size={14} /> Delete Employee
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Delete Template Confirmation Modal ────────────────────────────────────────
const DeleteTemplateModal = ({ open, onClose, onConfirm, template, isDeleting }) => {
    if (!open || !template) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-md flex items-center justify-center mx-auto border border-amber-200/50 dark:border-amber-500/30 shadow-xs">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Permission Template?</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                            Are you sure you want to delete template <span className="font-bold text-gray-900 dark:text-white">"{template.name}"</span>?
                        </p>
                    </div>
                    <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-500/20 rounded-md text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-center gap-1.5">
                        <Info size={14} className="shrink-0" /> Existing users using this template will retain their current permissions.
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 dark:bg-[#0d1117] border-t border-gray-100 dark:border-white/10 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-md text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold transition-all shadow-md shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
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

// ─── Template Editor Drawer (Right Sidebar Popup for Create / Edit Permission Template) ───
const TemplateEditorDrawer = ({ open, onClose, onSave, templateToEdit, isSaving }) => {
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState({});

    useEffect(() => {
        if (templateToEdit) {
            setName(templateToEdit.name || '');
            const perms = templateToEdit.permissions || {};
            setPermissions(typeof perms === 'string' ? JSON.parse(perms) : { ...perms });
        } else {
            setName('');
            const initPerms = {};
            BASE_PAGE_TREE.forEach(node => {
                initPerms[node.id] = 2;
                (node.children || []).forEach(c => { initPerms[c.id] = 2; });
            });
            setPermissions(initPerms);
        }
    }, [templateToEdit, open]);

    const handlePreset = (level) => {
        const updated = {};
        BASE_PAGE_TREE.forEach(node => {
            updated[node.id] = level;
            (node.children || []).forEach(c => { updated[c.id] = level; });
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
            type: 'system',
            permissions
        });
    };

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[4000]" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-[#161b22] shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-[#0d1117]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/50 dark:border-blue-500/20 shadow-xs">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                                {templateToEdit ? 'Edit Permission Template' : 'Create Permission Template'}
                            </h2>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Configure system navigation access levels reusable across employee accounts
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                    {/* Template Name & Scope Indicator */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Template Name *</label>
                            <input
                                type="text"
                                placeholder="e.g. Senior Site Engineer"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-3.5 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                required
                            />
                        </div>

                        <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-500/20 rounded-md flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-blue-600 dark:text-blue-400" />
                                <span className="text-xs font-bold text-blue-900 dark:text-blue-300">System Level Permission Template</span>
                            </div>
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-md">
                                System Scope
                            </span>
                        </div>
                    </div>

                    {/* Presets Toolbar */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0d1117] rounded-md border border-gray-200 dark:border-white/10 text-xs">
                        <span className="font-bold text-gray-700 dark:text-gray-300">Quick Presets:</span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => handlePreset(2)}
                                className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-md text-[11px] font-bold border border-emerald-200/50 dark:border-emerald-500/30 hover:bg-emerald-100 transition-all"
                            >
                                Grant All Write
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePreset(1)}
                                className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md text-[11px] font-bold border border-blue-200/50 dark:border-blue-500/30 hover:bg-blue-100 transition-all"
                            >
                                Grant All Read
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePreset(0)}
                                className="px-2.5 py-1 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 rounded-md text-[11px] font-bold hover:bg-gray-200 transition-all"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>

                    {/* Module Matrix */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Sliders size={14} className="text-blue-500" /> Platform Navigation Access Levels
                        </h4>

                        <div className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
                            {BASE_PAGE_TREE.map(section => {
                                const lvl = permissions[section.id] ?? 0;
                                return (
                                    <div key={section.id} className="py-2 px-2 hover:bg-gray-50 dark:hover:bg-white/[0.02] rounded-md flex items-center justify-between transition-colors">
                                        <div className="flex items-center gap-2.5 min-w-0 mr-3">
                                            <section.icon size={15} className="text-blue-500 shrink-0" />
                                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{section.label}</span>
                                        </div>
                                        <div className="flex gap-1 shrink-0 ml-auto">
                                            {ACCESS_LEVELS.map((name, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setPermissions(p => ({ ...p, [section.id]: i }))}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                                        lvl === i
                                                            ? i === 2 ? 'bg-emerald-600 text-white shadow-xs' : i === 1 ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-600 text-white'
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

                    {/* Submit Buttons Footer */}
                    <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-md text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" /> Saving...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} /> {templateToEdit ? 'Save Changes' : 'Create Template'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

// ─── Custom Dark-Theme Select Dropdown Component ─────────────────────────────
const CustomSelect = ({ value, options, onChange, placeholder = 'Select option', className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => String(o.value) === String(value));

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3.5 py-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md text-xs font-semibold text-gray-900 dark:text-white flex items-center justify-between shadow-xs hover:border-blue-500/50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown size={14} className={`text-gray-400 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-md shadow-xl z-[5000] py-1 max-h-52 overflow-y-auto custom-scrollbar animate-in fade-in-50 duration-150">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                                String(opt.value) === String(value)
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}
                        >
                            <span className="truncate">{opt.label}</span>
                            {String(opt.value) === String(value) && <Check size={13} className="text-blue-500 shrink-0 ml-2" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Visual Template Selector for Assigning Permissions to Employee ──────────
const VisualTemplateSelector = ({ templates = [], onSelectTemplate }) => {
    const [selectedId, setSelectedId] = useState('');
    const [viewMode, setViewMode] = useState('dropdown'); // 'cards' or 'dropdown'

    const getModuleBadges = (template) => {
        const perms = template.permissions || template.system_permissions || {};
        const parsed = typeof perms === 'string' ? JSON.parse(perms) : perms;
        const keys = Object.keys(parsed || {});
        return keys.slice(0, 6).map(k => {
            let lvl = parsed[k] ?? 0;
            if (typeof lvl === 'string') {
                const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };
                lvl = map[lvl.toLowerCase()] ?? 0;
            }
            return { label: k, level: lvl };
        });
    };

    return (
        <div className="p-3.5 rounded-md bg-blue-50/40 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-500/20 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Shield size={15} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">Permission Templates</span>
                </div>
                <div className="flex bg-gray-200/60 dark:bg-white/10 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                        type="button"
                        onClick={() => setViewMode('cards')}
                        className={`px-2 py-0.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-[#161b22] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        Cards View
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('dropdown')}
                        className={`px-2 py-0.5 rounded-md transition-all ${viewMode === 'dropdown' ? 'bg-white dark:bg-[#161b22] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        Dropdown
                    </button>
                </div>
            </div>

            {viewMode === 'dropdown' ? (
                <CustomSelect
                    value={selectedId}
                    options={templates.map(t => ({
                        value: t.id,
                        label: `${t.name} (${t.type === 'project' ? 'Project' : 'System'})`
                    }))}
                    onChange={val => {
                        setSelectedId(val);
                        const tpl = templates.find(t => String(t.id) === String(val));
                        if (tpl) onSelectTemplate(tpl);
                    }}
                    placeholder="-- Select Template to Apply --"
                />
            ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {templates.map(t => {
                        const badges = getModuleBadges(t);
                        const isSelected = String(selectedId) === String(t.id);
                        return (
                            <div
                                key={t.id}
                                onClick={() => {
                                    setSelectedId(t.id);
                                    onSelectTemplate(t);
                                }}
                                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                        ? 'border-blue-500 bg-white dark:bg-[#161b22] shadow-xs ring-1 ring-blue-500/30'
                                        : 'border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-[#161b22]/70 hover:border-blue-300 dark:hover:border-blue-500/40 hover:bg-white'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                            {t.name}
                                        </h4>
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${t.type === 'project' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                            {t.type === 'project' ? 'Project' : 'System'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                            isSelected
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white'
                                        }`}
                                    >
                                        {isSelected ? 'Applied' : 'Apply'}
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {badges.map(b => (
                                        <span
                                            key={b.label}
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                b.level === 2
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-500/20'
                                                    : b.level === 1
                                                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/40 dark:border-blue-500/20'
                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                                            }`}
                                        >
                                            {b.label}: {b.level === 2 ? 'Write' : b.level === 1 ? 'Read' : 'None'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const cfg = {
        Active: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20' },
        Away: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20' },
        Offline: { dot: 'bg-gray-400', bg: 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10' },
    }[status] || { dot: 'bg-gray-400', bg: 'bg-gray-100 text-gray-500' };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cfg.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dot}`} /> {status}
        </span>
    );
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ name }) => {
    const safeName = name || 'Employee';
    const initials = safeName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white dark:ring-[#161b22]">
            {initials}
        </div>
    );
};

// ─── Add User Drawer ──────────────────────────────────────────────────────────
const AddUserDrawer = ({ open, onClose, onAdd, onBulkUpload, allProjects = [], backendTemplates = [], initialTab = 'form' }) => {
    const [tab, setTab] = useState(initialTab);
    const [userType, setUserType] = useState('employee');
    const [form, setForm] = useState({ name: '', email: '', department: '', password: '', phone_no: '' });
    const [showPw, setShowPw] = useState(false);
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);

    const [permissions, setPermissions] = useState(() => defaultPermissions());
    const [permExpanded, setPermExpanded] = useState({ projects: true, collaboration: false });
    const [showPerms, setShowPerms] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const dynamicPageTree = getDynamicPageTree(allProjects);

    useEffect(() => {
        setTab(initialTab);
    }, [initialTab]);

    const handleApplyTemplate = (tpl) => {
        const sysPerms = tpl.system_permissions || tpl.permissions || {};
        const parsed = typeof sysPerms === 'string' ? JSON.parse(sysPerms) : sysPerms;
        const newPerms = defaultPermissions();
        const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };

        for (const [k, v] of Object.entries(parsed)) {
            const num = typeof v === 'string' ? (map[v.toLowerCase()] ?? 0) : Number(v);
            newPerms[k] = num;
        }
        setPermissions(newPerms);
        toast.info(`Applied template: "${tpl.name}"`);
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.password) {
            toast.error('Please fill in Name, Email, and Password');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedProjIds = [];
            const projPerms = {};
            for (const [k, v] of Object.entries(permissions)) {
                if (k.startsWith('project_') && v > 0) {
                    const pid = parseInt(k.replace('project_', ''), 10);
                    if (!isNaN(pid)) selectedProjIds.push(pid);
                }
            }

            await onAdd({
                name: form.name,
                email: form.email,
                department: form.department,
                phone_no: form.phone_no,
                password: form.password,
                user_type: userType,
                system_permissions: permissions,
                project_ids: selectedProjIds,
                project_permissions: projPerms
            });

            setForm({ name: '', email: '', department: '', password: '', phone_no: '' });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkSubmit = async () => {
        if (!file) {
            toast.error('Please select a file to upload');
            return;
        }
        setIsSubmitting(true);
        try {
            await onBulkUpload(file);
            setFile(null);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[4000]" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-[#161b22] shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-[#0d1117]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/50 dark:border-blue-500/20 shadow-xs">
                            <UserPlus size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Add New Employee Account</h2>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Set profile details, user type, and module access</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-white/10 px-6 shrink-0 bg-white dark:bg-[#161b22]">
                    <button
                        onClick={() => setTab('form')}
                        className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${tab === 'form' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <UserPlus size={14} /> Single Account Form
                    </button>
                    <button
                        onClick={() => setTab('bulk')}
                        className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${tab === 'bulk' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <UploadCloud size={14} /> Bulk Upload CSV
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {tab === 'form' ? (
                        <div className="space-y-4">
                            {/* Account Type */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Account Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setUserType('employee')}
                                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${userType === 'employee' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}
                                    >
                                        <Users size={15} /> Employee
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUserType('admin')}
                                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${userType === 'admin' ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/30' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}
                                    >
                                        <Shield size={15} /> Admin
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Full Name *</label>
                                <input type="text" placeholder="e.g. John Doe" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-medium" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Email Address *</label>
                                <input type="email" placeholder="e.g. john@company.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-medium" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Department</label>
                                    <input type="text" placeholder="e.g. Engineering" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Mobile Number</label>
                                    <input type="text" placeholder="+91 9876543210" value={form.phone_no} onChange={e => setForm(p => ({ ...p, phone_no: e.target.value }))}
                                        className="w-full px-3.5 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-medium" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Password *</label>
                                <div className="relative">
                                    <input type={showPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Set initial password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                        className="w-full px-3.5 py-2 pr-10 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-medium" />
                                    <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        <Eye size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* VISUAL PERMISSION TEMPLATE SELECTOR */}
                            {userType === 'employee' && backendTemplates.length > 0 && (
                                <VisualTemplateSelector
                                    templates={backendTemplates}
                                    onSelectTemplate={handleApplyTemplate}
                                />
                            )}

                            {/* Assign Page Permissions Tree */}
                            {userType === 'employee' && (
                                <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden bg-white dark:bg-[#0d1117]">
                                    <button
                                        type="button"
                                        onClick={() => setShowPerms(p => !p)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#161b22] hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                                    >
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200">
                                            <Shield size={14} className="text-blue-500" /> Assign Page & Project Access
                                        </div>
                                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${showPerms ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showPerms && (
                                        <div className="px-3 pb-3 pt-2 divide-y divide-gray-100/60 dark:divide-white/[0.04] border-t border-gray-100 dark:border-white/5">
                                            {dynamicPageTree.map(section => {
                                                const lvl = permissions[section.id] ?? 0;
                                                return (
                                                    <div key={section.id} className="py-2 px-1">
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="flex items-center gap-2.5 min-w-0 mr-3">
                                                                <Lock size={12} className="text-gray-400 shrink-0" />
                                                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{section.label}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0 ml-auto">
                                                                <div className="flex gap-1.5">
                                                                    {ACCESS_LEVELS.map((name, i) => (
                                                                        <button
                                                                            key={i}
                                                                            type="button"
                                                                            onClick={() => setPermissions(p => ({ ...p, [section.id]: i }))}
                                                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${lvl === i ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200'}`}
                                                                        >
                                                                            {name}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                {section.children.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPermExpanded(e => ({ ...e, [section.id]: !e[section.id] }))}
                                                                        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                                                    >
                                                                        <ChevronDown size={14} className={`transition-transform ${permExpanded[section.id] ? 'rotate-180' : ''}`} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {section.children.length > 0 && permExpanded[section.id] && (
                                                            <div className="pl-3 py-1.5 space-y-1 border-l-2 border-gray-100 dark:border-white/5 ml-3 mt-1.5">
                                                                {section.children.map(child => {
                                                                    const cLvl = permissions[child.id] ?? 0;
                                                                    const isProjectNode = child.id.startsWith('project_');
                                                                    const levelsToUse = isProjectNode ? ['None', 'Access'] : ACCESS_LEVELS;
                                                                    return (
                                                                        <div key={child.id} className="flex items-center justify-between py-1 px-1 rounded-lg hover:bg-gray-100/50 dark:hover:bg-white/[0.03]">
                                                                            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate mr-2">{child.label}</span>
                                                                            <div className="flex gap-1 shrink-0 ml-auto">
                                                                                {levelsToUse.map((name, i) => {
                                                                                    const isActive = isProjectNode ? (i === 0 ? cLvl === 0 : cLvl > 0) : cLvl === i;
                                                                                    return (
                                                                                        <button
                                                                                            key={i}
                                                                                            type="button"
                                                                                            onClick={() => setPermissions(p => ({ ...p, [child.id]: isProjectNode ? (i === 0 ? 0 : 1) : i }))}
                                                                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200'}`}
                                                                                        >
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
                            )}
                        </div>
                    ) : (
                        /* Bulk Upload Tab */
                        <div className="space-y-5">
                            <div
                                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); }}
                                className={`p-8 border-2 border-dashed rounded-2xl text-center transition-all ${dragging ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#0d1117]'}`}
                            >
                                <UploadCloud size={36} className="mx-auto text-blue-500 mb-3" />
                                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Drag and drop CSV/Excel file</h4>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Supports .csv, .xlsx formats with employee name, email, department columns</p>
                                <label className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition-all">
                                    Browse File
                                    <input type="file" accept=".csv,.xlsx" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} className="hidden" />
                                </label>
                                {file && (
                                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200/50 dark:border-blue-500/30 flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
                                        <div className="flex items-center gap-2">
                                            <FileText size={15} /> {file.name}
                                        </div>
                                        <button onClick={() => setFile(null)} className="text-red-500 hover:underline text-[11px]">Remove</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 flex gap-3 shrink-0 bg-white dark:bg-[#161b22]">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={tab === 'form' ? handleSubmitForm : handleBulkSubmit}
                        disabled={isSubmitting}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" /> Processing...
                            </>
                        ) : tab === 'form' ? (
                            'Create Employee Account'
                        ) : (
                            'Upload & Import Batch'
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

// ─── User Detail Drawer (View & Edit Employee) ───────────────────────────────
const UserDetailDrawer = ({ user, open, onClose, onUpdate, onDelete, initialEditing = false, allProjects = [], backendTemplates = [] }) => {
    const [editing, setEditing] = useState(initialEditing);
    const [localUser, setLocalUser] = useState(null);
    const [permExpanded, setPermExpanded] = useState({ projects: true });
    const [isSaving, setIsSaving] = useState(false);

    const dynamicPageTree = getDynamicPageTree(allProjects);

    useEffect(() => {
        setEditing(initialEditing);
    }, [initialEditing, open]);

    useEffect(() => {
        if (user) {
            const rawPerms = user.system_permissions || user.permissions || {};
            const basePerms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : { ...rawPerms };
            const mappedPerms = defaultPermissions();
            const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };

            for (const [k, v] of Object.entries(basePerms || {})) {
                const num = typeof v === 'string' ? (map[v.toLowerCase()] ?? 0) : Number(v);
                mappedPerms[k] = num;
            }

            setLocalUser({
                ...user,
                user_type: (user.user_type || 'employee').toLowerCase() === 'admin' ? 'admin' : 'employee',
                system_permissions: mappedPerms
            });
        }
    }, [user, open]);

    if (!open || !localUser) return null;

    const handleApplyTemplate = (tpl) => {
        const sysPerms = tpl.system_permissions || tpl.permissions || {};
        const parsed = typeof sysPerms === 'string' ? JSON.parse(sysPerms) : sysPerms;
        const newPerms = defaultPermissions();
        const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };

        for (const [k, v] of Object.entries(parsed)) {
            const num = typeof v === 'string' ? (map[v.toLowerCase()] ?? 0) : Number(v);
            newPerms[k] = num;
        }

        setLocalUser(u => ({ ...u, system_permissions: newPerms }));
        toast.info(`Applied template: "${tpl.name}"`);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const selectedProjIds = [];
            for (const [k, v] of Object.entries(localUser.system_permissions || {})) {
                if (k.startsWith('project_') && v > 0) {
                    const pid = parseInt(k.replace('project_', ''), 10);
                    if (!isNaN(pid)) selectedProjIds.push(pid);
                }
            }

            await onUpdate({
                ...localUser,
                project_ids: selectedProjIds
            });
            setEditing(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const PermRow = ({ id, label, indent = false }) => {
        const lvl = localUser.system_permissions?.[id] ?? 0;
        const isProjectNode = id.startsWith('project_');
        const levelsToUse = isProjectNode ? ['None', 'Access'] : ACCESS_LEVELS;

        return (
            <div className={`w-full flex items-center justify-between py-2 px-2 rounded-xl transition-all hover:bg-gray-50 dark:hover:bg-white/[0.03] ${indent ? 'ml-4 w-[calc(100%-1rem)]' : ''}`}>
                <span className={`text-xs font-semibold truncate mr-3 ${indent ? 'text-gray-600 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{label}</span>
                <div className="flex gap-1.5 shrink-0 ml-auto">
                    {levelsToUse.map((name, i) => {
                        const isActive = isProjectNode ? (i === 0 ? lvl === 0 : lvl > 0) : lvl === i;
                        return (
                            <button
                                key={i}
                                type="button"
                                disabled={!editing}
                                onClick={() => editing && setLocalUser(u => ({
                                    ...u,
                                    system_permissions: {
                                        ...u.system_permissions,
                                        [id]: isProjectNode ? (i === 0 ? 0 : 1) : i
                                    }
                                }))}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200'
                                } ${!editing ? 'cursor-default opacity-80' : ''}`}
                            >
                                {name}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[4000]" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-[#161b22] shadow-2xl z-[4001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-[#0d1117]">
                    <div className="flex items-center gap-3">
                        <Avatar name={localUser.name} />
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{localUser.name}</h2>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">{localUser.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!editing ? (
                            <>
                                <button
                                    onClick={() => setEditing(true)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5 border border-blue-200/50 dark:border-blue-500/20"
                                >
                                    <Edit3 size={14} /> Edit Access
                                </button>
                                <button
                                    onClick={() => onDelete(localUser)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        ) : (
                            <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 text-[11px] font-bold rounded-lg flex items-center gap-1">
                                <Edit3 size={12} /> Editing Mode
                            </span>
                        )}
                        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    {/* User Metadata */}
                    <div className="grid grid-cols-3 gap-3 p-3.5 bg-gray-50/50 dark:bg-[#0d1117] rounded-2xl border border-gray-100 dark:border-white/5">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account Type</p>
                            {editing ? (
                                <CustomSelect
                                    value={localUser.user_type}
                                    options={[
                                        { value: 'employee', label: 'Employee' },
                                        { value: 'admin', label: 'Admin' }
                                    ]}
                                    onChange={val => setLocalUser(u => ({ ...u, user_type: val }))}
                                    className="mt-1"
                                />
                            ) : (
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 capitalize">{localUser.user_type}</p>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Department</p>
                            {editing ? (
                                <input
                                    type="text"
                                    value={localUser.department || ''}
                                    onChange={e => setLocalUser(u => ({ ...u, department: e.target.value }))}
                                    className="mt-1 w-full px-2 py-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium"
                                />
                            ) : (
                                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1">{localUser.department || '-'}</p>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
                            <div className="mt-1"><StatusBadge status={localUser.status || 'Active'} /></div>
                        </div>
                    </div>

                    {/* Template Selection when Editing */}
                    {editing && localUser.user_type === 'employee' && backendTemplates.length > 0 && (
                        <VisualTemplateSelector
                            templates={backendTemplates}
                            onSelectTemplate={handleApplyTemplate}
                        />
                    )}

                    {/* Permissions Page Tree */}
                    {localUser.user_type === 'admin' ? (
                        <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/20 flex items-center gap-3">
                            <Shield size={20} className="text-purple-600 dark:text-purple-400 shrink-0" />
                            <div>
                                <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300">Administrator Account</h4>
                                <p className="text-[11px] text-purple-700 dark:text-purple-400 mt-0.5">Unrestricted full access across all platform modules and all projects.</p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                    <Shield size={14} className="text-blue-500" /> Page & Project Access Control
                                </h3>
                                {editing && (
                                    <span className="text-[10px] text-blue-500 font-semibold bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg">Click levels to change</span>
                                )}
                            </div>

                            <div className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
                                {dynamicPageTree.map(section => (
                                    <div key={section.id} className="py-2.5 px-1">
                                        <div className="flex items-center justify-between w-full">
                                            <PermRow id={section.id} label={section.label} />
                                            {section.children.length > 0 && (
                                                <button onClick={() => setPermExpanded(e => ({ ...e, [section.id]: !e[section.id] }))}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors shrink-0 ml-1">
                                                    <ChevronDown size={14} className={`transition-transform ${permExpanded[section.id] ? 'rotate-180' : ''}`} />
                                                </button>
                                            )}
                                        </div>
                                        {section.children.length > 0 && permExpanded[section.id] && (
                                            <div className="pl-3 py-1.5 space-y-1 border-l-2 border-gray-100 dark:border-white/5 ml-3 mt-1.5">
                                                {section.children.map(child => (
                                                    <PermRow key={child.id} id={child.id} label={child.label} indent />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {editing && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 flex gap-3 shrink-0 bg-white dark:bg-[#161b22]">
                        <button onClick={() => setEditing(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-all">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50">
                            {isSaving ? 'Saving Changes...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

// ─── Permission Templates Manager Tab View ─────────────────────────────────────
// ─── Assign Template to Employees Drawer (Right Sidebar Popup) ────────────────
const AssignTemplateDrawer = ({
    open,
    onClose,
    template,
    users = [],
    onAssign
}) => {
    const [search, setSearch] = useState('');
    const [selectedDept, setSelectedDept] = useState('All');
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (template && open) {
            // Pre-select users who currently have this template
            const currentAssigned = users
                .filter(u => u.template_name === template.name || String(u.template_id) === String(template.id))
                .map(u => u.id);
            setSelectedUserIds(new Set(currentAssigned));
            setSearch('');
            setSelectedDept('All');
        }
    }, [template, open, users]);

    if (!open || !template) return null;

    const allDepts = ['All', ...Array.from(new Set(users.map(u => u.department).filter(Boolean)))];

    const filteredUsers = users.filter(u => {
        const matchesDept = selectedDept === 'All' || u.department === selectedDept;
        const matchesSearch = !search.trim() ||
            (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.department || '').toLowerCase().includes(search.toLowerCase());
        return matchesDept && matchesSearch;
    });

    const toggleUser = (id) => {
        const next = new Set(selectedUserIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedUserIds(next);
    };

    const handleSelectAllFiltered = () => {
        const next = new Set(selectedUserIds);
        filteredUsers.forEach(u => next.add(u.id));
        setSelectedUserIds(next);
    };

    const handleClearFiltered = () => {
        const next = new Set(selectedUserIds);
        filteredUsers.forEach(u => next.delete(u.id));
        setSelectedUserIds(next);
    };

    const handleConfirm = async () => {
        setIsSaving(true);
        try {
            await onAssign(template, Array.from(selectedUserIds));
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[6000]" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full max-w-xl md:max-w-2xl bg-white dark:bg-[#161b22] shadow-2xl z-[6001] flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-[#0d1117]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/50 dark:border-blue-500/20 shadow-2xs">
                            <UserPlus size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                                    Assign Template: {template.name}
                                </h2>
                                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                    System Scope
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Select employees to batch-assign this template and synchronize their page permissions
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 border-b border-gray-100 dark:border-white/10 space-y-2.5 bg-gray-50/20 dark:bg-transparent shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search employee by name, email, department..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* Department Filter Pills */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {allDepts.slice(0, 5).map(dept => (
                                <button
                                    key={dept}
                                    type="button"
                                    onClick={() => setSelectedDept(dept)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                        selectedDept === dept
                                            ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                            : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                                    }`}
                                >
                                    {dept}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                            <button
                                type="button"
                                onClick={handleSelectAllFiltered}
                                className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                            >
                                Select All ({filteredUsers.length})
                            </button>
                            <span className="text-gray-300 dark:text-gray-700">•</span>
                            <button
                                type="button"
                                onClick={handleClearFiltered}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 cursor-pointer"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                {/* Employee List with Checkboxes */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
                    {filteredUsers.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-xs font-medium">
                            No matching employees found for the search criteria.
                        </div>
                    ) : (
                        filteredUsers.map(u => {
                            const isSelected = selectedUserIds.has(u.id);
                            const isCurrentlyAssigned = u.template_name === template.name || String(u.template_id) === String(template.id);
                            const initials = (u.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                            return (
                                <div
                                    key={u.id}
                                    onClick={() => toggleUser(u.id)}
                                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer group select-none ${
                                        isSelected
                                            ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-950/20 shadow-2xs'
                                            : 'border-gray-200/80 dark:border-white/5 bg-white dark:bg-[#161b22] hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Themed Custom Checkbox */}
                                        <div
                                            className={`w-4 h-4 rounded-md border transition-all flex items-center justify-center shrink-0 ${
                                                isSelected
                                                    ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 shadow-2xs'
                                                    : 'border-gray-300 dark:border-white/20 bg-white dark:bg-[#161b22] group-hover:border-blue-400 dark:group-hover:border-blue-400'
                                            }`}
                                        >
                                            {isSelected && <Check size={11} className="stroke-[3.5]" />}
                                        </div>

                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center justify-center shrink-0">
                                            {initials}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                    {u.name}
                                                </h4>
                                                <span className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-[10px] text-gray-600 dark:text-gray-400 font-medium">
                                                    {u.department || 'General'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                {u.email}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        {isCurrentlyAssigned ? (
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-800/50">
                                                Currently Assigned
                                            </span>
                                        ) : u.template_name ? (
                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-[10px] font-medium">
                                                {u.template_name}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
                                                Standard Access
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Sticky Footer */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-white dark:bg-[#161b22]">
                    <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        <span>{selectedUserIds.size} Employee(s) Selected</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isSaving}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
                        >
                            <Check size={14} className="stroke-[3]" />
                            <span>{isSaving ? 'Assigning...' : `Apply Template (${selectedUserIds.size})`}</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// ─── Permission Templates Manager Tab View ─────────────────────────────────────
const PermissionTemplatesTab = ({
    templates,
    users = [],
    isLoading,
    searchQuery = '',
    onCreateClick,
    onEditClick,
    onDeleteClick,
    onAssignEmployeesClick
}) => {
    // Only show system templates in Admin page
    const systemTemplates = templates.filter(t => t.type !== 'project');

    const filteredTemplates = systemTemplates.filter(t => {
        return !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const getPermissionStats = (template) => {
        const perms = template.permissions || template.system_permissions || {};
        const parsed = typeof perms === 'string' ? JSON.parse(perms) : perms;
        const values = Object.values(parsed || {});
        let full = 0, read = 0, none = 0;
        values.forEach(v => {
            if (v === 2 || v === 'edit' || v === 'write') full++;
            else if (v === 1 || v === 'view' || v === 'read') read++;
            else none++;
        });
        return { full, read, none, total: values.length };
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50 dark:bg-[#0d1117]">
            {/* Grid View with minimal padding aligned with top toolbar */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-44 bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-white/10 p-3.5 animate-pulse space-y-3">
                                <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-2/3"></div>
                                <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-1/2"></div>
                                <div className="h-9 bg-gray-100 dark:bg-white/5 rounded-lg"></div>
                            </div>
                        ))}
                    </div>
                ) : filteredTemplates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredTemplates.map(template => {
                            const stats = getPermissionStats(template);
                            const assignedUsers = (users || []).filter(u => u.template_name === template.name || String(u.template_id) === String(template.id));

                            return (
                                <div
                                    key={template.id}
                                    onClick={() => onEditClick(template)}
                                    className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-white/10 shadow-2xs hover:shadow-md hover:border-blue-500/40 cursor-pointer transition-all p-3.5 flex flex-col justify-between group"
                                >
                                    <div>
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20 shadow-2xs">
                                                    <Shield size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                        {template.name}
                                                    </h3>
                                                    <span className="inline-block mt-0.5 px-2 py-0.2 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                                        System Scope
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Menu */}
                                            <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => onEditClick(template)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all cursor-pointer"
                                                    title="Edit Template in Drawer"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => onDeleteClick(template)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-all cursor-pointer"
                                                    title="Delete Template"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stats Summary */}
                                        <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 dark:bg-[#0d1117] rounded-lg border border-gray-100 dark:border-white/5 text-center text-xs">
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400">Full Access</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.full}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400">Read Only</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400">{stats.read}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400">No Access</span>
                                                <span className="font-bold text-gray-400">{stats.none}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer: Employee Assignment Provision */}
                                    <div className="pt-2.5 mt-2.5 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Users size={13} className="text-gray-400 shrink-0" />
                                            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 truncate">
                                                {assignedUsers.length === 1 ? '1 Employee' : `${assignedUsers.length} Employees`}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAssignEmployeesClick(template);
                                            }}
                                            className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs active:scale-95"
                                            title={`Assign ${template.name} to employees`}
                                        >
                                            <UserPlus size={12} />
                                            <span>Assign Employees</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-16 text-center text-gray-500 dark:text-gray-400">
                        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <Sparkles size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">No System Permission Templates Found</h4>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm mx-auto">
                            Create custom system permission templates to easily apply navigation access across employee accounts.
                        </p>
                        <button
                            onClick={onCreateClick}
                            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all inline-flex items-center gap-2 cursor-pointer"
                        >
                            <Plus size={15} /> Create First Template
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Employee Column Aliases for Excel Paste & Import ────────────────────────
const EMPLOYEE_COLUMN_ALIASES = {
    name: ['employee name', 'name', 'full name', 'user name', 'staff name', 'member', 'employee'],
    email: ['email', 'email id', 'e-mail', 'mail', 'email address', 'official email'],
    user_type: ['account type', 'role', 'user type', 'type', 'access role', 'privilege', 'user_type'],
    department: ['department', 'dept', 'division', 'team', 'unit', 'function'],
    phone_no: ['mobile', 'phone', 'contact', 'mobile no', 'phone no', 'contact number', 'telephone', 'mobile number', 'cell', 'phone_no'],
    status: ['status', 'account status', 'active status', 'state', 'user_status'],
    joined: ['joined date', 'date of joining', 'created at', 'joining date', 'created on', 'joined on', 'joined']
};

// ─── MAIN ADMIN / EMPLOYEES PAGE COMPONENT ────────────────────────────────────
const AdminPage = () => {
    const { hasPermission, isAdmin } = useAuth();
    const canWrite = isAdmin || hasPermission('admin', 2);

    const [mainTab, setMainTab] = useState('employees'); // 'employees' or 'templates'
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
    // Employee Filters
    const [activeFilters, setActiveFilters] = useState({ userTypes: [], departments: [] });
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState('form');

    // User Modals & Drawers
    const [addOpen, setAddOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [deletingUser, setDeletingUser] = useState(null);
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Template Modals
    const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
    const [templateToEdit, setTemplateToEdit] = useState(null);
    const [deletingTemplate, setDeletingTemplate] = useState(null);
    const [assigningTemplate, setAssigningTemplate] = useState(null);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
    const [templateSearchQuery, setTemplateSearchQuery] = useState('');

    const filterDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                setIsFilterDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const res = await adminApi.getUsers();
            if (res.success && res.users) {
                const mappedUsers = res.users.map(u => ({
                    ...u,
                    id: u.user_id || u.id,
                    name: u.user_name || u.name,
                    email: u.email || u.email_id,
                    user_type: (u.user_type || 'employee').toLowerCase() === 'admin' ? 'Admin' : 'Employee',
                    department: u.dept_name || u.departmentName || u.department || '-',
                    status: u.user_status || u.status || 'Active',
                    joined: u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-'
                })).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                setUsers(mappedUsers);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch employee list');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const fetchTemplates = async () => {
        setIsLoadingTemplates(true);
        try {
            const res = await adminApi.getPermissionTemplates('system');
            if (res.success && res.templates) {
                setTemplates(res.templates.filter(t => t.type === 'system'));
            }
        } catch (err) {
            console.error('Failed to load permission templates:', err);
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            const projRes = await projectApi.listProjects();
            if (projRes.success && projRes.projects) {
                setProjects(projRes.projects);
            }
        } catch (err) {
            console.error('Failed to load projects:', err);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchTemplates();
        fetchInitialData();
    }, []);

    const openViewUser = (user, startEditing = false) => {
        setSelectedUser(user);
        setEditMode(startEditing);
    };

    const handleAddUser = async (formData) => {
        try {
            const backendPerms = {};
            const map = { 0: 'none', 1: 'view', 2: 'edit' };
            for (const [k, v] of Object.entries(formData.system_permissions || {})) {
                backendPerms[k] = typeof v === 'number' ? (map[v] || 'none') : v;
            }

            await adminApi.createUser({
                ...formData,
                system_permissions: backendPerms
            });

            toast.success(`Employee account "${formData.name}" created!`);
            fetchUsers();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Failed to create user account';
            toast.error(msg);
            throw error;
        }
    };

    const handleBulkUpload = async (file) => {
        try {
            const res = await adminApi.bulkUpload(file);
            if (res.success) {
                toast.success('Bulk employee upload completed!');
                fetchUsers();
            }
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Failed to import employees';
            toast.error(msg);
            throw error;
        }
    };

    const handleUpdateUser = async (updated) => {
        try {
            const backendPerms = {};
            const map = { 0: 'none', 1: 'view', 2: 'edit' };
            for (const [k, v] of Object.entries(updated.system_permissions || {})) {
                backendPerms[k] = typeof v === 'number' ? (map[v] || 'none') : v;
            }

            await adminApi.updateUser(updated.id, {
                ...updated,
                system_permissions: backendPerms
            });
            toast.success(`Employee "${updated.name}" updated successfully`);
            fetchUsers();
            setSelectedUser(null);
        } catch (error) {
            console.error(error);
            toast.error('Failed to update employee access');
            throw error;
        }
    };

    const confirmDeleteUser = async () => {
        if (!deletingUser) return;
        setIsDeletingUser(true);
        try {
            await adminApi.deleteUser(deletingUser.id);
            toast.success(`Employee "${deletingUser.name}" deleted successfully.`);
            fetchUsers();
            setDeletingUser(null);
            setSelectedUser(null);
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Failed to delete employee';
            toast.error(msg);
        } finally {
            setIsDeletingUser(false);
        }
    };

    // Permission Template Handlers
    const handleSaveTemplate = async (templateData) => {
        setIsSavingTemplate(true);
        try {
            if (templateData.id) {
                await adminApi.updatePermissionTemplate(templateData.id, templateData);
                toast.success(`Permission template "${templateData.name}" updated!`);
            } else {
                await adminApi.createPermissionTemplate(templateData);
                toast.success(`Permission template "${templateData.name}" created!`);
            }
            fetchTemplates();
            setTemplateEditorOpen(false);
            setTemplateToEdit(null);
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
            fetchTemplates();
            setDeletingTemplate(null);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to delete template');
        } finally {
            setIsDeletingTemplate(false);
        }
    };

    const handleAssignTemplateToUsers = async (template, selectedUserIds) => {
        try {
            const rawPerms = template.permissions || template.system_permissions || {};
            const parsedPerms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;

            const backendPerms = {};
            const map = { 0: 'none', 1: 'view', 2: 'edit', 'none': 'none', 'view': 'view', 'read': 'view', 'edit': 'edit', 'write': 'edit' };
            for (const [k, v] of Object.entries(parsedPerms)) {
                backendPerms[k] = typeof v === 'number' ? (map[v] || 'none') : (map[v] || 'none');
            }

            for (const uid of selectedUserIds) {
                const user = users.find(u => u.id === uid);
                if (!user) continue;
                await adminApi.updateUser(uid, {
                    ...user,
                    system_permissions: backendPerms,
                    template_name: template.name,
                    template_id: template.id
                });
            }

            toast.success(`Assigned template "${template.name}" to ${selectedUserIds.length} employee(s)!`);
            fetchUsers();
        } catch (err) {
            console.error(err);
            toast.error('Failed to assign template to selected employees');
            throw err;
        }
    };

    // Filters for Employees
    const allDepartments = useMemo(() => {
        return Array.from(new Set(users.map(u => u.department).filter(Boolean)));
    }, [users]);

    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter(u => (u.status || '').toLowerCase() === 'active').length;
        const admins = users.filter(u => (u.user_type || '').toLowerCase() === 'admin').length;
        const depts = new Set(users.map(u => u.department).filter(Boolean)).size;
        return { total, active, admins, depts };
    }, [users]);

    const columns = useMemo(() => {
        const deptOptions = Array.from(new Set([
            'Engineering',
            'Operations',
            'Project Management',
            'Finance & Accounts',
            'Procurement & Stores',
            'Quality & Safety',
            'Human Resources',
            'Administration',
            'Executive / Management',
            ...allDepartments
        ])).filter(Boolean);

        return [
            {
                key: 'name',
                label: 'Employee Name',
                width: '210px',
                minWidth: '180px',
                required: true,
                aliases: EMPLOYEE_COLUMN_ALIASES.name
            },
            {
                key: 'email',
                label: 'Email ID',
                width: '230px',
                minWidth: '200px',
                required: true,
                aliases: EMPLOYEE_COLUMN_ALIASES.email,
                validate: (val) => {
                    if (!val) return 'Email is required';
                    if (!/\S+@\S+\.\S+/.test(val)) return 'Invalid email format';
                    return null;
                }
            },
            {
                key: 'user_type',
                label: 'Account Type',
                width: '140px',
                minWidth: '130px',
                type: 'select',
                options: ['Employee', 'Admin'],
                defaultValue: 'Employee',
                aliases: EMPLOYEE_COLUMN_ALIASES.user_type
            },
            {
                key: 'department',
                label: 'Department',
                width: '180px',
                minWidth: '150px',
                type: 'select',
                options: deptOptions,
                defaultValue: 'Engineering',
                aliases: EMPLOYEE_COLUMN_ALIASES.department
            },
            {
                key: 'phone_no',
                label: 'Mobile Number',
                width: '150px',
                minWidth: '140px',
                aliases: EMPLOYEE_COLUMN_ALIASES.phone_no
            },
            {
                key: 'status',
                label: 'Status',
                width: '120px',
                minWidth: '110px',
                type: 'select',
                options: ['Active', 'Inactive', 'Suspended'],
                defaultValue: 'Active',
                aliases: EMPLOYEE_COLUMN_ALIASES.status
            },
            {
                key: 'permissions_access',
                label: 'Permissions & Access Control',
                width: '270px',
                minWidth: '250px',
                renderCell: (val, row) => {
                    const isAdminUser = (row.user_type || '').toLowerCase() === 'admin';
                    
                    let accessLabel = 'Standard Access';
                    if (isAdminUser) {
                        accessLabel = 'Admin Privileges';
                    } else if (row.template_name) {
                        accessLabel = row.template_name;
                    } else if (row.system_permissions || row.permissions) {
                        try {
                            const raw = typeof (row.system_permissions || row.permissions) === 'string'
                                ? JSON.parse(row.system_permissions || row.permissions)
                                : (row.system_permissions || row.permissions);
                            const activeCount = Object.values(raw || {}).filter(v => Number(v) > 0).length;
                            if (activeCount > 0) {
                                accessLabel = `${activeCount} Modules`;
                            }
                        } catch (e) {
                            accessLabel = 'Custom Access';
                        }
                    }

                    return (
                        <div className="flex items-center justify-between w-full gap-2 px-1 py-0.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap border shrink-0 ${
                                isAdminUser
                                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50 shadow-2xs'
                                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50 shadow-2xs'
                            }`}>
                                <Shield size={12} className={isAdminUser ? 'text-purple-500' : 'text-blue-500'} />
                                <span>{accessLabel}</span>
                            </span>

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openViewUser(row, true);
                                }}
                                className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
                                title="Configure Module Access & Project Assignments"
                            >
                                <Sliders size={12} />
                                <span>Edit Access</span>
                            </button>
                        </div>
                    );
                }
            },
            {
                key: 'joined',
                label: 'Joined Date',
                width: '130px',
                minWidth: '120px',
                readOnly: true,
                aliases: EMPLOYEE_COLUMN_ALIASES.joined
            }
        ];
    }, [allDepartments]);

    const handleSaveGridBatch = async (payload) => {
        const { created, updated, deleted } = payload;

        if (deleted.length > 0) {
            for (const id of deleted) {
                await adminApi.deleteUser(id);
            }
        }

        if (created.length > 0) {
            for (const item of created) {
                if (item.name && item.email) {
                    await adminApi.createUser({
                        name: item.name,
                        email: item.email,
                        department: item.department || '',
                        phone_no: item.phone_no || '',
                        password: item.password || 'Mano@1234',
                        user_type: item.user_type || 'employee',
                        status: item.status || 'Active',
                        system_permissions: defaultPermissions()
                    });
                }
            }
        }

        if (updated.length > 0) {
            for (const item of updated) {
                if (item.id && item.name) {
                    await adminApi.updateUser(item.id, {
                        name: item.name,
                        email: item.email,
                        department: item.department,
                        phone_no: item.phone_no,
                        user_type: item.user_type,
                        status: item.status
                    });
                }
            }
        }

        toast.success('Employee grid changes saved successfully!');
        await fetchUsers();
    };

    const toggleFilter = (type, val) => {
        setActiveFilters(prev => {
            const list = prev[type] || [];
            const next = list.includes(val) ? list.filter(v => v !== val) : [...list, val];
            return { ...prev, [type]: next };
        });
    };

    const activeFilterCount = (activeFilters.userTypes?.length || 0) + (activeFilters.departments?.length || 0);

    const filteredUsers = useMemo(() => {
        return users
            .filter(u => {
                const matchesType = !activeFilters.userTypes?.length || activeFilters.userTypes.includes(u.user_type);
                const matchesDept = !activeFilters.departments?.length || activeFilters.departments.includes(u.department);
                return matchesType && matchesDept;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    }, [users, activeFilters]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 overflow-hidden font-sans">
            {/* Top Navigation Switcher Header */}
            <div className="px-3 py-2 flex flex-wrap items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#0d1117] shrink-0 gap-3">
                <div className="flex items-center gap-3">
                    {/* Main Section Switcher */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setMainTab('employees')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                mainTab === 'employees'
                                    ? 'bg-white dark:bg-[#161b22] text-blue-600 dark:text-blue-400 shadow-xs'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                            }`}
                        >
                            <span>Employees Management</span>
                            <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] rounded-md font-extrabold">
                                {users.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setMainTab('templates')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                mainTab === 'templates'
                                    ? 'bg-white dark:bg-[#161b22] text-purple-600 dark:text-purple-400 shadow-xs'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                            }`}
                        >
                            <span>Permission Templates</span>
                            <span className="px-1.5 py-0.2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-[10px] rounded-md font-extrabold">
                                {templates.length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Templates Tab Specific Actions */}
                {mainTab === 'templates' && (
                    <div className="flex items-center gap-3">
                        <div className="relative w-56 md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={templateSearchQuery}
                                onChange={e => setTemplateSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setTemplateToEdit(null);
                                setTemplateEditorOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                        >
                            <Plus size={14} />
                            <span>Create Permission Template</span>
                        </button>
                    </div>
                )}
            </div>

            {/* TAB CONTENT */}
            {mainTab === 'employees' ? (
                /* EMPLOYEES TAB WITH UNIFIED EXCEL GRID & MERGED EMPLOYEE TOOLS */
                <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117]">
                    {/* Top Stats Banner */}
                    <div className="px-3 pt-1.5 pb-1.5 border-b border-gray-200 dark:border-white/5 shrink-0">
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                {
                                    id: 'total',
                                    label: 'Total Employees',
                                    value: stats.total,
                                    color: 'text-gray-900 dark:text-white',
                                    bg: 'bg-gray-50 dark:bg-white/[0.03]'
                                },
                                {
                                    id: 'active',
                                    label: 'Active Accounts',
                                    value: stats.active,
                                    color: 'text-emerald-600 dark:text-emerald-400',
                                    bg: 'bg-emerald-50 dark:bg-emerald-900/10'
                                },
                                {
                                    id: 'admins',
                                    label: 'Admin Privileges',
                                    value: stats.admins,
                                    color: 'text-purple-600 dark:text-purple-400',
                                    bg: 'bg-purple-50 dark:bg-purple-900/10'
                                },
                                {
                                    id: 'depts',
                                    label: 'Departments',
                                    value: stats.depts,
                                    color: 'text-blue-600 dark:text-blue-400',
                                    bg: 'bg-blue-50 dark:bg-blue-900/10'
                                }
                            ].map((s) => (
                                <div
                                    key={s.id}
                                    className={`${s.bg} rounded-lg p-2 px-3 border border-gray-100 dark:border-white/5`}
                                >
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {s.label}
                                    </p>
                                    <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Centralized & Unified ExcelGrid Component */}
                    <ExcelGrid
                        data={filteredUsers}
                        columns={columns}
                        primaryKey="id"
                        entityName="Employees"
                        canWrite={canWrite}
                        isLoading={isLoadingUsers}
                        onSave={handleSaveGridBatch}
                        onRefresh={fetchUsers}
                        onViewRow={(row) => openViewUser(row, true)}
                        emptyMessage="No employees found in database"
                        showFormulaBar={false}
                        extraFilters={
                            <div className="relative" ref={filterDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        activeFilterCount > 0
                                            ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                            : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <Filter size={13} />
                                    <span>Filter</span>
                                    {activeFilterCount > 0 && (
                                        <span className="bg-blue-600 text-white text-[10px] w-4 h-4 rounded-md flex items-center justify-center font-bold">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                    <ChevronDown size={12} className={`transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isFilterDropdownOpen && (
                                    <div className="absolute left-0 mt-1.5 w-80 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[5000] p-4 space-y-4 text-xs animate-in fade-in zoom-in-95">
                                        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/10">
                                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                <Filter size={14} className="text-blue-500" /> Filter Employees
                                            </h4>
                                            {activeFilterCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveFilters({ userTypes: [], departments: [] })}
                                                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                                                >
                                                    Clear All ({activeFilterCount})
                                                </button>
                                            )}
                                        </div>

                                        {/* Account Type */}
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Account Type</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {['Admin', 'Employee'].map(type => {
                                                    const isChecked = activeFilters.userTypes?.includes(type);
                                                    return (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            onClick={() => toggleFilter('userTypes', type)}
                                                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                                                                isChecked
                                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                                    : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                                                            }`}
                                                        >
                                                            {type}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Departments */}
                                        {allDepartments.length > 0 && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Department</label>
                                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                                                    {allDepartments.map(dept => {
                                                        const isChecked = activeFilters.departments?.includes(dept);
                                                        return (
                                                            <button
                                                                key={dept}
                                                                type="button"
                                                                onClick={() => toggleFilter('departments', dept)}
                                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                                                                    isChecked
                                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                                        : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
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
                                )}
                            </div>
                        }
                    />
                </div>
            ) : (
                /* PERMISSION TEMPLATES TAB */
                <PermissionTemplatesTab
                    templates={templates}
                    users={users}
                    isLoading={isLoadingTemplates}
                    searchQuery={templateSearchQuery}
                    onCreateClick={() => {
                        setTemplateToEdit(null);
                        setTemplateEditorOpen(true);
                    }}
                    onEditClick={(tpl) => {
                        setTemplateToEdit(tpl);
                        setTemplateEditorOpen(true);
                    }}
                    onDeleteClick={(tpl) => {
                        setDeletingTemplate(tpl);
                    }}
                    onAssignEmployeesClick={(tpl) => {
                        setAssigningTemplate(tpl);
                    }}
                />
            )}

            {/* Employee Drawers & Modals */}
            <AddUserDrawer
                open={addOpen}
                onClose={() => setAddOpen(false)}
                onAdd={handleAddUser}
                onBulkUpload={handleBulkUpload}
                allProjects={projects}
                backendTemplates={templates}
                initialTab={drawerTab}
            />

            <UserDetailDrawer
                user={selectedUser}
                open={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                onUpdate={handleUpdateUser}
                onDelete={(u) => setDeletingUser(u)}
                initialEditing={editMode}
                allProjects={projects}
                backendTemplates={templates}
            />

            <DeleteConfirmationModal
                open={!!deletingUser}
                onClose={() => setDeletingUser(null)}
                onConfirm={confirmDeleteUser}
                user={deletingUser}
                isDeleting={isDeletingUser}
            />

            {/* Template Drawer */}
            <TemplateEditorDrawer
                open={templateEditorOpen}
                onClose={() => {
                    setTemplateEditorOpen(false);
                    setTemplateToEdit(null);
                }}
                onSave={handleSaveTemplate}
                templateToEdit={templateToEdit}
                isSaving={isSavingTemplate}
            />

            <DeleteTemplateModal
                open={!!deletingTemplate}
                onClose={() => setDeletingTemplate(null)}
                onConfirm={confirmDeleteTemplate}
                template={deletingTemplate}
                isDeleting={isDeletingTemplate}
            />

            {/* Assign Template to Employees Drawer */}
            <AssignTemplateDrawer
                open={!!assigningTemplate}
                onClose={() => setAssigningTemplate(null)}
                template={assigningTemplate}
                users={users}
                onAssign={handleAssignTemplateToUsers}
            />
        </div>
    );
};

export default AdminPage;
