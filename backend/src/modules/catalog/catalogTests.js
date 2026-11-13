import assert from 'assert';
import db from '../../config/database.js';
import * as catalogService from './catalogService.js';
import { CatalogError, CatalogErrorCodes } from './catalogErrors.js';

const TEST_ORG_1 = 9991;
const TEST_ORG_2 = 9992;
const TEST_PROJECT_1 = 8881;
const TEST_PROJECT_2 = 8882;

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

/**
 * Runs the Module 2: Catalog Spec test suite (40 cases).
 * Can run all 40 cases together, or an individual test case.
 */
export async function runCatalogTestSuite({ targetCase = null, closeDb = false } = {}) {
    const targetNum = targetCase && targetCase !== 'all' ? Number(targetCase) : null;
    const headerTitle = targetNum
        ? `RUNNING MODULE 2: CATALOG SPEC TEST (CASE ${targetNum})`
        : `RUNNING MODULE 2: CATALOG SPEC TEST SUITE (44 CASES)`;

    console.log('====================================================');
    console.log(`🧪 ${headerTitle}`);
    console.log('====================================================');

    const suiteStartTime = Date.now();
    let passedCount = 0;
    let failedCount = 0;
    const testResults = [];

    async function runTestCase(num, name, fn) {
        if (targetNum && num !== targetNum) return;

        const caseStart = Date.now();
        try {
            await fn();
            const durationMs = Date.now() - caseStart;
            console.log(`✅ [PASS] Case ${num}: ${name} (${durationMs}ms)`);
            passedCount++;
            testResults.push({ num, name, status: 'PASS', durationMs, error: null });
        } catch (err) {
            const durationMs = Date.now() - caseStart;
            console.error(`❌ [FAIL] Case ${num}: ${name} (${durationMs}ms)`);
            console.error(err);
            failedCount++;
            testResults.push({
                num,
                name,
                status: 'FAIL',
                durationMs,
                error: {
                    message: err.message || String(err),
                    code: err.code || 'ASSERTION_ERROR',
                    stack: err.stack,
                },
            });
        }
    }

    try {
        await cleanupTestData();

        await catalogService.seedGlobalUnits();
        const units1 = await catalogService.listUnits(TEST_ORG_1);
        const u = Object.fromEntries(units1.map(x => [x.code, x]));

        const futureDate = (daysAhead = 30) => {
            const d = new Date(Date.now() + daysAhead * 86400000);
            return d.toISOString().slice(0, 10);
        };

        // Case 1: Create a master material with a base unit -> Created with version 1
        await runTestCase(1, 'Create a master material with a base unit', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'MAT-CEM-01',
                name: 'OPC 53 Cement',
                baseUnitId: u.kg.id,
            });
            assert.strictEqual(res.version, 1);
            assert.strictEqual(res.project_id, null);
            assert.strictEqual(res.kind, 'material');
            assert.strictEqual(res.base_unit_code, 'kg');
        });

        // Case 2: Duplicate code in the same scope -> CAT_DUPLICATE_CODE
        await runTestCase(2, 'Duplicate code in the same scope', async () => {
            await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'MAT-DUP-02',
                name: 'Original Steel',
                baseUnitId: u.kg.id,
            });
            await assert.rejects(
                () => catalogService.createResource({
                    orgId: TEST_ORG_1,
                    kind: 'material',
                    code: 'MAT-DUP-02',
                    name: 'Duplicate Steel',
                    baseUnitId: u.kg.id,
                }),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_DUPLICATE_CODE
            );
        });

        // Case 3: Same code in two different projects, and same code as a master -> All succeed
        await runTestCase(3, 'Same code in two different projects, and same code as a master', async () => {
            const m = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'SHARED-03',
                name: 'Master River Sand',
                baseUnitId: u.m3.id,
            });
            const p1 = await catalogService.createResource({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                kind: 'material',
                code: 'SHARED-03',
                name: 'Site 1 Sand',
                baseUnitId: u.m3.id,
            });
            const p2 = await catalogService.createResource({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_2,
                kind: 'material',
                code: 'SHARED-03',
                name: 'Site 2 Sand',
                baseUnitId: u.m3.id,
            });
            assert.ok(m.id && p1.id && p2.id);
            assert.notStrictEqual(m.id, p1.id);
            assert.notStrictEqual(p1.id, p2.id);
        });

        // Case 4: Change a resource's kind -> Rejected
        await runTestCase(4, "Change a resource's kind", async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'labour',
                code: 'LAB-KIND-04',
                name: 'Mason',
                baseUnitId: u.hr.id,
            });
            await assert.rejects(
                () => catalogService.updateResource(res.id, { kind: 'equipment' }),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_KIND_MISMATCH
            );
        });

        // Case 5: Convert g to kg and cft to m3 (plus ported unitRegistry assertions) -> Exact decimal results
        await runTestCase(5, 'Convert g to kg and cft to m3', async () => {
            const kgFromG = await catalogService.convert(1500, u.g.id, u.kg.id);
            assert.strictEqual(kgFromG, 1.5);

            const m3FromCft = await catalogService.convert(1, u.cft.id, u.m3.id);
            assert.strictEqual(m3FromCft, Number(u.cft.to_base_factor));

            // Ported unitRegistry tests: tonne <-> kg, ft <-> in
            const kgFromTonne = await catalogService.convert(2.5, u.tonne.id, u.kg.id);
            assert.strictEqual(kgFromTonne, 2500);

            const inFromFt = await catalogService.convert(5, u.ft.id, u.in.id);
            assert.strictEqual(inFromFt, 60);

            const gFromTonne = await catalogService.convert(0.5, u.tonne.id, u.g.id);
            assert.strictEqual(gFromTonne, 500000);

            // Global system units are shared (org_id IS NULL) and immutable
            assert.strictEqual(u.kg.org_id, null);
            await assert.rejects(
                () => catalogService.updateUnit(u.kg.id, { name: 'Altered KG' }),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_INVALID_VALUE
            );
            await assert.rejects(
                () => catalogService.deleteUnit(u.kg.id),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_INVALID_VALUE
            );

            // Org cannot redefine a code already defined by global system units
            await assert.rejects(
                () => catalogService.createUnit({
                    orgId: TEST_ORG_1,
                    code: 'kg',
                    name: 'Duplicate Kg',
                    category: 'weight',
                    toBaseFactor: 1,
                }),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_DUPLICATE_CODE
            );

            // Org can create its own custom operational unit
            const customShift = await catalogService.createUnit({
                orgId: TEST_ORG_1,
                code: 'cshift',
                name: 'Custom 10h Shift',
                category: 'time',
                toBaseFactor: 10,
            });
            assert.strictEqual(customShift.org_id, TEST_ORG_1);
            const hrs = await catalogService.convert(2, customShift.id, u.hr.id);
            assert.strictEqual(hrs, 20);
            await catalogService.deleteUnit(customShift.id);

            // Mathematical Immunity & Self-Healing:
            // Simulate direct DB tampering on 'kg' factor
            await db('cat_unit').where({ id: u.kg.id }).update({ to_base_factor: '999.0000000000' });
            
            // 1. Math remains 100% immune (uses sovereign in-memory code constant)
            const immuneKg = await catalogService.convert(1500, u.g.id, u.kg.id);
            assert.strictEqual(immuneKg, 1.5);

            // 2. checkIntegrity detects the tampering
            const tampViolations = await catalogService.checkIntegrity();
            assert.ok(tampViolations.some(v => v.type === 'SYSTEM_UNIT_TAMPERED' && v.id === u.kg.id));

            // 3. repairSystemUnits self-heals the DB back to pristine state
            const healReport = await catalogService.repairSystemUnits();
            assert.ok((healReport.repairedCount ?? healReport.restoredCount) >= 1);

            const healedRow = await db('cat_unit').where({ id: u.kg.id }).first();
            assert.strictEqual(Number(healedRow.to_base_factor), 1);
        });

        // Case 6: Convert kg to bag with no conversion -> CAT_NO_CONVERSION
        await runTestCase(6, 'Convert kg to bag with no conversion', async () => {
            await assert.rejects(
                () => catalogService.convert(50, u.kg.id, u.bag.id),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_NO_CONVERSION
            );
            // Also ported: mismatched unit types without resource conversion
            await assert.rejects(
                () => catalogService.convert(10, u.kg.id, u.litre.id),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_NO_CONVERSION
            );
        });

        // Case 7: Define 1 bag = 50 kg for cement, convert both ways -> 50 kg to 1 bag and 1 bag to 50 kg
        await runTestCase(7, 'Define 1 bag = 50 kg for cement, convert both ways', async () => {
            const cement = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'CEM-CONV-07',
                name: 'Cement Bag Conv',
                baseUnitId: u.kg.id,
            });
            await catalogService.setConversion(cement.id, u.bag.id, u.kg.id, 50);

            const kgToBag = await catalogService.convert(50, u.kg.id, u.bag.id, cement.id);
            const bagToKg = await catalogService.convert(1, u.bag.id, u.kg.id, cement.id);
            assert.strictEqual(kgToBag, 1);
            assert.strictEqual(bagToKg, 50);

            // Bonus: g to bag via category graph
            const gToBag = await catalogService.convert(50000, u.g.id, u.bag.id, cement.id);
            assert.strictEqual(gToBag, 1);
        });

        // Case 8: setRate on a resource with no rate -> Open-ended rate created
        await runTestCase(8, 'setRate on a resource with no rate', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RATE-08',
                name: 'Aggregate 20mm',
                baseUnitId: u.m3.id,
            });
            const r = await catalogService.setRate(res.id, 1250, u.m3.id, '2026-01-01', 'Initial rate');
            assert.strictEqual(r.effective_from, '2026-01-01');
            assert.strictEqual(r.effective_to, null);
            assert.strictEqual(Number(r.rate), 1250);
        });

        // Case 9: setRate with a later date -> Previous rate ends the day before, new rate open
        await runTestCase(9, 'setRate with a later date', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RATE-09',
                name: 'Steel TMT',
                baseUnitId: u.kg.id,
            });
            await catalogService.setRate(res.id, 60, u.kg.id, '2026-01-01');
            await catalogService.setRate(res.id, 68, u.kg.id, '2026-04-01');

            const rates = await catalogService.listRates(res.id);
            assert.strictEqual(rates.length, 2);
            assert.strictEqual(rates[0].effective_from, '2026-01-01');
            assert.strictEqual(rates[0].effective_to, '2026-03-31');
            assert.strictEqual(rates[1].effective_from, '2026-04-01');
            assert.strictEqual(rates[1].effective_to, null);
        });

        // Case 10: setRate with a date inside a past period -> CAT_RATE_OVERLAP
        await runTestCase(10, 'setRate with a date inside a past period', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RATE-10',
                name: 'Bricks',
                baseUnitId: u.nos.id,
            });
            await catalogService.setRate(res.id, 8, u.nos.id, '2026-01-01');
            await catalogService.setRate(res.id, 10, u.nos.id, '2026-06-01');

            await assert.rejects(
                () => catalogService.setRate(res.id, 9, u.nos.id, '2026-03-15'),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_RATE_OVERLAP
            );
        });

        // Case 11: getRate on the day before, the day of, and the day after a change -> Old, new, new
        await runTestCase(11, 'getRate on the day before, the day of, and the day after a change', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RATE-11',
                name: 'Copper Wire',
                baseUnitId: u.m.id,
            });
            await catalogService.setRate(res.id, 45, u.m.id, '2026-01-01');
            await catalogService.setRate(res.id, 52, u.m.id, '2026-05-10');

            const before = await catalogService.getRate(res.id, '2026-05-09');
            const dayOf = await catalogService.getRate(res.id, '2026-05-10');
            const after = await catalogService.getRate(res.id, '2026-05-11');

            assert.strictEqual(Number(before.rate), 45);
            assert.strictEqual(Number(dayOf.rate), 52);
            assert.strictEqual(Number(after.rate), 52);
        });

        // Case 12: getRate with no rate in force -> Null, no error
        await runTestCase(12, 'getRate with no rate in force', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RATE-12',
                name: 'Unpriced Paint',
                baseUnitId: u.litre.id,
            });
            await catalogService.setRate(res.id, 220, u.litre.id, '2026-06-01');

            const early = await catalogService.getRate(res.id, '2026-01-01');
            assert.strictEqual(early, null);
        });

        // Case 13: setRate in a unit with no link to the base unit's category -> CAT_UNIT_INCOMPATIBLE
        await runTestCase(13, "setRate in a unit with no link to the base unit's category", async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RATE-13',
                name: 'Sand No Conv',
                baseUnitId: u.m3.id,
            });
            await assert.rejects(
                () => catalogService.setRate(res.id, 500, u.kg.id, '2026-01-01'),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE
            );
        });

        // Case 14: getRate inUnit bag for a resource priced per kg, with a conversion -> Correctly converted rate
        await runTestCase(14, 'getRate inUnit bag for a resource priced per kg, with a conversion', async () => {
            const cem = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RATE-14',
                name: 'Cement Per Kg',
                baseUnitId: u.kg.id,
            });
            await catalogService.setConversion(cem.id, u.bag.id, u.kg.id, 50);
            await catalogService.setRate(cem.id, 8, u.kg.id, '2026-01-01');

            const rateInBag = await catalogService.getRate(cem.id, '2026-02-01', { inUnit: u.bag.id });
            assert.strictEqual(Number(rateInBag.rate), 400);
            assert.strictEqual(rateInBag.unit_code, 'bag');
        });

        // Case 15: correctRate with and without a reason -> Without: rejected. With: applied and logged
        await runTestCase(15, 'correctRate with and without a reason', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RATE-15',
                name: 'Bitumen',
                baseUnitId: u.kg.id,
            });
            const rate = await catalogService.setRate(res.id, 55, u.kg.id, '2026-01-01');

            await assert.rejects(
                () => catalogService.correctRate(rate.id, { rate: 58 }, ''),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_INVALID_VALUE
            );

            const corrected = await catalogService.correctRate(rate.id, { rate: 58 }, 'Supplier invoice typo');
            assert.strictEqual(Number(corrected.rate), 58);

            const logs = await catalogService.getChangeLog('rate', rate.id);
            const corrLog = logs.find(l => l.action === 'correct');
            assert.ok(corrLog);
            assert.strictEqual(corrLog.reason, 'Supplier invoice typo');
            assert.strictEqual(Number(corrLog.before_data.rate), 55);
            assert.strictEqual(Number(corrLog.after_data.rate), 58);
        });

        // Case 16: removeRate on a past rate -> Rejected. A future rate is removed.
        await runTestCase(16, 'removeRate on a past rate and a future rate', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RATE-16',
                name: 'Diesel',
                baseUnitId: u.litre.id,
            });
            const pastRate = await catalogService.setRate(res.id, 90, u.litre.id, '2025-01-01');
            const futDate = futureDate(30);
            const futRate = await catalogService.setRate(res.id, 95, u.litre.id, futDate);

            await assert.rejects(
                () => catalogService.removeRate(pastRate.id, 'Try removing past'),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_INVALID_VALUE
            );

            const removed = await catalogService.removeRate(futRate.id, 'Price hike cancelled');
            assert.strictEqual(removed.deleted, true);

            const ratesAfter = await catalogService.listRates(res.id);
            assert.strictEqual(ratesAfter.length, 1);
            assert.strictEqual(ratesAfter[0].effective_to, null);
        });

        // Case 17: importResource into a project -> Copy has parent_id, rates and conversions, synced version equal to master
        await runTestCase(17, 'importResource into a project', async () => {
            const master = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'IMP-17',
                name: 'Master White Cement',
                baseUnitId: u.kg.id,
            });
            await catalogService.setConversion(master.id, u.bag.id, u.kg.id, 25);
            await catalogService.setRate(master.id, 18, u.kg.id, '2026-01-01');

            const reloadedMaster = await catalogService.getResource(master.id);
            const copy = await catalogService.importResource(master.id, TEST_PROJECT_1);

            assert.strictEqual(copy.parent_id, master.id);
            assert.strictEqual(copy.project_id, TEST_PROJECT_1);
            assert.strictEqual(copy.synced_version, reloadedMaster.version);

            const copyConvs = await catalogService.listConversions(copy.id);
            const copyRates = await catalogService.listRates(copy.id);
            assert.strictEqual(copyConvs.length, 1);
            assert.strictEqual(Number(copyConvs[0].factor), 25);
            assert.strictEqual(copyRates.length, 1);
            assert.strictEqual(Number(copyRates[0].rate), 18);
        });

        // Case 18: Import the same master again -> Same copy returned, no duplicate
        await runTestCase(18, 'Import the same master again (idempotent)', async () => {
            const master = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'IMP-18',
                name: 'Idempotent Tile',
                baseUnitId: u.m2.id,
            });
            const c1 = await catalogService.importResource(master.id, TEST_PROJECT_1);
            const c2 = await catalogService.importResource(master.id, TEST_PROJECT_1);
            assert.strictEqual(c1.id, c2.id);
        });

        // Case 19: Import with asNewVariant and a different code -> A second copy exists
        await runTestCase(19, 'Import with asNewVariant and a different code', async () => {
            const master = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'IMP-19',
                name: 'Ready Mix Concrete',
                baseUnitId: u.m3.id,
            });
            const c1 = await catalogService.importResource(master.id, TEST_PROJECT_1);
            const c2 = await catalogService.importResource(master.id, TEST_PROJECT_1, {
                asNewVariant: true,
                code: 'IMP-19-M30',
                name: 'RMC M30 Site Variant',
            });
            assert.notStrictEqual(c1.id, c2.id);
            assert.strictEqual(c2.parent_id, master.id);
            assert.strictEqual(c2.code, 'IMP-19-M30');
        });

        // Case 20: Import from a project row -> CAT_NOT_MASTER
        await runTestCase(20, 'Import from a project row', async () => {
            const projRes = await catalogService.createResource({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                kind: 'material',
                code: 'PROJ-20',
                name: 'Site-only Gravel',
                baseUnitId: u.m3.id,
            });
            await assert.rejects(
                () => catalogService.importResource(projRes.id, TEST_PROJECT_2),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_NOT_MASTER
            );
        });

        // Case 21: Rename and re-rate a project copy -> Master and other projects unchanged
        await runTestCase(21, 'Rename and re-rate a project copy', async () => {
            const master = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'ISO-21',
                name: 'Master Plywood',
                baseUnitId: u.m2.id,
            });
            await catalogService.setRate(master.id, 650, u.m2.id, '2026-01-01');

            const copy1 = await catalogService.importResource(master.id, TEST_PROJECT_1);
            const copy2 = await catalogService.importResource(master.id, TEST_PROJECT_2);

            await catalogService.updateResource(copy1.id, { name: 'Site 1 Marine Ply' });
            await catalogService.setRate(copy1.id, 720, u.m2.id, '2026-02-01');

            const masterAfter = await catalogService.getResource(master.id);
            const masterRate = await catalogService.getRate(master.id, '2026-02-15');
            const copy2After = await catalogService.getResource(copy2.id);
            const copy2Rate = await catalogService.getRate(copy2.id, '2026-02-15');

            assert.strictEqual(masterAfter.name, 'Master Plywood');
            assert.strictEqual(Number(masterRate.rate), 650);
            assert.strictEqual(copy2After.name, 'Master Plywood');
            assert.strictEqual(Number(copy2Rate.rate), 650);
        });

        // Case 22: Edit a master rate -> Master version rises, copies untouched, getSyncStatus says behind
        await runTestCase(22, 'Edit a master rate', async () => {
            const master = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'SYNC-22',
                name: 'Master Gypsum',
                baseUnitId: u.kg.id,
            });
            await catalogService.setRate(master.id, 12, u.kg.id, '2026-01-01');
            const copy = await catalogService.importResource(master.id, TEST_PROJECT_1);

            const statusBefore = await catalogService.getSyncStatus(copy.id);
            assert.strictEqual(statusBefore.status, 'synced');
            assert.strictEqual(statusBefore.isBehind, false);

            await catalogService.setRate(master.id, 14, u.kg.id, '2026-06-01');

            const statusAfter = await catalogService.getSyncStatus(copy.id);
            assert.strictEqual(statusAfter.status, 'behind');
            assert.strictEqual(statusAfter.isBehind, true);
            assert.ok(statusAfter.masterVersion > statusAfter.syncedVersion);

            const copyRate = await catalogService.getRate(copy.id, '2026-07-01');
            assert.strictEqual(Number(copyRate.rate), 12);
        });

        // Case 23: getSyncDiff, then acceptSync with only the rate selected -> Rate updated, name kept, synced version updated, change logged
        await runTestCase(23, 'getSyncDiff, then acceptSync with only the rate selected', async () => {
            const master = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'SYNC-23',
                name: 'Master Putty',
                baseUnitId: u.kg.id,
            });
            await catalogService.setRate(master.id, 20, u.kg.id, '2026-01-01');
            const copy = await catalogService.importResource(master.id, TEST_PROJECT_1);
            await catalogService.updateResource(copy.id, { name: 'Project Local Putty Name' });

            await catalogService.updateResource(master.id, { name: 'Master Putty v2' });
            await catalogService.setRate(master.id, 25, u.kg.id, '2026-05-01');

            const diff = await catalogService.getSyncDiff(copy.id);
            assert.strictEqual(diff.isBehind, true);
            assert.strictEqual(diff.fields.name.changed, true);
            assert.strictEqual(diff.rates.changed, true);

            const synced = await catalogService.acceptSync(copy.id, { rates: true });
            assert.strictEqual(synced.name, 'Project Local Putty Name');
            assert.strictEqual(synced.synced_version, diff.masterVersion);

            const copyRateMay = await catalogService.getRate(copy.id, '2026-05-15');
            assert.strictEqual(Number(copyRateMay.rate), 25);

            const logs = await catalogService.getChangeLog('resource', copy.id);
            assert.ok(logs.some(l => l.action === 'sync_accept'));
        });

        // Case 24: Create an activity with an output unit -> Created
        await runTestCase(24, 'Create an activity with an output unit', async () => {
            const act = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ACT-BW-24',
                name: 'Brickwork 230mm',
                outputUnitId: u.m2.id,
            });
            assert.strictEqual(act.version, 1);
            assert.strictEqual(act.output_unit_code, 'm2');
            assert.deepStrictEqual(act.norms, []);
        });

        // Case 25: setNorm with a resource from another scope -> CAT_SCOPE_MISMATCH
        await runTestCase(25, 'setNorm with a resource from another scope', async () => {
            const masterAct = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ACT-SCOPE-25',
                name: 'Master Plastering',
                outputUnitId: u.m2.id,
            });
            const projRes = await catalogService.createResource({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                kind: 'material',
                code: 'RES-SCOPE-25',
                name: 'Project Sand',
                baseUnitId: u.m3.id,
            });
            await assert.rejects(
                () => catalogService.setNorm(masterAct.id, projRes.id, 0.02, u.m3.id, '2026-01-01'),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_SCOPE_MISMATCH
            );
        });

        // Case 26: setNorm in an incompatible unit -> CAT_UNIT_INCOMPATIBLE
        await runTestCase(26, 'setNorm in an incompatible unit', async () => {
            const act = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ACT-UINC-26',
                name: 'Concrete Pour',
                outputUnitId: u.m3.id,
            });
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'labour',
                code: 'LAB-UINC-26',
                name: 'Helper',
                baseUnitId: u.hr.id,
            });
            await assert.rejects(
                () => catalogService.setNorm(act.id, res.id, 2, u.kg.id, '2026-01-01'),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_UNIT_INCOMPATIBLE
            );
        });

        // Case 27: Overlapping norm periods -> CAT_NORM_OVERLAP
        await runTestCase(27, 'Overlapping norm periods', async () => {
            const act = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ACT-OVLP-27',
                name: 'Flooring',
                outputUnitId: u.m2.id,
            });
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'RES-OVLP-27',
                name: 'Tiles',
                baseUnitId: u.m2.id,
            });
            await catalogService.setNorm(act.id, res.id, 1.05, u.m2.id, '2026-01-01');
            await catalogService.setNorm(act.id, res.id, 1.03, u.m2.id, '2026-06-01');

            await assert.rejects(
                () => catalogService.setNorm(act.id, res.id, 1.04, u.m2.id, '2026-03-01'),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_NORM_OVERLAP
            );
        });

        // Case 28: importActivity -> Activity, norms and needed resources copied. Existing resource copies reused.
        await runTestCase(28, 'importActivity reuses existing project resource copies', async () => {
            const r1 = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'ACTIMP-R1',
                name: 'Existing Master Cement',
                baseUnitId: u.kg.id,
            });
            const r2 = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'labour',
                code: 'ACTIMP-R2',
                name: 'Mason Labour',
                baseUnitId: u.hr.id,
            });
            // Pre-import r1 into project 1
            const preImportedR1 = await catalogService.importResource(r1.id, TEST_PROJECT_1);

            const masterAct = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ACTIMP-28',
                name: 'Block Masonry',
                outputUnitId: u.m2.id,
            });
            await catalogService.setNorm(masterAct.id, r1.id, 10, u.kg.id, '2026-01-01');
            await catalogService.setNorm(masterAct.id, r2.id, 1.5, u.hr.id, '2026-01-01');

            const projAct = await catalogService.importActivity(masterAct.id, TEST_PROJECT_1);
            assert.strictEqual(projAct.project_id, TEST_PROJECT_1);
            assert.strictEqual(projAct.parent_id, masterAct.id);
            assert.strictEqual(projAct.norms.length, 2);

            const normForR1 = projAct.norms.find(n => n.resource_code === 'ACTIMP-R1');
            const normForR2 = projAct.norms.find(n => n.resource_code === 'ACTIMP-R2');
            assert.strictEqual(normForR1.resource_id, preImportedR1.id);
            assert.notStrictEqual(normForR2.resource_id, r2.id);
        });

        // Case 29: importActivity twice -> No duplicate activity or resources
        await runTestCase(29, 'importActivity twice (idempotent)', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'ACTIMP-R29',
                name: 'Primer',
                baseUnitId: u.litre.id,
            });
            const act = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ACTIMP-29',
                name: 'Wall Priming',
                outputUnitId: u.m2.id,
            });
            await catalogService.setNorm(act.id, res.id, 0.12, u.litre.id, '2026-01-01');

            const a1 = await catalogService.importActivity(act.id, TEST_PROJECT_2);
            const a2 = await catalogService.importActivity(act.id, TEST_PROJECT_2);
            assert.strictEqual(a1.id, a2.id);
            assert.strictEqual(a1.norms[0].resource_id, a2.norms[0].resource_id);
        });

        // Case 30: computeActivityCost with norms in different units and a rate change mid-year
        await runTestCase(30, 'computeActivityCost with norms in different units and a rate change mid-year', async () => {
            const cement = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'COST-CEM-30',
                name: 'Cost Cement',
                baseUnitId: u.kg.id,
            });
            await catalogService.setConversion(cement.id, u.bag.id, u.kg.id, 50);
            // Rate in bag: 400 / bag (8 / kg) before July, 450 / bag (9 / kg) from July 1
            await catalogService.setRate(cement.id, 400, u.bag.id, '2026-01-01');
            await catalogService.setRate(cement.id, 450, u.bag.id, '2026-07-01');

            const mason = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'labour',
                code: 'COST-MAS-30',
                name: 'Cost Mason',
                baseUnitId: u.hr.id,
            });
            // Rate in day (8 hr): 800 / day => 100 / hr
            await catalogService.setRate(mason.id, 800, u.day.id, '2026-01-01');

            const act = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'COST-ACT-30',
                name: 'Plastering 12mm',
                outputUnitId: u.m2.id,
            });
            // Norms: 5 kg cement (= 0.1 bag) + 0.5 hr mason
            await catalogService.setNorm(act.id, cement.id, 5, u.kg.id, '2026-01-01');
            await catalogService.setNorm(act.id, mason.id, 0.5, u.hr.id, '2026-01-01');

            const h1 = await catalogService.computeActivityCost(act.id, '2026-03-15');
            // H1: 5 * 8 (=40) + 0.5 * 100 (=50) = 90
            assert.strictEqual(h1.complete, true);
            assert.strictEqual(h1.total, 90);

            const h2 = await catalogService.computeActivityCost(act.id, '2026-08-15');
            // H2: 5 * 9 (=45) + 0.5 * 100 (=50) = 95
            assert.strictEqual(h2.complete, true);
            assert.strictEqual(h2.total, 95);
        });

        // Case 31: computeActivityCost with one missing rate -> Warning, marked incomplete
        await runTestCase(31, 'computeActivityCost with one missing rate', async () => {
            const priced = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'COST-OK-31',
                name: 'Priced Material',
                baseUnitId: u.kg.id,
            });
            await catalogService.setRate(priced.id, 10, u.kg.id, '2026-01-01');

            const unpriced = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'COST-NO-31',
                name: 'Missing Rate Material',
                baseUnitId: u.kg.id,
            });

            const act = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'COST-ACT-31',
                name: 'Incomplete Activity',
                outputUnitId: u.m2.id,
            });
            await catalogService.setNorm(act.id, priced.id, 2, u.kg.id, '2026-01-01');
            await catalogService.setNorm(act.id, unpriced.id, 3, u.kg.id, '2026-01-01');

            const cost = await catalogService.computeActivityCost(act.id, '2026-02-01');
            assert.strictEqual(cost.incomplete, true);
            assert.strictEqual(cost.complete, false);
            assert.strictEqual(cost.warnings.length, 1);
            assert.strictEqual(cost.total, 20);
        });

        // Case 32: Excavation: norms for labour and equipment only. Another activity with no norms.
        await runTestCase(32, 'Excavation (labour + equipment only) and empty-norm activity', async () => {
            const operator = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'labour',
                code: 'EXC-LAB-32',
                name: 'Excavator Operator',
                baseUnitId: u.hr.id,
            });
            await catalogService.setRate(operator.id, 150, u.hr.id, '2026-01-01');

            const jcb = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'equipment',
                code: 'EXC-EQ-32',
                name: 'JCB 3DX',
                baseUnitId: u.hr.id,
            });
            await catalogService.setRate(jcb.id, 1200, u.hr.id, '2026-01-01');

            const excavation = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'EXC-32',
                name: 'Earth Excavation',
                outputUnitId: u.m3.id,
            });
            await catalogService.setNorm(excavation.id, operator.id, 0.2, u.hr.id, '2026-01-01');
            await catalogService.setNorm(excavation.id, jcb.id, 0.1, u.hr.id, '2026-01-01');

            const excCost = await catalogService.computeActivityCost(excavation.id, '2026-03-01');
            // 0.2 * 150 (=30) + 0.1 * 1200 (=120) = 150
            assert.strictEqual(excCost.complete, true);
            assert.strictEqual(excCost.total, 150);

            const emptyAct = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'EMPTY-32',
                name: 'Site Inspection',
                outputUnitId: u.nos.id,
            });
            const emptyCost = await catalogService.computeActivityCost(emptyAct.id, '2026-03-01');
            assert.strictEqual(emptyCost.complete, true);
            assert.strictEqual(emptyCost.incomplete, false);
            assert.strictEqual(emptyCost.total, 0);
        });

        // Case 33: expectedUsage for 20 m2 of brickwork on a given date -> Norm times quantity in base unit
        await runTestCase(33, 'expectedUsage for 20 m2 of brickwork on a given date', async () => {
            const cement = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'USG-CEM-33',
                name: 'Usage Cement',
                baseUnitId: u.kg.id,
            });
            await catalogService.setConversion(cement.id, u.bag.id, u.kg.id, 50);

            const bricks = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'USG-BRK-33',
                name: 'Usage Bricks',
                baseUnitId: u.nos.id,
            });

            const brickwork = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'USG-BW-33',
                name: 'Brickwork 230mm Usage',
                outputUnitId: u.m2.id,
            });
            // Old norm: 0.2 bag/m2; New norm from June: 0.25 bag/m2
            await catalogService.setNorm(brickwork.id, cement.id, 0.2, u.bag.id, '2026-01-01');
            await catalogService.setNorm(brickwork.id, cement.id, 0.25, u.bag.id, '2026-06-01');
            await catalogService.setNorm(brickwork.id, bricks.id, 50, u.nos.id, '2026-01-01');

            const usageApril = await catalogService.expectedUsage(brickwork.id, 20, '2026-04-01');
            const cemApril = usageApril.items.find(i => i.resourceCode === 'USG-CEM-33');
            const brkApril = usageApril.items.find(i => i.resourceCode === 'USG-BRK-33');
            // 20 * 0.2 bag * 50 kg/bag = 200 kg
            assert.strictEqual(cemApril.qty, 200);
            assert.strictEqual(cemApril.unitCode, 'kg');
            assert.strictEqual(brkApril.qty, 1000);
            assert.strictEqual(brkApril.unitCode, 'nos');

            const usageJuly = await catalogService.expectedUsage(brickwork.id, 20, '2026-07-01');
            const cemJuly = usageJuly.items.find(i => i.resourceCode === 'USG-CEM-33');
            // 20 * 0.25 bag * 50 kg/bag = 250 kg
            assert.strictEqual(cemJuly.qty, 250);
        });

        // Case 34: Archive a resource, then add it to a new norm -> CAT_ARCHIVED. Existing norms/history still read fine.
        await runTestCase(34, 'Archive a resource, then add it to a new norm', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'ARC-34',
                name: 'Old Lime',
                baseUnitId: u.kg.id,
            });
            const act1 = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ARC-ACT1-34',
                name: 'Old Mortar',
                outputUnitId: u.m3.id,
            });
            await catalogService.setNorm(act1.id, res.id, 100, u.kg.id, '2026-01-01');

            await catalogService.archiveResource(res.id);

            const act2 = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ARC-ACT2-34',
                name: 'New Mortar',
                outputUnitId: u.m3.id,
            });
            await assert.rejects(
                () => catalogService.setNorm(act2.id, res.id, 50, u.kg.id, '2026-02-01'),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_ARCHIVED
            );

            // Existing norm & history still readable
            const norms = await catalogService.getNorms(act1.id, '2026-03-01');
            assert.strictEqual(norms.length, 1);
            assert.strictEqual(norms[0].resource_id, res.id);
        });

        // Case 35: Delete a resource used by a norm, or reported in use by a registered check -> CAT_IN_USE
        await runTestCase(35, 'Delete a resource used by a norm or registered check', async () => {
            const resNorm = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'INUSE-N-35',
                name: 'Norm Used Material',
                baseUnitId: u.kg.id,
            });
            const act = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'INUSE-ACT-35',
                name: 'Norm Holder',
                outputUnitId: u.m2.id,
            });
            await catalogService.setNorm(act.id, resNorm.id, 1, u.kg.id, '2026-01-01');

            await assert.rejects(
                () => catalogService.deleteResource(resNorm.id),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_IN_USE
            );

            const resExt = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'INUSE-E-35',
                name: 'External Check Material',
                baseUnitId: u.kg.id,
            });
            const unreg = catalogService.registerUsageCheck('resource', async ids => ids.filter(id => id === resExt.id));
            try {
                await assert.rejects(
                    () => catalogService.deleteResource(resExt.id),
                    err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_IN_USE
                );
            } finally {
                unreg();
            }
        });

        // Case 36: Delete an unused resource -> Removed, change logged
        await runTestCase(36, 'Delete an unused resource', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'DEL-36',
                name: 'Disposable Test Item',
                baseUnitId: u.nos.id,
            });
            const result = await catalogService.deleteResource(res.id, { reason: 'Created by mistake' });
            assert.strictEqual(result.deleted, true);

            const gone = await catalogService.getResource(res.id);
            assert.strictEqual(gone, undefined);

            const logs = await catalogService.getChangeLog('resource', res.id);
            assert.ok(logs.some(l => l.action === 'delete'));
        });

        // Case 37: Two simultaneous setRate calls for the same resource -> One succeeds or both ordered. No overlap.
        await runTestCase(37, 'Two simultaneous setRate calls for the same resource', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'CONC-R-37',
                name: 'Concurrent Rate Item',
                baseUnitId: u.kg.id,
            });

            const settled = await Promise.allSettled([
                catalogService.setRate(res.id, 100, u.kg.id, '2026-05-01'),
                catalogService.setRate(res.id, 110, u.kg.id, '2026-05-01'),
            ]);

            const fulfilled = settled.filter(s => s.status === 'fulfilled');
            const rejected = settled.filter(s => s.status === 'rejected');
            assert.strictEqual(fulfilled.length, 1);
            assert.strictEqual(rejected.length, 1);

            const rates = await catalogService.listRates(res.id);
            assert.strictEqual(rates.length, 1);
        });

        // Case 38: Two simultaneous imports of the same master -> One copy
        await runTestCase(38, 'Two simultaneous imports of the same master', async () => {
            const master = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'CONC-I-38',
                name: 'Concurrent Import Master',
                baseUnitId: u.kg.id,
            });

            const [c1, c2] = await Promise.all([
                catalogService.importResource(master.id, TEST_PROJECT_1),
                catalogService.importResource(master.id, TEST_PROJECT_1),
            ]);

            assert.strictEqual(c1.id, c2.id);
            const copies = await db('cat_resource').where({ org_id: TEST_ORG_1, project_id: TEST_PROJECT_1, parent_id: master.id });
            assert.strictEqual(copies.length, 1);
        });

        // Case 39: Corrupt rows by direct SQL, then run checkIntegrity -> Every violation reported
        await runTestCase(39, 'Corrupt rows by direct SQL, then run checkIntegrity', async () => {
            const master = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'CORR-M-39',
                name: 'Corrupt Master',
                baseUnitId: u.kg.id,
            });
            const otherMaster = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'CORR-M2-39',
                name: 'Other Master',
                baseUnitId: u.kg.id,
            });
            const projRes = await catalogService.createResource({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                kind: 'material',
                code: 'CORR-PR-39',
                name: 'Project Res',
                baseUnitId: u.kg.id,
            });
            const masterAct = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'CORR-MA-39',
                name: 'Master Act',
                outputUnitId: u.m2.id,
            });

            // 1. Corrupt master to have a parent_id
            await db('cat_resource').where({ id: master.id }).update({ parent_id: otherMaster.id });

            // 2. Corrupt norm mixing master activity with project resource
            const [badNormId] = await db('cat_activity_norm').insert({
                activity_id: masterAct.id,
                resource_id: projRes.id,
                qty_per_unit: '1.000000',
                unit_id: u.kg.id,
                effective_from: '2026-01-01',
                effective_to: null,
            });

            // 3. Corrupt overlapping rates
            const [r1Id] = await db('cat_rate').insert({
                resource_id: projRes.id,
                rate: '10.0000',
                unit_id: u.kg.id,
                effective_from: '2026-01-01',
                effective_to: '2026-06-30',
            });
            const [r2Id] = await db('cat_rate').insert({
                resource_id: projRes.id,
                rate: '12.0000',
                unit_id: u.kg.id,
                effective_from: '2026-04-01',
                effective_to: null,
            });

            // 4. Corrupt incompatible rate unit (m2 on kg resource)
            const [r3Id] = await db('cat_rate').insert({
                resource_id: otherMaster.id,
                rate: '15.0000',
                unit_id: u.m2.id,
                effective_from: '2026-01-01',
                effective_to: null,
            });

            const violations = await catalogService.checkIntegrity({ orgId: TEST_ORG_1 });
            const types = new Set(violations.map(v => v.type));
            assert.ok(types.has('MASTER_RESOURCE_HAS_PARENT'));
            assert.ok(types.has('NORM_SCOPE_MISMATCH'));
            assert.ok(types.has('OVERLAPPING_RATE_PERIODS'));
            assert.ok(types.has('RATE_UNIT_INCOMPATIBLE'));

            // Clean up corrupted rows so post-suite integrity check is clean
            await db('cat_resource').where({ id: master.id }).update({ parent_id: null });
            await db('cat_activity_norm').where({ id: badNormId }).delete();
            await db('cat_rate').whereIn('id', [r1Id, r2Id, r3Id]).delete();
        });

        // Case 40: assertProjectScoped with the wrong project -> Throws
        await runTestCase(40, 'assertProjectScoped with the wrong project', async () => {
            const master = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'GUARD-40',
                name: 'Guard Master',
                baseUnitId: u.kg.id,
            });
            const proj1Res = await catalogService.importResource(master.id, TEST_PROJECT_1);

            const ok = await catalogService.assertProjectScoped('resource', proj1Res.id, TEST_PROJECT_1);
            assert.strictEqual(ok.id, proj1Res.id);

            await assert.rejects(
                () => catalogService.assertProjectScoped('resource', master.id, TEST_PROJECT_1),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_SCOPE_MISMATCH
            );
            await assert.rejects(
                () => catalogService.assertProjectScoped('resource', proj1Res.id, TEST_PROJECT_2),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_SCOPE_MISMATCH
            );
        });

        // Case 41: expectedUsage, 20 m2 brickwork, norm 0.03 bag/m2, wastage 5%:
        // net 0.6, allowance 0.03, gross 0.63 (bags, then in base unit kg via resource conversion).
        await runTestCase(41, 'expectedUsage with wastage percentage and unit conversion', async () => {
            const cement = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'CEM-41',
                name: 'Portland Cement',
                baseUnitId: u.kg.id,
            });
            // 1 bag = 50 kg
            await catalogService.setConversion(cement.id, u.bag.id, u.kg.id, '50');

            const act = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'BW-41',
                name: 'Brickwork 200mm',
                outputUnitId: u.m2.id,
            });

            // 0.03 bag/m2 with 5% wastage
            await catalogService.setNorm(act.id, cement.id, '0.03', u.bag.id, '2026-01-01', 'Cement norm with 5% wastage', {
                wastagePct: 5,
            });

            const usage = await catalogService.expectedUsage(act.id, '20', '2026-06-01');
            assert.strictEqual(usage.items.length, 1);
            const line = usage.items[0];

            // 20 m2 * 0.03 bag/m2 = 0.6 bag. In kg: 0.6 * 50 = 30 kg.
            // Allowance: 30 kg * 5% = 1.5 kg (which is 0.03 bag * 50 kg).
            // Gross: 30 + 1.5 = 31.5 kg (which is 0.63 bag * 50 kg).
            assert.strictEqual(line.resourceId, cement.id);
            assert.strictEqual(line.unitId, u.kg.id);
            assert.strictEqual(line.netQty, 30);
            assert.strictEqual(line.allowanceQty, 1.5);
            assert.strictEqual(line.grossQty, 31.5);
            assert.strictEqual(line.qty, 31.5);
            assert.strictEqual(line.wastagePct, 5);
        });

        // Case 42: computeActivityCost uses gross: same activity at wastage 0 vs 10% differs by exactly 10%
        await runTestCase(42, 'computeActivityCost uses gross quantity for line amount and total', async () => {
            const steel = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'STEEL-42',
                name: 'Reinforcement Steel',
                baseUnitId: u.kg.id,
            });
            await catalogService.setRate(steel.id, '100', u.kg.id, '2026-01-01');

            const act0 = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ACT-42-ZERO',
                name: 'RCC with 0% wastage',
                outputUnitId: u.m3.id,
            });
            await catalogService.setNorm(act0.id, steel.id, '50', u.kg.id, '2026-01-01', null, { wastagePct: 0 });

            const act10 = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'ACT-42-TEN',
                name: 'RCC with 10% wastage',
                outputUnitId: u.m3.id,
            });
            await catalogService.setNorm(act10.id, steel.id, '50', u.kg.id, '2026-01-01', null, { wastagePct: 10 });

            const cost0 = await catalogService.computeActivityCost(act0.id, '2026-06-01');
            const cost10 = await catalogService.computeActivityCost(act10.id, '2026-06-01');

            // 50 kg * 100/kg = 5000 (0% wastage)
            assert.strictEqual(cost0.lines[0].netQty, 50);
            assert.strictEqual(cost0.lines[0].grossQty, 50);
            assert.strictEqual(cost0.lines[0].wastagePct, 0);
            assert.strictEqual(cost0.lines[0].amount, 5000);
            assert.strictEqual(cost0.total, 5000);

            // 50 kg * (1 + 10/100) = 55 kg gross * 100/kg = 5500 (10% wastage)
            assert.strictEqual(cost10.lines[0].netQty, 50);
            assert.strictEqual(cost10.lines[0].grossQty, 55);
            assert.strictEqual(cost10.lines[0].wastagePct, 10);
            assert.strictEqual(cost10.lines[0].amount, 5500);
            assert.strictEqual(cost10.total, 5500);

            // Exactly 10% difference
            assert.strictEqual(cost10.total, cost0.total * 1.1);
        });

        // Case 43: Default 0 leaves existing results unchanged. -1 and 100.001 are rejected with CAT_INVALID_VALUE
        await runTestCase(43, 'Default 0 leaves results unchanged, out-of-range wastage is rejected', async () => {
            const res = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'SAND-43',
                name: 'River Sand',
                baseUnitId: u.m3.id,
            });
            const act = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'PLAST-43',
                name: 'Plastering',
                outputUnitId: u.m2.id,
            });

            // Default without wastagePct option -> 0
            const norm = await catalogService.setNorm(act.id, res.id, '0.05', u.m3.id, '2026-01-01');
            assert.strictEqual(norm.wastage_pct, 0);

            // Range validation on setNorm: -1 and 100.001 rejected
            await assert.rejects(
                () => catalogService.setNorm(act.id, res.id, '0.05', u.m3.id, '2026-05-01', null, { wastagePct: -1 }),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_INVALID_VALUE
            );
            await assert.rejects(
                () => catalogService.setNorm(act.id, res.id, '0.05', u.m3.id, '2026-05-01', null, { wastagePct: '100.001' }),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_INVALID_VALUE
            );

            // Range validation on correctNorm
            await assert.rejects(
                () => catalogService.correctNorm(norm.id, { wastagePct: -0.001 }, 'Testing invalid negative'),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_INVALID_VALUE
            );
            await assert.rejects(
                () => catalogService.correctNorm(norm.id, { wastagePct: 100.5 }, 'Testing invalid excess'),
                err => err instanceof CatalogError && err.code === CatalogErrorCodes.CAT_INVALID_VALUE
            );

            // Valid correction to 7.5%
            const corrected = await catalogService.correctNorm(norm.id, { wastagePct: 7.5 }, 'Updated wastage allowance');
            assert.strictEqual(corrected.wastage_pct, 7.5);
        });

        // Case 44: importActivity copies wastage_pct. After editing on master, getSyncDiff shows it and acceptSync updates it
        await runTestCase(44, 'importActivity copies wastage_pct, getSyncDiff detects it and acceptSync updates it', async () => {
            const masterRes = await catalogService.createResource({
                orgId: TEST_ORG_1,
                kind: 'material',
                code: 'TILE-44',
                name: 'Ceramic Floor Tile',
                baseUnitId: u.m2.id,
            });
            const masterAct = await catalogService.createActivity({
                orgId: TEST_ORG_1,
                code: 'TILING-44',
                name: 'Floor Tiling Work',
                outputUnitId: u.m2.id,
            });
            const masterNorm = await catalogService.setNorm(masterAct.id, masterRes.id, '1.0', u.m2.id, '2026-01-01', null, {
                wastagePct: 4,
            });
            assert.strictEqual(masterNorm.wastage_pct, 4);

            // 1. importActivity copies wastage_pct
            const projAct = await catalogService.importActivity(masterAct.id, TEST_PROJECT_1);
            assert.strictEqual(projAct.norms.length, 1);
            assert.strictEqual(projAct.norms[0].wastage_pct, 4);

            // 2. Edit master norm wastage to 8% (bumps master version)
            const vBefore = (await catalogService.getActivity(masterAct.id)).version;
            await catalogService.correctNorm(masterNorm.id, { wastagePct: 8 }, 'Master breakage allowance increase');
            const masterUpdated = await catalogService.getActivity(masterAct.id);
            assert.strictEqual(masterUpdated.version, vBefore + 1);

            // 3. getSyncDiff detects norm difference including wastage_pct
            const diff = await catalogService.getSyncDiff('activity', projAct.id);
            assert.strictEqual(diff.isBehind, true);
            assert.strictEqual(diff.norms.changed, true);

            // 4. acceptSync with norms selection updates the project copy
            const synced = await catalogService.acceptActivitySync(projAct.id, { norms: true }, { reason: 'Sync master wastage' });
            assert.strictEqual(synced.norms[0].wastage_pct, 8);
            assert.strictEqual(synced.synced_version, masterUpdated.version);

            // Diff is now clean
            const diffAfter = await catalogService.getSyncDiff('activity', projAct.id);
            assert.strictEqual(diffAfter.isBehind, false);
            assert.strictEqual(diffAfter.norms.changed, false);
        });

        // Final integrity verification on the test tenant before cleanup
        const finalViolations = await catalogService.checkIntegrity({ orgId: TEST_ORG_1 });
        if (finalViolations.length > 0) {
            throw new Error(`Post-suite integrity check reported ${finalViolations.length} violations: ${JSON.stringify(finalViolations)}`);
        }

        console.log('====================================================');
        console.log(`📊 TEST RESULTS: ${passedCount}/${targetNum ? 1 : 44} PASSED, ${failedCount} FAILED`);
        console.log('====================================================');

        await cleanupTestData();
        if (closeDb) await db.destroy();

        return {
            total: targetNum ? 1 : 44,
            passed: passedCount,
            failed: failedCount,
            targetCase: targetNum || 'all',
            durationMs: Date.now() - suiteStartTime,
            results: testResults,
        };
    } catch (err) {
        console.error('Fatal catalog test runner error:', err);
        await cleanupTestData();
        if (closeDb) await db.destroy();
        throw err;
    }
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('catalogTests.js')) {
    const rawArg = process.argv[2] ? process.argv[2].replace(/^--case=/, '') : null;
    const targetCase = rawArg && !isNaN(Number(rawArg)) ? Number(rawArg) : null;

    runCatalogTestSuite({ targetCase, closeDb: true })
        .then(report => {
            process.exit(report.failed > 0 ? 1 : 0);
        })
        .catch(err => {
            console.error('CLI Test Execution Error:', err);
            process.exit(1);
        });
}

