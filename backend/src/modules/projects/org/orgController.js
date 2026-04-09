import catchAsync from '../../../utils/catchAsync.js';
import orgService from './orgService.js';
import AppError from '../../../utils/AppError.js';

/**
 * GET /api/projects/:id/org
 * Fetches the aggregated data for the project organization chart.
 */
export const getOrgChart = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
        throw new AppError('project_id must be a number', 400);
    }

    const data = await orgService.getProjectOrgChart(projectId);
    
    res.json({
        success: true,
        ...data
    });
});

export default {
    getOrgChart
};
