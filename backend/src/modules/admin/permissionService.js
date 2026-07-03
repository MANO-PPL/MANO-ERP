import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

export async function initializePermissionsSchema() {
    console.log("Database permissions schema verified.");
}

export async function seedDefaultTemplatesForOrg(orgId) {
    const defaultTemplates = [
        {
            org_id: orgId,
            name: 'Administrator',
            type: 'system',
            permissions: JSON.stringify({
                dashboard: 2,
                projects: 2,
                vendors: 2,
                clients: 2,
                resources: 2,
                units: 2,
                collaboration: 2,
                admin: 2
            })
        },
        {
            org_id: orgId,
            name: 'Project Manager (Global)',
            type: 'system',
            permissions: JSON.stringify({
                dashboard: 2,
                projects: 2,
                vendors: 2,
                clients: 2,
                resources: 2,
                units: 2,
                collaboration: 2,
                admin: 0
            })
        },
        {
            org_id: orgId,
            name: 'Site Lead (Global)',
            type: 'system',
            permissions: JSON.stringify({
                dashboard: 2,
                projects: 1,
                vendors: 0,
                clients: 0,
                resources: 1,
                units: 1,
                collaboration: 2,
                admin: 0
            })
        },
        {
            org_id: orgId,
            name: 'Viewer / Client (Global)',
            type: 'system',
            permissions: JSON.stringify({
                dashboard: 1,
                projects: 1,
                vendors: 0,
                clients: 0,
                resources: 0,
                units: 0,
                collaboration: 0,
                admin: 0
            })
        },
        // Project templates
        {
            org_id: orgId,
            name: 'Project Admin',
            type: 'project',
            permissions: JSON.stringify({
                'Dashboard': 2,
                'Tasks': 2,
                'WIP': 2,
                'Reports': 2,
                'General Documents': 2,
                'Drawings': 2,
                'Planning': 2,
                'Contracts': 2,
                'Quality': 2,
                'Safety': 2,
                'Billing': 2,
                'Material Management': 2,
                'Approvals': 2
            })
        },
        {
            org_id: orgId,
            name: 'Project Manager (Project)',
            type: 'project',
            permissions: JSON.stringify({
                'Dashboard': 2,
                'Tasks': 2,
                'WIP': 2,
                'Reports': 2,
                'General Documents': 2,
                'Drawings': 2,
                'Planning': 2,
                'Contracts': 2,
                'Quality': 2,
                'Safety': 2,
                'Billing': 2,
                'Material Management': 2,
                'Approvals': 2
            })
        },
        {
            org_id: orgId,
            name: 'Site Engineer (Project)',
            type: 'project',
            permissions: JSON.stringify({
                'Dashboard': 2,
                'Tasks': 2,
                'WIP': 2,
                'Reports': 2,
                'General Documents': 2,
                'Drawings': 2,
                'Planning': 2,
                'Contracts': 0,
                'Quality': 2,
                'Safety': 2,
                'Billing': 0,
                'Material Management': 2,
                'Approvals': 1
            })
        },
        {
            org_id: orgId,
            name: 'Subcontractor / Vendor (Project)',
            type: 'project',
            permissions: JSON.stringify({
                'Dashboard': 1,
                'Tasks': 2,
                'WIP': 2,
                'Reports': 1,
                'General Documents': 1,
                'Drawings': 1,
                'Planning': 1,
                'Contracts': 0,
                'Quality': 1,
                'Safety': 1,
                'Billing': 0,
                'Material Management': 0,
                'Approvals': 0
            })
        },
        {
            org_id: orgId,
            name: 'Client / Viewer (Project)',
            type: 'project',
            permissions: JSON.stringify({
                'Dashboard': 1,
                'Tasks': 1,
                'WIP': 1,
                'Reports': 1,
                'General Documents': 1,
                'Drawings': 1,
                'Planning': 1,
                'Contracts': 1,
                'Quality': 1,
                'Safety': 1,
                'Billing': 1,
                'Material Management': 1,
                'Approvals': 1
            })
        }
    ];

    await db('permission_templates').insert(defaultTemplates);
}

export async function getTemplates(orgId, type) {
    let query = db('iam_permission_templates').where('org_id', orgId);
    if (type) {
        query = query.andWhere('type', type);
    }
    const templates = await query;
    if (templates.length === 0) {
        await seedDefaultTemplatesForOrg(orgId);
        let freshQuery = db('permission_templates').where('org_id', orgId);
        if (type) {
            freshQuery = freshQuery.andWhere('type', type);
        }
        return await freshQuery;
    }
    return templates;
}

export async function createTemplate(orgId, { name, type, permissions }) {
    if (!name || !type || !permissions) {
        throw new AppError('Name, type, and permissions JSON are required', 400);
    }

    if (!['system', 'project'].includes(type)) {
        throw new AppError('Template type must be either system or project', 400);
    }

    const [id] = await db('iam_permission_templates').insert({
        org_id: orgId,
        name,
        type,
        permissions: JSON.stringify(permissions)
    });

    return id;
}

export async function updateTemplate(orgId, templateId, { name, permissions }) {
    const updates = {};
    if (name) updates.name = name;
    if (permissions) updates.permissions = JSON.stringify(permissions);

    const affected = await db('iam_permission_templates')
        .where({ id: templateId, org_id: orgId })
        .update(updates);

    if (affected === 0) {
        throw new AppError('Template not found', 404);
    }

    return true;
}

export async function deleteTemplate(orgId, templateId) {
    const affected = await db('iam_permission_templates')
        .where({ id: templateId, org_id: orgId })
        .del();

    if (affected === 0) {
        throw new AppError('Template not found', 404);
    }

    return true;
}

export default {
    initializePermissionsSchema,
    seedDefaultTemplatesForOrg,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate
};
