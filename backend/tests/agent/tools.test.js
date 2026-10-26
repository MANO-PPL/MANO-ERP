import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TOOLS, LIVE_WRITE_ENABLEMENT, RUNTIME_WRITE_ENABLEMENT, PROJECT_PERMISSION_KEYS, SYSTEM_PERMISSION_KEYS, validateIntent } from '../../src/modules/agent/agentTools.js';
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
test('project detail lookup exposes only bounded member identity for task assignment', async () => {
    const projects = {
        getProjectById: async () => ({ id: 85, name: 'QA Project', secret: 'hidden' }),
        getProjectMembers: async () => [{ id: 7, user_name: 'Mano Manager', email: 'hidden@example.com' }],
    };
    const read = createReadService({ projects });
    const rows = await read(actor, TOOLS['projects.get'], { projectId: 85 }, { orgId: 2, userId: 7, userType: 'admin' });
    assert.deepEqual(rows, [{ id: 85, name: 'QA Project', members: [{ id: 7, name: 'Mano Manager' }] }]);
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
    assert.equal(Object.values(TOOLS).filter(t => t.risk === 'READ').length, 29);
    assert.equal(TOOLS['transactions.search']?.risk, 'READ');
    assert.equal(TOOLS['billing.search']?.risk, 'READ');
    assert.equal(TOOLS['tasks.search']?.risk, 'READ');
    assert.equal(TOOLS['reports.getDPR']?.risk, 'READ');
    assert.equal(TOOLS['reports.getWPR']?.risk, 'READ');
    assert.equal(TOOLS['reports.getMPR']?.risk, 'READ');
    assert.equal(Object.values(TOOLS).filter(t => t.risk === 'WRITE').length, 52);
    assert.equal(TOOLS['tasks.deleteSelected']?.risk, 'BULK_WRITE');
    assert.equal(RUNTIME_WRITE_ENABLEMENT['tasks.deleteSelected'], true);
    for (const name of ['projectParties.add', 'projectParties.update', 'projects.assignMember', 'projects.setMemberPermissions', 'tasks.assign', 'tasks.createCategory', 'tasks.updateCategory', 'tasks.reorder', 'meetings.create', 'meetings.update', 'directory.create', 'directory.update', 'summaries.create', 'summaries.update', 'documents.saveDraft', 'documents.submitDraft', 'documents.requestRevision', 'documents.cancelCycle', 'documents.claimRevision', 'documents.archiveInstance', 'documentTemplates.create', 'documentTemplates.update', 'adminDepartments.create', 'adminDesignations.create', 'adminSectors.create', 'adminJobNatures.create', 'permissionTemplates.create', 'permissionTemplates.update', 'adminUsers.updateProfile', 'adminUsers.setSystemPermissions', 'qualityObservations.create', 'qualityObservations.update', 'qualityObservations.submitFix', 'qualityMethodologies.create', 'qualityMethodologies.update', 'qualityChecklists.create', 'qualityChecklists.update']) {
        assert.equal(TOOLS[name]?.risk, 'WRITE');
        assert.equal(RUNTIME_WRITE_ENABLEMENT[name], true);
    }
    for (const [tool, arguments_] of [
        ['documents.requestRevision', { projectId: 4, cycleId: 8, comments: 'Please revise' }],
        ['documents.cancelCycle', { projectId: 4, cycleId: 8 }],
        ['documents.claimRevision', { projectId: 4, cycleId: 8 }],
    ]) {
        assert.equal(validateIntent({ kind: 'tool', tool, version: 1, arguments: arguments_ }).tool.name, tool);
        assert.throws(() => validateIntent({ kind: 'tool', tool, version: 1, arguments: { ...arguments_, force: true } }));
    }
    assert.deepEqual(Object.values(LIVE_WRITE_ENABLEMENT), [false, false, false, false]);
});

