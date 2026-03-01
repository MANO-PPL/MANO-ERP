import React, { useState } from 'react';
import {
    Shield,
    Lock,
    Eye,
    Edit3,
    Trash2,
    ChevronRight,
    Search,
    Check,
    X,
    Info
} from 'lucide-react';

const mockPages = [
    { id: 'dashboard', label: 'Dashboard', path: '/' },
    { id: 'projects', label: 'Projects', path: '/projects' },
    { id: 'vendors', label: 'Vendors', path: '/vendors' },
    { id: 'clients', label: 'Clients', path: '/clients' },
    { id: 'collaboration', label: 'Collaboration', path: '/collaboration' },
    { id: 'reports', label: 'Reports', path: '/reports' },
    { id: 'admin', label: 'Admin Panel', path: '/admin' },
];

const mockRoles = [
    { id: 'sa', name: 'Super Admin', color: 'bg-purple-600' },
    { id: 'pm', name: 'Project Manager', color: 'bg-blue-600' },
    { id: 'sl', name: 'Site Lead', color: 'bg-indigo-600' },
    { id: 'v', name: 'Viewer', color: 'bg-gray-600' },
];

const PermissionsGrid = () => {
    const [selectedRole, setSelectedRole] = useState(mockRoles[1]); // PM by default

    return (
        <div className="p-8">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Role List */}
                <div className="w-full lg:w-72 shrink-0">
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 px-2">Select Role to Edit</h3>
                    <div className="space-y-1">
                        {mockRoles.map(role => (
                            <button
                                key={role.id}
                                onClick={() => setSelectedRole(role)}
                                className={`w-full group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${selectedRole.id === role.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-[#161b22] hover:shadow-sm border border-transparent'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`w-2 h-2 rounded-full ${selectedRole.id === role.id ? 'bg-white' : role.color}`} />
                                    <span className="text-sm font-semibold">{role.name}</span>
                                </div>
                                <ChevronRight size={14} className={selectedRole.id === role.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} />
                            </button>
                        ))}
                    </div>

                    <div className="mt-8 p-5 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
                        <div className="flex items-start space-x-3">
                            <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400">Pro Tip</h4>
                                <p className="text-[11px] text-blue-600/80 dark:text-blue-400/60 mt-1 leading-relaxed">
                                    Changes made here will apply instantly to all users assigned to the <strong>{selectedRole.name}</strong> role.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Permissions Matrix */}
                <div className="flex-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden anim-fade-in">
                    <div className="px-6 py-5 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-[#0d1117]/50">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active Permissions: {selectedRole.name}</h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Define access levels for each system module</p>
                        </div>
                        <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all active:scale-95">
                            Save Changes
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-white/10 text-left">
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest">Page / Module</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest text-center">No Access</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest text-center">Read Only</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest text-center">Maintainer</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-widest text-center">Full Control</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gh-border">
                                {mockPages.map(page => (
                                    <tr key={page.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/5/[0.01] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-[#0d1117] flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-blue-500 transition-colors">
                                                    <Lock size={14} />
                                                </div>
                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-100">{page.label}</p>
                                            </div>
                                        </td>
                                        {[0, 1, 2, 3].map(level => (
                                            <td key={level} className="px-6 py-4 text-center">
                                                <button
                                                    className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center m-auto ${page.id === 'dashboard' && level === 3
                                                        ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-500/10'
                                                        : 'border-gray-200 dark:border-white/10 hover:border-blue-400'
                                                        }`}
                                                >
                                                    {page.id === 'dashboard' && level === 3 && <Check size={12} strokeWidth={4} />}
                                                </button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PermissionsGrid;
