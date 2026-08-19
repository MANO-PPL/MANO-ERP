import { db } from '../../../config/database.js';
import AppError from '../../../utils/AppError.js';
import s3Service from '../../shared/s3Service.js';
import { isAdmin } from '../../../utils/userUtils.js';

export function getS3KeyFromUrl(url) {
    if (!url) return null;
    const cleanUrl = String(url).split('?')[0];
    const marker = '.amazonaws.com/';
    const index = cleanUrl.indexOf(marker);
    if (index !== -1) {
        return cleanUrl.substring(index + marker.length);
    }
    if (cleanUrl.startsWith('projects/') || cleanUrl.startsWith('uploads/')) {
        return cleanUrl;
    }
    if (cleanUrl.startsWith('/projects/') || cleanUrl.startsWith('/uploads/')) {
        return cleanUrl.substring(1);
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

export async function createProject(orgId, { name, location, status = 'active', project_code, start_date, end_date, metadata, logo_url, member_ids, creator_id }) {
    if (!name || !name.trim()) throw new AppError('Project name is required', 400);

    const trimmedCode = project_code ? String(project_code).trim() : null;

    if (trimmedCode) {
        const existing = await db('proj_projects')
            .where({ org_id: orgId, project_code: trimmedCode })
            .first();
        if (existing) {
            throw new AppError(`Project code '${trimmedCode}' is already taken in your organization. Please choose a unique code.`, 400);
        }
    }

    return await db.transaction(async (trx) => {
        const [insertId] = await trx('proj_projects').insert({
            org_id: orgId,
            name: name.trim(),
            location: location ? location.trim() : null,
            status: status || 'active',
            project_code: trimmedCode || null,
            start_date: start_date || null,
            end_date: end_date || null,
            logo_url: logo_url || null,
            metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
        });

        const allMemberIds = new Set();
        if (creator_id) allMemberIds.add(creator_id);
        if (Array.isArray(member_ids)) {
            member_ids.forEach(id => {
                if (id) allMemberIds.add(id);
            });
        }

        if (allMemberIds.size > 0) {
            const validUsers = await trx('iam_users')
                .where('org_id', orgId)
                .whereIn('user_id', Array.from(allMemberIds))
                .select('user_id');

            if (validUsers.length > 0) {
                const memberRows = validUsers.map(u => ({
                    project_id: insertId,
                    user_id: u.user_id,
                    org_id: orgId,
                    project_permissions: null
                }));

                await trx('proj_members').insert(memberRows);
            }
        }

        return insertId;
    });
}

export async function getProjects(orgId, userId, userType) {
    const isUserAdmin = isAdmin(userType);
    const employerSubquery = db.raw(`(
        SELECT GROUP_CONCAT(c.name SEPARATOR ', ')
        FROM pdoc_parties pp
        JOIN crm_contacts c ON pp.party_id = c.id
        WHERE pp.project_id = p.id 
          AND LOWER(c.category) = 'client'
          AND pp.deleted_at IS NULL
    ) as employer`);

    let projects = [];
    if (isUserAdmin) {
        projects = await db('proj_projects as p')
            .leftJoin('proj_members as pu', 'p.id', 'pu.project_id')
            .where('p.org_id', orgId)
            .select(
                'p.*',
                db.raw('COUNT(DISTINCT pu.user_id) as member_count'),
                employerSubquery
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
                db.raw('COUNT(DISTINCT pu.user_id) as member_count'),
                employerSubquery
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
    const project = await db('proj_projects as p')
        .where({ 'p.id': projectId, 'p.org_id': orgId })
        .select(
            'p.*',
            db.raw(`(
                SELECT GROUP_CONCAT(c.name SEPARATOR ', ')
                FROM pdoc_parties pp
                JOIN crm_contacts c ON pp.party_id = c.id
                WHERE pp.project_id = p.id 
                  AND LOWER(c.category) = 'client'
                  AND pp.deleted_at IS NULL
            ) as employer`)
        )
        .first();

    if (!project) throw new AppError('Project not found', 404);

    if (project.logo_url) {
        project.logo_url = await presignUrl(project.logo_url);
    }

    return project;
}

export async function updateProject(orgId, projectId, updateData) {
    if (updateData.project_code) {
        const trimmedCode = String(updateData.project_code).trim();
        const existing = await db('proj_projects')
            .where({ org_id: orgId, project_code: trimmedCode })
            .whereNot({ id: projectId })
            .first();
        if (existing) {
            throw new AppError(`Project code '${trimmedCode}' is already taken in your organization. Please choose a unique code.`, 400);
        }
    }

    const updates = {};
    if (updateData.name) updates.name = updateData.name.trim();
    if (updateData.location !== undefined) updates.location = updateData.location ? updateData.location.trim() : null;
    if (updateData.status) updates.status = updateData.status;
    if (updateData.project_code !== undefined) updates.project_code = updateData.project_code ? String(updateData.project_code).trim() : null;
    if (updateData.start_date !== undefined) updates.start_date = updateData.start_date || null;
    if (updateData.end_date !== undefined) updates.end_date = updateData.end_date || null;
    if (updateData.logo_url !== undefined) updates.logo_url = updateData.logo_url;
    if (updateData.metadata !== undefined) {
        updates.metadata = updateData.metadata ? (typeof updateData.metadata === 'string' ? updateData.metadata : JSON.stringify(updateData.metadata)) : null;
    }

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