test('Phase 3 access maps and administrator tools reject unbounded arguments', () => {
    const projectPermissions = Object.fromEntries(PROJECT_PERMISSION_KEYS.map(key => [key, 'view']));
    const systemPermissions = Object.fromEntries(SYSTEM_PERMISSION_KEYS.map(key => [key, 0]));
    assert.equal(validateIntent(intent('projects.setMemberPermissions', { projectId: 4, userId: 8, expectedName: 'Asha',
        permissions: projectPermissions })).tool.name, 'projects.setMemberPermissions');
    assert.throws(() => validateIntent(intent('projects.setMemberPermissions', { projectId: 4, userId: 8, expectedName: 'Asha',
        permissions: { ...projectPermissions, Secret: 'edit' } })));
    assert.throws(() => validateIntent(intent('projects.setMemberPermissions', { projectId: 4, userId: 8, expectedName: 'Asha',
        permissions: { Tasks: 'view', WIP: 'view', Reports: 'view', 'General Documents': 'view', Drawings: 'view',
            Planning: 'view', Contracts: 'view', Quality: 'view', Safety: 'view', Billing: 'view',
            'Material Management': 'view', Approvals: 'view' } })));
    assert.equal(validateIntent(intent('permissionTemplates.create', { name: 'Read only', type: 'system',
        permissions: systemPermissions })).tool.name, 'permissionTemplates.create');
    assert.throws(() => validateIntent(intent('permissionTemplates.create', { name: 'Admin', type: 'system',
        permissions: { ...systemPermissions, admin: 3 } })));
    assert.throws(() => validateIntent(intent('permissionTemplates.create', { name: 'Legacy map', type: 'system',
        permissions: { projects: 0, vendors: 0, clients: 0, resources: 0, units: 0, collaboration: 0, admin: 0 } })));
    const userPermissions = Object.fromEntries(Object.keys(systemPermissions).map(key => [key, 'view']));
    assert.equal(validateIntent(intent('adminUsers.setSystemPermissions', { userId: 8, expectedName: 'Asha',
        permissions: userPermissions })).tool.name, 'adminUsers.setSystemPermissions');
    assert.throws(() => validateIntent(intent('adminUsers.setSystemPermissions', { userId: 8, expectedName: 'Asha',
        permissions: { ...userPermissions, admin: 'owner' } })));
    assert.throws(() => validateIntent(intent('documentTemplates.update', { projectId: 4, documentId: 8, expectedName: 'Inspection' })));
    assert.throws(() => validateIntent(intent('documents.archiveInstance', { projectId: 4, instanceId: 8, force: true })));
});

