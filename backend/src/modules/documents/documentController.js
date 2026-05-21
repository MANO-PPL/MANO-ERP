import catchAsync from '../../utils/catchAsync.js';
import documentService from './documentService.js';
import AppError from '../../utils/AppError.js';

export const createTemplate = catchAsync(async (req, res) => {
    const document_id = await documentService.createTemplate(req.user.org_id, req.user.id, req.body);
    res.status(201).json({
        success: true,
        message: 'Document template created successfully',
        document_id
    });
});

export const listTemplates = catchAsync(async (req, res) => {
    const { project_id } = req.query;
    const templates = await documentService.getTemplates(req.user.org_id, { project_id });
    res.json({
        success: true,
        templates
    });
});

export const getTemplate = catchAsync(async (req, res) => {
    const { document_id } = req.params;
    if (!document_id || isNaN(parseInt(document_id))) {
        throw new AppError('Invalid Document ID', 400);
    }
    const template = await documentService.getTemplateById(req.user.org_id, document_id);
    res.json({
        success: true,
        template
    });
});

export const updateTemplate = catchAsync(async (req, res) => {
    const { document_id } = req.params;
    if (!document_id || isNaN(parseInt(document_id))) {
        throw new AppError('Invalid Document ID', 400);
    }
    await documentService.updateTemplate(req.user.org_id, document_id, req.body);
    res.json({
        success: true,
        message: 'Document template updated successfully'
    });
});

export const addLevel = catchAsync(async (req, res) => {
    const { document_id } = req.params;
    if (!document_id || isNaN(parseInt(document_id))) {
        throw new AppError('Invalid Document ID', 400);
    }
    const level_id = await documentService.addApprovalLevel(req.user.org_id, document_id, req.body);
    res.status(201).json({
        success: true,
        message: 'Approval level added successfully',
        level_id
    });
});

export const removeLevel = catchAsync(async (req, res) => {
    const { document_id, level_id } = req.params;
    if (!document_id || isNaN(parseInt(document_id))) {
        throw new AppError('Invalid Document ID', 400);
    }
    if (!level_id || isNaN(parseInt(level_id))) {
        throw new AppError('Invalid Level ID', 400);
    }
    await documentService.removeApprovalLevel(req.user.org_id, document_id, level_id);
    res.json({
        success: true,
        message: 'Approval level removed successfully'
    });
});

export const assignRole = catchAsync(async (req, res) => {
    const { document_id } = req.params;
    if (!document_id || isNaN(parseInt(document_id))) {
        throw new AppError('Invalid Document ID', 400);
    }
    const role_id = await documentService.assignDocumentRole(req.user.org_id, document_id, req.body);
    res.status(201).json({
        success: true,
        message: 'Role assigned successfully',
        id: role_id
    });
});

export const removeRole = catchAsync(async (req, res) => {
    const { document_id, role_id } = req.params;
    if (!document_id || isNaN(parseInt(document_id))) {
        throw new AppError('Invalid Document ID', 400);
    }
    if (!role_id || isNaN(parseInt(role_id))) {
        throw new AppError('Invalid Role ID', 400);
    }
    await documentService.removeDocumentRole(req.user.org_id, document_id, role_id);
    res.json({
        success: true,
        message: 'Role assignment removed successfully'
    });
});

export default {
    createTemplate,
    listTemplates,
    getTemplate,
    updateTemplate,
    addLevel,
    removeLevel,
    assignRole,
    removeRole
};
