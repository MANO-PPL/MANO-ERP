import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { actor, body, harness, intent } from './fixtures.js';
import { initializeAgentSchema, validateUniqueIndexes } from '../../src/modules/agent/agentSchema.js';
import { createAgentStore, expireSession } from '../../src/modules/agent/agentStore.js';
import { createAgentService } from '../../src/modules/agent/agentService.js';
import { createWriteService } from '../../src/modules/agent/agentWriteService.js';

test('S42 crash before COMMIT rolls back business/result/event together (transaction model)', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); h.store.flags.beforeCommit = true;
    const events = await h.decide(p.confirmation.confirmationId); assert.equal(h.store.state.business.length, 0);
    assert.ok(![...h.store.state.executions.values()].some(e => e.status === 'SUCCEEDED')); assert.ok(!events.some(e => e.type === 'tool_completed'));
});
test('S43 committed mutation always has durable execution and completion event (transaction model)', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); await h.decide(p.confirmation.confirmationId);
    assert.equal(h.store.state.business.length, 1); const e = [...h.store.state.executions.values()][0];
    assert.equal(e.status, 'SUCCEEDED'); assert.equal(e.result_json.id, h.store.state.business[0].id);
    assert.ok(h.store.state.events.get(p.requestId).some(event => event.type === 'tool_completed' && event.executionId === e.execution_id));
});
test('S44 lost COMMIT acknowledgement reconciles success without rerunning mutation (transaction model)', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); h.store.flags.afterCommit = true;
    const events = await h.decide(p.confirmation.confirmationId); assert.equal(h.attempts, 1); assert.equal(h.store.state.business.length, 1);
    assert.ok(events.some(e => e.type === 'tool_completed' && e.result.outcome === 'success'));
});
test('expired confirmation control state releases the conversation without an ERP write', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); h.advance(300001);
    await h.store.transaction(p.requestId, actor, session => expireSession(session, h.store.now()));
    assert.equal(h.store.state.requests.get(p.requestId).status, 'EXPIRED'); assert.equal(h.attempts, 0);
    await h.submit(body('A legitimate new request'));
});
test('schema verification rejects missing idempotency unique indexes', () => {
    const contracts = { agent_conversations: [['conversation_id']], agent_requests: [['request_id'], ['conversation_id', 'client_request_key']],
        agent_executions: [['execution_id'], ['request_id', 'step_index'], ['confirmation_id']], agent_events: [['event_id'], ['request_id', 'sequence']] };
    const rows = Object.entries(contracts).flatMap(([TABLE_NAME, indexes]) => indexes.flatMap((columns, index) => columns.map((COLUMN_NAME, i) => ({ TABLE_NAME, INDEX_NAME: `index${index}`, COLUMN_NAME, SEQ_IN_INDEX: i + 1, NON_UNIQUE: 0 }))));
    validateUniqueIndexes(rows);
    assert.throws(() => validateUniqueIndexes(rows.filter(row => row.COLUMN_NAME !== 'client_request_key')));
    assert.throws(() => validateUniqueIndexes(rows.map(row => ({ ...row, NON_UNIQUE: 1 }))));
    assert.throws(() => validateUniqueIndexes([...rows, { TABLE_NAME: 'agent_conversations', INDEX_NAME: 'index0', COLUMN_NAME: 'status', SEQ_IN_INDEX: 2, NON_UNIQUE: 0, SUB_PART: 5 }]));
});

