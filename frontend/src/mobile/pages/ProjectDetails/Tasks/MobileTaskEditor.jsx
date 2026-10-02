import React, { useEffect, useState } from 'react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileDatePicker from '../../../components/MobileDatePicker';
import MobileSelect from '../../../components/MobileSelect';
import { TASK_PRIORITIES, TASK_STATUSES } from './mobileTaskModel';

const fieldClass = 'min-h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs font-normal outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input dark:text-gh-text';

export default function MobileTaskEditor({ open, onClose, task, categories = [], members = [], canWrite, pending, onSave, onDelete, onAssignees }) {
    const [form, setForm] = useState({});
    useEffect(() => { if (open) setForm({ name: task?.name || '', categoryId: task?.categoryId || categories[0]?.id || '', status: task?.status || 'open', priority: task?.priority || 'Medium', startDate: task?.startDate || '', dueDate: task?.dueDate || '' }); }, [categories, open, task]);
    const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    return <MobileBottomSheet open={open} onClose={onClose} title={task ? 'Task details' : 'Create task'} description={task?.task_code || 'Add a task to a category'} footer={canWrite && <div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-9 flex-1 rounded-lg border border-gray-200 text-xs font-normal text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Cancel</button><button type="button" disabled={pending || !form.name?.trim() || !form.categoryId} onClick={() => onSave?.(form)} className="min-h-9 flex-1 rounded-lg bg-blue-600 text-xs font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button></div>}>
        <div className="space-y-2.5">
            <label className="block text-xs font-medium text-gray-700 dark:text-gh-text">Task name<input disabled={!canWrite} value={form.name || ''} onChange={(event) => update('name', event.target.value)} className={`${fieldClass} mt-1`} /></label>
            <MobileSelect disabled={!canWrite || Boolean(task)} label="Category" value={form.categoryId || ''} onChange={(event) => update('categoryId', event.target.value)} options={[{ value: '', label: 'Select category' }, ...categories.map((item) => ({ value: String(item.id), label: item.listName }))]} hint={task ? 'Existing API does not persist category changes.' : undefined} />
            <div className="grid grid-cols-2 gap-2"><MobileSelect disabled={!canWrite} label="Status" value={form.status || 'open'} onChange={(event) => update('status', event.target.value)} options={TASK_STATUSES.map((value) => ({ value, label: value }))} /><MobileSelect disabled={!canWrite} label="Priority" value={form.priority || 'Medium'} onChange={(event) => update('priority', event.target.value)} options={TASK_PRIORITIES.map((value) => ({ value, label: value }))} /></div>
            <div className="grid grid-cols-2 gap-2"><MobileDatePicker disabled={!canWrite} label="Start date" value={form.startDate || ''} onChange={(event) => update('startDate', event.target.value)} /><MobileDatePicker disabled={!canWrite} label="Due date" value={form.dueDate || ''} onChange={(event) => update('dueDate', event.target.value)} /></div>
            {task && <fieldset disabled={!canWrite || task.status === 'completed'}><legend className="mb-1.5 text-xs font-medium text-gray-700 dark:text-gh-text">Assignees</legend><div className="space-y-1">{members.map((member) => { const checked = (task.assigneeIds || []).map(String).includes(String(member.id)); return <label key={member.id} className="flex min-h-8 items-center gap-2.5 rounded-lg px-2 text-xs font-normal hover:bg-gray-50 dark:hover:bg-gh-hover"><input type="checkbox" checked={checked} onChange={() => onAssignees?.(member.id)} className="rounded" /><span>{member.name}</span></label>; })}</div></fieldset>}
            {task && canWrite && <button type="button" onClick={onDelete} className="min-h-9 w-full rounded-lg border border-red-300 text-xs font-semibold text-red-600 dark:border-red-900">Delete task</button>}
        </div>
    </MobileBottomSheet>;
}

