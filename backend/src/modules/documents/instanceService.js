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
    const document = await db('wf_documents')
        .where({ document_id, org_id: orgId })
        .first();

    if (!document) {
        throw new AppError('Document template not found', 404);
    }

    // Singletons can only have ONE active instance per project
    if (document.doc_type === 'singleton') {
        const existing = await db('wf_document_instances')
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

    const [instance_id] = await db('wf_document_instances').insert({
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
    const query = db('wf_document_instances as document_instances')
        .select(
            'document_instances.*',
            'documents.name as template_name',
            'documents.doc_type',
            'users.user_name as locked_by_name'
        )
        .leftJoin('wf_documents as documents', 'document_instances.document_id', 'documents.document_id')
        .leftJoin('iam_users as users', 'document_instances.locked_by', 'users.user_id')
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
    const instance = await db('wf_document_instances as document_instances')
        .select(
            'document_instances.*',
            'users.user_name as locked_by_name'
        )
        .leftJoin('iam_users as users', 'document_instances.locked_by', 'users.user_id')
        .where({ 'document_instances.instance_id': instanceId, 'document_instances.org_id': orgId })
        .first();

    if (!instance) {
        throw new AppError('Document instance not found', 404);
    }

    const template = await db('wf_documents')
        .where({ document_id: instance.document_id })
        .first();

    // Check for an active approval cycle — join users to get holder name
    const currentCycle = await db('wf_approval_cycles as ac')
        .leftJoin('iam_users as holder', 'ac.current_holder_id', 'holder.user_id')
        .select(
            'ac.*',
            'holder.user_name as holder_name'
        )
        .where({ 'ac.instance_id': instanceId })
        .whereNotIn('ac.status', ['approved', 'rejected', 'cancelled'])
        .orderBy('ac.created_at', 'desc')
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
    const instance = await db('wf_document_instances')
        .where({ instance_id: instanceId, org_id: orgId })
        .first();

    if (!instance) {
        throw new AppError('Document instance not found', 404);
    }

    if (instance.is_locked === 1) {
        throw new AppError('Cannot archive a locked document instance. Finish or cancel the active approval cycle first.', 400);
    }

    await db('wf_document_instances')
        .where({ instance_id: instanceId })
        .update({ instance_status: 'archived' });

    return true;
}

/**
 * Get all approval logs for a document instance.
 */
export async function getInstanceLogs(orgId, instanceId) {
    const instance = await db('wf_document_instances')
        .where({ instance_id: instanceId, org_id: orgId })
        .first();

    if (!instance) {
        throw new AppError('Document instance not found', 404);
    }

    return await db('wf_approval_logs as logs')
        .join('wf_approval_cycles as cycles', 'logs.cycle_id', 'cycles.cycle_id')
        .leftJoin('iam_users as users', 'logs.acted_by', 'users.user_id')
        .select(
            'logs.*',
            'users.user_name as acted_by_name',
            'cycles.version_number'
        )
        .where('cycles.instance_id', instanceId)
        .orderBy('logs.acted_at', 'desc');
}

/**
 * Get the workflow status for a specific template in a project (combines template, instance, current cycle, versions, and cycles).
 */
export async function getTemplateWorkflowStatus(orgId, projectId, templateName, instanceId = null) {
    if (!templateName) {
        throw new AppError('template_name is required', 400);
    }

    // 1. Fetch document template by name
    const template = await db('wf_documents')
        .where({ name: templateName, org_id: orgId })
        .first();

    if (!template) {
        return {
            success: true,
            notConfigured: true,
            template: null,
            instance: null,
            versions: [],
            allCycles: []
        };
    }

    // 2. Fetch template details with roles and approval levels
    const documentId = template.document_id;
    const document_roles = await db('wf_document_roles as document_roles')
        .select('document_roles.*', 'users.user_name', 'users.email')
        .leftJoin('iam_users as users', 'document_roles.user_id', 'users.user_id')
        .where('document_roles.document_id', documentId);

    const approval_levels = await db('wf_approval_levels')
        .where('document_id', documentId)
        .orderBy('level_order', 'asc');

    const templateDetail = {
        ...template,
        document_roles,
        approval_levels
    };

    // 3. Find active instance for this template in this project
    let instance = null;
    let currentCycle = null;
    let versions = [];
    let allCycles = [];

    const instQuery = db('wf_document_instances as document_instances')
        .select(
            'document_instances.*',
            'users.user_name as locked_by_name'
        )
        .leftJoin('iam_users as users', 'document_instances.locked_by', 'users.user_id')
        .where({
            'document_instances.project_id': projectId,
            'document_instances.document_id': documentId,
            'document_instances.org_id': orgId
        });

    if (instanceId) {
        instQuery.where('document_instances.instance_id', instanceId);
    } else {
        instQuery.where('document_instances.instance_status', 'active');
    }

    const inst = await instQuery.first();

    if (inst) {
        instance = inst;

        // Check for active cycle
        currentCycle = await db('wf_approval_cycles as ac')
            .leftJoin('iam_users as holder', 'ac.current_holder_id', 'holder.user_id')
            .select(
                'ac.*',
                'holder.user_name as holder_name'
            )
            .where({ 'ac.instance_id': inst.instance_id })
            .whereNotIn('ac.status', ['approved', 'rejected', 'cancelled'])
            .orderBy('ac.created_at', 'desc')
            .first();

        // Get versions
        versions = await db('wf_document_versions as versions')
            .leftJoin('iam_users as users', 'versions.final_approved_by', 'users.user_id')
            .select('versions.*', 'users.user_name as created_by_name')
            .where('versions.instance_id', inst.instance_id)
            .orderBy('versions.version_number', 'desc');

        // Get cycles
        allCycles = await db('wf_approval_cycles as cycles')
            .leftJoin('iam_users as users', 'cycles.initiated_by', 'users.user_id')
            .select('cycles.*', 'users.user_name as initiated_by_name')
            .where('cycles.instance_id', inst.instance_id)
            .orderBy('cycles.created_at', 'desc');
    }

    return {
        success: true,
        template,
        templateDetail,
        instance: instance ? {
            ...instance,
            template,
            current_cycle: currentCycle || null
        } : null,
        versions,
        allCycles
    };
}

export default {
    createInstance,
    listProjectInstances,
    getInstanceDetail,
    archiveInstance,
    getInstanceLogs,
    getTemplateWorkflowStatus
};
