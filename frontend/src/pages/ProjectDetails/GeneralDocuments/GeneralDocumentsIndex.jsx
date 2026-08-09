import React, { useState } from 'react';
import { FileText, FileSpreadsheet, FileImage, FileStack, ChevronRight } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ProjectPartiesList from './ProjectPartiesList';
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

    if (currentView === 'party-list') {
        return <ProjectPartiesList onBack={handleBack} setExtraBreadcrumbs={setExtraBreadcrumbs} canWrite={canWrite} />;
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
        { 
            name: 'Project Parties',
            desc: 'Directory of clients, PMCs, contractors, suppliers, consultants, and other project parties.',
            icon: <FileSpreadsheet size={20} />, 
            view: 'party-list',
            type: 'Single Instance'
        },
        { 
            name: 'Project Directory', 
            desc: 'Contact details, designations, and address information for all team members.', 
            icon: <FileText size={20} />, 
            view: 'directory', 
            type: 'Single Instance'
        },
        { 
            name: "Staff Role & Responsibilities", 
            desc: "Internal staff assignments, primary roles, and core responsibilities.", 
            icon: <FileStack size={20} />, 
            view: 'staff-roles', 
            type: 'Single Instance'
        },
        { 
            name: 'Project Summary', 
            desc: 'High-level project scope summary, milestones, and active status updates.', 
            icon: <FileText size={20} />, 
            view: 'project-summary', 
            type: 'Single Instance'
        },
        { 
            name: 'Agenda of Meeting', 
            desc: 'List of meeting schedules, subjects, participants, and discussion points.', 
            icon: <FileText size={20} />, 
            view: 'agenda-list', 
            type: 'Episodic'
        },
        { 
            name: 'Minutes of Meeting', 
            desc: 'Official discussion records, action items, assignees, and target dates.', 
            icon: <FileText size={20} />, 
            view: 'mom-list', 
            type: 'Episodic'
        },
        { 
            name: 'Organisation Chart', 
            desc: 'Interactive structural view of project parties and directory relationships.',
            icon: <FileImage size={20} />, 
            view: 'org-chart', 
            type: 'Single Instance'
        },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            {/* Content Area - Full Width */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="w-full space-y-6">

                    {/* Main Categories - Grid of elegant vertical cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map((cat, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: i * 0.05 }}
                                onClick={() => {
                                    if (cat.path) navigate(cat.path);
                                    else if (cat.view) setCurrentView(cat.view);
                                }}
                                className="group relative bg-white dark:bg-[#161b22] p-4 rounded-xl border border-gray-200/60 dark:border-white/5 shadow-sm hover:shadow-md hover:border-blue-500/40 hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[145px] overflow-hidden"
                            >
                                {/* Background gradient glow on hover */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-indigo-600/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                <div className="relative flex flex-col h-full justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between w-full">
                                            {/* Icon Container */}
                                            <div className="w-10 h-10 bg-gray-50 dark:bg-white/[0.03] rounded-lg flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 shadow-inner border border-gray-100/50 dark:border-white/5 group-hover:scale-105 transition-all duration-300">
                                                {cat.icon}
                                            </div>

                                            {/* Type Badge */}
                                            <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-full border ${
                                                cat.type === 'Single Instance'
                                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                    : 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                                            }`}>
                                                {cat.type}
                                            </span>
                                        </div>

                                        {/* Text Info */}
                                        <div className="space-y-1 text-left">
                                            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight leading-tight group-hover:text-blue-500 transition-colors duration-300">
                                                {cat.name}
                                            </h3>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-300/80 leading-relaxed font-light line-clamp-2">
                                                {cat.desc}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action link */}
                                    <div className="flex items-center space-x-2 pt-2 border-t border-gray-100/50 dark:border-white/5 w-full">
                                        <span className="text-[8px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-300">
                                            Open Document
                                        </span>
                                        <ChevronRight size={8} className="text-gray-400 dark:text-gh-text group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5 duration-300" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneralDocumentsIndex;
