import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Plus, UserPlus, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileFAB from '../../../components/MobileFAB';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileSearchBar from '../../../components/MobileSearchBar';
import MobileTabs from '../../../components/MobileTabs';
import { MobileStatCard } from '../../../components/MobileCard';
import MobileTaskCard from '../Tasks/MobileTaskCard';
import MobileTaskEditor from '../Tasks/MobileTaskEditor';
import useMobileProjectTasks from '../Tasks/useMobileProjectTasks';
import { buildTaskPayload, createAndAssignTask, flattenTaskCategories, isTaskOverdue, TASK_STATUSES } from '../Tasks/mobileTaskModel';
import MobileWipEmployeeSheet from './MobileWipEmployeeSheet';

const errorMessage = (error) => error?.response?.status === 403 ? 'Access denied by the current ERP permission policy.' : error?.response?.data?.message || error?.message || 'WIP data could not be loaded.';

export default function MobileProjectWIP({ projectId, canWrite, isAdmin, user, taskService, projectService }) {
    const workspace = useMobileProjectTasks({ projectId, taskService, projectService }); const { categories, members, loading, error, setCategories } = workspace; const service = workspace.taskService;
    const [params, setParams] = useSearchParams(); const [employeeOpen, setEmployeeOpen] = useState(false); const [lane, setLane] = useState('open'); const [query, setQuery] = useState(''); const [assignOpen, setAssignOpen] = useState(false); const [editor, setEditor] = useState(null); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
    const activeProjectRef = useRef(projectId); activeProjectRef.current = projectId;
    const previousProjectRef = useRef(projectId);
    useEffect(() => {
        setEmployeeOpen(false); setAssignOpen(false); setEditor(null); setPending(false); setMessage('');
        if (String(previousProjectRef.current) !== String(projectId)) {
            const next = new URLSearchParams(params); next.delete('emp'); setParams(next, { replace: true });
        }
        previousProjectRef.current = projectId;
    }, [projectId]);
    const userId = user?.user_id ?? user?.id; const requested = params.get('emp');
    const selectedId = isAdmin ? (members.some((member) => String(member.id) === String(requested)) ? requested : members[0]?.id) : userId;
    useEffect(() => { if (isAdmin && selectedId && String(requested) !== String(selectedId)) { const next = new URLSearchParams(params); next.set('emp', selectedId); setParams(next, { replace: true }); } }, [isAdmin, params, requested, selectedId, setParams]);
    const selectedMember = members.find((member) => String(member.id) === String(selectedId)); const tasks = flattenTaskCategories(categories); const assigned = tasks.filter((task) => (task.assigneeIds || []).map(String).includes(String(selectedId))); const unassigned = tasks.filter((task) => !(task.assigneeIds || []).length); const visible = assigned.filter((task) => task.status === lane && (!query || [task.name, task.task_code, task.categoryName].join(' ').toLowerCase().includes(query.toLowerCase())));
    const stats = useMemo(() => ({ total: assigned.length, completed: assigned.filter((task) => task.status === 'completed').length, inProgress: assigned.filter((task) => task.status === 'in progress').length, overdue: assigned.filter((task) => isTaskOverdue(task)).length }), [assigned]);
    const commit = async (work, success) => { const operationProjectId = String(projectId); setPending(true); setMessage(''); try { await work(); if (String(activeProjectRef.current) !== operationProjectId) return false; setMessage(success); return true; } catch (caught) { if (String(activeProjectRef.current) !== operationProjectId) return false; setMessage(errorMessage(caught)); return false; } finally { if (String(activeProjectRef.current) === operationProjectId) setPending(false); } };
    const replaceTask = (id, patch) => setCategories((current) => current.map((category) => ({ ...category, tasks: category.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) })));
    const selectEmployee = (id) => { const next = new URLSearchParams(params); next.set('emp', id); setParams(next); };
    const saveTask = async (form) => { if (editor?.task) { const payload = { name: form.name.trim(), status: form.status, priority: form.priority, start_date: form.startDate || null, due_date: form.dueDate || null }; if (await commit(() => service.updateTask(projectId, editor.task.id, payload), 'Task updated.')) { replaceTask(editor.task.id, { name: payload.name, status: payload.status, priority: payload.priority, startDate: form.startDate, dueDate: form.dueDate }); setEditor(null); } } else { const payload = buildTaskPayload(form); let outcome; if (await commit(async () => { outcome = await createAndAssignTask(service, projectId, payload, selectedId); }, 'Task created and assigned.')) { setCategories((current) => current.map((category) => String(category.id) === String(payload.category_id) ? { ...category, tasks: [...category.tasks, outcome.task] } : category)); setEditor(null); if (!outcome.assigned) { setMessage(`Task created, but it could not be assigned: ${errorMessage(outcome.assignmentError)}`); await workspace.load(true); } } } };
    const assign = async (task) => { const ids = [...(task.assigneeIds || []), selectedId]; if (await commit(() => service.updateTaskAssignees(projectId, task.id, { assigneeIds: ids }), `Task assigned to ${selectedMember?.name || 'employee'}.`)) { replaceTask(task.id, { assigneeIds: ids }); setAssignOpen(false); } };
    const unassign = async (task) => { const ids = (task.assigneeIds || []).filter((id) => String(id) !== String(selectedId)); if (await commit(() => service.updateTaskAssignees(projectId, task.id, { assigneeIds: ids }), 'Task unassigned.')) replaceTask(task.id, { assigneeIds: ids }); };
    const setStatus = async (task, status) => { if (await commit(() => service.updateTask(projectId, task.id, { status }), `Moved to ${status}.`)) replaceTask(task.id, { status }); };
    if (loading) return <div data-m5-module="WIP"><MobileLoadingState label="Loading WIP" rows={4} /></div>; if (error) return <MobileEmptyState title="WIP unavailable" description={errorMessage(error)} action={<button className="min-h-11 rounded-xl border px-4" onClick={() => workspace.load(true)}>Try again</button>} />;
    return <div data-m5-module="WIP" className="min-w-0 space-y-4 px-4 pb-28">
        {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-xs dark:bg-blue-950/40">{message}</p>}
        <button disabled={!isAdmin} onClick={() => setEmployeeOpen(true)} className="min-h-14 w-full rounded-2xl border border-gray-200 bg-white p-4 text-left dark:border-gh-border dark:bg-gh-subtle"><span className="text-[10px] font-bold uppercase text-gray-500">Employee workload</span><strong className="mt-1 block">{selectedMember?.name || 'No matching project member'}</strong></button>
        <div className="grid grid-cols-2 gap-3"><MobileStatCard label="Assigned" value={stats.total} icon={Users} /><MobileStatCard label="Completed" value={stats.completed} detail={`${stats.overdue} overdue`} icon={Activity} tone="green" /></div>
        <MobileSearchBar value={query} onChange={setQuery} placeholder="Search assigned tasks" /><MobileTabs segmented label="WIP status" value={lane} onChange={setLane} items={TASK_STATUSES.map((status) => ({ value: status, label: status, count: assigned.filter((task) => task.status === status).length }))} />
        <div className="space-y-3">{visible.map((task) => <div key={task.id}><MobileTaskCard task={task} category={task.categoryName} members={members} onOpen={() => setEditor({ task })} />{canWrite && <div className="mt-1 flex flex-wrap justify-end gap-1">{TASK_STATUSES.filter((status) => status !== task.status).slice(0, 2).map((status) => <button key={status} disabled={pending} className="min-h-9 px-2 text-xs capitalize" onClick={() => setStatus(task, status)}>{status}</button>)}{isAdmin && <button className="min-h-9 px-2 text-xs text-red-600" onClick={() => unassign(task)}>Unassign</button>}</div>}</div>)}{visible.length === 0 && <MobileEmptyState title={`No ${lane} tasks`} />}</div>
        {canWrite && <div className="grid grid-cols-2 gap-2"><button onClick={() => setEditor({ task: null })} className="min-h-11 rounded-xl border border-gray-200 font-bold dark:border-gh-border"><Plus size={16} className="inline" /> New task</button><button onClick={() => setAssignOpen(true)} className="min-h-11 rounded-xl bg-blue-600 font-bold text-white"><UserPlus size={16} className="inline" /> Assign task</button></div>}
        {canWrite && <MobileFAB label="New WIP task" onClick={() => setEditor({ task: null })} />}
        <MobileWipEmployeeSheet open={employeeOpen} onClose={() => setEmployeeOpen(false)} members={members} value={selectedId} onChange={selectEmployee} />
        <MobileBottomSheet open={assignOpen} onClose={() => setAssignOpen(false)} title="Unassigned tasks" description={`Assign to ${selectedMember?.name || 'employee'}`}><div className="space-y-3">{unassigned.map((task) => <button disabled={pending || task.status === 'completed'} key={task.id} onClick={() => assign(task)} className="min-h-14 w-full rounded-xl border border-gray-200 p-3 text-left disabled:opacity-50 dark:border-gh-border"><b className="block text-sm">{task.name}</b><span className="text-xs text-gray-500">{task.categoryName} · {task.status}</span></button>)}{unassigned.length === 0 && <MobileEmptyState title="All tasks are assigned" />}</div></MobileBottomSheet>
        <MobileTaskEditor open={editor !== null} onClose={() => setEditor(null)} task={editor?.task} categories={categories} members={[]} canWrite={canWrite} pending={pending} onSave={saveTask} />
    </div>;
}
