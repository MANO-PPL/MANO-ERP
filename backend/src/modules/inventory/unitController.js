import catchAsync from '../../utils/catchAsync.js';
import unitService from './unitService.js';
import AppError from '../../utils/AppError.js';

export const listUnits = catchAsync(async (req, res) => {
    const { unit_type } = req.query;
    const units = await unitService.getUnits(req.user.org_id, unit_type || null);
    res.json({ success: true, units });
});

export const createUnit = catchAsync(async (req, res) => {
    const { name, symbol, unit_type, base_unit_id, conversion_factor } = req.body;
    const id = await unitService.createUnit(req.user.org_id, { name, symbol, unit_type, base_unit_id, conversion_factor });
    res.status(201).json({ success: true, message: 'Unit created successfully', id });
});

export const updateUnit = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Unit ID', 400);
    await unitService.updateUnit(req.user.org_id, id, req.body);
    res.json({ success: true, message: 'Unit updated successfully' });
});

export const deleteUnit = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) throw new AppError('Invalid Unit ID', 400);
    await unitService.deleteUnit(req.user.org_id, id);
    res.json({ success: true, message: 'Unit deleted successfully' });
});

export default { listUnits, createUnit, updateUnit, deleteUnit };
