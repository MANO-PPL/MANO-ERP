import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

/**
 * Automatically checks and initializes categories and tasks tables
 */
export async function initializeTasksSchema() {
    const hasCategoriesTable = await db.schema.hasTable('proj_task_categories');
    if (!hasCategoriesTable) {
        await db.schema.createTable('proj_task_categories', (table) => {
            table.increments('id').primary();
            table.integer('project_id').unsigned().notNullable().references('id').inTable('proj_projects').onDelete('CASCADE');
            table.string('name').notNullable();
            table.integer('sort_order').defaultTo(0);
            table.timestamps(true, true);
        });
        console.log('Created table: proj_task_categories');
    }

    const hasTasksTable = await db.schema.hasTable('proj_tasks');
    if (!hasTasksTable) {
        await db.schema.createTable('proj_tasks', (table) => {
            table.increments('id').primary();
            table.integer('project_id').unsigned().notNullable().references('id').inTable('proj_projects').onDelete('CASCADE');
            table.integer('category_id').unsigned().notNullable().references('id').inTable('proj_task_categories').onDelete('CASCADE');
            table.string('task_code').nullable();
            table.string('name').notNullable();
            table.text('description').nullable();
            table.string('status').defaultTo('open');
            table.string('priority').defaultTo('Medium');
            table.date('start_date').nullable();
            table.date('due_date').nullable();
            table.integer('duration').nullable();
            table.integer('sort_order').defaultTo(0);
            table.timestamps(true, true);
        });
        console.log('Created table: proj_tasks');
    }

    const hasAssigneesTable = await db.schema.hasTable('proj_task_assignees');
    if (!hasAssigneesTable) {
        await db.schema.createTable('proj_task_assignees', (table) => {
            table.integer('task_id').unsigned().notNullable().references('id').inTable('proj_tasks').onDelete('CASCADE');
            table.integer('user_id').unsigned().notNullable().references('user_id').inTable('iam_users').onDelete('CASCADE');
            table.primary(['task_id', 'user_id']);
        });
        console.log('Created table: proj_task_assignees');
    }
}

/**
 * Retrieve all categories and nested tasks for a project
 */
export async function getTasksAndCategories(projectId) {
    const categories = await db('proj_task_categories')
        .where('project_id', projectId)
        .orderBy('sort_order', 'asc')
        .orderBy('created_at', 'asc');

    const tasks = await db('proj_tasks')
        .where('project_id', projectId)
        .orderBy('sort_order', 'asc')
        .orderBy('created_at', 'asc');

    const taskIds = tasks.map(t => t.id);
    const assignees = taskIds.length > 0
        ? await db('proj_task_assignees').whereIn('task_id', taskIds)
        : [];

    // Structure tasks inside their corresponding listName (category)
    return categories.map(cat => ({
        id: cat.id,
        listName: cat.name,
        tasks: tasks.filter(t => t.category_id === cat.id).map(t => ({
            id: t.id,
            task_code: t.task_code,
            name: t.name,
            description: t.description || '',
            owner: 'Nice Bike', // Temporary placeholder until user assignment features are wired
            status: t.status,
            startDate: t.start_date ? t.start_date.toISOString().split('T')[0] : '',
            dueDate: t.due_date ? t.due_date.toISOString().split('T')[0] : '',
            duration: t.duration ? `${t.duration} days` : 'Auto',
            priority: t.priority,
            assigneeIds: assignees.filter(a => a.task_id === t.id).map(a => a.user_id)
        }))
    }));
}

/**
 * Create a new task category (list)
 */
export async function createCategory(projectId, name) {
    if (!name) throw new AppError('Category name is required', 400);

    const lastCat = await db('proj_task_categories')
        .where('project_id', projectId)
        .orderBy('sort_order', 'desc')
        .first();
    const sortOrder = lastCat ? lastCat.sort_order + 10 : 10;

    const [id] = await db('proj_task_categories').insert({
        project_id: projectId,
        name,
        sort_order: sortOrder
    });

    return { id, listName: name, tasks: [] };
}

/**
 * Rename a task category
 */
export async function updateCategory(categoryId, name) {
    if (!name) throw new AppError('Category name is required', 400);

    await db('proj_task_categories')
        .where('id', categoryId)
        .update({ name, updated_at: db.fn.now() });

    return { id: categoryId, listName: name };
}

