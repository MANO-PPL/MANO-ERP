import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Filter, ListChecks, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileConfirmModal from '../../../components/MobileConfirmModal';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileFAB from '../../../components/MobileFAB';
import MobileFilterSheet from '../../../components/MobileFilterSheet';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileSearchBar from '../../../components/MobileSearchBar';
import MobileSelect from '../../../components/MobileSelect';
import MobileTabs from '../../../components/MobileTabs';
import { MobileStatCard } from '../../../components/MobileCard';
import MobileTaskBoard from './MobileTaskBoard';
import MobileTaskCard from './MobileTaskCard';
import MobileTaskEditor from './MobileTaskEditor';
import useMobileProjectTasks from './useMobileProjectTasks';
import { buildAssigneePayload, buildCategoryPayload, buildTaskCsv, buildTaskPayload, buildTaskReorderPayload, filterTaskCategories, flattenTaskCategories, taskDuration, taskStats, TASK_PRIORITIES, TASK_STATUSES } from './mobileTaskModel';

const buttonClass = 'min-h-11 rounded-xl border border-gray-200 px-3 text-sm font-bold dark:border-gh-border';
const errorMessage = (error, fallback) => error?.response?.status === 403 ? 'Access denied by the current ERP permission policy.' : error?.response?.data?.message || error?.message || fallback;

