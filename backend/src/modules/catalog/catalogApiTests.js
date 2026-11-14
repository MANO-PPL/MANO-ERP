import assert from 'assert';
import http from 'http';
import express from 'express';
import db from '../../config/database.js';
import catalogRoutes from './catalogRoutes.js';
import * as catalogService from './catalogService.js';
import { CatalogErrorCodes } from './catalogErrors.js';

process.env.NODE_ENV = 'test';

const TEST_ORG_1 = 9991;
const TEST_ORG_2 = 9992;
const TEST_PROJECT_1 = 8881;
const TEST_PROJECT_2 = 8882;

const ADMIN_USER = {
    id: 99901,
    org_id: TEST_ORG_1,
    user_type: 'admin',
    email: 'catalog_admin@test.com',
};

const PROJ1_USER = {
    id: 99902,
    org_id: TEST_ORG_1,
    user_type: 'employee',
    email: 'catalog_proj1@test.com',
    assigned_projects: [TEST_PROJECT_1],
    system_permissions: JSON.stringify({ materials: 'none' }),
};

const CLIENT_USER = {
    id: 99903,
    org_id: TEST_ORG_1,
    user_type: 'client',
    email: 'catalog_client@test.com',
};

let server;
let baseUrl;

async function cleanupTestData() {
    catalogService.clearUsageChecks();
    try {
        await db.raw('SET FOREIGN_KEY_CHECKS = 0');
        await db('cat_change_log').whereIn('org_id', [TEST_ORG_1, TEST_ORG_2]).delete();
        await db.raw(`
            DELETE n FROM cat_activity_norm n
            JOIN cat_activity a ON a.id = n.activity_id
            WHERE a.org_id IN (?, ?)
        `, [TEST_ORG_1, TEST_ORG_2]);
        await db('cat_activity').whereIn('org_id', [TEST_ORG_1, TEST_ORG_2]).delete();
        await db.raw(`
            DELETE rt FROM cat_rate rt
            JOIN cat_resource r ON r.id = rt.resource_id
            WHERE r.org_id IN (?, ?)
        `, [TEST_ORG_1, TEST_ORG_2]);
        await db.raw(`
            DELETE cv FROM cat_resource_conversion cv
            JOIN cat_resource r ON r.id = cv.resource_id
            WHERE r.org_id IN (?, ?)
        `, [TEST_ORG_1, TEST_ORG_2]);
        await db('cat_resource').whereIn('org_id', [TEST_ORG_1, TEST_ORG_2]).delete();
        await db('cat_unit').whereIn('org_id', [TEST_ORG_1, TEST_ORG_2]).delete();
    } catch (err) {
        console.error('Error during cleanupTestData:', err);
    } finally {
        try {
            await db.raw('SET FOREIGN_KEY_CHECKS = 1');
        } catch (_) {}
    }
}

