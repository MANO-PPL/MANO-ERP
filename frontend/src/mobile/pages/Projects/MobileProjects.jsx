import React, { useMemo, useState } from 'react';
import { Archive, BriefcaseBusiness, MoreVertical, Pencil, Plus, RotateCcw } from 'lucide-react';
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
        <div data-mobile-page="projects" className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28">
            <MobilePageHeader
                eyebrow="Portfolio"
                title="Projects"
                subtitle={`${projects.length} assigned project${projects.length === 1 ? '' : 's'}`}
                actions={canWrite ? <button type="button" onClick={() => go('/projects/create')} className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-bold text-blue-600 dark:text-blue-400"><Plus size={16} aria-hidden="true" />Add</button> : null}
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
                    className={`min-h-11 shrink-0 rounded-xl border px-3 text-xs font-bold ${filterCount ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'border-gray-200 dark:border-gh-border'}`}
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
                    action={<button type="button" onClick={refresh} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Try again</button>}
                />
            ) : filtered.length === 0 ? (
                <MobileEmptyState title="No projects found" description="Try another search, filter, or collection." />
            ) : (
                <div className="space-y-3">
                    {filtered.map((project) => (
                        <MobileCard key={project.id} as="article" className="p-0">
                            <div className="flex items-start gap-3 p-4">
                                <button type="button" onClick={() => setSelectedProject(project)} className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-extrabold">{project.name}</span>
                                        <span className="mt-0.5 block truncate font-mono text-[11px] text-blue-600 dark:text-blue-400">{project.code}</span>
                                    </span>
                                </button>
                                <button type="button" aria-label={`Actions for ${project.name}`} onClick={() => setActionsProject(project)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gh-muted dark:hover:bg-gh-hover"><MoreVertical size={20} aria-hidden="true" /></button>
                            </div>
                            <div className="grid grid-cols-3 gap-px border-t border-gray-100 bg-gray-100 text-center text-[11px] dark:border-gh-border dark:bg-gh-border">
                                <div className="bg-white px-2 py-3 dark:bg-gh-subtle"><p className="text-gray-500 dark:text-gh-muted">Status</p><p className="mt-1 truncate font-bold">{project.archived ? 'Archived' : project.statusLabel}</p></div>
                                <div className="bg-white px-2 py-3 dark:bg-gh-subtle"><p className="text-gray-500 dark:text-gh-muted">Progress</p><p className="mt-1 font-bold">{project.completion}%</p></div>
                                <div className="bg-white px-2 py-3 dark:bg-gh-subtle"><p className="text-gray-500 dark:text-gh-muted">Team</p><p className="mt-1 font-bold">{project.memberCount}</p></div>
                            </div>
                            <div className="flex min-w-0 items-center justify-between gap-2 px-4 py-3 text-xs">
                                <span className="min-w-0 truncate text-gray-500 dark:text-gh-muted">{project.owner}</span>
                                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 font-semibold dark:bg-gh-bg">{project.issues}</span>
                            </div>
                        </MobileCard>
                    ))}
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
