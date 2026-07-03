import catchAsync from '../../../utils/catchAsync.js';
import projectService from './projectService.js';
import AppError from '../../../utils/AppError.js';
import { db } from '../../../config/database.js';

export const listProjects = catchAsync(async (req, res) => {
    const projects = await projectService.getProjects(req.user.org_id, req.user.user_id, req.user.user_type);
    res.json({ success: true, projects });
});

export const getProject = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);

    const isUserAdmin = ['admin', 'super admin', 'superadmin', 'super_admin'].includes(req.user.user_type?.toLowerCase());
    
    let projectPermissions = null;
    if (isUserAdmin) {
        projectPermissions = {
            'Dashboard': 3,
            'Tasks': 3,
            'WIP': 3,
            'Reports': 3,
            'General Documents': 3,
            'Drawings': 3,
            'Planning': 3,
            'Contracts': 3,
            'Quality': 3,
            'Safety': 3,
            'Billing': 3,
            'Material Management': 3,
            'Approvals': 3
        };
    } else {
        const member = await db('project_users')
            .where({ project_id: id, user_id: req.user.user_id, org_id: req.user.org_id })
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
    const newId = await projectService.createProject(req.user.org_id, req.body);
    res.status(201).json({ success: true, message: 'Project created successfully', project_id: newId });
});

export const updateProject = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);

    await projectService.updateProject(req.user.org_id, id, req.body);
    res.json({ success: true, message: 'Project updated successfully' });
});

// Member Management Endpoints

export const getProjectMembers = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);

    const members = await projectService.getProjectMembers(req.user.org_id, id);
    res.json({ success: true, members });
});

export const assignProjectMember = catchAsync(async (req, res) => {
    const { id } = req.params; // project_id
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);

    const { user_id, permissions } = req.body;
    if (!user_id || isNaN(parseInt(user_id))) throw new AppError('user_id is required', 400);

    await projectService.assignUserToProject(req.user.org_id, id, user_id, permissions);
    res.json({ success: true, message: 'User assigned to project successfully' });
});

export const removeProjectMember = catchAsync(async (req, res) => {
    const { id, user_id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);
    if (!user_id || isNaN(parseInt(user_id))) throw new AppError('Invalid User ID', 400);

    await projectService.removeUserFromProject(req.user.org_id, id, user_id);
    res.json({ success: true, message: 'User removed from project' });
});

export default {
    listProjects,
    getProject,
    createProject,
    updateProject,
    getProjectMembers,
    assignProjectMember,
    removeProjectMember
};
