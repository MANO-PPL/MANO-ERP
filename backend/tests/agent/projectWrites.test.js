import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, RUNTIME_WRITE_ENABLEMENT, allowedToolsForRequest, validateIntent } from '../../src/modules/agent/agentTools.js';
import { actionFor } from '../../src/modules/agent/agentEvents.js';
import { createWriteService } from '../../src/modules/agent/agentWriteService.js';
import { createPolicy } from '../../src/modules/agent/agentPolicy.js';
import { getUploadedAttachment, stageAttachment, cleanupUpload } from '../../src/modules/agent/agentUploadService.js';
import { isAgentEvent } from '../../../frontend/src/components/Agent/agentModel.js';

const intent = (tool, arguments_) => ({ kind: 'tool', tool, version: 1, arguments: arguments_ });

test('Phase 2 project schemas and exposure stay narrow', () => {
    assert.equal(validateIntent(intent('projects.create', { name: 'Bridge' })).tool.risk, 'WRITE');
    assert.throws(() => validateIntent(intent('projects.create', { name: 'Bridge', org_id: 7 })));
    assert.throws(() => validateIntent(intent('projects.create', { name: 'Bridge', end_date: '2026-09-01', start_date: '2026-10-01' })));
    assert.throws(() => validateIntent(intent('projects.update', { projectId: 4 })));
    assert.throws(() => validateIntent(intent('projects.update', { projectId: 4, status: 'complete' })));
    const tools = allowedToolsForRequest({ route: '/', module: 'Dashboard' }, 'Create a project', RUNTIME_WRITE_ENABLEMENT);
    assert.ok(tools.includes('projects.create'));
    assert.ok(!tools.includes('clients.create'));
});

test('project writes use one caller transaction and add creator membership', async () => {
    const calls = [];
    const trx = table => ({
        insert: async row => { calls.push({ table, row }); return [13]; },
        where: () => ({ update: async row => { calls.push({ table, row }); return 1; } })
    });
    trx.isTransaction = true;
    const service = createWriteService({});
    const scope = { orgId: 5, userId: 8 };
    await assert.rejects(service.execute(TOOLS['projects.create'], { name: 'Bridge' }, scope, {}), /caller_transaction_required/);
    assert.deepEqual(await service.execute(TOOLS['projects.create'], { name: 'Bridge' }, scope, trx), { id: 13 });
    assert.equal(calls[0].row.org_id, 5);
    assert.deepEqual(calls[1].row, { project_id: 13, user_id: 8, org_id: 5, project_permissions: null });
    await service.execute(TOOLS['projects.update'], { projectId: 13, location: 'Mumbai' }, scope, trx);
    assert.deepEqual(calls[2].row, { location: 'Mumbai' });
});

test('project master-data writes are admin-only', async () => {
    const db = table => ({
        where: () => ({ first: async () => table === 'iam_users' ? { id: 8, org_id: 5, user_type: 'employee' } : { id: 13, org_id: 5 } })
    });
    const authorize = createPolicy(db);
    await assert.rejects(authorize({ userId: 8, orgId: 5 }, TOOLS['projects.create'], { name: 'Bridge' }), /authorization_denied/);
    await assert.rejects(authorize({ userId: 8, orgId: 5 }, TOOLS['projects.update'], { projectId: 13, name: 'Bridge' }), /authorization_denied/);
});

test('task contracts require bounded fields, category and an actual edit', () => {
    assert.equal(validateIntent(intent('tasks.create', { projectId: 4, categoryName: 'Planning', name: 'Survey' })).tool.risk, 'WRITE');
    assert.throws(() => validateIntent(intent('tasks.create', { projectId: 4, name: 'Survey' })));
    assert.throws(() => validateIntent(intent('tasks.create', { projectId: 4, categoryName: 'Planning', name: 'Survey', assigneeIds: [8] })));
    assert.throws(() => validateIntent(intent('tasks.update', { projectId: 4, taskId: 9 })));
    assert.throws(() => validateIntent(intent('tasks.update', { projectId: 4, taskId: 9, status: 'invented' })));
    assert.ok(allowedToolsForRequest({ route: '/projects/4/tasks', module: 'Tasks' }, 'Update this task', RUNTIME_WRITE_ENABLEMENT).includes('tasks.update'));
});

