import catchAsync from '../../utils/catchAsync.js';
import cycleService from './cycleService.js';
import AppError from '../../utils/AppError.js';

export const initiateCycle = catchAsync(async (req, res) => {
    const { instance_id } = req.params;
    if (!instance_id || isNaN(parseInt(instance_id))) {
        throw new AppError('Invalid Instance ID', 400);
    }
    
    const cycleId = await cycleService.initiateCycle(req.user.org_id, instance_id, req.user.id);
    
    res.status(201).json({
        success: true,
        message: 'Cycle initiated successfully',
        cycle_id: cycleId
    });
});

export const listCycles = catchAsync(async (req, res) => {
    const { instance_id } = req.params;
    if (!instance_id || isNaN(parseInt(instance_id))) {
        throw new AppError('Invalid Instance ID', 400);
    }
    
    const cycles = await cycleService.listCycles(req.user.org_id, instance_id);
    
    res.json({
        success: true,
        cycles
    });
});

export const getCycle = catchAsync(async (req, res) => {
    const { cycle_id } = req.params;
    if (!cycle_id || isNaN(parseInt(cycle_id))) {
        throw new AppError('Invalid Cycle ID', 400);
    }
    
    const cycleDetail = await cycleService.getCycleDetail(req.user.org_id, cycle_id);
    
    res.json({
        success: true,
        cycle: cycleDetail
    });
});

export const saveDraft = catchAsync(async (req, res) => {
    const { cycle_id } = req.params;
    if (!cycle_id || isNaN(parseInt(cycle_id))) {
        throw new AppError('Invalid Cycle ID', 400);
    }

    const { content } = req.body;
    
    const lastSaved = await cycleService.saveDraft(req.user.org_id, cycle_id, req.user.id, content);

    res.json({
        success: true,
        message: 'Draft saved successfully',
        last_draft_saved: lastSaved
    });
});

export const submitDraft = catchAsync(async (req, res) => {
    const { cycle_id } = req.params;
    if (!cycle_id || isNaN(parseInt(cycle_id))) {
        throw new AppError('Invalid Cycle ID', 400);
    }

    const { changes_summary, comments } = req.body;

    const result = await cycleService.submitDraft(req.user.org_id, cycle_id, req.user.id, { changes_summary, comments });

    res.json({
        success: true,
        message: 'Draft submitted successfully',
        ...result
    });
});

export const requestRevision = catchAsync(async (req, res) => {
    const { cycle_id } = req.params;
    if (!cycle_id || isNaN(parseInt(cycle_id))) throw new AppError('Invalid Cycle ID', 400);

    const { comments } = req.body;
    const result = await cycleService.requestRevision(req.user.org_id, cycle_id, req.user.id, comments);

    res.json({ success: true, message: 'Revision requested', ...result });
});

export const rejectCycle = catchAsync(async (req, res) => {
    const { cycle_id } = req.params;
    if (!cycle_id || isNaN(parseInt(cycle_id))) throw new AppError('Invalid Cycle ID', 400);

    const { comments } = req.body;
    const result = await cycleService.rejectCycle(req.user.org_id, cycle_id, req.user.id, comments);

    res.json({ success: true, message: 'Cycle rejected', ...result });
});

export const cancelCycle = catchAsync(async (req, res) => {
    const { cycle_id } = req.params;
    if (!cycle_id || isNaN(parseInt(cycle_id))) throw new AppError('Invalid Cycle ID', 400);

    const { comments } = req.body;
    const result = await cycleService.cancelCycle(req.user.org_id, cycle_id, req.user.id, comments);

    res.json({ success: true, message: 'Cycle cancelled', ...result });
});

export const claimRevision = catchAsync(async (req, res) => {
    const { cycle_id } = req.params;
    if (!cycle_id || isNaN(parseInt(cycle_id))) throw new AppError('Invalid Cycle ID', 400);

    const result = await cycleService.claimRevision(req.user.org_id, cycle_id, req.user.id);

    res.json({ success: true, message: 'Revision claimed', ...result });
});

export default {
    initiateCycle,
    listCycles,
    getCycle,
    saveDraft,
    submitDraft,
    requestRevision,
    rejectCycle,
    cancelCycle,
    claimRevision
};
