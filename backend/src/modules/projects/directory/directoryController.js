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

    res.status(201).json({ success: true, message: 'Directory item added', id: result.id });
});

/* -------------------------------------------------------
   UPDATE — PUT /:project_id/directory/:id
-------------------------------------------------------- */
export const updateDirectoryItem = catchAsync(async (req, res) => {
    const id = parseInt(req.params.pd_id, 10);
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('id is required and must be a number', 400);
    if (isNaN(projectId)) throw new AppError('project_id is required and must be a number', 400);

    const result = await directoryService.updateDirectoryItem(projectId, id, req.body);
    res.json({ success: true, message: 'Directory item updated', affectedRows: result.affected });
});

/* -------------------------------------------------------
   DELETE — DELETE /:project_id/directory/:id
-------------------------------------------------------- */
export const deleteDirectoryItem = catchAsync(async (req, res) => {
    const id = parseInt(req.params.pd_id, 10);
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('id is required and must be a number', 400);
    if (isNaN(projectId)) throw new AppError('project_id is required and must be a number', 400);

    const result = await directoryService.deleteDirectoryItem(projectId, id);
    res.json({ success: true, message: 'Directory item deleted', affectedRows: result.affectedRows });
});

/* -------------------------------------------------------
   SYNC — PUT /:project_id/directory/sync or POST /:project_id/directory/sync
-------------------------------------------------------- */
export const syncDirectory = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const body = req.body || {};
    const rawDeleted = body.deleted_ids || body.deleted || [];
    const items = Array.isArray(body.items) ? body.items : (Array.isArray(body.rows) ? body.rows : []);

    const result = await directoryService.syncProjectDirectory(
        projectId,
        {
            items,
            deleted_ids: Array.isArray(rawDeleted) ? rawDeleted : []
        },
        req.user?.org_id
    );

    res.json(result);
});

/* -------------------------------------------------------
   BULK PERSONNEL — POST /:project_id/directory/bulk-personnel
-------------------------------------------------------- */
export const addBulkPersonnel = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const result = await directoryService.bulkAddPersonnelToParty(
        projectId,
        req.body,
        req.user?.org_id
    );

    res.status(201).json(result);
});

export default {
    listDirectory,
    addDirectoryItem,
    updateDirectoryItem,
    deleteDirectoryItem,
    syncDirectory,
    addBulkPersonnel,
};
