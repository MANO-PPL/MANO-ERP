import * as catalogService from './catalogService.js';
import { CatalogError } from './catalogErrors.js';
import db from '../../config/database.js';
import { runCatalogTestSuite } from './catalogTests.js';

// Real registered usage check hooks for the Lab In-Use Simulator
const simulatedInUseResources = new Set();
const simulatedInUseActivities = new Set();
let simulatorHooksRegistered = false;

function ensureSimulatorHooks() {
    if (simulatorHooksRegistered) return;
    catalogService.registerUsageCheck('resource', async (ids) => {
        return ids.filter(id => simulatedInUseResources.has(Number(id)));
    });
    catalogService.registerUsageCheck('activity', async (ids) => {
        return ids.filter(id => simulatedInUseActivities.has(Number(id)));
    });
    simulatorHooksRegistered = true;
}

ensureSimulatorHooks();

function handleError(res, err) {
    if (err instanceof CatalogError) {
        return res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        });
    }
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
        return res.status(409).json({
            error: {
                code: 'CAT_DUPLICATE_CODE',
                message: 'Duplicate code or effective date detected',
                details: err.sqlMessage || err.message,
            },
        });
    }
    console.error('Catalog Lab Controller Error:', err);
    return res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An unexpected error occurred',
        },
    });
}

async function verifyProjectInOrg(projectId, orgId) {
    if (projectId === null || projectId === undefined || projectId === '') return true;
    try {
        const project = await db('proj_projects').where({ id: projectId }).select('org_id').first();
        if (project && project.org_id && String(project.org_id) !== String(orgId)) {
            throw new CatalogError('CAT_SCOPE_MISMATCH', 'Project belongs to a different organization');
        }
    } catch (err) {
        if (err instanceof CatalogError) throw err;
        console.warn(`[CatalogLab] verifyProjectInOrg bypassed (${err.message})`);
    }
    return true;
}

async function verifyEntityInOrg(table, id, orgId) {
    const row = await db(table).where({ id }).select('id', 'org_id').first();
    if (!row) throw new CatalogError('CAT_NOT_FOUND', 'Record not found');
    if (String(row.org_id) !== String(orgId)) {
        throw new CatalogError('CAT_SCOPE_MISMATCH', 'Record belongs to another organization');
    }
    return row;
}

// =========================================================================
// Units & Conversions
// =========================================================================

