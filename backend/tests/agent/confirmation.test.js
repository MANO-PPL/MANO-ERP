import test from 'node:test';
import assert from 'node:assert/strict';
import { actor, body, harness, intent } from './fixtures.js';
import { actionFor } from '../../src/modules/agent/agentEvents.js';
import { PROJECT_PERMISSION_KEYS, SYSTEM_PERMISSION_KEYS, TOOLS } from '../../src/modules/agent/agentTools.js';

test('missing write details continue into a real confirmation preview without executing', async () => {
    const seen = [];
    const h = harness({ writeEnablement: { 'clients.create': true }, reason: async request => {
        seen.push(request);
        return seen.length === 1
            ? { kind: 'assistant', text: "What is the client's name? Please provide it so I can prepare the preview.", sources: [] }
            : intent('clients.create', { name: 'North Star Client' });
    } });
    const first = { ...body('Create a client'), context: { route: '/clients', module: 'Clients' } };
    const asked = await h.submit(first);
    assert.equal(asked.events.some(event => event.type === 'confirmation_required'), false);
    const proposed = await h.submit({ ...first, message: 'North Star Client' });
    assert.match(seen[1].message, /Create a client/);
    assert.match(seen[1].message, /North Star Client/);
    assert.ok(seen[1].allowedTools.includes('clients.create'));
    const card = proposed.events.find(event => event.type === 'confirmation_required')?.confirmation;
    assert.equal(card?.title, 'Create client');
    assert.deepEqual(card?.fields.find(field => field.label === 'name'), { label: 'name', value: 'North Star Client' });
    assert.equal(h.attempts, 0);
});

test('clarification retains details across multiple replies and a new request does not inherit them', async () => {
    const seen = [];
    const h = harness({ writeEnablement: { 'tasks.create': true, 'clients.create': true }, reason: async request => {
        seen.push(request);
        if (seen.length === 1) return { kind: 'assistant', text: 'Which task name should I use?', sources: [] };
        if (seen.length === 2) return { kind: 'assistant', text: 'Which existing category should I use?', sources: [] };
        return { kind: 'assistant', text: 'No changes were made.', sources: [] };
    } });
    const initial = { ...body('Create a task for this project'), context: { route: '/projects/4/tasks', module: 'Tasks', projectId: '4' } };
    await h.submit(initial);
    await h.submit({ ...initial, message: 'Task name: Inspect north wall' });
    await h.submit({ ...initial, message: 'Category: Site Works' });
    assert.match(seen[2].message, /Create a task for this project/);
    assert.match(seen[2].message, /Inspect north wall/);
    assert.match(seen[2].message, /Site Works/);
    await h.submit({ ...initial, message: 'Show clients' });
    assert.equal(seen[3].message, 'Show clients');
    assert.equal(h.attempts, 0);
});

test('declining a conversational write clarification makes no provider call or ERP write', async () => {
    let calls = 0;
    const h = harness({ writeEnablement: { 'clients.create': true }, reason: async () => {
        calls++;
        return { kind: 'assistant', text: 'Would you like me to proceed?', sources: [] };
    } });
    const first = { ...body('Create a client named North Star Client'), context: { route: '/clients', module: 'Clients' } };
    await h.submit(first);
    const declined = await h.submit({ ...first, message: 'no' });
    assert.equal(calls, 1);
    assert.equal(declined.events.some(event => event.type === 'confirmation_required'), false);
    assert.match(declined.events.find(event => event.type === 'text_completed')?.text || '', /will not proceed/);
    assert.equal(h.attempts, 0);
});

test('yes after a conversational proceed question can reach a card but is not execution confirmation', async () => {
    const seen = [];
    const h = harness({ writeEnablement: { 'clients.create': true }, reason: async request => {
        seen.push(request);
        return seen.length === 1
            ? { kind: 'assistant', text: 'Would you like me to proceed?', sources: [] }
            : intent('clients.create', { name: 'North Star Client' });
    } });
    const first = { ...body('Create a client named North Star Client'), context: { route: '/clients', module: 'Clients' } };
    await h.submit(first);
    const proposed = await h.submit({ ...first, message: 'yes' });
    assert.match(seen[1].message, /Create a client named North Star Client/);
    assert.ok(proposed.events.find(event => event.type === 'confirmation_required'));
    assert.equal(h.attempts, 0);
});

