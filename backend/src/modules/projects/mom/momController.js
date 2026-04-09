import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import momService from './momService.js';
import { db } from '../../../config/database.js';

/* -------------------------------------------------------
   1. LIST MoMs — GET /:id/moms
-------------------------------------------------------- */
export const listMoMs = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const result = await momService.fetchProjectMoMs(projectId);
    res.json({ success: true, ...result });
});

/* -------------------------------------------------------
   2. DETAIL MoM — GET /:id/moms/:mom_id
-------------------------------------------------------- */
export const getMoM = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const momId = parseInt(req.params.mom_id, 10);

    if (isNaN(projectId) || isNaN(momId)) {
        throw new AppError('Invalid project_id or mom_id', 400);
    }

    const mom = await momService.fetchMoMById(projectId, momId);
    res.json({ success: true, mom });
});

/* -------------------------------------------------------
   3. CREATE MoM — POST /:id/moms
-------------------------------------------------------- */
export const createMoM = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('project_id must be a number', 400);

    // Validate required fields
    const { subject, venue, date, meeting_no } = req.body;
    if (!subject || !venue || !date || !meeting_no) {
        throw new AppError('subject, venue, date, and meeting_no are required', 400);
    }

    // Ensure project exists
    const project = await db('projects').where('id', projectId).first();
    if (!project) throw new AppError('Project not found', 404);

    const result = await momService.createMoM(projectId, req.body);
    
    res.status(201).json({ 
        success: true, 
        message: 'MoM created successfully', 
        mom_id: result.mom_id 
    });
});

/* -------------------------------------------------------
   4. UPDATE MoM — PUT /:id/moms/:mom_id
-------------------------------------------------------- */
export const updateMoM = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const momId = parseInt(req.params.mom_id, 10);

    if (isNaN(projectId) || isNaN(momId)) {
        throw new AppError('project_id and mom_id are required and must be numbers', 400);
    }

    if (Object.keys(req.body).length === 0) {
        throw new AppError('No data provided to update', 400);
    }

    await momService.updateMoM(projectId, momId, req.body);
    
    res.json({ 
        success: true, 
        message: 'MoM updated successfully'
    });
});

/* -------------------------------------------------------
   5. DELETE MoM — DELETE /:id/moms/:mom_id
-------------------------------------------------------- */
export const deleteMoM = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const momId = parseInt(req.params.mom_id, 10);

    if (isNaN(projectId) || isNaN(momId)) {
        throw new AppError('project_id and mom_id are required and must be numbers', 400);
    }

    await momService.deleteMoM(projectId, momId);
    
    res.json({ 
        success: true, 
        message: 'MoM deleted successfully'
    });
});

export default {
    listMoMs,
    getMoM,
    createMoM,
    updateMoM,
    deleteMoM
};
