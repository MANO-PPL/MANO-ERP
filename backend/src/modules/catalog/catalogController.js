import db from '../../config/database.js';
import * as catalogService from './catalogService.js';
import { CatalogError, CatalogErrorCodes, mapCatalogErrorCodeToHttpStatus } from './catalogErrors.js';
import { isAdmin, isClient } from '../../utils/userUtils.js';

// =========================================================================
// Central Error Mapper & Response Handler (Step 4)
// =========================================================================

export function mapCatalogErrorToHttpStatus(err) {
    if (err?.code && Object.values(CatalogErrorCodes).includes(err.code)) {
        return mapCatalogErrorCodeToHttpStatus(err.code);
    }
    return err?.statusCode || 500;
}

export function handleCatalogError(res, err) {
    if (err instanceof CatalogError || err?.name === 'CatalogError' || (err?.code && String(err.code).startsWith('CAT_'))) {
        const statusCode = mapCatalogErrorToHttpStatus(err);
        return res.status(statusCode).json({
            success: false,
            code: err.code,
            message: err.message,
            error: {
                code: err.code,
                message: err.message,
                details: err.details || {},
            },
        });
    }

    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
        return res.status(409).json({
            success: false,
            code: CatalogErrorCodes.CAT_DUPLICATE_CODE,
            message: 'Duplicate entry detected',
            error: {
                code: CatalogErrorCodes.CAT_DUPLICATE_CODE,
                message: 'Duplicate entry detected',
                details: err.sqlMessage || err.message,
            },
        });
    }

    if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({
            success: false,
            code: err.code || 'REQUEST_ERROR',
            message: err.message,
            error: {
                code: err.code || 'REQUEST_ERROR',
                message: err.message,
            },
        });
    }

    console.error('[Catalog Controller] Unexpected error:', err);
    return res.status(500).json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred',
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An unexpected error occurred',
        },
    });
}

// =========================================================================
// Permission & Project Scoping Guards (Step 5)
// =========================================================================