test('admin previews use operation-specific create and update labels', () => {
    const created = actionFor(TOOLS['documentTemplates.create'], {
        projectId: 85, name: 'Phase 3 QA Template Preview Only', docType: 'episodic',
        description: 'Preview only'
    });
    assert.equal(created.title, 'Create document template');
    assert.match(created.description, /creation of document template/);

    const updated = actionFor(TOOLS['documentTemplates.update'], {
        projectId: 85, documentId: 12, expectedName: 'Existing Template', name: 'Renamed Template'
    }, { template: { name: 'Existing Template', doc_type: 'singleton', description: 'Current' } });
    assert.equal(updated.title, 'Update document template');
    assert.match(updated.description, /update to document template "Existing Template"/);
    assert.deepEqual([created.confirmationPhrase, updated.confirmationPhrase],
        ['CONFIRM ADMIN CHANGE', 'CONFIRM ADMIN CHANGE']);
});

test('organization metadata previews name the specific setting operation', () => {
    const department = actionFor(TOOLS['adminDepartments.create'], { name: 'QA Department' });
    const designation = actionFor(TOOLS['adminDesignations.create'], { name: 'QA Designation' });
    assert.equal(department.title, 'Create department');
    assert.match(department.description, /creation of department "QA Department"/);
    assert.equal(designation.title, 'Create designation');
    assert.match(designation.description, /creation of designation "QA Designation"/);
});

test('permission-template rename preview makes clear permissions stay unchanged', () => {
    const renamed = actionFor(TOOLS['permissionTemplates.update'], {
        templateId: 5, type: 'system', expectedName: 'Test', name: 'Phase 3 QA Permission Template Preview Only'
    }, { template: { name: 'Test', type: 'system', permissions: { admin: 2 } } });
    assert.equal(renamed.title, 'Rename permission template');
    assert.match(renamed.description, /permissions will remain unchanged/);
    assert.deepEqual(renamed.fields, [
        { label: 'Target', value: 'Test' },
        { label: 'Template type', value: 'system' },
        { label: 'New template name', value: 'Phase 3 QA Permission Template Preview Only' },
        { label: 'Permissions', value: 'Unchanged' }
    ]);
    assert.equal(renamed.confirmationPhrase, 'CONFIRM ADMIN CHANGE');

    const permissions = Object.fromEntries(SYSTEM_PERMISSION_KEYS.map(key => [key, 0]));
    const changed = actionFor(TOOLS['permissionTemplates.update'], {
        templateId: 5, type: 'system', expectedName: 'Test', permissions
    }, { template: { name: 'Test', type: 'system', permissions: { admin: 2, dashboard: 2 } },
        requestedPermissions: { ...permissions, dashboard: 2 } });
    assert.equal(changed.title, 'Update permission template permissions');
    assert.equal(changed.confirmationPhrase, 'CONFIRM ACCESS CHANGE');
    const requested = JSON.parse(changed.fields.find(field => field.label === 'Requested permissions').value);
    assert.equal(requested.dashboard, 2);
    assert.equal(requested.spreadsheets, 0);

    const created = actionFor(TOOLS['permissionTemplates.create'], {
        name: 'QA Read Only', type: 'system', permissions
    });
    assert.equal(created.title, 'Create permission template');
    assert.match(created.description, /creation of permission template "QA Read Only"/);
    assert.equal(created.confirmationPhrase, 'CONFIRM ACCESS CHANGE');
});

test('permission-template rename requires the admin phrase while permission edits require the access phrase', async () => {
    const requestBody = { ...body('Rename the Test permission template to Phase 3 QA Preview Only'),
        context: { route: '/admin/permission-templates', module: 'Admin' } };
    const h = harness({ writeEnablement: { 'permissionTemplates.update': true },
        responses: [intent('permissionTemplates.update', {
            templateId: 5, type: 'system', expectedName: 'Test', name: 'Phase 3 QA Preview Only'
        })],
        preconditions: () => ({ template: { name: 'Test', type: 'system', permissions: { admin: 2 } } }) });
    const proposed = await h.submit(requestBody);
    const confirmation = proposed.events.find(event => event.type === 'confirmation_required')?.confirmation;
    assert.equal(confirmation?.confirmationPhrase, 'CONFIRM ADMIN CHANGE');
    await assert.rejects(h.service.decide(actor, { confirmationId: confirmation.confirmationId,
        decision: 'confirm', confirmationText: 'CONFIRM ACCESS CHANGE' }, requestBody.conversationId), /typed_confirmation_mismatch/);
    assert.equal(h.attempts, 0);
    await h.service.decide(actor, { confirmationId: confirmation.confirmationId,
        decision: 'confirm', confirmationText: 'CONFIRM ADMIN CHANGE' }, requestBody.conversationId);
    assert.equal(h.attempts, 1);
});

