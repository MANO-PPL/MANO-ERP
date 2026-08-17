import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ProjectResourceList from './ProjectResourceList';
import ResourceRecipesTab from '../../Resources/ResourceRecipesTab';
import ResourceRatesTab from '../../Resources/ResourceRatesTab';
import ResourceConversionsTab from '../../Resources/ResourceConversionsTab';
import { resourceApi } from '../../../services/resourceApi';
import { projectApi } from '../../../services/projectApi';

const ProjectMaterialSubNav = ({ activeTab, onChange, projectItemCount }) => {
    const tabs = [
        { id: 'grid', label: 'Resource Grid' },
        { id: 'recipes', label: `Recipes & History${projectItemCount !== undefined ? ` (${projectItemCount})` : ''}` },
        { id: 'rates', label: `Rates${projectItemCount !== undefined ? ` (${projectItemCount})` : ''}` },
        { id: 'conversions', label: `Conversions${projectItemCount !== undefined ? ` (${projectItemCount})` : ''}` }
    ];

    return (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-[#161b22]/70 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer ${isActive
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const MaterialManagementIndex = ({
    projectId,
    project,
    setExtraBreadcrumbs,
    canWrite,
    showToast
}) => {
    const { id: paramId, projectId: paramProjectId } = useParams();
    const activeProjectId = projectId || paramProjectId || paramId || project?.id;

    // Use 'matTab' to avoid collisions with ProjectDetails' 'tab' query param
    const [searchParams, setSearchParams] = useSearchParams();
    const rawMatTab = searchParams.get('matTab');
    const validTabs = ['grid', 'recipes', 'rates', 'conversions'];
    const activeTab = validTabs.includes(rawMatTab) ? rawMatTab : 'grid';
    const targetResourceId = searchParams.get('resourceId') || '';

    const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]));

    // Synchronously seed from sessionStorage for instant rendering with 0 delay
    const [projectItems, setProjectItems] = useState(() => {
        try {
            const cached = sessionStorage.getItem(`mano_proj_${activeProjectId}_items`);
            if (cached) return JSON.parse(cached);
        } catch (e) { }
        return [];
    });

    const [masterResources, setMasterResources] = useState(() => {
        try {
            const cached = sessionStorage.getItem('mano_master_resources_cache');
            if (cached) return JSON.parse(cached);
        } catch (e) { }
        return [];
    });

    const [isLoadingResources, setIsLoadingResources] = useState(false);

    const setActiveTab = (tab, resId = null) => {
        const params = new URLSearchParams(searchParams);
        params.set('matTab', tab);
        if (resId) params.set('resourceId', String(resId));
        else params.delete('resourceId');
        setSearchParams(params);
    };

    useEffect(() => {
        setVisitedTabs(prev => {
            if (prev.has(activeTab)) return prev;
            const next = new Set(prev);
            next.add(activeTab);
            return next;
        });
    }, [activeTab]);

    const loadResources = useCallback(async () => {
        if (!activeProjectId) return;
        setIsLoadingResources(true);
        try {
            const [projectRes, masterRes] = await Promise.all([
                projectApi.listProjectResources(activeProjectId),
                resourceApi.getResources({ limit: 5000 })
            ]);

            const pList = projectRes.resources || [];
            const mList = masterRes.resources || [];
            const masterById = new Map(mList.map(r => [String(r.id), r]));

            // Filter strictly for the primary project items selected in this project
            const itemsOnly = pList
                .filter(p => p.type === 'item')
                .map(p => {
                    const resId = p.resource_id || p.id;
                    const m = masterById.get(String(resId)) || {};
                    return {
                        ...m,
                        ...p,
                        id: resId,
                        resource_id: resId,
                        name: p.name || m.name || 'Unnamed Resource',
                        code: p.code || m.code || '',
                        type: 'item',
                        base_unit_code: p.base_unit_code || m.base_unit_code || 'nos',
                        base_unit_name: p.base_unit_name || m.base_unit_name,
                        description: p.description || m.description || '',
                        isImported: true
                    };
                });

            setProjectItems(itemsOnly);
            setMasterResources(mList);

            try {
                sessionStorage.setItem(`mano_proj_${activeProjectId}_items`, JSON.stringify(itemsOnly));
                sessionStorage.setItem('mano_master_resources_cache', JSON.stringify(mList));
            } catch (e) { }
        } catch (err) {
            console.error('Failed to load project resources for material management', err);
        } finally {
            setIsLoadingResources(false);
        }
    }, [activeProjectId]);

    useEffect(() => {
        loadResources();
    }, [loadResources]);

    useEffect(() => {
        if (setExtraBreadcrumbs) {
            if (activeTab === 'recipes') {
                setExtraBreadcrumbs([{ label: 'Recipes & History' }]);
            } else if (activeTab === 'rates') {
                setExtraBreadcrumbs([{ label: 'Rates' }]);
            } else if (activeTab === 'conversions') {
                setExtraBreadcrumbs([{ label: 'Conversions' }]);
            } else {
                setExtraBreadcrumbs([]);
            }
        }
    }, [activeTab, setExtraBreadcrumbs]);

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full relative">
            <ProjectMaterialSubNav
                activeTab={activeTab}
                onChange={tab => setActiveTab(tab, targetResourceId || null)}
                projectItemCount={projectItems.length}
            />

            {/* Tab 1: Project Resource Grid */}
            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${activeTab === 'grid' ? '' : 'hidden'}`}>
                <ProjectResourceList
                    projectId={activeProjectId}
                    setExtraBreadcrumbs={setExtraBreadcrumbs}
                    canWrite={canWrite}
                    showToast={showToast}
                />
            </div>

            {/* Tab 2: Recipes & History (Strictly for Project's Selected Items) */}
            {visitedTabs.has('recipes') && (
                <div className={`flex-1 min-h-0 overflow-hidden ${activeTab === 'recipes' ? 'flex flex-col' : 'hidden'}`}>
                    <ResourceRecipesTab
                        initialResourceId={targetResourceId}
                        resources={projectItems}
                        availableComponents={masterResources}
                        initialProjectId={activeProjectId}
                        onRefreshResources={loadResources}
                        showToast={showToast}
                    />
                </div>
            )}

            {/* Tab 3: Rates (Strictly for Project's Selected Items) */}
            {visitedTabs.has('rates') && (
                <div className={`flex-1 min-h-0 overflow-hidden ${activeTab === 'rates' ? 'flex flex-col' : 'hidden'}`}>
                    <ResourceRatesTab
                        initialResourceId={targetResourceId}
                        resources={projectItems}
                        initialProjectId={activeProjectId}
                        onRefreshResources={loadResources}
                        showToast={showToast}
                    />
                </div>
            )}

            {/* Tab 4: Conversions (Strictly for Project's Selected Items) */}
            {visitedTabs.has('conversions') && (
                <div className={`flex-1 min-h-0 overflow-hidden ${activeTab === 'conversions' ? 'flex flex-col' : 'hidden'}`}>
                    <ResourceConversionsTab
                        initialResourceId={targetResourceId}
                        resources={projectItems}
                        onRefreshResources={loadResources}
                        showToast={showToast}
                    />
                </div>
            )}
        </div>
    );
};

export default MaterialManagementIndex;
