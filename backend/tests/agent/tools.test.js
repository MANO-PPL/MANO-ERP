import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TOOLS, LIVE_WRITE_ENABLEMENT, validateIntent } from '../../src/modules/agent/agentTools.js';
import { createReadService } from '../../src/modules/agent/agentReadService.js';
import { createWriteService } from '../../src/modules/agent/agentWriteService.js';
import { actor, harness, intent, answer } from './fixtures.js';

test('S02 resource search uses deterministic row and field bounds', async () => {
    let observed;
    const read = createReadService({ resources: { getResources: async (...args) => { observed = args; return [{ id: 1, name: 'Cement', secret: 'excluded' }]; } } });
    const data = await read(actor, TOOLS['resources.search'], { query: 'cement', limit: 12 }, { orgId: 2 });
    assert.equal(observed[1].limit, 12); assert.equal(observed[1].includeRates, false); assert.equal(data[0].secret, undefined);
    assert.throws(() => validateIntent(intent('resources.search', { limit: 51 })));
});
test('S03 rate service boundary returns safe provenance', async () => {
    const h = harness({ responses: [intent('resources.getRate', { resourceId: 1 }), answer] }); const r = await h.submit();
    assert.equal(r.events.find(e => e.type === 'tool_completed').provenance[0].tool, 'resources.getRate');
});
test('S04 composition traverses bounded authorized reads, never a write service', async () => {
    let authorized = 0; const read = createReadService({ authorize: async () => { authorized++; }, resources: {
        getResourceById: async (_, id, date, projectId, options) => { assert.equal(options.agentBounded, true); return { id, name: 'Component', compositions: id === 1 ? [{ component_resource_id: 2 }] : [] }; }
    } });
    const result = await read(actor, TOOLS['resources.getComposition'], { resourceId: 1 }, { orgId: 2 });
    assert.equal(result.length, 2); assert.equal(authorized, 2);
});

export async function actualRateFunctions() {
    const source = await fs.readFile(new URL('../../src/modules/inventory/resourceService.js', import.meta.url), 'utf8');
    const extract = name => {
        const begin = source.indexOf(`async function ${name}(`); const end = source.indexOf('\n}', begin) + 2;
        assert.ok(begin > 0 && end > begin); return source.slice(begin, end);
    };
    const helper = new Function('AppError', 'getUnit', 'toDateOnly', 'subtractOneDay', 'db', `return (${extract('_writeManualRateVersion')})`)(Error,
        code => ({ type: code === 'kg' ? 'mass' : 'length' }), value => value, value => { const date = new Date(value); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); }, () => { throw Error('GLOBAL DB ESCAPE'); });
    const add = new Function('AppError', 'db', 'ensureProjectExists', 'ensureResourceExists', 'resolveProjectResourceId', 'findOrCreateProjectResource', '_writeManualRateVersion', `return (${extract('addRate')})`)(Error,
        () => { throw Error('GLOBAL DB ESCAPE'); }, async (org, id, trx) => { assert.equal(trx.isTransaction, true); },
        () => { throw Error('Unexpected legacy branch'); }, () => { throw Error('Unexpected legacy branch'); }, () => { throw Error('Unexpected import'); }, helper);
    return { helper, add };
}
function rateTransaction() {
    const rows = { res_resources: [{ id: 1, org_id: 2, type: 'material', project_id: null, base_unit_code: 'kg' }],
        res_rates: [{ id: 1, resource_id: 1, rate: 10, unit_code: 'kg', is_active: 1, effective_from: '2026-01-01', effective_to: null }] };
    const trace = [];
    const trx = table => {
        let found = rows[table];
        const q = { where(criteria) { found = found.filter(r => Object.entries(criteria).every(([k, v]) => r[k] === v)); return q; },
            forUpdate() { trace.push(`lock:${table}`); return q; }, orderBy() { return q; }, first() { return Promise.resolve(found[0]); },
            update(values) { trace.push(`update:${table}`); found.forEach(r => Object.assign(r, values)); return Promise.resolve(found.length); },
            insert(values) { trace.push(`insert:${table}`); const id = rows[table].length + 1; rows[table].push({ id, ...values }); return Promise.resolve([id]); }
        }; return q;
    };
    trx.isTransaction = true; return { trx, rows, trace };
}
test('S15 actual addRate/helper preserve date/unit version logic using only injected transaction (mock SQL)', async () => {
    const { add } = await actualRateFunctions(); const fixture = rateTransaction();
    const id = await add(2, 1, { rate: '12.50', unit_code: 'kg', effective_from: '2026-02-01' }, { transaction: fixture.trx, agentExistingOnly: true });
    assert.equal(id, 2); assert.equal(fixture.rows.res_rates[0].effective_to, '2026-01-31'); assert.equal(fixture.rows.res_rates[0].is_active, 0);
    await assert.rejects(add(2, 1, { rate: '12', unit_code: 'm', effective_from: '2026-03-01' }, { transaction: fixture.trx, agentExistingOnly: true }));
    await assert.rejects(add(2, 1, { rate: '12', unit_code: 'kg', effective_from: '2026-02-01' }, { transaction: fixture.trx, agentExistingOnly: true }));
});
test('S45 write adapter passes identical transaction; missing transaction rejected', async () => {
    const trx = { isTransaction: true }; let seen;
    const writes = createWriteService({ vendors: { createVendor: async (org, args, options) => { seen = options; return 5; } } });
    await writes.execute(TOOLS['vendors.create'], { name: 'A' }, { orgId: 2 }, trx);
    assert.equal(seen.transaction, trx); assert.equal(seen.agentSupplierOnly, true);
    await assert.rejects(writes.execute(TOOLS['vendors.create'], { name: 'A' }, { orgId: 2 }, null));
});
test('S54 rate-history tool issues SELECT only and never calls legacy initializer', async () => {
    const trace = [];
    const q = { join() { return q; }, where() { return q; }, select() { trace.push('SELECT'); return q; }, orderBy() { return q; }, limit() { return q; }, offset() { return Promise.resolve([]); } };
    const read = createReadService({ db: () => q, resources: { getRateHistory: () => { throw Error('Legacy mutation called'); } } });
    await read(actor, TOOLS['resources.getRateHistory'], { resourceId: 1 }, { orgId: 2 }); assert.deepEqual(trace, ['SELECT']);
});
test('S55 actual rate helper locks parent before active-row lookup, including empty-rate case (mock SQL)', async () => {
    const { add } = await actualRateFunctions(); const f = rateTransaction(); f.rows.res_rates.length = 0;
    await add(2, 1, { rate: '12', unit_code: 'kg', effective_from: '2026-02-01' }, { transaction: f.trx, agentExistingOnly: true });
    assert.deepEqual(f.trace.slice(0, 3), ['lock:res_resources', 'lock:res_resources', 'lock:res_rates']);
});
test('registry is exactly 13 reads and 2 disabled live writes', () => {
    assert.equal(Object.values(TOOLS).filter(t => t.risk === 'READ').length, 13); assert.equal(Object.values(TOOLS).filter(t => t.risk === 'WRITE').length, 2);
    assert.deepEqual(Object.values(LIVE_WRITE_ENABLEMENT), [false, false]);
});
