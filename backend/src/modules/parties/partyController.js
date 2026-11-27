import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import partyService from './partyService.js';
import partyBulkService from './partyBulkService.js';
import partyContactService from './partyContactService.js';

const parsePositiveId = (value, field) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError(`${field} must be a positive integer`, 400);
    }
    return id;
};

const resolveScopeMode = (req) => req.query.party_type || req.body?.party_type || 'all';
const labelForScope = (scopeMode) => (scopeMode === 'client' ? 'Client' : scopeMode === 'vendor' ? 'Vendor' : 'Party');

export const listParties = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const { parties, total, page, limit } = await partyService.listParties(req.user.org_id, req.query, { scopeMode });
    if (scopeMode === 'client') return res.json({ success: true, clients: parties, parties, total, page, limit });
    if (scopeMode === 'vendor') return res.json({ success: true, vendors: parties, parties, total, page, limit });
    res.json({ success: true, parties, total, page, limit });
});

export const getParty = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const id = parsePositiveId(req.params.id, `${labelForScope(scopeMode)} ID`);
    const party = await partyService.getPartyById(req.user.org_id, id, { scopeMode });
    if (scopeMode === 'client') return res.json({ success: true, client: party, party });
    if (scopeMode === 'vendor') return res.json({ success: true, vendor: party, party });
    res.json({ success: true, party });
});

export const createParty = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const newId = await partyService.createParty(req.user.org_id, {
        ...req.body,
        interacted_by: req.user?.id
    }, { scopeMode, userId: req.user?.id });
    res.status(201).json({ success: true, message: `${labelForScope(scopeMode)} created successfully`, id: newId });
});

export const updateParty = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const id = parsePositiveId(req.params.id, `${labelForScope(scopeMode)} ID`);
    await partyService.updateParty(req.user.org_id, id, {
        ...req.body,
        interacted_by: req.user?.id
    }, { scopeMode, userId: req.user?.id });
    res.json({ success: true, message: `${labelForScope(scopeMode)} updated successfully` });
});

export const archiveParty = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const id = parsePositiveId(req.params.id, 'Party ID');
    const party = await partyService.setPartyStatus(req.user.org_id, id, 'archived', {
        scopeMode,
        userId: req.user?.id,
        reason: req.body?.reason || null
    });
    res.json({ success: true, message: 'Party archived successfully', party });
});

export const restoreParty = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const id = parsePositiveId(req.params.id, 'Party ID');
    const party = await partyService.setPartyStatus(req.user.org_id, id, 'active', {
        scopeMode,
        userId: req.user?.id,
        reason: req.body?.reason || null
    });
    res.json({ success: true, message: 'Party restored successfully', party });
});

export const getPartyChangeLog = catchAsync(async (req, res) => {
    const id = parsePositiveId(req.params.id, 'Party ID');
    const logs = await partyService.listPartyChangeLog(req.user.org_id, id);
    res.json({ success: true, logs });
});

export const deleteParty = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const id = parsePositiveId(req.params.id, `${labelForScope(scopeMode)} ID`);
    await partyService.deleteParties(req.user.org_id, [id], {
        scopeMode,
        requireMatch: true,
        reason: req.body?.reason || req.query?.reason || null,
        userId: req.user?.id
    });
    res.json({ success: true, message: `${labelForScope(scopeMode)} deleted successfully` });
});

export const deleteParties = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const { ids, reason } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new AppError(`Please provide an array of ${labelForScope(scopeMode).toLowerCase()} IDs`, 400);
    }
    await partyService.deleteParties(req.user.org_id, ids, {
        scopeMode,
        requireMatch: scopeMode === 'vendor',
        reason: reason || null,
        userId: req.user?.id
    });
    res.json({ success: true, message: `${labelForScope(scopeMode)}s deleted successfully` });
});

export const bulkUpload = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const rowsData = await partyBulkService.parseSpreadsheetBuffer(req.file);
    const report = await partyBulkService.bulkInsertParties(req.user.org_id, rowsData, {
        scopeMode,
        userId: req.user?.id
    });
    res.json({ success: true, report });
});

