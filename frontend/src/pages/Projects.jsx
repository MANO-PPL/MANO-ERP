import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Plus, List, Zap, MoreHorizontal, ArrowUpDown, ChevronDown, Box } from 'lucide-react';
import NewProjectSlideOut from '../components/NewProjectSlideOut';

const Projects = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Active Projects');
    const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

    const projectData = [
        {
            id: 'HM-1',
            name: 'Explore Zoho Projects!',
            completion: 17,
            owner: 'Nice Bike',
            status: 'Active',
            statusColor: 'bg-teal-500 text-white',
            tasks: { count: 3, percentage: 17, total: 14 },
            phases: { count: 0, percentage: 0, total: 1 },
            issues: 'Notes',
            startDate: '02 19 2026',
            endDate: '02 19 2026',
            daysAlert: '7 days a',
            tags: []
        },
        // Add more dummy data as needed to fill the UI
        {
            id: 'HM-2',
            name: 'Website Redesign',
            completion: 45,
            owner: 'Admin User',
            status: 'In Progress',
            statusColor: 'bg-blue-600 text-white',
            tasks: { count: 12, percentage: 45, total: 26 },
            phases: { count: 1, percentage: 50, total: 2 },
            issues: '2 Open',
            startDate: '01 10 2026',
            endDate: '03 15 2026',
            daysAlert: '',
            tags: []
        },
        {
            id: 'HM-3',
            name: 'Q1 Marketing Campaign',
            completion: 90,
            owner: 'Jane Doe',
            status: 'Review',
            statusColor: 'bg-yellow-500 text-white',
            tasks: { count: 45, percentage: 90, total: 50 },
            phases: { count: 3, percentage: 100, total: 3 },
            issues: 'None',
            startDate: '01 05 2026',
            endDate: '02 28 2026',
            daysAlert: '',
            tags: []
        },
    ];

    const activeCount = projectData.filter(p => !p.status.toLowerCase().includes('complete')).length;
    const completedCount = projectData.filter(p => p.status.toLowerCase().includes('complete')).length;

    const tabs = [
        { id: 'Active Projects', label: 'Active Projects', count: activeCount },
        { id: 'Completed Projects', label: 'Completed Projects', count: completedCount }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-8vh)] w-full text-gray-900 dark:text-gh-text transition-colors overflow-hidden bg-[#fafafa] dark:bg-transparent relative">
            {/* Top Sub-navigation & Toolbar Area */}
            <div className="flex justify-between items-center px-6 pt-6 pb-4 overflow-x-auto no-scrollbar bg-white dark:bg-transparent">
                {/* Left side: Tabs */}
                <div className="flex p-1 bg-gray-100 dark:bg-gray-50 dark:bg-[#161b22] rounded-full space-x-1 border border-gray-200 dark:border-gh-border">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-2 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-white text-blue-600 shadow-sm dark:bg-gh-bg dark:text-blue-400 dark:shadow-blue-900/10'
                                : 'bg-transparent text-gray-500 hover:text-gray-700 dark:text-gh-muted dark:hover:text-gh-text'
                                }`}
                        >
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`flex items-center justify-center w-[16px] h-[16px] text-[9px] font-bold rounded-full ml-1 ${activeTab === tab.id
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-red-500 text-white'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Right side: Actions */}
                <div className="flex items-center space-x-3 text-sm">
                    <button className="flex items-center space-x-1 px-4 py-2 font-medium text-gray-700 dark:text-gh-text hover:bg-gray-100 dark:hover:bg-gh-hover rounded-lg transition-colors border border-gray-200 dark:border-gh-border">
                        <List size={16} />
                        <span>List</span>
                        <ChevronDown size={14} className="ml-1 opacity-60" />
                    </button>
                    <button
                        onClick={() => setIsNewProjectOpen(true)}
                        className="flex items-center space-x-2 px-5 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        <span>New Project</span>
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto bg-white dark:bg-[#0d1117]">
                <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-[#f9fafb] dark:bg-gray-50 dark:bg-[#161b22] text-[13px] text-gray-500 dark:text-gh-muted sticky top-0 z-10 border-b border-gray-200 dark:border-gh-border tracking-wide uppercase">
                        <tr>
                            <th className="px-6 py-4 font-medium">ID</th>
                            <th className="px-6 py-4 font-medium">
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-gray-800 dark:hover:text-gh-text">
                                    <span>Project Name</span>
                                    <ArrowUpDown size={12} className="opacity-50" />
                                </div>
                            </th>
                            <th className="px-6 py-4 font-medium">%</th>
                            <th className="px-6 py-4 font-medium">
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-gray-800 dark:hover:text-gh-text">
                                    <span>Owner</span>
                                </div>
                            </th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium">Tasks</th>
                            <th className="px-6 py-4 font-medium">Phases</th>
                            <th className="px-6 py-4 font-medium">Issues</th>
                            <th className="px-6 py-4 font-medium">
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-gray-800 dark:hover:text-gh-text">
                                    <span>Start Date</span>
                                    <ArrowUpDown size={12} className="opacity-50" />
                                </div>
                            </th>
                            <th className="px-6 py-4 font-medium">
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-gray-800 dark:hover:text-gh-text">
                                    <span>End Date</span>
                                    <ArrowUpDown size={12} className="opacity-50" />
                                </div>
                            </th>
                            <th className="px-6 py-4 font-medium">Tags</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gh-border text-[13px]">
                        {projectData.map((project, index) => (
                            <tr key={index} className="hover:bg-blue-50/50 dark:hover:bg-gh-hover transition-colors group">
                                <td className="px-6 py-4 text-gray-500 dark:text-gh-muted">{project.id}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <span className="font-semibold text-gray-900 dark:text-gray-200">{project.name}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1.5 px-3 py-1 bg-transparent border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-500 rounded-md text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 whitespace-nowrap"
                                        >
                                            <Box size={14} />
                                            <span>Access Project</span>
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">{project.completion}%</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex justify-center items-center text-[11px] font-bold text-white shadow-sm overflow-hidden">
                                            {/* Dummy Avatar implementation */}
                                            <span className="z-10">{project.owner.charAt(0)}</span>
                                        </div>
                                        <span className="text-gray-700 dark:text-gray-300 font-medium">{project.owner}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded text-xs font-semibold shadow-sm ${project.statusColor}`}>
                                        {project.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-16 bg-gray-200 dark:bg-gray-700/50 h-1.5 rounded-full overflow-hidden flex">
                                            <div className="bg-green-500 h-full rounded-full" style={{ width: `${project.tasks.percentage}%` }}></div>
                                        </div>
                                        <span className="text-gray-500 dark:text-gh-muted">{project.tasks.count} / {project.tasks.total}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 bg-gray-200 dark:bg-gray-700/50 h-1.5 rounded-full overflow-hidden flex">
                                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${project.phases.percentage}%` }}></div>
                                        </div>
                                        <span className="text-gray-500 dark:text-gh-muted">{project.phases.count} / {project.phases.total}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2.5 py-1 border border-gray-200 dark:border-gh-border rounded text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gh-subtle/30 font-medium">
                                        {project.issues}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{project.startDate}</td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                    {project.endDate}
                                    {project.daysAlert && (
                                        <span className="text-red-500 ml-1.5 text-xs font-medium">({project.daysAlert})</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {/* Action icons un-hide on hover */}
                                    <div className="flex space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"><Plus size={16} /></button>
                                        <button className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"><MoreHorizontal size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer Area / Pagination */}
            <div className="flex justify-between items-center px-6 py-3 border-t border-gray-200 dark:border-gh-border bg-white dark:bg-gray-50 dark:bg-[#161b22] text-xs text-gray-500 dark:text-gh-muted">
                <div>Here is your Smart Chat (Ctrl+Space)</div>
                <div className="flex items-center space-x-4">
                    <span>Total Count: {projectData.length}</span>
                    <div className="flex items-center space-x-2 border-l border-gray-300 dark:border-gh-border pl-4">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-semibold rounded">50%</span>
                        <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors">Live Chat</button>
                    </div>
                </div>
            </div>

            <NewProjectSlideOut
                isOpen={isNewProjectOpen}
                onClose={() => setIsNewProjectOpen(false)}
            />
        </div>
    );
};

export default Projects;
