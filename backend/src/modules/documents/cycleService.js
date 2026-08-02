import { db } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { triggerApprovalHooks } from '../../services/hookRegistry.js';
import { isAdmin } from '../../utils/userUtils.js';

const CONTENT_TABLES = [
    // Generic lines are scoped by instance/cycle/version, not project_id.
    { name: 'wf_document_lines', pk: 'line_id', projectScoped: false },
    { name: 'pdoc_vendors', pk: 'pv_id' },
    { name: 'pdoc_directory', pk: 'pd_id' },
    { name: 'pdoc_staff_responsible', pk: 'psrr_id' },
    { name: 'pdoc_summary', pk: 'id' },
    {
        name: 'pdoc_meeting',
        pk: 'meeting_id',
        children: [{ name: 'pdoc_meeting_participants', fk: 'meeting_id', pk: 'id' }]
    }
];


// Helper to copy/clone existing content rows to the new cycle so drafting begins with the current data
async function cloneContentToNewCycle(trx, instanceId, cycleId, latestApprovedVersionId, projectId) {
    const pvIdMap = new Map();

    for (const tableConf of CONTENT_TABLES) {
        let query;
        if (latestApprovedVersionId) {
            query = trx(tableConf.name).where({ instance_id: instanceId, version_id: latestApprovedVersionId });
        } else {
            // Generic foundation rows cannot be scoped to a project because
            // wf_document_lines intentionally has no project_id column.
            if (tableConf.projectScoped === false) continue;

            // First cycle: select from base project rows (where instance_id is null)
            query = trx(tableConf.name)
                .where({ project_id: projectId })
                .whereNull('instance_id')
                .whereNull('cycle_id')
                .whereNull('version_id');
        }

        let sourceRows = await query;

        // Base project data can contain stale vendor links after a CRM vendor
        // has been removed. Do not copy those links into a cycle because the
        // pdoc_vendors foreign key correctly rejects missing contacts.
        if (tableConf.name === 'pdoc_vendors' && sourceRows.length > 0) {
            const vendorIds = [...new Set(sourceRows.map(row => row.vendors_id).filter(Boolean))];
            const validVendors = vendorIds.length > 0
                ? await trx('crm_contacts')
                    .whereIn('id', vendorIds)
                    .where('type', 'vendor')
                    .select('id')
                : [];
            const validVendorIds = new Set(validVendors.map(vendor => vendor.id));
            sourceRows = sourceRows.filter(row => validVendorIds.has(row.vendors_id));
        }

        if (sourceRows.length === 0) continue;

        for (const row of sourceRows) {
            const oldPkVal = row[tableConf.pk];
            
            const clonedRow = { ...row };
            delete clonedRow[tableConf.pk]; // Remove PK for auto-increment
            clonedRow.instance_id = instanceId;
            clonedRow.cycle_id = cycleId;
            clonedRow.version_id = null;
            
            if (clonedRow.created_at) clonedRow.created_at = new Date();
            if (clonedRow.updated_at) clonedRow.updated_at = new Date();

            // Sibling mapping: If this is pdoc_directory and references a pv_id, update it to the cloned pv_id
            if (tableConf.name === 'pdoc_directory' && clonedRow.pv_id != null) {
                const clonedPvId = pvIdMap.get(clonedRow.pv_id);
                // The directory row depends on a vendor row. If that vendor
                // was stale and skipped above, skip the dependent row too.
                if (!clonedPvId) continue;
                clonedRow.pv_id = clonedPvId;
            }

            const [newPkVal] = await trx(tableConf.name).insert(clonedRow);

            // Sibling mapping: Store mapping of old pv_id to new pv_id
            if (tableConf.name === 'pdoc_vendors' && newPkVal) {
                pvIdMap.set(oldPkVal, newPkVal);
            }

            if (tableConf.children && newPkVal) {
                for (const childConf of tableConf.children) {
                    const childRows = await trx(childConf.name).where({ [childConf.fk]: oldPkVal });
                    for (const childRow of childRows) {
                        const clonedChild = { ...childRow };
                        delete clonedChild[childConf.pk];
                        clonedChild[childConf.fk] = newPkVal;
                        await trx(childConf.name).insert(clonedChild);
                    }
                }
            }
        }
    }
}

