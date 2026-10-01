import React, { useEffect, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Boxes,
    BriefcaseBusiness,
    ChevronRight,
    CircleGauge,
    FileSpreadsheet,
    MapPinned,
    MessageCircle,
    ShieldCheck,
    Users,
    X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useRecentProjects from '../hooks/useRecentProjects';
import { filterMobileNavigation, MOBILE_NAV_ITEMS } from './mobileNavigation';

const ICONS = {
    dashboard: CircleGauge,
    projects: BriefcaseBusiness,
    vendors: MapPinned,
    clients: Users,
    resources: Boxes,
    spreadsheets: FileSpreadsheet,
    collaboration: MessageCircle,
    admin: ShieldCheck,
};

const initialsFor = (name) => String(name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function MobileSidebar({ open, onClose, onNavigate, loadProjects }) {
    const { user, hasPermission } = useAuth();
    const closeButtonRef = useRef(null);
    const drawerRef = useRef(null);
    const navItems = useMemo(() => filterMobileNavigation(MOBILE_NAV_ITEMS, hasPermission), [hasPermission]);
    const { projects, loading, error } = useRecentProjects({ enabled: open, loadProjects });

    useEffect(() => {
        if (!open) return undefined;
        closeButtonRef.current?.focus();

        const trapFocus = (event) => {
            if (event.key !== 'Tab' || !drawerRef.current) return;
            const focusable = [...drawerRef.current.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
            )].filter((element) => !element.hasAttribute('hidden'));
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', trapFocus);
        return () => document.removeEventListener('keydown', trapFocus);
    }, [open]);

    if (!open) return null;

    const navigateTo = (event, path) => {
        event.preventDefault();
        onNavigate(path);
    };

    return (
        <div className="fixed inset-0 z-50" data-testid="mobile-drawer-layer">
            <button
                type="button"
                aria-label="Close navigation"
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
            />
            <aside
                ref={drawerRef}
                id="mobile-navigation-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Main navigation"
                className="absolute inset-y-0 left-0 flex w-[min(86vw,340px)] flex-col overflow-hidden border-r border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-2xl dark:border-gh-border dark:bg-gh-subtle"
            >
                <div className="flex min-h-12 items-center gap-2 border-b border-gray-200 px-3 dark:border-gh-border">
                    <img src="/mano-logo.svg" alt="" className="h-6 w-6 object-contain" />
                    <span className="flex-1 text-xs font-semibold text-gray-900 dark:text-gh-text">MANO ERP</span>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        aria-label="Close navigation drawer"
                        onClick={onClose}
                        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gh-muted dark:hover:bg-gh-hover"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                    <nav aria-label="ERP sections" className="space-y-1">
                        {navItems.map((item) => {
                            const Icon = ICONS[item.icon];
                            return (
                                <NavLink
                                    key={item.id}
                                    to={item.path}
                                    end={item.path === '/'}
                                    onClick={(event) => navigateTo(event, item.path)}
                                    className={({ isActive }) => `flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                                        isActive
                                            ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                            : 'text-gray-600 hover:bg-gray-100 dark:text-gh-muted dark:hover:bg-gh-hover'
                                    }`}
                                >
                                    <Icon size={16} aria-hidden="true" />
                                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                    <ChevronRight size={14} aria-hidden="true" className="opacity-50" />
                                </NavLink>
                            );
                        })}
                    </nav>

                    <section className="mt-4" aria-labelledby="mobile-recent-projects-heading">
                        <h2 id="mobile-recent-projects-heading" className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            Recent projects
                        </h2>
                        <div className="mt-1.5 space-y-1">
                            {loading && <div className="space-y-1.5 px-2.5 py-1">{[1, 2, 3].map((key) => <div key={key} className="flex min-h-8 items-center gap-2.5"><div className="h-4 w-4 animate-pulse rounded bg-gray-200 dark:bg-white/10" /><div className="h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-white/10" /></div>)}</div>}
                            {!loading && error && <p className="px-2.5 py-1.5 text-xs text-gray-500 dark:text-gh-muted">Projects unavailable</p>}
                            {!loading && !error && projects.length === 0 && <p className="px-2.5 py-1.5 text-xs text-gray-500 dark:text-gh-muted">No assigned projects</p>}
                            {projects.map((project) => (
                                <NavLink
                                    key={project.id}
                                    to={`/projects/${project.id}`}
                                    onClick={(event) => navigateTo(event, `/projects/${project.id}`)}
                                    className="flex min-h-8 items-center gap-2.5 rounded-lg px-2.5 text-xs font-normal text-gray-600 hover:bg-gray-100 dark:text-gh-muted dark:hover:bg-gh-hover"
                                >
                                    <BriefcaseBusiness size={15} aria-hidden="true" className="shrink-0 text-blue-500" />
                                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                                </NavLink>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="flex items-center gap-2.5 border-t border-gray-200 px-3 py-2.5 dark:border-gh-border">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {initialsFor(user?.user_name)}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-gray-900 dark:text-gh-text">{user?.user_name || 'User'}</p>
                        <p className="truncate text-[11px] font-normal text-gray-500 dark:text-gh-muted">{user?.desg_name || user?.user_type || 'Employee'}</p>
                    </div>
                </div>
            </aside>
        </div>
    );
}
