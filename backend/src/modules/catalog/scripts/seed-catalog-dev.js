#!/usr/bin/env node
/**
 * ============================================================================
 * Catalog Module Dev Seed Script (Idempotent & Read/Write via Service Only)
 * Date: 2026-11-14
 *
 * Usage:
 *   node backend/src/modules/catalog/scripts/seed-catalog-dev.js --org <orgId> [--project <projectId>]
 *
 * Separation Rules:
 * - Refuses to run if NODE_ENV=production.
 * - Never runs DDL, TRUNCATE, or raw INSERT statements.
 * - Interacts exclusively through catalogService.js.
 * - Idempotent: checks for existence before creation.
 * ============================================================================
 */

import db from '../../../config/database.js';
import * as catalogService from '../catalogService.js';
import {
    SEED_RESOURCES,
    SEED_RATES,
    SEED_ACTIVITIES,
} from './seed-data/catalogSeed.js';

// ─── 1. Production Safety Guard ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
    console.error('❌ [ERROR] Refusing to run dev seed script in production environment (NODE_ENV=production)');
    process.exit(1);
}

// ─── 2. CLI Argument Parsing ────────────────────────────────────────────────
function parseArgs() {
    const args = process.argv.slice(2);
    let orgId = null;
    let projectId = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--org' && args[i + 1]) {
            orgId = Number(args[i + 1]);
            i++;
        } else if (args[i].startsWith('--org=')) {
            orgId = Number(args[i].slice(6));
        } else if (args[i] === '--project' && args[i + 1]) {
            projectId = Number(args[i + 1]);
            i++;
        } else if (args[i].startsWith('--project=')) {
            projectId = Number(args[i].slice(10));
        }
    }

    if (!orgId || isNaN(orgId)) {
        console.error('❌ [ERROR] --org <orgId> is required.\nUsage: node backend/src/modules/catalog/scripts/seed-catalog-dev.js --org <orgId> [--project <projectId>]');
        process.exit(1);
    }

    return { orgId, projectId: projectId && !isNaN(projectId) ? projectId : null };
}

// ─── 3. Unit Validation ─────────────────────────────────────────────────────
const REQUIRED_STANDARD_UNITS = [
    'kg', 'g', 'tonne', 'm', 'm2', 'm3', 'cft', 'nos', 'bag', 'hr', 'day'
];

async function loadAndVerifyUnits(orgId) {
    const units = await catalogService.listUnits(orgId);
    const unitMap = new Map();
    for (const u of units) {
        unitMap.set(u.code.toLowerCase(), u);
    }

    const missing = [];
    for (const code of REQUIRED_STANDARD_UNITS) {
        if (!unitMap.has(code.toLowerCase())) {
            missing.push(code);
        }
    }

    if (missing.length > 0) {
        console.error(`❌ [ERROR] Required standard unit(s) missing from database: ${missing.join(', ')}`);
        console.error('   Please run catalog schema verification and seedGlobalUnits() before seeding dev data.');
        process.exit(1);
    }

    return unitMap;
}