test('selected task deletion is a capped bulk destructive operation with explicit confirmation preview', () => {
    const deletion = intent('tasks.deleteSelected', { projectId: 4, taskIds: [9, 10] });
    assert.equal(validateIntent(deletion).tool.risk, 'BULK_WRITE');
    assert.ok(allowedToolsForRequest({ route: '/projects/4/tasks', module: 'Tasks' }, 'Delete these selected tasks', RUNTIME_WRITE_ENABLEMENT).includes('tasks.deleteSelected'));
    assert.throws(() => validateIntent(intent('tasks.deleteSelected', { projectId: 4, taskIds: [] })));
    assert.throws(() => validateIntent(intent('tasks.deleteSelected', { projectId: 4, taskIds: [9, 9] })));
    assert.throws(() => validateIntent(intent('tasks.deleteSelected', { projectId: 4, taskIds: Array.from({ length: 21 }, (_, i) => i + 1) })));

    const action = actionFor(TOOLS['tasks.deleteSelected'], { projectId: 4, taskIds: [9, 10] }, {
        tasks: [{ id: 9, task_code: 'T-9', name: 'Survey', projectName: 'Bridge Project' }, { id: 10, name: 'Pour slab' }],
        assignees: [{ user_name: 'Asha' }], assigneeLinksRemoved: 1, pendingApprovals: 0
    });
    assert.equal(action.riskLevel, 'DESTRUCTIVE');
    assert.equal(action.affectedRecords, 2);
    assert.match(action.description, /cannot be undone/i);
    assert.ok(action.fields.some(field => field.label === 'Selected tasks' && field.value.includes('Survey (T-9)')));
    assert.ok(action.fields.some(field => field.label === 'Assigned people' && field.value === 'Asha'));
    assert.ok(!JSON.stringify(action).includes('taskIds'));
    assert.ok(isAgentEvent({ eventId: 'preview-event', conversationId: 'conversation', requestId: 'request', type: 'confirmation_required', actionId: 'action', confirmation: { ...action, confirmationId: 'confirmation' } }));
});

test('task deletion preconditions enumerate exact tasks and refuse pending approval tasks', async () => {
    const db = table => ({
        leftJoin() { return this; }, join() { return this; }, where() { return this; }, whereIn() { return this; }, forUpdate() { return this; },
        async select() { return table === 'proj_tasks as t'
            ? [{ id: 9, name: 'Survey', status: 'open', projectName: 'Bridge Project' }]
            : [{ task_id: 9, user_id: '8', user_name: 'Asha' }]; }
    });
    const service = createWriteService({ db });
    const tool = TOOLS['tasks.deleteSelected'];
    const preconditions = await service.preconditions(tool, { projectId: 4, taskIds: [9] }, { orgId: 5 });
    assert.equal(preconditions.tasks[0].name, 'Survey');
    assert.equal(preconditions.assigneeLinksRemoved, 1);

    const pendingDb = table => ({
        leftJoin() { return this; }, join() { return this; }, where() { return this; }, whereIn() { return this; },
        async select() { return table === 'proj_tasks as t' ? [{ id: 9, name: 'Review task', status: 'in_review' }] : []; }
    });
    await assert.rejects(createWriteService({ db: pendingDb }).preconditions(tool,
        { projectId: 4, taskIds: [9] }, { orgId: 5 }), /task_pending_approval_cannot_be_deleted/);
});

test('selected task deletion executes only in the caller transaction and removes selected assignment links', async () => {
    const calls = [];
    const trx = table => ({ whereIn() { return this; }, where() { return this; }, async del() {
        calls.push(table);
        return table === 'proj_task_assignees' ? 2 : 2;
    } });
    trx.isTransaction = true;
    const service = createWriteService({});
    await assert.rejects(service.execute(TOOLS['tasks.deleteSelected'], { projectId: 4, taskIds: [10, 9] }, {}, {}), /caller_transaction_required/);
    assert.deepEqual(await service.execute(TOOLS['tasks.deleteSelected'], { projectId: 4, taskIds: [10, 9] }, {}, trx),
        { id: 4, deletedCount: 2, assigneeLinksRemoved: 2 });
    assert.deepEqual(calls, ['proj_task_assignees', 'proj_tasks']);
});

