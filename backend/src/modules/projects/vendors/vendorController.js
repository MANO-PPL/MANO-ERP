import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import vendorService from './vendorService.js';
import { db } from '../../../config/database.js';

/* -------------------------------------------------------
   LIST — GET /:id/vendors
-------------------------------------------------------- */
export const listProjectVendors = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const { fields } = req.query;
    const result = await vendorService.getProjectVendors(projectId, fields);
    res.json({ success: true, ...result });
});

/* -------------------------------------------------------
   ADD — POST /:id/vendors
-------------------------------------------------------- */
export const addProjectVendors = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('project_id must be a number', 400);

    const { vendors } = req.body || {};
    if (!vendors || !Array.isArray(vendors) || vendors.length === 0) {
        throw new AppError('vendors array is required and must not be empty', 400);
    }

    // Ensure project exists
    const project = await db('proj_projects').where('id', projectId).first();
    if (!project) throw new AppError('Project not found', 404);

    const pvIds = await vendorService.addVendorsToProject(projectId, vendors);
    res.status(201).json({
        success: true,
        message: 'Vendors added to project',
        pv_ids: pvIds,
        count: pvIds.length,
    });
});

/* -------------------------------------------------------
   DELETE — DELETE /:id/vendors
-------------------------------------------------------- */
export const removeProjectVendors = catchAsync(async (req, res) => {
    const { pv_ids } = req.body || {};
    if (!pv_ids || !Array.isArray(pv_ids) || pv_ids.length === 0) {
        throw new AppError('pv_ids array is required and must not be empty', 400);
    }

    const result = await vendorService.removeVendorsFromProject(pv_ids);
    res.json({
        success: true,
        message: 'Vendors removed from project',
        deleted_count: result.deletedCount,
        deleted_pv_ids: result.deletedPvIds,
        ...(result.notFoundPvIds.length > 0 && { not_found_pv_ids: result.notFoundPvIds }),
    });
});

export default {
    listProjectVendors,
    addProjectVendors,
    removeProjectVendors,
};
