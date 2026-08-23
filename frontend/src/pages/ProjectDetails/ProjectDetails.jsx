import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { projectApi } from '../../services/projectApi';
import { useAuth } from '../../context/AuthContext';
import PageSkeleton from '../../components/PageSkeleton';
import LogoLoader from '../../components/LogoLoader';

// Tab Components
import Dashboard from './Dashboard';
import Tasks from './Tasks';
import WIP from './WIP';
import Reports from './Reports';
import GeneralDocuments from './GeneralDocuments/GeneralDocumentsIndex';
import Drawings from './Drawings/DrawingsIndex';
import Planning from './Planning/PlanningIndex';
import Phases from './Phases';
import Contracts from './Contracts/ContractsIndex';
import Quality from './Quality/Quality';
import Safety from './Safety/SafetyIndex';
import Billing from './Billing/BillingIndex';
import MaterialManagement from './MaterialManagement/MaterialManagementIndex';
import Approvals from './Approvals/Approvals';
import ProjectSettings from './Settings/ProjectSettings';
import Transactions from './Transactions/TransactionsIndex';
import ProjectSpreadsheets from './Spreadsheets/ProjectSpreadsheets';

const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'Dashboard';

    const [project, setProject] = useState(null);
    const [projectPermissions, setProjectPermissions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [extraBreadcrumbs, setExtraBreadcrumbs] = useState([]); // Array of { label, onClick }

    // Sanitize extraBreadcrumbs to remove duplicates of activeTab
    const sanitizedExtraBreadcrumbs = useMemo(() => {
        if (!Array.isArray(extraBreadcrumbs)) return [];
        return extraBreadcrumbs.filter(bc => bc && bc.label && bc.label.trim().toLowerCase() !== activeTab.trim().toLowerCase());
    }, [extraBreadcrumbs, activeTab]);

    const loadProject = async () => {
        // Seed initial project data from cached project list for instant UI load
        const cachedList = sessionStorage.getItem('crm_projects_list');
        if (cachedList && !project) {
            try {
                const projectsArr = JSON.parse(cachedList);
                const found = projectsArr.find(p => String(p.dbId) === String(id) || String(p.id) === String(id));
                if (found) {
                    const foundProj = {
                        id: found.dbId,
                        name: found.name,
                        project_code: found.id,
                        location: found.location,
                        status: found.status?.toLowerCase() || 'active',
                        metadata: found.metadata
                    };
                    setProject(foundProj);
                    try {
                        sessionStorage.setItem(`active_project_info_${id}`, JSON.stringify({ name: foundProj.name, project_code: foundProj.project_code }));
                        window.dispatchEvent(new CustomEvent('active-project-updated', { detail: { id, name: foundProj.name, project_code: foundProj.project_code } }));
                    } catch (e) { }
                    setLoading(false);
                } else {
                    setLoading(true);
                }
            } catch (e) {
                setLoading(true);
            }
        } else if (!project) {
            setLoading(true);
        }

        try {
            const res = await projectApi.getProject(id);
            if (res.success) {
                setProject(res.project);
                try {
                    sessionStorage.setItem(`active_project_info_${id}`, JSON.stringify({ name: res.project.name, project_code: res.project.project_code }));
                    window.dispatchEvent(new CustomEvent('active-project-updated', { detail: { id, name: res.project.name, project_code: res.project.project_code } }));
                } catch (e) { }
                
                // Normalize permission levels from string format to numbers
                const rawPerms = res.projectPermissions || {};
                const normalizedPerms = {};
                const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };
                for (const [k, v] of Object.entries(rawPerms)) {
                    if (typeof v === 'string') {
                        normalizedPerms[k] = map[v.toLowerCase()] ?? 0;
                    } else {
                        normalizedPerms[k] = v;
                    }
                }
                setProjectPermissions(normalizedPerms);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to load project');
            if (err.response?.status === 403 || err.response?.status === 401) {
                navigate('/projects');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProject();
    }, [id, navigate]);

    const setActiveTab = (tab) => {
        setSearchParams({ tab });
        setExtraBreadcrumbs([]); // Clear on tab switch
    };


    const allTabs = [
        'Dashboard', 'Tasks', 'WIP', 'Reports', 'General Documents', 'Spreadsheets', 'Drawings', 
        'Planning', 'Phases', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management',
        'Transactions', 'Approvals', 'Settings'
    ];

    const allowedTabs = allTabs.filter(tab => {
        // Dashboard is always visible to any project member
        if (tab === 'Dashboard') return true;
        // Admins see everything
        if (isAdmin) return true;
        // If no permissions object at all, or it's empty → only Dashboard is accessible
        if (!projectPermissions || Object.keys(projectPermissions).length === 0) return false;
        // Check the permission level for this tab (try exact key, lowercase, and underscore variant)
        const lvl = projectPermissions?.[tab]
            ?? projectPermissions?.[tab.toLowerCase()]
            ?? projectPermissions?.[tab.replace(/\s+/g, '_').toLowerCase()];
        // If the key is not present at all, deny (explicit grant required)
        if (lvl === undefined || lvl === null) return false;
        return lvl >= 1;
    });

    useEffect(() => {
        if (!loading && allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
            setSearchParams({ tab: allowedTabs[0] });
        }
    }, [activeTab, allowedTabs, loading, setSearchParams]);

    if (loading) {
        return (
            <div className="flex-1 w-full h-full min-h-[400px] flex items-center justify-center bg-white dark:bg-[#0d1117]">
                <LogoLoader text="Rendering Project Workspace..." size="lg" fullPage={false} />
            </div>
        );
    }

    const renderTabContent = () => {
        const tabKey = activeTab;
        const activeTabLvl = isAdmin 
            ? 2 
            : (projectPermissions?.[tabKey] ?? projectPermissions?.[tabKey.toLowerCase()] ?? projectPermissions?.[tabKey.replace(/\s+/g, '_').toLowerCase()] ?? 0);
        const canWrite = isAdmin || activeTabLvl >= 2;
        const props = { setExtraBreadcrumbs, project, projectPermissions, isAdmin, user, canWrite, setActiveTab };
        switch (activeTab) {
            case 'Dashboard':
                return <Dashboard {...props} />;
            case 'Tasks':
                return <Tasks {...props} />;
            case 'WIP':
                return <WIP {...props} />;
            case 'Reports':
                return <Reports {...props} />;
            case 'General Documents':
                return <GeneralDocuments {...props} />;
            case 'Spreadsheets':
                return <ProjectSpreadsheets {...props} />;
            case 'Drawings':
                return <Drawings {...props} />;
            case 'Planning':
                return <Planning {...props} />;
            case 'Phases':
                return <Phases {...props} />;
            case 'Contracts':
                return <Contracts {...props} />;
            case 'Quality':
                return <Quality {...props} />;
            case 'Safety':
                return <Safety {...props} />;
            case 'Billing':
                return <Billing {...props} />;
            case 'Material Management':
                return <MaterialManagement {...props} />;
            case 'Transactions':
                return <Transactions {...props} />;
            case 'Approvals':
                return <Approvals {...props} />;
            case 'Settings':
                return <ProjectSettings {...props} reloadProject={loadProject} />;
            default:
                return <Dashboard {...props} />;
        }
    };

    return (
        <div className="flex flex-col h-full w-full text-gray-900 dark:text-gray-300 bg-white dark:bg-[#0d1117] font-sans">
            {/* Sub-Navigation Tabs (Dashboard, WIP, Material Management, etc.) */}
            <div className="h-10 flex items-center px-3 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg transition-colors overflow-x-auto custom-scrollbar shrink-0 select-none">
                {allowedTabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`h-full inline-flex items-center justify-center px-3.5 text-xs font-semibold border-b-2 -mb-px transition-colors duration-200 whitespace-nowrap cursor-pointer ${activeTab === tab
                            ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Breadcrumbs (Below the Navigation Tabs) */}
            <div className="flex justify-between items-center px-3 py-1.5 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#161b22]/30 transition-colors shrink-0 text-xs">
                <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <button
                        onClick={() => navigate('/projects')}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium cursor-pointer"
                    >
                        Projects
                    </button>
                    <ChevronRight size={12} className="text-gray-400 dark:text-gray-600" />
                    <span
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium cursor-pointer"
                        onClick={() => {
                            if (activeTab !== 'Dashboard' || extraBreadcrumbs.length > 0) {
                                setActiveTab('Dashboard');
                            }
                        }}
                    >
                        {project?.project_code || id} {project?.name ? `- ${project.name}` : ''}
                    </span>
                    <ChevronRight size={12} className="text-gray-400 dark:text-gray-600" />
                    {/* Active Main Tab Breadcrumb */}
                    <span
                        className={`transition-colors ${sanitizedExtraBreadcrumbs.length === 0 ? 'text-gray-900 dark:text-white font-semibold' : 'text-blue-600 dark:text-blue-400 font-medium cursor-pointer'}`}
                        onClick={() => {
                            if (sanitizedExtraBreadcrumbs.length > 0) {
                                setExtraBreadcrumbs([]);
                                const newParams = new URLSearchParams(searchParams);
                                newParams.delete('view');
                                newParams.delete('report');
                                newParams.delete('aid');
                                newParams.delete('mid');
                                setSearchParams(newParams);
                            }
                        }}
                    >
                        {activeTab}
                    </span>
                    {sanitizedExtraBreadcrumbs.map((bc, index) => (
                        <React.Fragment key={index}>
                            <ChevronRight size={12} className="text-gray-400 dark:text-gray-600" />
                            <span
                                className={`transition-colors ${index === sanitizedExtraBreadcrumbs.length - 1 ? 'text-gray-900 dark:text-white font-semibold' : 'text-blue-600 dark:text-blue-400 font-medium cursor-pointer'}`}
                                onClick={() => {
                                    if (bc.onClick) bc.onClick();
                                    else if (bc.path) navigate(bc.path);
                                }}
                            >
                                {bc.label}
                            </span>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            {renderTabContent()}
        </div>
    );
};

export default ProjectDetails;