test('remaining Phase 2 contracts stay bounded and confirmation-capable', () => {
    for (const [tool, args] of [
        ['projectParties.add', { projectId: 4, contactId: 8 }],
        ['projectParties.update', { projectId: 4, projectPartyId: 8, email: 'party@example.com' }],
        ['projects.assignMember', { projectId: 4, userId: 8 }],
        ['tasks.assign', { projectId: 4, taskId: 9, assigneeIds: [8] }],
        ['tasks.createCategory', { projectId: 4, name: 'Planning' }],
        ['tasks.reorder', { projectId: 4, type: 'task', items: [{ id: 9, sortOrder: 10 }] }],
        ['meetings.create', { projectId: 4, subject: 'Kickoff', agendaPoints: ['Review scope'] }],
        ['directory.create', { projectId: 4, contact_person: 'Asha' }],
        ['summaries.create', { projectId: 4, title: 'Status', details: 'Mobilization started' }],
        ['documents.saveDraft', { projectId: 4, cycleId: 8, content: { title: 'Inspection draft' } }],
        ['documents.submitDraft', { projectId: 4, cycleId: 8, comments: 'Ready for review' }],
        ['qualityObservations.create', { projectId: 4, location: 'Level 2', note: 'Crack observed' }],
        ['qualityObservations.submitFix', { projectId: 4, observationId: 8, uploadId: '123e4567-e89b-12d3-a456-426614174000' }],
        ['qualityMethodologies.create', { projectId: 4, title: 'Concrete method', uploadId: '123e4567-e89b-12d3-a456-426614174000' }],
        ['qualityChecklists.update', { projectId: 4, documentId: 8, title: 'Updated checklist', uploadId: '123e4567-e89b-12d3-a456-426614174000' }]
    ]) assert.equal(validateIntent(intent(tool, args)).tool.risk, 'WRITE');
    assert.throws(() => validateIntent(intent('tasks.reorder', { projectId: 4, type: 'task', items: [{ id: 9, sortOrder: 10 }, { id: 9, sortOrder: 20 }] })));
    assert.throws(() => validateIntent(intent('meetings.update', { projectId: 4, meetingId: 2 })));
    assert.throws(() => validateIntent(intent('qualityObservations.update', { projectId: 4, observationId: 2 })));
    assert.throws(() => validateIntent(intent('projects.assignMember', { projectId: 4, userId: 8, permissions: { Tasks: 'admin' } })));
    assert.throws(() => validateIntent(intent('documents.saveDraft', { projectId: 4, cycleId: 8, content: ['not an object'] })));
    assert.throws(() => validateIntent(intent('qualityMethodologies.update', { projectId: 4, documentId: 8, title: 'No attachment' })));
});

test('project party preview names the verified contact and category without exposing its ID', () => {
    const action = actionFor(TOOLS['projectParties.add'], { projectId: 85, contactId: 42 },
        { contact: { id: 42, name: 'Example Contractor', category: 'Contractor' } });
    assert.equal(action.title, 'Add project party');
    assert.deepEqual(action.fields, [
        { label: 'Contact', value: 'Example Contractor' },
        { label: 'Category', value: 'Contractor' },
    ]);
    assert.ok(!JSON.stringify(action).includes('42'));
});

test('task assignment preview names the verified task and members without exposing IDs', () => {
    const action = actionFor(TOOLS['tasks.assign'], { projectId: 85, taskId: 90, assigneeIds: [3] },
        { task: { id: 90, name: 'Phase 2 QA Task' }, members: [{ id: 3, name: 'Mano Manager' }] });
    assert.deepEqual(action.fields, [
        { label: 'Task', value: 'Phase 2 QA Task' },
        { label: 'Members', value: 'Mano Manager' },
    ]);
    assert.ok(!JSON.stringify(action).includes('assigneeIds'));
    assert.ok(!JSON.stringify(action).includes('taskId'));
});