test('permission-template permission updates require typed access confirmation', async () => {
    const permissions = Object.fromEntries(SYSTEM_PERMISSION_KEYS.map(key => [key, 0]));
    const requestBody = { ...body('Set all system permissions on the Test template to no access'),
        context: { route: '/admin/permission-templates', module: 'Admin' } };
    const h = harness({ writeEnablement: { 'permissionTemplates.update': true },
        responses: [intent('permissionTemplates.update', {
            templateId: 5, type: 'system', expectedName: 'Test', permissions
        })],
        preconditions: () => ({ template: { name: 'Test', type: 'system', permissions: { admin: 2 } } }) });
    const proposed = await h.submit(requestBody);
    const confirmation = proposed.events.find(event => event.type === 'confirmation_required')?.confirmation;
    assert.equal(confirmation?.title, 'Update permission template permissions');
    assert.equal(confirmation?.confirmationPhrase, 'CONFIRM ACCESS CHANGE');
    await assert.rejects(h.service.decide(actor, { confirmationId: confirmation.confirmationId,
        decision: 'confirm', confirmationText: 'CONFIRM ADMIN CHANGE' }, requestBody.conversationId), /typed_confirmation_mismatch/);
    assert.equal(h.attempts, 0);
});

test('S08 writes are gated live; test-enabled proposals still require confirmation', async () => {
    const live = harness(); const rejected = await live.propose(); assert.equal(rejected.confirmation, undefined); assert.equal(live.attempts, 0);
    const h = harness({ enableWrites: true }); const p = await h.propose(); assert.ok(p.confirmation); assert.equal(h.store.state.business.length, 0);
});
test('selected bulk task deletion has no effect until the explicit confirmation decision', async () => {
    const h = harness({ enableWrites: true, writeEnablement: { 'tasks.deleteSelected': true },
        responses: [intent('tasks.deleteSelected', { projectId: 4, taskIds: [9, 10] })],
        preconditions: (tool, args) => ({ tasks: args.taskIds.map(id => ({ id, name: `Task ${id}` })) }) });
    const requestBody = { ...body('Delete these selected tasks from this project'),
        context: { route: '/projects/4/tasks', module: 'Tasks', projectId: '4' } };
    const proposed = await h.submit(requestBody);
    const confirmation = proposed.events.find(event => event.type === 'confirmation_required')?.confirmation;
    assert.ok(confirmation);
    assert.equal(confirmation.riskLevel, 'DESTRUCTIVE');
    assert.equal(confirmation.confirmationPhrase, 'DELETE 2 TASKS');
    assert.equal(h.attempts, 0);
    await h.decide(confirmation.confirmationId, 'cancel');
    assert.equal(h.attempts, 0);
});
test('selected task deletion rejects missing or incorrect typed confirmation and accepts the exact phrase', async () => {
    const h = harness({ enableWrites: true, writeEnablement: { 'tasks.deleteSelected': true },
        responses: [intent('tasks.deleteSelected', { projectId: 4, taskIds: [9, 10] })],
        preconditions: (tool, args) => ({ tasks: args.taskIds.map(id => ({ id, name: `Task ${id}` })) }) });
    const requestBody = { ...body('Delete these selected tasks from this project'),
        context: { route: '/projects/4/tasks', module: 'Tasks', projectId: '4' } };
    const proposed = await h.submit(requestBody);
    const confirmationId = proposed.events.find(event => event.type === 'confirmation_required').confirmation.confirmationId;
    for (const confirmationText of [undefined, 'DELETE ALL TASKS']) {
        await assert.rejects(h.service.decide(actor, { confirmationId, decision: 'confirm', ...(confirmationText ? { confirmationText } : {}) }, requestBody.conversationId), /typed_confirmation_mismatch/);
        assert.equal(h.attempts, 0);
    }
    await h.service.decide(actor, { confirmationId, decision: 'confirm', confirmationText: 'DELETE 2 TASKS' }, requestBody.conversationId);
    assert.equal(h.attempts, 1);
});
test('document-cycle cancellation requires its exact typed confirmation before execution', async () => {
    const h = harness({ writeEnablement: { 'documents.cancelCycle': true },
        responses: [intent('documents.cancelCycle', { projectId: 4, cycleId: 12, comments: 'Test cancellation' })] });
    const requestBody = { ...body('Cancel this document cycle'),
        context: { route: '/projects/4/documents', module: 'General Documents', projectId: '4' } };
    const proposed = await h.submit(requestBody);
    const confirmation = proposed.events.find(event => event.type === 'confirmation_required')?.confirmation;
    assert.equal(confirmation?.confirmationPhrase, 'CANCEL DOCUMENT CYCLE');
    for (const confirmationText of [undefined, 'CANCEL CYCLE']) {
        await assert.rejects(h.service.decide(actor, { confirmationId: confirmation.confirmationId, decision: 'confirm', ...(confirmationText ? { confirmationText } : {}) }, requestBody.conversationId), /typed_confirmation_mismatch/);
        assert.equal(h.attempts, 0);
    }
    const events = await h.service.decide(actor, { confirmationId: confirmation.confirmationId, decision: 'confirm', confirmationText: 'CANCEL DOCUMENT CYCLE' }, requestBody.conversationId);
    assert.equal(h.attempts, 1);
    assert.equal(events.find(event => event.type === 'tool_completed').result.text, 'Document cycle cancelled successfully.');
});
test('document archive requires typed confirmation before any ERP write', async () => {
    const h = harness({ writeEnablement: { 'documents.archiveInstance': true },
        responses: [intent('documents.archiveInstance', { projectId: 4, instanceId: 12 })] });
    const requestBody = { ...body('Archive this document'),
        context: { route: '/projects/4/documents', module: 'General Documents', projectId: '4' } };
    const proposed = await h.submit(requestBody);
    const confirmation = proposed.events.find(event => event.type === 'confirmation_required')?.confirmation;
    assert.equal(confirmation?.confirmationPhrase, 'ARCHIVE DOCUMENT');
    await assert.rejects(h.service.decide(actor, { confirmationId: confirmation.confirmationId,
        decision: 'confirm', confirmationText: 'ARCHIVE' }, requestBody.conversationId), /typed_confirmation_mismatch/);
    assert.equal(h.attempts, 0);
});
test('administrator setting changes require typed confirmation', async () => {
    const h = harness({ writeEnablement: { 'adminDepartments.create': true },
        responses: [intent('adminDepartments.create', { name: 'Civil Engineering' })] });
    const requestBody = { ...body('Create the Civil Engineering department'),
        context: { route: '/admin/departments', module: 'Admin' } };
    const proposed = await h.submit(requestBody);
    const confirmation = proposed.events.find(event => event.type === 'confirmation_required')?.confirmation;
    assert.equal(confirmation?.confirmationPhrase, 'CONFIRM ADMIN CHANGE');
    await assert.rejects(h.service.decide(actor, { confirmationId: confirmation.confirmationId,
        decision: 'confirm' }, requestBody.conversationId), /typed_confirmation_mismatch/);
    assert.equal(h.attempts, 0);
});
test('project member permissions require explicit typed access confirmation', async () => {
    const permissions = Object.fromEntries(PROJECT_PERMISSION_KEYS.map(key => [key, 'view']));
    const h = harness({ writeEnablement: { 'projects.setMemberPermissions': true },
        responses: [intent('projects.setMemberPermissions', { projectId: 4, userId: 8,
            expectedName: 'Asha Engineer', permissions })] });
    const requestBody = { ...body('Set permissions for this project member'),
        context: { route: '/projects/4/settings', module: 'Projects', projectId: '4' } };
    const proposed = await h.submit(requestBody);
    const confirmation = proposed.events.find(event => event.type === 'confirmation_required')?.confirmation;
    assert.equal(confirmation?.confirmationPhrase, 'CONFIRM ACCESS CHANGE');
    await assert.rejects(h.service.decide(actor, { confirmationId: confirmation.confirmationId,
        decision: 'confirm' }, requestBody.conversationId), /typed_confirmation_mismatch/);
    assert.equal(h.attempts, 0);
});
test('user system permissions cannot execute without typed access confirmation', async () => {
    const permissions = Object.fromEntries(SYSTEM_PERMISSION_KEYS.map(key => [key, 'view']));
    const h = harness({ writeEnablement: { 'adminUsers.setSystemPermissions': true },
        responses: [intent('adminUsers.setSystemPermissions', { userId: 8, expectedName: 'Asha', permissions })] });
    const requestBody = { ...body('Set system permissions for user Asha'),
        context: { route: '/admin/users', module: 'Admin' } };
    const proposed = await h.submit(requestBody);
    const confirmation = proposed.events.find(event => event.type === 'confirmation_required')?.confirmation;
    assert.equal(confirmation?.confirmationPhrase, 'CONFIRM ACCESS CHANGE');
    await assert.rejects(h.service.decide(actor, { confirmationId: confirmation.confirmationId,
        decision: 'confirm' }, requestBody.conversationId), /typed_confirmation_mismatch/);
    assert.equal(h.attempts, 0);
});
test('S09 confirmation executes exact stored operation once', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); const events = await h.decide(p.confirmation.confirmationId);
    assert.deepEqual(h.store.state.business[0].args, { name: 'Fixture Supplier' }); assert.equal(h.attempts, 1);
    assert.equal(events.find(e => e.type === 'tool_completed').result.outcome, 'success');
});
test('S10 cancel performs zero ERP writes', async () => { const h = harness({ enableWrites: true }); const p = await h.propose(); await h.decide(p.confirmation.confirmationId, 'cancel'); assert.equal(h.attempts, 0); });
test('S11 duplicate confirmation replays durable result', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); const a = await h.decide(p.confirmation.confirmationId); const b = await h.decide(p.confirmation.confirmationId);
    assert.deepEqual(b, a); assert.equal(h.attempts, 1);
});
test('S12 expired confirmation never executes', async () => { const h = harness({ enableWrites: true }); const p = await h.propose(); h.advance(300001); const events = await h.decide(p.confirmation.confirmationId); assert.equal(h.attempts, 0); assert.equal(events.find(e => e.type === 'tool_failed').error.code, 'confirmation_expired'); });
test('S13 other user, credential or conversation cannot confirm', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose();
    await assert.rejects(h.decide(p.confirmation.confirmationId, 'confirm', { ...actor, userId: 8 }));
    await assert.rejects(h.decide(p.confirmation.confirmationId, 'confirm', { ...actor, credentialHash: 'x'.repeat(64) }));
    await assert.rejects(h.decide(p.confirmation.confirmationId, 'confirm', actor, 'another-conversation'));
    assert.equal(h.attempts, 0);
});
test('S14 changed preconditions invalidate confirmation', async () => { let version = 1; const h = harness({ enableWrites: true, version: () => version }); const p = await h.propose(); version++; await h.decide(p.confirmation.confirmationId); assert.equal(h.attempts, 0); });
test('S21 proposal/confirmation/commit event ordering is deterministic', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); const events = await h.decide(p.confirmation.confirmationId);
    assert.deepEqual(events.map(e => e.type), ['message_started', 'tool_proposed', 'confirmation_required', 'confirmation_resolved', 'tool_started', 'tool_completed', 'conversation_completed']);
});
test('S25 uncertain or failed execution never emits false success', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); h.store.flags.completionEvent = true;
    const events = await h.decide(p.confirmation.confirmationId); assert.equal(h.store.state.business.length, 0); assert.ok(!events.some(e => e.type === 'tool_completed'));
});
test('S29 write audit records request/execution/owner binding without raw credential', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); await h.decide(p.confirmation.confirmationId);
    const e = [...h.store.state.executions.values()][0]; assert.equal(e.scope_json.userId, actor.userId); assert.equal(e.credential_hash, actor.credentialHash); assert.equal(e.status, 'SUCCEEDED');
    assert.equal(e.confirmation_id, p.confirmation.confirmationId); assert.ok(e.operation_fingerprint); assert.doesNotMatch(JSON.stringify(e), /fixture-credential-not/);
});
test('S41 concurrent duplicate confirms commit one mutation (transaction model)', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); await Promise.all([h.decide(p.confirmation.confirmationId), h.decide(p.confirmation.confirmationId)]);
    assert.equal(h.attempts, 1); assert.equal(h.store.state.business.length, 1);
});
