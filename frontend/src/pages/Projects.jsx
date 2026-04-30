import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Plus, List, Zap, MoreHorizontal, ArrowUpDown, ChevronDown, Box } from 'lucide-react';
import NewProjectSlideOut from '../components/NewProjectSlideOut';
import { projectApi } from '../services/projectApi';

const Projects = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Active Projects');
    const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

    const [projectData, setProjectData] = useState([]);

    const fetchProjects = async () => {
        try {
            const res = await projectApi.listProjects();
            if (res.success) {
                const mappedProjects = res.projects.map(p => ({
                    id: p.project_code || p.id.toString(),
                    dbId: p.id,
                    name: p.name,
                    completion: 0, // Mock
                    owner: 'System', // Mock
                    status: p.status.charAt(0).toUpperCase() + p.status.slice(1),
                    statusColor: p.status.toLowerCase() === 'active' ? 'bg-teal-500 text-white' : 'bg-blue-600 text-white',
                    tasks: { count: 0, percentage: 0, total: 10 },
                    phases: { count: 0, percentage: 0, total: 2 },
                    issues: 'None',
                    startDate: new Date(p.start_date).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: 'numeric'}).replace(/\//g, ' '),
                    endDate: p.end_date ? new Date(p.end_date).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: 'numeric'}).replace(/\//g, ' ') : 'N/A',
                    daysAlert: '',
                    tags: []
                }));
                setProjectData(mappedProjects);
            }
        } catch (error) {
            console.error("Failed to fetch projects", error);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const activeProjects = projectData.filter(p => !p.status.toLowerCase().includes('complete'));
    const completedProjects = projectData.filter(p => p.status.toLowerCase().includes('complete'));

    const filteredProjects = activeTab === 'Completed Projects' ? completedProjects : activeProjects;

    const tabs = [
        { id: 'Active Projects', label: 'Active Projects', count: activeProjects.length },
        { id: 'Completed Projects', label: 'Completed Projects', count: completedProjects.length }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-8vh)] w-full text-gray-900 dark:text-gh-text transition-colors overflow-hidden bg-[#fafafa] dark:bg-[#0d1117] relative">
            {/* Top Sub-navigation & Toolbar Area */}
            <div className="flex justify-between items-center px-6 py-3 overflow-x-auto no-scrollbar bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5">
                {/* Left side: Tabs */}
                <div className="inline-flex p-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-2 px-6 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full ml-1 ${activeTab === tab.id
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
                    <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-[13px] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-wide uppercase">
                        <tr>
                            <th className="px-6 py-4 font-medium">ID</th>
                            <th className="px-6 py-4 font-medium">
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                                    <span>Project Name</span>
                                    <ArrowUpDown size={12} className="opacity-50" />
                                </div>
                            </th>
                            <th className="px-6 py-4 font-medium">%</th>
                            <th className="px-6 py-4 font-medium">
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                                    <span>Owner</span>
                                </div>
                            </th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium">Tasks</th>
                            <th className="px-6 py-4 font-medium">Phases</th>
                            <th className="px-6 py-4 font-medium">Issues</th>
                            <th className="px-6 py-4 font-medium">
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                                    <span>Start Date</span>
                                    <ArrowUpDown size={12} className="opacity-50" />
                                </div>
                            </th>
                            <th className="px-6 py-4 font-medium">
                                <div className="flex items-center space-x-1 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                                    <span>End Date</span>
                                    <ArrowUpDown size={12} className="opacity-50" />
                                </div>
                            </th>
                            <th className="px-6 py-4 font-medium">Tags</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-[13px]">
                        {filteredProjects.map((project, index) => (
                            <tr key={index} className="hover:bg-blue-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono">{project.id}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">{project.name}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.dbId}`); }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1.5 px-3 py-1 bg-transparent border border-blue-600 dark:border-blue-500/50 text-blue-600 dark:text-blue-400 rounded-md text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-500/10 whitespace-nowrap"
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
                                        <div className="w-16 bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden flex">
                                            <div className="bg-green-500 h-full rounded-full" style={{ width: `${project.tasks.percentage}%` }}></div>
                                        </div>
                                        <span className="text-gray-500 dark:text-gray-400 font-medium">{project.tasks.count} / {project.tasks.total}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden flex">
                                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${project.phases.percentage}%` }}></div>
                                        </div>
                                        <span className="text-gray-500 dark:text-gray-400 font-medium">{project.phases.count} / {project.phases.total}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2.5 py-1 border border-gray-200 dark:border-white/10 rounded text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-white/5 font-medium">
                                        {project.issues}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">{project.startDate}</td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">
                                    {project.endDate}
                                    {project.daysAlert && (
                                        <span className="text-red-500 ml-1.5 text-xs font-bold">({project.daysAlert})</span>
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



            <NewProjectSlideOut
                isOpen={isNewProjectOpen}
                onClose={() => setIsNewProjectOpen(false)}
                onProjectCreated={() => {
                    setIsNewProjectOpen(false);
                    fetchProjects();
                }}
            />
        </div>
    );
};

export default Projects;
