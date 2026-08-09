import catchAsync from '../../utils/catchAsync.js';
import clientService from './clientService.js';
import AppError from '../../utils/AppError.js';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

const parseContactId = (value, field) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        throw new AppError(`${field} must be a positive integer`, 400);
    }
    return id;
};

export const listClients = catchAsync(async (req, res) => {
    const { clients, total, page, limit } = await clientService.getClients(req.user.org_id, req.query);
    res.json({ success: true, clients, total, page, limit });
});

export const getClient = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
         throw new AppError('Invalid Client ID', 400);
    }

    const client = await clientService.getClientById(req.user.org_id, id);
    res.json({ success: true, client });
});

export const createClient = catchAsync(async (req, res) => {
    const newId = await clientService.createClient(req.user.org_id, req.body);
    res.status(201).json({ success: true, message: 'Client created successfully', id: newId });
});

export const updateClient = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
         throw new AppError('Invalid Client ID', 400);
    }

    await clientService.updateClient(req.user.org_id, id, req.body);
    res.json({ success: true, message: 'Client updated successfully' });
});

export const deleteClient = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
         throw new AppError('Invalid Client ID', 400);
    }

    await clientService.deleteClient(req.user.org_id, id);
    res.json({ success: true, message: 'Client deleted successfully' });
});

export const deleteClients = catchAsync(async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Please provide an array of client IDs', 400);
    }

    await clientService.deleteClients(req.user.org_id, ids);
    res.json({ success: true, message: 'Clients deleted successfully' });
});

export const bulkUpload = catchAsync(async (req, res) => {
    if (!req.file) throw new AppError('Please upload a CSV or Excel file', 400);

    const workbook = new ExcelJS.Workbook();
    const buffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const originalName = (req.file.originalname || '').toLowerCase();

    if (mimeType.includes('csv') || originalName.endsWith('.csv')) {
        const bufferStream = new PassThrough();
        bufferStream.end(buffer);
        await workbook.csv.read(bufferStream);
    } else {
        await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new AppError('Invalid or empty file', 400);

    const headerMap = {};
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString().toLowerCase().trim() : '';
        headerMap[val] = colNumber;
    });

    const rowsData = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip headers

        const record = {};
        for (const [key, colNum] of Object.entries(headerMap)) {
            const cell = row.getCell(colNum);
            record[key] = cell.value ? cell.value.toString().trim() : null;
        }

        rowsData.push(record);
    });

    const results = await clientService.bulkInsertClients(req.user.org_id, rowsData);
    res.json({ success: true, report: results });
});

export const bulkValidate = catchAsync(async (req, res) => {
    const { clients } = req.body;
    if (!clients || !Array.isArray(clients)) {
        throw new AppError('Invalid clients data', 400);
    }
    const validation = await clientService.bulkValidateClients(req.user.org_id, clients);
    res.json({ success: true, validation });
});

export const bulkJson = catchAsync(async (req, res) => {
    const { clients } = req.body;
    if (!clients || !Array.isArray(clients)) {
        throw new AppError('Invalid clients data', 400);
    }
    const results = await clientService.bulkInsertClients(req.user.org_id, clients);
    res.json({ success: true, report: results });
});

export const addInteraction = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
        throw new AppError('Invalid Client ID', 400);
    }

    const interactionData = {
        ...req.body,
        contact_id: id,
        interacted_by: req.user?.user_id
    };

    const newId = await clientService.createInteraction(req.user.org_id, interactionData);
    res.status(201).json({ success: true, message: 'Interaction logged successfully', id: newId });
});

export const createMasterContact = catchAsync(async (req, res) => {
    const contact = await clientService.createMasterContact(req.user.org_id, req.body || {});
    res.status(201).json({ success: true, contact });
});

export const createProjectContact = catchAsync(async (req, res) => {
    const projectId = parseContactId(req.params.id, 'project_id');
    const result = await clientService.createProjectContact(req.user.org_id, projectId, req.body || {});
    res.status(201).json({ success: true, ...result });
});

export const listAvailableContacts = catchAsync(async (req, res) => {
    const projectId = parseContactId(req.params.id, 'project_id');
    const result = await clientService.getAvailableContacts(req.user.org_id, projectId, req.query);
    res.json({ success: true, ...result });
});

export const promoteContact = catchAsync(async (req, res) => {
    const contactId = parseContactId(req.params.id, 'contact_id');
    const contact = await clientService.promoteContactToMaster(req.user.org_id, contactId);
    res.json({ success: true, contact });
});

export default {
    listClients,
    getClient,
    createClient,
    updateClient,
    deleteClient,
    deleteClients,
    bulkUpload,
    bulkValidate,
    bulkJson,
    addInteraction,
    createMasterContact,
    createProjectContact,
    listAvailableContacts,
    promoteContact
};
