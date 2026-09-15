export const TASK_STATUSES = Object.freeze(['open', 'in progress', 'on hold', 'completed', 'cancelled']);
export const TASK_PRIORITIES = Object.freeze(['High', 'Medium', 'Low', 'None']);

export function normalizeMember(member = {}) {
    const id = member.user_id ?? member.id;
    return { ...member, id, user_id: id, name: member.user_name || member.name || member.username || 'Project member' };
}

export function flattenTaskCategories(categories = []) {
    return categories.flatMap((category) => (category.tasks || []).map((task) => ({
        ...task, categoryId: category.id, categoryName: category.listName,
    })));
}

export function taskDuration(startDate, dueDate) {
    if (!startDate || !dueDate) return null;
    const start = new Date(startDate); const end = new Date(dueDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
    return Math.ceil((end - start) / 86400000) + 1;
}

export function buildTaskPayload(form = {}) {
    return {
        category_id: Number(form.categoryId || form.category_id),
        name: String(form.name || '').trim(),
        status: form.status || 'open',
        priority: form.priority || 'Medium',
        start_date: form.startDate || null,
        due_date: form.dueDate || null,
        duration: taskDuration(form.startDate, form.dueDate),
    };
}

export const buildCategoryPayload = (name) => ({ name: String(name || '').trim() });
export const buildAssigneePayload = (assigneeIds = []) => ({ assigneeIds: [...assigneeIds] });
export const buildTaskReorderPayload = (tasks = []) => ({ type: 'task', items: tasks.map((task, index) => ({ id: task.id, sort_order: (index + 1) * 10 })) });

export async function createAndAssignTask(taskService, projectId, payload, userId) {
    const response = await taskService.createTask(projectId, payload);
    if (!response?.success || !response.task) throw new Error(response?.message || 'Task creation failed');
    try {
        const assignment = await taskService.updateTaskAssignees(projectId, response.task.id, buildAssigneePayload([userId]));
        if (assignment?.success === false) throw new Error(assignment.message || 'Task assignment failed');
        return { task: { ...response.task, assigneeIds: [userId] }, assigned: true, assignmentError: null };
    } catch (assignmentError) {
        return { task: { ...response.task, assigneeIds: [] }, assigned: false, assignmentError };
    }
}

export function buildTaskFieldPayload(field, value, task = {}) {
    const apiField = field === 'startDate' ? 'start_date' : field === 'dueDate' ? 'due_date' : field;
    const payload = { [apiField]: value || null };
    if (field === 'startDate' || field === 'dueDate') {
        const start = field === 'startDate' ? value : task.startDate;
        const due = field === 'dueDate' ? value : task.dueDate;
        payload.duration = taskDuration(start, due);
    }
    return payload;
}

export function isTaskOverdue(task, today = new Date()) {
    if (!task?.dueDate || ['completed', 'cancelled'].includes(String(task.status).toLowerCase())) return false;
    const due = new Date(task.dueDate); const boundary = new Date(today); boundary.setHours(0, 0, 0, 0);
    return !Number.isNaN(due.getTime()) && due < boundary;
}

export function filterTaskCategories(categories, { query = '', status = 'All', priority = 'All', quick = 'all', members = [] } = {}) {
    const needle = query.trim().toLowerCase();
    return (categories || []).map((category) => ({ ...category, tasks: (category.tasks || []).filter((task) => {
        const assignees = members.filter((member) => (task.assigneeIds || []).map(String).includes(String(member.id)));
        const searchable = [task.name, task.task_code, category.listName, ...assignees.map((member) => member.name)].join(' ').toLowerCase();
        const quickMatch = quick === 'all'
            || (quick === 'completed' && task.status === 'completed')
            || (quick === 'in_progress' && task.status === 'in progress')
            || (quick === 'high_priority' && task.priority === 'High')
            || (quick === 'overdue' && isTaskOverdue(task));
        return (!needle || searchable.includes(needle))
            && (status === 'All' || task.status === status)
            && (priority === 'All' || task.priority === priority)
            && quickMatch;
    }) }));
}

export function taskStats(categories = []) {
    const tasks = flattenTaskCategories(categories);
    return {
        total: tasks.length,
        completed: tasks.filter((task) => task.status === 'completed').length,
        inProgress: tasks.filter((task) => task.status === 'in progress').length,
        highPriority: tasks.filter((task) => task.priority === 'High').length,
        overdue: tasks.filter((task) => isTaskOverdue(task)).length,
    };
}

export function buildTaskCsv(categories = []) {
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [['Section', 'Task Code', 'Task Name', 'Status', 'Priority', 'Start Date', 'Due Date', 'Duration']];
    for (const category of categories) for (const task of category.tasks || []) rows.push([
        category.listName, task.task_code, task.name, task.status, task.priority, task.startDate, task.dueDate, task.duration,
    ]);
    return rows.map((row) => row.map(escape).join(',')).join('\n');
}
