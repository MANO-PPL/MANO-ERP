import React, { useEffect, useState } from 'react';
import { Plus, Printer, Trash2 } from 'lucide-react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileConfirmModal from '../../../components/MobileConfirmModal';
import MobileDatePicker from '../../../components/MobileDatePicker';
import MobileSelect from '../../../components/MobileSelect';

const inputClass = 'mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-normal outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input dark:text-gh-text';

const blankPoint = () => ({ sl_no: '', point: '' });
const pointRows = (values) =>
    (values?.length ? values : [blankPoint()]).map((value, index) => ({
        sl_no: value.sl_no ?? index + 1,
        point: value.point || ''
    }));

export default function MobileMeetingEditor({
    open,
    meeting,
    directory = [],
    pending,
    readOnly = false,
    onClose,
    onSave
}) {
    const [form, setForm] = useState({});
    const [dirty, setDirty] = useState(false);
    const [discard, setDiscard] = useState(false);

    useEffect(() => {
        if (!open) return;
        const attendance = meeting?.content?.attendance || {};
        setDirty(false);
        setDiscard(false);
        setForm({
            subject: meeting?.subject || '',
            meeting_no: meeting?.meeting_no || '',
            status: meeting?.status || meeting?.content?.status || 'scheduled',
            venue: meeting?.venue || '',
            date: meeting?.date?.slice?.(0, 10) || '',
            time: meeting?.time || '',
            participants: (meeting?.participants || []).map((item) => ({
                pd_id: item.pd_id,
                attended: attendance[item.pd_id] ? attendance[item.pd_id] !== 'absent' : item.attended !== false
            })),
            agenda_points: pointRows(meeting?.agenda_points),
            mom_points: pointRows(meeting?.mom_points)
        });
    }, [meeting, open]);

    const change = (key, value) => {
        if (!readOnly) {
            setDirty(true);
            setForm((current) => ({ ...current, [key]: value }));
        }
    };

    const close = () => {
        if (pending) return;
        if (!readOnly && dirty) setDiscard(true);
        else onClose();
    };

    const setPoint = (kind, index, key, value) => {
        const next = [...form[kind]];
        next[index] = { ...next[index], [key]: value };
        change(kind, next);
    };

    const toggleParticipant = (pdId) => {
        const existing = form.participants.find((item) => String(item.pd_id) === String(pdId));
        change(
            'participants',
            existing
                ? form.participants.filter((item) => String(item.pd_id) !== String(pdId))
                : [...form.participants, { pd_id: pdId, attended: true }]
        );
    };

    const setAttendance = (pdId, attended) =>
        change(
            'participants',
            form.participants.map((item) =>
                String(item.pd_id) === String(pdId) ? { ...item, attended } : item
            )
        );

    const submit = (event) => {
        event.preventDefault();
        if (!readOnly) onSave(form);
    };

    const footer = (
        <div className="flex gap-2">
            <button
                type="button"
                onClick={close}
                disabled={pending}
                className="min-h-9 flex-1 rounded-lg border border-gray-200 text-xs font-semibold dark:border-gh-border"
            >
                {readOnly ? 'Close' : 'Cancel'}
            </button>
            {meeting?.id && (
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-9 rounded-lg border border-gray-200 px-3 text-xs dark:border-gh-border"
                    aria-label="Print meeting"
                >
                    <Printer size={15} />
                </button>
            )}
            {!readOnly && (
                <button
                    form="mobile-meeting-form"
                    type="submit"
                    disabled={pending}
                    className="min-h-9 flex-1 rounded-lg bg-blue-600 text-xs font-semibold text-white disabled:opacity-50"
                >
                    {pending ? 'Saving…' : 'Save Meeting'}
                </button>
            )}
        </div>
    );

    return (
        <>
            <MobileBottomSheet
                open={open}
                onClose={close}
                closeDisabled={pending}
                title={readOnly ? 'Meeting Details' : meeting?.id ? 'Edit Meeting' : 'New Meeting'}
                footer={footer}
            >
                <form id="mobile-meeting-form" onSubmit={submit} className="space-y-3">
                    <label className="block text-xs font-medium">
                        Subject <span className="text-red-500">*</span>
                        <input
                            required
                            disabled={readOnly}
                            value={form.subject || ''}
                            onChange={(event) => change('subject', event.target.value)}
                            className={inputClass}
                            placeholder="Meeting Subject"
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-medium">
                            Meeting No.
                            <input
                                disabled={readOnly}
                                value={form.meeting_no || ''}
                                onChange={(event) => change('meeting_no', event.target.value)}
                                className={inputClass}
                                placeholder="e.g. 01"
                            />
                        </label>
                        <MobileSelect
                            label="Status"
                            disabled={readOnly}
                            value={form.status || 'scheduled'}
                            onChange={(event) => change('status', event.target.value)}
                            options={[
                                { value: 'scheduled', label: 'Scheduled' },
                                { value: 'completed', label: 'Completed' },
                                { value: 'postponed', label: 'Postponed' },
                                { value: 'cancelled', label: 'Cancelled' }
                            ]}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <MobileDatePicker
                            label="Date"
                            required
                            disabled={readOnly}
                            value={form.date || ''}
                            onChange={(event) => change('date', event.target.value)}
                        />
                        <label className="block text-xs font-medium">
                            Time
                            <input
                                disabled={readOnly}
                                type="time"
                                value={form.time || ''}
                                onChange={(event) => change('time', event.target.value)}
                                className={inputClass}
                            />
                        </label>
                    </div>

                    <label className="block text-xs font-medium">
                        Venue
                        <input
                            disabled={readOnly}
                            value={form.venue || ''}
                            onChange={(event) => change('venue', event.target.value)}
                            className={inputClass}
                            placeholder="e.g. Site Office / Conference Room"
                        />
                    </label>

                    <section className="space-y-1.5 pt-1">
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-gh-text">
                            Participants ({form.participants?.length || 0})
                        </h4>
                        <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                            {directory.map((contact) => {
                                const id = contact.id || contact.pd_id;
                                const participant = form.participants?.find((item) => String(item.pd_id) === String(id));
                                return (
                                    <div
                                        key={id}
                                        className="flex min-h-9 items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/50 p-2 text-xs dark:border-gh-border dark:bg-gh-hover/40"
                                    >
                                        <input
                                            disabled={readOnly}
                                            type="checkbox"
                                            checked={Boolean(participant)}
                                            onChange={() => toggleParticipant(id)}
                                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                                        />
                                        <span className="min-w-0 flex-1 truncate font-normal text-gray-800 dark:text-gh-text">
                                            {contact.contactPerson || contact.contact_person || contact.companyName || contact.company_name || 'Directory Contact'}
                                            {(contact.designation || contact.category) && (
                                                <span className="ml-1 text-[10px] text-gray-500">
                                                    ({contact.designation || contact.category})
                                                </span>
                                            )}
                                        </span>
                                        {participant && (
                                            <MobileSelect
                                                aria-label={`Attendance for ${id}`}
                                                disabled={readOnly}
                                                className="w-28 shrink-0"
                                                value={participant.attended ? 'present' : 'absent'}
                                                onChange={(event) => setAttendance(id, event.target.value === 'present')}
                                                options={[
                                                    { value: 'present', label: 'Present' },
                                                    { value: 'absent', label: 'Absent' }
                                                ]}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                            {directory.length === 0 && (
                                <p className="text-xs text-gray-500">No directory contacts recorded to select as participants.</p>
                            )}
                        </div>
                    </section>

                    {[
                        ['agenda_points', 'Agenda Points'],
                        ['mom_points', 'Minutes of Meeting (MoM)']
                    ].map(([kind, label]) => (
                        <section key={kind} className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-gray-900 dark:text-gh-text">
                                    {label}
                                </h4>
                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={() => change(kind, [...form[kind], blankPoint()])}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                                    >
                                        <Plus size={13} />
                                        Add Point
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                {(form[kind] || []).map((point, index) => (
                                    <div key={`${kind}-${index}`} className="flex items-center gap-1.5">
                                        <input
                                            disabled={readOnly}
                                            aria-label={`${label} number ${index + 1}`}
                                            value={point.sl_no || ''}
                                            onChange={(event) => setPoint(kind, index, 'sl_no', event.target.value)}
                                            className={`${inputClass} mt-0 w-11 text-center shrink-0`}
                                        />
                                        <input
                                            disabled={readOnly}
                                            aria-label={`${label} point ${index + 1}`}
                                            value={point.point || ''}
                                            onChange={(event) => setPoint(kind, index, 'point', event.target.value)}
                                            className={`${inputClass} mt-0 flex-1`}
                                            placeholder={`Point ${index + 1}`}
                                        />
                                        {!readOnly && form[kind].length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => change(kind, form[kind].filter((_, pointIndex) => pointIndex !== index))}
                                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                aria-label={`Remove ${label} point`}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </form>
            </MobileBottomSheet>

            <MobileConfirmModal
                open={discard}
                title="Discard meeting changes?"
                message="Your unsaved meeting changes will be lost."
                confirmLabel="Discard"
                danger
                onClose={() => setDiscard(false)}
                onConfirm={() => {
                    setDiscard(false);
                    onClose();
                }}
            />
        </>
    );
}
