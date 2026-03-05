import catchAsync from '../utils/catchAsync.js';
import projectService from '../services/projectService.js';
import AppError from '../utils/AppError.js';

export const listProjects = catchAsync(async (req, res) => {
    const projects = await projectService.getProjects(req.user.org_id);
    res.json({ success: true, projects });
});

export const getProject = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Project ID', 400);

    const project = await projectService.getProjectById(req.user.org_id, id);
    res.json({ success: true, project });
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