export async function listUnits(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const data = await catalogService.listUnits(orgId);
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function seedUnits(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const data = await catalogService.seedDefaultUnits(orgId);
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function createUnit(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const data = await catalogService.createUnit({ ...req.body, orgId });
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function updateUnit(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_unit', Number(req.params.id), orgId);
        const data = await catalogService.updateUnit(Number(req.params.id), req.body);
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function convertUnits(req, res) {
    try {
        const { qty, fromUnitId, toUnitId, resourceId } = req.body;
        const result = await catalogService.convert(
            qty,
            Number(fromUnitId),
            Number(toUnitId),
            resourceId ? Number(resourceId) : null
        );
        res.json({ success: true, data: { result } });
    } catch (err) {
        handleError(res, err);
    }
}

export async function listConversions(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.listConversions(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function setConversion(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.setConversion(
            Number(req.params.id),
            Number(req.body.fromUnitId),
            Number(req.body.toUnitId),
            req.body.factor,
            { userId: req.user.id, reason: req.body.reason }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function removeConversion(req, res) {
    try {
        const data = await catalogService.removeConversion(Number(req.params.conversionId), {
            userId: req.user.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

// =========================================================================
// Resources
// =========================================================================

export async function listResources(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const scope = req.query.scope;
        const projectId = req.query.projectId !== undefined && req.query.projectId !== ''
            ? (req.query.projectId === 'null' ? null : Number(req.query.projectId))
            : undefined;
        if (projectId) await verifyProjectInOrg(projectId, orgId);

        const data = await catalogService.listResources({
            orgId,
            scope,
            projectId,
            kind: req.query.kind || undefined,
            status: req.query.status || undefined,
            search: req.query.search || undefined,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getResource(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.getResource(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function createResource(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const projectId = req.body.projectId !== undefined && req.body.projectId !== '' && req.body.projectId !== null
            ? Number(req.body.projectId)
            : null;
        await verifyProjectInOrg(projectId, orgId);

        const data = await catalogService.createResource({
            ...req.body,
            orgId,
            projectId,
            userId: req.user.id,
        });
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function updateResource(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        ensureSimulatorHooks();
        const data = await catalogService.updateResource(Number(req.params.id), {
            ...req.body,
            userId: req.user.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function archiveResource(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.archiveResource(Number(req.params.id), {
            userId: req.user.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function restoreResource(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.restoreResource(Number(req.params.id), {
            userId: req.user.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function deleteResource(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        ensureSimulatorHooks();
        const data = await catalogService.deleteResource(Number(req.params.id), {
            userId: req.user.id,
            reason: req.body?.reason,
        });
        simulatedInUseResources.delete(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function importResource(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const { masterId, projectId, asNewVariant, code, name } = req.body;
        await verifyEntityInOrg('cat_resource', Number(masterId), orgId);
        await verifyProjectInOrg(Number(projectId), orgId);
        const data = await catalogService.importResource(Number(masterId), Number(projectId), {
            asNewVariant: Boolean(asNewVariant),
            code,
            name,
            userId: req.user.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getResourceSyncStatus(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.getResourceSyncStatus(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getResourceSyncDiff(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.getResourceSyncDiff(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function acceptResourceSync(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.acceptResourceSync(
            Number(req.params.id),
            req.body.selection || req.body,
            { userId: req.user.id, reason: req.body?.reason }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

// =========================================================================
// Rates
// =========================================================================

export async function listRates(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.listRates(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getRate(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const data = await catalogService.getRate(
            Number(req.params.id),
            req.query.date,
            { inUnit: req.query.inUnit ? Number(req.query.inUnit) : null }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function setRate(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_resource', Number(req.params.id), orgId);
        const { rate, unitId, effectiveFrom, note } = req.body;
        const data = await catalogService.setRate(
            Number(req.params.id),
            rate,
            Number(unitId),
            effectiveFrom,
            note,
            { userId: req.user.id }
        );
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function correctRate(req, res) {
    try {
        const { patch, reason, ...rest } = req.body;
        const data = await catalogService.correctRate(
            Number(req.params.rateId),
            patch || rest,
            reason,
            { userId: req.user.id }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function removeRate(req, res) {
    try {
        const reason = req.body?.reason || req.query?.reason;
        const data = await catalogService.removeRate(Number(req.params.rateId), reason, {
            userId: req.user.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

// =========================================================================
// Activities & Norms
// =========================================================================

export async function listActivities(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const scope = req.query.scope;
        const projectId = req.query.projectId !== undefined && req.query.projectId !== ''
            ? (req.query.projectId === 'null' ? null : Number(req.query.projectId))
            : undefined;
        if (projectId) await verifyProjectInOrg(projectId, orgId);

        const data = await catalogService.listActivities({
            orgId,
            scope,
            projectId,
            status: req.query.status || undefined,
            search: req.query.search || undefined,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getActivity(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const data = await catalogService.getActivity(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function createActivity(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const projectId = req.body.projectId !== undefined && req.body.projectId !== '' && req.body.projectId !== null
            ? Number(req.body.projectId)
            : null;
        await verifyProjectInOrg(projectId, orgId);

        const data = await catalogService.createActivity({
            ...req.body,
            orgId,
            projectId,
            userId: req.user.id,
        });
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function updateActivity(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        ensureSimulatorHooks();
        const data = await catalogService.updateActivity(Number(req.params.id), {
            ...req.body,
            userId: req.user.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function archiveActivity(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const data = await catalogService.archiveActivity(Number(req.params.id), {
            userId: req.user.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function restoreActivity(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const data = await catalogService.restoreActivity(Number(req.params.id), {
            userId: req.user.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function deleteActivity(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        ensureSimulatorHooks();
        const data = await catalogService.deleteActivity(Number(req.params.id), {
            userId: req.user.id,
            reason: req.body?.reason,
        });
        simulatedInUseActivities.delete(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function importActivity(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const { masterId, projectId, asNewVariant, code, name } = req.body;
        await verifyEntityInOrg('cat_activity', Number(masterId), orgId);
        await verifyProjectInOrg(Number(projectId), orgId);
        const data = await catalogService.importActivity(Number(masterId), Number(projectId), {
            asNewVariant: Boolean(asNewVariant),
            code,
            name,
            userId: req.user.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getActivitySyncStatus(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const data = await catalogService.getActivitySyncStatus(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getActivitySyncDiff(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const data = await catalogService.getActivitySyncDiff(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function acceptActivitySync(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const data = await catalogService.acceptActivitySync(
            Number(req.params.id),
            req.body.selection || req.body,
            { userId: req.user.id, reason: req.body?.reason }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function setNorm(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const { resourceId, qtyPerUnit, unitId, effectiveFrom, note, wastagePct, wastage_pct } = req.body;
        const data = await catalogService.setNorm(
            Number(req.params.id),
            Number(resourceId),
            qtyPerUnit,
            Number(unitId),
            effectiveFrom,
            note,
            { userId: req.user.id, wastagePct: wastagePct ?? wastage_pct ?? 0 }
        );
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getNorms(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const data = await catalogService.getNorms(Number(req.params.id), req.query.date);
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function correctNorm(req, res) {
    try {
        const { patch, reason, ...rest } = req.body;
        const data = await catalogService.correctNorm(
            Number(req.params.normId),
            patch || rest,
            reason,
            { userId: req.user.id }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function removeNorm(req, res) {
    try {
        const reason = req.body?.reason || req.query?.reason;
        const data = await catalogService.removeNorm(Number(req.params.normId), reason, {
            userId: req.user.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

// =========================================================================
// Computation, Change Log, Integrity, In-Use Simulator & Test Suite
// =========================================================================

export async function computeActivityCost(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const data = await catalogService.computeActivityCost(Number(req.params.id), req.query.date);
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function expectedUsage(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        await verifyEntityInOrg('cat_activity', Number(req.params.id), orgId);
        const data = await catalogService.expectedUsage(
            Number(req.params.id),
            req.query.outputQty,
            req.query.date
        );
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getChangeLog(req, res) {
    try {
        const data = await catalogService.getChangeLog(req.params.entity, Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function checkIntegrity(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const data = await catalogService.checkIntegrity({ orgId });
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getSimulatedInUse(req, res) {
    res.json({
        success: true,
        data: {
            resourceIds: Array.from(simulatedInUseResources),
            activityIds: Array.from(simulatedInUseActivities),
        },
    });
}

export async function toggleSimulatedInUse(req, res) {
    try {
        ensureSimulatorHooks();
        const { entity, id, inUse } = req.body;
        const numId = Number(id);
        if (!numId || (entity !== 'resource' && entity !== 'activity')) {
            throw new CatalogError('CAT_INVALID_VALUE', 'entity (resource|activity) and valid id are required');
        }
        const targetSet = entity === 'resource' ? simulatedInUseResources : simulatedInUseActivities;
        const shouldMark = inUse !== undefined ? Boolean(inUse) : !targetSet.has(numId);
        if (shouldMark) targetSet.add(numId);
        else targetSet.delete(numId);

        res.json({
            success: true,
            data: {
                entity,
                id: numId,
                inUse: targetSet.has(numId),
                resourceIds: Array.from(simulatedInUseResources),
                activityIds: Array.from(simulatedInUseActivities),
            },
        });
    } catch (err) {
        handleError(res, err);
    }
}

export async function runTests(req, res) {
    try {
        const targetCase = req.body?.caseNum || req.query?.caseNum || null;
        console.log(`[CatalogLab] 🧪 Integration test suite triggered by user #${req.user?.id} (${req.user?.email}) [Target: ${targetCase || 'all'}]`);
        const report = await runCatalogTestSuite({ targetCase, closeDb: false });
        // Re-ensure lab simulator hooks after test suite cleanup
        simulatorHooksRegistered = false;
        ensureSimulatorHooks();
        res.json({ success: true, data: report });
    } catch (err) {
        handleError(res, err);
    }
}

export async function repairUnits(req, res) {
    try {
        const data = await catalogService.repairSystemUnits();
        res.json({ success: true, data });
    } catch (err) {
        handleError(res, err);
    }
}

