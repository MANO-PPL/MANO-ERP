import * as locationService from './locationService.js';
import { LocationError } from './locationErrors.js';

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
    // Handle MySQL unique constraint duplicate entry
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
        return res.status(409).json({
            error: {
                code: 'LOC_DUPLICATE_NAME',
                message: 'Duplicate entry detected (sibling name or code conflict)',
                details: err.sqlMessage || err.message
            }
        });
    }
    console.error('Unexpected Location Controller Error:', err);
    return res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An unexpected error occurred'
        }
    });
}

// Types Controllers
export async function listTypes(req, res) {
    try {
        const orgId = req.query.orgId || req.user?.org_id || 1;
        const types = await locationService.listTypes(orgId);
        res.json({ success: true, data: types });
    } catch (err) {
        handleError(res, err);
    }
}

export async function createType(req, res) {
    try {
        const orgId = req.body.orgId || req.user?.org_id || 1;
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
        const orgId = req.body.orgId || req.user?.org_id || 1;
        const types = await locationService.seedDefaultTypes(orgId);
        res.json({ success: true, data: types });
    } catch (err) {
        handleError(res, err);
    }
}

// Locations Controllers
export async function createLocation(req, res) {
    try {
        const orgId = req.body.orgId || req.user?.org_id || 1;
        const createdBy = req.user?.id || req.body.createdBy || null;
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
            return res.status(404).json({
                error: { code: 'LOC_NOT_FOUND', message: 'Location not found' }
            });
        }
        res.json({ success: true, data: location });
    } catch (err) {
        handleError(res, err);
    }
}

export async function listChildren(req, res) {
    try {
        const projectId = Number(req.query.projectId);
        const parentId = req.query.parentId ? Number(req.query.parentId) : null;
        if (!projectId) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'projectId is required' } });
        }
        const children = await locationService.listChildren(projectId, parentId);
        res.json({ success: true, data: children });
    } catch (err) {
        handleError(res, err);
    }
}

export async function getTree(req, res) {
    try {
        const projectId = Number(req.query.projectId);
        const includeArchived = req.query.includeArchived === 'true';
        const maxDepth = req.query.maxDepth ? Number(req.query.maxDepth) : null;

        if (!projectId) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'projectId is required' } });
        }

        const tree = await locationService.getTree(projectId, { includeArchived, maxDepth });
        res.json({ success: true, data: tree });
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
        const { projectId, segments, orgId } = req.body;
        const targetOrgId = orgId || req.user?.org_id || 1;
        const leaf = await locationService.ensurePath(Number(projectId), segments, targetOrgId);
        res.json({ success: true, data: leaf });
    } catch (err) {
        handleError(res, err);
    }
}

export async function checkIntegrity(req, res) {
    try {
        const projectId = Number(req.query.projectId);
        if (!projectId) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'projectId is required' } });
        }
        const violations = await locationService.checkIntegrity(projectId);
        res.json({ success: true, data: violations });
    } catch (err) {
        handleError(res, err);
    }
}

export async function rebuildPaths(req, res) {
    try {
        const projectId = Number(req.body.projectId);
        if (!projectId) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'projectId is required' } });
        }
        const result = await locationService.rebuildPaths(projectId);
        res.json({ success: true, data: result });
    } catch (err) {
        handleError(res, err);
    }
}

