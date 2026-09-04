import catchAsync from '../../../utils/catchAsync.js';
import projectService from './projectService.js';
import AppError from '../../../utils/AppError.js';
import { db } from '../../../config/database.js';
import s3Service from '../../shared/s3Service.js';
import path from 'path';
import { isAdmin } from '../../../utils/userUtils.js';

export const listProjects = catchAsync(async (req, res) => {
    const projects = await projectService.getProjects(req.user.org_id, req.user.id, req.user.user_type);
    res.json({ success: true, projects });
});

export const getProject = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);

    const isUserAdmin = isAdmin(req.user);

    let projectPermissions = null;
    if (isUserAdmin) {
        projectPermissions = {
            'Dashboard': 3,
            'Tasks': 3,
            'WIP': 3,
            'Reports': 3,
            'General Documents': 3,
            'Spreadsheets': 3,
            'Drawings': 3,
            'Planning': 3,
            'Phases': 3,
            'Contracts': 3,
            'Quality': 3,
            'Safety': 3,
            'Billing': 3,
            'Material Management': 3,
            'Transactions': 3,
            'Approvals': 3,
            'Settings': 3
        };
    } else {
        const member = await db('proj_members')
            .where({ project_id: id, user_id: req.user.id, org_id: req.user.org_id })
            .first();
        if (!member) {
            throw new AppError('Access denied. You are not assigned to this project.', 403);
        }
        projectPermissions = member.project_permissions ? (typeof member.project_permissions === 'string' ? JSON.parse(member.project_permissions) : member.project_permissions) : {};
    }

    const project = await projectService.getProjectById(req.user.org_id, id);
    res.json({ success: true, project, projectPermissions });
});

export const createProject = catchAsync(async (req, res) => {
    const newId = await projectService.createProject(req.user.org_id, {
        ...req.body,
        creator_id: req.user.id
    });
    res.status(201).json({ success: true, message: 'Project created successfully', project_id: newId });
});

export const updateProject = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);

    await projectService.updateProject(req.user.org_id, id, req.body);
    res.json({ success: true, message: 'Project updated successfully' });
});

export const uploadProjectLogo = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);

    if (!req.file) throw new AppError('No logo image file provided', 400);

    await projectService.getProjectById(req.user.org_id, id);

    const ext = path.extname(req.file.originalname) || '.png';
    const fileName = `logo_${Date.now()}${ext}`;
    const folder = `projects/org_${req.user.org_id}/proj_${id}/logo`;

    const rawLogoUrl = await s3Service.uploadFile(
        req.file.buffer,
        fileName,
        folder,
        req.file.mimetype
    );

    await projectService.updateProject(req.user.org_id, id, { logo_url: rawLogoUrl });
    const presignedUrl = await projectService.presignUrl(rawLogoUrl);

    res.json({
        success: true,
        message: 'Project logo uploaded successfully',
        logo_url: presignedUrl
    });
});

// Member Management Endpoints

export const getProjectMembers = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);

    const members = await projectService.getProjectMembers(req.user.org_id, id);
    res.json({ success: true, members });
});

export const assignProjectMember = catchAsync(async (req, res) => {
    const projectId = req.params.id;
    if (!projectId || isNaN(parseInt(projectId))) throw new AppError('Invalid Project ID', 400);

    const userId = req.body.id || req.body.user_id;
    const { permissions } = req.body;
    if (!userId || isNaN(parseInt(userId))) throw new AppError('User ID is required', 400);

    await projectService.assignUserToProject(req.user.org_id, projectId, userId, permissions);
    res.json({ success: true, message: 'User assigned to project successfully' });
});

export const removeProjectMember = catchAsync(async (req, res) => {
    const projectId = req.params.id;
    const userId = req.params.user_id;
    if (!projectId || isNaN(parseInt(projectId))) throw new AppError('Invalid Project ID', 400);
    if (!userId || isNaN(parseInt(userId))) throw new AppError('Invalid User ID', 400);

    await projectService.removeUserFromProject(req.user.org_id, projectId, userId);
    res.json({ success: true, message: 'User removed from project' });
});

export default {
    listProjects,
    getProject,
    createProject,
    updateProject,
    uploadProjectLogo,
    getProjectMembers,
    assignProjectMember,
    removeProjectMember
};
