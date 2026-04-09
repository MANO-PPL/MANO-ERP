import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import staffService from './staffService.js';
import { db } from '../../../config/database.js';

/* -------------------------------------------------------
   LIST — GET /:id/staff
-------------------------------------------------------- */
export const listStaff = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const result = await staffService.fetchProjectStaff(projectId);
    res.json({ success: true, ...result });
});

/* -------------------------------------------------------
   ADD — POST /:id/staff
-------------------------------------------------------- */
export const addStaff = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('project_id must be a number', 400);

    // Ensure project exists
    const project = await db('projects').where('id', projectId).first();
    if (!project) throw new AppError('Project not found', 404);

    const payload = { ...req.body, project_id: projectId };
    const result = await staffService.insertStaff(payload);

    res.status(201).json({ success: true, message: 'Staff added', psrr_id: result.psrr_id });
});

/* -------------------------------------------------------
   UPDATE — PUT /:id/staff/:psrr_id
-------------------------------------------------------- */
export const updateStaff = catchAsync(async (req, res) => {
    const id = parseInt(req.params.psrr_id, 10);
    if (isNaN(id)) throw new AppError('id is required and must be a number', 400);

    const result = await staffService.updateStaff(id, req.body || {});
    res.json({ success: true, message: 'Staff updated', affectedRows: result.affected });
});

/* -------------------------------------------------------
   DELETE — DELETE /:id/staff/:psrr_id
-------------------------------------------------------- */
export const removeStaff = catchAsync(async (req, res) => {
    const id = parseInt(req.params.psrr_id, 10);
    if (isNaN(id)) throw new AppError('id is required and must be a number', 400);

    const result = await staffService.deleteStaff(id);
    res.json({ success: true, message: 'Staff deleted', affectedRows: result.affectedRows });
});

export default {
    listStaff,
    addStaff,
    updateStaff,
    removeStaff,
};
