import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import projectResourceService from './projectResourceService.js';

function parseId(value, label) {
    const id = parseInt(value);
    if (Number.isNaN(id)) throw new AppError(`Invalid ${label}`, 400);
    return id;
}

function parseIds(value) {
    const rawIds = Array.isArray(value) ? value : String(value || '').split(',');
    const ids = [...new Set(rawIds.map(value => parseInt(value, 10)))];
    if (ids.length === 0 || ids.some(id => Number.isNaN(id))) {
        throw new AppError('ids must contain one or more valid resource IDs', 400);
    }
    return ids;
}

export const listProjectResources = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const resources = await projectResourceService.listProjectResources(req.user.org_id, projectId);
    res.json({ success: true, resources });
});

export const getResolvedRates = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const rates = await projectResourceService.getResolvedRates(
        req.user.org_id,
        projectId,
        parseIds(req.query.ids),
        req.query.date
    );
    res.json({ success: true, rates });
});

export const getResolvedRate = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const resourceId = parseId(req.params.resourceId, 'Resource ID');
    const rate = await projectResourceService.getResolvedRate(
        req.user.org_id,
        projectId,
        resourceId,
        req.query.date
    );
    res.json({ success: true, rate });
});

export const removeProjectResource = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const resourceId = parseId(req.params.resourceId, 'Resource ID');
    await projectResourceService.removeProjectResource(req.user.org_id, projectId, resourceId);
    res.json({ success: true, message: 'Resource removed from project' });
});

export const addRate = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const resourceId = parseId(req.params.resourceId, 'Resource ID');
    const { rate, unit_id, unit_code, effective_from, remarks } = req.body;
    const rateId = await projectResourceService.addRate(req.user.org_id, projectId, resourceId, {
        rate,
        unit_code: unit_code || unit_id,
        effective_from,
        remarks
    });
    res.status(201).json({ success: true, message: 'Project rate added', id: rateId });
});

export const getRateHistory = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const resourceId = parseId(req.params.resourceId, 'Resource ID');
    const rates = await projectResourceService.getRateHistory(req.user.org_id, projectId, resourceId);
    res.json({ success: true, rates });
});

export const clearRate = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const resourceId = parseId(req.params.resourceId, 'Resource ID');
    const { effective_from } = req.body;
    if (!effective_from) throw new AppError('effective_from date is required', 400);

    await projectResourceService.clearRate(req.user.org_id, projectId, resourceId, effective_from);
    res.json({ success: true, message: 'Project rate reverted to master rate' });
});

export const importResourceToProject = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const resourceId = parseId(req.params.resourceId, 'Resource ID');
    await projectResourceService.importResourceToProject(
        req.user.org_id,
        projectId,
        resourceId,
        req.body.effective_from
    );
    res.status(201).json({ success: true, message: 'Resource imported into project' });
});

export const setCompositions = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const resourceId = parseId(req.params.resourceId, 'Resource ID');
    const { compositions, effective_from } = req.body;
    if (!Array.isArray(compositions)) throw new AppError('compositions must be an array', 400);

    await projectResourceService.setCompositions(
        req.user.org_id,
        projectId,
        resourceId,
        compositions,
        effective_from
    );
    res.json({ success: true, message: 'Project composition updated' });
});

export const getCompositionHistory = catchAsync(async (req, res) => {
    const projectId = parseId(req.params.id, 'Project ID');
    const resourceId = parseId(req.params.resourceId, 'Resource ID');
    const compositions = await projectResourceService.getCompositionHistory(req.user.org_id, projectId, resourceId);
    res.json({ success: true, compositions });
});

export default {
    listProjectResources,
    getResolvedRates,
    removeProjectResource,
    getResolvedRate,
    addRate,
    getRateHistory,
    clearRate,
    importResourceToProject,
    setCompositions,
    getCompositionHistory
};
