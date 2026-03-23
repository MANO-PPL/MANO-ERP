import catchAsync from '../../utils/catchAsync.js';
import permissionService from './permissionService.js';
import AppError from '../../utils/AppError.js';

export const listTemplates = catchAsync(async (req, res) => {
    const { type } = req.query; // 'system' or 'project'
    const templates = await permissionService.getTemplates(req.user.org_id, type);
    res.json({ success: true, templates });
});

export const createTemplate = catchAsync(async (req, res) => {
    const newId = await permissionService.createTemplate(req.user.org_id, req.body);
    res.status(201).json({ success: true, message: 'Template created', template_id: newId });
});

export const updateTemplate = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
        throw new AppError('Invalid Template ID', 400);
    }
    await permissionService.updateTemplate(req.user.org_id, id, req.body);
    res.json({ success: true, message: 'Template updated successfully' });
});

export const deleteTemplate = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
        throw new AppError('Invalid Template ID', 400);
    }
    await permissionService.deleteTemplate(req.user.org_id, id);
    res.json({ success: true, message: 'Template deleted successfully' });
});

export default {
    listTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate
};
