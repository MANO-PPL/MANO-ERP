import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import summaryService from './summaryService.js';
import { db } from '../../../config/database.js';

/* -------------------------------------------------------
   LIST — GET /:id/summary
-------------------------------------------------------- */
export const listSummaries = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const summaries = await summaryService.getProjectSummaries(projectId);
    res.json({ success: true, summaries });
});

/* -------------------------------------------------------
   ADD — POST /:id/summary
-------------------------------------------------------- */
export const addSummaries = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('project_id must be a number', 400);

    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        throw new AppError('Invalid input, expected array of objects', 400);
    }

    // Ensure project exists
    const project = await db('projects').where('id', projectId).first();
    if (!project) throw new AppError('Project not found', 404);

    await summaryService.addProjectSummaries(projectId, items);
    res.status(201).json({ success: true, message: 'Summaries added successfully' });
});

/* -------------------------------------------------------
   UPDATE — PUT /:id/summary
-------------------------------------------------------- */
export const updateSummaries = catchAsync(async (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) {
        throw new AppError('Invalid input, expected array', 400);
    }

    await summaryService.updateProjectSummaries(items);
    res.json({ success: true, message: 'Summaries updated successfully' });
});

/* -------------------------------------------------------
   DELETE — DELETE /:id/summary
-------------------------------------------------------- */
export const removeSummaries = catchAsync(async (req, res) => {
    const ids = req.body;
    if (!Array.isArray(ids)) {
        throw new AppError('Invalid input, expected array of IDs', 400);
    }

    // Normalize to array of IDs in case they pass objects
    const idsToDelete = ids.map(i => (typeof i === 'object' ? i.id : i));

    await summaryService.deleteProjectSummaries(idsToDelete);
    res.json({ success: true, message: 'Summaries deleted successfully' });
});

export default {
    listSummaries,
    addSummaries,
    updateSummaries,
    removeSummaries,
};