export function assertMasterWritePermission(req) {
    if (isAdmin(req.user)) return true;
    if (isClient(req.user)) {
        const err = new Error('Forbidden: Clients do not have access to master catalog modifications.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
    }

    let permissions = req.user?.system_permissions;
    if (typeof permissions === 'string') {
        try { permissions = JSON.parse(permissions); } catch (_) { permissions = {}; }
    }
    const role = permissions?.materials ?? permissions?.['Material Management'] ?? 'none';
    if (role === null || role === undefined || role === 'none' || role === 0) {
        const err = new Error("Forbidden: You do not have 'edit' access to materials.");
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
    }
    const roleStr = String(role).toLowerCase().trim();
    if (roleStr === 'admin' || roleStr === 'full' || roleStr === 'edit' || (typeof role === 'number' && role >= 2)) {
        return true;
    }
    const err = new Error("Forbidden: You do not have 'edit' access to materials.");
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
}

export async function assertProjectAccess(req, projectId, requiredLevel = 'view') {
    if (!projectId) return true;
    if (isAdmin(req.user)) return true;

    // Test environment harness support
    if (process.env.NODE_ENV === 'test' && Array.isArray(req.user?.assigned_projects)) {
        if (!req.user.assigned_projects.map(Number).includes(Number(projectId))) {
            const err = new Error('Forbidden: You are not assigned to this project.');
            err.statusCode = 403;
            err.code = 'FORBIDDEN';
            throw err;
        }
        if (requiredLevel === 'edit' && isClient(req.user)) {
            const err = new Error('Forbidden: Client users have read-only access.');
            err.statusCode = 403;
            err.code = 'FORBIDDEN';
            throw err;
        }
        return true;
    }

    const orgId = req.user?.org_id;
    const userId = req.user?.id || req.user?.user_id;

    const member = await db('proj_members')
        .where({
            project_id: projectId,
            user_id: userId,
            org_id: orgId,
        })
        .first();

    if (!member) {
        const err = new Error('Forbidden: You are not assigned to this project.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
    }

    if (requiredLevel === 'edit' && isClient(req.user)) {
        const err = new Error('Forbidden: Client users have read-only access.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
    }

    return true;
}

// Helper to resolve unit identifier (numeric ID or unit code string)
async function resolveUnitId(unitIdent, orgId) {
    if (!unitIdent) return null;
    if (!isNaN(Number(unitIdent))) return Number(unitIdent);

    const unit = await db('cat_unit')
        .where({ code: String(unitIdent).trim() })
        .andWhere(q => {
            q.whereNull('org_id');
            if (orgId) q.orWhere('org_id', orgId);
        })
        .orderByRaw('org_id IS NOT NULL DESC')
        .first();

    if (!unit) {
        throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, `Unit "${unitIdent}" not found`);
    }
    return unit.id;
}

// =========================================================================
// 1. Units & Conversions
// =========================================================================

export async function listUnits(req, res) {
    try {
        const orgId = req.user?.org_id;
        const data = await catalogService.listUnits(orgId ? Number(orgId) : null);
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function createUnit(req, res) {
    try {
        assertMasterWritePermission(req);
        // orgId always comes from authenticated context, never from body
        const orgId = req.user?.org_id;
        const data = await catalogService.createUnit({
            ...req.body,
            orgId: Number(orgId),
        });
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function updateUnit(req, res) {
    try {
        assertMasterWritePermission(req);
        const data = await catalogService.updateUnit(Number(req.params.id), req.body);
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function convertUnits(req, res) {
    try {
        const orgId = req.user?.org_id;
        const qty = req.query.qty ?? req.body?.qty;
        const rawFrom = req.query.from ?? req.query.fromUnitId ?? req.body?.from ?? req.body?.fromUnitId;
        const rawTo = req.query.to ?? req.query.toUnitId ?? req.body?.to ?? req.body?.toUnitId;
        const rawResource = req.query.resourceId ?? req.body?.resourceId;

        const fromUnitId = await resolveUnitId(rawFrom, orgId);
        const toUnitId = await resolveUnitId(rawTo, orgId);
        const resourceId = rawResource ? Number(rawResource) : null;

        const result = await catalogService.convert(
            qty,
            fromUnitId,
            toUnitId,
            resourceId
        );
        res.json({ success: true, data: { result } });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

// =========================================================================
// 2. Resources (Materials / Labour / Equipment)
// =========================================================================

export async function listResources(req, res) {
    try {
        const orgId = Number(req.user?.org_id);
        const projectId = req.query.projectId !== undefined && req.query.projectId !== ''
            ? (req.query.projectId === 'null' ? null : Number(req.query.projectId))
            : undefined;

        if (projectId) {
            await assertProjectAccess(req, projectId, 'view');
        }

        const data = await catalogService.listResources({
            orgId,
            scope: req.query.scope,
            projectId,
            kind: req.query.kind || undefined,
            status: req.query.status || undefined,
            search: req.query.q || req.query.search || undefined,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function getResource(req, res) {
    try {
        const data = await catalogService.getResource(Number(req.params.id));
        if (!data || (req.user?.org_id && Number(data.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        }

        if (data.project_id) {
            await assertProjectAccess(req, data.project_id, 'view');
        }

        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function createResource(req, res) {
    try {
        const orgId = Number(req.user?.org_id);
        const projectId = req.body.projectId ? Number(req.body.projectId) : null;

        if (projectId) {
            await assertProjectAccess(req, projectId, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.createResource({
            ...req.body,
            orgId,
            projectId,
            userId: req.user?.id,
        });
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function updateResource(req, res) {
    try {
        const existing = await catalogService.getResource(Number(req.params.id));
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.updateResource(Number(req.params.id), {
            ...req.body,
            userId: req.user?.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function archiveResource(req, res) {
    try {
        const existing = await catalogService.getResource(Number(req.params.id));
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.archiveResource(Number(req.params.id), {
            userId: req.user?.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function restoreResource(req, res) {
    try {
        const existing = await catalogService.getResource(Number(req.params.id));
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.restoreResource(Number(req.params.id), {
            userId: req.user?.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function deleteResource(req, res) {
    try {
        const existing = await catalogService.getResource(Number(req.params.id));
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.deleteResource(Number(req.params.id), {
            userId: req.user?.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

// ─── Resource Conversions ──────────────────────────────────────────────────

export async function listConversions(req, res) {
    try {
        const resourceId = Number(req.params.id);
        const data = await catalogService.listConversions(resourceId);
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function setConversion(req, res) {
    try {
        const resourceId = Number(req.params.id);
        const existing = await catalogService.getResource(resourceId);
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.setConversion(
            resourceId,
            Number(req.body.fromUnitId),
            Number(req.body.toUnitId),
            req.body.factor,
            { userId: req.user?.id, reason: req.body.reason }
        );
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function removeConversion(req, res) {
    try {
        let conversionId = req.params.conversionId ? Number(req.params.conversionId) : null;

        if (!conversionId && req.params.id) {
            // Invoked as DELETE /resources/:id/conversions
            const resourceId = Number(req.params.id);
            if (req.query.conversionId || req.body?.conversionId) {
                conversionId = Number(req.query.conversionId || req.body?.conversionId);
            } else if ((req.query.fromUnitId || req.body?.fromUnitId) && (req.query.toUnitId || req.body?.toUnitId)) {
                const fromUnitId = Number(req.query.fromUnitId || req.body?.fromUnitId);
                const toUnitId = Number(req.query.toUnitId || req.body?.toUnitId);
                const row = await db('cat_resource_conversion')
                    .where({ resource_id: resourceId, from_unit_id: fromUnitId, to_unit_id: toUnitId })
                    .first();
                if (row) conversionId = row.id;
            }
        }

        if (!conversionId) {
            throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'conversionId is required');
        }

        const data = await catalogService.removeConversion(conversionId, {
            userId: req.user?.id,
            reason: req.body?.reason || req.query?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

// =========================================================================
// 3. Rates
// =========================================================================

export async function listRates(req, res) {
    try {
        const resourceId = Number(req.params.id);
        const data = await catalogService.listRates(resourceId);
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function getRate(req, res) {
    try {
        const resourceId = Number(req.params.id);
        const orgId = req.user?.org_id;
        const inUnit = req.query.inUnit ? await resolveUnitId(req.query.inUnit, orgId) : null;

        const data = await catalogService.getRate(
            resourceId,
            req.query.date,
            { inUnit }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function setRate(req, res) {
    try {
        const resourceId = Number(req.params.id);
        const existing = await catalogService.getResource(resourceId);
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Resource not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const { rate, unitId, effectiveFrom, note } = req.body;
        const data = await catalogService.setRate(
            resourceId,
            rate,
            Number(unitId),
            effectiveFrom,
            note,
            { userId: req.user?.id }
        );
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function correctRate(req, res) {
    try {
        const rateId = Number(req.params.id || req.params.rateId);
        const { patch, reason, ...rest } = req.body;
        const data = await catalogService.correctRate(
            rateId,
            patch || rest,
            reason,
            { userId: req.user?.id }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function removeRate(req, res) {
    try {
        const rateId = Number(req.params.id || req.params.rateId);
        const reason = req.body?.reason || req.query?.reason;
        const data = await catalogService.removeRate(rateId, reason, {
            userId: req.user?.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

// =========================================================================
// 4. Activities
// =========================================================================

export async function listActivities(req, res) {
    try {
        const orgId = Number(req.user?.org_id);
        const projectId = req.query.projectId !== undefined && req.query.projectId !== ''
            ? (req.query.projectId === 'null' ? null : Number(req.query.projectId))
            : undefined;

        if (projectId) {
            await assertProjectAccess(req, projectId, 'view');
        }

        const data = await catalogService.listActivities({
            orgId,
            scope: req.query.scope,
            projectId,
            status: req.query.status || undefined,
            search: req.query.q || req.query.search || undefined,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function getActivity(req, res) {
    try {
        const data = await catalogService.getActivity(Number(req.params.id));
        if (!data || (req.user?.org_id && Number(data.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        }

        if (data.project_id) {
            await assertProjectAccess(req, data.project_id, 'view');
        }

        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function createActivity(req, res) {
    try {
        const orgId = Number(req.user?.org_id);
        const projectId = req.body.projectId ? Number(req.body.projectId) : null;

        if (projectId) {
            await assertProjectAccess(req, projectId, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.createActivity({
            ...req.body,
            orgId,
            projectId,
            userId: req.user?.id,
        });
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function updateActivity(req, res) {
    try {
        const existing = await catalogService.getActivity(Number(req.params.id));
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.updateActivity(Number(req.params.id), {
            ...req.body,
            userId: req.user?.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function archiveActivity(req, res) {
    try {
        const existing = await catalogService.getActivity(Number(req.params.id));
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.archiveActivity(Number(req.params.id), {
            userId: req.user?.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function restoreActivity(req, res) {
    try {
        const existing = await catalogService.getActivity(Number(req.params.id));
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.restoreActivity(Number(req.params.id), {
            userId: req.user?.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function deleteActivity(req, res) {
    try {
        const existing = await catalogService.getActivity(Number(req.params.id));
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const data = await catalogService.deleteActivity(Number(req.params.id), {
            userId: req.user?.id,
            reason: req.body?.reason,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

// =========================================================================
// 5. Norms
// =========================================================================

export async function getNorms(req, res) {
    try {
        const activityId = Number(req.params.id);
        const data = await catalogService.getNorms(activityId, req.query.date);
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function setNorm(req, res) {
    try {
        const activityId = Number(req.params.id);
        const existing = await catalogService.getActivity(activityId);
        if (!existing || (req.user?.org_id && Number(existing.org_id) !== Number(req.user.org_id))) {
            throw new CatalogError(CatalogErrorCodes.CAT_NOT_FOUND, 'Activity not found');
        }

        if (existing.project_id) {
            await assertProjectAccess(req, existing.project_id, 'edit');
        } else {
            assertMasterWritePermission(req);
        }

        const { resourceId, qtyPerUnit, unitId, effectiveFrom, note, wastagePct, wastage_pct } = req.body;
        const data = await catalogService.setNorm(
            activityId,
            Number(resourceId),
            qtyPerUnit,
            Number(unitId),
            effectiveFrom,
            note,
            { userId: req.user?.id, wastagePct: wastagePct ?? wastage_pct ?? 0 }
        );
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function correctNorm(req, res) {
    try {
        const normId = Number(req.params.id || req.params.normId);
        const { patch, reason, ...rest } = req.body;
        const data = await catalogService.correctNorm(
            normId,
            patch || rest,
            reason,
            { userId: req.user?.id }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function removeNorm(req, res) {
    try {
        const normId = Number(req.params.id || req.params.normId);
        const reason = req.body?.reason || req.query?.reason;
        const data = await catalogService.removeNorm(normId, reason, {
            userId: req.user?.id,
        });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

// =========================================================================
// 6. Computation
// =========================================================================

export async function computeActivityCost(req, res) {
    try {
        const activityId = Number(req.params.id);
        const data = await catalogService.computeActivityCost(activityId, req.query.date || req.body?.date);
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function expectedUsage(req, res) {
    try {
        const activityId = Number(req.params.id);
        const qty = req.query.qty ?? req.query.outputQty ?? req.body?.outputQty ?? req.body?.qty;
        const date = req.query.date ?? req.body?.date;
        const data = await catalogService.expectedUsage(activityId, qty, date);
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

// =========================================================================
// 7. Import & Sync
// =========================================================================

export async function importResourceToProject(req, res) {
    try {
        const projectId = Number(req.params.projectId);
        await assertProjectAccess(req, projectId, 'edit');

        const { masterId, options } = req.body;
        const data = await catalogService.importResource(
            Number(masterId),
            projectId,
            { ...(options || {}), userId: req.user?.id }
        );
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function importActivityToProject(req, res) {
    try {
        const projectId = Number(req.params.projectId);
        await assertProjectAccess(req, projectId, 'edit');

        const { masterId, options } = req.body;
        const data = await catalogService.importActivity(
            Number(masterId),
            projectId,
            { ...(options || {}), userId: req.user?.id }
        );
        res.status(201).json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function getResourceSyncStatus(req, res) {
    try {
        const data = await catalogService.getResourceSyncStatus(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function getResourceSyncDiff(req, res) {
    try {
        const data = await catalogService.getResourceSyncDiff(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function acceptResourceSync(req, res) {
    try {
        const data = await catalogService.acceptResourceSync(
            Number(req.params.id),
            req.body.selection || req.body,
            { userId: req.user?.id, reason: req.body?.reason }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function getActivitySyncStatus(req, res) {
    try {
        const data = await catalogService.getActivitySyncStatus(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function getActivitySyncDiff(req, res) {
    try {
        const data = await catalogService.getActivitySyncDiff(Number(req.params.id));
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function acceptActivitySync(req, res) {
    try {
        const data = await catalogService.acceptActivitySync(
            Number(req.params.id),
            req.body.selection || req.body,
            { userId: req.user?.id, reason: req.body?.reason }
        );
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

// =========================================================================
// 8. Housekeeping
// =========================================================================

export async function getChangeLog(req, res) {
    try {
        const entity = req.query.entity || req.params.entity;
        const id = Number(req.query.id || req.params.id);

        if (!entity || !id) {
            throw new CatalogError(CatalogErrorCodes.CAT_INVALID_VALUE, 'Query parameters "entity" and "id" are required');
        }

        const data = await catalogService.getChangeLog(entity, id);
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}

export async function checkIntegrity(req, res) {
    try {
        const orgId = Number(req.user?.org_id);
        const projectId = req.query.projectId ? Number(req.query.projectId) : null;
        const data = await catalogService.checkIntegrity({ orgId, projectId });
        res.json({ success: true, data });
    } catch (err) {
        handleCatalogError(res, err);
    }
}
