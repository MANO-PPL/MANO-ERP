import * as XLSX from 'xlsx';
import Papa from 'papaparse';

/**
 * Parse a TSV string (from clipboard paste) into a 2D array matrix.
 * Handles quoted cells with embedded newlines/tabs and both Windows and Unix line breaks.
 */
export const parseTSV = (tsvText) => {
    if (!tsvText || typeof tsvText !== 'string') return [];
    const cleanText = tsvText.replace(/\r\n$/, '').replace(/\n$/, '').replace(/\r$/, '');
    if (!cleanText) return [];

    const isTabDelimited = cleanText.includes('\t');
    const delimiter = isTabDelimited ? '\t' : (cleanText.includes(',') && !cleanText.includes('\n') ? ',' : '\t');

    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (!insideQuotes && char === delimiter) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if (!insideQuotes && (char === '\n' || (char === '\r' && nextChar === '\n'))) {
            if (char === '\r') i++;
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else if (!insideQuotes && char === '\r') {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    currentRow.push(currentCell.trim());
    rows.push(currentRow);

    return rows.filter(r => r.length > 0 && r.some(c => c !== ''));
};

/**
 * Convert a 2D matrix array into a TSV string for clipboard copy.
 */
export const stringifyTSV = (matrix) => {
    if (!matrix || matrix.length === 0) return '';
    return matrix.map((row) =>
        row.map((val) => {
            if (val === null || val === undefined) return '';
            const strVal = String(val);
            if (strVal.includes('\t') || strVal.includes('\n') || strVal.includes('"')) {
                return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
        }).join('\t')
    ).join('\n');
};

/**
 * Fuzzy matches a raw header text string against column definitions and their aliases.
 */
export const matchColumnHeader = (headerText, columns = []) => {
    if (!headerText || typeof headerText !== 'string') return null;
    const clean = headerText.trim().toLowerCase().replace(/[*_#₹()]/g, '').replace(/\s+/g, ' ');

    // 1. Direct match on key or label
    for (const col of columns) {
        const key = col.key.toLowerCase();
        const label = (col.label || col.key).toLowerCase().replace(/[*_#₹()]/g, '').replace(/\s+/g, ' ');
        if (clean === key || clean === label) return col.key;
    }

    // 2. Match on column aliases
    for (const col of columns) {
        if (Array.isArray(col.aliases)) {
            for (const alias of col.aliases) {
                const cleanAlias = alias.toLowerCase().trim();
                if (clean === cleanAlias || clean.startsWith(cleanAlias) || cleanAlias.startsWith(clean)) {
                    return col.key;
                }
            }
        }
    }

    return null;
};

/**
 * Converts column index to Excel column name (0 -> A, 1 -> B, 26 -> AA).
 */
export const getColumnLetter = (colIndex) => {
    let letter = '';
    let temp = colIndex;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
};

/**
 * Converts row and column indices to Excel A1 notation e.g. (0, 0) -> "A1".
 */
export const getA1Notation = (rowIndex, colIndex) => {
    return `${getColumnLetter(colIndex)}${rowIndex + 1}`;
};

/**
 * Transform text casing.
 */
export const transformCase = (value, type = 'uppercase') => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    switch (type) {
        case 'uppercase':
            return str.toUpperCase();
        case 'lowercase':
            return str.toLowerCase();
        case 'titlecase':
            return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        case 'sentencecase':
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        default:
            return str;
    }
};

/**
 * Calculate live selection metrics (Sum, Average, Min, Max, Count, Dimensions).
 */
export const calculateSelectionMetrics = (rows = [], columns = [], bounds = null) => {
    if (!bounds || rows.length === 0 || columns.length === 0) {
        return null;
    }

    const { minRow, maxRow, minCol, maxCol } = bounds;
    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;
    const totalCells = rowCount * colCount;

    let count = 0;
    let numericCount = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let r = minRow; r <= maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        for (let c = minCol; c <= maxCol; c++) {
            const col = columns[c];
            if (!col) continue;
            const val = row[col.key];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                count++;
                const num = Number(val);
                if (!isNaN(num) && typeof val !== 'boolean') {
                    numericCount++;
                    sum += num;
                    if (num < min) min = num;
                    if (num > max) max = num;
                }
            }
        }
    }

    return {
        rowCount,
        colCount,
        totalCells,
        count,
        numericCount,
        hasNumbers: numericCount > 0,
        sum: numericCount > 0 ? Number(sum.toFixed(2)) : 0,
        average: numericCount > 0 ? Number((sum / numericCount).toFixed(2)) : 0,
        min: numericCount > 0 ? min : 0,
        max: numericCount > 0 ? max : 0
    };
};

/**
 * Generates realistic sample/demo rows based on column schema and entity type.
 */
export const generateDemoSampleRows = (columns = [], entityName = 'Data') => {
    const activeCols = columns.filter(c => !c.readOnly && c.key !== 'permissions_access' && c.key !== 'permissions_action');
    const entityLower = (entityName || '').toLowerCase();

    // 3 sample rows
    const row1 = {};
    const row2 = {};
    const row3 = {};

    activeCols.forEach((col) => {
        const key = col.key.toLowerCase();
        const label = (col.label || col.key).toLowerCase();

        if (col.type === 'select' && Array.isArray(col.options) && col.options.length > 0) {
            const opts = col.options.map(o => typeof o === 'object' ? o.value : o);
            row1[col.key] = opts[0] || '';
            row2[col.key] = opts[Math.min(1, opts.length - 1)] || opts[0] || '';
            row3[col.key] = opts[Math.min(2, opts.length - 1)] || opts[0] || '';
        } else if (key.includes('email') || label.includes('email')) {
            if (entityLower.includes('employee') || entityLower.includes('user') || entityLower.includes('admin')) {
                row1[col.key] = 'john.doe@company.com';
                row2[col.key] = 'sarah.smith@company.com';
                row3[col.key] = 'alex.johnson@company.com';
            } else if (entityLower.includes('vendor')) {
                row1[col.key] = 'sales@supremesteels.com';
                row2[col.key] = 'contact@apexinfra.com';
                row3[col.key] = 'orders@premiercement.com';
            } else if (entityLower.includes('client')) {
                row1[col.key] = 'projects@horizontowers.in';
                row2[col.key] = 'procure@metroinfra.in';
                row3[col.key] = 'contracts@apexdev.in';
            } else {
                row1[col.key] = 'demo1@example.com';
                row2[col.key] = 'demo2@example.com';
                row3[col.key] = 'demo3@example.com';
            }
        } else if (key.includes('name') || label.includes('name')) {
            if (entityLower.includes('employee') || entityLower.includes('user') || entityLower.includes('admin')) {
                row1[col.key] = 'John Doe';
                row2[col.key] = 'Sarah Smith';
                row3[col.key] = 'Alex Johnson';
            } else if (entityLower.includes('vendor')) {
                row1[col.key] = 'Supreme Steels & Hardware';
                row2[col.key] = 'Apex Infra Materials';
                row3[col.key] = 'Premier Ready Mix Concrete';
            } else if (entityLower.includes('client')) {
                row1[col.key] = 'Horizon Towers Pvt Ltd';
                row2[col.key] = 'Metro Infrastructure Corp';
                row3[col.key] = 'Apex Developers & Builders';
            } else if (entityLower.includes('resource') || entityLower.includes('material')) {
                row1[col.key] = 'TMT Steel Bars 16mm';
                row2[col.key] = 'OPC 53 Grade Cement';
                row3[col.key] = 'M-Sand Aggregate 20mm';
            } else {
                row1[col.key] = `Sample ${col.label || col.key} 1`;
                row2[col.key] = `Sample ${col.label || col.key} 2`;
                row3[col.key] = `Sample ${col.label || col.key} 3`;
            }
        } else if (key.includes('phone') || key.includes('mobile') || key.includes('contact') || label.includes('mobile') || label.includes('phone')) {
            row1[col.key] = '9876543210';
            row2[col.key] = '9812345678';
            row3[col.key] = '9765432109';
        } else if (key.includes('dept') || label.includes('department')) {
            row1[col.key] = 'Engineering';
            row2[col.key] = 'Operations';
            row3[col.key] = 'Finance & Accounts';
        } else if (key.includes('status') || label.includes('status')) {
            row1[col.key] = 'Active';
            row2[col.key] = 'Active';
            row3[col.key] = 'Active';
        } else if (key.includes('gst') || label.includes('gst')) {
            row1[col.key] = '33AAAAA0000A1Z5';
            row2[col.key] = '33BBBBB1111B2Z6';
            row3[col.key] = '33CCCCC2222C3Z7';
        } else if (key.includes('pan') || label.includes('pan')) {
            row1[col.key] = 'ABCDE1234F';
            row2[col.key] = 'FGHIJ5678K';
            row3[col.key] = 'LMNOP9012Q';
        } else if (key.includes('rate') || key.includes('price') || key.includes('cost') || key.includes('amount') || label.includes('rate') || label.includes('price') || label.includes('amount')) {
            row1[col.key] = 1250;
            row2[col.key] = 3400;
            row3[col.key] = 850;
        } else if (key.includes('qty') || key.includes('quantity') || label.includes('quantity') || label.includes('qty')) {
            row1[col.key] = 100;
            row2[col.key] = 250;
            row3[col.key] = 50;
        } else if (key.includes('unit') || label.includes('unit')) {
            row1[col.key] = 'Nos';
            row2[col.key] = 'MT';
            row3[col.key] = 'Bags';
        } else if (key.includes('date') || label.includes('date') || col.type === 'date') {
            row1[col.key] = '2026-03-01';
            row2[col.key] = '2026-03-15';
            row3[col.key] = '2026-03-28';
        } else if (key.includes('city') || label.includes('city')) {
            row1[col.key] = 'Chennai';
            row2[col.key] = 'Coimbatore';
            row3[col.key] = 'Bangalore';
        } else if (key.includes('state') || label.includes('state')) {
            row1[col.key] = 'Tamil Nadu';
            row2[col.key] = 'Tamil Nadu';
            row3[col.key] = 'Karnataka';
        } else if (key.includes('address') || label.includes('address')) {
            row1[col.key] = '123 Industrial Area, Phase 1';
            row2[col.key] = '45 Commercial Complex, 2nd Main';
            row3[col.key] = '78 SIDCO Industrial Estate';
        } else if (col.type === 'number') {
            row1[col.key] = 100;
            row2[col.key] = 250;
            row3[col.key] = 500;
        } else {
            row1[col.key] = col.defaultValue || `Sample 1`;
            row2[col.key] = col.defaultValue || `Sample 2`;
            row3[col.key] = col.defaultValue || `Sample 3`;
        }
    });

    return [row1, row2, row3];
};

/**
 * Downloads a starter Excel template file (.xlsx) prefilled with sample demo rows.
 */
export const downloadExcelTemplate = (columns = [], entityName = 'Data', includeSampleRows = true) => {
    const activeCols = columns.filter(c => !c.readOnly && c.key !== 'permissions_access' && c.key !== 'permissions_action');
    const headers = activeCols.map(c => c.label || c.key);
    
    let aoa = [headers];
    if (includeSampleRows) {
        const sampleRows = generateDemoSampleRows(activeCols, entityName);
        const dataRows = sampleRows.map(row => activeCols.map(c => row[c.key] ?? ''));
        aoa = [headers, ...dataRows];
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = activeCols.map(c => {
        let width = 20;
        if (c.width) {
            const parsed = parseInt(c.width, 10);
            if (!isNaN(parsed)) width = Math.max(14, Math.round(parsed / 8));
        }
        return { wch: width };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${entityName} Template`);
    XLSX.writeFile(wb, `${entityName}_Demo_Template.xlsx`);
};

/**
 * Downloads a starter CSV template file (.csv) prefilled with sample demo rows.
 */
export const downloadCSVTemplate = (columns = [], entityName = 'Data', includeSampleRows = true) => {
    const activeCols = columns.filter(c => !c.readOnly && c.key !== 'permissions_access' && c.key !== 'permissions_action');
    const headers = activeCols.map(c => c.label || c.key);
    
    let dataRows = [];
    if (includeSampleRows) {
        const sampleRows = generateDemoSampleRows(activeCols, entityName);
        dataRows = sampleRows.map(row => activeCols.map(c => row[c.key] ?? ''));
    }

    const csvContent = Papa.unparse({
        fields: headers,
        data: dataRows
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityName}_Demo_Template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Exports current grid data to Microsoft Excel (.xlsx) file.
 */
export const exportToExcelFile = (gridData = [], columns = [], entityName = 'Data') => {
    const headers = columns.map(c => c.label || c.key);
    const dataRows = gridData.map(row =>
        columns.map(c => row[c.key] ?? '')
    );

    const aoa = [headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = columns.map(c => {
        let width = 20;
        if (c.width) {
            const parsed = parseInt(c.width, 10);
            if (!isNaN(parsed)) width = Math.max(12, Math.round(parsed / 8));
        }
        return { wch: width };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, entityName);
    XLSX.writeFile(wb, `${entityName}_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Exports current grid data to CSV (.csv) file via PapaParse.
 */
export const exportToCSVFile = (gridData = [], columns = [], entityName = 'Data') => {
    const headers = columns.map(c => c.label || c.key);
    const dataRows = gridData.map(row =>
        columns.map(c => row[c.key] ?? '')
    );

    const csvContent = Papa.unparse({
        fields: headers,
        data: dataRows
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityName}_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Converts raw parsed rows (from SheetJS / PapaParse) into typed entities matching columns.
 */
export const parseRawRowsToEntities = (rawRows = [], columns = [], primaryKey = 'id') => {
    if (!rawRows || rawRows.length === 0) return [];

    let headerRowIndex = -1;
    let colIndexMap = {};

    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        let matchedCols = 0;
        const tempMap = {};

        row.forEach((cell, cIdx) => {
            if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
                const matchedKey = matchColumnHeader(String(cell), columns);
                if (matchedKey && !tempMap[matchedKey]) {
                    tempMap[matchedKey] = cIdx;
                    matchedCols++;
                }
            }
        });

        if (matchedCols >= Math.min(2, columns.length)) {
            headerRowIndex = r;
            colIndexMap = tempMap;
            break;
        }
    }

    if (headerRowIndex === -1) {
        colIndexMap = {};
        columns.forEach((col, idx) => {
            colIndexMap[col.key] = idx;
        });
        headerRowIndex = -1;
    }

    const entities = [];
    const dataRows = headerRowIndex === -1 ? rawRows : rawRows.slice(headerRowIndex + 1);

    dataRows.forEach((row, idx) => {
        if (!Array.isArray(row)) return;
        const hasContent = row.some(c => c !== undefined && c !== null && String(c).trim() !== '');
        if (!hasContent) return;

        const entity = {
            [primaryKey]: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
            _status: 'new',
            _errors: {}
        };

        columns.forEach((col) => {
            const mappedIdx = colIndexMap[col.key];
            let val = mappedIdx !== undefined && row[mappedIdx] !== undefined ? row[mappedIdx] : col.defaultValue ?? '';
            if (val !== undefined && val !== null) {
                val = String(val).trim();
            } else {
                val = '';
            }

            if (col.type === 'number' && val !== '') {
                const num = Number(val);
                entity[col.key] = isNaN(num) ? val : num;
            } else {
                entity[col.key] = val;
            }

            if (col.required && (val === '' || val === null || val === undefined)) {
                entity._errors[col.key] = `${col.label || col.key} is required`;
            } else if (typeof col.validate === 'function') {
                const err = col.validate(val, entity);
                if (err) entity._errors[col.key] = err;
            }
        });

        entities.push(entity);
    });

    return entities;
};

/**
 * Returns normalized bounding box { minRow, maxRow, minCol, maxCol } from two selection points.
 */
export const getSelectionBounds = (anchor, focus) => {
    if (!anchor || !focus) return null;
    return {
        minRow: Math.min(anchor.r, focus.r),
        maxRow: Math.max(anchor.r, focus.r),
        minCol: Math.min(anchor.c, focus.c),
        maxCol: Math.max(anchor.c, focus.c)
    };
};

/**
 * Check if a cell coordinate (r, c) is inside selection bounds.
 */
export const isCellInBounds = (r, c, bounds) => {
    if (!bounds) return false;
    return r >= bounds.minRow && r <= bounds.maxRow && c >= bounds.minCol && c <= bounds.maxCol;
};

/**
 * Run field validation based on column definition.
 */
export const validateCell = (value, colDef, rowData) => {
    if (colDef.required && (value === null || value === undefined || String(value).trim() === '')) {
        return `${colDef.label || colDef.key} is required`;
    }

    if (value && colDef.validate && typeof colDef.validate === 'function') {
        const result = colDef.validate(value, rowData);
        if (typeof result === 'string') return result;
        if (result === false) return `Invalid ${colDef.label || colDef.key}`;
    }

    if (value && colDef.type === 'number' && isNaN(Number(value))) {
        return 'Must be a valid number';
    }

    return null;
};

/**
 * Validate an entire row object against columns schema.
 */
export const validateRow = (row, columns = []) => {
    const errors = {};
    columns.forEach(col => {
        const err = validateCell(row[col.key], col, row);
        if (err) errors[col.key] = err;
    });
    return errors;
};

/**
 * Calculate Auto-Fit width for a specific column based on content length.
 */
export const calculateAutoFitWidth = (colKey, colLabel, rows = []) => {
    let maxLen = (colLabel || colKey).length;
    rows.forEach(row => {
        const val = String(row[colKey] ?? '');
        if (val.length > maxLen) maxLen = val.length;
    });
    return `${Math.max(140, Math.min(520, maxLen * 8.5 + 36))}px`;
};

/**
 * Compare initial vs current rows and generate delta operations payload.
 */
export const generateBatchPayload = (currentRows, originalDataMap, primaryKey = 'id', deletedIdsSet = new Set(), columns = []) => {
    const created = [];
    const updated = [];
    const deleted = Array.from(deletedIdsSet).filter(id => !String(id).startsWith('temp_'));

    currentRows.forEach((row) => {
        const id = row[primaryKey];
        const isNew = !id || String(id).startsWith('temp_') || row._status === 'new';

        if (isNew) {
            const cleanRow = { ...row };
            delete cleanRow[primaryKey];
            delete cleanRow._status;
            delete cleanRow._errors;
            delete cleanRow._isNew;
            delete cleanRow._isModified;
            created.push(cleanRow);
        } else if (!deletedIdsSet.has(id)) {
            const original = originalDataMap.get(id);
            if (original) {
                const hasChanges = columns.length > 0
                    ? columns.some(col => String(row[col.key] ?? '').trim() !== String(original[col.key] ?? '').trim())
                    : Object.keys(row).some(key => !key.startsWith('_') && String(row[key] ?? '') !== String(original[key] ?? ''));

                if (hasChanges || row._status === 'modified') {
                    const cleanRow = { ...row };
                    delete cleanRow._status;
                    delete cleanRow._errors;
                    delete cleanRow._isNew;
                    delete cleanRow._isModified;
                    updated.push(cleanRow);
                }
            }
        }
    });

    return { created, updated, deleted, allRows: currentRows };
};
