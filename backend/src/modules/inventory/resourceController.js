import catchAsync from '../../utils/catchAsync.js';
import resourceService from './resourceService.js';
import AppError from '../../utils/AppError.js';

// ─── Resources CRUD ───────────────────────────────────────────────────────────

export const listResources = catchAsync(async (req, res) => {
    const { type, search, limit, offset } = req.query;
    const resources = await resourceService.getResources(req.user.org_id, {
        type,
        search,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0
    });
    res.json({ success: true, resources });
});

export const getResource = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    const resource = await resourceService.getResourceById(req.user.org_id, id);
    res.json({ success: true, resource });
});

export const createResource = catchAsync(async (req, res) => {
    const { name, code, type, base_unit_id, description, remarks, compositions } = req.body;
    const id = await resourceService.createResource(req.user.org_id, { name, code, type, base_unit_id, description, remarks, compositions: compositions || [] });
    res.status(201).json({ success: true, message: 'Resource created successfully', id });
});

export const updateResource = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    await resourceService.updateResource(req.user.org_id, id, req.body);
    res.json({ success: true, message: 'Resource updated successfully' });
});

export const deleteResource = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    await resourceService.deleteResource(req.user.org_id, id);
    res.json({ success: true, message: 'Resource deleted successfully' });
});

// ─── Compositions ─────────────────────────────────────────────────────────────

export const setCompositions = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    const { compositions } = req.body;
    if (!Array.isArray(compositions)) throw new AppError('compositions must be an array', 400);
    await resourceService.setCompositions(req.user.org_id, id, compositions);
    res.json({ success: true, message: 'Compositions updated' });
});

// ─── Conversions ──────────────────────────────────────────────────────────────

export const addConversion = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    const { name, quantity, unit_id } = req.body;
    const convId = await resourceService.addConversion(req.user.org_id, id, { name, quantity, unit_id });
    res.status(201).json({ success: true, message: 'Conversion added', id: convId });
});

export const removeConversion = catchAsync(async (req, res) => {
    const { conv_id } = req.params;
    if (!conv_id || isNaN(parseInt(conv_id))) throw new AppError('Invalid Conversion ID', 400);
    await resourceService.removeConversion(req.user.org_id, conv_id);
    res.json({ success: true, message: 'Conversion removed' });
});

export default {
    listResources,
    getResource,
    createResource,
    updateResource,
    deleteResource,
    setCompositions,
    addConversion,
    removeConversion
};
