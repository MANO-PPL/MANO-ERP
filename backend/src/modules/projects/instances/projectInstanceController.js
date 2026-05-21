import catchAsync from '../../../utils/catchAsync.js';
import instanceService from '../../documents/instanceService.js';
import AppError from '../../../utils/AppError.js';

export const createProjectInstance = catchAsync(async (req, res) => {
    // Note: the router mounts this as /projects/:id/instances, so req.params.id is project_id
    // But since sub-routers inherit params implicitly if mergeParams is true, we should ensure we get it.
    // The preferred way is to get it from req.params.id (or req.params.project_id if named so).
    const projectId = req.params.id || req.params.project_id;
    if (!projectId || isNaN(parseInt(projectId))) {
        throw new AppError('Invalid Project ID', 400);
    }

    const instanceId = await instanceService.createInstance(req.user.org_id, projectId, req.user.id, req.body);

    res.status(201).json({
        success: true,
        message: 'Document instance created successfully',
        instance_id: instanceId
    });
});

export const listProjectInstances = catchAsync(async (req, res) => {
    const projectId = req.params.id || req.params.project_id;
    if (!projectId || isNaN(parseInt(projectId))) {
        throw new AppError('Invalid Project ID', 400);
    }

    const { document_id } = req.query;
    
    const instances = await instanceService.listProjectInstances(req.user.org_id, projectId, { document_id });

    res.json({
        success: true,
        instances
    });
});

export default {
    createProjectInstance,
    listProjectInstances
};
