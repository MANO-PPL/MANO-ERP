import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { customToast } from '../../../../components/Toast';
import { MobileCard } from '../../../components/MobileCard';
import MobileConfirmModal from '../../../components/MobileConfirmModal';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileFAB from '../../../components/MobileFAB';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileMeetingEditor from './MobileMeetingEditor';
import { createGeneralDocumentsRequestGuard, meetingPayload } from './mobileGeneralDocumentsModel';

const STATUS_BADGE = {
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    postponed: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
};

export default function MobileProjectMeetings({ projectId, canWrite, api }) {
    const [meetings, setMeetings] = useState([]);
    const [directory, setDirectory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editor, setEditor] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [pending, setPending] = useState(false);
    const guard = useRef(createGeneralDocumentsRequestGuard());
    const activeProject = useRef(projectId);

    const current = (origin) => String(activeProject.current) === String(origin);

    const refresh = async (origin = projectId) => {
        const token = guard.current.begin(origin, 'meetings');
        if (current(origin)) {
            setLoading(true);
            setError('');
        }
        try {
            const [meetingResponse, directoryResponse] = await Promise.all([
                api.getMeetings(origin),
                api.getDirectory(origin)
            ]);
            if (current(origin) && guard.current.isCurrent(token)) {
                setMeetings(meetingResponse.meetings || []);
                setDirectory(directoryResponse.directory || []);
            }
        } catch (err) {
            if (current(origin) && guard.current.isCurrent(token)) {
                setError(err?.response?.status === 403 ? 'Access denied by the current ERP permission policy.' : 'Project meetings could not be loaded.');
            }
        } finally {
            if (current(origin) && guard.current.isCurrent(token)) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        activeProject.current = projectId;
        setEditor(null);
        setConfirm(null);
        setPending(false);
        setMeetings([]);
        setDirectory([]);
        refresh(projectId);
    }, [projectId]);

    const open = async (meeting) => {
        const origin = projectId;
        if (!meeting?.id && !meeting?.meeting_id) {
            if (canWrite && current(origin)) setEditor({});
            return;
        }
        const token = guard.current.begin(origin, 'meeting-detail');
        if (current(origin)) setPending(true);
        try {
            const response = await api.getMeeting(origin, meeting.id || meeting.meeting_id);
            if (current(origin) && guard.current.isCurrent(token)) {
                setEditor(response.meeting || meeting);
            }
        } catch {
            if (current(origin) && guard.current.isCurrent(token)) {
                setError('Meeting details could not be loaded.');
            }
        } finally {
            if (current(origin) && guard.current.isCurrent(token)) {
                setPending(false);
            }
        }
    };

    const save = async (value) => {
        const origin = projectId;
        if (!canWrite || !current(origin)) return;
        const editing = editor;
        setPending(true);
        try {
            const payload = meetingPayload(value);
            if (editing?.id || editing?.meeting_id) {
                await api.updateMeeting(origin, editing.id || editing.meeting_id, payload);
            } else {
                await api.createMeeting(origin, payload);
            }
            if (!current(origin)) return;
            customToast.success(editing?.id || editing?.meeting_id ? 'Meeting updated.' : 'Meeting created.', 'Meetings');
            setEditor(null);
            await refresh(origin);
        } catch {
            if (current(origin)) {
                setError('Meeting could not be saved.');
                customToast.error('Meeting could not be saved.', 'Meeting Error');
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
            await api.deleteMeeting(origin, target.id || target.meeting_id);
            if (!current(origin)) return;
            customToast.success('Meeting deleted.', 'Meetings');
            setConfirm(null);
            await refresh(origin);
        } catch {
            if (current(origin)) {
                setError('Meeting could not be deleted.');
                customToast.error('Meeting could not be deleted.', 'Meeting Error');
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
        <div data-m6-view="meetings" className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
            {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs font-normal text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                </p>
            )}

            <div className="space-y-2">
                {meetings.map((meeting) => {
                    const st = meeting.status || meeting.content?.status || 'scheduled';
                    return (
                        <MobileCard key={meeting.id || meeting.meeting_id} className="p-2.5 sm:p-3">
                            <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => open(meeting)}
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-normal uppercase text-blue-600 dark:text-blue-400">
                                        Meeting {meeting.meeting_no || '—'}
                                    </p>
                                    <span className={`rounded-full border px-2 py-0.2 text-[9px] font-normal capitalize ${STATUS_BADGE[st] || STATUS_BADGE.scheduled}`}>
                                        {st}
                                    </span>
                                </div>
                                <h3 className="mt-1 text-xs font-semibold text-gray-900 dark:text-gh-text">
                                    {meeting.subject || 'Untitled meeting'}
                                </h3>
                                <p className="mt-1 text-[11px] font-normal text-gray-600 dark:text-gh-muted">
                                    {[meeting.date, meeting.time, meeting.venue].filter(Boolean).join(' · ') || 'No date or venue'}
                                </p>
                                <p className="mt-1 text-[11px] font-normal text-gray-500">
                                    {meeting.participants_count || 0} participants · {meeting.agenda_count || 0} agenda points · {meeting.mom_count || 0} minutes
                                </p>
                            </button>

                            {canWrite && (
                                <div className="mt-2 flex justify-end border-t border-gray-100 pt-1.5 dark:border-gh-border">
                                    <button
                                        type="button"
                                        className="text-[11px] font-normal text-red-600 hover:underline"
                                        onClick={() => setConfirm(meeting)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </MobileCard>
                    );
                })}

                {meetings.length === 0 && (
                    <MobileEmptyState
                        title="No project meetings"
                        description="Meetings, agendas, and minutes recorded for this project will appear here."
                    />
                )}
            </div>

            {canWrite && (
                <MobileFAB
                    extended
                    label="New meeting"
                    icon={CalendarPlus}
                    onClick={() => open(null)}
                />
            )}

            <MobileMeetingEditor
                open={editor !== null}
                meeting={editor}
                directory={directory}
                pending={pending}
                readOnly={!canWrite}
                onClose={() => setEditor(null)}
                onSave={save}
            />

            <MobileConfirmModal
                open={confirm !== null}
                pending={pending}
                danger
                title="Delete Meeting"
                message={`Are you sure you want to delete ${confirm?.subject || 'this meeting'}?`}
                confirmLabel="Delete"
                onClose={() => setConfirm(null)}
                onConfirm={remove}
            />
        </div>
    );
}