test('task and project-party lookups remain labeled READ in the activity card', () => {
    assert.equal(actionFor(TOOLS['tasks.search'], { limit: 50 }).riskLevel, 'READ');
    assert.equal(actionFor(TOOLS['projectParties.list'], { projectId: 85 }).riskLevel, 'READ');
});

test('admin and document-template lookups stay READ and never appear as write previews', () => {
    for (const [toolName, args] of [
        ['adminUsers.search', { query: 'Mano', limit: 5 }],
        ['permissionTemplates.search', { query: 'Read only', limit: 5 }],
        ['documentTemplates.search', { projectId: 75, query: 'Project Summary', limit: 5 }],
    ]) {
        const action = actionFor(TOOLS[toolName], args);
        assert.equal(action.riskLevel, 'READ', `${toolName} should remain a read-only card`);
        assert.equal(action.confirmationPhrase, undefined, `${toolName} should not require confirmation`);
        assert.equal(action.title, toolName, `${toolName} should not be described as a mutation`);
        assert.deepEqual(action.fields, Object.entries(args).map(([label, value]) => ({ label, value })));
    }
});

test('write proposal events serialize structured arguments into UI-safe field values', () => {
    for (const [toolName, args] of [
        ['meetings.create', { projectId: 4, subject: 'Work progress', agendaPoints: ['Review progress', 'Confirm blockers'] }],
        ['tasks.reorder', { projectId: 4, type: 'task', items: [{ id: 9, sortOrder: 10 }] }],
        ['documents.saveDraft', { projectId: 4, cycleId: 8, content: { title: 'Inspection draft' } }],
    ]) {
        const tool = TOOLS[toolName];
        const action = actionFor(tool, args);
        const event = {
            eventId: 'fixture-event',
            conversationId: 'fixture-conversation',
            requestId: 'fixture-request',
            type: 'tool_proposed',
            actionId: 'fixture-action',
            action,
        };
        assert.ok(isAgentEvent(event), `${toolName} proposal should satisfy the UI event contract`);
        assert.ok(action.fields.every(field => typeof field.value === 'string' || typeof field.value === 'number'));
    }
});

test('explicit Phase 2 prompts expose their intended write operation', () => {
    const context = { route: '/projects/4', module: 'Projects' };
    for (const [message, expected] of [
        ['Add a party to this project', 'projectParties.add'],
        ['Assign a member to this project', 'projects.assignMember'],
        ['Assign a user to this task', 'tasks.assign'],
        ['Create a task category for this project', 'tasks.createCategory'],
        ['Reorder the tasks for this project', 'tasks.reorder'],
        ['Create a meeting for this project', 'meetings.create'],
        ['Create a directory entry for this project', 'directory.create'],
        ['Create a project summary', 'summaries.create'],
        ['Save a document draft for this project', 'documents.saveDraft'],
        ['Create a quality observation for this project', 'qualityObservations.create'],
        ['Submit a corrective fix for this project', 'qualityObservations.submitFix'],
        ['Create a quality methodology for this project', 'qualityMethodologies.create'],
        ['Create a quality checklist for this project', 'qualityChecklists.create'],
    ]) {
        const exposed = allowedToolsForRequest(context, message, RUNTIME_WRITE_ENABLEMENT);
        assert.ok(exposed.includes(expected), `${message} should expose ${expected}`);
        assert.ok(exposed.length <= 50, `${message} must obey the Python tool limit`);
    }
});

test('quality attachments are server-staged, organization-bound, and explicitly approved', async () => {
    const approved = stageAttachment(Buffer.from('image-data'), 'fix.png', 'image/png', 5, true);
    const unapproved = stageAttachment(Buffer.from('document'), 'method.pdf', 'application/pdf', 5, false);
    try {
        assert.equal(getUploadedAttachment(approved.uploadId, 5).approvedForAgentWrite, true);
        assert.throws(() => getUploadedAttachment(approved.uploadId, 6), /upload_org_mismatch/);
        const service = createWriteService({ db: () => { throw Error('database should not be queried'); } });
        await assert.rejects(service.preconditions(TOOLS['qualityMethodologies.create'],
            { projectId: 4, title: 'Method', uploadId: unapproved.uploadId }, { orgId: 5 }), /approved_attachment_required/);
    } finally {
        cleanupUpload(approved.uploadId);
        cleanupUpload(unapproved.uploadId);
    }
});

