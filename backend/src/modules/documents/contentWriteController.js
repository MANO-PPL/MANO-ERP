import catchAsync from '../../utils/catchAsync.js';
import contentWriteService from './contentWriteService.js';
import AppError from '../../utils/AppError.js';

const getCycleId = (req) => {
    const { cycle_id } = req.params;
    if (!cycle_id || isNaN(parseInt(cycle_id))) throw new AppError('Invalid Cycle ID', 400);
    return cycle_id;
};

// --- Directory ---
export const addDirectory = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    const newId = await contentWriteService.directory.add(req.user.org_id, cycleId, req.user.id, req.body);
    res.status(201).json({ success: true, pd_id: newId });
});

export const updateDirectory = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.directory.update(req.user.org_id, cycleId, req.user.id, req.params.pd_id, req.body);
    res.json({ success: true, message: 'Directory updated' });
});

export const deleteDirectory = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.directory.delete(req.user.org_id, cycleId, req.user.id, req.params.pd_id);
    res.json({ success: true, message: 'Directory deleted' });
});

// --- Vendors ---
export const addVendor = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    const newId = await contentWriteService.vendors.add(req.user.org_id, cycleId, req.user.id, req.body);
    res.status(201).json({ success: true, pv_id: newId });
});

export const deleteVendor = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.vendors.delete(req.user.org_id, cycleId, req.user.id, req.params.pv_id);
    res.json({ success: true, message: 'Vendor deleted' });
});

// --- Staff ---
export const addStaff = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    const newId = await contentWriteService.staff.add(req.user.org_id, cycleId, req.user.id, req.body);
    res.status(201).json({ success: true, psrr_id: newId });
});

export const updateStaff = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.staff.update(req.user.org_id, cycleId, req.user.id, req.params.psrr_id, req.body);
    res.json({ success: true, message: 'Staff updated' });
});

export const deleteStaff = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.staff.delete(req.user.org_id, cycleId, req.user.id, req.params.psrr_id);
    res.json({ success: true, message: 'Staff deleted' });
});

// --- MoM ---
export const updateMom = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.mom.updateHeader(req.user.org_id, cycleId, req.user.id, req.body);
    res.json({ success: true, message: 'MoM header updated' });
});

export const addMomParticipant = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    if (!req.body.pd_id) throw new AppError('pd_id is required', 400);
    await contentWriteService.mom.addParticipant(req.user.org_id, cycleId, req.user.id, req.body.pd_id);
    res.status(201).json({ success: true, message: 'MoM participant added' });
});

export const removeMomParticipant = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.mom.removeParticipant(req.user.org_id, cycleId, req.user.id, req.params.pmp_id);
    res.json({ success: true, message: 'MoM participant removed' });
});

// --- Agenda ---
export const updateAgenda = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.agenda.updateHeader(req.user.org_id, cycleId, req.user.id, req.body);
    res.json({ success: true, message: 'Agenda header updated' });
});

export const addAgendaParticipant = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    if (!req.body.pd_id) throw new AppError('pd_id is required', 400);
    await contentWriteService.agenda.addParticipant(req.user.org_id, cycleId, req.user.id, req.body.pd_id);
    res.status(201).json({ success: true, message: 'Agenda participant added' });
});

export const removeAgendaParticipant = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.agenda.removeParticipant(req.user.org_id, cycleId, req.user.id, req.params.pap_id);
    res.json({ success: true, message: 'Agenda participant removed' });
});

// --- Summary ---
export const updateSummary = catchAsync(async (req, res) => {
    const cycleId = getCycleId(req);
    await contentWriteService.summary.update(req.user.org_id, cycleId, req.user.id, req.body);
    res.json({ success: true, message: 'Summary updated' });
});

export default {
    addDirectory, updateDirectory, deleteDirectory,
    addVendor, deleteVendor,
    addStaff, updateStaff, deleteStaff,
    updateMom, addMomParticipant, removeMomParticipant,
    updateAgenda, addAgendaParticipant, removeAgendaParticipant,
    updateSummary
};
