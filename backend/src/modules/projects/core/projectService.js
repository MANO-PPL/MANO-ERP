import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import s3Service from '../../shared/s3Service.js';

export function getS3KeyFromUrl(url) {
    if (!url) return null;
    const marker = '.amazonaws.com/';
    const index = url.indexOf(marker);
    if (index !== -1) {
        return url.substring(index + marker.length);
    }
    return null;
}

export async function presignUrl(url) {
    if (!url) return null;
    if (url.startsWith('/uploads/')) return url;

    const key = getS3KeyFromUrl(url);
    if (!key) return url;
    try {
        return await s3Service.getFileSignedUrl(key);
    } catch (e) {
        console.warn(`[S3 Presign Warning] Failed to generate signed URL for key ${key}:`, e.message);
        return url;
    }
}

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


export async function initializeProjectSchema() {
    const hasTable = await db.schema.hasTable('proj_projects');
    if (hasTable) {
        const hasLogoUrl = await db.schema.hasColumn('proj_projects', 'logo_url');
        if (!hasLogoUrl) {
            await db.schema.alterTable('proj_projects', (table) => {
                table.string('logo_url', 512).nullable();
            });
            console.log('Added logo_url column to proj_projects table');
        }
    }
}

export async function createProject(orgId, { name, location, status = 'active', project_code, start_date, end_date, metadata, logo_url }) {
    if (!name) throw new AppError('Project name is required', 400);

    const [insertId] = await db('proj_projects').insert({
        org_id: orgId,
        name,
        location,
        status,
        project_code,
        start_date,
        end_date,
        logo_url: logo_url || null,
        metadata: metadata ? JSON.stringify(metadata) : null
    });

    return insertId;
}

export async function getProjects(orgId, userId, userType) {
    const isUserAdmin = ['admin', 'super admin', 'superadmin', 'super_admin'].includes(userType?.toLowerCase());
    let projects = [];
    if (isUserAdmin) {
        projects = await db('proj_projects as p')
            .leftJoin('proj_members as pu', 'p.id', 'pu.project_id')
            .where('p.org_id', orgId)
            .select(
                'p.*',
                db.raw('COUNT(pu.user_id) as member_count')
            )
            .groupBy('p.id')
            .orderBy('p.created_at', 'desc');
    } else {
        projects = await db('proj_projects as p')
            .leftJoin('proj_members as pu', 'p.id', 'pu.project_id')
            .where('p.org_id', orgId)
            .whereExists(
                db.select('*')
                    .from('proj_members as pm')
                    .whereRaw('pm.project_id = p.id')
                    .andWhere('pm.user_id', userId)
            )
            .select(
                'p.*',
                db.raw('COUNT(pu.user_id) as member_count')
            )
            .groupBy('p.id')
            .orderBy('p.created_at', 'desc');
    }

    for (const project of projects) {
        if (project.logo_url) {
            project.logo_url = await presignUrl(project.logo_url);
        }
    }

    return projects;
}

export async function getProjectById(orgId, projectId) {
    const project = await db('proj_projects')
        .where({ id: projectId, org_id: orgId })
        .first();

    if (!project) throw new AppError('Project not found', 404);

    if (project.logo_url) {
        project.logo_url = await presignUrl(project.logo_url);
    }

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
    if (updateData.logo_url !== undefined) updates.logo_url = updateData.logo_url;
    if (updateData.metadata !== undefined) updates.metadata = updateData.metadata ? JSON.stringify(updateData.metadata) : null;

    if (Object.keys(updates).length > 0) {
        const affected = await db('proj_projects')
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
    const user = await db('iam_users').where({ user_id: userId, org_id: orgId }).first();
    if (!user) throw new AppError('User not found in your organization', 404);

    // 3. Upsert into project_users table
    // MySQL requires insert ... on duplicate key update string literal when not using knex.upsert depending on version, 
    // but knex `.onConflict` is standard for modern MySQL. Knex version >= 2.1 supports it:

    const validatedPerms = permissionsJson ? validateProjectPermissions(permissionsJson) : null;

    await db('proj_members')
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
    const affected = await db('proj_members')
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

    const members = await db('proj_members as pu')
        .join('iam_users as u', 'pu.user_id', 'u.user_id')
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
    initializeProjectSchema,
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    assignUserToProject,
    removeUserFromProject,
    getProjectMembers,
    presignUrl,
    getS3KeyFromUrl
};
