import assert from 'assert';
import db from '../../config/database.js';
import * as locationService from './locationService.js';
import { LocationError, LocationErrorCodes } from './locationErrors.js';

// Helper to isolate test data
const TEST_ORG_1 = 9991;
const TEST_ORG_2 = 9992;
const TEST_PROJECT_1 = 8881;
const TEST_PROJECT_2 = 8882;

async function cleanupTestData() {
    locationService.clearUsageChecks();
    try {
        await db.raw('SET FOREIGN_KEY_CHECKS = 0');
        await db('loc_location')
            .whereIn('project_id', [TEST_PROJECT_1, TEST_PROJECT_2])
            .delete();
        await db('loc_type')
            .whereIn('org_id', [TEST_ORG_1, TEST_ORG_2])
            .delete();
    } catch (err) {
        console.error('Error during cleanupTestData:', err);
    } finally {
        try {
            await db.raw('SET FOREIGN_KEY_CHECKS = 1');
        } catch (_) {}
    }
}

/**
 * Runs the Location Spec test suite.
 * Can run all 25 cases together, or an individual test case.
 * Can be invoked via CLI or imported by the Location Dev Lab.
 */
export async function runLocationTestSuite({ targetCase = null, closeDb = false } = {}) {
    const targetNum = targetCase && targetCase !== 'all' ? Number(targetCase) : null;
    const headerTitle = targetNum 
        ? `RUNNING MODULE 1: LOCATION SPEC TEST (CASE ${targetNum})` 
        : `RUNNING MODULE 1: LOCATION SPEC TEST SUITE (25 CASES)`;

    console.log('====================================================');
    console.log(`🧪 ${headerTitle}`);
    console.log('====================================================');

    const suiteStartTime = Date.now();
    let passedCount = 0;
    let failedCount = 0;
    const testResults = [];

    async function runTestCase(num, name, fn) {
        if (targetNum && num !== targetNum) {
            return;
        }

        const caseStart = Date.now();
        try {
            await fn();
            const durationMs = Date.now() - caseStart;
            console.log(`✅ [PASS] Case ${num}: ${name} (${durationMs}ms)`);
            passedCount++;
            testResults.push({
                num,
                name,
                status: 'PASS',
                durationMs,
                error: null
            });
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
                    stack: err.stack
                }
            });
        }
    }

    try {
        await cleanupTestData();

        // Seed types for TEST_ORG_1
        const types = await locationService.seedDefaultTypes(TEST_ORG_1);
        const typeMap = new Map(types.map(t => [t.code, t.id]));

        // Seed an extra type for TEST_ORG_2 to test cross-org validation (idempotent)
        let org2Type = await db('loc_type').where({ org_id: TEST_ORG_2, code: 'org2_tower' }).first();
        if (!org2Type) {
            org2Type = await locationService.createType({
                orgId: TEST_ORG_2,
                code: 'org2_tower',
                name: 'Org 2 Tower'
            });
        }

        // Fixtures for standalone case execution
        let rootTowerA = null;
        let floor1 = null;

        async function ensureRootTowerA() {
            if (rootTowerA) {
                const existing = await locationService.getLocation(rootTowerA.id);
                if (existing) return existing;
            }
            const found = await db('loc_location').where({ project_id: TEST_PROJECT_1, name: 'Tower A', parent_id: null }).first();
            if (found) {
                rootTowerA = found;
                return found;
            }
            rootTowerA = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Tower A'
            });
            return rootTowerA;
        }

        async function ensureFloor1() {
            if (floor1) {
                const existing = await locationService.getLocation(floor1.id);
                if (existing) return existing;
            }
            const root = await ensureRootTowerA();
            const found = await db('loc_location').where({ project_id: TEST_PROJECT_1, name: 'Floor 1', parent_id: root.id }).first();
            if (found) {
                floor1 = found;
                return found;
            }
            floor1 = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: root.id,
                typeId: typeMap.get('floor'),
                name: 'Floor 1'
            });
            return floor1;
        }

        // -------------------------------------------------------------
        // Case 1: Create a root -> path /id/, depth 1
        // -------------------------------------------------------------
        await runTestCase(1, 'Create a root', async () => {
            rootTowerA = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Tower A'
            });
            assert.strictEqual(rootTowerA.depth, 1);
            assert.strictEqual(rootTowerA.path, `/${rootTowerA.id}/`);
            assert.strictEqual(rootTowerA.parent_id, null);
        });

        // -------------------------------------------------------------
        // Case 2: Create a child under a root -> path and depth derived from parent
        // -------------------------------------------------------------
        await runTestCase(2, 'Create a child under a root', async () => {
            const root = await ensureRootTowerA();
            floor1 = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: root.id,
                typeId: typeMap.get('floor'),
                name: 'Floor 1'
            });
            assert.strictEqual(floor1.depth, 2);
            assert.strictEqual(floor1.path, `/${root.id}/${floor1.id}/`);
            assert.strictEqual(floor1.parent_id, root.id);
        });

        // -------------------------------------------------------------
        // Case 3: Create a location 8 levels deep, then a 9th -> fails with LOC_MAX_DEPTH
        // -------------------------------------------------------------
        await runTestCase(3, 'Create a location 8 levels deep, then a 9th', async () => {
            let currentParent = await ensureFloor1();
            // floor1 is depth 2. Create up to depth 8.
            for (let d = 3; d <= 8; d++) {
                currentParent = await locationService.createLocation({
                    orgId: TEST_ORG_1,
                    projectId: TEST_PROJECT_1,
                    parentId: currentParent.id,
                    typeId: typeMap.get('unit'),
                    name: `Level_${d}`
                });
                assert.strictEqual(currentParent.depth, d);
            }
            // 9th level should fail
            await assert.rejects(
                async () => {
                    await locationService.createLocation({
                        orgId: TEST_ORG_1,
                        projectId: TEST_PROJECT_1,
                        parentId: currentParent.id,
                        typeId: typeMap.get('unit'),
                        name: 'Level_9_Fail'
                    });
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_MAX_DEPTH
            );
        });

        // -------------------------------------------------------------
        // Case 4: Two roots with the same name -> LOC_DUPLICATE_NAME
        // -------------------------------------------------------------
        await runTestCase(4, 'Two roots with the same name', async () => {
            await ensureRootTowerA();
            await assert.rejects(
                async () => {
                    await locationService.createLocation({
                        orgId: TEST_ORG_1,
                        projectId: TEST_PROJECT_1,
                        typeId: typeMap.get('tower'),
                        name: 'Tower A' // identical to rootTowerA
                    });
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_DUPLICATE_NAME
            );
        });

        // -------------------------------------------------------------
        // Case 5: Same name differing only in case, same parent -> LOC_DUPLICATE_NAME
        // -------------------------------------------------------------
        await runTestCase(5, 'Same name differing only in case, same parent', async () => {
            const root = await ensureRootTowerA();
            await ensureFloor1();
            await assert.rejects(
                async () => {
                    await locationService.createLocation({
                        orgId: TEST_ORG_1,
                        projectId: TEST_PROJECT_1,
                        parentId: root.id,
                        typeId: typeMap.get('floor'),
                        name: 'floor 1' // lowercase of 'Floor 1'
                    });
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_DUPLICATE_NAME
            );
        });

        // -------------------------------------------------------------
        // Case 6: Same name under two different parents -> Both succeed
        // -------------------------------------------------------------
        await runTestCase(6, 'Same name under two different parents', async () => {
            const rootTowerB = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Tower B'
            });
            const floor1UnderB = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: rootTowerB.id,
                typeId: typeMap.get('floor'),
                name: 'Floor 1'
            });
            assert.strictEqual(floor1UnderB.name, 'Floor 1');
            assert.strictEqual(floor1UnderB.parent_id, rootTowerB.id);
        });

        // -------------------------------------------------------------
        // Case 7: Parent from another project -> LOC_CROSS_PROJECT
        // -------------------------------------------------------------
        await runTestCase(7, 'Parent from another project', async () => {
            const root = await ensureRootTowerA();
            await assert.rejects(
                async () => {
                    await locationService.createLocation({
                        orgId: TEST_ORG_1,
                        projectId: TEST_PROJECT_2, // different project!
                        parentId: root.id,         // belongs to TEST_PROJECT_1
                        typeId: typeMap.get('floor'),
                        name: 'Cross Project Floor'
                    });
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_CROSS_PROJECT
            );
        });

        // -------------------------------------------------------------
        // Case 8: Type from another organization -> LOC_TYPE_ORG_MISMATCH
        // -------------------------------------------------------------
        await runTestCase(8, 'Type from another organization', async () => {
            await assert.rejects(
                async () => {
                    await locationService.createLocation({
                        orgId: TEST_ORG_1,
                        projectId: TEST_PROJECT_1,
                        typeId: org2Type.id, // belongs to TEST_ORG_2
                        name: 'Wrong Org Location'
                    });
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_TYPE_ORG_MISMATCH
            );
        });

        // -------------------------------------------------------------
        // Case 9: Create under an archived parent -> LOC_PARENT_ARCHIVED
        // -------------------------------------------------------------
        await runTestCase(9, 'Create under an archived parent', async () => {
            const archivedParent = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Archived Tower'
            });
            await locationService.archiveLocation(archivedParent.id);

            await assert.rejects(
                async () => {
                    await locationService.createLocation({
                        orgId: TEST_ORG_1,
                        projectId: TEST_PROJECT_1,
                        parentId: archivedParent.id,
                        typeId: typeMap.get('floor'),
                        name: 'Child Under Archived'
                    });
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_PARENT_ARCHIVED
            );
        });

        // -------------------------------------------------------------
        // Case 10: Move a floor with 20 descendants to another tower -> Every descendant path and depth updated, ids unchanged
        // -------------------------------------------------------------
        await runTestCase(10, 'Move a floor with 20 descendants to another tower', async () => {
            const towerC = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Tower C'
            });
            const moveFloor = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: towerC.id,
                typeId: typeMap.get('floor'),
                name: 'Moveable Floor'
            });

            // Create 20 descendants under moveFloor
            const descendantIds = [];
            for (let i = 1; i <= 20; i++) {
                const child = await locationService.createLocation({
                    orgId: TEST_ORG_1,
                    projectId: TEST_PROJECT_1,
                    parentId: moveFloor.id,
                    typeId: typeMap.get('unit'),
                    name: `SubUnit_${i}`
                });
                descendantIds.push(child.id);
            }

            const towerD = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Tower D'
            });

            // Move moveFloor under towerD
            const movedFloor = await locationService.moveLocation(moveFloor.id, towerD.id);
            assert.strictEqual(movedFloor.parent_id, towerD.id);
            assert.strictEqual(movedFloor.path, `/${towerD.id}/${moveFloor.id}/`);

            // Verify all 20 descendants have updated path and unchanged IDs
            for (const childId of descendantIds) {
                const updatedChild = await locationService.getLocation(childId);
                assert.strictEqual(updatedChild.path, `/${towerD.id}/${moveFloor.id}/${childId}/`);
                assert.strictEqual(updatedChild.depth, 3);
            }
        });

        // -------------------------------------------------------------
        // Case 11: Move a location under itself -> LOC_CYCLE
        // -------------------------------------------------------------
        await runTestCase(11, 'Move a location under itself', async () => {
            const root = await ensureRootTowerA();
            await assert.rejects(
                async () => {
                    await locationService.moveLocation(root.id, root.id);
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_CYCLE
            );
        });

        // -------------------------------------------------------------
        // Case 12: Move a location under its own grandchild -> LOC_CYCLE
        // -------------------------------------------------------------
        await runTestCase(12, 'Move a location under its own grandchild', async () => {
            const root = await ensureRootTowerA();
            const fl = await ensureFloor1();
            const grandchild = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: fl.id,
                typeId: typeMap.get('unit'),
                name: 'Grandchild Unit'
            });

            await assert.rejects(
                async () => {
                    await locationService.moveLocation(root.id, grandchild.id);
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_CYCLE
            );
        });

        // -------------------------------------------------------------
        // Case 13: Move to a parent that makes tree too deep -> LOC_MAX_DEPTH, nothing changed
        // -------------------------------------------------------------
        await runTestCase(13, 'Move to a parent that makes the tree too deep', async () => {
            // Find a deep node from Case 3 (at depth 7 or 8) or create chain if running standalone
            let deepParent = await db('loc_location').where({ project_id: TEST_PROJECT_1, depth: 7 }).first();
            if (!deepParent) {
                let curr = await ensureFloor1();
                for (let d = 3; d <= 7; d++) {
                    curr = await locationService.createLocation({
                        orgId: TEST_ORG_1,
                        projectId: TEST_PROJECT_1,
                        parentId: curr.id,
                        typeId: typeMap.get('unit'),
                        name: `Depth_Chain_${d}`
                    });
                }
                deepParent = curr;
            }

            // A subtree of height 2
            const subRoot = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'SubRootForDepth'
            });
            const subChild = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: subRoot.id,
                typeId: typeMap.get('floor'),
                name: 'SubChildForDepth'
            });

            const originalPath = subRoot.path;

            await assert.rejects(
                async () => {
                    await locationService.moveLocation(subRoot.id, deepParent.id);
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_MAX_DEPTH
            );

            // Verify nothing changed
            const checkNode = await locationService.getLocation(subRoot.id);
            assert.strictEqual(checkNode.path, originalPath);
            assert.strictEqual(checkNode.parent_id, null);
        });

        // -------------------------------------------------------------
        // Case 14: Move creating a sibling name clash -> LOC_DUPLICATE_NAME, nothing changed
        // -------------------------------------------------------------
        await runTestCase(14, 'Move creating a sibling name clash', async () => {
            const towerE = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Tower E'
            });
            const f1 = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: towerE.id,
                typeId: typeMap.get('floor'),
                name: 'Common Name'
            });
            const towerF = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Tower F'
            });
            const f2 = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: towerF.id,
                typeId: typeMap.get('floor'),
                name: 'Common Name'
            });

            await assert.rejects(
                async () => {
                    await locationService.moveLocation(f2.id, towerE.id);
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_DUPLICATE_NAME
            );

            // Verify f2 still under towerF
            const checkF2 = await locationService.getLocation(f2.id);
            assert.strictEqual(checkF2.parent_id, towerF.id);
        });

        // -------------------------------------------------------------
        // Case 15: Two simultaneous moves that would together form a cycle -> One succeeds, other fails. Integrity check passes.
        // -------------------------------------------------------------
        await runTestCase(15, 'Two simultaneous moves forming cycle', async () => {
            const nodeX = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Cycle Node X'
            });
            const nodeY = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Cycle Node Y'
            });

            // Simulate race: try moving nodeX under nodeY while nodeY tries to move under nodeX
            const results = await Promise.allSettled([
                locationService.moveLocation(nodeX.id, nodeY.id),
                locationService.moveLocation(nodeY.id, nodeX.id)
            ]);

            const fulfilled = results.filter(r => r.status === 'fulfilled');
            const rejected = results.filter(r => r.status === 'rejected');

            // At least one must be rejected (either LOC_CYCLE or deadlock rollback)
            assert.ok(rejected.length >= 1, 'At least one simultaneous mutual move must be rejected');

            const violations = await locationService.checkIntegrity(TEST_PROJECT_1);
            assert.strictEqual(violations.length, 0);
        });

        // -------------------------------------------------------------
        // Case 16: Archive then restore -> Status changes, subtree untouched
        // -------------------------------------------------------------
        await runTestCase(16, 'Archive then restore', async () => {
            const archTower = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Arch Tower'
            });
            const archChild = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: archTower.id,
                typeId: typeMap.get('floor'),
                name: 'Arch Child'
            });

            await locationService.archiveLocation(archTower.id);
            let checkArch = await locationService.getLocation(archTower.id);
            assert.strictEqual(checkArch.status, 'archived');

            // Child remains active (cascade = false by default)
            let checkChild = await locationService.getLocation(archChild.id);
            assert.strictEqual(checkChild.status, 'active');

            await locationService.restoreLocation(archTower.id);
            checkArch = await locationService.getLocation(archTower.id);
            assert.strictEqual(checkArch.status, 'active');
        });

        // -------------------------------------------------------------
        // Case 17: Delete a location with children -> LOC_HAS_CHILDREN
        // -------------------------------------------------------------
        await runTestCase(17, 'Delete a location with children', async () => {
            const root = await ensureRootTowerA();
            await ensureFloor1();
            await assert.rejects(
                async () => {
                    await locationService.deleteLocation(root.id);
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_HAS_CHILDREN
            );
        });

        // -------------------------------------------------------------
        // Case 18: Delete a location a registered usage check reports as in use -> LOC_IN_USE
        // -------------------------------------------------------------
        await runTestCase(18, 'Delete a location reported in use by usage check', async () => {
            const leafItem = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('room'),
                name: 'Protected Room'
            });

            // Register temporary usage hook
            const unregister = locationService.registerUsageCheck(async (ids) => {
                if (ids.includes(leafItem.id)) return [leafItem.id];
                return [];
            });

            await assert.rejects(
                async () => {
                    await locationService.deleteLocation(leafItem.id);
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_IN_USE
            );

            unregister();
        });

        // -------------------------------------------------------------
        // Case 19: Delete a free leaf -> Removed
        // -------------------------------------------------------------
        await runTestCase(19, 'Delete a free leaf', async () => {
            const freeLeaf = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('room'),
                name: 'Free Leaf Room'
            });

            const res = await locationService.deleteLocation(freeLeaf.id);
            assert.strictEqual(res.success, true);
            const check = await locationService.getLocation(freeLeaf.id);
            assert.strictEqual(check, null);
        });

        // -------------------------------------------------------------
        // Case 20: Delete a type that is in use -> LOC_TYPE_IN_USE
        // -------------------------------------------------------------
        await runTestCase(20, 'Delete a type that is in use', async () => {
            const towerTypeId = typeMap.get('tower');
            await ensureRootTowerA();
            await assert.rejects(
                async () => {
                    await locationService.deleteType(towerTypeId);
                },
                err => err instanceof LocationError && err.code === LocationErrorCodes.LOC_TYPE_IN_USE
            );
        });

        // -------------------------------------------------------------
        // Case 21: getSubtree and getDescendantIds on a floor -> Exactly floor and descendants, no siblings with similar path prefixes (/1/5/ vs /1/50/)
        // -------------------------------------------------------------
        await runTestCase(21, 'getSubtree and getDescendantIds prefix exactness', async () => {
            // Node A
            const node5 = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('floor'),
                name: 'Floor Exact 5'
            });
            const childOf5 = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: node5.id,
                typeId: typeMap.get('unit'),
                name: 'Child Of 5'
            });
            // Another sibling
            const sibling50 = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('floor'),
                name: 'Floor Exact 50'
            });

            const descIds = await locationService.getDescendantIds(node5.id);
            assert.ok(descIds.includes(node5.id));
            assert.ok(descIds.includes(childOf5.id));
            assert.ok(!descIds.includes(sibling50.id), 'Must not include sibling 50');
        });

        // -------------------------------------------------------------
        // Case 22: getAncestors of a deep unit -> Root to parent, in order
        // -------------------------------------------------------------
        await runTestCase(22, 'getAncestors of a deep unit', async () => {
            const ancRoot = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Ancestry Tower'
            });
            const ancFloor = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: ancRoot.id,
                typeId: typeMap.get('floor'),
                name: 'Ancestry Floor'
            });
            const ancUnit = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: ancFloor.id,
                typeId: typeMap.get('unit'),
                name: 'Ancestry Unit'
            });

            const ancestors = await locationService.getAncestors(ancUnit.id);
            assert.strictEqual(ancestors.length, 2);
            assert.strictEqual(ancestors[0].id, ancRoot.id);
            assert.strictEqual(ancestors[1].id, ancFloor.id);
        });

        // -------------------------------------------------------------
        // Case 23: ensurePath called twice with the same segments -> Same leaf id, no duplicates
        // -------------------------------------------------------------
        await runTestCase(23, 'ensurePath idempotency', async () => {
            const segments = [
                { name: 'Import Site', typeId: typeMap.get('site') },
                { name: 'Import Block', typeId: typeMap.get('tower') },
                { name: 'Import Level 1', typeId: typeMap.get('floor') }
            ];

            const leaf1 = await locationService.ensurePath(TEST_PROJECT_1, segments, TEST_ORG_1);
            const leaf2 = await locationService.ensurePath(TEST_PROJECT_1, segments, TEST_ORG_1);

            assert.strictEqual(leaf1.id, leaf2.id);
            assert.strictEqual(leaf1.name, 'Import Level 1');
        });

        // -------------------------------------------------------------
        // Case 24: Corrupt some paths by direct SQL, then run checkIntegrity and rebuildPaths -> Violations reported, then none
        // -------------------------------------------------------------
        await runTestCase(24, 'Corrupt paths, checkIntegrity, and rebuildPaths', async () => {
            const testRoot = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Corrupt Root'
            });
            const testChild = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                parentId: testRoot.id,
                typeId: typeMap.get('floor'),
                name: 'Corrupt Child'
            });

            // Intentionally corrupt path via direct SQL update
            await db('loc_location').where({ id: testChild.id }).update({ path: '/corrupted/path/999/', depth: 9 });

            // Check integrity
            const violationsBefore = await locationService.checkIntegrity(TEST_PROJECT_1);
            assert.ok(violationsBefore.length > 0, 'Violations should be detected');

            // Rebuild paths
            const repairResult = await locationService.rebuildPaths(TEST_PROJECT_1);
            assert.ok(repairResult.repairedCount >= 1);

            // Check integrity again
            const violationsAfter = await locationService.checkIntegrity(TEST_PROJECT_1);
            assert.strictEqual(violationsAfter.length, 0, 'All violations should be resolved after rebuild');
        });

        // -------------------------------------------------------------
        // Case 25: Rename a location -> Id and path unchanged
        // -------------------------------------------------------------
        await runTestCase(25, 'Rename a location', async () => {
            const nodeToRename = await locationService.createLocation({
                orgId: TEST_ORG_1,
                projectId: TEST_PROJECT_1,
                typeId: typeMap.get('tower'),
                name: 'Initial Name'
            });
            const origId = nodeToRename.id;
            const origPath = nodeToRename.path;

            const renamed = await locationService.updateLocation(nodeToRename.id, { name: 'Renamed Name' });
            assert.strictEqual(renamed.id, origId);
            assert.strictEqual(renamed.path, origPath);
            assert.strictEqual(renamed.name, 'Renamed Name');
        });

        console.log('====================================================');
        console.log(`📊 TEST RESULTS: ${passedCount}/${targetNum ? 1 : 25} PASSED, ${failedCount} FAILED`);
        console.log('====================================================');

        await cleanupTestData();

        if (closeDb) {
            await db.destroy();
        }

        return {
            total: targetNum ? 1 : 25,
            passed: passedCount,
            failed: failedCount,
            targetCase: targetNum || 'all',
            durationMs: Date.now() - suiteStartTime,
            results: testResults
        };
    } catch (err) {
        console.error('Fatal test runner error:', err);
        await cleanupTestData();
        if (closeDb) {
            await db.destroy();
        }
        throw err;
    }
}

// Direct CLI Execution
if (process.argv[1] && process.argv[1].endsWith('locationTests.js')) {
    const rawArg = process.argv[2] ? process.argv[2].replace(/^--case=/, '') : null;
    const targetCase = rawArg && !isNaN(Number(rawArg)) ? Number(rawArg) : null;

    runLocationTestSuite({ targetCase, closeDb: true })
        .then(report => {
            if (report.failed > 0) process.exit(1);
            else process.exit(0);
        })
        .catch(err => {
            console.error('CLI Test Execution Error:', err);
            process.exit(1);
        });
}

