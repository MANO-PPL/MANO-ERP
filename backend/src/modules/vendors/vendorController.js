import catchAsync from '../../utils/catchAsync.js';
import vendorService from './vendorService.js';
import AppError from '../../utils/AppError.js';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

export const listVendors = catchAsync(async (req, res) => {
    const { vendors, total, page, limit } = await vendorService.getVendors(req.query);
    res.json({ success: true, vendors, total, page, limit });
});

export const getVendor = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
        throw new AppError('Invalid Vendor ID', 400);
    }

    const vendor = await vendorService.getVendorById(id);
    res.json({ success: true, vendor });
});

export const createVendor = catchAsync(async (req, res) => {
    const newId = await vendorService.createVendor(req.body);
    res.status(201).json({ success: true, message: 'Vendor created successfully', id: newId });
});

export const updateVendor = catchAsync(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
        throw new AppError('Invalid Vendor ID', 400);
    }

    await vendorService.updateVendor(id, req.body);
    res.json({ success: true, message: 'Vendor updated successfully' });
});

export const deleteVendors = catchAsync(async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Please provide an array of vendor IDs', 400);
    }

    await vendorService.deleteVendors(ids);
    res.json({ success: true, message: 'Vendors deleted successfully' });
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

    const results = await vendorService.bulkInsertVendors(rowsData);

    res.json({ success: true, report: results });
});

export const bulkValidate = catchAsync(async (req, res) => {
    const { vendors } = req.body;
    if (!vendors || !Array.isArray(vendors)) throw new AppError('Invalid vendors list', 400);

    const response = await vendorService.bulkValidateVendors(vendors);
    res.json({ success: true, validation: response });
});

export const bulkJson = catchAsync(async (req, res) => {
    const { vendors } = req.body;
    if (!vendors || !Array.isArray(vendors) || vendors.length === 0) throw new AppError('Invalid data provided', 400);

    const results = await vendorService.bulkInsertVendors(vendors);

    res.json({ ok: true, report: results });
});

export default {
    listVendors,
    getVendor,
    createVendor,
    updateVendor,
    deleteVendors,
    bulkUpload,
    bulkValidate,
    bulkJson
};
