import catchAsync from '../../../utils/catchAsync.js';
import tasksService from './tasksService.js';

export const getTasks = catchAsync(async (req, res, next) => {
    const projectId = req.params.id || req.params.projectId;
    const categories = await tasksService.getTasksAndCategories(projectId);
    res.status(200).json({ success: true, categories });
});

export const createCategory = catchAsync(async (req, res, next) => {
    const projectId = req.params.id || req.params.projectId;
    const { name } = req.body;
    const category = await tasksService.createCategory(projectId, name);
    res.status(201).json({ success: true, category });
});

export const updateCategory = catchAsync(async (req, res, next) => {
    const { categoryId } = req.params;
    const { name } = req.body;
    const category = await tasksService.updateCategory(categoryId, name);
    res.status(200).json({ success: true, category });
});

export const deleteCategory = catchAsync(async (req, res, next) => {
    const { categoryId } = req.params;
    await tasksService.deleteCategory(categoryId);
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
});

export const createTask = catchAsync(async (req, res, next) => {
    const projectId = req.params.id || req.params.projectId;
    const task = await tasksService.createTask(projectId, req.body);
    res.status(201).json({ success: true, task });
});

export const updateTask = catchAsync(async (req, res, next) => {
    const { taskId } = req.params;
    const task = await tasksService.updateTask(taskId, req.body);
    res.status(200).json({ success: true, task });
});

export const deleteTask = catchAsync(async (req, res, next) => {
    const { taskId } = req.params;
    await tasksService.deleteTask(taskId);
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
});

export const reorder = catchAsync(async (req, res, next) => {
    const projectId = req.params.id || req.params.projectId;
    const { type, items } = req.body;
    await tasksService.reorderTasksOrCategories(projectId, type, items);
    res.status(200).json({ success: true, message: 'Reordered successfully' });
});

export const updateTaskAssignees = catchAsync(async (req, res, next) => {
    const { taskId } = req.params;
    const { assigneeIds } = req.body;
    const result = await tasksService.updateTaskAssignees(taskId, assigneeIds);
    res.status(200).json({ success: true, ...result });
});

export default {
    getTasks,
    createCategory,
    updateCategory,
    deleteCategory,
    createTask,
    updateTask,
    deleteTask,
    reorder,
    updateTaskAssignees
};
