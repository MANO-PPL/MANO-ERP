import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

/**
 * Create a new document template.
 */
export async function createTemplate(orgId, userId, { name, doc_type, approval_type, description, project_id = null }) {
    if (!name || !doc_type || !approval_type) {
        throw new AppError('name, doc_type, and approval_type are required', 400);
    }

    const validDocTypes = ['singleton', 'episodic'];
    const validApprovalTypes = ['serial', 'parallel'];

    if (!validDocTypes.includes(doc_type)) {
        throw new AppError(`doc_type must be one of: ${validDocTypes.join(', ')}`, 400);
    }
    if (!validApprovalTypes.includes(approval_type)) {
        throw new AppError(`approval_type must be one of: ${validApprovalTypes.join(', ')}`, 400);
    }

    const [document_id] = await db('wf_documents').insert({
        org_id: orgId,
        project_id: project_id || null,
        name,
        doc_type,
        approval_type,
        description: description || null,
        created_by: userId
    });

    return document_id;
}

/**
 * List document templates for a project or org.
 */
export async function getTemplates(orgId, { project_id } = {}) {
    const query = db('wf_documents').where('org_id', orgId);

    if (project_id) {
        query.where(function() {
            this.where('project_id', project_id).orWhereNull('project_id');
        });
    }

    return await query;
}

/**
 * Get a single document template with levels and roles.
 */
export async function getTemplateById(orgId, document_id) {
    const document = await db('wf_documents').where({ document_id, org_id: orgId }).first();
    if (!document) {
        throw new AppError('Document template not found', 404);
    }

    const levels = await db('wf_approval_levels')
        .where('document_id', document_id)
        .orderBy('level_order', 'ASC');

    const roles = await db('wf_document_roles as document_roles')
        .select('document_roles.*', 'users.user_name', 'users.email')
        .leftJoin('iam_users as users', 'document_roles.user_id', 'users.user_id')
        .where('document_roles.document_id', document_id);

    return {
        ...document,
        approval_levels: levels,
        document_roles: roles
    };
}

/**
 * Update a document template.
 */
export async function updateTemplate(orgId, document_id, data) {
    const document = await db('wf_documents').where({ document_id, org_id: orgId }).first();
    if (!document) {
        throw new AppError('Document template not found', 404);
    }

    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.is_active !== undefined) updates.is_active = data.is_active;

    // Check if trying to change doc_type or approval_type
    const checkDocType = data.doc_type && data.doc_type !== document.doc_type;
    const checkApprovalType = data.approval_type && data.approval_type !== document.approval_type;

    if (checkDocType || checkApprovalType) {
        const instancesExist = await db('wf_document_instances').where('document_id', document_id).first();
        if (instancesExist) {
            throw new AppError('Cannot change doc_type or approval_type when instances exist', 400);
        }
        if (checkDocType) updates.doc_type = data.doc_type;
        if (checkApprovalType) updates.approval_type = data.approval_type;
    }

    if (Object.keys(updates).length === 0) return true;

    await db('wf_documents').where({ document_id, org_id: orgId }).update(updates);
    return true;
}

/**
 * Add an approval level.
 */
export async function addApprovalLevel(orgId, document_id, { label, level_order }) {
    const document = await db('wf_documents').where({ document_id, org_id: orgId }).first();
    if (!document) {
        throw new AppError('Document template not found', 404);
    }

    if (!label || level_order === undefined) {
        throw new AppError('label and level_order are required', 400);
    }

    // Validate level_order uniqueness for this document
    const existing = await db('wf_approval_levels').where({ document_id, level_order }).first();
    if (existing) {
        throw new AppError(`Level order ${level_order} already exists for this document`, 400);
    }

    const [level_id] = await db('wf_approval_levels').insert({
        document_id,
        label,
        level_order
    });

    return level_id;
}

/**
 * Remove an approval level.
 */
export async function removeApprovalLevel(orgId, document_id, level_id) {
    const document = await db('wf_documents').where({ document_id, org_id: orgId }).first();
    if (!document) {
        throw new AppError('Document template not found', 404);
    }

    // Block if any document_roles reference this level_id
    const referenced = await db('wf_document_roles').where({ level_id }).first();
    if (referenced) {
        throw new AppError('Cannot remove level: it is referenced by one or more document roles', 400);
    }

    const deleted = await db('wf_approval_levels').where({ level_id, document_id }).del();
    if (!deleted) {
        throw new AppError('Approval level not found for this document', 404);
    }

    return true;
}

/**
 * Assign a user to a role.
 */
export async function assignDocumentRole(orgId, document_id, { user_id, role, level_id = null }) {
    const document = await db('wf_documents').where({ document_id, org_id: orgId }).first();
    if (!document) {
        throw new AppError('Document template not found', 404);
    }

    if (!user_id || !role) {
        throw new AppError('user_id and role are required', 400);
    }

    const validRoles = ['editor', 'approver', 'reporter'];
    if (!validRoles.includes(role)) {
        throw new AppError(`role must be one of: ${validRoles.join(', ')}`, 400);
    }

    if (role === 'approver') {
        if (!level_id) {
            throw new AppError('level_id is required for approver role', 400);
        }
        // Verify level exists for this document
        const level = await db('wf_approval_levels').where({ level_id, document_id }).first();
        if (!level) {
            throw new AppError('level_id does not exist for this document', 400);
        }
    } else {
        if (level_id !== null && level_id !== undefined) {
            throw new AppError(`level_id must be null for role ${role}`, 400);
        }
    }

    // Check duplicate
    const duplicate = await db('wf_document_roles').where({ document_id, user_id, role }).first();
    if (duplicate) {
        throw new AppError(`User already has the role '${role}' for this document`, 400);
    }

    const [role_id] = await db('wf_document_roles').insert({
        document_id,
        user_id,
        role,
        level_id: level_id || null
    });

    return role_id;
}

/**
 * Remove a role assignment.
 */
export async function removeDocumentRole(orgId, document_id, role_id) {
    const document = await db('wf_documents').where({ document_id, org_id: orgId }).first();
    if (!document) {
        throw new AppError('Document template not found', 404);
    }

    const deleted = await db('wf_document_roles').where({ id: role_id, document_id }).del();
    if (!deleted) {
        throw new AppError('Role assignment not found for this document', 404);
    }

    return true;
}

export default {
    createTemplate,
    getTemplates,
    getTemplateById,
    updateTemplate,
    addApprovalLevel,
    removeApprovalLevel,
    assignDocumentRole,
    removeDocumentRole
};
