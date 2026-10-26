import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, RUNTIME_WRITE_ENABLEMENT, validateIntent, allowedToolsForRequest } from '../../src/modules/agent/agentTools.js';
import { inspectDelete, executeDelete } from '../../src/modules/agent/agentDeleteService.js';
import { actionFor } from '../../src/modules/agent/agentEvents.js';

const intent = (tool, targets) => ({ kind: 'tool', tool, version: 1, arguments: { targets } });

function fixture({ linkedProject = false } = {}) {
    const rows = {
        crm_contacts: [{ id: 10, org_id: 2, name: 'QA Client', category: 'Client' }],
        crm_interactions: [{ id: 20, contact_id: 10 }],
        proj_parties: linkedProject ? [{ id: 30, contact_id: 10 }] : [],
        pdoc_parties: [],
    };
    const connection = table => {
        let where = {}, inColumn, inValues;
        const matching = () => rows[table].filter(row => Object.entries(where).every(([key, value]) => row[key] === value)
            && (!inColumn || inValues.includes(row[inColumn])));
        return {
            where(value) { where = { ...where, ...value }; return this; },
            whereIn(column, values) { inColumn = column; inValues = values; return this; },
            forUpdate() { return this; },
            async select() { return matching().map(row => ({ ...row })); },
            count() { return { first: async () => ({ count: matching().length }) }; },
            async del() {
                const found = matching();
                rows[table] = rows[table].filter(row => !found.includes(row));
                return found.length;
            },
        };
    };
    connection.raw = async () => [[
        { tableName: 'crm_interactions', columnName: 'contact_id' },
        { tableName: 'proj_parties', columnName: 'contact_id' },
        { tableName: 'pdoc_parties', columnName: 'party_id' },
    ]];
    return { connection, rows };
}

test('master deletion contracts are capped, named, and not exposed for projects', () => {
    for (const tool of ['clients.deleteSelected', 'vendors.deleteSelected', 'resources.deleteSelected']) {
        assert.equal(TOOLS[tool].risk, 'BULK_WRITE');
        assert.equal(RUNTIME_WRITE_ENABLEMENT[tool], true);
        assert.equal(validateIntent(intent(tool, [{ id: 10, expectedName: 'QA Client' }])).tool.name, tool);
        assert.throws(() => validateIntent(intent(tool, [])));
        assert.throws(() => validateIntent(intent(tool, [{ id: 10, expectedName: 'A' }, { id: 10, expectedName: 'A' }])));
        assert.throws(() => validateIntent(intent(tool, Array.from({ length: 21 }, (_, i) => ({ id: i + 1, expectedName: 'A' })))));
        assert.throws(() => validateIntent({ ...intent(tool, [{ id: 10, expectedName: 'A' }]), arguments: { targets: [{ id: 10, expectedName: 'A', cascade: true }] } }));
    }
    assert.equal(TOOLS['projects.deleteSelected'], undefined);
    assert.ok(allowedToolsForRequest({ route: '/clients', module: 'Clients' }, 'Delete the client named QA Client', RUNTIME_WRITE_ENABLEMENT).includes('clients.deleteSelected'));
});

test('client deletion previews owned interactions and requires an exact typed phrase', async () => {
    const { connection, rows } = fixture();
    const tool = TOOLS['clients.deleteSelected'];
    const args = { targets: [{ id: 10, expectedName: 'QA Client' }] };
    const snapshot = await inspectDelete(tool, args, { orgId: 2 }, connection);
    assert.equal(snapshot.linkedRecordsRemoved, 1);
    assert.equal(rows.crm_contacts.length, 1);
    const action = actionFor(tool, args, snapshot);
    assert.equal(action.confirmationPhrase, 'DELETE 1 CLIENT');
    assert.equal(action.riskLevel, 'DESTRUCTIVE');
    const result = await executeDelete(tool, args, { orgId: 2 }, connection, snapshot);
    assert.deepEqual(result, { deletedCount: 1, linkedRecordsRemoved: 1 });
    assert.equal(rows.crm_contacts.length, 0);
    assert.equal(rows.crm_interactions.length, 0);
});

test('linked project party blocks client deletion before any write', async () => {
    const { connection, rows } = fixture({ linkedProject: true });
    await assert.rejects(inspectDelete(TOOLS['clients.deleteSelected'],
        { targets: [{ id: 10, expectedName: 'QA Client' }] }, { orgId: 2 }, connection), /delete_has_related_records/);
    assert.equal(rows.crm_contacts.length, 1);
    assert.equal(rows.crm_interactions.length, 1);
});

test('vendor deletion refuses a client even when its name and ID match', async () => {
    const { connection } = fixture();
    await assert.rejects(inspectDelete(TOOLS['vendors.deleteSelected'],
        { targets: [{ id: 10, expectedName: 'QA Client' }] }, { orgId: 2 }, connection), /not_a_vendor/);
});

test('resource deletion previews owned rates but blocks usage in another composition', async () => {
    const rows = {
        res_resources: [{ id: 41, org_id: 2, name: 'QA Resource', project_id: null, parent_id: null }],
        res_rates: [{ id: 91, resource_id: 41 }], res_conversions: [],
        res_compositions: [{ id: 92, item_id: 88, component_id: 41 }], txn_transaction_lines: [],
    };
    const connection = table => {
        let where = {}, column, values;
        const found = () => rows[table].filter(row => Object.entries(where).every(([key, value]) => row[key] === value)
            && (!column || values.includes(row[column])));
        return {
            where(value) { where = { ...where, ...value }; return this; },
            whereIn(key, ids) { column = key; values = ids; return this; },
            async select() { return found(); },
            count() { return { first: async () => ({ count: found().length }) }; },
        };
    };
    connection.raw = async () => [[
        { tableName: 'res_rates', columnName: 'resource_id' },
        { tableName: 'res_conversions', columnName: 'resource_id' },
        { tableName: 'res_compositions', columnName: 'item_id' },
        { tableName: 'res_compositions', columnName: 'component_id' },
        { tableName: 'res_resources', columnName: 'parent_id' },
    ]];
    const args = { targets: [{ id: 41, expectedName: 'QA Resource' }] };
    await assert.rejects(inspectDelete(TOOLS['resources.deleteSelected'], args, { orgId: 2 }, connection),
        /delete_has_related_records/);
    rows.res_compositions = [];
    const snapshot = await inspectDelete(TOOLS['resources.deleteSelected'], args, { orgId: 2 }, connection);
    assert.equal(snapshot.linkedRecordsRemoved, 1);
    assert.equal(snapshot.dependencies.find(ref => ref.table === 'res_rates').count, 1);
});
