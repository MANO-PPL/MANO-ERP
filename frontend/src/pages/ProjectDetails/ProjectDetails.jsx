import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { projectApi } from '../../services/projectApi';
import { useAuth } from '../../context/AuthContext';
import PageSkeleton from '../../components/PageSkeleton';

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

const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'Dashboard';

    const [project, setProject] = useState(null);
    const [projectPermissions, setProjectPermissions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [extraBreadcrumbs, setExtraBreadcrumbs] = useState([]); // Array of { label, onClick }

    useEffect(() => {
        const loadProject = async () => {
            setLoading(true);
            try {
                const res = await projectApi.getProject(id);
                if (res.success) {
                    setProject(res.project);
                    
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
        loadProject();
    }, [id, navigate]);

    const setActiveTab = (tab) => {
        setSearchParams({ tab });
        setExtraBreadcrumbs([]); // Clear on tab switch
    };

    const isAdmin = ['admin', 'super admin', 'superadmin', 'super_admin'].includes(user?.user_type?.toLowerCase());

    const allTabs = [
        'Dashboard', 'Tasks', 'WIP', 'Reports', 'General Documents', 'Drawings', 
        'Planning', 'Phases', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management', 'Approvals'
    ];

    const allowedTabs = allTabs.filter(tab => {
        if (tab === 'Dashboard') return true;
        if (isAdmin) return true;
        const lvl = projectPermissions?.[tab] ?? 0;
        return lvl >= 1;
    });

    useEffect(() => {
        if (!loading && allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
            setSearchParams({ tab: allowedTabs[0] });
        }
    }, [activeTab, allowedTabs, loading, setSearchParams]);

    if (loading) {
        return <PageSkeleton variant="grid" />;
    }

    const renderTabContent = () => {
        const activeTabLvl = projectPermissions?.[activeTab] ?? 0;
        const canWrite = isAdmin || activeTabLvl >= 2;
        const props = { setExtraBreadcrumbs, project, projectPermissions, isAdmin, user, canWrite };
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
            case 'Approvals':
                return <Approvals {...props} />;
            default:
                return <Dashboard {...props} />;
        }
    };

    return (
        <div className="flex flex-col h-full w-full text-gray-900 dark:text-gray-300 bg-white dark:bg-[#0d1117] font-sans">
            {/* Minimal Header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg transition-colors">
                <div className="flex items-center space-x-2 text-xs">
                    <button
                        onClick={() => navigate('/projects')}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium cursor-pointer"
                    >
                        Projects
                    </button>
                    <ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />
                    <span
                        className={`transition-colors ${extraBreadcrumbs.length > 0 ? 'text-blue-600 dark:text-blue-400 font-medium cursor-pointer' : 'text-gray-900 dark:text-white font-semibold'}`}
                        onClick={() => extraBreadcrumbs.length > 0 && setActiveTab('Dashboard')}
                    >
                        {project?.project_code || id} {project?.name ? `- ${project.name}` : ''}
                    </span>
                    {extraBreadcrumbs.map((bc, index) => (
                        <React.Fragment key={index}>
                            <ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />
                            <span
                                className={`transition-colors ${index === extraBreadcrumbs.length - 1 ? 'text-gray-900 dark:text-white font-semibold' : 'text-blue-600 dark:text-blue-400 font-medium cursor-pointer'}`}
                                onClick={bc.onClick}
                            >
                                {bc.label}
                            </span>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Sub-Navigation */}
            <div className="flex px-6 pt-3 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg transition-colors">
                {allowedTabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-2.5 px-4 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === tab
                            ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {renderTabContent()}
        </div>
    );
};

export default ProjectDetails;
