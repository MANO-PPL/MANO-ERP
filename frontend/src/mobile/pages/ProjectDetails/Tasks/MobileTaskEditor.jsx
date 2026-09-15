import React, { useEffect, useState } from 'react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileDatePicker from '../../../components/MobileDatePicker';
import MobileSelect from '../../../components/MobileSelect';
import { TASK_PRIORITIES, TASK_STATUSES } from './mobileTaskModel';

const fieldClass = 'min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input dark:text-gh-text';

export default function MobileTaskEditor({ open, onClose, task, categories = [], members = [], canWrite, pending, onSave, onDelete, onAssignees }) {
    const [form, setForm] = useState({});
    useEffect(() => { if (open) setForm({ name: task?.name || '', categoryId: task?.categoryId || categories[0]?.id || '', status: task?.status || 'open', priority: task?.priority || 'Medium', startDate: task?.startDate || '', dueDate: task?.dueDate || '' }); }, [categories, open, task]);
    const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    return <MobileBottomSheet open={open} onClose={onClose} title={task ? 'Task details' : 'Create task'} description={task?.task_code || 'Add a task to a category'} footer={canWrite && <div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-gray-200 font-semibold dark:border-gh-border">Cancel</button><button type="button" disabled={pending || !form.name?.trim() || !form.categoryId} onClick={() => onSave?.(form)} className="min-h-11 flex-1 rounded-xl bg-blue-600 font-bold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button></div>}>
        <div className="space-y-4">
            <label className="block text-xs font-semibold">Task name<input disabled={!canWrite} value={form.name || ''} onChange={(event) => update('name', event.target.value)} className={`${fieldClass} mt-1.5`} /></label>
            <MobileSelect disabled={!canWrite || Boolean(task)} label="Category" value={form.categoryId || ''} onChange={(event) => update('categoryId', event.target.value)} options={[{ value: '', label: 'Select category' }, ...categories.map((item) => ({ value: String(item.id), label: item.listName }))]} hint={task ? 'Existing API does not persist category changes.' : undefined} />
            <div className="grid grid-cols-2 gap-3"><MobileSelect disabled={!canWrite} label="Status" value={form.status || 'open'} onChange={(event) => update('status', event.target.value)} options={TASK_STATUSES.map((value) => ({ value, label: value }))} /><MobileSelect disabled={!canWrite} label="Priority" value={form.priority || 'Medium'} onChange={(event) => update('priority', event.target.value)} options={TASK_PRIORITIES.map((value) => ({ value, label: value }))} /></div>
            <div className="grid grid-cols-2 gap-3"><MobileDatePicker disabled={!canWrite} label="Start date" value={form.startDate || ''} onChange={(event) => update('startDate', event.target.value)} /><MobileDatePicker disabled={!canWrite} label="Due date" value={form.dueDate || ''} onChange={(event) => update('dueDate', event.target.value)} /></div>
            {task && <fieldset disabled={!canWrite || task.status === 'completed'}><legend className="mb-2 text-xs font-semibold">Assignees</legend><div className="space-y-1">{members.map((member) => { const checked = (task.assigneeIds || []).map(String).includes(String(member.id)); return <label key={member.id} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-gray-50 dark:hover:bg-gh-hover"><input type="checkbox" checked={checked} onChange={() => onAssignees?.(member.id)} /><span className="text-sm">{member.name}</span></label>; })}</div></fieldset>}
            {task && canWrite && <button type="button" onClick={onDelete} className="min-h-11 w-full rounded-xl border border-red-300 text-sm font-bold text-red-600 dark:border-red-900">Delete task</button>}
        </div>
    </MobileBottomSheet>;
}

