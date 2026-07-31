import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Clock,
    Calendar,
    BarChart3,
    Users,
    ChevronDown,
    LayoutDashboard,
    Search,
    Plus,
    Download,
    Settings
} from 'lucide-react';
import { TrendingUp, AlertCircle } from 'lucide-react';

// Modular Components
import DailyProgress from './Reports/Daily/DailyProgress';
import WeeklySummary from './Reports/Weekly/WeeklySummary';
import MonthlyArchive from './Reports/Monthly/MonthlyArchive';
import TeamContribution from './Reports/Team/TeamContribution';
import DPRConfig from './Reports/DPRConfig';

// Custom UI Components
import CustomDatePicker from '../../components/CustomDatePicker';
import CustomSelect from '../../components/CustomSelect';

const Reports = ({ setExtraBreadcrumbs, canWrite, project }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('type') || 'daily';
    const subView = searchParams.get('view') || 'list';
    const [subBreadcrumb, setSubBreadcrumb] = useState('');
    // Project Identity & Context - Dynamic Progress Tracking
    const projectStartDate = new Date('2026-02-28');
    const projectEndDate = new Date('2026-07-31');
    const currentDate = new Date('2026-04-29');
    
    const calculateProjectMetrics = () => {
        const totalDuration = Math.floor((projectEndDate - projectStartDate) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.floor((currentDate - projectStartDate) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.floor((projectEndDate - currentDate) / (1000 * 60 * 60 * 24));
        const progressPercentage = Math.round((daysElapsed / totalDuration) * 100);
        
        return {
            totalDuration,
            daysElapsed,
            daysRemaining,
            progressPercentage,
            startDate: projectStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            endDate: projectEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            currentDate: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
    };
    
    const projectMetrics = calculateProjectMetrics();

    const navigateTo = (type, view = 'list') => {
        const newParams = new URLSearchParams(searchParams);
        if (type) newParams.set('type', type);
        if (view) newParams.set('view', view);
        else newParams.delete('view');
        setSearchParams(newParams);
    };

    const setActiveTab = (type) => navigateTo(type, 'list');
    const setSubView = (view) => navigateTo(activeTab, view);

    // Filter States
    const [filters, setFilters] = useState({
        daily: { date: '' },
        weekly: { week: '' },
        monthly: { month: '' }
    });

    const categories = [
        { id: 'daily', label: 'Daily Progress', icon: Clock, desc: 'Site progress' },
        { id: 'weekly', label: 'Weekly Summary', icon: Calendar, desc: 'Range review' },
        { id: 'monthly', label: 'Monthly Archive', icon: BarChart3, desc: 'History records' },
        { id: 'employee', label: 'Team Contribution', icon: Users, desc: 'Worker impact' },
        { id: 'config', label: 'DPR Configuration', icon: Settings, desc: 'Configure DPR' },
    ];

    const handleBack = React.useCallback(() => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('view');
        setSearchParams(newParams);
    }, [searchParams, setSearchParams]);

    const activeCategory = categories.find(t => t.id === activeTab) || categories[0];

    useEffect(() => {
        const bcs = [];
        const type = searchParams.get('type') || 'daily';
        const view = searchParams.get('view') || 'list';

        const cat = categories.find(c => c.id === type) || categories[0];

        bcs.push({
            label: cat.label,
            onClick: () => navigateTo(type, 'list')
        });

        if (view === 'create') {
            bcs.push({ label: 'Create New Report' });
        } else if (view === 'details') {
            bcs.push({ label: 'Report Details' });
        }

        setExtraBreadcrumbs(bcs);
    }, [searchParams.get('type'), searchParams.get('view'), setExtraBreadcrumbs, handleBack]);

    // Reset sub-view when tab changes
    useEffect(() => {
        // Only reset if we are not already on list
        if (searchParams.get('view') && searchParams.get('view') !== 'list') {
            // But wait, we might WANT deep linking. Let's only reset if it's a fresh tab change from UI
            // Actually, the user asked for URL synchronization, so we should RESPECT the URL.
            // Removing the auto-reset to 'list' might be better for deep linking.
        }
    }, [activeTab]);

    const renderHeaderActions = () => {
        return (
            <div className="flex items-center space-x-3 anim-fade-in">
                {(activeTab === 'daily' || activeTab === 'weekly' || activeTab === 'monthly') && subView === 'list' && canWrite && (
                    <button
                        onClick={() => navigateTo(activeTab, 'create')}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                        <Plus size={16} />
                        <span>Create New Report</span>
                    </button>
                )}

                {activeTab === 'daily' && subView === 'details' && (
                    <button className="flex items-center space-x-2 px-5 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-all shadow-sm">
                        <Download size={16} strokeWidth={1.5} />
                        <span>Export PDF</span>
                    </button>
                )}

            </div>
        );
    };

    const renderFilters = () => {
        if (activeTab === 'employee' || activeTab === 'config' || subBreadcrumb === 'Create Report') return null;

        return (
            <div className="flex items-center space-x-4 anim-fade-in text-left min-w-[240px]">
                {activeTab === 'daily' && subView === 'list' && (
                    <div className="w-full">
                        <CustomDatePicker
                            value={filters.daily.date}
                            onChange={(e) => setFilters({ ...filters, daily: { date: e.target.value } })}
                            placeholder="All Reports"
                        />
                    </div>
                )}

                {(activeTab === 'weekly' || activeTab === 'monthly') && (
                    <div className="w-full">
                        <CustomSelect
                            value={activeTab === 'weekly' ? filters.weekly.week : filters.monthly.month}
                            onChange={(e) => {
                                if (activeTab === 'weekly') {
                                    setFilters({ ...filters, weekly: { ...filters.weekly, week: e.target.value } });
                                } else {
                                    setFilters({ ...filters, monthly: { ...filters.monthly, month: e.target.value } });
                                }
                            }}
                            options={[
                                { label: 'All Months', value: '' },
                                ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => ({ label: m, value: m }))
                            ]}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 flex bg-white dark:bg-[#0d1117] h-full overflow-hidden Poppins">
            {/* Left Sidebar Navigation - Hidden during creation/details for immersive experience */}
            {subView !== 'create' && subView !== 'details' && (
                <div className="w-64 border-r border-gray-100 dark:border-white/5 bg-white dark:bg-[#0d1117] flex flex-col z-30 anim-slide-in-left">
                    <div className="h-20 px-6 flex items-center border-b border-gray-100 dark:border-white/5">
                        <div className="flex items-center space-x-2.5 text-gray-900 dark:text-gray-100">
                            <LayoutDashboard size={18} strokeWidth={1.5} className="text-blue-500" />
                            <span className="text-[13px] font-medium tracking-wide uppercase">Projects Reports</span>
                        </div>
                    </div>

                    <nav className="flex-1 px-3 py-6 space-y-1">
                        {categories.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    navigateTo(tab.id, 'list');
                                    setSubBreadcrumb('');
                                }}
                                className={`w-full group flex items-center px-4 py-3 transition-all duration-200 rounded-lg ${activeTab === tab.id
                                    ? 'bg-blue-50/80 text-blue-600 border-r-4 border-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500'
                                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/[0.02] hover:text-gray-900 dark:hover:text-gray-300'
                                    }`}
                            >
                                <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2 : 1.5} className="mr-3.5" />
                                <div className="text-left">
                                    <p className={`text-[13px] ${activeTab === tab.id ? 'font-medium' : 'font-normal'}`}>
                                        {tab.label}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </nav>
                </div>
            )}

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col overflow-hidden ${subView === 'create' || subView === 'details' ? 'w-full' : ''}`}>
                {/* Header Bar - Hidden during creation/details */}
                {subView !== 'create' && subView !== 'details' && (
                    <div className="h-20 px-3 flex justify-between items-center border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0d1117] z-20">
                        <div className="pl-3">
                            <h1 className="text-xl font-medium text-gray-900 dark:text-white tracking-tight">
                                {activeCategory.label}
                            </h1>
                        </div>

                        <div className="flex items-center space-x-6 pr-3">
                            {renderFilters()}
                            {renderHeaderActions()}
                        </div>
                    </div>
                )}

                {/* Local Breadcrumbs removed as they are now integrated globally */}

                {/* Scrollable Report Content - No padding during creation for full big view */}
                <div className={`flex-1 overflow-y-auto ${subView === 'create' || subView === 'details' ? 'p-0' : 'px-3 pt-2 pb-5'} custom-scrollbar bg-white dark:bg-[#0d1117]`}>
                    <div className="anim-fade-in w-full">
                        {activeTab === 'daily' && (
                            <DailyProgress
                                filters={filters.daily}
                                setSubBreadcrumb={setSubBreadcrumb}
                                view={subView}
                                setView={setSubView}
                                canWrite={canWrite}
                                project={project}
                            />
                        )}
                        {activeTab === 'weekly' && (
                            <WeeklySummary
                                filters={filters.weekly}
                                setSubBreadcrumb={setSubBreadcrumb}
                                view={subView}
                                setView={setSubView}
                                canWrite={canWrite}
                            />
                        )}
                        {activeTab === 'monthly' && (
                            <MonthlyArchive
                                filters={filters.monthly}
                                setSubBreadcrumb={setSubBreadcrumb}
                                view={subView}
                                setView={setSubView}
                                canWrite={canWrite}
                            />
                        )}
                        {activeTab === 'employee' && <TeamContribution setSubBreadcrumb={setSubBreadcrumb} canWrite={canWrite} />}
                        {activeTab === 'config' && <DPRConfig project={project} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
