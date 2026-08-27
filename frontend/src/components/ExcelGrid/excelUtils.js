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
 * Downloads a starter Excel template file (.xlsx) configured from the column schema.
 */
export const downloadExcelTemplate = (columns = [], entityName = 'Data') => {
    const headers = columns.map(c => c.label || c.key);
    const ws = XLSX.utils.aoa_to_sheet([headers]);

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
    XLSX.writeFile(wb, `${entityName}_Template.xlsx`);
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
