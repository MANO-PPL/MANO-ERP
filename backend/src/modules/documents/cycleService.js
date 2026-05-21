import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';

const CONTENT_TABLES = [
    { name: 'project_directory', pk: 'pd_id' },
    { name: 'project_vendors', pk: 'pv_id' },
    { name: 'project_staff_role_responsible', pk: 'psrr_id' },
    { name: 'project_summary', pk: 'id' },
    {
        name: 'project_mom',
        pk: 'mom_id',
        children: [{ name: 'project_mom_participants', fk: 'mom_id', pk: 'pmp_id' }]
    },
    {
        name: 'project_agenda',
        pk: 'agenda_id',
        children: [{ name: 'project_agenda_participants', fk: 'agenda_id', pk: 'pap_id' }]
    }
];

export async function initiateCycle(orgId, instanceId, userId) {
    return await db.transaction(async (trx) => {
        // 1. Fetch instance
        const instance = await trx('document_instances')
            .where({ instance_id: instanceId, org_id: orgId })
            .first();

        if (!instance) throw new AppError('Instance not found', 404);

        // 2. Validate is_locked = 0
        if (instance.is_locked === 1) {
            throw new AppError('Instance is currently locked by another cycle or user', 400);
        }

        // 3. Verify caller has role='editor'
        const role = await trx('document_roles')
            .where({ document_id: instance.document_id, user_id: userId, role: 'editor' })
            .first();
            
        if (!role) {
            throw new AppError('Caller must have editor role for this document', 403);
        }

        // 4. Verify no active cycle exists
        const activeCycle = await trx('approval_cycles')
            .where({ instance_id: instanceId })
            .whereIn('status', ['drafting', 'in_review', 'revision_requested'])
            .first();

        if (activeCycle) {
            throw new AppError('An active cycle already exists for this instance', 400);
        }

        // 5. Determine version_number
        const latestCycle = await trx('approval_cycles')
            .where({ instance_id: instanceId })
            .max('version_number as max_ver')
            .first();
            
        const nextVersion = (latestCycle && latestCycle.max_ver) ? latestCycle.max_ver + 1 : 1;

        // 6. Insert approval_cycles
        const [cycleId] = await trx('approval_cycles').insert({
            instance_id: instanceId,
            document_id: instance.document_id,
            version_number: nextVersion,
            status: 'drafting',
            current_level: 0,
            current_holder_id: userId,
            initiated_by: userId
        });

        // 7. Copy content from latest_approved_version_id
        if (instance.latest_approved_version_id) {
            for (const tableConf of CONTENT_TABLES) {
                const rows = await trx(tableConf.name)
                    .where({ instance_id: instanceId, version_id: instance.latest_approved_version_id });

                for (const row of rows) {
                    const oldPk = row[tableConf.pk];
                    delete row[tableConf.pk];
                    
                    // Assign new versioning identifiers
                    row.cycle_id = cycleId;
                    row.version_id = null; // null marks it as a draft

                    // Remove timestamps to allow auto-generation
                    delete row.created_at;
                    delete row.updated_at;

                    const [newPk] = await trx(tableConf.name).insert(row);

                    // Handle child tables if they exist
                    if (tableConf.children) {
                        for (const childConf of tableConf.children) {
                            const childRows = await trx(childConf.name).where(childConf.fk, oldPk);
                            for (const childRow of childRows) {
                                delete childRow[childConf.pk];
                                childRow[childConf.fk] = newPk;
                                await trx(childConf.name).insert(childRow);
                            }
                        }
                    }
                }
            }
        }

        // 8. Update instance lock
        await trx('document_instances')
            .where({ instance_id: instanceId })
            .update({
                is_locked: 1,
                locked_by: userId,
                locked_at: new Date()
            });

        // 9. Insert log
        await trx('approval_logs').insert({
            cycle_id: cycleId,
            action: 'cycle_initiated',
            level_order: 0,
            acted_by: userId
        });

        return cycleId;
    });
}

export async function listCycles(orgId, instanceId) {
    // Validate instance access
    const instance = await db('document_instances')
        .where({ instance_id: instanceId, org_id: orgId })
        .first();

    if (!instance) throw new AppError('Instance not found', 404);

    return await db('approval_cycles')
        .select('approval_cycles.*', 'users.user_name as initiator_name')
        .leftJoin('users', 'approval_cycles.initiated_by', 'users.user_id')
        .where('approval_cycles.instance_id', instanceId)
        .orderBy('approval_cycles.version_number', 'desc');
}