export async function initiateCycle(orgId, instanceId, userId) {
    return await db.transaction(async (trx) => {
        // 1. Fetch instance
        const instance = await trx('wf_document_instances')
            .where({ instance_id: instanceId, org_id: orgId })
            .first();

        if (!instance) throw new AppError('Instance not found', 404);

        // 2. Validate is_locked = 0
        if (instance.is_locked === 1) {
            throw new AppError('Instance is currently locked by another cycle or user', 400);
        }

        // 3. The first configured reporter to initialize the cycle becomes
        // the cycle's reporter/author. Other reporters may initialize future
        // cycles, but cannot take over an active cycle.
        const user = await trx('iam_users').where({ user_id: userId }).first();
        const isUserAdmin = isAdmin(user);
        const reporterRoles = await trx('wf_document_roles')
            .where({ document_id: instance.document_id, role: 'reporter' })
            .select('user_id');

        let hasRole = reporterRoles.length > 0
            ? reporterRoles.some(role => role.user_id === userId)
            : isUserAdmin;

        if (!hasRole && reporterRoles.length === 0 && !isUserAdmin) {
            // Check if any roles are defined for this document template
            const totalRoles = await trx('wf_document_roles')
                .where({ document_id: instance.document_id })
                .count('* as count')
                .first();

            if (totalRoles.count === 0) {
                // No roles defined yet - allow project members with General Documents write access
                const member = await trx('proj_members')
                    .where({ project_id: instance.project_id, user_id: userId, org_id: orgId })
                    .first();
                if (member) {
                    let projectPerms = member.project_permissions;
                    if (typeof projectPerms === 'string') {
                        try { projectPerms = JSON.parse(projectPerms); } catch (e) { projectPerms = {}; }
                    }
                    const generalDocsLvl = projectPerms?.['General Documents'] || 'none';
                    if (['edit', 'write'].includes(generalDocsLvl.toLowerCase())) {
                        hasRole = true;
                    }
                }
            }
        }

        if (!hasRole) {
            throw new AppError('Only a configured reporter can initialize this cycle', 403);
        }

        // 4. Verify no active cycle exists
        const activeCycle = await trx('wf_approval_cycles')
            .where({ instance_id: instanceId })
            .whereIn('status', ['drafting', 'in_review', 'revision_requested'])
            .first();

        if (activeCycle) {
            throw new AppError('An active cycle already exists for this instance', 400);
        }

        // 5. Determine version_number
        const latestCycle = await trx('wf_approval_cycles')
            .where({ instance_id: instanceId })
            .max('version_number as max_ver')
            .first();

        const nextVersion = (latestCycle && latestCycle.max_ver) ? latestCycle.max_ver + 1 : 1;

        // 6. Copy draft content from latest approved version's JSON if it exists
        let initialDraftContent = null;
        if (instance.latest_approved_version_id) {
            const lastVersion = await trx('wf_document_versions')
                .where({ version_id: instance.latest_approved_version_id })
                .first();
            if (lastVersion) {
                initialDraftContent = lastVersion.final_content;
            }
        }

        // 7. Insert approval_cycles
        const [cycleId] = await trx('wf_approval_cycles').insert({
            instance_id: instanceId,
            document_id: instance.document_id,
            version_number: nextVersion,
            status: 'drafting',
            current_level: 0,
            current_holder_id: userId,
            draft_content: initialDraftContent,
            initiated_by: userId
        });

        // 7.5 Copy/clone existing contents to the new cycle so drafting starts with the current data
        await cloneContentToNewCycle(trx, instanceId, cycleId, instance.latest_approved_version_id, instance.project_id);

        // 8. Update instance lock
        await trx('wf_document_instances')
            .where({ instance_id: instanceId })
            .update({
                is_locked: 1,
                locked_by: userId,
                locked_at: new Date()
            });

        // 9. Insert log
        await trx('wf_approval_logs').insert({
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
    const instance = await db('wf_document_instances')
        .where({ instance_id: instanceId, org_id: orgId })
        .first();

    if (!instance) throw new AppError('Instance not found', 404);

    return await db('wf_approval_cycles as approval_cycles')
        .select('approval_cycles.*', 'users.user_name as initiator_name')
        .leftJoin('iam_users as users', 'approval_cycles.initiated_by', 'users.user_id')
        .where('approval_cycles.instance_id', instanceId)
        .orderBy('approval_cycles.version_number', 'desc');
}

export async function getCycleDetail(orgId, cycleId) {
    const cycle = await db('wf_approval_cycles as approval_cycles')
        .select(
            'approval_cycles.*',
            'users.user_name as current_holder_name',
            'initiator.user_name as initiator_name',
            'document_instances.org_id'
        )
        .leftJoin('iam_users as users', 'approval_cycles.current_holder_id', 'users.user_id')
        .leftJoin('iam_users as initiator', 'approval_cycles.initiated_by', 'initiator.user_id')
        .leftJoin('wf_document_instances as document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
        .where('approval_cycles.cycle_id', cycleId)
        .first();

    if (!cycle || cycle.org_id !== orgId) {
        throw new AppError('Cycle not found', 404);
    }

    const submissions = await db('wf_cycle_submissions as cycle_submissions')
        .select('cycle_submissions.*', 'users.user_name as submitter_name')
        .leftJoin('iam_users as users', 'cycle_submissions.submitted_by', 'users.user_id')
        .where('cycle_submissions.cycle_id', cycleId)
        .orderBy('cycle_submissions.level_order', 'asc');

    return {
        ...cycle,
        submissions
    };
}

export async function saveDraft(orgId, cycleId, userId, content) {
    const cycle = await db('wf_approval_cycles as approval_cycles')
        .join('wf_document_instances as document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
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
    await db('wf_approval_cycles')
        .where({ cycle_id: cycleId })
        .update({
            draft_content: content ? (typeof content === 'string' ? content : JSON.stringify(content)) : null,
            last_draft_saved: now
        });

    // Check last log to prevent logs flooding
    const lastLog = await db('wf_approval_logs')
        .where({ cycle_id: cycleId, action: 'draft_saved' })
        .orderBy('acted_at', 'desc')
        .first();

    if (!lastLog || (now - new Date(lastLog.acted_at)) > 60000) {
        await db('wf_approval_logs').insert({
            cycle_id: cycleId,
            action: 'draft_saved',
            level_order: cycle.current_level,
            acted_by: userId
        });
    }

    return now;
}

async function finalizeApproval(trx, cycle, document, userId, comments) {
    // 1. Create a version in wf_document_versions
    const [versionId] = await trx('wf_document_versions').insert({
        instance_id: cycle.instance_id,
        cycle_id: cycle.cycle_id,
        version_number: cycle.version_number,
        final_content: cycle.draft_content,
        final_approved_by: userId,
        approved_at: new Date()
    });

    // 2. Set cycle status to approved
    await trx('wf_approval_cycles')
        .where({ cycle_id: cycle.cycle_id })
        .update({
            status: 'approved',
            completed_at: new Date(),
            current_holder_id: null
        });

    // 3. Unlock document instance
    await trx('wf_document_instances')
        .where({ instance_id: cycle.instance_id })
        .update({
            latest_approved_version_id: versionId,
            is_locked: 0,
            locked_by: null,
            locked_at: null
        });

    // 3.5 Update version_id on content tables
    for (const tableConf of CONTENT_TABLES) {
        await trx(tableConf.name)
            .where({ cycle_id: cycle.cycle_id })
            .whereNull('version_id')
            .update({ version_id: versionId });
    }

    // 4. Log the approval action
    await trx('wf_approval_logs').insert({
        cycle_id: cycle.cycle_id,
        action: 'approved',
        level_order: cycle.current_level,
        acted_by: userId,
        comments: comments || 'Document version approved and published.'
    });

    // 4.5 Fetch approved generic document lines and trigger pluggable business hooks
    const approvedLines = await trx('wf_document_lines').where({ cycle_id: cycle.cycle_id });

    if (document.publishing_config) {
        const config = typeof document.publishing_config === 'string'
            ? JSON.parse(document.publishing_config)
            : document.publishing_config;

        const actions = config.business_actions || (config.business_action ? [config.business_action] : []);
        for (const actionName of actions) {
            await triggerApprovalHooks(actionName, { trx, cycle, document, userId, versionId, approvedLines });
        }
    }

    // 5. Dynamic Publishing based on publishing_config column
    if (document.publishing_config) {
        const config = typeof document.publishing_config === 'string'
            ? JSON.parse(document.publishing_config)
            : document.publishing_config;

        const draft = cycle.draft_content
            ? (typeof cycle.draft_content === 'string' ? JSON.parse(cycle.draft_content) : cycle.draft_content)
            : {};

        if (config.target_type === 'singleton') {
            const updatePayload = {};
            for (const [draftKey, dbCol] of Object.entries(config.mapping || {})) {
                if (draft[draftKey] !== undefined) {
                    updatePayload[dbCol] = typeof draft[draftKey] === 'object'
                        ? JSON.stringify(draft[draftKey])
                        : draft[draftKey];
                }
            }
            if (Object.keys(updatePayload).length > 0) {
                const keyCol = config.key_column || 'id';
                const keySrc = config.key_source || 'project_id';
                await trx(config.target_table)
                    .where({ [keyCol]: cycle[keySrc] })
                    .update(updatePayload);
            }

            // Sync relations if configured
            if (Array.isArray(config.relations)) {
                for (const rel of config.relations) {
                    const keySrc = config.key_source || 'project_id';
                    const parentVal = cycle[keySrc];

                    if (rel.type === '1:N' && Array.isArray(draft[rel.source_array])) {
                        // Delete old rows
                        await trx(rel.target_table).where({ [rel.parent_key]: parentVal }).del();

                        // Insert new rows mapped dynamically
                        const recordsToInsert = draft[rel.source_array].map(item => {
                            const record = { [rel.parent_key]: parentVal };
                            for (const [draftKey, dbCol] of Object.entries(rel.mapping || {})) {
                                if (item[draftKey] !== undefined) {
                                    record[dbCol] = item[draftKey];
                                }
                            }
                            return record;
                        });
                        if (recordsToInsert.length > 0) {
                            await trx(rel.target_table).insert(recordsToInsert);
                        }
                    } else if (rel.type === 'N:M' && Array.isArray(draft[rel.source_array])) {
                        await trx(rel.target_table).where({ [rel.parent_key]: parentVal }).del();

                        const relationRecords = draft[rel.source_array].map(childVal => ({
                            [rel.parent_key]: parentVal,
                            [rel.child_key]: childVal
                        }));
                        if (relationRecords.length > 0) {
                            await trx(rel.target_table).insert(relationRecords);
                        }
                    }
                }
            }

        } else if (config.target_type === 'episodic') {
            const insertPayload = {};
            for (const [draftKey, dbCol] of Object.entries(config.mapping || {})) {
                if (draft[draftKey] !== undefined) {
                    insertPayload[dbCol] = typeof draft[draftKey] === 'object'
                        ? JSON.stringify(draft[draftKey])
                        : draft[draftKey];
                } else if (draftKey === 'project_id') {
                    insertPayload[dbCol] = cycle.project_id;
                }
            }
            await trx(config.target_table).insert(insertPayload);
        }
    }

    return {
        status: 'approved',
        current_level: cycle.current_level,
        current_holder_id: null,
        version_id: versionId
    };
}

export async function submitDraft(orgId, cycleId, userId, { changes_summary, comments }) {
    return await db.transaction(async (trx) => {
        // Fetch cycle along with instance mapping details
        const cycle = await trx('wf_approval_cycles as approval_cycles')
            .join('wf_document_instances as document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select(
                'approval_cycles.*',
                'document_instances.is_locked',
                'document_instances.project_id',
                'document_instances.document_id'
            )
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);

        if (cycle.current_holder_id !== userId) {
            throw new AppError('Only the current holder can submit', 403);
        }

        if (cycle.current_level === 0 && cycle.initiated_by !== userId) {
            throw new AppError('Only the reporter who initialized this cycle can submit it for approval', 403);
        }

        if (['approved', 'rejected', 'cancelled'].includes(cycle.status)) {
            throw new AppError('Cannot submit a closed cycle', 400);
        }

        // Fetch document template configuration
        const document = await trx('wf_documents')
            .where({ document_id: cycle.document_id })
            .first();

        if (!document) throw new AppError('Document template configuration not found', 404);

        // 1. Insert snapshot into cycle submissions
        await trx('wf_cycle_submissions').insert({
            cycle_id: cycleId,
            level_order: cycle.current_level,
            submitted_by: userId,
            content_snapshot: cycle.draft_content,
            changes_summary: changes_summary || null
        });

        // 2. Check if the document configuration bypasses approvals dynamically
        if (document.requires_approval === 0) {
            console.log("Auto-approving document template as requires_approval = 0");
            return await finalizeApproval(trx, cycle, document, userId, comments);
        }

        // 3. Find next approver
        const approvers = await trx('wf_document_roles as document_roles')
            .join('wf_approval_levels as approval_levels', 'document_roles.level_id', 'approval_levels.level_id')
            .where({
                'document_roles.document_id': cycle.document_id,
                'document_roles.role': 'approver'
            })
            .select('document_roles.id', 'document_roles.user_id', 'approval_levels.level_order')
            .orderBy([
                { column: 'approval_levels.level_order', order: 'asc' },
                { column: 'document_roles.id', order: 'asc' }
            ]);

        const approverCountsByLevel = new Map();
        approvers.forEach(approver => {
            const levelKey = String(approver.level_order);
            approverCountsByLevel.set(levelKey, (approverCountsByLevel.get(levelKey) || 0) + 1);
        });
        const duplicateLevel = Array.from(approverCountsByLevel.entries())
            .find(([, count]) => count > 1);
        if (duplicateLevel) {
            throw new AppError('Approval configuration invalid: each level can have only one approver', 400);
        }

        let currentApproverIndex = -1;
        if (cycle.current_level > 0) {
            currentApproverIndex = approvers.findIndex(approver =>
                approver.user_id === userId && approver.level_order === cycle.current_level
            );
            if (currentApproverIndex === -1) {
                throw new AppError('Current approver is not assigned to this approval chain', 403);
            }
        }

        const nextApprover = approvers[currentApproverIndex + 1];

        if (nextApprover) {
            // Forward to next approver
            await trx('wf_approval_cycles')
                .where({ cycle_id: cycleId })
                .update({
                    status: 'in_review',
                    current_level: nextApprover.level_order,
                    current_holder_id: nextApprover.user_id
                });

            await trx('wf_document_instances')
                .where({ instance_id: cycle.instance_id })
                .update({ locked_by: nextApprover.user_id });

            await trx('wf_approval_logs').insert({
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
            // No next approver: finalize approval
            return await finalizeApproval(trx, cycle, document, userId, comments);
        }
    });
}

export async function requestRevision(orgId, cycleId, userId, comments) {
    return await db.transaction(async (trx) => {
        const cycle = await trx('wf_approval_cycles as approval_cycles')
            .join('wf_document_instances as document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select('approval_cycles.*', 'document_instances.is_locked')
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);
        if (cycle.current_holder_id !== userId) throw new AppError('Only the current holder can request revision', 403);
        if (cycle.status !== 'in_review') throw new AppError('Cycle must be in_review to request revision', 400);

        await trx('wf_approval_cycles')
            .where({ cycle_id: cycleId })
            .update({
                status: 'revision_requested',
                current_level: 0,
                current_holder_id: null
            });

        await trx('wf_document_instances')
            .where({ instance_id: cycle.instance_id })
            .update({
                is_locked: 0,
                locked_by: null,
                locked_at: null
            });

        await trx('wf_approval_logs').insert({
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
        const cycle = await trx('wf_approval_cycles as approval_cycles')
            .join('wf_document_instances as document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select('approval_cycles.*')
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);
        if (cycle.current_holder_id !== userId) throw new AppError('Only the current holder can reject', 403);
        if (cycle.status !== 'in_review') throw new AppError('Cycle must be in_review to reject', 400);

        await trx('wf_approval_cycles')
            .where({ cycle_id: cycleId })
            .update({
                status: 'rejected',
                completed_at: new Date(),
                current_holder_id: null
            });

        await trx('wf_document_instances')
            .where({ instance_id: cycle.instance_id })
            .update({
                is_locked: 0,
                locked_by: null,
                locked_at: null
            });

        await trx('wf_approval_logs').insert({
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
        const cycle = await trx('wf_approval_cycles as approval_cycles')
            .join('wf_document_instances as document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select('approval_cycles.*')
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);
        if (['approved', 'rejected'].includes(cycle.status)) {
            throw new AppError('Cannot cancel an already closed cycle', 400);
        }

        const user = await trx('iam_users').where({ user_id: userId }).first();
        const isAdmin = user && user.user_type === 'admin';

        if (cycle.initiated_by !== userId && !isAdmin) {
            throw new AppError('Only the cycle initiator or an admin can cancel this cycle', 403);
        }

        await trx('wf_approval_cycles')
            .where({ cycle_id: cycleId })
            .update({
                status: 'cancelled',
                completed_at: new Date()
            });

        await trx('wf_document_instances')
            .where({ instance_id: cycle.instance_id })
            .update({
                is_locked: 0,
                locked_by: null,
                locked_at: null
            });

        await trx('wf_approval_logs').insert({
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
        const cycle = await trx('wf_approval_cycles as approval_cycles')
            .join('wf_document_instances as document_instances', 'approval_cycles.instance_id', 'document_instances.instance_id')
            .where({ 'approval_cycles.cycle_id': cycleId, 'document_instances.org_id': orgId })
            .select('approval_cycles.*')
            .first();

        if (!cycle) throw new AppError('Cycle not found', 404);
        if (cycle.status !== 'revision_requested') {
            throw new AppError('Cycle must be in revision_requested state to claim', 400);
        }

        if (cycle.initiated_by !== userId) {
            throw new AppError('Only the reporter who initialized this cycle can claim the revision', 403);
        }

        await trx('wf_approval_cycles')
            .where({ cycle_id: cycleId })
            .update({
                status: 'drafting',
                current_holder_id: userId
            });

        await trx('wf_document_instances')
            .where({ instance_id: cycle.instance_id })
            .update({
                is_locked: 1,
                locked_by: userId,
                locked_at: new Date()
            });

        await trx('wf_approval_logs').insert({
            cycle_id: cycleId,
            action: 'cycle_initiated',
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