test('project-member assignment is admin-only and does not accept permissions', async () => {
    const db = table => ({ where: () => ({ first: async () => {
        if (table === 'iam_users') return { id: 8, org_id: 5, user_type: 'employee' };
        return { id: 4, org_id: 5 };
    } }) });
    await assert.rejects(createPolicy(db)({ userId: 8, orgId: 5 }, TOOLS['projects.assignMember'], { projectId: 4, userId: 9 }), /authorization_denied/);
});

test('restricted project-member assignment uses the caller transaction and default permissions only', async () => {
    const rows = [];
    const trx = table => ({ insert: async row => { rows.push({ table, row }); return [17]; } });
    trx.isTransaction = true;
    const result = await createWriteService({}).execute(TOOLS['projects.assignMember'], { projectId: 4, userId: 9 }, { orgId: 5 }, trx);
    assert.deepEqual(result, { id: 17 });
    assert.deepEqual(rows, [{ table: 'proj_members', row: { project_id: 4, user_id: 9, org_id: 5, project_permissions: null } }]);
});

test('task writes check membership and Tasks edit permission', async () => {
    const db = table => ({ where: () => ({ first: async () => {
        if (table === 'iam_users') return { id: 8, org_id: 5, user_type: 'employee' };
        if (table === 'proj_projects') return { id: 4, org_id: 5 };
        if (table === 'proj_members') return { project_id: 4, user_id: 8, org_id: 5, project_permissions: JSON.stringify({ Tasks: 'view' }) };
        if (table === 'proj_tasks') return { id: 9, project_id: 4 };
    } }) });
    const authorize = createPolicy(db);
    await assert.rejects(authorize({ userId: 8, orgId: 5 }, TOOLS['tasks.create'], { projectId: 4, categoryName: 'Planning', name: 'Survey' }), /authorization_denied/);
    await assert.rejects(authorize({ userId: 8, orgId: 5 }, TOOLS['tasks.update'], { projectId: 4, taskId: 9, name: 'Survey' }), /authorization_denied/);
});

test('task create resolves an existing category and writes inside caller transaction', async () => {
    const calls = [];
    const trx = table => ({
        where: () => ({
            whereRaw() { return this; },
            orderBy() { return this; },
            async first(field) {
                if (table === 'proj_task_categories') return { id: 7 };
                if (field === 'id') return { id: 40 };
                return { sort_order: 20 };
            }
        }),
        insert: async row => { calls.push({ table, row }); return [41]; }
    });
    trx.isTransaction = true;
    const service = createWriteService({});
    const result = await service.execute(TOOLS['tasks.create'], { projectId: 4, categoryName: 'Planning', name: 'Survey' }, { orgId: 5, userId: 8 }, trx);
    assert.deepEqual(result, { id: 41 });
    assert.equal(calls[0].row.project_id, 4);
    assert.equal(calls[0].row.category_id, 7);
    assert.equal(calls[0].row.task_code, 'T-41');
    assert.equal(calls[0].row.sort_order, 30);
});

test('task preview rejects a missing category before confirmation', async () => {
    const db = table => ({ where: () => ({
        whereRaw() { return this; },
        limit() { return this; },
        async select() { return table === 'proj_task_categories' ? [] : [{ id: 1 }]; }
    }) });
    const service = createWriteService({ db });
    await assert.rejects(service.preconditions(TOOLS['tasks.create'],
        { projectId: 4, categoryName: 'Unknown', name: 'Survey' }, { orgId: 5 }), /task_category_not_unique_or_missing/);
});

test('project update preview binds the current row and rejects conflicting dates', async () => {
    const db = table => ({ where: () => ({
        first: async () => table === 'proj_projects' ? { id: 4, name: 'Bridge', start_date: '2026-10-01', end_date: null } : null
    }) });
    const service = createWriteService({ db });
    await assert.rejects(service.preconditions(TOOLS['projects.update'],
        { projectId: 4, end_date: '2026-09-30' }, { orgId: 5 }), /invalid_project_dates/);
});
