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

// Resolve the effective rate for a resource. A row in res_rates is manual;
// an item without an effective row is calculated from its composition.
export const getResolvedRate = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);

    const rate = await resourceService.getResolvedRate(
        req.user.org_id,
        parseInt(id),
        req.query.date
    );
    res.json({ success: true, rate });
});

export const createResource = catchAsync(async (req, res) => {
    // If the payload is an array, treat it as a bulk upload
    if (Array.isArray(req.body)) {
        const result = await resourceService.bulkInsertResources(req.user.org_id, req.body);
        if (result.errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Bulk insert failed and was rolled back.',
                report: result
            });
        }
        return res.status(201).json({ success: true, report: result });
    }

    // Otherwise, treat it as a single resource creation
    const { name, code, type, base_unit_id, base_unit_code, description, remarks, compositions, conversions } = req.body;
    const resolvedUnitCode = base_unit_code || base_unit_id;
    
    const comps = (compositions || []).map(c => ({
        component_resource_id: c.component_resource_id,
        quantity: c.quantity,
        unit_code: c.unit_code || c.unit_id
    }));

    const convs = (conversions || []).map(c => ({
        name: c.name,
        quantity: c.quantity,
        unit_code: c.unit_code || c.unit_id
    }));

    const id = await resourceService.createResource(req.user.org_id, { 
        name, 
        code, 
        type, 
        base_unit_code: resolvedUnitCode, 
        description, 
        remarks, 
        compositions: comps,
        conversions: convs 
    });
    
    res.status(201).json({ success: true, message: 'Resource created successfully', id });
});

export const updateResource = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    
    const { name, code, type, base_unit_id, base_unit_code, description, remarks, compositions, conversions } = req.body;
    const resolvedUnitCode = base_unit_code || base_unit_id;

    await resourceService.updateResource(req.user.org_id, id, {
        name,
        code,
        type,
        base_unit_code: resolvedUnitCode,
        description,
        remarks,
        compositions,
        conversions
    });
    res.json({ success: true, message: 'Resource updated successfully' });
});

export const deleteResource = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    await resourceService.deleteResource(req.user.org_id, id);
    res.json({ success: true, message: 'Resource deleted successfully' });
});

export const setCompositions = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    const { compositions, effective_from } = req.body;
    if (!Array.isArray(compositions)) throw new AppError('compositions must be an array', 400);
    await resourceService.setCompositions(req.user.org_id, id, compositions, effective_from);
    res.json({ success: true, message: 'Compositions updated' });
});

export const addConversion = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    
    const { name, quantity, unit_id, unit_code } = req.body;
    const resolvedUnitCode = unit_code || unit_id;

    const convId = await resourceService.addConversion(req.user.org_id, id, { 
        name, 
        quantity, 
        unit_code: resolvedUnitCode 
    });
    
    res.status(201).json({ success: true, message: 'Conversion added', id: convId });
});

// Adding a row creates a manual rate. Omitting a row leaves item rates
// derived from composition and leaves base-resource rates unavailable.
export const addRate = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);

    const { rate, unit_id, unit_code, effective_from, remarks } = req.body;
    const rateId = await resourceService.addRate(req.user.org_id, parseInt(id), {
        rate,
        unit_code: unit_code || unit_id,
        effective_from,
        remarks
    });

    res.status(201).json({ success: true, message: 'Manual rate added', id: rateId });
});

export const getRateHistory = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    const rates = await resourceService.getRateHistory(req.user.org_id, parseInt(id));
    res.json({ success: true, rates });
});

export const removeConversion = catchAsync(async (req, res) => {
    const { conv_id } = req.params;
    if (!conv_id || isNaN(parseInt(conv_id))) throw new AppError('Invalid Conversion ID', 400);
    await resourceService.removeConversion(req.user.org_id, conv_id);
    res.json({ success: true, message: 'Conversion removed' });
});

export const bulkUpdateResources = catchAsync(async (req, res) => {
    if (!Array.isArray(req.body)) {
        throw new AppError('Body must be an array of resources', 400);
    }
    const result = await resourceService.bulkUpdateResources(req.user.org_id, req.body);
    if (result.errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Bulk update failed and was rolled back.',
            report: result
        });
    }
    return res.json({ success: true, report: result });
});

export const clearManualRate = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Resource ID', 400);
    const { effective_from } = req.body;
    if (!effective_from) throw new AppError('effective_from date is required', 400);

    await resourceService.clearManualRate(req.user.org_id, parseInt(id), effective_from);
    res.json({ success: true, message: 'Manual rate cleared' });
});



export default {
    listResources,
    getResource,
    getResolvedRate,
    createResource,
    updateResource,
    deleteResource,
    setCompositions,
    addConversion,
    addRate,
    getRateHistory,
    removeConversion,
    bulkUpdateResources,
    clearManualRate
};