test('permission-template updates preserve legacy permission keys in preview and execution', async () => {
    const rows = [{ id: 5, org_id: 2, type: 'system', name: 'Test',
        permissions: JSON.stringify({ admin: 2, dashboard: 2 }) },
    { id: 6, org_id: 2, type: 'project', name: 'Legacy Project',
        permissions: JSON.stringify({ Tasks: 'edit', 'Legacy Phase': 'view' }) }];
    const connection = () => {
        let criteria = {};
        return {
            where(value, fieldValue) {
                criteria = typeof value === 'string' ? { ...criteria, [value]: fieldValue } : { ...criteria, ...value };
                return this;
            },
            whereRaw() { return this; },
            whereNot() { return this; },
            forUpdate() { return this; },
            async first() { return rows.find(row => Object.entries(criteria).every(([key, value]) => row[key] === value)); },
            async update(values) {
                const row = rows.find(item => Object.entries(criteria).every(([key, value]) => item[key] === value));
                if (!row) return 0;
                Object.assign(row, values);
                return 1;
            },
        };
    };
    const trx = () => connection();
    trx.isTransaction = true;
    const service = createWriteService({ db: connection });
    const permissions = Object.fromEntries(SYSTEM_PERMISSION_KEYS.map(key => [key, 0]));
    const tool = TOOLS['permissionTemplates.update'];
    const args = { templateId: 5, type: 'system', expectedName: 'Test', permissions };

    const preview = await service.preconditions(tool, args, { orgId: 2 });
    assert.equal(preview.requestedPermissions.dashboard, 2);
    assert.equal(preview.requestedPermissions.spreadsheets, 0);
    const updated = await service.execute(tool, args, { orgId: 2 }, trx);
    assert.equal(updated.id, 5);
    const saved = JSON.parse(rows[0].permissions);
    assert.equal(saved.dashboard, 2);
    assert.equal(saved.spreadsheets, 0);
    assert.equal(Object.keys(saved).length, SYSTEM_PERMISSION_KEYS.length + 1);

    const projectPermissions = Object.fromEntries(PROJECT_PERMISSION_KEYS.map(key => [key, 'none']));
    const projectArgs = { templateId: 6, type: 'project', expectedName: 'Legacy Project', permissions: projectPermissions };
    const projectPreview = await service.preconditions(tool, projectArgs, { orgId: 2 });
    assert.equal(projectPreview.requestedPermissions['Legacy Phase'], 'view');
    const projectUpdated = await service.execute(tool, projectArgs, { orgId: 2 }, trx);
    assert.equal(projectUpdated.id, 6);
    const savedProject = JSON.parse(rows[1].permissions);
    assert.equal(savedProject['Legacy Phase'], 'view');
    assert.equal(savedProject.Spreadsheets, 'none');
});

test('all-none employee access preview and execution revoke legacy scoped permissions', async () => {
    const row = { id: 8, org_id: 2, user_name: 'Asha',
        system_permissions: JSON.stringify({ admin: 'edit', dashboard: 'edit', project_1: 'view' }) };
    const connection = () => {
        let criteria = {};
        return {
            where(value) { criteria = { ...criteria, ...value }; return this; },
            forUpdate() { return this; },
            async first() { return Object.entries(criteria).every(([key, value]) => row[key] === value) ? row : undefined; },
            async update(values) { Object.assign(row, values); return 1; },
        };
    };
    const trx = () => connection();
    trx.isTransaction = true;
    const service = createWriteService({ db: connection });
    const tool = TOOLS['adminUsers.setSystemPermissions'];
    const args = { userId: 8, expectedName: 'Asha',
        permissions: Object.fromEntries(SYSTEM_PERMISSION_KEYS.map(key => [key, 'none'])) };
    const preview = await service.preconditions(tool, args, { orgId: 2 });
    assert.ok(Object.values(preview.requestedPermissions).every(value => value === 'none'));
    assert.equal(preview.requestedPermissions.dashboard, 'none');
    assert.equal(preview.requestedPermissions.project_1, 'none');
    await service.execute(tool, args, { orgId: 2 }, trx);
    assert.deepEqual(JSON.parse(row.system_permissions), preview.requestedPermissions);
});

test('document archive snapshots relationship impact and refuses active cycles', async () => {
    const fixtureDb = status => table => ({
        join() { return this; }, where() { return this; }, forUpdate() { return this; },
        async first() { return table === 'wf_document_instances as di'
            ? { instance_id: 9, instance_status: 'active', is_locked: 0, title: 'Inspection',
                templateName: 'Inspection Template', projectName: 'Bridge' } : null; },
        async select() { return [{ cycle_id: 12, status }]; }
    });
    const tool = TOOLS['documents.archiveInstance'];
    const args = { projectId: 4, instanceId: 9 };
    const preview = await createWriteService({ db: fixtureDb('approved') })
        .preconditions(tool, args, { orgId: 2 }, fixtureDb('approved'), true);
    assert.equal(preview.cycleCount, 1);
    assert.equal(preview.instance.title, 'Inspection');
    await assert.rejects(createWriteService({ db: fixtureDb('in_review') })
        .preconditions(tool, args, { orgId: 2 }), /active_document_cycle/);
});