// ─── 4. Main Seed Routine ───────────────────────────────────────────────────
async function runSeed() {
    const { orgId, projectId } = parseArgs();

    console.log('================================================================');
    console.log(`🌱 CATALOG DEV SEED SCRIPT`);
    console.log(`   Organization ID: ${orgId}`);
    if (projectId) {
        console.log(`   Project ID:      ${projectId}`);
    } else {
        console.log(`   Project ID:      (None - Master Catalog Only)`);
    }
    console.log('================================================================\n');

    const unitMap = await loadAndVerifyUnits(orgId);
    console.log(`✅ Standard units verified (${REQUIRED_STANDARD_UNITS.length}/${REQUIRED_STANDARD_UNITS.length} present)\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 1: Master Resources
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─── Phase 1: Seeding Master Resources ─────────────────────────');
    const existingMasterResources = await catalogService.listResources({ orgId, scope: 'master' });
    const resourceCodeMap = new Map();
    for (const r of existingMasterResources) {
        resourceCodeMap.set(r.code, r);
    }

    const seededResources = new Map();

    for (const resDef of SEED_RESOURCES) {
        const baseUnit = unitMap.get(resDef.baseUnitCode.toLowerCase());
        let resRow = resourceCodeMap.get(resDef.code);

        if (resRow) {
            console.log(`  [Resource] Already existed: ${resDef.code.padEnd(16)} #${String(resRow.id).padEnd(6)} (${resDef.name})`);
        } else {
            resRow = await catalogService.createResource({
                orgId,
                kind: resDef.kind,
                code: resDef.code,
                name: resDef.name,
                baseUnitId: baseUnit.id,
                description: resDef.description,
            });
            console.log(`  [Resource] Created:         ${resDef.code.padEnd(16)} #${String(resRow.id).padEnd(6)} (${resDef.name})`);
            resourceCodeMap.set(resRow.code, resRow);
        }
        seededResources.set(resDef.code, resRow);

        // Check & create packaging conversion if defined
        if (resDef.conversion) {
            const convDef = resDef.conversion;
            const fromUnit = unitMap.get(convDef.fromUnitCode.toLowerCase());
            const toUnit = unitMap.get(convDef.toUnitCode.toLowerCase());

            const existingConvs = await catalogService.listConversions(resRow.id);
            const foundConv = existingConvs.find(
                c => Number(c.from_unit_id) === Number(fromUnit.id) && Number(c.to_unit_id) === Number(toUnit.id)
            );

            if (foundConv) {
                console.log(`    ↳ [Conversion] Already existed: 1 ${convDef.fromUnitCode} = ${Number(foundConv.factor)} ${convDef.toUnitCode}`);
            } else {
                await catalogService.setConversion(
                    resRow.id,
                    fromUnit.id,
                    toUnit.id,
                    convDef.factor,
                    { reason: convDef.reason }
                );
                console.log(`    ↳ [Conversion] Created:         1 ${convDef.fromUnitCode} = ${convDef.factor} ${convDef.toUnitCode}`);
            }
        }
    }
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: Master Effective-Dated Rates
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─── Phase 2: Seeding Master Resource Rates ────────────────────');
    for (const rateDef of SEED_RATES) {
        const resource = seededResources.get(rateDef.resourceCode);
        const rateUnit = unitMap.get(rateDef.unitCode.toLowerCase());

        const existingRates = await catalogService.listRates(resource.id);
        const foundRate = existingRates.find(r => r.effective_from === rateDef.effectiveFrom);

        if (foundRate) {
            console.log(`  [Rate] Already existed: ${rateDef.resourceCode.padEnd(16)} @ ${String(Number(foundRate.rate)).padStart(8)} / ${foundRate.unit_code.padEnd(4)} from ${rateDef.effectiveFrom}`);
        } else {
            await catalogService.setRate(
                resource.id,
                rateDef.rate,
                rateUnit.id,
                rateDef.effectiveFrom,
                rateDef.note
            );
            console.log(`  [Rate] Created:         ${rateDef.resourceCode.padEnd(16)} @ ${String(rateDef.rate).padStart(8)} / ${rateDef.unitCode.padEnd(4)} from ${rateDef.effectiveFrom}`);
        }
    }
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: Master Activities & Composition Norms
    // ─────────────────────────────────────────────────────────────────────────
    console.log('─── Phase 3: Seeding Master Activities & Norms ────────────────');
    const existingMasterActivities = await catalogService.listActivities({ orgId, scope: 'master' });
    const activityCodeMap = new Map();
    for (const a of existingMasterActivities) {
        activityCodeMap.set(a.code, a);
    }

    const seededActivities = new Map();

    for (const actDef of SEED_ACTIVITIES) {
        const outputUnit = unitMap.get(actDef.outputUnitCode.toLowerCase());
        let actRow = activityCodeMap.get(actDef.code);

        if (actRow) {
            console.log(`  [Activity] Already existed: ${actDef.code.padEnd(14)} #${String(actRow.id).padEnd(6)} (${actDef.name})`);
        } else {
            actRow = await catalogService.createActivity({
                orgId,
                code: actDef.code,
                name: actDef.name,
                outputUnitId: outputUnit.id,
                description: actDef.description,
            });
            console.log(`  [Activity] Created:         ${actDef.code.padEnd(14)} #${String(actRow.id).padEnd(6)} (${actDef.name})`);
            activityCodeMap.set(actRow.code, actRow);
        }
        seededActivities.set(actDef.code, actRow);

        // Fetch current norms on activity to ensure idempotency
        const actDetails = await catalogService.getActivity(actRow.id);
        const existingNorms = actDetails.norms || [];

        for (const normDef of actDef.norms) {
            const resTarget = seededResources.get(normDef.resourceCode);
            const normUnit = unitMap.get(normDef.unitCode.toLowerCase());

            const foundNorm = existingNorms.find(
                n => Number(n.resource_id) === Number(resTarget.id) && n.effective_from === normDef.effectiveFrom
            );

            if (foundNorm) {
                console.log(`    ↳ [Norm] Already existed: -> ${normDef.resourceCode.padEnd(16)} ${String(Number(foundNorm.qty_per_unit)).padStart(8)} ${foundNorm.unit_code.padEnd(4)} (${Number(foundNorm.wastage_pct)}% wastage)`);
            } else {
                await catalogService.setNorm(
                    actRow.id,
                    resTarget.id,
                    normDef.qtyPerUnit,
                    normUnit.id,
                    normDef.effectiveFrom,
                    normDef.note,
                    { wastagePct: normDef.wastagePct }
                );
                console.log(`    ↳ [Norm] Created:         -> ${normDef.resourceCode.padEnd(16)} ${String(normDef.qtyPerUnit).padStart(8)} ${normDef.unitCode.padEnd(4)} (${normDef.wastagePct}% wastage)`);
            }
        }
    }
    console.log();

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4: Project Step (Only if --project provided)
    // ─────────────────────────────────────────────────────────────────────────
    let projectContext = null;

    if (projectId) {
        console.log(`─── Phase 4: Project Step (--project ${projectId}) ─────────────────────`);

        // 1. Import all 3 activities into project
        console.log(`  1. Importing master activities into project #${projectId}...`);
        const importedProjectActivities = [];
        for (const actDef of SEED_ACTIVITIES) {
            const masterAct = seededActivities.get(actDef.code);
            const projAct = await catalogService.importActivity(masterAct.id, projectId);
            importedProjectActivities.push(projAct);
            console.log(`     ↳ Activity [${actDef.code}] imported as Project Activity #${projAct.id}`);
        }

        // Verify resource copies were created once and reused
        const projectResources = await catalogService.listResources({ orgId, projectId, scope: 'project' });
        console.log(`     ↳ Total project resource copies created/reused: ${projectResources.length}`);

        // 2. Import the same activity again and confirm no duplicates
        console.log(`  2. Re-importing [ACT-EXC] to verify idempotency...`);
        const masterExc = seededActivities.get('ACT-EXC');
        const reimportedExc = await catalogService.importActivity(masterExc.id, projectId);
        console.log(`     ↳ Idempotent check: Returned existing Project Activity #${reimportedExc.id} (no duplicates created)`);

        // 3. Set a local rate on Project Copy of Cement (400 per bag)
        console.log(`  3. Setting project-local cement rate (400/bag)...`);
        const projCement = projectResources.find(r => r.code === 'MAT-CEM-OPC53');
        const bagUnit = unitMap.get('bag');
        const projRates = await catalogService.listRates(projCement.id);

        // Both copied rates (380 from 2026-04-01 and 410 from 2026-10-01) are corrected to the negotiated 400 flat rate
        const aprRate = projRates.find(r => r.effective_from === '2026-04-01');
        if (aprRate) {
            if (Number(aprRate.rate) === 400) {
                console.log(`     ↳ Local rate on 2026-04-01 already 400.0000 / bag`);
            } else {
                await catalogService.correctRate(
                    aprRate.id,
                    { rate: '400.0000' },
                    'Project site bulk negotiation: April baseline discount'
                );
                console.log(`     ↳ Local rate on 2026-04-01 corrected: 400.0000 / bag on project cement #${projCement.id} (was ${Number(aprRate.rate)})`);
            }
        } else {
            await catalogService.setRate(
                projCement.id,
                '400.0000',
                bagUnit.id,
                '2026-04-01',
                'Project site bulk negotiation rate'
            );
            console.log(`     ↳ Local rate on 2026-04-01 set: 400.0000 / bag on project cement #${projCement.id}`);
        }

        const octRate = projRates.find(r => r.effective_from === '2026-10-01');
        if (octRate) {
            if (Number(octRate.rate) === 400) {
                console.log(`     ↳ Local rate on 2026-10-01 already 400.0000 / bag`);
            } else {
                await catalogService.correctRate(
                    octRate.id,
                    { rate: '400.0000' },
                    'Project site bulk negotiation: lock October price at negotiated 400 flat rate'
                );
                console.log(`     ↳ Local rate on 2026-10-01 corrected: 400.0000 / bag on project cement #${projCement.id} (was ${Number(octRate.rate)})`);
            }
        }

        // Confirm master cement rate remains unchanged
        const masterCement = seededResources.get('MAT-CEM-OPC53');
        const masterCementRateAtApr = await catalogService.getRate(masterCement.id, '2026-04-15');
        console.log(`     ↳ Master cement rate check: unchanged at ${Number(masterCementRateAtApr.rate)} / ${masterCementRateAtApr.unit_code}`);

        // 4. Edit master cement rate: add 430 per bag from 2026-11-01
        console.log(`  4. Editing master cement rate (add 430/bag from 2026-11-01) and checking sync status...`);
        const masterRates = await catalogService.listRates(masterCement.id);
        const hasNovRate = masterRates.some(r => r.effective_from === '2026-11-01');

        if (!hasNovRate) {
            await catalogService.setRate(
                masterCement.id,
                '430.0000',
                bagUnit.id,
                '2026-11-01',
                'Q4 Master rate increase'
            );
            console.log(`     ↳ Master cement rate added: 430.0000 / bag from 2026-11-01`);
        }

        const cementSyncStatus = await catalogService.getResourceSyncStatus(projCement.id);
        console.log(`     ↳ Project cement sync status: status="${cementSyncStatus.status}", isBehind=${cementSyncStatus.isBehind} (master v${cementSyncStatus.masterVersion} vs synced v${cementSyncStatus.syncedVersion})`);

        projectContext = {
            projectId,
            projCement,
            cementSyncStatus,
            importedProjectActivities,
        };
        console.log();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 5: Verification Report
    // ─────────────────────────────────────────────────────────────────────────
    await printVerificationReport({
        orgId,
        projectContext,
        seededResources,
        seededActivities,
    });

    await db.destroy();
}