const mysqlUrl = process.env.AGENT_TEST_MYSQL_URL;
test('REAL disposable MySQL: actual vendor/rate services, durable result/event atomicity and rollback', { skip: !mysqlUrl && 'AGENT_TEST_MYSQL_URL not supplied; live write enablement MUST remain false' }, async () => {
    const url = new URL(mysqlUrl);
    assert.equal(url.protocol, 'mysql:'); assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
    const database = url.pathname.slice(1); assert.match(database, /^agent_test_[a-z0-9_]+$/);
    const { default: knex } = await import('knex');
    const db = knex({ client: 'mysql2', connection: { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database, timezone: 'Z' }, pool: { min: 0, max: 4 } });
    try {
        const existing = await db('information_schema.TABLES').where({ TABLE_SCHEMA: database }).select('TABLE_NAME');
        assert.equal(existing.length, 0, 'Only a pre-provisioned EMPTY disposable database is allowed');
        await initializeAgentSchema(db);
        await db.schema.createTable('crm_contacts', t => {
            t.engine('InnoDB'); t.increments('id'); t.integer('org_id'); t.string('scope').defaultTo('master');
            for (const name of ['name', 'category', 'contact_person', 'designation', 'telephone_no', 'mobile', 'email', 'location', 'website', 'gst_no', 'constitution', 'reference', 'responsibility', 'remarks']) t.string(name, 512);
            t.text('address'); t.integer('sector_id'); t.integer('job_nature_id');
        });
        await db.schema.createTable('res_resources', t => { t.engine('InnoDB'); t.increments('id'); t.integer('org_id'); t.string('type'); t.integer('project_id'); t.integer('parent_id'); t.string('base_unit_code'); });
        await db.schema.createTable('res_rates', t => { t.engine('InnoDB'); t.increments('id'); t.integer('resource_id'); t.decimal('rate', 18, 2); t.string('unit_code'); t.date('effective_from'); t.date('effective_to'); t.integer('is_active'); t.text('remarks'); });
        const [{ default: globalDb }, vendors, resources] = await Promise.all([import('../../src/config/database.js'), import('../../src/modules/vendors/vendorService.js'), import('../../src/modules/inventory/resourceService.js')]);
        // An accidental global service query fails before acquiring any production connection.
        const acquire = globalDb.client.acquireConnection;
        globalDb.client.acquireConnection = async () => { throw Error('GLOBAL DATABASE ESCAPE'); };
        try {
            await db('res_resources').insert({ id: 1, org_id: 2, type: 'material', base_unit_code: 'kg' });
            const store = createAgentStore(db); const realWrites = createWriteService({ db, vendors, resources });
            for (const [tool, args, table] of [['vendors.create', { name: 'Isolated fixture supplier' }, 'crm_contacts'],
                ['resources.createRateVersion', { resourceId: 1, rate: '12.50', unit_code: 'kg', effective_from: '2026-01-01' }, 'res_rates']]) {
                for (const rollback of [false, true]) {
                    const writes = { ...realWrites, execute: async (...values) => { const value = await realWrites.execute(...values); if (rollback) throw Error('Injected crash before commit'); return value; } };
                    const service = createAgentService({ store, writes, read: async () => [], authorize: async () => ({ orgId: 2, userId: 7, projectId: null, ...(args.resourceId ? { resource: { id: 1 } } : {}) }),
                        reason: async () => intent(tool, args), okf: { acquire: async () => ({ generation: 'a'.repeat(64), markdown: [{ file: 'index.md', content: 'Fixture' }] }) },
                        writeEnablement: { 'vendors.create': true, 'resources.createRateVersion': true } });
                    if (tool === 'resources.createRateVersion' && rollback) args.effective_from = '2026-02-01';
                    const before = Number((await db(table).count('* as n').first()).n);
                    const requestBody = body('Disposable fixture', randomUUID()); const proposed = await service.submit(actor, requestBody, randomUUID());
                    const cid = proposed.events.find(e => e.type === 'confirmation_required').confirmation.confirmationId;
                    const events = await service.decide(actor, { confirmationId: cid, decision: 'confirm' }, requestBody.conversationId);
                    const after = Number((await db(table).count('* as n').first()).n);
                    const execution = await db('agent_executions').where({ confirmation_id: cid }).first();
                    assert.equal(after - before, rollback ? 0 : 1); assert.equal(execution.status, rollback ? 'FAILED' : 'SUCCEEDED');
                    assert.equal(events.some(e => e.type === 'tool_completed'), !rollback);
                    await service.decide(actor, { confirmationId: cid, decision: 'confirm' }, requestBody.conversationId);
                    assert.equal(Number((await db(table).count('* as n').first()).n), after);
                }
            }
        } finally { globalDb.client.acquireConnection = acquire; await globalDb.destroy(); }
        // No automatic drop/reset: retain this disposable database for inspection.
    } finally { await db.destroy(); }
});
