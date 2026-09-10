import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { fail } from './agentValidation.js';

// 30-minute time-to-live for temporary in-memory spreadsheet staging
const TTL_MS = 30 * 60 * 1000;
const uploads = new Map();

function sweep() {
    const now = Date.now();
    for (const [id, item] of uploads.entries()) {
        if (now - item.createdAt > TTL_MS) {
            uploads.delete(id);
        }
    }
}
setInterval(sweep, 5 * 60 * 1000).unref();

function normalizeCellValue(cell) {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'object') {
        // ExcelJS rich text or formula result
        if (cell.text !== undefined) return String(cell.text).trim();
        if (cell.result !== undefined) return String(cell.result).trim();
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
    }
    return String(cell).trim();
}

/**
 * Parse an Excel (.xlsx, .xls) or CSV buffer into structured rows.
 */
export async function parseSpreadsheet(buffer, filename, orgId) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        fail('validation_error', 'invalid_file_buffer');
    }
    if (buffer.length > 15 * 1024 * 1024) {
        fail('validation_error', 'file_size_exceeded');
    }

    const workbook = new ExcelJS.Workbook();
    const ext = (filename || '').toLowerCase().split('.').pop();

    if (ext === 'csv') {
        const stream = Readable.from(buffer);
        await workbook.csv.read(stream);
    } else {
        await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        fail('validation_error', 'empty_spreadsheet');
    }

    const headers = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const val = normalizeCellValue(cell.value);
        if (val) {
            headers.push({ colNumber, name: val });
        }
    });

    if (headers.length === 0) {
        fail('validation_error', 'missing_spreadsheet_headers');
    }

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const rowData = {};
        let hasAnyValue = false;

        for (const h of headers) {
            const cell = row.getCell(h.colNumber);
            const val = normalizeCellValue(cell.value);
            rowData[h.name] = val;
            if (val) hasAnyValue = true;
        }

        if (hasAnyValue) {
            rows.push(rowData);
        }
    });

    if (rows.length === 0) {
        fail('validation_error', 'no_data_rows_found');
    }

    const uploadId = randomUUID();
    const dataset = {
        uploadId,
        orgId,
        filename,
        sheetName: worksheet.name || 'Sheet1',
        totalRows: rows.length,
        headers: headers.map(h => h.name),
        rows,
        sampleRows: rows.slice(0, 5),
        createdAt: Date.now()
    };

    uploads.set(uploadId, dataset);

    return {
        uploadId,
        filename,
        sheetName: dataset.sheetName,
        totalRows: dataset.totalRows,
        headers: dataset.headers,
        preview: dataset.sampleRows
    };
}

/**
 * Retrieve a previously uploaded and parsed dataset by uploadId and orgId.
 */
export function getUploadedDataset(uploadId, orgId) {
    if (!uploadId) return null;
    const dataset = uploads.get(uploadId);
    if (!dataset) return null;
    if (Number(dataset.orgId) !== Number(orgId)) {
        fail('authorization_denied', 'upload_org_mismatch');
    }
    if (Date.now() - dataset.createdAt > TTL_MS) {
        uploads.delete(uploadId);
        return null;
    }
    return dataset;
}

/**
 * Clean up dataset from memory once imported or discarded.
 */
export function cleanupUpload(uploadId) {
    if (uploadId) uploads.delete(uploadId);
}
