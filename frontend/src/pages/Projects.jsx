import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Plus, List, Zap, MoreHorizontal, ArrowUpDown, ChevronDown, Box } from 'lucide-react';
import NewProjectSlideOut from '../components/NewProjectSlideOut';
import { projectApi } from '../services/projectApi';
import { useAuth } from '../context/AuthContext';

const Projects = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('projects', 2);
    const [activeTab, setActiveTab] = useState('Active Projects');
    const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
    const [projectToEdit, setProjectToEdit] = useState(null);

    const [projectData, setProjectData] = useState([]);

    // Tag edit states
    const [activeTagInputProjectId, setActiveTagInputProjectId] = useState(null);
    const [newTagVal, setNewTagVal] = useState('');

    // Action menu states
    const [activeActionsMenuId, setActiveActionsMenuId] = useState(null);

    const fetchProjects = async () => {
        try {
            const res = await projectApi.listProjects();
            if (res.success) {
                const mappedProjects = res.projects.map(p => {
                    let meta = {};
                    if (p.metadata) {
                        try {
                            meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
                        } catch (e) {
                            console.error("Failed to parse metadata", p.metadata, e);
                        }
                    }

                    const phasesList = meta.phases || [];
                    const totalPhases = phasesList.length;
                    const completedPhases = phasesList.filter(ph => ph.progress === 100).length;

                    return {
                        id: p.project_code || p.id.toString(),
                        dbId: p.id,
                        name: p.name,
                        location: p.location || '',
                        completion: meta.completion !== undefined ? meta.completion : 0,
                        owner: meta.employer || 'System',
                        status: p.status.charAt(0).toUpperCase() + p.status.slice(1),
                        statusColor: p.status.toLowerCase() === 'active' ? 'bg-[#2E7D32] text-white' : 'bg-blue-600 text-white',
                        memberCount: p.member_count || 0,
                        totalPhases,
                        completedPhases,
                        issues: meta.issues || 'None',
                        startDate: p.start_date ? new Date(p.start_date).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: 'numeric'}).replace(/\//g, ' ') : 'N/A',
                        endDate: p.end_date ? new Date(p.end_date).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: 'numeric'}).replace(/\//g, ' ') : 'N/A',
                        startDateRaw: p.start_date ? p.start_date.split('T')[0] : '',
                        endDateRaw: p.end_date ? p.end_date.split('T')[0] : '',
                        daysAlert: '',
                        tags: meta.tags || [],
                        metadata: meta
                    };
                });
                setProjectData(mappedProjects);
            }
        } catch (error) {
            console.error("Failed to fetch projects", error);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        const handleClickOutside = () => {
            setActiveActionsMenuId(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleUpdateIssue = async (project, newIssueStatus) => {
        try {
            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: project.status.toLowerCase(),
                project_code: project.id,
                start_date: project.startDateRaw || null,
                end_date: project.endDateRaw || null,
                metadata: {
                    ...project.metadata,
                    issues: newIssueStatus
                }
            };

            const res = await projectApi.updateProject(project.dbId, updatedPayload);
            if (res.success) {
                fetchProjects();
            }
        } catch (error) {
            console.error("Failed to update issue status", error);
        }
    };

    const handleAddTag = async (project) => {
        if (!newTagVal.trim()) return;
        const newTag = newTagVal.trim();
        const currentTags = project.tags || [];
        if (currentTags.includes(newTag)) {
            setActiveTagInputProjectId(null);
            return;
        }
        const updatedTags = [...currentTags, newTag];
        setActiveTagInputProjectId(null);

        try {
            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: project.status.toLowerCase(),
                project_code: project.id,
                start_date: project.startDateRaw || null,
                end_date: project.endDateRaw || null,
                metadata: {
                    ...project.metadata,
                    tags: updatedTags
                }
            };

            const res = await projectApi.updateProject(project.dbId, updatedPayload);
            if (res.success) {
                fetchProjects();
            }
        } catch (error) {
            console.error("Failed to add tag", error);
        }
    };

    const handleDeleteTag = async (project, tagToDelete) => {
        const currentTags = project.tags || [];
        const updatedTags = currentTags.filter(t => t !== tagToDelete);

        try {
            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: project.status.toLowerCase(),
                project_code: project.id,
                start_date: project.startDateRaw || null,
                end_date: project.endDateRaw || null,
                metadata: {
                    ...project.metadata,
                    tags: updatedTags
                }
            };

            const res = await projectApi.updateProject(project.dbId, updatedPayload);
            if (res.success) {
                fetchProjects();
            }
        } catch (error) {
            console.error("Failed to delete tag", error);
        }
    };

    const handleToggleProjectStatus = async (project) => {
        const newStatus = project.status.toLowerCase() === 'active' ? 'completed' : 'active';
        try {
            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: newStatus,
                project_code: project.id,
                start_date: project.startDateRaw || null,
                end_date: project.endDateRaw || null,
                metadata: project.metadata
            };

            const res = await projectApi.updateProject(project.dbId, updatedPayload);
            if (res.success) {
                fetchProjects();
            }
        } catch (error) {
            console.error("Failed to toggle project status", error);
        }
    };

    const handleNewProjectClick = () => {
        setProjectToEdit(null);
        setIsNewProjectOpen(true);
    };

    const handleEditProjectClick = (project) => {
        setProjectToEdit(project);
        setIsNewProjectOpen(true);
    };

    const getIssueStyles = (status) => {
        switch (status.toLowerCase()) {
            case 'risk':
                return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-500/20';
            case 'blocked':
                return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-500/20';
            case 'resolved':
                return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-500/20';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-white/5';
        }
    };

    const activeProjects = projectData.filter(p => !p.status.toLowerCase().includes('complete'));
    const completedProjects = projectData.filter(p => p.status.toLowerCase().includes('complete'));

    const filteredProjects = activeTab === 'Completed Projects' ? completedProjects : activeProjects;

    const tabs = [
        { id: 'Active Projects', label: 'Active Projects', count: activeProjects.length },
        { id: 'Completed Projects', label: 'Completed Projects', count: completedProjects.length }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-7vh)] w-full text-gray-900 dark:text-gh-text transition-colors overflow-hidden bg-[#fafafa] dark:bg-[#0d1117] relative">
            {/* Top Sub-navigation & Toolbar Area */}
            <div className="flex justify-between items-center px-6 py-2.5 overflow-x-auto no-scrollbar bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5">
                {/* Left side: Tabs */}
                <div className="inline-flex p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-1.5 px-4 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full ml-1 ${activeTab === tab.id
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
                {canWrite && (
                    <div className="flex items-center space-x-3 text-sm">
                        <button
                            onClick={handleNewProjectClick}
                            className="flex items-center space-x-2 px-5 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                        >
                            <Plus size={16} />
                            <span>New Project</span>
                        </button>
                    </div>
                )}
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
                            <th className="px-6 py-4 font-medium">Team Size</th>
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
                            <tr key={index} onClick={() => navigate(`/projects/${project.dbId}`)} className="hover:bg-blue-50/50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer">
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
                                    <span className="text-gray-700 dark:text-gray-300 font-semibold">{project.memberCount} Members</span>
                                </td>
                                <td className="px-6 py-4">
                                    {project.totalPhases === 0 ? (
                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 uppercase tracking-wider">
                                            Undefined
                                        </span>
                                    ) : (
                                        <div className="flex items-center space-x-3">
                                            <div className="w-12 bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden flex">
                                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(project.completedPhases / project.totalPhases) * 100}%` }}></div>
                                            </div>
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">{project.completedPhases} / {project.totalPhases}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 relative group/issue">
                                    <div className="flex items-center space-x-2">
                                        <span className={`px-2.5 py-1 border rounded text-xs font-semibold ${getIssueStyles(project.issues)}`}>
                                            {project.issues}
                                        </span>
                                        <div className="opacity-0 group-hover/issue:opacity-100 flex items-center space-x-1.5 transition-opacity duration-200">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleUpdateIssue(project, 'None'); }}
                                                className="w-3 h-3 rounded-full bg-gray-400 hover:scale-125 transition-transform"
                                                title="Mark None"
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleUpdateIssue(project, 'Risk'); }}
                                                className="w-3 h-3 rounded-full bg-amber-500 hover:scale-125 transition-transform"
                                                title="Mark Risk"
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleUpdateIssue(project, 'Blocked'); }}
                                                className="w-3 h-3 rounded-full bg-red-500 hover:scale-125 transition-transform"
                                                title="Mark Blocked"
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleUpdateIssue(project, 'Resolved'); }}
                                                className="w-3 h-3 rounded-full bg-green-500 hover:scale-125 transition-transform"
                                                title="Mark Resolved"
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">{project.startDate}</td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">{project.endDate}</td>
                                <td className="px-6 py-4 relative group/tags">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {project.tags.map((tag, tIdx) => (
                                            <span
                                                key={tIdx}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20"
                                            >
                                                {tag}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTag(project, tag); }}
                                                    className="text-blue-400 hover:text-red-500 transition-colors ml-0.5 font-bold"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}

                                        {activeTagInputProjectId === project.dbId ? (
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Enter Tag"
                                                value={newTagVal}
                                                onChange={(e) => setNewTagVal(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleAddTag(project);
                                                    else if (e.key === 'Escape') setActiveTagInputProjectId(null);
                                                }}
                                                onBlur={() => setActiveTagInputProjectId(null)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="px-2 py-0.5 text-[10px] border border-blue-400 bg-white dark:bg-[#161b22] rounded focus:outline-none w-20 text-gray-900 dark:text-white"
                                            />
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveTagInputProjectId(project.dbId); setNewTagVal(''); }}
                                                className="opacity-0 group-hover/tags:opacity-100 text-gray-400 hover:text-blue-600 p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
                                                title="Add Tag"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        )}

                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveActionsMenuId(activeActionsMenuId === project.dbId ? null : project.dbId); }}
                                                className="opacity-0 group-hover/tags:opacity-100 text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
                                                title="Actions"
                                            >
                                                <MoreHorizontal size={14} />
                                            </button>

                                            {activeActionsMenuId === project.dbId && (
                                                <div className="absolute right-0 mt-1.5 w-32 bg-white dark:bg-[#1A2235] border border-gray-200 dark:border-[#2A3445] rounded-xl shadow-xl z-50 overflow-hidden py-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActiveActionsMenuId(null); handleEditProjectClick(project); }}
                                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 font-semibold transition-colors"
                                                    >
                                                        Edit Details
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActiveActionsMenuId(null); handleToggleProjectStatus(project); }}
                                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 font-semibold transition-colors border-t border-gray-100 dark:border-white/5"
                                                    >
                                                        Toggle Status
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <NewProjectSlideOut
                isOpen={isNewProjectOpen}
                onClose={() => { setIsNewProjectOpen(false); setProjectToEdit(null); }}
                projectToEdit={projectToEdit}
                onProjectCreated={() => {
                    setIsNewProjectOpen(false);
                    setProjectToEdit(null);
                    fetchProjects();
                }}
            />
        </div>
    );
};

export default Projects;
