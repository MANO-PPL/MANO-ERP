import React, { useEffect, useState } from 'react';
import { ChevronDown, List, LogOut, Menu, MessageSquare, Moon, Sun } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '../../context/AuthContext';
import { projectApi } from '../../services/projectApi';
import { MOBILE_PROJECT_MODULES } from '../pages/ProjectDetails/mobileProjectModules';
import MobileBottomSheet from '../components/MobileBottomSheet';

const initialsFor = (name) => String(name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const PAGE_TITLES = {
    '/': 'Dashboard',
    '/projects': 'Projects',
    '/projects/create': 'Create Project',
    '/projects/new': 'Create Project',
    '/vendors': 'Vendors',
    '/vendors/bulk-upload': 'Vendor Bulk Upload',
    '/clients': 'Clients',
    '/clients/bulk-upload': 'Client Bulk Upload',
    '/resources': 'Resources',
    '/resources/bulk-upload': 'Resource Bulk Upload',
    '/collaboration': 'Collaboration',
    '/admin': 'Admin Settings',
    '/spreadsheets': 'Spreadsheets',
};

export default function MobileTopBar({ menuButtonRef, navigationOpen, onOpenNavigation }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { resolvedTheme, setTheme } = useTheme();
    const { user, logout } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const isDark = resolvedTheme === 'dark';

    const projectMatch = location.pathname.match(/^\/projects\/([a-zA-Z0-9_-]+)/);
    const projectId = (projectMatch && projectMatch[1] !== 'create' && projectMatch[1] !== 'new') ? projectMatch[1] : null;
    const isProjectView = Boolean(projectId);

    const [projectName, setProjectName] = useState(() => {
        if (!projectId) return null;
        try {
            const cached = sessionStorage.getItem(`active_project_info_${projectId}`);
            if (cached) return JSON.parse(cached)?.name || null;
        } catch (e) {}
        return null;
    });

    useEffect(() => {
        if (!projectId) {
            setProjectName(null);
            return;
        }
        try {
            const cached = sessionStorage.getItem(`active_project_info_${projectId}`);
            if (cached) {
                const parsed = JSON.parse(cached)?.name;
                if (parsed) {
                    setProjectName(parsed);
                    return;
                }
            }
        } catch (e) {}

        let active = true;
        projectApi.getProject(projectId)
            .then((res) => {
                if (active && res?.project?.name) {
                    setProjectName(res.project.name);
                }
            })
            .catch(() => {});

        return () => { active = false; };
    }, [projectId]);

    const [activeTabTitle, setActiveTabTitle] = useState(null);

    useEffect(() => {
        const handleProjectUpdate = (event) => {
            if (event.detail && String(event.detail.id) === String(projectId) && event.detail.name) {
                setProjectName(event.detail.name);
            }
        };
        const handleTabUpdate = (event) => {
            if (event.detail) {
                setActiveTabTitle(event.detail);
            }
        };
        window.addEventListener('active-project-updated', handleProjectUpdate);
        window.addEventListener('active-project-tab-updated', handleTabUpdate);
        return () => {
            window.removeEventListener('active-project-updated', handleProjectUpdate);
            window.removeEventListener('active-project-tab-updated', handleTabUpdate);
        };
    }, [projectId]);

    const getPageTitle = () => {
        if (isProjectView) {
            const searchParams = new URLSearchParams(location.search);
            const tabKey = searchParams.get('tab');
            if (tabKey) {
                const normalized = tabKey.toLowerCase().replace(/[-_\s]+/g, '');
                const matchedModule = MOBILE_PROJECT_MODULES.find(
                    (m) => m.key.toLowerCase().replace(/[-_\s]+/g, '') === normalized
                );
                return matchedModule?.label || tabKey;
            }
            return activeTabTitle || 'General Documents';
        }
        const path = location.pathname.toLowerCase().replace(/\/$/, '') || '/';
        return PAGE_TITLES[path] || 'MANO ERP';
    };

    const pageTitle = getPageTitle();

    const handleLogout = async () => {
        setProfileOpen(false);
        await logout();
    };

    const handleOpenProjectModules = () => {
        window.dispatchEvent(new CustomEvent('open-mobile-project-modules'));
    };

    return (
        <>
            <header className="sticky top-0 z-30 shrink-0 border-b border-gray-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-gh-border dark:bg-gh-subtle/95">
                <div className="flex min-h-12 items-center gap-1.5 px-2">
                    <button
                        ref={menuButtonRef}
                        type="button"
                        aria-label="Open navigation"
                        aria-expanded={navigationOpen}
                        aria-controls="mobile-navigation-drawer"
                        onClick={onOpenNavigation}
                        className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gh-muted dark:hover:bg-gh-hover"
                    >
                        <Menu size={19} aria-hidden="true" />
                    </button>

                    {isProjectView ? (
                        <button
                            type="button"
                            onClick={handleOpenProjectModules}
                            className="flex min-w-0 flex-1 flex-col justify-center text-left leading-tight"
                            aria-label="Open project modules"
                        >
                            <span className="truncate text-xs font-bold tracking-tight text-gray-950 dark:text-gh-text">
                                {projectName || 'Project'}
                            </span>
                            <span className="flex items-center gap-0.5 truncate text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                <span className="truncate">{pageTitle}</span>
                                <ChevronDown size={11} aria-hidden="true" className="shrink-0 opacity-70" />
                            </span>
                        </button>
                    ) : (
                        <div className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
                            <span className="truncate text-xs font-bold tracking-tight text-gray-950 dark:text-gh-text">
                                {pageTitle}
                            </span>
                        </div>
                    )}

                    {isProjectView && (
                        <button
                            type="button"
                            aria-label="Open project modules"
                            onClick={handleOpenProjectModules}
                            className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gh-muted dark:hover:bg-gh-hover"
                        >
                            <List size={17} aria-hidden="true" />
                        </button>
                    )}

                    <button
                        type="button"
                        aria-label="Chat and Collaboration"
                        onClick={() => navigate('/collaboration')}
                        className={`inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-gh-hover ${
                            location.pathname === '/collaboration'
                                ? 'text-[#5B60F6] dark:text-[#5B60F6]'
                                : 'text-gray-600 dark:text-gh-muted'
                        }`}
                        title="Chat & Collaboration"
                    >
                        <MessageSquare size={16} aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        aria-label={`Use ${isDark ? 'light' : 'dark'} theme`}
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gh-muted dark:hover:bg-gh-hover"
                    >
                        {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                    </button>

                    <button
                        type="button"
                        aria-label="Open profile actions"
                        onClick={() => setProfileOpen(true)}
                        className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                    >
                        {user?.profile_image_url ? (
                            <img
                                src={user.profile_image_url}
                                alt=""
                                className="h-7 w-7 rounded-full border border-blue-200 object-cover dark:border-blue-800"
                            />
                        ) : (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                {initialsFor(user?.user_name)}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            <MobileBottomSheet open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
                <div className="flex items-center gap-2.5 rounded-lg bg-gray-50 p-2.5 dark:bg-gh-bg">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {initialsFor(user?.user_name)}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-gray-900 dark:text-gh-text">{user?.user_name || 'User'}</p>
                        <p className="truncate text-[11px] font-normal text-gray-500 dark:text-gh-muted">{user?.desg_name || user?.user_type || 'Employee'}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2.5 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
                >
                    <LogOut size={16} aria-hidden="true" />
                    Log out
                </button>
            </MobileBottomSheet>
        </>
    );
}
