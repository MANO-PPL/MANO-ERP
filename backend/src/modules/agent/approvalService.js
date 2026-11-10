import { fail, fingerprint } from './agentValidation.js';

export function createApprovalService({ db }) {
    return {
        async inspectPendingApproval(orgId, { itemType, itemId }, conn = db, lock = false) {
            let query;
            if (itemType === 'qaqc_observation') {
                query = conn('proj_qaqc_observations as obs').join('proj_projects as p', 'obs.project_id', 'p.id')
                    .where({ 'obs.id': itemId, 'p.org_id': orgId }).where('obs.status', 'FIXED')
                    .select('obs.id', 'obs.location as title', 'obs.status', 'obs.updated_at', 'obs.before_note', 'obs.after_note',
                        'obs.before_photos', 'obs.after_photos', 'p.name as projectName');
            } else if (itemType === 'document_cycle') {
                query = conn('wf_approval_cycles as ac').join('wf_document_instances as di', 'ac.instance_id', 'di.instance_id')
                    .join('proj_projects as p', 'di.project_id', 'p.id')
                    .where({ 'ac.cycle_id': itemId, 'di.org_id': orgId, 'p.org_id': orgId }).whereIn('ac.status', ['in_review', 'pending'])
                    .select('ac.cycle_id as id', 'di.title', 'ac.status', 'ac.updated_at', 'ac.current_level',
                        'ac.current_holder_id', 'ac.version_number', 'ac.draft_content', 'p.name as projectName');
            } else if (itemType === 'milestone_task') {
                query = conn('proj_tasks as t').join('proj_projects as p', 't.project_id', 'p.id')
                    .where({ 't.id': itemId, 'p.org_id': orgId }).whereIn('t.status', ['in_review', 'pending_approval', 'review'])
                    .select('t.id', 't.name as title', 't.status', 't.updated_at', 't.description', 'p.name as projectName');
            } else fail('validation_error', 'unsupported_approval_item_type');
            if (lock) query.forUpdate();
            const row = await query.first();
            if (!row) fail('validation_error', 'approval_target_not_pending');
            return { id: itemId, itemType, title: row.title || 'Pending item', projectName: row.projectName,
                status: row.status, recordDigest: fingerprint(row) };
        },

        async listPendingApprovals(orgId, { projectId, itemType = 'all', limit = 20, offset = 0 } = {}, conn = db) {
            const allItems = [];

            // 1. Quality & QAQC Observations awaiting sign-off (status = 'FIXED')
            try {
                const hasQaqc = await conn.schema.hasTable('proj_qaqc_observations');
                if (hasQaqc && ['all', 'qaqc_observation'].includes(itemType)) {
                    let qaqcQuery = conn('proj_qaqc_observations as obs')
                        .join('proj_projects as p', 'obs.project_id', 'p.id')
                        .leftJoin('iam_users as reporter', 'obs.reported_by', 'reporter.id')
                        .where('p.org_id', orgId)
                        .where('obs.status', 'FIXED')
                        .select(
                            'obs.id',
                            'obs.project_id',
                            'obs.location as title',
                            'obs.before_note as description',
                            'obs.location',
                            'obs.status',
                            'obs.created_at',
                            'obs.updated_at',
                            'p.name as project_name',
                            'reporter.user_name as reporter_name'
                        )
                        .orderBy('obs.updated_at', 'desc');

                    if (projectId) {
                        qaqcQuery = qaqcQuery.where('obs.project_id', projectId);
                    }

                    const qaqcRows = await qaqcQuery.limit(101);
                    for (const row of qaqcRows) {
                        allItems.push({
                            id: row.id,
                            itemType: 'qaqc_observation',
                            title: row.title || (row.description ? row.description.slice(0, 60) : 'Quality Observation'),
                            details: row.description || null,
                            projectId: Number(row.project_id),
                            projectName: row.project_name || 'Project',
                            status: 'FIXED',
                            severity: null,
                            location: row.location || null,
                            submittedBy: row.reporter_name || 'Site Engineer',
                            submittedAt: row.updated_at ? new Date(row.updated_at).toISOString() : (row.created_at ? new Date(row.created_at).toISOString() : null),
                            route: `/projects/${row.project_id}?tab=quality`
                        });
                    }
                }
            } catch {
                fail('execution_failure', 'approval_queue_unavailable');
            }

            // 2. Document Workflow Cycles (status IN ('in_review', 'pending'))
            try {
                const hasCycles = await conn.schema.hasTable('wf_approval_cycles');
                if (hasCycles && ['all', 'document_cycle'].includes(itemType)) {
                    let cycleQuery = conn('wf_approval_cycles as ac')
                        .join('wf_document_instances as di', 'ac.instance_id', 'di.instance_id')
                        .leftJoin('wf_documents as doc', 'di.document_id', 'doc.document_id')
                        .leftJoin('proj_projects as p', 'di.project_id', 'p.id')
                        .leftJoin('iam_users as user', 'ac.initiated_by', 'user.id')
                        .where('di.org_id', orgId)
                        .whereIn('ac.status', ['in_review', 'pending'])
                        .select(
                            'ac.cycle_id',
                            'ac.status',
                            'ac.version_number',
                            'ac.current_level',
                            'ac.created_at',
                            'di.project_id',
                            'di.title as doc_title',
                            'p.name as project_name',
                            'user.user_name as initiator_name'
                        )
                        .orderBy('ac.created_at', 'desc');

                    if (projectId) {
                        cycleQuery = cycleQuery.where('di.project_id', projectId);
                    }

                    const cycleRows = await cycleQuery.limit(101);
                    for (const row of cycleRows) {
                        allItems.push({
                            id: row.cycle_id,
                            itemType: 'document_cycle',
                            title: row.doc_title ? `${row.doc_title} (v${row.version_number})` : `Document Cycle #${row.cycle_id} (v${row.version_number})`,
                            details: `Approval Level ${row.current_level || 1}`,
                            projectId: row.project_id ? Number(row.project_id) : null,
                            projectName: row.project_name || 'General Document',
                            status: row.status,
                            severity: 'Normal',
                            location: null,
                            submittedBy: row.initiator_name || 'Document Reporter',
                            submittedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
                            route: row.project_id ? `/projects/${row.project_id}?tab=documents` : '/projects'
                        });
                    }
                }
            } catch {
                fail('execution_failure', 'approval_queue_unavailable');
            }

            // 3. Milestone Tasks in review / pending completion sign-off
            try {
                const hasTasks = await conn.schema.hasTable('proj_tasks');
                if (hasTasks && ['all', 'milestone_task'].includes(itemType)) {
                    let taskQuery = conn('proj_tasks as t')
                        .join('proj_projects as p', 't.project_id', 'p.id')
                        .where('p.org_id', orgId)
                        .whereIn('t.status', ['in_review', 'pending_approval', 'review'])
                        .select(
                            't.id',
                            't.name',
                            't.task_code',
                            't.status',
                            't.priority',
                            't.created_at',
                            't.updated_at',
                            't.project_id',
                            'p.name as project_name'
                        )
                        .orderBy('t.updated_at', 'desc');

                    if (projectId) {
                        taskQuery = taskQuery.where('t.project_id', projectId);
                    }

                    const taskRows = await taskQuery.limit(101);
                    for (const row of taskRows) {
                        allItems.push({
                            id: row.id,
                            itemType: 'milestone_task',
                            title: row.name || `Task #${row.id}`,
                            details: row.task_code ? `Code: ${row.task_code}` : null,
                            projectId: Number(row.project_id),
                            projectName: row.project_name || 'Project',
                            status: row.status,
                            severity: row.priority || 'Medium',
                            location: null,
                            submittedBy: 'Project Engineer',
                            submittedAt: row.updated_at ? new Date(row.updated_at).toISOString() : (row.created_at ? new Date(row.created_at).toISOString() : null),
                            route: `/projects/${row.project_id}?tab=tasks`
                        });
                    }
                }
            } catch {
                fail('execution_failure', 'approval_queue_unavailable');
            }

            // Sort all by submittedAt desc
            allItems.sort((a, b) => {
                const da = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                const db = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                return db - da;
            });

            const byType = {
                qaqc_observation: allItems.filter(i => i.itemType === 'qaqc_observation').length,
                document_cycle: allItems.filter(i => i.itemType === 'document_cycle').length,
                milestone_task: allItems.filter(i => i.itemType === 'milestone_task').length
            };

            const paginatedItems = allItems.slice(offset, offset + limit);

            return {
                totalPending: allItems.length,
                byType,
                items: paginatedItems,
                limit,
                offset
            };
        },

        async decideApproval(orgId, userId, { itemType, itemId, action, comments }, { trx } = {}) {
            if (!trx?.isTransaction) fail('execution_failure', 'caller_transaction_required');
            const cleanAction = String(action || '').toLowerCase().trim();
            if (!['approve', 'reject'].includes(cleanAction)) fail('validation_error', 'invalid_decision_action');

            if (itemType === 'qaqc_observation') {
                const obs = await trx('proj_qaqc_observations as obs')
                    .join('proj_projects as p', 'obs.project_id', 'p.id')
                    .where({ 'obs.id': itemId, 'p.org_id': orgId })
                    .select('obs.*', 'p.name as project_name')
                    .forUpdate()
                    .first();

                if (!obs) fail('validation_error', 'approval_target_not_found');
                if (obs.status !== 'FIXED') fail('validation_error', 'observation_not_pending_approval');

                const newStatus = cleanAction === 'approve' ? 'APPROVED' : 'PENDING';
                const updates = {
                    status: newStatus,
                    updated_at: trx.fn.now()
                };
                if (cleanAction === 'approve') {
                    updates.approved_by = userId;
                    updates.approved_at = trx.fn.now();
                }

                await trx('proj_qaqc_observations').where('id', itemId).update(updates);

                return {
                    id: itemId,
                    itemType: 'qaqc_observation',
                    title: obs.location || obs.before_note?.slice(0, 50) || 'Quality Observation',
                    projectName: obs.project_name,
                    action: cleanAction,
                    previousStatus: 'FIXED',
                    newStatus,
                    comments: comments || null
                };
            }

            if (itemType === 'document_cycle') {
                const cycle = await trx('wf_approval_cycles as ac')
                    .join('wf_document_instances as di', 'ac.instance_id', 'di.instance_id')
                    .leftJoin('wf_documents as doc', 'di.document_id', 'doc.document_id')
                    .leftJoin('proj_projects as p', 'di.project_id', 'p.id')
                    .where({ 'ac.cycle_id': itemId, 'di.org_id': orgId })
                    .select('ac.*', 'di.instance_id', 'di.title as doc_title', 'p.name as project_name')
                    .forUpdate()
                    .first();

                if (!cycle) fail('validation_error', 'approval_target_not_found');
                if (!['in_review', 'pending'].includes(cycle.status)) fail('validation_error', 'cycle_not_in_review');

                const newStatus = cleanAction === 'approve' ? 'approved' : 'rejected';
                await trx('wf_approval_cycles').where('cycle_id', itemId).update({
                    status: newStatus,
                    completed_at: trx.fn.now(),
                    current_holder_id: null
                });

                await trx('wf_document_instances').where('instance_id', cycle.instance_id).update({
                    is_locked: 0,
                    locked_by: null,
                    locked_at: null
                });

                if (!await trx.schema.hasTable('wf_approval_logs')) fail('execution_failure', 'approval_audit_unavailable');
                await trx('wf_approval_logs').insert({
                            cycle_id: itemId,
                            action: newStatus,
                            level_order: cycle.current_level,
                            acted_by: userId,
                            comments: comments || `Decision ${cleanAction} recorded via AI Assistant`
                });

                return {
                    id: itemId,
                    itemType: 'document_cycle',
                    title: cycle.doc_title || `Document Cycle #${itemId}`,
                    projectName: cycle.project_name || 'Document',
                    action: cleanAction,
                    previousStatus: cycle.status,
                    newStatus,
                    comments: comments || null
                };
            }

            if (itemType === 'milestone_task') {
                const task = await trx('proj_tasks as t')
                    .join('proj_projects as p', 't.project_id', 'p.id')
                    .where({ 't.id': itemId, 'p.org_id': orgId })
                    .select('t.*', 'p.name as project_name')
                    .forUpdate()
                    .first();

                if (!task) fail('validation_error', 'approval_target_not_found');
                if (!['in_review', 'pending_approval', 'review'].includes(task.status)) fail('validation_error', 'task_not_pending_approval');

                const newStatus = cleanAction === 'approve' ? 'completed' : 'open';
                await trx('proj_tasks').where('id', itemId).update({
                    status: newStatus,
                    updated_at: trx.fn.now()
                });

                return {
                    id: itemId,
                    itemType: 'milestone_task',
                    title: task.name || `Task #${itemId}`,
                    projectName: task.project_name,
                    action: cleanAction,
                    previousStatus: task.status,
                    newStatus,
                    comments: comments || null
                };
            }

            fail('validation_error', 'unsupported_approval_item_type');
        },

        async batchDecideApprovals(orgId, userId, { itemType = 'all', action = 'approve', comments }, { trx, targets } = {}) {
            if (!trx?.isTransaction) fail('execution_failure', 'caller_transaction_required');

            if (!Array.isArray(targets) || targets.length < 1 || targets.length > 20
                || targets.some(item => itemType !== 'all' && item.itemType !== itemType)) fail('validation_error', 'approval_snapshot_required');
            const candidates = targets;

            if (candidates.length === 0) {
                return {
                    id: 1,
                    action,
                    itemType,
                    processedCount: 0,
                    items: [],
                    message: 'No pending items found matching criteria'
                };
            }

            const processed = [];
            for (const item of candidates) {
                const result = await this.decideApproval(orgId, userId, {
                    itemType: item.itemType,
                    itemId: item.id,
                    action,
                    comments: comments || 'Batch decision via AI Assistant'
                }, { trx });
                processed.push(result);
            }

            return {
                id: processed.length || 1,
                action,
                itemType,
                processedCount: processed.length,
                items: processed
            };
        }
    };
}
