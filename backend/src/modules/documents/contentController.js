import catchAsync from '../../utils/catchAsync.js';
import contentService from './contentService.js';
import AppError from '../../utils/AppError.js';

export const getApprovedContent = catchAsync(async (req, res) => {
    const { instance_id } = req.params;
    if (!instance_id || isNaN(parseInt(instance_id))) {
        throw new AppError('Invalid Instance ID', 400);
    }
    
    // version_id is optional. If missing, gets the latest approved version.
    const { version_id } = req.query;

    const data = await contentService.getApprovedContent(req.user.org_id, instance_id, req.user.id, version_id);

    res.json({
        success: true,
        ...data
    });
});

export const getDraftContent = catchAsync(async (req, res) => {
    const { instance_id } = req.params;
    if (!instance_id || isNaN(parseInt(instance_id))) {
        throw new AppError('Invalid Instance ID', 400);
    }

    const data = await contentService.getDraftContent(req.user.org_id, instance_id, req.user.id);

    res.json({
        success: true,
        ...data
    });
});

export const listVersions = catchAsync(async (req, res) => {
    const { instance_id } = req.params;
    if (!instance_id || isNaN(parseInt(instance_id))) {
        throw new AppError('Invalid Instance ID', 400);
    }

    const versions = await contentService.listVersions(req.user.org_id, instance_id, req.user.id);

    res.json({
        success: true,
        versions
    });
});

export default {
    getApprovedContent,
    getDraftContent,
    listVersions
};