test('Phase 3 metadata and archive writes require the caller transaction', async () => {
    const calls = [];
    const trx = table => ({
        insert: async row => { calls.push({ table, row }); return [15]; },
        where() { return this; },
        update: async row => { calls.push({ table, row }); return 1; }
    });
    trx.isTransaction = true;
    const writes = createWriteService({});
    await assert.rejects(writes.execute(TOOLS['documents.archiveInstance'],
        { projectId: 4, instanceId: 9 }, { orgId: 2 }, {}), /caller_transaction_required/);
    await writes.execute(TOOLS['documents.archiveInstance'], { projectId: 4, instanceId: 9 }, { orgId: 2 }, trx);
    await writes.execute(TOOLS['adminDepartments.create'], { name: 'Civil' }, { orgId: 2 }, trx);
    await writes.execute(TOOLS['documentTemplates.create'], { projectId: 4, name: 'Inspection', docType: 'episodic' },
        { orgId: 2, userId: 7 }, trx);
    assert.deepEqual(calls.map(call => call.table), ['wf_document_instances', 'iam_departments', 'wf_documents']);
    assert.equal(calls[1].row.org_id, 2);
    assert.equal(calls[2].row.project_id, 4);
});

test('administrator lookup tools return bounded, organization-scoped targets', async () => {
    const calls = [];
    const db = table => ({
        where(...args) { calls.push({ table, where: args }); return this; },
        leftJoin() { return this; }, join() { return this; }, orWhere() { return this; },
        orderBy() { return this; }, limit() { return this; }, offset() { return this; },
        async select(...columns) { if (table.startsWith('iam_users')) calls.push({ table, columns }); return table.startsWith('iam_users')
            ? [{ id: 8, name: 'Asha', email: 'asha@example.com', phone_no: 'not-for-provider', user_type: 'employee' }]
            : table.startsWith('wf_approval_cycles')
                ? [{ id: 19, title: 'Project Summary', status: 'revision_requested' }]
                : table.startsWith('wf_document_instances')
                    ? [{ id: 11, title: 'Project Summary', status: 'active' }]
                    : [{ id: 12, name: 'Inspection', doc_type: 'episodic' }]; }
    });
    const read = createReadService({ db });
    const scope = { orgId: 2, userId: 7, userType: 'admin', projectId: 4 };
    const users = await read(actor, TOOLS['adminUsers.search'], { query: 'Asha', limit: 5 }, scope);
    const templates = await read(actor, TOOLS['documentTemplates.search'], { projectId: 4, query: 'Inspection' }, scope);
    const cycles = await read(actor, TOOLS['documentCycles.search'], { projectId: 4, query: 'Project Summary' }, scope);
    const instances = await read(actor, TOOLS['documentInstances.search'], { projectId: 4, query: 'Project Summary' }, scope);
    assert.equal(users[0].name, 'Asha');
    assert.equal(Object.hasOwn(users[0], 'email'), false);
    assert.equal(Object.hasOwn(users[0], 'phone_no'), false);
    assert.ok(!calls.some(call => call.table === 'iam_users as u' && call.columns?.some(column =>
        /u\.(?:email|phone_no)\b/.test(column))));
    assert.equal(templates[0].name, 'Inspection');
    assert.equal(cycles[0].id, 19);
    assert.equal(instances[0].id, 11);
    assert.ok(calls.some(call => call.table === 'iam_users as u'
        && call.where.some((where, index) => where?.['u.org_id'] === 2 || (where === 'u.org_id' && call.where[index + 1] === 2))));
    assert.ok(calls.some(call => call.table === 'wf_documents' && call.where[0]?.project_id === 4));
    assert.ok(calls.some(call => call.table === 'wf_approval_cycles as ac' && call.where[0]?.['di.project_id'] === 4));
    assert.ok(calls.some(call => call.table === 'wf_document_instances as di' && call.where[0]?.['di.project_id'] === 4));
});
