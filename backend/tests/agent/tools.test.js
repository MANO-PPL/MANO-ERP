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

test('tasks.search tool executes bounded query and returns clean task records', async () => {
    const mockTasks = [
        { id: 1, name: 'Foundation Pouring', task_code: 'T-1', description: 'Pour concrete foundation', status: 'IN_PROGRESS', priority: 'HIGH', start_date: new Date('2026-03-01'), due_date: new Date('2026-03-10'), duration: 10, project_id: 4, project_name: 'Metro Line', project_code: 'PRJ-004', category_name: 'Civil Works' },
        { id: 2, name: 'Electrical Conduit', task_code: 'T-2', description: 'Install conduits', status: 'TODO', priority: 'MEDIUM', start_date: new Date('2026-03-11'), due_date: new Date('2026-03-15'), duration: 5, project_id: 4, project_name: 'Metro Line', project_code: 'PRJ-004', category_name: 'Electrical' }
    ];
    let whereClauses = [];
    const q = {
        join() { return q; },
        leftJoin() { return q; },
        where(col, val) {
            if (typeof col === 'string') whereClauses.push({ col, val });
            return q;
        },
        whereILike() { return q; },
        select() { return q; },
        orderBy() { return q; },
        limit() { return q; },
        offset() { return Promise.resolve(mockTasks); }
    };
    const read = createReadService({ db: () => q });
    const data = await read(actor, TOOLS['tasks.search'], { projectId: 4, limit: 10 }, { orgId: 2 });
    assert.equal(data.length, 2);
    assert.equal(data[0].name, 'Foundation Pouring');
    assert.equal(data[0].code, 'T-1');
    assert.equal(data[0].status, 'IN_PROGRESS');
    assert.equal(data[0].priority, 'HIGH');
    assert.equal(data[0].category, 'Civil Works');
    assert.equal(data[0].due_date, '2026-03-10');
    assert.equal(data[0].duration, '10 days');
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
test('reports.getDPR tool returns structured progress report data with manpower and progress items', async () => {
    const actor = { userId: 1, orgId: 2, credentialHash: 'a'.repeat(64) };
    const mockDprTxn = [{
        id: 2,
        org_id: 2,
        project_id: 4,
        txn_type: 'DAILY_PROGRESS',
        txn_date: '2026-08-13T00:00:00.000Z',
        status: 'CONFIRMED',
        remarks: JSON.stringify({
            weather: 'sunny',
            siteCondition: 'dry',
            timeSlots: [{ from: '08:00', to: '17:00' }],
            distribution: 'CLIENT',
            preparedBy: 'MANO CPL',
            remarksList: ['Good progress made on slab casting']
        }),
        created_at: '2026-08-13T12:00:00.000Z',
        updated_at: '2026-08-13T12:00:00.000Z',
        project_name: 'Metro Line Extension Project',
        project_code: 'METRO-X'
    }];
    const mockLines = [
        {
            id: 3,
            transaction_id: 2,
            party_id: 4,
            signed_qty: '23',
            notes: JSON.stringify({
                section: 'LABOUR',
                agencyName: 'Abhishek Enterprises',
                counts: { agency: 'Abhishek Enterprises', mason: 5, carp: 8, super: 2, labou: 8 }
            })
        },
        {
            id: 6,
            transaction_id: 2,
            party_id: 3,
            signed_qty: '21',
            notes: JSON.stringify({
                section: 'TODAY_PROGRESS',
                itemName: 'cement',
                description: 'used in 1st floor',
                unit: 'kg'
            })
        }
    ];

    const fakeDb = (tableName) => {
        if (tableName === 'txn_transaction_lines') {
            return {
                whereIn: () => Promise.resolve(mockLines)
            };
        }
        const q = {
            leftJoin() { return q; },
            where() { return q; },
            select() { return q; },
            orderBy() { return q; },
            limit() { return Promise.resolve(mockDprTxn); }
        };
        return q;
    };

    const read = createReadService({ db: fakeDb });
    const data = await read(actor, TOOLS['reports.getDPR'], { projectId: 4, date: '2026-08-13' }, { orgId: 2 });
    assert.equal(data.length, 1);
    assert.equal(data[0].kind, 'dpr_report');
    assert.equal(data[0].date, '2026-08-13');
    assert.equal(data[0].project_name, 'Metro Line Extension Project');
    assert.equal(data[0].total_manpower, 23);
    assert.equal(data[0].today_progress.length, 1);
    assert.equal(data[0].today_progress[0].item, 'cement');
    assert.equal(data[0].today_progress[0].quantity, 21);
});

test('reports.getWPR returns complete weekly progress report with dynamic bounds and contractor trade breakdown', async () => {
    const mockDprTxn = [
        {
            id: 2,
            org_id: 2,
            project_id: 4,
            txn_type: 'DAILY_PROGRESS',
            txn_date: '2026-08-13',
            status: 'CONFIRMED',
            remarks: JSON.stringify({ weather: 'sunny', siteCondition: 'dry', remarksList: ['good progress'] }),
            project_name: 'Metro Line Extension Project',
            project_code: 'METRO-X'
        }
    ];

    const mockLines = [
        {
            transaction_id: 2,
            signed_qty: 23,
            notes: JSON.stringify({
                section: 'LABOUR',
                agencyName: 'Abhishek Enterprises',
                counts: { supervisors: 2, masons: 5, labourers: 16 }
            })
        },
        {
            transaction_id: 2,
            signed_qty: 65,
            notes: JSON.stringify({
                section: 'TODAY_PROGRESS',
                itemName: 'cement',
                description: 'used in 1st floor and terrace',
                unit: 'kg'
            })
        },
        {
            transaction_id: 2,
            signed_qty: 40,
            notes: JSON.stringify({
                section: 'TOMORROW_PLAN',
                itemName: 'cement',
                description: 'planned for column casting',
                unit: 'kg'
            })
        },
        {
            transaction_id: 2,
            notes: JSON.stringify({
                section: 'EVENT',
                content: 'Safety briefing conducted'
            })
        }
    ];

    const fakeDb = (tableName) => {
        if (tableName === 'txn_transaction_lines') {
            return {
                whereIn: () => Promise.resolve(mockLines)
            };
        }
        if (tableName === 'proj_projects') {
            return {
                where: () => ({ first: () => Promise.resolve({ id: 4, name: 'Metro Line Extension Project', project_code: 'METRO-X' }) })
            };
        }
        const q = {
            leftJoin() { return q; },
            where() { return q; },
            select() { return q; },
            orderBy() { return q; },
            limit() { return Promise.resolve(mockDprTxn); },
            first() { return Promise.resolve(mockDprTxn[0]); }
        };
        return q;
    };

    const read = createReadService({ db: fakeDb });
    const data = await read(actor, TOOLS['reports.getWPR'], { projectId: 4, date: '2026-08-13' }, { orgId: 2 });
    assert.equal(data.length, 1);
    assert.equal(data[0].kind, 'wpr_report');
    assert.equal(data[0].week_number, 33);
    assert.equal(data[0].date_range, '2026-08-10 to 2026-08-16');
    assert.equal(data[0].total_manpower_deployed, 23);
    assert.equal(data[0].trades_breakdown.masons, 5);
    assert.equal(data[0].trades_breakdown.labourers, 16);
    assert.equal(data[0].contractors_breakdown.length, 1);
    assert.equal(data[0].contractors_breakdown[0].agency, 'Abhishek Enterprises');
    assert.equal(data[0].contractors_breakdown[0].trades.masons, 5);
    assert.equal(data[0].progress_items_executed.length, 1);
    assert.equal(data[0].progress_items_executed[0].item, 'cement');
    assert.equal(data[0].progress_items_executed[0].total_executed, 65);
    assert.deepEqual(data[0].progress_items_executed[0].descriptions, ['used in 1st floor and terrace']);
    assert.equal(data[0].strategic_outlook_next_week.length, 1);
    assert.equal(data[0].key_events[0], 'Safety briefing conducted');
});

test('reports.getMPR returns complete monthly progress report with dynamic calendar bounds, item descriptions, and trade details', async () => {
    const mockDprTxn = [
        {
            id: 2,
            org_id: 2,
            project_id: 4,
            txn_type: 'DAILY_PROGRESS',
            txn_date: '2026-08-13',
            status: 'CONFIRMED',
            remarks: JSON.stringify({ weather: 'sunny', siteCondition: 'dry', remarksList: ['good progress'] }),
            project_name: 'Metro Line Extension Project',
            project_code: 'METRO-X'
        }
    ];

    const mockLines = [
        {
            transaction_id: 2,
            signed_qty: 23,
            notes: JSON.stringify({
                section: 'LABOUR',
                agencyName: 'Abhishek Enterprises',
                counts: { supervisors: 2, masons: 5, labourers: 16 }
            })
        },
        {
            transaction_id: 2,
            signed_qty: 65,
            notes: JSON.stringify({
                section: 'TODAY_PROGRESS',
                itemName: 'cement',
                description: 'foundation work',
                unit: 'kg'
            })
        },
        {
            transaction_id: 2,
            signed_qty: 40,
            notes: JSON.stringify({
                section: 'TOMORROW_PLAN',
                itemName: 'cement',
                description: 'planned for column casting',
                unit: 'kg'
            })
        }
    ];

    const fakeDb = (tableName) => {
        if (tableName === 'txn_transaction_lines') {
            return {
                whereIn: () => Promise.resolve(mockLines)
            };
        }
        if (tableName === 'proj_projects') {
            return {
                where: () => ({ first: () => Promise.resolve({ id: 4, name: 'Metro Line Extension Project', project_code: 'METRO-X' }) })
            };
        }
        const q = {
            leftJoin() { return q; },
            where() { return q; },
            select() { return q; },
            orderBy() { return Promise.resolve(mockDprTxn); },
            first() { return Promise.resolve(mockDprTxn[0]); },
            then(resolve, reject) { return Promise.resolve(mockDprTxn).then(resolve, reject); }
        };
        return q;
    };

    const read = createReadService({ db: fakeDb });
    const data = await read(actor, TOOLS['reports.getMPR'], { projectId: 4, month: 8, year: 2026 }, { orgId: 2 });
    assert.equal(data.length, 1);
    assert.equal(data[0].kind, 'mpr_report');
    assert.equal(data[0].month_label, 'August 2026');
    assert.equal(data[0].date_range, '2026-08-01 to 2026-08-31');
    assert.equal(data[0].total_dprs, 1);
    assert.equal(data[0].total_manpower_deployed, 23);
    assert.equal(data[0].contractors_breakdown[0].agency, 'Abhishek Enterprises');
    assert.equal(data[0].contractors_breakdown[0].trades.masons, 5);
    assert.equal(data[0].cumulative_items_executed[0].item, 'cement');
    assert.deepEqual(data[0].cumulative_items_executed[0].descriptions, ['foundation work']);
    assert.equal(data[0].strategic_outlook_next_month.length, 1);
    assert.equal(data[0].weekly_progression.length, 4);
    assert.equal(data[0].weekly_progression[1].dpr_count, 1);
});

test('registry tool definitions and disabled baseline live writes', () => {
    assert.equal(Object.values(TOOLS).filter(t => t.risk === 'READ').length, 24);
    assert.equal(TOOLS['transactions.search']?.risk, 'READ');
    assert.equal(TOOLS['billing.search']?.risk, 'READ');
    assert.equal(TOOLS['tasks.search']?.risk, 'READ');
    assert.equal(TOOLS['reports.getDPR']?.risk, 'READ');
    assert.equal(TOOLS['reports.getWPR']?.risk, 'READ');
    assert.equal(TOOLS['reports.getMPR']?.risk, 'READ');
    assert.equal(Object.values(TOOLS).filter(t => t.risk === 'WRITE').length, 4);
    assert.deepEqual(Object.values(LIVE_WRITE_ENABLEMENT), [false, false, false, false]);
});
