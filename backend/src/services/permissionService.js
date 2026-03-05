import { db } from '../config/database.js';
import AppError from '../utils/AppError.js';

export async function getTemplates(orgId, type) {
    let query = db('permission_templates').where('org_id', orgId);
    if (type) {
        query = query.andWhere('type', type);
    }
    return await query;
}

export async function createTemplate(orgId, { name, type, permissions }) {
    if (!name || !type || !permissions) {
        throw new AppError('Name, type, and permissions JSON are required', 400);
    }

    if (!['system', 'project'].includes(type)) {
        throw new AppError('Template type must be either system or project', 400);
    }

    const [id] = await db('permission_templates').insert({
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

    const affected = await db('permission_templates')
        .where({ id: templateId, org_id: orgId })
        .update(updates);

    if (affected === 0) {
        throw new AppError('Template not found', 404);
    }

    return true;
}

export async function deleteTemplate(orgId, templateId) {
    const affected = await db('permission_templates')
        .where({ id: templateId, org_id: orgId })
        .del();

    if (affected === 0) {
        throw new AppError('Template not found', 404);
    }

    return true;
}

export default {
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate
};