export const bulkValidate = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const rows = req.body.parties || req.body.clients || req.body.vendors;
    if (!rows || !Array.isArray(rows)) {
        throw new AppError('Invalid data', 400);
    }
    const validation = await partyBulkService.bulkValidateParties(req.user.org_id, rows, { scopeMode });
    res.json({ success: true, validation });
});

export const bulkJson = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const rows = req.body.parties || req.body.clients || req.body.vendors;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        throw new AppError('Invalid data provided', 400);
    }
    const report = await partyBulkService.bulkInsertParties(req.user.org_id, rows, {
        scopeMode,
        userId: req.user?.id
    });
    res.json({ success: true, report });
});

export const batchSave = catchAsync(async (req, res) => {
    const scopeMode = resolveScopeMode(req);
    const { created = [], updated = [], deleted = [] } = req.body;
    const result = await partyBulkService.batchSaveParties(
        req.user.org_id,
        { created, updated, deleted },
        { scopeMode, userId: req.user?.id }
    );
    res.json({
        success: true,
        message: `${labelForScope(scopeMode)}s batch save completed successfully`,
        ...result
    });
});

export const createMasterContact = catchAsync(async (req, res) => {
    const contact = await partyService.createMasterContact(req.user.org_id, req.body, { userId: req.user?.id });
    res.status(201).json({ success: true, contact });
});

export const createProjectContact = catchAsync(async (req, res) => {
    const projectId = parsePositiveId(req.params.id, 'project_id');
    const result = await partyService.createProjectContact(req.user.org_id, projectId, req.body, { userId: req.user?.id });
    res.status(201).json({ success: true, ...result });
});

export const listAvailableContacts = catchAsync(async (req, res) => {
    const projectId = parsePositiveId(req.params.id, 'project_id');
    const result = await partyService.getAvailableContacts(req.user.org_id, projectId, req.query);
    res.json({ success: true, ...result });
});

export const listPartyContactPersons = catchAsync(async (req, res) => {
    const partyId = parsePositiveId(req.params.id, 'Party ID');
    const contacts = await partyContactService.listContactPersons(req.user.org_id, partyId);
    res.json({ success: true, contacts });
});

export const addPartyContactPerson = catchAsync(async (req, res) => {
    const partyId = parsePositiveId(req.params.id, 'Party ID');
    const contact = await partyContactService.addContactPerson(req.user.org_id, partyId, req.body, {
        userId: req.user?.id
    });
    res.status(201).json({ success: true, contact });
});

export const updatePartyContactPerson = catchAsync(async (req, res) => {
    const partyId = parsePositiveId(req.params.id, 'Party ID');
    const personId = parsePositiveId(req.params.personId, 'Contact person ID');
    const contact = await partyContactService.updateContactPerson(req.user.org_id, partyId, personId, req.body, {
        userId: req.user?.id
    });
    res.json({ success: true, contact });
});

export const setPrimaryPartyContactPerson = catchAsync(async (req, res) => {
    const partyId = parsePositiveId(req.params.id, 'Party ID');
    const personId = parsePositiveId(req.params.personId, 'Contact person ID');
    const contact = await partyContactService.setPrimaryContactPerson(req.user.org_id, partyId, personId, {
        userId: req.user?.id
    });
    res.json({ success: true, contact });
});

export const deletePartyContactPerson = catchAsync(async (req, res) => {
    const partyId = parsePositiveId(req.params.id, 'Party ID');
    const personId = parsePositiveId(req.params.personId, 'Contact person ID');
    await partyContactService.deleteContactPerson(req.user.org_id, partyId, personId, {
        userId: req.user?.id,
        reason: req.body?.reason || req.query?.reason || null
    });
    res.json({ success: true, message: 'Contact person deleted successfully' });
});

export default {
    listParties,
    getParty,
    createParty,
    updateParty,
    archiveParty,
    restoreParty,
    getPartyChangeLog,
    deleteParty,
    deleteParties,
    bulkUpload,
    bulkValidate,
    bulkJson,
    batchSave,
    createMasterContact,
    createProjectContact,
    listAvailableContacts,
    listPartyContactPersons,
    addPartyContactPerson,
    updatePartyContactPerson,
    setPrimaryPartyContactPerson,
    deletePartyContactPerson
};
