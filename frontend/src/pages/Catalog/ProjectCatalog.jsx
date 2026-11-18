import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
    Package,
    Layers
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import ResourcesTab from './ResourcesTab';
import ActivitiesTab from './ActivitiesTab';

/**
 * Project-Level Catalog Component
 * Direct, fast, zero redundant banner cards.
 */
export default function ProjectCatalog({
    projectId: propProjectId,
    project: propProject,
    setExtraBreadcrumbs
}) {
    const { id: paramId } = useParams();
    const [searchParams] = useSearchParams();
    const resolvedProjectId = Number(propProjectId || propProject?.id || paramId);
    const isViewingResource = Boolean(searchParams.get('res'));

    const [activeTab, setActiveTab] = useState('resources'); // 'resources' | 'activities'
    const [units, setUnits] = useState([]);
    const [projectName, setProjectName] = useState(propProject?.name || `Project #${resolvedProjectId}`);

    // Load Units once
    useEffect(() => {
        let active = true;
        const loadUnits = async () => {
            try {
                const data = await catalogApi.listUnits();
                if (active) setUnits(data || []);
            } catch (_) {}
        };
        loadUnits();
        return () => { active = false; };
    }, []);

    // Load Project details if not passed as prop
    useEffect(() => {
        if (propProject?.name) {
            setProjectName(propProject.name);
            return;
        }

        if (!resolvedProjectId) return;

        let active = true;
        const fetchProject = async () => {
            try {
                const list = await catalogApi.listProjects();
                const found = list.find(p => Number(p.id) === resolvedProjectId);
                if (active && found) {
                    setProjectName(found.name);
                }
            } catch (_) {}
        };
        fetchProject();
        return () => { active = false; };
    }, [resolvedProjectId, propProject]);

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden">
            {/* ─── Sub-Navigation Pills: Resources | Activities (Sticky Header) ─── */}
            {!isViewingResource && (
                <div className="px-4 sm:px-6 pt-3 pb-2.5 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-gh-border shrink-0 select-none">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('resources')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'resources'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-hover'
                            }`}
                        >
                            <Package size={15} />
                            Project Resources &amp; Rates
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('activities')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'activities'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-hover'
                            }`}
                        >
                            <Layers size={15} />
                            Project Activities &amp; Norms
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Scrollable Tab Content Container ─────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 pb-16">
                <div style={{ display: activeTab === 'resources' ? 'block' : 'none' }}>
                    <ResourcesTab
                        scope="project"
                        projectId={resolvedProjectId}
                        projectName={projectName}
                        units={units}
                        setExtraBreadcrumbs={setExtraBreadcrumbs}
                    />
                </div>

                <div style={{ display: activeTab === 'activities' ? 'block' : 'none' }}>
                    <ActivitiesTab
                        scope="project"
                        projectId={resolvedProjectId}
                        projectName={projectName}
                        units={units}
                    />
                </div>
            </div>
        </div>
    );
}