export async function getCycleDetail(orgId, cycleId) {
    const cycle = await db('approval_cycles')
        .select(
            'approval_cycles.*',
            'users.user_name as current_holder_name',
            'initiator.user_name as initiator_name',
            'document_instances.org_id'
        )
        .leftJoin('users', 'approval_cycles.current_holder_id', 'users.user_id')
        .leftJoin('users as initiator', 'approval_cycles.initiated_by', 'initiator.user_id')
        .leftJoin('document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
        .where('approval_cycles.cycle_id', cycleId)
        .first();

    if (!cycle || cycle.org_id !== orgId) {
        throw new AppError('Cycle not found', 404);
    }

    const submissions = await db('cycle_submissions')
        .select('cycle_submissions.*', 'users.user_name as submitter_name')
        .leftJoin('users', 'cycle_submissions.submitted_by', 'users.user_id')
        .where('cycle_submissions.cycle_id', cycleId)
        .orderBy('cycle_submissions.level_order', 'asc');

    return {
        ...cycle,
        submissions
    };
}

export async function saveDraft(orgId, cycleId, userId, content) {
    const cycle = await db('approval_cycles')
        .join('document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
        .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
        .select('approval_cycles.*')
        .first();

    if (!cycle) throw new AppError('Cycle not found', 404);

    if (cycle.current_holder_id !== userId) {
        throw new AppError('Only the current holder can save drafts', 403);
    }

    if (!['drafting', 'revision_requested', 'in_review'].includes(cycle.status)) {
        throw new AppError('Cycle is not in a draftable state', 400);
    }

    const now = new Date();
    await db('approval_cycles')
        .where({ cycle_id: cycleId })
        .update({
            draft_content: content ? JSON.stringify(content) : null,
            last_draft_saved: now
        });

    // Check last log
    const lastLog = await db('approval_logs')
        .where({ cycle_id: cycleId, action: 'draft_saved' })
        .orderBy('created_at', 'desc')
        .first();

    if (!lastLog || (now - new Date(lastLog.created_at)) > 60000) {
        await db('approval_logs').insert({
            cycle_id: cycleId,
            action: 'draft_saved',
            level_order: cycle.current_level,
            acted_by: userId
        });
    }

    return now;
}

export async function submitDraft(orgId, cycleId, userId, { changes_summary, comments }) {
    return await db.transaction(async (trx) => {
        const cycle = await trx('approval_cycles')
            .join('document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select('approval_cycles.*', 'document_instances.is_locked')
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);

        if (cycle.current_holder_id !== userId) {
            throw new AppError('Only the current holder can submit', 403);
        }

        if (['approved', 'rejected', 'cancelled'].includes(cycle.status)) {
            throw new AppError('Cannot submit a closed cycle', 400);
        }

        // 1. Insert cycle submission
        await trx('cycle_submissions').insert({
            cycle_id: cycleId,
            level_order: cycle.current_level,
            submitted_by: userId,
            content_snapshot: cycle.draft_content,
            changes_summary: changes_summary || null,
            comments: comments || null
        });

        // 2. Find next approver
        // Query all approver roles for this document
        const approvers = await trx('document_roles')
            .join('approval_levels', 'document_roles.level_id', 'approval_levels.level_id')
            .where({
                'document_roles.document_id': cycle.document_id,
                'document_roles.role': 'approver'
            })
            .select('document_roles.user_id', 'approval_levels.level_order')
            .orderBy('approval_levels.level_order', 'asc');

        const nextApprover = approvers.find(a => a.level_order > cycle.current_level);

        if (nextApprover) {
            // Forward to next approver
            await trx('approval_cycles')
                .where({ cycle_id: cycleId })
                .update({
                    status: 'in_review',
                    current_level: nextApprover.level_order,
                    current_holder_id: nextApprover.user_id
                });

            await trx('document_instances')
                .where({ instance_id: cycle.instance_id })
                .update({ locked_by: nextApprover.user_id });

            await trx('approval_logs').insert({
                cycle_id: cycleId,
                action: 'submitted',
                level_order: cycle.current_level,
                acted_by: userId,
                comments: comments || null
            });

            return {
                status: 'in_review',
                current_level: nextApprover.level_order,
                current_holder_id: nextApprover.user_id
            };
        } else {
            // FULL APPROVAL sequence
            const [versionId] = await trx('document_versions').insert({
                instance_id: cycle.instance_id,
                cycle_id: cycleId,
                version_number: cycle.version_number,
                final_content: cycle.draft_content,
                final_approved_by: userId,
                approved_at: new Date()
            });

            // Update content rows where version_id IS NULL and cycle_id = current
            for (const tableConf of CONTENT_TABLES) {
                await trx(tableConf.name)
                    .where({ cycle_id: cycleId })
                    .whereNull('version_id')
                    .update({ version_id: versionId });
            }

            await trx('approval_cycles')
                .where({ cycle_id: cycleId })
                .update({
                    status: 'approved',
                    completed_at: new Date()
                });

            await trx('document_instances')
                .where({ instance_id: cycle.instance_id })
                .update({
                    latest_approved_version_id: versionId,
                    is_locked: 0,
                    locked_by: null,
                    locked_at: null
                });

            await trx('approval_logs').insert({
                cycle_id: cycleId,
                action: 'approved',
                level_order: cycle.current_level,
                acted_by: userId,
                comments: comments || null
            });

            return {
                status: 'approved',
                current_level: cycle.current_level,
                current_holder_id: null,
                version_id: versionId
            };
        }
    });
}

export async function requestRevision(orgId, cycleId, userId, comments) {
    return await db.transaction(async (trx) => {
        const cycle = await trx('approval_cycles')
            .join('document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select('approval_cycles.*', 'document_instances.is_locked')
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);
        if (cycle.current_holder_id !== userId) throw new AppError('Only the current holder can request revision', 403);
        if (cycle.status !== 'in_review') throw new AppError('Cycle must be in_review to request revision', 400);

        await trx('approval_cycles')
            .where({ cycle_id: cycleId })
            .update({
                status: 'revision_requested',
                current_level: 0,
                current_holder_id: null
            });

        await trx('document_instances')
            .where({ instance_id: cycle.instance_id })
            .update({
                is_locked: 0,
                locked_by: null,
                locked_at: null
            });

        await trx('approval_logs').insert({
            cycle_id: cycleId,
            action: 'revision_requested',
            level_order: cycle.current_level,
            acted_by: userId,
            comments: comments || null
        });

        return { status: 'revision_requested' };
    });
}

export async function rejectCycle(orgId, cycleId, userId, comments) {
    return await db.transaction(async (trx) => {
        const cycle = await trx('approval_cycles')
            .join('document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select('approval_cycles.*')
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);
        if (cycle.current_holder_id !== userId) throw new AppError('Only the current holder can reject', 403);
        if (cycle.status !== 'in_review') throw new AppError('Cycle must be in_review to reject', 400);

        await trx('approval_cycles')
            .where({ cycle_id: cycleId })
            .update({
                status: 'rejected',
                completed_at: new Date(),
                current_holder_id: null
            });

        await trx('document_instances')
            .where({ instance_id: cycle.instance_id })
            .update({
                is_locked: 0,
                locked_by: null,
                locked_at: null
            });

        await trx('approval_logs').insert({
            cycle_id: cycleId,
            action: 'rejected',
            level_order: cycle.current_level,
            acted_by: userId,
            comments: comments || null
        });

        return { status: 'rejected' };
    });
}

export async function cancelCycle(orgId, cycleId, userId, comments) {
    return await db.transaction(async (trx) => {
        const cycle = await trx('approval_cycles')
            .join('document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select('approval_cycles.*')
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);
        if (['approved', 'rejected'].includes(cycle.status)) {
            throw new AppError('Cannot cancel an already closed cycle', 400);
        }

        // Verify caller is initiator or an admin
        // We'll trust the caller has admin rights if they are an admin, otherwise must be initiator.
        // Assuming admin check requires user info, but org_admin is usually a role.
        // To be safe and compliant with instruction: check if initiated_by === userId
        // A more robust check could query users.user_type if admin bypass is needed.
        const user = await trx('users').where({ user_id: userId }).first();
        const isAdmin = user && ['admin', 'org_admin'].includes(user.user_type);
        
        if (cycle.initiated_by !== userId && !isAdmin) {
            throw new AppError('Only the cycle initiator or an admin can cancel this cycle', 403);
        }

        // 1. Delete draft content rows where cycle_id=X AND version_id IS NULL
        for (const tableConf of CONTENT_TABLES) {
            await trx(tableConf.name)
                .where({ cycle_id: cycleId })
                .whereNull('version_id')
                .del();
        }

        await trx('approval_cycles')
            .where({ cycle_id: cycleId })
            .update({
                status: 'cancelled',
                completed_at: new Date()
            });

        await trx('document_instances')
            .where({ instance_id: cycle.instance_id })
            .update({
                is_locked: 0,
                locked_by: null,
                locked_at: null
            });

        await trx('approval_logs').insert({
            cycle_id: cycleId,
            action: 'cycle_cancelled',
            level_order: cycle.current_level,
            acted_by: userId,
            comments: comments || null
        });

        return { status: 'cancelled' };
    });
}

export async function claimRevision(orgId, cycleId, userId) {
    return await db.transaction(async (trx) => {
        const cycle = await trx('approval_cycles')
            .join('document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select('approval_cycles.*')
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);
        if (cycle.status !== 'revision_requested') {
            throw new AppError('Cycle must be in revision_requested state to claim', 400);
        }

        const role = await trx('document_roles')
            .where({ document_id: cycle.document_id, user_id: userId, role: 'editor' })
            .first();
            
        if (!role) {
            throw new AppError('Caller must have editor role for this document to claim', 403);
        }

        await trx('approval_cycles')
            .where({ cycle_id: cycleId })
            .update({
                status: 'drafting',
                current_holder_id: userId
            });

        await trx('document_instances')
            .where({ instance_id: cycle.instance_id })
            .update({
                is_locked: 1,
                locked_by: userId,
                locked_at: new Date()
            });

        await trx('approval_logs').insert({
            cycle_id: cycleId,
            action: 'cycle_initiated', // as requested
            level_order: 0,
            acted_by: userId,
            comments: 'revision claimed'
        });

        return { status: 'drafting', current_holder_id: userId };
    });
}

export default {
    initiateCycle,
    listCycles,
    getCycleDetail,
    saveDraft,
    submitDraft,
    requestRevision,
    rejectCycle,
    cancelCycle,
    claimRevision
};