async function startServer() {
    return new Promise(resolve => {
        const app = express();
        app.use(express.json());
        app.use('/api/catalog', catalogRoutes);

        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}/api/catalog`;
            resolve();
        });
    });
}

async function stopServer() {
    if (server) {
        await new Promise(resolve => server.close(resolve));
    }
}

async function api(method, path, { user = ADMIN_USER, body = null, query = null } = {}) {
    let url = `${baseUrl}${path}`;
    if (query) {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null) sp.append(k, String(v));
        }
        const qs = sp.toString();
        if (qs) url += `?${qs}`;
    }

    const headers = {
        'content-type': 'application/json',
    };
    if (user) {
        headers['x-test-user'] = JSON.stringify(user);
    }

    const options = { method, headers };
    if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    let json = null;
    try {
        json = await res.json();
    } catch (_) {}

    return { status: res.status, headers: res.headers, body: json };
}

export async function runCatalogApiTestSuite({ closeDb = false } = {}) {
    console.log('====================================================');
    console.log('🧪 RUNNING MODULE 2: CATALOG HTTP API TEST SUITE');
    console.log('====================================================');

    let passedCount = 0;
    let failedCount = 0;

    async function test(name, fn) {
        const t0 = Date.now();
        try {
            await fn();
            const ms = Date.now() - t0;
            console.log(`✅ [PASS] ${name} (${ms}ms)`);
            passedCount++;
        } catch (err) {
            const ms = Date.now() - t0;
            console.error(`❌ [FAIL] ${name} (${ms}ms)`);
            console.error(err);
            failedCount++;
        }
    }

    try {
        await startServer();
        await cleanupTestData();

        // Seed global units
        await catalogService.seedGlobalUnits();
        const units = await catalogService.listUnits(TEST_ORG_1);
        const u = Object.fromEntries(units.map(x => [x.code, x]));

        // ═════════════════════════════════════════════════════════════════════
        // Group 1: Units & Conversions
        // ═════════════════════════════════════════════════════════════════════

        let customUnitId;
        await test('1.1 GET /units lists global and tenant units', async () => {
            const res = await api('GET', '/units');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert(Array.isArray(res.body.data));
            assert(res.body.data.some(x => x.code === 'kg'));
        });

        await test('1.2 POST /units creates custom operational unit', async () => {
            const res = await api('POST', '/units', {
                body: {
                    code: 'box10',
                    name: 'Box of 10',
                    category: 'count',
                    toBaseFactor: '10.0000000000',
                    isBase: 0,
                },
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.data.code, 'box10');
            assert.strictEqual(Number(res.body.data.org_id), TEST_ORG_1);
            customUnitId = res.body.data.id;
        });

        await test('1.3 PUT /units/:id updates custom unit', async () => {
            const res = await api('PUT', `/units/${customUnitId}`, {
                body: { name: 'Box of 10 Units Updated' },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.data.name, 'Box of 10 Units Updated');
        });

        await test('1.4 GET /convert converts quantities accurately', async () => {
            const res = await api('GET', '/convert', {
                query: { qty: 2.5, from: 'kg', to: 'g' },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.data.result, 2500);
        });

        // ═════════════════════════════════════════════════════════════════════
        // Group 2: Resources CRUD & Lifecycle
        // ═════════════════════════════════════════════════════════════════════

        let masterResId;
        await test('2.1 POST /resources creates master resource', async () => {
            const res = await api('POST', '/resources', {
                body: {
                    kind: 'material',
                    code: 'API-MAT-01',
                    name: 'OPC 53 Cement',
                    baseUnitId: u.kg.id,
                    description: 'High grade portland cement',
                },
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.data.code, 'API-MAT-01');
            assert.strictEqual(res.body.data.project_id, null);
            masterResId = res.body.data.id;
        });

        await test('2.2 GET /resources lists resources by filter', async () => {
            const res = await api('GET', '/resources', {
                query: { scope: 'master', kind: 'material', q: 'Cement' },
            });
            assert.strictEqual(res.status, 200);
            assert(res.body.data.some(r => r.id === masterResId));
        });

        await test('2.3 GET /resources/:id gets resource details', async () => {
            const res = await api('GET', `/resources/${masterResId}`);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.data.id, masterResId);
            assert.strictEqual(res.body.data.base_unit_code, 'kg');
        });

        await test('2.4 PUT /resources/:id updates resource', async () => {
            const res = await api('PUT', `/resources/${masterResId}`, {
                body: { name: 'OPC 53 Grade Premium Cement' },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.data.name, 'OPC 53 Grade Premium Cement');
        });

        await test('2.5 POST /resources/:id/archive and /restore lifecycle', async () => {
            const arch = await api('POST', `/resources/${masterResId}/archive`, {
                body: { reason: 'Temporary supplier stop' },
            });
            assert.strictEqual(arch.status, 200);
            assert.strictEqual(arch.body.data.status, 'archived');

            const rest = await api('POST', `/resources/${masterResId}/restore`, {
                body: { reason: 'Supplier resumed' },
            });
            assert.strictEqual(rest.status, 200);
            assert.strictEqual(rest.body.data.status, 'active');
        });

        // ═════════════════════════════════════════════════════════════════════
        // Group 3: Resource Packaging Conversions
        // ═════════════════════════════════════════════════════════════════════

        let bagConvId;
        await test('3.1 POST /resources/:id/conversions sets conversion factor', async () => {
            const res = await api('POST', `/resources/${masterResId}/conversions`, {
                body: {
                    fromUnitId: u.bag.id,
                    toUnitId: u.kg.id,
                    factor: '50.0000000000',
                    reason: 'Standard 50kg bag packaging',
                },
            });
            assert.strictEqual(res.status, 201);
            bagConvId = res.body.data.id;
        });

        await test('3.2 GET /resources/:id/conversions lists conversions', async () => {
            const res = await api('GET', `/resources/${masterResId}/conversions`);
            assert.strictEqual(res.status, 200);
            assert(res.body.data.some(c => c.id === bagConvId));
        });

        await test('3.3 DELETE /resources/:id/conversions removes conversion rule', async () => {
            const delRes = await api('DELETE', `/resources/${masterResId}/conversions`, {
                query: { conversionId: bagConvId },
                body: { reason: 'Repackaging change' },
            });
            assert.strictEqual(delRes.status, 200);

            // Re-add for downstream tests
            await api('POST', `/resources/${masterResId}/conversions`, {
                body: {
                    fromUnitId: u.bag.id,
                    toUnitId: u.kg.id,
                    factor: '50.0000000000',
                },
            });
        });

        // ═════════════════════════════════════════════════════════════════════
        // Group 4: Effective-Dated Rates
        // ═════════════════════════════════════════════════════════════════════

        let rate1Id;
        await test('4.1 POST /resources/:id/rates sets effective rate', async () => {
            const res = await api('POST', `/resources/${masterResId}/rates`, {
                body: {
                    rate: '380.0000',
                    unitId: u.bag.id,
                    effectiveFrom: '2026-01-01',
                    note: 'Q1 Contract Rate',
                },
            });
            assert.strictEqual(res.status, 201);
            rate1Id = res.body.data.id;
        });

        await test('4.2 GET /resources/:id/rates lists rate history', async () => {
            const res = await api('GET', `/resources/${masterResId}/rates`);
            assert.strictEqual(res.status, 200);
            assert(res.body.data.some(r => r.id === rate1Id));
        });

        await test('4.3 GET /resources/:id/rate gets effective rate (with conversion)', async () => {
            const resInBag = await api('GET', `/resources/${masterResId}/rate`, {
                query: { date: '2026-02-01' },
            });
            assert.strictEqual(resInBag.status, 200);
            assert.strictEqual(Number(resInBag.body.data.rate), 380);

            // Converted to base unit (kg): 380 / 50 = 7.6000
            const resInKg = await api('GET', `/resources/${masterResId}/rate`, {
                query: { date: '2026-02-01', inUnit: 'kg' },
            });
            assert.strictEqual(resInKg.status, 200);
            assert.strictEqual(Number(resInKg.body.data.rate), 7.6);
        });

        await test('4.4 GET /resources/:id/rate returns null for dates prior to rate', async () => {
            const res = await api('GET', `/resources/${masterResId}/rate`, {
                query: { date: '2025-01-01' },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.data, null);
        });

        await test('4.5 PUT /rates/:id corrects rate with audit reason', async () => {
            const res = await api('PUT', `/rates/${rate1Id}`, {
                body: {
                    patch: { rate: '385.0000' },
                    reason: 'Tax slab adjustment',
                },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(Number(res.body.data.rate), 385);
        });

        await test('4.6 DELETE /rates/:id removes future rate with reason', async () => {
            const futureRate = await api('POST', `/resources/${masterResId}/rates`, {
                body: {
                    rate: '410.0000',
                    unitId: u.bag.id,
                    effectiveFrom: '2026-12-01',
                },
            });
            const delRes = await api('DELETE', `/rates/${futureRate.body.data.id}`, {
                body: { reason: 'Forecast cancelled' },
            });
            assert.strictEqual(delRes.status, 200);
        });

        // ═════════════════════════════════════════════════════════════════════
        // Group 5: Activities & Composition Norms
        // ═════════════════════════════════════════════════════════════════════

        let activityId;
        await test('5.1 POST /activities creates master activity', async () => {
            const res = await api('POST', '/activities', {
                body: {
                    code: 'API-ACT-01',
                    name: 'M25 Reinforced Concrete Work',
                    outputUnitId: u.m3.id,
                    description: 'Structural concrete pouring',
                },
            });
            assert.strictEqual(res.status, 201);
            activityId = res.body.data.id;
        });

        await test('5.2 GET /activities lists activities', async () => {
            const res = await api('GET', '/activities', {
                query: { scope: 'master', q: 'Concrete' },
            });
            assert.strictEqual(res.status, 200);
            assert(res.body.data.some(a => a.id === activityId));
        });

        await test('5.3 GET /activities/:id gets activity with norms', async () => {
            const res = await api('GET', `/activities/${activityId}`);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.data.id, activityId);
            assert(Array.isArray(res.body.data.norms));
        });

        await test('5.4 PUT /activities/:id updates activity', async () => {
            const res = await api('PUT', `/activities/${activityId}`, {
                body: { name: 'M25 Reinforced Concrete Casting' },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.data.name, 'M25 Reinforced Concrete Casting');
        });

        let norm1Id;
        await test('5.5 POST /activities/:id/norms sets resource consumption norm', async () => {
            const res = await api('POST', `/activities/${activityId}/norms`, {
                body: {
                    resourceId: masterResId,
                    qtyPerUnit: '350.000000',
                    unitId: u.kg.id,
                    effectiveFrom: '2026-01-01',
                    wastagePct: '2.500',
                    note: 'Mix design norm',
                },
            });
            assert.strictEqual(res.status, 201);
            norm1Id = res.body.data.id;
        });

        await test('5.6 GET /activities/:id/norms lists active norms', async () => {
            const res = await api('GET', `/activities/${activityId}/norms`, {
                query: { date: '2026-02-01' },
            });
            assert.strictEqual(res.status, 200);
            assert(res.body.data.some(n => n.id === norm1Id));
        });

        await test('5.7 PUT /norms/:id corrects norm quantity with reason', async () => {
            const res = await api('PUT', `/norms/${norm1Id}`, {
                body: {
                    patch: { qtyPerUnit: '345.000000' },
                    reason: 'Lab mix optimization',
                },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(Number(res.body.data.qty_per_unit), 345);
        });

        await test('5.8 DELETE /norms/:id removes scheduled future norm line', async () => {
            const futureNorm = await api('POST', `/activities/${activityId}/norms`, {
                body: {
                    resourceId: masterResId,
                    qtyPerUnit: '360.000000',
                    unitId: u.kg.id,
                    effectiveFrom: '2026-12-01',
                },
            });
            const delRes = await api('DELETE', `/norms/${futureNorm.body.data.id}`, {
                body: { reason: 'Revised grade dropped' },
            });
            assert.strictEqual(delRes.status, 200);
        });

        // ═════════════════════════════════════════════════════════════════════
        // Group 6: Dynamic Computation
        // ═════════════════════════════════════════════════════════════════════

        await test('6.1 GET /activities/:id/cost computes unit cost dynamically', async () => {
            const res = await api('GET', `/activities/${activityId}/cost`, {
                query: { date: '2026-02-01' },
            });
            assert.strictEqual(res.status, 200);
            assert(Number(res.body.data.total) > 0);
            assert(Array.isArray(res.body.data.lines));
        });

        await test('6.2 GET /activities/:id/expected-usage generates BOM', async () => {
            const res = await api('GET', `/activities/${activityId}/expected-usage`, {
                query: { qty: 10, date: '2026-02-01' },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(Number(res.body.data.outputQty), 10);
            assert(Array.isArray(res.body.data.items));
        });

        // ═════════════════════════════════════════════════════════════════════
        // Group 7: Import & Sync
        // ═════════════════════════════════════════════════════════════════════

        let projResId;
        let projActId;
        await test('7.1 POST /projects/:projectId/import/resources imports to project', async () => {
            const res = await api('POST', `/projects/${TEST_PROJECT_1}/import/resources`, {
                body: { masterId: masterResId },
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(Number(res.body.data.project_id), TEST_PROJECT_1);
            assert.strictEqual(Number(res.body.data.parent_id), masterResId);
            projResId = res.body.data.id;
        });

        await test('7.2 POST /projects/:projectId/import/activities imports to project', async () => {
            const res = await api('POST', `/projects/${TEST_PROJECT_1}/import/activities`, {
                body: { masterId: activityId },
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(Number(res.body.data.project_id), TEST_PROJECT_1);
            assert.strictEqual(Number(res.body.data.parent_id), activityId);
            projActId = res.body.data.id;
        });

        await test('7.3 GET /resources/:id/sync and /sync/diff inspect drift', async () => {
            const status = await api('GET', `/resources/${projResId}/sync`);
            assert.strictEqual(status.status, 200);
            assert.strictEqual(status.body.data.isBehind, false);

            const diff = await api('GET', `/resources/${projResId}/sync/diff`);
            assert.strictEqual(diff.status, 200);
            assert.strictEqual(diff.body.data.entity, 'resource');
        });

        await test('7.4 POST /resources/:id/sync/accept syncs master changes into project', async () => {
            // Update master
            await api('PUT', `/resources/${masterResId}`, {
                body: { description: 'Updated master spec for sync test' },
            });

            const acceptRes = await api('POST', `/resources/${projResId}/sync/accept`, {
                body: { selection: { fields: ['description'] } },
            });
            assert.strictEqual(acceptRes.status, 200);
        });

        await test('7.5 GET & POST /activities/:id/sync lifecycle', async () => {
            const status = await api('GET', `/activities/${projActId}/sync`);
            assert.strictEqual(status.status, 200);

            const diff = await api('GET', `/activities/${projActId}/sync/diff`);
            assert.strictEqual(diff.status, 200);

            const acceptRes = await api('POST', `/activities/${projActId}/sync/accept`, {
                body: { selection: { fields: ['name'] } },
            });
            assert.strictEqual(acceptRes.status, 200);
        });

        // ═════════════════════════════════════════════════════════════════════
        // Group 8: Housekeeping
        // ═════════════════════════════════════════════════════════════════════

        await test('8.1 GET /change-log retrieves audit history', async () => {
            const res = await api('GET', '/change-log', {
                query: { entity: 'resource', id: masterResId },
            });
            assert.strictEqual(res.status, 200);
            assert(Array.isArray(res.body.data));
            assert(res.body.data.length > 0);
        });

        await test('8.2 GET /integrity checks database health', async () => {
            const res = await api('GET', '/integrity', {
                query: { projectId: TEST_PROJECT_1 },
            });
            assert.strictEqual(res.status, 200);
            assert(Array.isArray(res.body.data));
            assert.strictEqual(res.body.data.length, 0);
        });

        // ═════════════════════════════════════════════════════════════════════
        // Group 9: Error Code Mappings (Step 4 Verification)
        // ═════════════════════════════════════════════════════════════════════

        await test('9.1 CAT_NOT_FOUND maps to 404', async () => {
            const res = await api('GET', '/resources/9999999');
            assert.strictEqual(res.status, 404);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_NOT_FOUND);
        });

        await test('9.2 CAT_DUPLICATE_CODE maps to 409', async () => {
            const res = await api('POST', '/resources', {
                body: {
                    kind: 'material',
                    code: 'API-MAT-01', // already used above
                    name: 'Duplicate Steel',
                    baseUnitId: u.kg.id,
                },
            });
            assert.strictEqual(res.status, 409);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_DUPLICATE_CODE);
        });

        await test('9.3 CAT_IN_USE maps to 409', async () => {
            // Cannot delete master resource because project copy projResId exists
            const res = await api('DELETE', `/resources/${masterResId}`);
            assert.strictEqual(res.status, 409);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_IN_USE);
        });

        await test('9.4 CAT_RATE_OVERLAP maps to 409', async () => {
            // rate1Id started on 2026-01-01; setting another rate on 2025-12-01 is backwards overlap
            const res = await api('POST', `/resources/${masterResId}/rates`, {
                body: {
                    rate: '350.0000',
                    unitId: u.bag.id,
                    effectiveFrom: '2025-12-01',
                },
            });
            assert.strictEqual(res.status, 409);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_RATE_OVERLAP);
        });

        await test('9.5 CAT_NORM_OVERLAP maps to 409', async () => {
            // norm1Id started on 2026-01-01; setting on 2025-12-01 is backwards overlap
            const res = await api('POST', `/activities/${activityId}/norms`, {
                body: {
                    resourceId: masterResId,
                    qtyPerUnit: '10.000000',
                    unitId: u.kg.id,
                    effectiveFrom: '2025-12-01',
                },
            });
            assert.strictEqual(res.status, 409);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_NORM_OVERLAP);
        });

        await test('9.6 CAT_ARCHIVED maps to 409', async () => {
            const tmpAct = await api('POST', '/activities', {
                body: {
                    code: 'TMP-ARCH-ACT',
                    name: 'Temp Activity',
                    outputUnitId: u.m3.id,
                },
            });
            await api('POST', `/activities/${tmpAct.body.data.id}/archive`, {
                body: { reason: 'Archived for test' },
            });

            const res = await api('POST', `/activities/${tmpAct.body.data.id}/norms`, {
                body: {
                    resourceId: masterResId,
                    qtyPerUnit: '10.000000',
                    unitId: u.kg.id,
                    effectiveFrom: '2026-01-01',
                },
            });
            assert.strictEqual(res.status, 409);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_ARCHIVED);
        });

        await test('9.7 CAT_INVALID_VALUE maps to 422', async () => {
            // Negative rate value
            const res = await api('POST', `/resources/${masterResId}/rates`, {
                body: {
                    rate: '-50.0000',
                    unitId: u.bag.id,
                    effectiveFrom: '2026-06-01',
                },
            });
            assert.strictEqual(res.status, 422);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_INVALID_VALUE);
        });

        await test('9.8 CAT_UNIT_INCOMPATIBLE maps to 422', async () => {
            // Setting rate in time unit (hr) for weight material without conversion
            const res = await api('POST', `/resources/${masterResId}/rates`, {
                body: {
                    rate: '500.0000',
                    unitId: u.hr.id,
                    effectiveFrom: '2026-06-01',
                },
            });
            assert.strictEqual(res.status, 422);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE);
        });

        await test('9.9 CAT_NO_CONVERSION maps to 422', async () => {
            // Creating labour resource (base hr) and converting to m3
            const labour = await api('POST', '/resources', {
                body: {
                    kind: 'labour',
                    code: 'API-LAB-01',
                    name: 'Mason',
                    baseUnitId: u.hr.id,
                },
            });
            const res = await api('GET', `/convert`, {
                query: { qty: 10, from: 'hr', to: 'm3', resourceId: labour.body.data.id },
            });
            assert.strictEqual(res.status, 422);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_NO_CONVERSION);
        });

        await test('9.10 CAT_KIND_MISMATCH maps to 422', async () => {
            // Attempting to change immutable resource kind on update
            const res = await api('PUT', `/resources/${masterResId}`, {
                body: {
                    kind: 'labour',
                },
            });
            assert.strictEqual(res.status, 422);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_KIND_MISMATCH);
        });

        await test('9.11 CAT_SCOPE_MISMATCH maps to 422', async () => {
            // Creating project resource in Project 1, then importing master activity into Project 2,
            // then trying to add Project 1 resource to Project 2 activity
            const p1Res = await api('POST', '/resources', {
                body: {
                    kind: 'material',
                    code: 'P1-MAT-ONLY',
                    name: 'P1 Resource',
                    baseUnitId: u.kg.id,
                    projectId: TEST_PROJECT_1,
                },
            });
            const p2Act = await api('POST', `/projects/${TEST_PROJECT_2}/import/activities`, {
                body: { masterId: activityId },
            });
            const res = await api('POST', `/activities/${p2Act.body.data.id}/norms`, {
                body: {
                    resourceId: p1Res.body.data.id,
                    qtyPerUnit: '1.000000',
                    unitId: u.kg.id,
                    effectiveFrom: '2026-01-01',
                },
            });
            assert.strictEqual(res.status, 422);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_SCOPE_MISMATCH);
        });

        await test('9.12 CAT_NOT_MASTER maps to 422', async () => {
            // Importing a project resource as a master into another project
            const res = await api('POST', `/projects/${TEST_PROJECT_2}/import/resources`, {
                body: { masterId: projResId }, // projResId is already project-scoped
            });
            assert.strictEqual(res.status, 422);
            assert.strictEqual(res.body.error.code, CatalogErrorCodes.CAT_NOT_MASTER);
        });

        // ═════════════════════════════════════════════════════════════════════
        // Group 10: Scope Isolation & Org Security
        // ═════════════════════════════════════════════════════════════════════

        await test('10.1 Project user cannot access resources of an unassigned project', async () => {
            // PROJ1_USER is only assigned to TEST_PROJECT_1 (8881).
            // Attempting to list resources in TEST_PROJECT_2 (8882) must be blocked with 403 Forbidden.
            const res = await api('GET', '/resources', {
                user: PROJ1_USER,
                query: { projectId: TEST_PROJECT_2 },
            });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.code, 'FORBIDDEN');
        });

        await test('10.2 Project user cannot read single resource of an unassigned project', async () => {
            const p2Res = await api('POST', '/resources', {
                body: {
                    kind: 'material',
                    code: 'P2-SECRET-MAT',
                    name: 'Project 2 Material',
                    baseUnitId: u.kg.id,
                    projectId: TEST_PROJECT_2,
                },
            });

            // PROJ1_USER queries p2Res.id directly
            const res = await api('GET', `/resources/${p2Res.body.data.id}`, {
                user: PROJ1_USER,
            });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.code, 'FORBIDDEN');
        });

        await test('10.3 Client user has read-only access and cannot write master catalog', async () => {
            const res = await api('POST', '/resources', {
                user: CLIENT_USER,
                body: {
                    kind: 'material',
                    code: 'CLIENT-HACK-RES',
                    name: 'Client Resource',
                    baseUnitId: u.kg.id,
                },
            });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.code, 'FORBIDDEN');
        });

        await test('10.4 orgId from request body is completely ignored', async () => {
            // Attacker sends body with orgId: 9999.
            // Authenticated user has org_id: TEST_ORG_1 (9991).
            const res = await api('POST', '/resources', {
                user: ADMIN_USER,
                body: {
                    orgId: 9999,
                    kind: 'material',
                    code: 'API-MAT-ORG-IGNORE',
                    name: 'Org Isolation Resource',
                    baseUnitId: u.kg.id,
                },
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(Number(res.body.data.org_id), TEST_ORG_1);

            // Double check in raw database
            const dbRow = await db('cat_resource').where({ id: res.body.data.id }).first();
            assert.strictEqual(Number(dbRow.org_id), TEST_ORG_1);
        });

        console.log('\n----------------------------------------------------');
        console.log(`📊 TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
        console.log('----------------------------------------------------');

        return { total: passedCount + failedCount, passed: passedCount, failed: failedCount };
    } finally {
        await cleanupTestData();
        await stopServer();
        if (closeDb) {
            await db.destroy();
        }
    }
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('catalogApiTests.js')) {
    runCatalogApiTestSuite({ closeDb: true })
        .then(report => {
            process.exit(report.failed > 0 ? 1 : 0);
        })
        .catch(err => {
            console.error('API Test Execution Failed:', err);
            process.exit(1);
        });
}
