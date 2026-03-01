
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Briefcase,
    Map,
    FileText,
    HardHat,
    Calculator,
    Receipt,
    ShieldCheck,
    Box,
    MessageSquare,
    GitPullRequest,
    BarChart3,
    Settings,
    Users,
    ChevronDown,
    Search
} from 'lucide-react';

const Sidebar = () => {
    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Briefcase, label: 'Projects', path: '/projects' },
        { icon: Map, label: 'Vendors', path: '/vendors' },
        { icon: Users, label: 'Clients', path: '/clients' },
    ];

    return (
        <div className="w-[200px] bg-white dark:bg-gh-subtle text-gray-900 dark:text-gh-text h-screen flex flex-col fixed left-0 top-0 overflow-y-auto border-r border-gray-200 dark:border-gh-border transition-colors z-20">
            {/* Logo Area */}
            <div className="h-[8vh] min-h-[60px] flex items-center px-6 border-b border-gray-200 dark:border-gray-800 space-x-3">
                <img src="/mano-logo.svg" alt="MANO ERP Logo" className="w-12 h-12 object-contain" />
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                    MANO-ERP
                </span>
            </div>

            {/* Navigation & Recent */}
            <div className="flex-1 flex flex-col overflow-y-auto">
                <nav className="py-2 space-y-0.5">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center px-6 py-2.5 text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gh-hover dark:hover:text-gray-200'
                                }`
                            }
                        >
                            <item.icon size={18} className="mr-3 opacity-80" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Recent Projects Section */}
                <div className="mt-6 mb-4">
                    <div className="px-6 mb-2 flex justify-between items-center group cursor-pointer">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">Recent Projects</span>
                        <div className="flex space-x-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Search size={14} className="hover:text-gray-600 dark:hover:text-gray-300" />
                        </div>
                    </div>
                    <div className="space-y-0.5 px-3">
                        <NavLink
                            to="/projects/HM-1"
                            className={({ isActive }) =>
                                `flex items-center px-3 py-2 text-sm rounded-md transition-colors ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gh-hover'}`
                            }
                        >
                            <Box size={15} className="mr-3 text-blue-500/80" />
                            <span className="truncate">Explore Zoho Projects!</span>
                        </NavLink>
                    </div>
                </div>
            </div>

            {/* Footer / Version */}
            <div className="p-4 border-t border-gray-200 dark:border-gh-border text-xs text-gray-400 dark:text-gh-muted text-center transition-colors">
                v2.0.0 &copy; 2026
            </div>
        </div>
    );
};

export default Sidebar;
