import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import directoryService from './directoryService.js';
import { db } from '../../../config/database.js';

/* -------------------------------------------------------
   LIST — GET /:project_id/directory
-------------------------------------------------------- */
export const listDirectory = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const result = await directoryService.fetchProjectDirectory(projectId);
    res.json({ success: true, ...result });
});

/* -------------------------------------------------------
   ADD — POST /:project_id/directory
-------------------------------------------------------- */
export const addDirectoryItem = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('project_id is required and must be a number', 400);

    // Ensure project exists
    const project = await db('proj_projects').where({ id: projectId }).first();
    if (!project) throw new AppError('Project not found', 404);

    const payload = { ...req.body, project_id: projectId };
    const result = await directoryService.insertDirectoryItem(payload);

    res.status(201).json({ success: true, message: 'Directory item added', pd_id: result.pd_id });
});

/* -------------------------------------------------------
   UPDATE — PUT /:project_id/directory/:id
-------------------------------------------------------- */
export const updateDirectoryItem = catchAsync(async (req, res) => {
    const id = parseInt(req.params.pd_id, 10);
    if (isNaN(id)) throw new AppError('id is required and must be a number', 400);

    const result = await directoryService.updateDirectoryItem(id, req.body);
    res.json({ success: true, message: 'Directory item updated', affectedRows: result.affected });
});

/* -------------------------------------------------------
   DELETE — DELETE /:project_id/directory/:id
-------------------------------------------------------- */
export const deleteDirectoryItem = catchAsync(async (req, res) => {
    const id = parseInt(req.params.pd_id, 10);
    if (isNaN(id)) throw new AppError('id is required and must be a number', 400);

    const result = await directoryService.deleteDirectoryItem(id);
    res.json({ success: true, message: 'Directory item deleted', affectedRows: result.affectedRows });
});

export default {
    listDirectory,
    addDirectoryItem,
    updateDirectoryItem,
    deleteDirectoryItem,
};
