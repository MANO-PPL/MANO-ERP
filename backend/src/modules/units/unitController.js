import catchAsync from '../../utils/catchAsync.js';
import unitService from './unitService.js';

export const listUnits = catchAsync(async (req, res) => {
    const { unit_type } = req.query;
    const units = await unitService.getUnits(unit_type || null);
    res.json({ success: true, units });
});

export default {
    listUnits
};
