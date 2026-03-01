import React, { useState } from 'react';
import {
    Search,
    MoreHorizontal,
    Filter,
    Download,
    Mail,
    Shield,
    Calendar,
    CheckCircle2,
    XCircle,
    UserPlus
} from 'lucide-react';

const mockUsers = [
    { id: 1, name: 'Madhavan S', email: 'madhavan@mano.co.in', role: 'Super Admin', department: 'Engineering', status: 'Active', joined: 'Jan 15, 2026' },
    { id: 2, name: 'Sathish Kumar', email: 'sathish@mano.co.in', role: 'Project Manager', department: 'Operations', status: 'Active', joined: 'Feb 10, 2026' },
    { id: 3, name: 'Mano Kakoos', email: 'mano@mano.co.in', role: 'Site Lead', department: 'Operations', status: 'Away', joined: 'Dec 05, 2025' },
    { id: 4, name: 'Harish R', email: 'harish@mano.co.in', role: 'Viewer', department: 'Design', status: 'Offline', joined: 'Jan 20, 2026' },
    { id: 5, name: 'Admin User', email: 'admin@mano.co.in', role: 'Admin', department: 'IT', status: 'Active', joined: 'Nov 12, 2025' },
];

const UserManagement = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const statusColors = {
        Active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        Away: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
        Offline: 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
    };

    return (
        <div className="p-8">
            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search users by name, email, or role..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center space-x-3 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <button className="flex items-center space-x-2 px-4 py-2.5 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all shrink-0">
                        <Filter size={16} />
                        <span>Filters</span>
                    </button>
                    <button className="flex items-center space-x-2 px-4 py-2.5 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all shrink-0">
                        <Download size={16} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/10">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role & Dept</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gh-border">
                        {mockUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-blue-50/30 dark:hover:bg-white/[0.01] transition-colors group">
                                <td className="px-6 py-5">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm shadow-sm ring-2 ring-white dark:ring-[#161b22]">
                                            {user.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{user.name}</p>
                                            <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                <Mail size={12} className="mr-1.5 opacity-60" />
                                                <span>{user.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-5 cursor-pointer">
                                    <div className="flex items-center space-x-2 px-2.5 py-1 bg-blue-50/50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg w-fit border border-blue-100/50 dark:border-blue-500/20">
                                        <Shield size={14} className="shrink-0" />
                                        <span className="text-xs font-semibold">{user.role}</span>
                                    </div>
                                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1.5 ml-1">{user.department}</p>
                                </td>
                                <td className="px-6 py-5">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-sm ${statusColors[user.status]}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.status === 'Active' ? 'bg-green-500' : user.status === 'Away' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                                        {user.status}
                                    </span>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 font-medium">
                                        <Calendar size={14} className="mr-2 opacity-50" />
                                        {user.joined}
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all active:scale-90">
                                        <MoreHorizontal size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-6 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 px-2">
                <p>Showing 1 to {mockUsers.length} of {mockUsers.length} users</p>
                <div className="flex space-x-2">
                    <button className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all opacity-50 cursor-not-allowed">Previous</button>
                    <button className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#161b22] text-blue-600 dark:text-blue-400 font-bold ring-1 ring-blue-500/20">1</button>
                    <button className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all font-medium">Next</button>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
