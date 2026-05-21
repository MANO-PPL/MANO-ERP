import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

/**
 * Create a new document instance for a project.
 */
export async function createInstance(orgId, projectId, userId, { document_id, title }) {
    if (!document_id || !title) {
        throw new AppError('document_id and title are required', 400);
    }

    // Verify document template exists
    const document = await db('documents')
        .where({ document_id, org_id: orgId })
        .first();

    if (!document) {
        throw new AppError('Document template not found', 404);
    }

    // Singletons can only have ONE active instance per project
    if (document.doc_type === 'singleton') {
        const existing = await db('document_instances')
            .where({
                project_id: projectId,
                document_id,
                org_id: orgId,
                instance_status: 'active'
            })
            .first();

        if (existing) {
            throw new AppError(`A singleton document of this type already exists for this project (Instance ID: ${existing.instance_id})`, 409);
        }
    }

    const [instance_id] = await db('document_instances').insert({
        document_id,
        project_id: projectId,
        org_id: orgId,
        title,
        instance_status: 'active',
        created_by: userId
    });

    return instance_id;
}

/**
 * List document instances for a project.
 */
export async function listProjectInstances(orgId, projectId, { document_id } = {}) {
    const query = db('document_instances')
        .select(
            'document_instances.*',
            'documents.name as template_name',
            'documents.doc_type',
            'users.user_name as locked_by_name'
        )
        .leftJoin('documents', 'document_instances.document_id', 'documents.document_id')
        .leftJoin('users', 'document_instances.locked_by', 'users.user_id')
        .where('document_instances.project_id', projectId)
        .andWhere('document_instances.org_id', orgId);

    if (document_id) {
        query.andWhere('document_instances.document_id', document_id);
    }

    return await query;
}

/**
 * Get detailed information about a specific document instance.
 */
export async function getInstanceDetail(orgId, instanceId) {
    const instance = await db('document_instances')
        .select(
            'document_instances.*',
            'users.user_name as locked_by_name'
        )
        .leftJoin('users', 'document_instances.locked_by', 'users.user_id')
        .where({ 'document_instances.instance_id': instanceId, 'document_instances.org_id': orgId })
        .first();

    if (!instance) {
        throw new AppError('Document instance not found', 404);
    }

    const template = await db('documents')
        .where({ document_id: instance.document_id })
        .first();

    // Check for an active approval cycle
    const currentCycle = await db('approval_cycles')
        .where({ instance_id: instanceId })
        .whereNotIn('status', ['approved', 'rejected', 'cancelled'])
        .orderBy('created_at', 'desc')
        .first();

    return {
        ...instance,
        template,
        current_cycle: currentCycle || null
    };
}

/**
 * Archive a document instance.
 */
export async function archiveInstance(orgId, instanceId) {
    const instance = await db('document_instances')
        .where({ instance_id: instanceId, org_id: orgId })
        .first();

    if (!instance) {
        throw new AppError('Document instance not found', 404);
    }

    if (instance.is_locked === 1) {
        throw new AppError('Cannot archive a locked document instance. Finish or cancel the active approval cycle first.', 400);
    }

    await db('document_instances')
        .where({ instance_id: instanceId })
        .update({ instance_status: 'archived' });

    return true;
}

export default {
    createInstance,
    listProjectInstances,
    getInstanceDetail,
    archiveInstance
};
