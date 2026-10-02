import React, { useMemo, useState } from 'react';
import {
    Archive,
    BriefcaseBusiness,
    Building2,
    Info,
    MapPin,
    MoreVertical,
    Pencil,
    Plus,
    RotateCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { adminApi } from '../../../services/adminApi';
import { projectApi } from '../../../services/projectApi.js';
import { customToast } from '../../../utils/toast';
import MobileBottomSheet, { MobileActionSheet } from '../../components/MobileBottomSheet';
import MobileCard from '../../components/MobileCard';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileFAB from '../../components/MobileFAB';
import MobileFilterSheet from '../../components/MobileFilterSheet';
import MobileLoadingState from '../../components/MobileLoadingState';
import MobilePageHeader from '../../components/MobilePageHeader';
import MobileSearchBar from '../../components/MobileSearchBar';
import MobileTabs from '../../components/MobileTabs';
import useMobileProjects, { loadMobileProjects } from '../../hooks/useMobileProjects';
import MobileProjectForm from './MobileProjectForm';
import MobileProjectOverview from './MobileProjectOverview';
import {
    buildProjectMetadataPatch,
    filterProjects,
    normalizeProject,
} from './projectModel';

function formatCurrency(amount) {
    const val = Number(amount) || 0;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
}

function getStatusTheme(status, archived) {
    if (archived) return { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', bar: 'bg-gray-400' };
    const s = String(status || '').toLowerCase().replace(/\s+/g, '_');
    if (s === 'completed') return { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300', bar: 'bg-blue-500' };
    if (s === 'on_hold') return { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', bar: 'bg-amber-500' };
    if (s === 'planning') return { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300', bar: 'bg-purple-500' };
    return { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', bar: 'bg-emerald-500' };
}

function getIssueBadge(issue) {
    const i = String(issue || '').toLowerCase();
    if (i === 'blocked') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900';
    if (i === 'risk') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
    if (i === 'resolved') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
    return null;
}

function FilterChoices({ label, values, selected, onChange }) {
    if (values.length === 0) return null;
    return (
        <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">{label}</legend>
            <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                    const active = selected.includes(value);
                    return (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onChange(active ? selected.filter((item) => item !== value) : [...selected, value])}
                            className={`min-h-11 rounded-xl border px-3 text-xs font-semibold ${active ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'border-gray-200 dark:border-gh-border'}`}
                        >
                            {value}
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

export default function MobileProjects({
    authOverride,
    loadProjects = loadMobileProjects,
    projectService = projectApi,
    adminService = adminApi,
    onNavigate,
}) {
    const auth = useAuth();
    const activeAuth = authOverride || auth;
    const navigate = useNavigate();
    const { projects: rawProjects, loading, error, refresh } = useMobileProjects({ loadProjects });
    const [collection, setCollection] = useState('active');
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState({ status: [], owners: [], issues: [] });
    const [draftFilters, setDraftFilters] = useState(filters);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [actionsProject, setActionsProject] = useState(null);
    const [editingProject, setEditingProject] = useState(null);
    const [mutatingId, setMutatingId] = useState(null);
    const canWrite = activeAuth.hasPermission('projects', 2);
    const projects = useMemo(() => rawProjects.map(normalizeProject), [rawProjects]);
    const activeCount = projects.filter((project) => !project.archived).length;
    const archivedCount = projects.filter((project) => project.archived).length;
    const filtered = useMemo(() => filterProjects(projects, { collection, query, ...filters }), [collection, filters, projects, query]);
    const statusValues = useMemo(() => [...new Set(projects.map((project) => project.status))], [projects]);
    const ownerValues = useMemo(() => [...new Set(projects.map((project) => project.owner))], [projects]);
    const issueValues = useMemo(() => [...new Set(projects.map((project) => project.issues))], [projects]);
    const filterCount = filters.status.length + filters.owners.length + filters.issues.length;
    const go = (to) => (onNavigate ? onNavigate(to) : navigate(to));

    const runMutation = async (project, request, successMessage) => {
        if (!canWrite || mutatingId) return false;
        setMutatingId(project.id);
        try {
            const response = await request();
            if (!response?.success) throw new Error(response?.message || 'Project update failed');
            customToast.success(successMessage, 'Project Updated');
            await refresh();
            return true;
        } catch (mutationError) {
            customToast.error(mutationError?.response?.data?.message || mutationError?.message || 'Project update failed', 'Update Failed');
            return false;
        } finally {
            setMutatingId(null);
        }
    };

    const updateMetadata = async (project, changes) => {
        const success = await runMutation(
            project,
            () => projectService.updateProject(project.id, buildProjectMetadataPatch(project, changes)),
            'Project metadata updated',
        );
        if (success) {
            setSelectedProject((current) => current?.id === project.id
                ? { ...current, ...changes, metadata: { ...current.metadata, ...changes } }
                : current);
        }
        return success;
    };

    const toggleArchive = async (project) => {
        const targetStatus = project.archived ? 'active' : 'completed';
        const success = await runMutation(
            project,
            () => projectService.updateProject(project.id, { status: targetStatus }),
            project.archived ? 'Project restored to Active' : 'Project moved to Archived',
        );
        if (success) setActionsProject(null);
    };

    const actionItems = actionsProject ? [
        { label: 'Project overview', onSelect: () => setSelectedProject(actionsProject) },
        { label: 'Open project', onSelect: () => go(`/projects/${actionsProject.id}`) },
        ...(canWrite ? [
            { label: 'Edit project', icon: Pencil, onSelect: () => setEditingProject(actionsProject) },
            {
                label: actionsProject.archived ? 'Restore to Active' : 'Move to Archived',
                icon: actionsProject.archived ? RotateCcw : Archive,
                onSelect: () => toggleArchive(actionsProject),
                closeOnSelect: false,
            },
        ] : []),
    ] : [];

    return (
        <div data-mobile-page="projects" className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
            <MobilePageHeader
                eyebrow="Portfolio"
                title="Projects"
                subtitle={`${projects.length} assigned project${projects.length === 1 ? '' : 's'}`}
                actions={canWrite ? <button type="button" onClick={() => go('/projects/create')} className="inline-flex h-9 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"><Plus size={15} aria-hidden="true" />Add</button> : null}
            />

            <MobileTabs
                segmented
                value={collection}
                onChange={setCollection}
                items={[
                    { value: 'active', label: 'Active', count: activeCount },
                    { value: 'archived', label: 'Archived', count: archivedCount },
                ]}
            />

            <div className="flex gap-2">
                <div className="min-w-0 flex-1"><MobileSearchBar value={query} onChange={setQuery} placeholder="Search name, code or owner" /></div>
                <button
                    type="button"
                    onClick={() => { setDraftFilters(filters); setFiltersOpen(true); }}
                    className={`h-9 shrink-0 rounded-lg border px-2.5 text-xs font-medium ${filterCount ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'border-gray-200 text-gray-700 dark:border-gh-border dark:text-gh-text'}`}
                >
                    Filters{filterCount ? ` (${filterCount})` : ''}
                </button>
            </div>

            {loading ? (
                <MobileLoadingState label="Loading projects" rows={4} />
            ) : error ? (
                <MobileEmptyState
                    title="Projects unavailable"
                    description="The project list could not be loaded."
                    action={<button type="button" onClick={refresh} className="min-h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white">Try again</button>}
                />
            ) : filtered.length === 0 ? (
                <MobileEmptyState title="No projects found" description="Try another search, filter, or collection." />
            ) : (
                <div className="space-y-2.5">
                    {filtered.map((project) => {
                        const statusTheme = getStatusTheme(project.status, project.archived);
                        const issueBadge = getIssueBadge(project.issues);
                        const progressPct = Math.round(Number(project.completion || 0));
                        const budgetVal = Number(project.budget || 0);

                        return (
                            <div
                                key={project.id}
                                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs transition hover:shadow-md dark:border-gh-border dark:bg-[#161B22]"
                            >
                                {project.logoUrl && (
                                    <div className="h-16 w-full overflow-hidden border-b border-gray-100 dark:border-gh-border">
                                        <img src={project.logoUrl} alt="" className="h-full w-full object-cover" />
                                    </div>
                                )}

                                <div className="p-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                            {project.code || 'PRJ'}
                                        </span>

                                        {issueBadge && (
                                            <span className={`rounded border px-1.5 py-0.5 text-[8.5px] font-bold uppercase ${issueBadge}`}>
                                                {project.issues}
                                            </span>
                                        )}

                                        <div className="flex-1" />

                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusTheme.badge}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${statusTheme.dot}`} />
                                            {project.archived ? 'ARCHIVED' : (project.statusLabel || project.status || 'ACTIVE').toUpperCase()}
                                        </span>

                                        <button
                                            type="button"
                                            aria-label="Overview summary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedProject(project);
                                            }}
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gh-muted dark:hover:bg-gh-hover"
                                        >
                                            <Info size={14} />
                                        </button>

                                        <button
                                            type="button"
                                            aria-label={`Actions for ${project.name}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActionsProject(project);
                                            }}
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gh-muted dark:hover:bg-gh-hover"
                                        >
                                            <MoreVertical size={14} />
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => go(`/projects/${project.id}`)}
                                        className="mt-2 block w-full text-left"
                                    >
                                        <h3 className="truncate text-sm font-bold text-gray-900 group-hover:text-blue-600 dark:text-gh-text dark:group-hover:text-blue-400">
                                            {project.name}
                                        </h3>
                                    </button>

                                    <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gh-muted">
                                        {project.client && (
                                            <span className="flex items-center gap-1 truncate">
                                                <Building2 size={12} className="shrink-0 text-gray-400" />
                                                <span className="truncate">{project.client}</span>
                                            </span>
                                        )}
                                        {project.location && (
                                            <span className="flex items-center gap-1 truncate">
                                                <MapPin size={12} className="shrink-0 text-gray-400" />
                                                <span className="truncate">{project.location}</span>
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-2.5 flex items-center gap-2">
                                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                            <div
                                                className={`h-full rounded-full ${statusTheme.bar}`}
                                                style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                                            />
                                        </div>
                                        <span className="font-mono text-[10.5px] font-bold text-gray-700 dark:text-gh-text">
                                            {progressPct}%
                                        </span>
                                    </div>

                                    <div className="mt-2.5 flex items-center justify-between rounded-lg bg-gray-50/80 px-2.5 py-1.5 text-xs dark:bg-gh-bg">
                                        <span className="text-[11px] text-gray-500 dark:text-gh-muted">
                                            Budget: <span className="font-mono font-semibold text-gray-800 dark:text-gh-text">{formatCurrency(budgetVal)}</span>
                                        </span>
                                        <span className="text-[11px] text-gray-500 dark:text-gh-muted">
                                            {project.totalPhases > 0 ? (
                                                <span>Phases: <span className="font-semibold text-gray-800 dark:text-gh-text">{project.completedPhases}/{project.totalPhases}</span></span>
                                            ) : (
                                                <span>Team: <span className="font-semibold text-gray-800 dark:text-gh-text">{project.memberCount || 1}</span></span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <MobileFilterSheet
                open={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                onReset={() => setDraftFilters({ status: [], owners: [], issues: [] })}
                onApply={() => { setFilters(draftFilters); setFiltersOpen(false); }}
            >
                <FilterChoices label="Status" values={statusValues} selected={draftFilters.status} onChange={(status) => setDraftFilters((current) => ({ ...current, status }))} />
                <FilterChoices label="Owner" values={ownerValues} selected={draftFilters.owners} onChange={(owners) => setDraftFilters((current) => ({ ...current, owners }))} />
                <FilterChoices label="Issues" values={issueValues} selected={draftFilters.issues} onChange={(issues) => setDraftFilters((current) => ({ ...current, issues }))} />
            </MobileFilterSheet>

            <MobileActionSheet open={Boolean(actionsProject)} onClose={() => setActionsProject(null)} title={actionsProject?.name || 'Project actions'} actions={actionItems} />

            <MobileProjectOverview
                open={Boolean(selectedProject)}
                onClose={() => setSelectedProject(null)}
                project={selectedProject}
                canWrite={canWrite}
                onEdit={(item) => { setSelectedProject(null); setEditingProject(item); }}
                onOpenProject={(item) => go(`/projects/${item.id}`)}
                onMetadataChange={updateMetadata}
                projectService={projectService}
            />

            <MobileBottomSheet open={Boolean(editingProject)} onClose={() => setEditingProject(null)} title="Edit project" description={editingProject?.name}>
                {editingProject && (
                    <MobileProjectForm
                        mode="edit"
                        presentation="sheet"
                        project={editingProject}
                        onCancel={() => setEditingProject(null)}
                        onSaved={async () => { setEditingProject(null); await refresh(); }}
                        authOverride={activeAuth}
                        projectService={projectService}
                        adminService={adminService}
                    />
                )}
            </MobileBottomSheet>

            {canWrite && <MobileFAB label="Create project" icon={Plus} onClick={() => go('/projects/create')} />}
        </div>
    );
}
