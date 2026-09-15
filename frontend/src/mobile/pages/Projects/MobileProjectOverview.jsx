import React, { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Pencil, Users } from 'lucide-react';
import { projectApi } from '../../../services/projectApi.js';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import { normalizeProject } from './projectModel';

const ISSUE_VALUES = ['None', 'Risk', 'Blocked', 'Resolved'];

export default function MobileProjectOverview({
    open,
    onClose,
    project,
    canWrite,
    onEdit,
    onOpenProject,
    onMetadataChange,
    projectService = projectApi,
}) {
    const [details, setDetails] = useState(project);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [metadataSaving, setMetadataSaving] = useState(false);
    const [tag, setTag] = useState('');

    useEffect(() => {
        if (!open || !project?.id) return undefined;
        let active = true;
        setDetails(project);
        setMembers([]);
        setLoading(true);
        Promise.all([
            projectService.getProject(project.id).catch(() => null),
            projectService.getProjectMembers(project.id).catch(() => null),
        ]).then(([projectResponse, membersResponse]) => {
            if (!active) return;
            if (projectResponse?.success && projectResponse.project) setDetails(normalizeProject(projectResponse.project));
            if (membersResponse?.success && Array.isArray(membersResponse.members)) setMembers(membersResponse.members);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [open, project, projectService]);

    if (!project) return null;
    const display = details || project;
    const statusLabel = display.archived ? 'Archived' : display.statusLabel;

    const saveMetadata = async (changes) => {
        if (!onMetadataChange || metadataSaving) return false;
        setMetadataSaving(true);
        try {
            const saved = await onMetadataChange(display, changes);
            if (saved) {
                setDetails((current) => ({ ...current, ...changes, metadata: { ...current.metadata, ...changes } }));
            }
            return Boolean(saved);
        } catch {
            return false;
        } finally {
            setMetadataSaving(false);
        }
    };

    const addTag = async () => {
        const nextTag = tag.trim();
        if (!nextTag || display.tags.includes(nextTag)) return;
        const saved = await saveMetadata({ tags: [...display.tags, nextTag] });
        if (saved) setTag('');
    };

    const removeTag = async (removed) => {
        const tags = display.tags.filter((item) => item !== removed);
        await saveMetadata({ tags });
    };

    return (
        <MobileBottomSheet open={open} onClose={onClose} title={display.name} description={`${display.code} · ${statusLabel}`}>
            <div className="space-y-4">
                {loading && <p role="status" className="text-xs text-gray-500 dark:text-gh-muted">Refreshing project details…</p>}
                {display.logoUrl && <img src={display.logoUrl} alt="" className="h-32 w-full rounded-2xl border border-gray-200 object-cover dark:border-gh-border" />}
                {display.description && <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gh-muted">{display.description}</p>}

                <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gh-bg"><dt className="text-gray-500 dark:text-gh-muted">Owner</dt><dd className="mt-1 font-bold">{display.owner}</dd></div>
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gh-bg"><dt className="text-gray-500 dark:text-gh-muted">Progress</dt><dd className="mt-1 font-bold">{display.completion}%</dd></div>
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gh-bg"><dt className="flex items-center gap-1 text-gray-500 dark:text-gh-muted"><CalendarDays size={13} aria-hidden="true" />Start</dt><dd className="mt-1 font-bold">{display.startDate || 'Not set'}</dd></div>
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gh-bg"><dt className="flex items-center gap-1 text-gray-500 dark:text-gh-muted"><CalendarDays size={13} aria-hidden="true" />End</dt><dd className="mt-1 font-bold">{display.endDate || 'Not set'}</dd></div>
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gh-bg"><dt className="flex items-center gap-1 text-gray-500 dark:text-gh-muted"><Users size={13} aria-hidden="true" />Team</dt><dd className="mt-1 font-bold">{members.length || display.memberCount} members</dd></div>
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gh-bg"><dt className="text-gray-500 dark:text-gh-muted">Phases</dt><dd className="mt-1 font-bold">{display.completedPhases}/{display.totalPhases}</dd></div>
                </dl>

                {display.location && <p className="flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-xs dark:border-gh-border"><MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-500" /><span>{display.location}</span></p>}

                <section aria-labelledby="mobile-project-issue-heading">
                    <h3 id="mobile-project-issue-heading" className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">Issues</h3>
                    {canWrite ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {ISSUE_VALUES.map((issue) => (
                                <button
                                    key={issue}
                                    type="button"
                                    aria-pressed={display.issues === issue}
                                    disabled={metadataSaving}
                                    onClick={() => saveMetadata({ issues: issue })}
                                    className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${display.issues === issue ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'border-gray-200 dark:border-gh-border'}`}
                                >
                                    {issue}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-gray-100 px-3 text-xs font-bold dark:bg-gh-bg">{display.issues}</p>
                    )}
                </section>

                <section aria-labelledby="mobile-project-tags-heading">
                    <h3 id="mobile-project-tags-heading" className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gh-muted">Tags</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {display.tags.map((item) => (
                            <span key={item} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-blue-50 px-3 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                {item}
                                {canWrite && <button type="button" disabled={metadataSaving} aria-label={`Remove ${item} tag`} onClick={() => removeTag(item)} className="min-h-9 min-w-9 text-base disabled:opacity-50">×</button>}
                            </span>
                        ))}
                    </div>
                    {canWrite && (
                        <div className="mt-2 flex gap-2">
                            <input disabled={metadataSaving} value={tag} onChange={(event) => setTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50 dark:border-gh-border dark:bg-gh-input" placeholder="Add a tag" />
                            <button type="button" disabled={metadataSaving} onClick={addTag} className="min-h-11 rounded-xl border border-blue-500 px-4 text-sm font-bold text-blue-600 disabled:opacity-50 dark:text-blue-400">{metadataSaving ? 'Saving…' : 'Add'}</button>
                        </div>
                    )}
                </section>

                <div className="flex gap-2 pt-2">
                    {canWrite && <button type="button" onClick={() => onEdit?.(display)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold dark:border-gh-border"><Pencil size={16} aria-hidden="true" />Edit</button>}
                    <button type="button" onClick={() => onOpenProject?.(display)} className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Open project</button>
                </div>
            </div>
        </MobileBottomSheet>
    );
}
