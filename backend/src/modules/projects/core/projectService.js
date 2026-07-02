import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';

export function validateProjectPermissions(permissions) {
    if (!permissions) return null;
    let parsed = permissions;
    if (typeof permissions === 'string') {
        try {
            parsed = JSON.parse(permissions);
        } catch (e) {
            throw new AppError('Invalid project_permissions JSON string format', 400);
        }
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AppError('project_permissions must be a JSON object', 400);
    }
    const ALLOWED_LEVELS = new Set(['none', 'view', 'edit']);
    const sanitized = {};
    for (const [module, level] of Object.entries(parsed)) {
        if (!level || typeof level !== 'string' || !ALLOWED_LEVELS.has(level.toLowerCase())) {
            throw new AppError(`Invalid permission level '${level}' for module '${module}'. Must be 'none', 'view', or 'edit'.`, 400);
        }
        sanitized[module] = level.toLowerCase();
    }
    return sanitized;
}


export async function createProject(orgId, { name, location, status = 'active', project_code, start_date, end_date, metadata }) {
    if (!name) throw new AppError('Project name is required', 400);

    const [insertId] = await db('projects').insert({
        org_id: orgId,
        name,
        location,
        status,
        project_code,
        start_date,
        end_date,
        metadata: metadata ? JSON.stringify(metadata) : null
    });

    return insertId;
}

export async function getProjects(orgId) {
    return await db('projects')
        .where('org_id', orgId)
        .orderBy('created_at', 'desc');
}

export async function getProjectById(orgId, projectId) {
    const project = await db('projects')
        .where({ id: projectId, org_id: orgId })
        .first();

    if (!project) throw new AppError('Project not found', 404);
    return project;
}

export async function updateProject(orgId, projectId, updateData) {
    const updates = {};
    if (updateData.name) updates.name = updateData.name;
    if (updateData.location) updates.location = updateData.location;
    if (updateData.status) updates.status = updateData.status;
    if (updateData.project_code !== undefined) updates.project_code = updateData.project_code;
    if (updateData.start_date !== undefined) updates.start_date = updateData.start_date;
    if (updateData.end_date !== undefined) updates.end_date = updateData.end_date;
    if (updateData.metadata !== undefined) updates.metadata = updateData.metadata ? JSON.stringify(updateData.metadata) : null;

    if (Object.keys(updates).length > 0) {
        const affected = await db('projects')
            .where({ id: projectId, org_id: orgId })
            .update(updates);

        if (affected === 0) throw new AppError('Project not found', 404);
    }
    return true;
}

export async function assignUserToProject(orgId, projectId, userId, permissionsJson) {
    // 1. Validate project belongs to org
    await getProjectById(orgId, projectId);

    // 2. Validate user belongs to org
    const user = await db('users').where({ user_id: userId, org_id: orgId }).first();
    if (!user) throw new AppError('User not found in your organization', 404);

    // 3. Upsert into project_users table
    // MySQL requires insert ... on duplicate key update string literal when not using knex.upsert depending on version, 
    // but knex `.onConflict` is standard for modern MySQL. Knex version >= 2.1 supports it:

    const validatedPerms = permissionsJson ? validateProjectPermissions(permissionsJson) : null;

    await db('project_users')
        .insert({
            project_id: projectId,
            user_id: userId,
            org_id: orgId,
            project_permissions: validatedPerms ? JSON.stringify(validatedPerms) : null
        })
        .onConflict(['project_id', 'user_id'])
        .merge({
            project_permissions: validatedPerms ? JSON.stringify(validatedPerms) : null
        });

    return true;
}

export async function removeUserFromProject(orgId, projectId, userId) {
    const affected = await db('project_users')
        .where({
            project_id: projectId,
            user_id: userId,
            org_id: orgId
        })
        .del();

    if (affected === 0) throw new AppError('User is not assigned to this project', 404);
    return true;
}

export async function getProjectMembers(orgId, projectId) {
    // Validate project
    await getProjectById(orgId, projectId);

    const members = await db('project_users as pu')
        .join('users as u', 'pu.user_id', 'u.user_id')
        .where('pu.project_id', projectId)
        .andWhere('pu.org_id', orgId)
        .select(
            'pu.user_id',
            'u.user_name',
            'u.email',
            'u.user_type',
            'u.profile_image_url',
            'pu.project_permissions',
            'pu.created_at as assigned_at'
        );

    return members;
}

export default {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    assignUserToProject,
    removeUserFromProject,
    getProjectMembers
};
