import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import partyService from './partyService.js';
import { db } from '../../../config/database.js';

/* -------------------------------------------------------
   LIST PROJECT PARTIES — GET /:id/parties
-------------------------------------------------------- */
export const listProjectParties = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const { fields } = req.query;
    const result = await partyService.getProjectParties(projectId, fields, req.user.org_id);
    res.json({ success: true, ...result });
});

/* -------------------------------------------------------
   LIST AVAILABLE CRM PARTIES — GET /:id/parties/available
-------------------------------------------------------- */
export const listAvailableProjectParties = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const result = await partyService.getAvailableProjectParties(
        projectId,
        req.user.org_id,
        req.query
    );
    res.json({ success: true, ...result });
});

/* -------------------------------------------------------
   ADD PROJECT PARTIES — POST /:id/parties
-------------------------------------------------------- */
export const addProjectParties = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('project_id must be a number', 400);

    const body = req.body || {};
    const parties = Array.isArray(body.parties)
        ? body.parties
        : (body.contact_id !== undefined ? [body.contact_id] : []);
    if (parties.length === 0) {
        throw new AppError('contact_id or parties array is required and must not be empty', 400);
    }

    // Ensure project exists
    const project = await db('proj_projects').where('id', projectId).first();
    if (!project) throw new AppError('Project not found', 404);

    const ppIds = await partyService.addPartiesToProject(projectId, parties, req.user.org_id);
    res.status(201).json({
        success: true,
        message: 'Parties added to project',
        pp_ids: ppIds,
        count: ppIds.length,
    });
});

/* -------------------------------------------------------
   DELETE PROJECT PARTIES — DELETE /:id/parties
-------------------------------------------------------- */
export const removeProjectParties = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const { pp_ids } = req.body || {};
    if (!pp_ids || !Array.isArray(pp_ids) || pp_ids.length === 0) {
        throw new AppError('pp_ids array is required and must not be empty', 400);
    }

    const result = await partyService.removePartiesFromProject(projectId, pp_ids);
    res.json({
        success: true,
        message: 'Parties removed from project',
        deleted_count: result.deletedCount,
        deleted_pp_ids: result.deletedPvIds,
        ...(result.notFoundPvIds.length > 0 && { not_found_pp_ids: result.notFoundPvIds }),
    });
});

/* -------------------------------------------------------
   SYNC PROJECT PARTIES — PUT /:id/parties/sync or POST /:id/parties/sync
-------------------------------------------------------- */
export const syncProjectParties = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const body = req.body || {};
    const rawDeleted = body.deleted_ids || body.deleted_pp_ids || body.deleted || [];
    const deletedList = Array.isArray(rawDeleted) ? rawDeleted : [];

    const result = await partyService.syncProjectParties(
        projectId,
        {
            parties: Array.isArray(body.parties) ? body.parties : [],
            deleted_ids: deletedList
        },
        req.user.org_id
    );

    res.json(result);
});

export default {
    listProjectParties,
    listAvailableProjectParties,
    addProjectParties,
    removeProjectParties,
    syncProjectParties,
};
