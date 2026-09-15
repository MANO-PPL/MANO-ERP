import React, { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileLoadingState from '../../components/MobileLoadingState';
import useMobileDrawer from '../../hooks/useMobileDrawer.js';
import MobileProjectHeader from './MobileProjectHeader';
import MobileProjectModuleOutlet from './MobileProjectModuleOutlet';
import MobileProjectModuleSheet from './MobileProjectModuleSheet';
import useMobileProjectContext from './useMobileProjectContext.js';
import { getProjectPermissionLevel, getVisibleProjectModules, resolveProjectModule, updateProjectModuleSearch } from './mobileProjectModules.js';

export default function MobileProjectShell({ authOverride, projectService, moduleServices = {} }) {
    const { id: projectId } = useParams();
    const auth = useAuth();
    const activeAuth = authOverride || auth;
    const { isAdmin, user } = activeAuth;
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { project, permissions, loading, error, refresh } = useMobileProjectContext({ projectId, projectService });
    const modules = useMemo(() => getVisibleProjectModules({ permissions, isAdmin }), [isAdmin, permissions]);
    const activeKey = resolveProjectModule(searchParams.get('tab'), modules);
    const activeModule = modules.find((module) => module.key === activeKey) || modules[0];
    const canWrite = Boolean(isAdmin || getProjectPermissionLevel(permissions, activeModule?.permission) >= 2);
    const moduleButtonRef = useRef(null);
    const drawer = useMobileDrawer({ navigate });

    useEffect(() => {
        if (!loading && activeKey !== searchParams.get('tab')) {
            setSearchParams(updateProjectModuleSearch(searchParams, activeKey).slice(1), { replace: true });
        }
    }, [activeKey, loading, searchParams, setSearchParams]);

    const selectModule = (moduleKey) => {
        const nextSearch = updateProjectModuleSearch(searchParams, moduleKey);
        drawer.navigateFromDrawer(`${location.pathname}${nextSearch}`);
        queueMicrotask(() => moduleButtonRef.current?.focus());
    };

    const navigateToModule = (moduleKey) => {
        const nextSearch = updateProjectModuleSearch(searchParams, moduleKey);
        navigate(`${location.pathname}${nextSearch}`);
    };

    if (loading) return <MobileLoadingState label="Loading project" rows={4} />;
    if (error) return <div className="px-4 pb-28"><MobileEmptyState title="Project unavailable" description={error?.message || 'The project could not be loaded.'} action={<button type="button" onClick={refresh} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Try again</button>} /></div>;
    if (!project || !activeModule) return <div className="px-4 pb-28"><MobileEmptyState title="Project unavailable" description="No project context was returned." /></div>;

    return <div data-mobile-page="project-shell" className="min-w-0 pb-4">
        <div ref={moduleButtonRef}><MobileProjectHeader project={project} projectId={projectId} activeModule={activeModule.label} onBack={() => navigate('/projects')} onOpenModules={drawer.openDrawer} /></div>
        <button type="button" aria-label="Open project module selector" onClick={drawer.openDrawer} className="mx-4 mb-4 flex min-h-12 w-[calc(100%-2rem)] items-center justify-between rounded-xl border border-gray-200 bg-white px-4 text-left shadow-sm dark:border-gh-border dark:bg-gh-subtle"><span><span className="block text-[10px] font-bold uppercase text-gray-500">Current module</span><span className="mt-1 block text-sm font-bold text-gray-950 dark:text-gh-text">{activeModule.label}</span></span><span className="text-xs font-bold text-blue-600 dark:text-blue-400">Change</span></button>
        <MobileProjectModuleOutlet module={activeModule} project={project} projectId={projectId} permissions={permissions} visibleModules={modules} isAdmin={isAdmin} user={user} canWrite={canWrite} refreshProject={refresh} onSelectModule={navigateToModule} services={moduleServices} taskService={moduleServices.tasks} projectService={moduleServices.projects || projectService} />
        <MobileProjectModuleSheet open={drawer.isOpen} onClose={drawer.closeDrawer} modules={modules} activeKey={activeKey} onSelect={selectModule} />
    </div>;
}