export default function MobileProjectTasks({ projectId, canWrite, taskService, projectService }) {
    const workspace = useMobileProjectTasks({ projectId, taskService, projectService });
    const { categories, members, loading, error, setCategories } = workspace;
    const service = workspace.taskService;
    const [params, setParams] = useSearchParams();
    const status = params.get('status') || 'All'; const priority = params.get('priority') || 'All'; const view = params.get('view') || 'list';
    const [query, setQuery] = useState(''); const [quick, setQuick] = useState('all'); const [lane, setLane] = useState('open');
    const [editor, setEditor] = useState(null); const [pending, setPending] = useState(false); const [message, setMessage] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false); const [draftFilters, setDraftFilters] = useState({ status, priority });
    const [selected, setSelected] = useState(new Set()); const [confirm, setConfirm] = useState(null);
    const [categoryEditor, setCategoryEditor] = useState(null);
    const activeProjectRef = useRef(projectId); activeProjectRef.current = projectId;
    useEffect(() => {
        setEditor(null); setPending(false); setMessage(''); setFiltersOpen(false);
        setSelected(new Set()); setConfirm(null); setCategoryEditor(null);
    }, [projectId]);
    const filtered = useMemo(() => filterTaskCategories(categories, { query, status, priority, quick, members }), [categories, members, priority, query, quick, status]);
    const allFiltered = flattenTaskCategories(filtered); const stats = taskStats(categories);
    const setQueryParam = (key, value, defaultValue) => { const next = new URLSearchParams(params); if (!value || value === defaultValue) next.delete(key); else next.set(key, value); setParams(next); };
    const commit = async (work, success) => { const operationProjectId = String(projectId); setPending(true); setMessage(''); try { await work(); if (String(activeProjectRef.current) !== operationProjectId) return false; setMessage(success); return true; } catch (caught) { if (String(activeProjectRef.current) !== operationProjectId) return false; setMessage(errorMessage(caught, 'The task change failed.')); return false; } finally { if (String(activeProjectRef.current) === operationProjectId) setPending(false); } };
    const replaceTask = (taskId, patch) => setCategories((current) => current.map((category) => ({ ...category, tasks: (category.tasks || []).map((task) => task.id === taskId ? { ...task, ...patch } : task) })));
    const removeTask = (taskId) => setCategories((current) => current.map((category) => ({ ...category, tasks: (category.tasks || []).filter((task) => task.id !== taskId) })));

    const saveTask = async (form) => {
        if (editor?.task) {
            const task = editor.task; const fields = { name: form.name.trim(), status: form.status, priority: form.priority, start_date: form.startDate || null, due_date: form.dueDate || null, duration: taskDuration(form.startDate, form.dueDate) };
            if (await commit(() => service.updateTask(projectId, task.id, fields), 'Task updated.')) { replaceTask(task.id, { name: fields.name, status: fields.status, priority: fields.priority, startDate: form.startDate, dueDate: form.dueDate, duration: fields.duration ? `${fields.duration} days` : 'Auto' }); setEditor(null); }
        } else {
            const payload = buildTaskPayload(form);
            let created;
            if (await commit(async () => { const response = await service.createTask(projectId, payload); created = response.task; }, 'Task created.')) { setCategories((current) => current.map((category) => String(category.id) === String(payload.category_id) ? { ...category, tasks: [...(category.tasks || []), { ...created, assigneeIds: created.assigneeIds || [] }] } : category)); setEditor(null); }
        }
    };
    const toggleAssignee = async (task, memberId) => { const ids = (task.assigneeIds || []).map(String).includes(String(memberId)) ? task.assigneeIds.filter((id) => String(id) !== String(memberId)) : [...(task.assigneeIds || []), memberId]; if (await commit(() => service.updateTaskAssignees(projectId, task.id, buildAssigneePayload(ids)), 'Assignees updated.')) { replaceTask(task.id, { assigneeIds: ids }); setEditor((current) => current?.task?.id === task.id ? { task: { ...current.task, assigneeIds: ids } } : current); } };
    const deleteTasks = async (ids) => { if (await commit(() => Promise.all(ids.map((id) => service.deleteTask(projectId, id))), `${ids.length} task${ids.length === 1 ? '' : 's'} deleted.`)) { ids.forEach(removeTask); setSelected(new Set()); setEditor(null); } setConfirm(null); };
    const saveCategory = async () => { const name = categoryEditor.name.trim(); if (!name) return; if (categoryEditor.id) { if (await commit(() => service.updateCategory(projectId, categoryEditor.id, buildCategoryPayload(name)), 'Category renamed.')) setCategories((current) => current.map((item) => item.id === categoryEditor.id ? { ...item, listName: name } : item)); } else { let created; if (await commit(async () => { created = (await service.createCategory(projectId, buildCategoryPayload(name))).category; }, 'Category created.')) setCategories((current) => [...current, created]); } setCategoryEditor(null); };
    const deleteCategory = async () => { const target = confirm.category; if (await commit(() => service.deleteCategory(projectId, target.id), 'Category deleted.')) setCategories((current) => current.filter((item) => item.id !== target.id)); setConfirm(null); };
    const moveTask = async (task, direction) => { const category = categories.find((item) => item.id === task.categoryId); const index = category.tasks.findIndex((item) => item.id === task.id); const target = index + direction; if (target < 0 || target >= category.tasks.length) return; const reordered = [...category.tasks]; [reordered[index], reordered[target]] = [reordered[target], reordered[index]]; if (await commit(() => service.reorder(projectId, buildTaskReorderPayload(reordered)), 'Task order updated.')) setCategories((current) => current.map((item) => item.id === category.id ? { ...item, tasks: reordered } : item)); };
    const exportCsv = () => { const blob = new Blob([buildTaskCsv(filtered)], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tasks_export_${Date.now()}.csv`; anchor.click(); URL.revokeObjectURL(url); };
    if (loading) return <div data-m5-module="Tasks"><MobileLoadingState label="Loading tasks" rows={4} /></div>;
    if (error) return <MobileEmptyState title="Tasks unavailable" description={errorMessage(error, 'Tasks could not be loaded.')} action={<button className={buttonClass} onClick={() => workspace.load(true)}>Try again</button>} />;
    return <div data-m5-module="Tasks" className="min-w-0 space-y-4 px-4 pb-28">
        {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">{message}</p>}
        <div className="grid grid-cols-2 gap-3"><MobileStatCard label="Total" value={stats.total} icon={ListChecks} /><MobileStatCard label="Completed" value={stats.completed} detail={`${stats.overdue} overdue`} tone="green" /></div>
        <MobileTabs segmented label="Task view" value={view} onChange={(value) => setQueryParam('view', value, 'list')} items={[{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }]} />
        <div className="flex gap-2"><MobileSearchBar value={query} onChange={setQuery} placeholder="Search tasks, codes, assignees" /><button type="button" aria-label="Filter tasks" onClick={() => { setDraftFilters({ status, priority }); setFiltersOpen(true); }} className={buttonClass}><Filter size={18} /></button></div>
        <MobileTabs label="Task KPI filters" value={quick} onChange={setQuick} items={[{ value: 'all', label: 'All', count: stats.total }, { value: 'in_progress', label: 'In progress', count: stats.inProgress }, { value: 'high_priority', label: 'High', count: stats.highPriority }, { value: 'overdue', label: 'Overdue', count: stats.overdue }]} />
        <div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={exportCsv}><Download size={16} className="inline" /> Export CSV</button>{canWrite && <button className={buttonClass} onClick={() => setCategoryEditor({ name: '' })}><Plus size={16} className="inline" /> Category</button>}<button className={buttonClass} onClick={() => setSelected((current) => current.size ? new Set() : new Set(allFiltered.map((task) => task.id)))}>{selected.size ? 'Exit selection' : 'Select'}</button></div>
        {selected.size > 0 && canWrite && <button onClick={() => setConfirm({ ids: [...selected] })} className="min-h-11 w-full rounded-xl bg-red-600 text-sm font-bold text-white"><Trash2 size={16} className="inline" /> Delete {selected.size} selected</button>}
        {view === 'board' ? <MobileTaskBoard tasks={allFiltered} lane={lane} onLaneChange={setLane} members={members} onOpen={(task) => setEditor({ task })} /> : <div className="space-y-5">{filtered.map((category) => <section key={category.id} className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-sm font-black dark:text-gh-text">{category.listName} <span className="text-gray-400">({category.tasks.length})</span></h2>{canWrite && <div className="flex gap-1"><button className={buttonClass} onClick={() => setCategoryEditor({ id: category.id, name: category.listName })}>Rename</button><button className={`${buttonClass} text-red-600`} onClick={() => setConfirm({ category })}>Delete</button></div>}</div>{category.tasks.map((task) => <div key={task.id}><MobileTaskCard task={task} category={category.listName} members={members} selectionMode={selected.size > 0} selected={selected.has(task.id)} onToggle={() => setSelected((current) => { const next = new Set(current); next.has(task.id) ? next.delete(task.id) : next.add(task.id); return next; })} onOpen={() => setEditor({ task: { ...task, categoryId: category.id } })} />{canWrite && <div className="mt-1 flex justify-end gap-1"><button className="min-h-9 px-3 text-xs" onClick={() => moveTask({ ...task, categoryId: category.id }, -1)}>Move up</button><button className="min-h-9 px-3 text-xs" onClick={() => moveTask({ ...task, categoryId: category.id }, 1)}>Move down</button></div>}</div>)}{category.tasks.length === 0 && <p className="text-xs text-gray-500">No matching tasks.</p>}</section>)}</div>}
        {categories.length === 0 && <MobileEmptyState title="No task categories" description="Create a category before adding tasks." />}
        {canWrite && categories.length > 0 && <MobileFAB label="Create task" extended onClick={() => setEditor({ task: null })} />}
        <MobileTaskEditor open={editor !== null} onClose={() => setEditor(null)} task={editor?.task} categories={categories} members={members} canWrite={canWrite} pending={pending} onSave={saveTask} onDelete={() => setConfirm({ ids: [editor.task.id] })} onAssignees={(id) => toggleAssignee(editor.task, id)} />
        <MobileFilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} onReset={() => setDraftFilters({ status: 'All', priority: 'All' })} onApply={() => { const next = new URLSearchParams(params); if (draftFilters.status === 'All') next.delete('status'); else next.set('status', draftFilters.status); if (draftFilters.priority === 'All') next.delete('priority'); else next.set('priority', draftFilters.priority); setParams(next); setFiltersOpen(false); }}><MobileSelect label="Status" value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))} options={['All', ...TASK_STATUSES].map((value) => ({ value, label: value }))} /><MobileSelect label="Priority" value={draftFilters.priority} onChange={(event) => setDraftFilters((current) => ({ ...current, priority: event.target.value }))} options={['All', ...TASK_PRIORITIES].map((value) => ({ value, label: value }))} /></MobileFilterSheet>
        <MobileBottomSheet open={categoryEditor !== null} onClose={() => setCategoryEditor(null)} title={categoryEditor?.id ? 'Rename category' : 'Create category'} footer={<button disabled={pending || !categoryEditor?.name.trim()} onClick={saveCategory} className="min-h-11 w-full rounded-xl bg-blue-600 font-bold text-white disabled:opacity-50">Save category</button>}><label className="text-xs font-semibold">Name<input value={categoryEditor?.name || ''} onChange={(event) => setCategoryEditor((current) => ({ ...current, name: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 px-3 dark:border-gh-border dark:bg-gh-input" /></label></MobileBottomSheet>
        <MobileConfirmModal open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => confirm?.category ? deleteCategory() : deleteTasks(confirm?.ids || [])} pending={pending} danger title={confirm?.category ? 'Delete category' : 'Delete tasks'} message={confirm?.category ? `Delete ${confirm.category.listName} and its tasks?` : `Delete ${confirm?.ids?.length || 0} selected task(s)?`} />
    </div>;
}