/**
 * Delete a category and cascaded tasks
 */
export async function deleteCategory(categoryId) {
    await db('proj_task_categories').where('id', categoryId).del();
    return { success: true };
}

/**
 * Create a new task
 */
export async function createTask(projectId, data) {
    const { category_id, name, status, priority, start_date, due_date, duration } = data;
    if (!category_id) throw new AppError('Category ID is required', 400);
    if (!name) throw new AppError('Task name is required', 400);

    // Calculate a simple incremental Task ID sequence per project
    const lastTask = await db('proj_tasks')
        .where('project_id', projectId)
        .orderBy('id', 'desc')
        .first();
    const nextNum = lastTask ? lastTask.id + 1 : 1;
    const taskCode = `T-${nextNum}`;

    const lastInCat = await db('proj_tasks')
        .where({ project_id: projectId, category_id })
        .orderBy('sort_order', 'desc')
        .first();
    const sortOrder = lastInCat ? lastInCat.sort_order + 10 : 10;

    const [id] = await db('proj_tasks').insert({
        project_id: projectId,
        category_id,
        task_code: taskCode,
        name,
        status: status || 'open',
        priority: priority || 'Medium',
        start_date: start_date || null,
        due_date: due_date || null,
        duration: duration || null,
        sort_order: sortOrder
    });

    return {
        id,
        task_code: taskCode,
        name,
        owner: 'Nice Bike',
        status: status || 'open',
        startDate: start_date || '',
        dueDate: due_date || '',
        duration: duration ? `${duration} days` : 'Auto',
        priority: priority || 'Medium'
    };
}

/**
 * Update task properties
 */
export async function updateTask(taskId, data) {
    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.status !== undefined) updates.status = data.status;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.start_date !== undefined) updates.start_date = data.start_date || null;
    if (data.due_date !== undefined) updates.due_date = data.due_date || null;
    if (data.duration !== undefined) updates.duration = data.duration || null;
    if (data.description !== undefined) updates.description = data.description || null;

    updates.updated_at = db.fn.now();

    await db('proj_tasks').where('id', taskId).update(updates);

    const task = await db('proj_tasks').where('id', taskId).first();
    return {
        id: task.id,
        task_code: task.task_code,
        name: task.name,
        owner: 'Nice Bike',
        status: task.status,
        startDate: task.start_date ? task.start_date.toISOString().split('T')[0] : '',
        dueDate: task.due_date ? task.due_date.toISOString().split('T')[0] : '',
        duration: task.duration ? `${task.duration} days` : 'Auto',
        priority: task.priority
    };
}

/**
 * Delete an individual task
 */
export async function deleteTask(taskId) {
    await db('proj_tasks').where('id', taskId).del();
    return { success: true };
}

/**
 * Reorder task or category sequences
 */
export async function reorderTasksOrCategories(projectId, type, items) {
    if (!['task', 'category'].includes(type)) {
        throw new AppError('Invalid reorder type', 400);
    }
    if (!Array.isArray(items)) {
        throw new AppError('Items array is required', 400);
    }

    const tableName = type === 'task' ? 'proj_tasks' : 'proj_task_categories';

    await db.transaction(async (trx) => {
        for (const item of items) {
            await trx(tableName)
                .where({ id: item.id, project_id: projectId })
                .update({ sort_order: item.sort_order });
        }
    });

    return { success: true };
}

/**
 * Update task assignees array
 */
export async function updateTaskAssignees(taskId, assigneeIds) {
    if (!Array.isArray(assigneeIds)) {
        throw new AppError('assigneeIds must be an array of user IDs', 400);
    }

    await db.transaction(async (trx) => {
        await trx('proj_task_assignees').where('task_id', taskId).del();

        if (assigneeIds.length > 0) {
            const rows = assigneeIds.map(uid => ({
                task_id: taskId,
                user_id: uid
            }));
            await trx('proj_task_assignees').insert(rows);
        }
    });

    return { taskId, assigneeIds };
}

export default {
    initializeTasksSchema,
    getTasksAndCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    createTask,
    updateTask,
    deleteTask,
    reorderTasksOrCategories,
    updateTaskAssignees
};
