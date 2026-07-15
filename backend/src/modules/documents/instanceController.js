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

export const getInstanceLogs = catchAsync(async (req, res) => {
    const { instance_id } = req.params;
    if (!instance_id || isNaN(parseInt(instance_id))) {
        throw new AppError('Invalid Instance ID', 400);
    }
    
    const logs = await instanceService.getInstanceLogs(req.user.org_id, instance_id);
    
    res.json({
        success: true,
        logs
    });
});

export const getTemplateWorkflowStatus = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { template_name, instance_id } = req.query;
    if (!projectId || isNaN(parseInt(projectId))) {
        throw new AppError('Invalid Project ID', 400);
    }
    if (!template_name) {
        throw new AppError('template_name is required', 400);
    }

    const data = await instanceService.getTemplateWorkflowStatus(
        req.user.org_id, 
        projectId, 
        template_name, 
        instance_id ? parseInt(instance_id) : null
    );

    res.json(data);
});

export default {
    getInstance,
    archiveInstance,
    getInstanceLogs,
    getTemplateWorkflowStatus
};
