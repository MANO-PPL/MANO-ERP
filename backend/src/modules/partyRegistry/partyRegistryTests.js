import assert from 'assert';
import db from '../../config/database.js';
import * as partyRegistryService from './partyRegistryService.js';
import { PartyRegistryError, PartyRegistryErrorCodes } from './partyRegistryErrors.js';

process.env.NODE_ENV = 'test';

const TEST_ORG_1 = 9981;
const TEST_ORG_2 = 9982;
const TEST_PROJECT_1 = 8871;
const TEST_PROJECT_2 = 8872;
const TEST_PROJECT_FOREIGN = 8873;
const TEST_PROJECT_FILTER = 8874;

async function cleanupTestData() {
    try {
        await db.raw('SET FOREIGN_KEY_CHECKS = 0');
        await db('proj_parties')
            .whereIn('project_id', [TEST_PROJECT_1, TEST_PROJECT_2, TEST_PROJECT_FOREIGN, TEST_PROJECT_FILTER])
            .delete();
        await db('crm_contacts')
            .whereIn('org_id', [TEST_ORG_1, TEST_ORG_2])
            .delete();
        await db('proj_projects')
            .whereIn('id', [TEST_PROJECT_1, TEST_PROJECT_2, TEST_PROJECT_FOREIGN, TEST_PROJECT_FILTER])
            .delete();
        await db('org_organizations')
            .whereIn('id', [TEST_ORG_1, TEST_ORG_2])
            .delete();
    } catch (err) {
        console.error('Error during cleanupTestData:', err);
    } finally {
        try {
            await db.raw('SET FOREIGN_KEY_CHECKS = 1');
        } catch (_) {}
    }
}

async function setupTestTenantsAndProjects() {
    // Upsert test organizations
    await db('org_organizations')
        .insert([
            { id: TEST_ORG_1, org_name: 'Test Tenant 1', org_code: 'TEST_ORG_1', status: 'active' },
            { id: TEST_ORG_2, org_name: 'Test Tenant 2', org_code: 'TEST_ORG_2', status: 'active' },
        ])
        .onConflict('id')
        .merge();

    // Upsert test projects
    await db('proj_projects')
        .insert([
            { id: TEST_PROJECT_1, org_id: TEST_ORG_1, name: 'Alpha Project 1', status: 'active' },
            { id: TEST_PROJECT_2, org_id: TEST_ORG_1, name: 'Beta Project 2', status: 'active' },
            { id: TEST_PROJECT_FOREIGN, org_id: TEST_ORG_2, name: 'Foreign Project Org2', status: 'active' },
            { id: TEST_PROJECT_FILTER, org_id: TEST_ORG_1, name: 'Filter Testing Project', status: 'active' },
        ])
        .onConflict('id')
        .merge();
}

async function createTestParty({ orgId, projectId, name, category, supplierOverride = null }) {
    const [contactId] = await db('crm_contacts').insert({
        org_id: orgId,
        name,
        category,
        scope: 'master',
    });

    const insertObj = {
        project_id: projectId,
        contact_id: contactId,
    };
    if (supplierOverride !== null && supplierOverride !== undefined) {
        insertObj.supplier_override = supplierOverride ? 1 : 0;
    }

    const [pvId] = await db('proj_parties').insert(insertObj);

    return { pvId, contactId, projectId, orgId, name, category };
}

/**
 * Runs the 14 test cases verifying the Party Registry Service against real MySQL.
 */
