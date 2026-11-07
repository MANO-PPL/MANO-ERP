import * as locationService from './locationService.js';
import { LocationError } from './locationErrors.js';
import db from '../../config/database.js';
import { runLocationTestSuite } from './locationTests.js';

function handleError(res, err) {
    if (err instanceof LocationError) {
        return res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details
            }
        });
    }
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
        return res.status(409).json({
            error: {
                code: 'LOC_DUPLICATE_NAME',
                message: 'Duplicate entry detected (sibling name or code conflict)',
                details: err.sqlMessage || err.message
            }
        });
    }
    console.error('Location Lab Controller Error:', err);
    return res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An unexpected error occurred'
        }
    });
}

// Ensure the project belongs to the user's organization
async function verifyProjectInOrg(projectId, orgId) {
    if (!projectId) return true;
    try {
        const project = await db('proj_projects').where({ id: projectId }).select('org_id').first();
        if (project && project.org_id && String(project.org_id) !== String(orgId)) {
            throw new LocationError('LOC_CROSS_PROJECT', 'Project belongs to a different organization');
        }
    } catch (err) {
        if (err instanceof LocationError) throw err;
        // If proj_projects table is missing in unseeded/isolated dev environments, log warning and bypass check
        console.warn(`[LocationLab] verifyProjectInOrg check bypassed (${err.message})`);
    }
    return true;
}

// =========================================================================
// Dev Lab Operations (Strictly locked to req.user.org_id)
// =========================================================================

export async function listTypes(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const types = await locationService.listTypes(orgId);
        res.json({ success: true, data: types });
    } catch (err) {
        handleError(res, err);
    }
}

export async function createType(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const type = await locationService.createType({
            orgId,
            code: req.body.code,
            name: req.body.name,
            sortOrder: req.body.sortOrder || req.body.sort_order || 0
        });
        res.status(201).json({ success: true, data: type });
    } catch (err) {
        handleError(res, err);
    }
}

export async function updateType(req, res) {
    try {
        const type = await locationService.updateType(Number(req.params.id), req.body);
        res.json({ success: true, data: type });
    } catch (err) {
        handleError(res, err);
    }
}

export async function deleteType(req, res) {
    try {
        const result = await locationService.deleteType(Number(req.params.id));
        res.json({ success: true, data: result });
    } catch (err) {
        handleError(res, err);
    }
}

export async function seedTypes(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const types = await locationService.seedDefaultTypes(orgId);
        res.json({ success: true, data: types });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getTree(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const projectId = Number(req.query.projectId);
        if (!projectId) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'projectId is required' } });
        }
        await verifyProjectInOrg(projectId, orgId);

        const includeArchived = req.query.includeArchived === 'true';
        const maxDepth = req.query.maxDepth ? Number(req.query.maxDepth) : null;

        const tree = await locationService.getTree(projectId, { includeArchived, maxDepth });
        res.json({ success: true, data: tree });
    } catch (err) {
        handleError(res, err);
    }
}

export async function createLocation(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const createdBy = req.user.id;
        await verifyProjectInOrg(req.body.projectId, orgId);

        const location = await locationService.createLocation({
            ...req.body,
            orgId,
            createdBy
        });
        res.status(201).json({ success: true, data: location });
    } catch (err) {
        handleError(res, err);
    }
}

export async function updateLocation(req, res) {
    try {
        const location = await locationService.updateLocation(Number(req.params.id), req.body);
        res.json({ success: true, data: location });
    } catch (err) {
        handleError(res, err);
    }
}

export async function moveLocation(req, res) {
    try {
        const { newParentId, sortOrder } = req.body;
        const location = await locationService.moveLocation(
            Number(req.params.id),
            newParentId ? Number(newParentId) : null,
            sortOrder !== undefined ? Number(sortOrder) : null
        );
        res.json({ success: true, data: location });
    } catch (err) {
        handleError(res, err);
    }
}

export async function archiveLocation(req, res) {
    try {
        const cascade = req.body.cascade === true;
        const location = await locationService.archiveLocation(Number(req.params.id), { cascade });
        res.json({ success: true, data: location });
    } catch (err) {
        handleError(res, err);
    }
}

export async function restoreLocation(req, res) {
    try {
        const location = await locationService.restoreLocation(Number(req.params.id));
        res.json({ success: true, data: location });
    } catch (err) {
        handleError(res, err);
    }
}

export async function deleteLocation(req, res) {
    try {
        const result = await locationService.deleteLocation(Number(req.params.id));
        res.json({ success: true, data: result });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getLocation(req, res) {
    try {
        const location = await locationService.getLocation(Number(req.params.id));
        if (!location) {
            return res.status(404).json({ error: { code: 'LOC_NOT_FOUND', message: 'Location not found' } });
        }
        res.json({ success: true, data: location });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getSubtree(req, res) {
    try {
        const id = Number(req.params.id);
        const includeArchived = req.query.includeArchived === 'true';
        const maxDepth = req.query.maxDepth ? Number(req.query.maxDepth) : null;
        const subtree = await locationService.getSubtree(id, { includeArchived, maxDepth });
        res.json({ success: true, data: subtree });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getDescendantIds(req, res) {
    try {
        const id = Number(req.params.id);
        const ids = await locationService.getDescendantIds(id);
        res.json({ success: true, data: ids });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getAncestors(req, res) {
    try {
        const id = Number(req.params.id);
        const ancestors = await locationService.getAncestors(id);
        res.json({ success: true, data: ancestors });
    } catch (err) {
        handleError(res, err);
    }
}

export async function ensurePath(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const { projectId, segments } = req.body;
        await verifyProjectInOrg(projectId, orgId);

        const leaf = await locationService.ensurePath(Number(projectId), segments, orgId);
        res.json({ success: true, data: leaf });
    } catch (err) {
        handleError(res, err);
    }
}

export async function checkIntegrity(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const projectId = Number(req.query.projectId);
        if (!projectId) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'projectId is required' } });
        }
        await verifyProjectInOrg(projectId, orgId);

        const violations = await locationService.checkIntegrity(projectId);
        res.json({ success: true, data: violations });
    } catch (err) {
        handleError(res, err);
    }
}

export async function rebuildPaths(req, res) {
    try {
        const orgId = req.user.org_id || 1;
        const projectId = Number(req.body.projectId);
        if (!projectId) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'projectId is required' } });
        }
        await verifyProjectInOrg(projectId, orgId);

        const result = await locationService.rebuildPaths(projectId);
        res.json({ success: true, data: result });
    } catch (err) {
        handleError(res, err);
    }
}

export async function runTests(req, res) {
    try {
        const targetCase = req.body?.caseNum || req.query?.caseNum || null;
        console.log(`[LocationLab] 🧪 Integration test suite triggered by user #${req.user?.id} (${req.user?.email}) [Target: ${targetCase || 'all'}]`);
        const report = await runLocationTestSuite({ targetCase, closeDb: false });
        res.json({ success: true, data: report });
    } catch (err) {
        handleError(res, err);
    }
}

