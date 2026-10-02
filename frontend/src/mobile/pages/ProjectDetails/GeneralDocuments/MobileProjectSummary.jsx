import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { customToast } from '../../../../components/Toast';
import { MobileCard } from '../../../components/MobileCard';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileConfirmModal from '../../../components/MobileConfirmModal';
import MobileDatePicker from '../../../components/MobileDatePicker';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileFAB from '../../../components/MobileFAB';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileSelect from '../../../components/MobileSelect';
import { createGeneralDocumentsRequestGuard, summaryPayload } from './mobileGeneralDocumentsModel';

const inputClass = 'mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-normal outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input dark:text-gh-text';

const STATUS_BADGE = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
};

export default function MobileProjectSummary({ projectId, canWrite, api }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editor, setEditor] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const guard = useRef(createGeneralDocumentsRequestGuard());
    const activeProject = useRef(projectId);
    const current = (origin) => String(activeProject.current) === String(origin);

    const refresh = async (origin = projectId) => {
        const token = guard.current.begin(origin, 'summary');
        if (current(origin)) {
            setLoading(true);
            setError('');
        }
        try {
            const response = await api.getSummaries(origin);
            if (current(origin) && guard.current.isCurrent(token)) {
                setRows(response.summaries || []);
            }
        } catch (err) {
            if (current(origin) && guard.current.isCurrent(token)) {
                setError(err?.response?.status === 403 ? 'Access denied by the current ERP permission policy.' : 'Project summary could not be loaded.');
            }
        } finally {
            if (current(origin) && guard.current.isCurrent(token)) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        activeProject.current = projectId;
        setRows([]);
        setEditor(null);
        setConfirm(null);
        setPending(false);
        refresh(projectId);
    }, [projectId]);

    const save = async (event) => {
        event.preventDefault();
        const origin = projectId;
        if (!canWrite || !current(origin)) return;
        const editing = editor;
        const value = Object.fromEntries(new FormData(event.currentTarget).entries());
        setPending(true);
        try {
            if (editing?.id) {
                await api.updateSummaries(origin, [summaryPayload(value, editing.id)]);
            } else {
                await api.addSummaries(origin, [summaryPayload(value)]);
            }
            if (!current(origin)) return;
            customToast.success(editing?.id ? 'Milestone updated.' : 'Milestone added.', 'Project Summary');
            setEditor(null);
            await refresh(origin);
        } catch {
            if (current(origin)) {
                setError('Summary milestone could not be saved.');
                customToast.error('Summary milestone could not be saved.', 'Summary Error');
            }
        } finally {
            if (current(origin)) setPending(false);
        }
    };

    const remove = async () => {
        const origin = projectId;
        const target = confirm;
        if (!canWrite || !target || !current(origin)) return;
        setPending(true);
        try {
            await api.deleteSummaries(origin, [target.id]);
            if (!current(origin)) return;
            customToast.success('Milestone deleted.', 'Project Summary');
            setConfirm(null);
            await refresh(origin);
        } catch {
            if (current(origin)) {
                setError('Summary milestone could not be deleted.');
                customToast.error('Summary milestone could not be deleted.', 'Summary Error');
            }
        } finally {
            if (current(origin)) setPending(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
                <MobileLoadingState rows={3} showSearch={false} />
            </div>
        );
    }

    return (
        <div data-m6-view="summary" className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
            {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs font-normal text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                </p>
            )}

            <div className="space-y-2 border-l-2 border-blue-200 pl-3 dark:border-blue-900">
                {rows.map((row) => {
                    const st = row.status || 'in_progress';
                    return (
                        <MobileCard key={row.id} className="relative p-2.5 sm:p-3">
                            <span className="absolute -left-[1.2rem] top-4 h-2.5 w-2.5 rounded-full bg-blue-600" />
                            <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => canWrite && setEditor(row)}
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-normal uppercase text-blue-600 dark:text-blue-400">
                                        {row.date || 'No date'}
                                    </p>
                                    <span className={`rounded-full border px-2 py-0.2 text-[9px] font-normal capitalize ${STATUS_BADGE[st] || STATUS_BADGE.in_progress}`}>
                                        {st.replace('_', ' ')}
                                    </span>
                                </div>
                                <h3 className="mt-1 text-xs font-semibold text-gray-900 dark:text-gh-text">
                                    {row.title || 'Untitled milestone'}
                                </h3>
                                {row.details && (
                                    <p className="mt-1 text-[11px] font-normal leading-relaxed text-gray-600 dark:text-gh-muted">
                                        {row.details}
                                    </p>
                                )}
                            </button>
                            {canWrite && (
                                <div className="mt-2 flex justify-end border-t border-gray-100 pt-1.5 dark:border-gh-border">
                                    <button
                                        type="button"
                                        onClick={() => setConfirm(row)}
                                        className="text-[11px] font-normal text-red-600 hover:underline"
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </MobileCard>
                    );
                })}

                {rows.length === 0 && (
                    <MobileEmptyState
                        title="No summary milestones"
                        description="Record high-level project milestones, scope updates, and dates."
                    />
                )}
            </div>

            {canWrite && (
                <MobileFAB
                    extended
                    label="Add milestone"
                    icon={Plus}
                    onClick={() => setEditor({ title: '', date: '', status: 'in_progress', details: '' })}
                />
            )}

            <MobileBottomSheet
                open={editor !== null}
                onClose={() => !pending && setEditor(null)}
                closeDisabled={pending}
                title={editor?.id ? 'Edit Milestone' : 'Add Milestone'}
                footer={
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setEditor(null)}
                            disabled={pending}
                            className="min-h-9 flex-1 rounded-lg border border-gray-200 text-xs font-semibold dark:border-gh-border"
                        >
                            Cancel
                        </button>
                        <button
                            form="summary-form"
                            type="submit"
                            disabled={pending}
                            className="min-h-9 flex-1 rounded-lg bg-blue-600 text-xs font-semibold text-white disabled:opacity-50"
                        >
                            {pending ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                }
            >
                <form id="summary-form" onSubmit={save} className="space-y-2.5">
                    <label className="block text-xs font-medium">
                        Title <span className="text-red-500">*</span>
                        <input
                            required
                            name="title"
                            defaultValue={editor?.title || ''}
                            className={inputClass}
                            placeholder="Milestone or update title"
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                        <MobileDatePicker
                            label="Date"
                            name="date"
                            defaultValue={editor?.date?.slice?.(0, 10) || ''}
                        />
                        <MobileSelect
                            label="Status"
                            name="status"
                            defaultValue={editor?.status || 'in_progress'}
                            options={[
                                { value: 'in_progress', label: 'In Progress' },
                                { value: 'completed', label: 'Completed' },
                                { value: 'pending', label: 'Pending' }
                            ]}
                        />
                    </div>

                    <label className="block text-xs font-medium">
                        Details
                        <textarea
                            name="details"
                            rows={3}
                            defaultValue={editor?.details || ''}
                            className={`${inputClass} min-h-16 py-1.5`}
                            placeholder="Milestone scope or progress notes"
                        />
                    </label>
                </form>
            </MobileBottomSheet>

            <MobileConfirmModal
                open={confirm !== null}
                pending={pending}
                danger
                title="Delete Milestone"
                message={`Are you sure you want to delete ${confirm?.title || 'this milestone'}?`}
                confirmLabel="Delete"
                onClose={() => setConfirm(null)}
                onConfirm={remove}
            />
        </div>
    );
}
