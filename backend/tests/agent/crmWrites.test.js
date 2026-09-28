import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, RUNTIME_WRITE_ENABLEMENT, allowedToolsForRequest, validateIntent } from '../../src/modules/agent/agentTools.js';
import { createWriteService } from '../../src/modules/agent/agentWriteService.js';
import { parseSpreadsheet, cleanupUpload } from '../../src/modules/agent/agentUploadService.js';

test('client import previews invalid and duplicate rows and writes only validated rows', async () => {
    const upload = await parseSpreadsheet(Buffer.from('name,email\nAcme,a@example.com\nAcme,b@example.com\nBroken,not-email\nExisting,e@example.com\n'), 'fixture.csv', 2);
    const trx = () => ({ where() { return this; }, forUpdate() { return this; }, async select() { return [{ name: 'Existing', email: 'e@example.com' }]; } });
    trx.isTransaction = true;
    const created = [];
    const service = createWriteService({ db: trx, clients: { createClient: async (org, data, options) => { assert.equal(org, 2); assert.equal(options.transaction, trx); created.push(data); return created.length; } } });
    try {
        const args = { uploadId: upload.uploadId }, scope = { orgId: 2, userId: 3 }, tool = TOOLS['clients.bulkImport'];
        const preview = await service.preconditions(tool, args, scope);
        assert.equal(preview.validCount, 1);
        assert.equal(preview.duplicateCount, 2);
        assert.equal(preview.invalidCount, 1);
        assert.equal(preview.contentHash.length, 64);
        await assert.rejects(service.preconditions(tool, args, { orgId: 9 }));
        const result = await service.execute(tool, args, scope, trx);
        assert.equal(result.count, 1);
        assert.deepEqual(created, [{ name: 'Acme', email: 'a@example.com' }]);
    } finally { cleanupUpload(upload.uploadId); }
});

test('client import refuses more than 500 rows before database access', async () => {
    const upload = await parseSpreadsheet(Buffer.from('name\n' + Array.from({ length: 501 }, (_, i) => `Client ${i}`).join('\n')), 'fixture.csv', 2);
    try {
        const service = createWriteService({ db: () => { throw Error('database must not be called'); } });
        await assert.rejects(service.preconditions(TOOLS['clients.bulkImport'], { uploadId: upload.uploadId }, { orgId: 2 }), /client_import_row_limit/);
    } finally { cleanupUpload(upload.uploadId); }
});

test('CRM write schemas reject unsafe fields and empty updates', () => {
    const intent = (tool, args) => ({ kind: 'tool', tool, version: 1, arguments: args });
    assert.throws(() => validateIntent(intent('clients.create', { name: 'Acme', org_id: 9 })));
    assert.throws(() => validateIntent(intent('clients.update', { contactId: 1 })));
    assert.throws(() => validateIntent(intent('vendors.update', { contactId: 1, category: 'Client' })));
    assert.throws(() => validateIntent(intent('clients.addInteraction', { contactId: 1, type: 'call', interaction_date: '2026-09-27', follow_up_date: '2026-09-26' })));
    assert.equal(validateIntent(intent('clients.create', { name: 'Acme' })).tool.risk, 'WRITE');
});

test('write visibility supports current page and explicit cross-page requests', () => {
    const local = allowedToolsForRequest({ route: '/clients', module: 'Clients' }, 'Add a record', RUNTIME_WRITE_ENABLEMENT);
    assert.ok(local.includes('clients.create'));
    assert.ok(!local.includes('vendors.create'));
    const cross = allowedToolsForRequest({ route: '/', module: 'Dashboard' }, 'Create a client', RUNTIME_WRITE_ENABLEMENT);
    assert.ok(cross.includes('clients.create'));
});

test('CRM writes use caller transaction and server-owned organization/user', async () => {
    const calls = [];
    const trx = { isTransaction: true };
    const service = createWriteService({ clients: {
        createClient: async (...args) => { calls.push(args); return 7; },
        createInteraction: async (...args) => { calls.push(args); return 8; }
    } });
    const scope = { orgId: 2, userId: 3 };
    await assert.rejects(service.execute(TOOLS['clients.create'], { name: 'Acme' }, scope, {}));
    await service.execute(TOOLS['clients.create'], { name: 'Acme' }, scope, trx);
    await service.execute(TOOLS['clients.addInteraction'], { contactId: 7, type: 'call', interaction_date: '2026-09-27' }, scope, trx);
    assert.equal(calls[0][0], 2);
    assert.equal(calls[0][2].transaction, trx);
    assert.equal(calls[1][1].interacted_by, 3);
    assert.equal(calls[1][1].contact_id, 7);
    assert.equal(calls[1][2].transaction, trx);
});

test('resource metadata writes reject type/recipe changes and require caller transaction', async () => {
    const intent = (tool, args) => ({ kind: 'tool', tool, version: 1, arguments: args });
    assert.throws(() => validateIntent(intent('resources.update', { resourceId: 1, type: 'item' })));
    assert.throws(() => validateIntent(intent('resources.update', { resourceId: 1, compositions: [] })));
    assert.throws(() => validateIntent(intent('resources.update', { resourceId: 1 })));
    assert.throws(() => validateIntent(intent('resources.addConversion', { resourceId: 1, name: 'Bag', quantity: '0', unit_code: 'kg' })));
    const trx = { isTransaction: true }, calls = [];
    const service = createWriteService({ resources: {
        createAgentResource: async (...args) => { calls.push(args); return 1; },
        updateAgentResource: async (...args) => { calls.push(args); return 1; },
        addConversion: async (...args) => { calls.push(args); return 2; }
    } });
    const scope = { orgId: 2 };
    await assert.rejects(service.execute(TOOLS['resources.create'], { name: 'Steel', type: 'material', base_unit_code: 'kg' }, scope, {}));
    await service.execute(TOOLS['resources.create'], { name: 'Steel', type: 'material', base_unit_code: 'kg' }, scope, trx);
    await service.execute(TOOLS['resources.update'], { resourceId: 1, name: 'Steel bar' }, scope, trx);
    await service.execute(TOOLS['resources.addConversion'], { resourceId: 1, name: 'Bag', quantity: '50', unit_code: 'kg' }, scope, trx);
    assert.equal(calls[0][2].transaction, trx);
    assert.equal(calls[1][3].transaction, trx);
    assert.equal(calls[2][3].transaction, trx);
});
