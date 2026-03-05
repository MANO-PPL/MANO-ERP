import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    BarChart3, Truck, Users,
    LayoutList, AlertOctagon, FileStack, ChevronRight
} from 'lucide-react';
import BudgetIndex from '../Contracts/Budget/index';
import HindranceReport from './HindranceReport/index';
import MaterialHistogram from './MaterialHistogram/index';
import ProjectPlanningBarChart from './ProjectPlanningBarChart/index';
import ManpowerHistogram from './ManpowerHistogram/index';
import LogisticPlan from './LogisticPlan/index';

const GDCard = ({ name, onClick }) => {
    const icons = {
        'Project Planning & Bar Chart': BarChart3,
        'Logistic Plan': Truck,
        'Manpower Histogram': Users,
        'Material Histogram': LayoutList,
        'Events / Hindrance Report': AlertOctagon,
        'Budget': FileStack,
    };
    const Icon = icons[name] || FileStack;
    return (
        <div
            onClick={onClick}
            className="group relative bg-white dark:bg-[#161b22] px-8 py-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500/40 transition-all duration-500 cursor-pointer flex items-center overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/0 to-blue-600/[0.02] group-hover:via-blue-600/[0.04] transition-all duration-700" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-gray-200 dark:bg-white/10 rounded-r-full group-hover:h-16 group-hover:bg-blue-500 transition-all duration-500" />
            <div className="relative flex items-center w-full">
                <div className="w-16 h-16 bg-gray-50 dark:bg-white/[0.03] rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner border border-transparent group-hover:border-blue-400/50 group-hover:rotate-[10deg] group-hover:scale-110">
                    <Icon size={24} />
                </div>
                <div className="ml-8 flex-1 text-left">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-tight group-hover:text-blue-500 transition-colors uppercase mb-1.5">{name}</h3>
                    <div className="flex items-center space-x-3">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">Click to explore archive</span>
                        <div className="h-px w-12 bg-gray-100 dark:bg-white/10 group-hover:w-24 group-hover:bg-blue-500/30 transition-all duration-700" />
                    </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                    <div className="w-10 h-10 rounded-full border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                        <ChevronRight size={18} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const PlanningIndex = ({ setExtraBreadcrumbs }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const reportParam = searchParams.get('report');
    const [view, setView] = useState(reportParam || 'grid');

    // Sync state with URL changes (back/forward)
    useEffect(() => {
        const currentReport = searchParams.get('report') || 'grid';
        if (currentReport !== view) {
            setView(currentReport);
        }
    }, [searchParams]);

    useEffect(() => {
        if (view === 'grid') {
            setExtraBreadcrumbs([{ label: 'Planning' }]);
        }
    }, [view, setExtraBreadcrumbs]);

    const handleNavigate = (newView) => {
        setView(newView);
        const newParams = new URLSearchParams(searchParams);
        if (newView === 'grid') {
            newParams.delete('report');
        } else {
            newParams.set('report', newView);
        }
        setSearchParams(newParams);
    };

    const openBudget = () => {
        handleNavigate('budget');
        setExtraBreadcrumbs([
            { label: 'Planning', onClick: () => handleNavigate('grid') },
            { label: 'Budget' },
        ]);
    };

    const openHindranceReport = () => {
        handleNavigate('hindrance-report');
    };

    const openMaterialHistogram = () => {
        handleNavigate('material-histogram');
    };

    const openProjectPlanning = () => {
        handleNavigate('project-planning');
    };

    const openManpowerHistogram = () => {
        handleNavigate('manpower-histogram');
    };

    const openLogisticPlan = () => {
        handleNavigate('logistic-plan');
    };

    if (view === 'budget') {
        return <BudgetIndex onBack={() => handleNavigate('grid')} setExtraBreadcrumbs={setExtraBreadcrumbs} />;
    }

    if (view === 'hindrance-report') {
        return <HindranceReport onBack={() => handleNavigate('grid')} setExtraBreadcrumbs={setExtraBreadcrumbs} />;
    }

    if (view === 'material-histogram') {
        return <MaterialHistogram onBack={() => handleNavigate('grid')} setExtraBreadcrumbs={setExtraBreadcrumbs} />;
    }

    if (view === 'project-planning') {
        return <ProjectPlanningBarChart onBack={() => handleNavigate('grid')} setExtraBreadcrumbs={setExtraBreadcrumbs} />;
    }

    if (view === 'manpower-histogram') {
        return <ManpowerHistogram onBack={() => handleNavigate('grid')} setExtraBreadcrumbs={setExtraBreadcrumbs} />;
    }

    if (view === 'logistic-plan') {
        return <LogisticPlan onBack={() => handleNavigate('grid')} setExtraBreadcrumbs={setExtraBreadcrumbs} />;
    }

    const items = [
        { name: 'Project Planning & Bar Chart', onClick: openProjectPlanning },
        { name: 'Logistic Plan', onClick: openLogisticPlan },
        { name: 'Manpower Histogram', onClick: openManpowerHistogram },
        { name: 'Material Histogram', onClick: openMaterialHistogram },
        { name: 'Events / Hindrance Report', onClick: openHindranceReport },
        { name: 'Budget', onClick: openBudget },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {items.map((d, i) => <GDCard key={i} name={d.name} onClick={d.onClick} />)}
                </div>
            </div>
        </div>
    );
};

export default PlanningIndex;
