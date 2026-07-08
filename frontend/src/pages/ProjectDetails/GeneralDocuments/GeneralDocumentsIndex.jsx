import React, { useState } from 'react';
import { FileText, FileSpreadsheet, FileImage, FileStack, ChevronRight } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ProjectVendorList from './ProjectVendorList';
import ProjectDirectory from './ProjectDirectory';
import StaffRoles from './StaffRoles';
import ProjectSummary from './ProjectSummary';
import OrganisationChart from './OrganisationChart';
import AgendaList from './Agenda/AgendaList';
import AgendaDetail from './Agenda/AgendaDetail';
import MoMList from './MinutesOfMeeting/MoMList';
import MoMDetail from './MinutesOfMeeting/MoMDetail';

const GeneralDocumentsIndex = ({ setExtraBreadcrumbs, canWrite }) => {
    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentView = searchParams.get('view') || 'grid';

    const setCurrentView = React.useCallback((view) => {
        const newParams = new URLSearchParams(searchParams);
        if (view === 'grid') newParams.delete('view');
        else newParams.set('view', view);
        setSearchParams(newParams);
    }, [searchParams, setSearchParams]);

    const handleBack = React.useCallback(() => setCurrentView('grid'), [setCurrentView]);
    const handleAgendaBack = React.useCallback(() => setCurrentView('agenda-list'), [setCurrentView]);
    const handleMomBack = React.useCallback(() => setCurrentView('mom-list'), [setCurrentView]);

    const navigate = useNavigate();

    React.useEffect(() => {
        if (currentView === 'grid') {
            setExtraBreadcrumbs([{ label: 'General Documents' }]);
        }
    }, [currentView, setExtraBreadcrumbs]);

    if (currentView === 'vendor-list') {
        return <ProjectVendorList onBack={handleBack} setExtraBreadcrumbs={setExtraBreadcrumbs} canWrite={canWrite} />;
    }
    if (currentView === 'directory') {
        return <ProjectDirectory onBack={handleBack} setExtraBreadcrumbs={setExtraBreadcrumbs} canWrite={canWrite} />;
    }
    if (currentView === 'staff-roles') {
        return <StaffRoles onBack={handleBack} setExtraBreadcrumbs={setExtraBreadcrumbs} canWrite={canWrite} />;
    }
    if (currentView === 'project-summary') {
        return <ProjectSummary onBack={handleBack} setExtraBreadcrumbs={setExtraBreadcrumbs} canWrite={canWrite} />;
    }
    if (currentView === 'org-chart') {
        return <OrganisationChart onBack={handleBack} setExtraBreadcrumbs={setExtraBreadcrumbs} canWrite={canWrite} />;
    }
    if (currentView === 'agenda-list') {
        return <AgendaList onBack={handleBack} setExtraBreadcrumbs={setExtraBreadcrumbs} canWrite={canWrite} onSelect={(aid) => {
            const newParams = new URLSearchParams(searchParams);
            newParams.set('view', 'agenda-detail');
            newParams.set('aid', aid);
            setSearchParams(newParams);
        }} />;
    }
    if (currentView === 'agenda-detail') {
        return <AgendaDetail onBack={handleAgendaBack} setExtraBreadcrumbs={setExtraBreadcrumbs} agendaId={searchParams.get('aid')} canWrite={canWrite} />;
    }
    if (currentView === 'mom-list') {
        return <MoMList onBack={handleBack} setExtraBreadcrumbs={setExtraBreadcrumbs} canWrite={canWrite} onSelect={(mid) => {
            const newParams = new URLSearchParams(searchParams);
            newParams.set('view', 'mom-detail');
            newParams.set('mid', mid);
            setSearchParams(newParams);
        }} />;
    }
    if (currentView === 'mom-detail') {
        return <MoMDetail onBack={handleMomBack} setExtraBreadcrumbs={setExtraBreadcrumbs} momId={searchParams.get('mid')} canWrite={canWrite} />;
    }

    const categories = [
        { name: 'Project Vendor List', icon: <FileSpreadsheet size={24} />, view: 'vendor-list' },
        { name: 'Project Directory', icon: <FileText size={24} />, view: 'directory' },
        { name: "MANO's Staff Role & Responsibilities", icon: <FileStack size={24} />, view: 'staff-roles' },
        { name: 'Project Summary', icon: <FileText size={24} />, view: 'project-summary' },
        { name: 'Agenda of Meeting', icon: <FileText size={24} />, view: 'agenda-list' },
        { name: 'Minutes of Meeting', icon: <FileText size={24} />, view: 'mom-list' },
        { name: 'Organisation Chart', icon: <FileImage size={24} />, view: 'org-chart' },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            {/* Content Area - Full Width */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="w-full space-y-6">

                    {/* Main Categories - Full Width Horizontal Cards */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {categories.map((cat, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    if (cat.path) navigate(cat.path);
                                    else if (cat.view) setCurrentView(cat.view);
                                }}
                                className="group relative bg-white dark:bg-[#161b22] px-8 py-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500/40 transition-all duration-500 cursor-pointer flex items-center overflow-hidden"
                            >
                                {/* Animated Background Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/0 to-blue-600/[0.02] group-hover:via-blue-600/[0.04] transition-all duration-700"></div>

                                {/* Vertical Accent */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-gray-200 dark:bg-white/10 rounded-r-full group-hover:h-16 group-hover:bg-blue-500 transition-all duration-500"></div>

                                <div className="relative flex items-center w-full">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/[0.03] rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner border border-transparent group-hover:border-blue-400/50 group-hover:rotate-[10deg] group-hover:scale-110">
                                        {cat.icon}
                                    </div>

                                    <div className="ml-8 flex-1 text-left">
                                        <div className="flex items-center space-x-3 mb-1.5">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-tight group-hover:text-blue-500 transition-colors uppercase font-black">
                                                {cat.name}
                                            </h3>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">Click to explore archive</span>
                                            <div className="h-px w-12 bg-gray-100 dark:bg-white/10 group-hover:w-24 group-hover:bg-blue-500/30 transition-all duration-700"></div>
                                        </div>
                                    </div>

                                    <div className="opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                                        <div className="w-10 h-10 rounded-full border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                            <ChevronRight size={18} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneralDocumentsIndex;
