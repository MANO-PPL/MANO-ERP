import catchAsync from '../../utils/catchAsync.js';
import instanceService from './instanceService.js';
import AppError from '../../utils/AppError.js';

export const getInstance = catchAsync(async (req, res) => {
    const { instance_id } = req.params;
    if (!instance_id || isNaN(parseInt(instance_id))) {
        throw new AppError('Invalid Instance ID', 400);
    }
    
    const instanceDetail = await instanceService.getInstanceDetail(req.user.org_id, instance_id);
    
    res.json({
        success: true,
        instance: instanceDetail
    });
});

export const archiveInstance = catchAsync(async (req, res) => {
    const { instance_id } = req.params;
    if (!instance_id || isNaN(parseInt(instance_id))) {
        throw new AppError('Invalid Instance ID', 400);
    }
    
    await instanceService.archiveInstance(req.user.org_id, instance_id);
    
    res.json({
        success: true,
        message: 'Document instance archived successfully'
    });
});

export default {
    getInstance,
    archiveInstance
};