export async function runPartyRegistryTestSuite({ targetCase = null, closeDb = false } = {}) {
    const targetNum = targetCase && targetCase !== 'all' ? Number(targetCase) : null;
    const TOTAL_CASES = 14;
    const headerTitle = targetNum
        ? `RUNNING PARTY REGISTRY TEST (CASE ${targetNum})`
        : `RUNNING PARTY REGISTRY TEST SUITE (${TOTAL_CASES} CASES)`;

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
        const hasOverrideColumn = await db.schema.hasColumn('proj_parties', 'supplier_override');
        if (!hasOverrideColumn) {
            throw new Error(
                'Database migration required: column "supplier_override" does not exist on "proj_parties".\n' +
                'Please execute migration backend/src/db/sql/003_party_supplier_override.sql before running this test suite.'
            );
        }

        await cleanupTestData();
        await setupTestTenantsAndProjects();

        // ─── 1. getParty returns the full shape and supplierSource 'category' ────────
        await runTestCase(1, "getParty returns the full shape and supplierSource 'category'", async () => {
            const party = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Standard Contractor Firm',
                category: 'Contractor',
                supplierOverride: null,
            });

            const res = await partyRegistryService.getParty(TEST_ORG_1, party.pvId);
            assert.strictEqual(res.pvId, party.pvId);
            assert.strictEqual(res.projectId, TEST_PROJECT_1);
            assert.strictEqual(res.contactId, party.contactId);
            assert.strictEqual(res.name, 'Standard Contractor Firm');
            assert.strictEqual(res.category, 'Contractor');
            assert.strictEqual(res.isSupplier, false);
            assert.strictEqual(res.supplierSource, 'category');

            const expectedKeys = ['pvId', 'projectId', 'contactId', 'name', 'category', 'isSupplier', 'supplierSource'].sort();
            assert.deepStrictEqual(Object.keys(res).sort(), expectedKeys);
        });

        // ─── 2. Supplier category, no override -> isSupplier true ─────────────────────
        await runTestCase(2, 'Supplier category, no override -> isSupplier true', async () => {
            const party = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Standard Cement Supplier',
                category: 'Supplier',
                supplierOverride: null,
            });

            const res = await partyRegistryService.getParty(TEST_ORG_1, party.pvId);
            assert.strictEqual(res.isSupplier, true);
            assert.strictEqual(res.supplierSource, 'category');

            const isSupp = await partyRegistryService.isSupplier(TEST_ORG_1, party.pvId);
            assert.strictEqual(isSupp, true);
        });

        // ─── 3. Contractor, no override -> false ──────────────────────────────────────
        await runTestCase(3, 'Contractor, no override -> false', async () => {
            const party = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Civil Works Contractor',
                category: 'Contractor',
                supplierOverride: null,
            });

            const res = await partyRegistryService.getParty(TEST_ORG_1, party.pvId);
            assert.strictEqual(res.isSupplier, false);
            assert.strictEqual(res.supplierSource, 'category');

            const isSupp = await partyRegistryService.isSupplier(TEST_ORG_1, party.pvId);
            assert.strictEqual(isSupp, false);
        });

        // ─── 4. Contractor with override 1 -> true, source 'override' ─────────────────
        await runTestCase(4, "Contractor with override 1 -> true, source 'override'", async () => {
            const party = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Overridden Contractor To Supplier',
                category: 'Contractor',
                supplierOverride: null,
            });

            const updated = await partyRegistryService.setSupplierOverride(TEST_ORG_1, party.pvId, true, { userId: 1 });
            assert.strictEqual(updated.isSupplier, true);
            assert.strictEqual(updated.supplierSource, 'override');

            const fetched = await partyRegistryService.getParty(TEST_ORG_1, party.pvId);
            assert.strictEqual(fetched.isSupplier, true);
            assert.strictEqual(fetched.supplierSource, 'override');

            const isSupp = await partyRegistryService.isSupplier(TEST_ORG_1, party.pvId);
            assert.strictEqual(isSupp, true);
        });

        // ─── 5. Supplier with override 0 -> false ─────────────────────────────────────
        await runTestCase(5, 'Supplier with override 0 -> false', async () => {
            const party = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Demoted Supplier To Contractor',
                category: 'Supplier',
                supplierOverride: null,
            });

            const updated = await partyRegistryService.setSupplierOverride(TEST_ORG_1, party.pvId, false, { userId: 1 });
            assert.strictEqual(updated.isSupplier, false);
            assert.strictEqual(updated.supplierSource, 'override');

            const fetched = await partyRegistryService.getParty(TEST_ORG_1, party.pvId);
            assert.strictEqual(fetched.isSupplier, false);
            assert.strictEqual(fetched.supplierSource, 'override');

            const isSupp = await partyRegistryService.isSupplier(TEST_ORG_1, party.pvId);
            assert.strictEqual(isSupp, false);
        });

        // ─── 6. Override NULL again falls back to category ───────────────────────────
        await runTestCase(6, 'Override NULL again falls back to category', async () => {
            const supp = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Reverted Supplier',
                category: 'Supplier',
                supplierOverride: 0,
            });
            const cont = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Reverted Contractor',
                category: 'Contractor',
                supplierOverride: 1,
            });

            const suppReset = await partyRegistryService.setSupplierOverride(TEST_ORG_1, supp.pvId, null);
            assert.strictEqual(suppReset.isSupplier, true);
            assert.strictEqual(suppReset.supplierSource, 'category');

            const contReset = await partyRegistryService.setSupplierOverride(TEST_ORG_1, cont.pvId, null);
            assert.strictEqual(contReset.isSupplier, false);
            assert.strictEqual(contReset.supplierSource, 'category');
        });

        // ─── 7. Exact match: category string such as 'Ex-Supplier' is NOT a supplier ──
        await runTestCase(7, "Exact match: a category string such as 'Ex-Supplier' is NOT a supplier", async () => {
            // Pure logic unit verification:
            assert.strictEqual(partyRegistryService.computePartySupplierStatus('Ex-Supplier', null).isSupplier, false);
            assert.strictEqual(partyRegistryService.computePartySupplierStatus('Supplier-Pending', null).isSupplier, false);
            assert.strictEqual(partyRegistryService.computePartySupplierStatus('supplier', null).isSupplier, false);
            assert.strictEqual(partyRegistryService.computePartySupplierStatus('Supplier', null).isSupplier, true);

            // Database persistence verification: Manufacturer category
            const mfgParty = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Precast Manufacturer',
                category: 'Manufacturer',
                supplierOverride: null,
            });

            const res = await partyRegistryService.getParty(TEST_ORG_1, mfgParty.pvId);
            assert.strictEqual(res.category, 'Manufacturer');
            assert.strictEqual(res.isSupplier, false);
            assert.strictEqual(res.supplierSource, 'category');
        });

        // ─── 8. Same contact in two projects: override in project A does not change project B
        await runTestCase(8, 'Same contact in two projects: override set in project A does not change project B', async () => {
            const [contactId] = await db('crm_contacts').insert({
                org_id: TEST_ORG_1,
                name: 'Shared Subcontractor Corp',
                category: 'Contractor',
                scope: 'master',
            });

            const [pvIdA] = await db('proj_parties').insert({
                project_id: TEST_PROJECT_1,
                contact_id: contactId,
                supplier_override: null,
            });

            const [pvIdB] = await db('proj_parties').insert({
                project_id: TEST_PROJECT_2,
                contact_id: contactId,
                supplier_override: null,
            });

            // Set override on Project A only
            await partyRegistryService.setSupplierOverride(TEST_ORG_1, pvIdA, true);

            const partyA = await partyRegistryService.getParty(TEST_ORG_1, pvIdA);
            const partyB = await partyRegistryService.getParty(TEST_ORG_1, pvIdB);

            assert.strictEqual(partyA.isSupplier, true);
            assert.strictEqual(partyA.supplierSource, 'override');

            assert.strictEqual(partyB.isSupplier, false);
            assert.strictEqual(partyB.supplierSource, 'category');

            const rawB = await db('proj_parties').where({ id: pvIdB }).first();
            assert.strictEqual(rawB.supplier_override, null);
        });

        // ─── 9. assertProjectParty with a party from another project -> PARTY_NOT_IN_PROJECT
        await runTestCase(9, 'assertProjectParty with a party from another project -> PARTY_NOT_IN_PROJECT', async () => {
            const partyProj1 = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Project 1 Dedicated Party',
                category: 'Contractor',
            });

            // Asserting for its own project succeeds
            const verified = await partyRegistryService.assertProjectParty(TEST_ORG_1, partyProj1.pvId, TEST_PROJECT_1);
            assert.strictEqual(verified.pvId, partyProj1.pvId);

            // Asserting for another project throws PARTY_NOT_IN_PROJECT
            await assert.rejects(
                async () => partyRegistryService.assertProjectParty(TEST_ORG_1, partyProj1.pvId, TEST_PROJECT_2),
                (err) => {
                    assert.strictEqual(err.code, PartyRegistryErrorCodes.PARTY_NOT_IN_PROJECT);
                    assert.ok(err.message.includes(`Party ${partyProj1.pvId} is not in project ${TEST_PROJECT_2}`));
                    return true;
                }
            );
        });

        // ─── 10. Unknown id, and a party of another org -> PARTY_NOT_FOUND (identical message)
        await runTestCase(10, 'Unknown id, and a party of another org -> PARTY_NOT_FOUND (identical message either way)', async () => {
            const UNKNOWN_PVID = 999999;

            let unknownMsg = '';
            await assert.rejects(
                async () => partyRegistryService.getParty(TEST_ORG_1, UNKNOWN_PVID),
                (err) => {
                    assert.strictEqual(err.code, PartyRegistryErrorCodes.PARTY_NOT_FOUND);
                    unknownMsg = err.message;
                    return true;
                }
            );

            // Create party in TEST_ORG_2
            const foreignParty = await createTestParty({
                orgId: TEST_ORG_2,
                projectId: TEST_PROJECT_FOREIGN,
                name: 'Foreign Org Party',
                category: 'Supplier',
            });

            let foreignOrgMsg = '';
            await assert.rejects(
                async () => partyRegistryService.getParty(TEST_ORG_1, foreignParty.pvId),
                (err) => {
                    assert.strictEqual(err.code, PartyRegistryErrorCodes.PARTY_NOT_FOUND);
                    foreignOrgMsg = err.message;
                    return true;
                }
            );

            assert.strictEqual(unknownMsg, `Party ${UNKNOWN_PVID} not found`);
            assert.strictEqual(foreignOrgMsg, `Party ${foreignParty.pvId} not found`);
            assert.ok(!foreignOrgMsg.toLowerCase().includes('org'));
            assert.ok(!foreignOrgMsg.toLowerCase().includes('tenant'));
        });

        // ─── 11. getPartiesByIds with 3 valid, 1 missing, 1 wrong-project -> error naming both
        await runTestCase(11, 'getPartiesByIds with 3 valid, 1 missing, 1 wrong-project -> error naming exactly those two', async () => {
            const p1 = await createTestParty({ orgId: TEST_ORG_1, projectId: TEST_PROJECT_1, name: 'Batch 1', category: 'Supplier' });
            const p2 = await createTestParty({ orgId: TEST_ORG_1, projectId: TEST_PROJECT_1, name: 'Batch 2', category: 'Contractor' });
            const p3 = await createTestParty({ orgId: TEST_ORG_1, projectId: TEST_PROJECT_1, name: 'Batch 3', category: 'Consultant' });
            const pWrong = await createTestParty({ orgId: TEST_ORG_1, projectId: TEST_PROJECT_2, name: 'Wrong Project Party', category: 'Supplier' });
            const MISSING_PVID = 999998;

            await assert.rejects(
                async () => partyRegistryService.getPartiesByIds(TEST_ORG_1, TEST_PROJECT_1, [
                    p1.pvId,
                    p2.pvId,
                    p3.pvId,
                    MISSING_PVID,
                    pWrong.pvId,
                ]),
                (err) => {
                    assert.strictEqual(err.code, PartyRegistryErrorCodes.PARTY_NOT_IN_PROJECT);
                    assert.ok(err.message.includes(String(MISSING_PVID)), `Error should name missing ID ${MISSING_PVID}`);
                    assert.ok(err.message.includes(String(pWrong.pvId)), `Error should name wrong-project ID ${pWrong.pvId}`);
                    assert.deepStrictEqual(err.details.missingIds, [MISSING_PVID]);
                    assert.deepStrictEqual(err.details.wrongProjectIds, [pWrong.pvId]);
                    return true;
                }
            );

            // Valid invocation returns Map with full shape
            const validMap = await partyRegistryService.getPartiesByIds(TEST_ORG_1, TEST_PROJECT_1, [p1.pvId, p2.pvId, p3.pvId]);
            assert.strictEqual(validMap instanceof Map, true);
            assert.strictEqual(validMap.size, 3);
            assert.strictEqual(validMap.get(p1.pvId).isSupplier, true);
            assert.strictEqual(validMap.get(p2.pvId).isSupplier, false);
            assert.strictEqual(validMap.get(p3.pvId).isSupplier, false);
        });

        // ─── 12. listProjectParties filters & isolation ────────────────────────────────
        await runTestCase(12, "listProjectParties filters by category, isSupplier and search, and never returns another project's or org's parties", async () => {
            const p1 = await createTestParty({ orgId: TEST_ORG_1, projectId: TEST_PROJECT_FILTER, name: 'Alpha Steel Mills', category: 'Supplier' });
            const p2 = await createTestParty({ orgId: TEST_ORG_1, projectId: TEST_PROJECT_FILTER, name: 'Beta Fabricators', category: 'Contractor', supplierOverride: 1 });
            const p3 = await createTestParty({ orgId: TEST_ORG_1, projectId: TEST_PROJECT_FILTER, name: 'Gamma Constructors', category: 'Contractor' });
            const p4 = await createTestParty({ orgId: TEST_ORG_1, projectId: TEST_PROJECT_FILTER, name: 'Delta Structural Design', category: 'Consultant' });

            // Parties outside target scope
            const pOtherProj = await createTestParty({ orgId: TEST_ORG_1, projectId: TEST_PROJECT_2, name: 'Alpha Steel Project 2', category: 'Supplier' });
            const pOtherOrg = await createTestParty({ orgId: TEST_ORG_2, projectId: TEST_PROJECT_FOREIGN, name: 'Alpha Steel Foreign Org', category: 'Supplier' });

            // Unfiltered list for TEST_PROJECT_FILTER
            const allProj = await partyRegistryService.listProjectParties(TEST_ORG_1, TEST_PROJECT_FILTER);
            const projPvIds = allProj.map(p => p.pvId);
            assert.strictEqual(allProj.length, 4);
            assert.ok(projPvIds.includes(p1.pvId));
            assert.ok(projPvIds.includes(p2.pvId));
            assert.ok(projPvIds.includes(p3.pvId));
            assert.ok(projPvIds.includes(p4.pvId));
            assert.ok(!projPvIds.includes(pOtherProj.pvId));
            assert.ok(!projPvIds.includes(pOtherOrg.pvId));

            // Category filter: Contractor
            const contractors = await partyRegistryService.listProjectParties(TEST_ORG_1, TEST_PROJECT_FILTER, { category: 'Contractor' });
            assert.strictEqual(contractors.length, 2);
            assert.ok(contractors.every(p => p.category === 'Contractor'));

            // isSupplier filter: true (Supplier category OR Contractor with override 1)
            const suppliers = await partyRegistryService.listProjectParties(TEST_ORG_1, TEST_PROJECT_FILTER, { isSupplier: true });
            const supplierPvIds = suppliers.map(p => p.pvId);
            assert.strictEqual(suppliers.length, 2);
            assert.ok(supplierPvIds.includes(p1.pvId));
            assert.ok(supplierPvIds.includes(p2.pvId));
            assert.ok(!supplierPvIds.includes(p3.pvId));
            assert.ok(!supplierPvIds.includes(p4.pvId));

            // isSupplier filter: false
            const nonSuppliers = await partyRegistryService.listProjectParties(TEST_ORG_1, TEST_PROJECT_FILTER, { isSupplier: false });
            const nonSupplierPvIds = nonSuppliers.map(p => p.pvId);
            assert.strictEqual(nonSuppliers.length, 2);
            assert.ok(nonSupplierPvIds.includes(p3.pvId));
            assert.ok(nonSupplierPvIds.includes(p4.pvId));
            assert.ok(!nonSupplierPvIds.includes(p1.pvId));
            assert.ok(!nonSupplierPvIds.includes(p2.pvId));

            // Search filter: 'Fabricators'
            const searchResults = await partyRegistryService.listProjectParties(TEST_ORG_1, TEST_PROJECT_FILTER, { search: 'Fabricators' });
            assert.strictEqual(searchResults.length, 1);
            assert.strictEqual(searchResults[0].pvId, p2.pvId);

            // Search filter: 'Alpha' (only matches Alpha Steel Mills in TEST_PROJECT_FILTER, not pOtherProj or pOtherOrg)
            const searchAlpha = await partyRegistryService.listProjectParties(TEST_ORG_1, TEST_PROJECT_FILTER, { search: 'Alpha' });
            assert.strictEqual(searchAlpha.length, 1);
            assert.strictEqual(searchAlpha[0].pvId, p1.pvId);

            // Cross-tenant verification: Foreign org querying TEST_PROJECT_FILTER throws PARTY_NOT_FOUND
            await assert.rejects(
                async () => partyRegistryService.listProjectParties(TEST_ORG_2, TEST_PROJECT_FILTER),
                (err) => err.code === PartyRegistryErrorCodes.PARTY_NOT_FOUND
            );
        });

        // ─── 13. setSupplierOverride accepts true/false/null, rejects anything else ───
        await runTestCase(13, 'setSupplierOverride accepts true/false/null, rejects anything else', async () => {
            const party = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Validation Testing Party',
                category: 'Contractor',
            });

            const invalidValues = ['true', 'false', 'null', 1, 0, '1', '0', undefined, {}, [], NaN, 'supplier'];
            for (const val of invalidValues) {
                await assert.rejects(
                    async () => partyRegistryService.setSupplierOverride(TEST_ORG_1, party.pvId, val),
                    (err) => {
                        assert.strictEqual(err.code, PartyRegistryErrorCodes.PARTY_INVALID_VALUE);
                        return true;
                    },
                    `Expected setSupplierOverride to reject value: ${JSON.stringify(val)}`
                );
            }

            // Valid values
            const rTrue = await partyRegistryService.setSupplierOverride(TEST_ORG_1, party.pvId, true);
            assert.strictEqual(rTrue.isSupplier, true);

            const rFalse = await partyRegistryService.setSupplierOverride(TEST_ORG_1, party.pvId, false);
            assert.strictEqual(rFalse.isSupplier, false);

            const rNull = await partyRegistryService.setSupplierOverride(TEST_ORG_1, party.pvId, null);
            assert.strictEqual(rNull.isSupplier, false); // Falls back to Contractor -> false
        });

        // ─── 14. No write other than supplier_override happens ────────────────────────
        await runTestCase(14, 'No write other than supplier_override happens (assert row counts and other columns unchanged)', async () => {
            const targetParty = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Strict Integrity Candidate',
                category: 'Contractor',
                supplierOverride: null,
            });

            const controlParty = await createTestParty({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                name: 'Strict Integrity Control',
                category: 'Supplier',
                supplierOverride: null,
            });

            const countContactsBefore = Number((await db('crm_contacts').count('* as cnt').first()).cnt);
            const countProjectsBefore = Number((await db('proj_projects').count('* as cnt').first()).cnt);
            const countPartiesBefore = Number((await db('proj_parties').count('* as cnt').first()).cnt);

            const rowTargetBefore = await db('proj_parties').where({ id: targetParty.pvId }).first();
            const rowControlBefore = await db('proj_parties').where({ id: controlParty.pvId }).first();

            // Perform override update
            await partyRegistryService.setSupplierOverride(TEST_ORG_1, targetParty.pvId, true, { userId: 42 });

            const countContactsAfter = Number((await db('crm_contacts').count('* as cnt').first()).cnt);
            const countProjectsAfter = Number((await db('proj_projects').count('* as cnt').first()).cnt);
            const countPartiesAfter = Number((await db('proj_parties').count('* as cnt').first()).cnt);

            assert.strictEqual(countContactsAfter, countContactsBefore, 'crm_contacts count must not change');
            assert.strictEqual(countProjectsAfter, countProjectsBefore, 'proj_projects count must not change');
            assert.strictEqual(countPartiesAfter, countPartiesBefore, 'proj_parties count must not change');

            const rowTargetAfter = await db('proj_parties').where({ id: targetParty.pvId }).first();
            const rowControlAfter = await db('proj_parties').where({ id: controlParty.pvId }).first();

            // Verify target party row: only supplier_override changed
            assert.strictEqual(rowTargetAfter.contact_id, rowTargetBefore.contact_id);
            assert.strictEqual(rowTargetAfter.project_id, rowTargetBefore.project_id);
            assert.strictEqual(new Date(rowTargetAfter.joined_at).getTime(), new Date(rowTargetBefore.joined_at).getTime());
            assert.strictEqual(rowTargetBefore.supplier_override, null);
            assert.strictEqual(rowTargetAfter.supplier_override, 1);

            // Verify control party row: completely identical
            assert.deepStrictEqual(rowControlAfter, rowControlBefore);
        });

        console.log('====================================================');
        console.log(`📊 TEST RESULTS: ${passedCount}/${targetNum ? 1 : TOTAL_CASES} PASSED, ${failedCount} FAILED`);
        console.log('====================================================');

        await cleanupTestData();
        if (closeDb) await db.destroy();

        return {
            total: targetNum ? 1 : TOTAL_CASES,
            passed: passedCount,
            failed: failedCount,
            targetCase: targetNum || 'all',
            durationMs: Date.now() - suiteStartTime,
            results: testResults,
        };
    } catch (err) {
        console.error('Fatal Party Registry test runner error:', err);
        await cleanupTestData();
        if (closeDb) await db.destroy();
        throw err;
    }
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('partyRegistryTests.js')) {
    const rawArg = process.argv[2] ? process.argv[2].replace(/^--case=/, '') : null;
    const targetCase = rawArg && !isNaN(Number(rawArg)) ? Number(rawArg) : null;

    runPartyRegistryTestSuite({ targetCase, closeDb: true })
        .then(report => {
            process.exit(report.failed > 0 ? 1 : 0);
        })
        .catch(err => {
            console.error('CLI Test Execution Error:', err);
            process.exit(1);
        });
}
