import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Settings, ChevronRight } from 'lucide-react';

// Tab Components
import Dashboard from './Dashboard';
import Tasks from './Tasks';
import WIP from './WIP';
import Reports from './Reports';
import GeneralDocuments from './GeneralDocuments/index';
import Drawings from './Drawings/index';
import Planning from './Planning/index';
import Contracts from './Contracts/index';
import Quality from './Quality/index';
import Safety from './Safety/index';
import Billing from './Billing/index';
import MaterialManagement from './MaterialManagement/index';

const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'Dashboard';

    const setActiveTab = (tab) => {
        setSearchParams({ tab });
        setExtraBreadcrumbs([]); // Clear on tab switch
    };

    const [extraBreadcrumbs, setExtraBreadcrumbs] = useState([]); // Array of { label, onClick }
    const tabs = ['Dashboard', 'Tasks', 'WIP', 'Reports', 'General Documents', 'Drawings', 'Planning', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management'];

    const renderTabContent = () => {
        const props = { setExtraBreadcrumbs };
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
            default:
                return <Tasks {...props} />;
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8vh)] w-full text-gray-900 dark:text-gray-300 bg-white dark:bg-[#0d1117] font-sans">

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
                        {id} Explore Zoho Projects!
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

                <div className="flex items-center space-x-4 text-gray-600 dark:text-gray-400">
                </div>
            </div>

            {/* Sub-Navigation */}
            <div className="flex px-6 pt-3 border-b border-gray-200 dark:border-gh-border bg-[#f9fafb] dark:bg-gh-bg transition-colors">
                {tabs.map((tab) => (
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