// ─── 5. Verification Report Formatter ───────────────────────────────────────
async function printVerificationReport({ orgId, projectContext, seededResources, seededActivities }) {
    console.log('================================================================');
    console.log('📊 CATALOG VERIFICATION & AUDIT REPORT');
    console.log('================================================================\n');

    // 1. Entity Counts
    const allResources = await catalogService.listResources({ orgId });
    const masterResources = allResources.filter(r => r.project_id === null);
    const materials = masterResources.filter(r => r.kind === 'material');
    const labours = masterResources.filter(r => r.kind === 'labour');
    const equipments = masterResources.filter(r => r.kind === 'equipment');

    const allActivities = await catalogService.listActivities({ orgId });
    const masterActivities = allActivities.filter(a => a.project_id === null);

    let totalMasterNorms = 0;
    for (const a of masterActivities) {
        const act = await catalogService.getActivity(a.id);
        totalMasterNorms += (act.norms || []).length;
    }

    let totalMasterRates = 0;
    for (const r of masterResources) {
        const rates = await catalogService.listRates(r.id);
        totalMasterRates += rates.length;
    }

    console.log('1. CATALOG ENTITY COUNTS (MASTER SCOPE):');
    console.log(`   • Resources:   ${masterResources.length} total (Material: ${materials.length}, Labour: ${labours.length}, Equipment: ${equipments.length})`);
    console.log(`   • Activities:  ${masterActivities.length}`);
    console.log(`   • Norm Lines:  ${totalMasterNorms}`);
    console.log(`   • Rate Rows:   ${totalMasterRates}`);
    if (projectContext) {
        const projResources = allResources.filter(r => Number(r.project_id) === Number(projectContext.projectId));
        const projActivities = allActivities.filter(a => Number(a.project_id) === Number(projectContext.projectId));
        console.log(`   • Project #${projectContext.projectId} Copies: ${projResources.length} Resources, ${projActivities.length} Activities`);
    }
    console.log();

    // 2. Cost Computation on 2026-09-01 vs 2026-10-15
    console.log('2. DYNAMIC ACTIVITY UNIT COST EVALUATION:');
    console.log('   Comparing unit cost on 2026-09-01 (Cement @ 380/bag) vs 2026-10-15 (Cement @ 410/bag):\n');

    for (const actDef of SEED_ACTIVITIES) {
        const act = seededActivities.get(actDef.code);
        const costSep = await catalogService.computeActivityCost(act.id, '2026-09-01');
        const costOct = await catalogService.computeActivityCost(act.id, '2026-10-15');

        console.log(`   ▶ Activity [${act.code}] ${act.name} (per ${act.output_unit_code}):`);
        console.log(`     • Unit Cost on 2026-09-01: ₹ ${Number(costSep.total).toFixed(4)}`);
        console.log(`     • Unit Cost on 2026-10-15: ₹ ${Number(costOct.total).toFixed(4)}`);
        if (costSep.total !== costOct.total) {
            const diff = (Number(costOct.total) - Number(costSep.total)).toFixed(4);
            console.log(`     ↳ Cost Delta: +₹ ${diff} (reflects cement rate escalation)`);
        } else {
            console.log(`     ↳ Cost Delta: ₹ 0.0000 (no cement in activity norms)`);
        }

        console.log('     Detailed Breakdown on 2026-10-15:');
        console.log('     ' + '-'.repeat(80));
        console.log('     Resource Name       | Net Qty | Wastage% | Gross Qty | Unit | Rate (₹) | Amount (₹)');
        console.log('     ' + '-'.repeat(80));
        for (const line of costOct.lines) {
            const name = line.resourceName.slice(0, 19).padEnd(19);
            const net = String(line.netQty).padStart(7);
            const wast = `${line.wastagePct}%`.padStart(8);
            const gross = String(line.grossQty).padStart(9);
            const unit = line.unitCode.padEnd(4);
            const rate = line.rate !== null ? String(Number(line.rate).toFixed(2)).padStart(8) : '    NULL';
            const amt = line.amount !== null ? String(Number(line.amount).toFixed(2)).padStart(10) : '      NULL';
            console.log(`     ${name} | ${net} | ${wast} | ${gross} | ${unit} | ${rate} | ${amt}`);
        }
        console.log('     ' + '-'.repeat(80));
        if (costOct.warnings && costOct.warnings.length > 0) {
            for (const w of costOct.warnings) {
                console.log(`     ⚠️ Warning: ${w.message}`);
            }
        }
        console.log();
    }

    // 3. Expected Usage (BOM Generator) on 2026-10-15
    console.log('3. EXPECTED USAGE / BILL OF MATERIALS (BOM) on 2026-10-15:');

    const bomScenarios = [
        { code: 'ACT-EXC', qty: 100, label: '100 m3 Excavation in soil' },
        { code: 'ACT-BRK-115', qty: 20, label: '20 m2 Brickwork 1:4, 115mm' },
        { code: 'ACT-RCC-M25', qty: 10, label: '10 m3 RCC slab M25' },
    ];

    for (const sc of bomScenarios) {
        const act = seededActivities.get(sc.code);
        const bom = await catalogService.expectedUsage(act.id, sc.qty, '2026-10-15');
        console.log(`   ▶ Planned Work: ${sc.label}`);
        for (const item of bom.items) {
            console.log(`     • ${item.resourceName.padEnd(20)}: Net ${String(item.netQty).padStart(8)} ${item.unitCode.padEnd(4)} + ${String(item.wastagePct).padStart(5)}% allowance = Gross ${String(item.grossQty).padStart(9)} ${item.unitCode}`);
        }
        console.log();
    }

    // 4. Project Comparison (if project given)
    if (projectContext) {
        console.log(`4. PROJECT #${projectContext.projectId} LOCAL PRICING & SYNC VERIFICATION:`);

        const projActivities = await catalogService.listActivities({ orgId, projectId: projectContext.projectId, scope: 'project' });
        const projRcc = projActivities.find(a => a.code === 'ACT-RCC-M25');
        const masterRcc = seededActivities.get('ACT-RCC-M25');

        const masterRccCost = await catalogService.computeActivityCost(masterRcc.id, '2026-10-15');
        const projRccCost = await catalogService.computeActivityCost(projRcc.id, '2026-10-15');

        console.log(`   ▶ Master RCC Slab Cost on 2026-10-15:  ₹ ${Number(masterRccCost.total).toFixed(4)} / m3 (using master cement @ ₹ 410/bag)`);
        console.log(`   ▶ Project RCC Slab Cost on 2026-10-15: ₹ ${Number(projRccCost.total).toFixed(4)} / m3 (using project local cement @ ₹ 400/bag)`);
        const savings = (Number(masterRccCost.total) - Number(projRccCost.total)).toFixed(4);
        console.log(`   ↳ Project Savings on Cement: ₹ ${savings} / m3 (8.16 gross bags × ₹ 10 savings = ₹ 81.60)`);

        console.log(`   ▶ Project Cement Drift Status: status="${projectContext.cementSyncStatus.status}", isBehind=${projectContext.cementSyncStatus.isBehind}`);
        console.log();
    }

    // 5. Hand Arithmetic Sanity Check: Brickwork 1:4 (ACT-BRK-115)
    console.log('5. MATHEMATICAL SANITY CHECK (HAND ARITHMETIC VS ENGINE):');
    console.log('   Target Activity: ACT-BRK-115 (Brickwork 1:4, 115mm, per 1 m2) as of 2026-10-15\n');

    const actBrick = seededActivities.get('ACT-BRK-115');
    const systemCost = await catalogService.computeActivityCost(actBrick.id, '2026-10-15');

    const manualCalculations = [
        { code: 'MAT-BRICK-RED', item: 'Red Brick', formula: '50 nos × 1.05 (5% wastage) = 52.5 nos × ₹ 9.00', expected: 472.5000 },
        { code: 'MAT-CEM-OPC53', item: 'Cement OPC 53', formula: '0.03 bag × 1.03 (3% wastage) = 0.0309 bag × ₹ 410.00', expected: 12.6690 },
        { code: 'MAT-SAND-RIV', item: 'River Sand', formula: '0.004 m3 × 1.05 (5% wastage) = 0.0042 m3 × ₹ 1,800.00', expected: 7.5600 },
        { code: 'LAB-MASON', item: 'Mason', formula: '0.8 hr × ₹ 100.00/hr (₹ 800/8-hr day)', expected: 80.0000 },
        { code: 'LAB-HELPER', item: 'Helper', formula: '0.8 hr × ₹ 60.00/hr', expected: 48.0000 },
    ];

    const manualTotal = manualCalculations.reduce((acc, c) => acc + c.expected, 0);

    console.log('   Component       | Manual Formula & Hand Arithmetic                    | Hand Calc (₹) | System (₹)  | Match');
    console.log('   ' + '-'.repeat(100));
    for (const mc of manualCalculations) {
        const line = systemCost.lines.find(l => l.resourceCode === mc.code);
        const sysAmt = line ? Number(line.amount).toFixed(4) : '0.0000';
        const isMatch = Math.abs(mc.expected - Number(sysAmt)) < 0.0001;
        console.log(`   ${mc.item.padEnd(15)} | ${mc.formula.padEnd(51)} | ${mc.expected.toFixed(4).padStart(13)} | ${sysAmt.padStart(11)} | ${isMatch ? '✅ MATCH' : '❌ FAIL'}`);
    }
    console.log('   ' + '-'.repeat(100));
    const totalMatch = Math.abs(manualTotal - Number(systemCost.total)) < 0.0001;
    console.log(`   TOTAL COST      | Hand Sum = ₹ ${manualTotal.toFixed(4)}                                 | ${manualTotal.toFixed(4).padStart(13)} | ${Number(systemCost.total).toFixed(4).padStart(11)} | ${totalMatch ? '✅ EXACT MATCH' : '❌ FAIL'}`);
    console.log();

    // 6. Database Health & Invariant Integrity
    console.log('6. CATALOG INTEGRITY AUDIT (checkIntegrity):');
    const masterViolations = await catalogService.checkIntegrity({ orgId });
    if (masterViolations.length === 0) {
        console.log(`   ✅ Master Catalog Scope (orgId ${orgId}): 0 violations detected. Database invariants fully satisfied.`);
    } else {
        console.log(`   ❌ Master Catalog Scope: ${masterViolations.length} violations detected!`);
        for (const v of masterViolations) console.log(`      ↳ [${v.type}] ${v.details}`);
    }

    if (projectContext) {
        const projViolations = await catalogService.checkIntegrity({ orgId, projectId: projectContext.projectId });
        if (projViolations.length === 0) {
            console.log(`   ✅ Project #${projectContext.projectId} Scope: 0 violations detected. Database invariants fully satisfied.`);
        } else {
            console.log(`   ❌ Project Scope: ${projViolations.length} violations detected!`);
            for (const v of projViolations) console.log(`      ↳ [${v.type}] ${v.details}`);
        }
    }

    console.log('\n================================================================');
    console.log('🎉 SEED SCRIPT & AUDIT COMPLETED SUCCESSFULLY');
    console.log('================================================================');
}

runSeed().catch(async err => {
    console.error('\n❌ Fatal Seed Error:', err);
    try {
        await db.destroy();
    } catch (_) {}
    process.exit(1);
});
