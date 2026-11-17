import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { evaluateFormula } from '../../utils/excelFormulaEngine';
import { exportProfessionalExcel, exportProfessionalCSV, downloadProfessionalTemplate } from '../../utils/excelExportEngine';

/**
 * Strips HTML, SVG, markdown images, and data URLs so clipboard content is pure text only.
 */
export const cleanClipboardText = (val) => {
    if (val === undefined || val === null) return '';
    let str = String(val);
    if (str === '[object Object]') return '';
    // Strip SVG tags and contents
    if (str.includes('<svg') || str.includes('</svg>')) {
        str = str.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    }
    // Strip picture tags
    if (str.includes('<picture') || str.includes('</picture>')) {
        str = str.replace(/<picture[\s\S]*?<\/picture>/gi, '');
    }
    // Strip canvas tags
    if (str.includes('<canvas') || str.includes('</canvas>')) {
        str = str.replace(/<canvas[\s\S]*?<\/canvas>/gi, '');
    }
    // Strip IMG tags
    if (str.includes('<img') || str.includes('/>')) {
        str = str.replace(/<img[\s\S]*?>/gi, '');
    }
    // Strip general HTML tags
    if (str.includes('<') && str.includes('>')) {
        str = str.replace(/<[^>]+>/g, '');
    }
    // Remove markdown image syntax ![alt](url)
    str = str.replace(/!\[.*?\]\(.*?\)/g, '');
    // Remove data URLs for base64 images
    str = str.replace(/data:image\/[^;]+;base64,[^\s"']+/gi, '');
    // Remove blob image URLs
    str = str.replace(/blob:https?:\/\/[^\s"']+/gi, '');
    return str.trim();
};

/**
 * Parse a TSV string (from clipboard paste) into a 2D array matrix.
 * Handles quoted cells with embedded newlines/tabs and both Windows and Unix line breaks.
 * Guarantees pure text extraction (no images or HTML).
 */
export const parseTSV = (tsvText) => {
    if (!tsvText || typeof tsvText !== 'string') return [];
    const cleanText = tsvText.replace(/\r\n$/, '').replace(/\n$/, '').replace(/\r$/, '');
    if (!cleanText) return [];

    // Spreadsheet clipboard data uses tab (\t) for column separation.
    // Commas within a cell (e.g. addresses, numbers with commas, lists) must NEVER split the cell.
    const delimiter = '\t';

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
            currentRow.push(cleanClipboardText(currentCell));
            currentCell = '';
        } else if (!insideQuotes && (char === '\n' || (char === '\r' && nextChar === '\n'))) {
            if (char === '\r') i++;
            currentRow.push(cleanClipboardText(currentCell));
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else if (!insideQuotes && char === '\r') {
            currentRow.push(cleanClipboardText(currentCell));
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    currentRow.push(cleanClipboardText(currentCell));
    rows.push(currentRow);

    return rows.filter(r => r.length > 0 && r.some(c => c !== ''));
};

/**
 * Convert a 2D matrix array into a TSV string for clipboard copy.
 * Guarantees pure text output (never objects, images, or SVGs).
 */
export const stringifyTSV = (matrix) => {
    if (!matrix || matrix.length === 0) return '';
    return matrix.map((row) =>
        row.map((val) => {
            if (val === null || val === undefined) return '';
            let strVal = typeof val === 'object'
                ? (val.value !== undefined ? String(val.value) : (val.code !== undefined ? String(val.code) : (val.name || '')))
                : String(val);
            strVal = cleanClipboardText(strVal);
            if (strVal.includes('\t') || strVal.includes('\n') || strVal.includes('"')) {
                return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
        }).join('\t')
    ).join('\n');
};

/**
 * Smart resolver for dropdown (select / searchable-select) cells.
 * Matches pasted text against column options by:
 * 1. Exact value match
 * 2. Case-insensitive value match
 * 3. Exact/case-insensitive label, name, or code match
 * 4. Parentheses extraction: "Kilogram (kg)" -> "kg", or "kg" -> matches option "Kilogram (kg)"
 * 5. Prefix match
 */
export const resolveDropdownValue = (rawVal, column) => {
    if (rawVal === undefined || rawVal === null) return '';
    const strVal = String(rawVal).trim();
    if (strVal === '') return '';

    const options = column?.options || column?.dropdownOptions;
    if (!options || !Array.isArray(options) || options.length === 0) {
        return strVal;
    }

    const cleanStr = strVal.toLowerCase();

    // 1. Exact value match
    for (const opt of options) {
        if (typeof opt === 'object' && opt !== null) {
            const optVal = opt.value !== undefined ? opt.value : (opt.code !== undefined ? opt.code : opt.id);
            if (String(optVal) === strVal) return optVal;
        } else if (String(opt) === strVal) {
            return opt;
        }
    }

    // 2. Case-insensitive value match
    for (const opt of options) {
        if (typeof opt === 'object' && opt !== null) {
            const optVal = opt.value !== undefined ? opt.value : (opt.code !== undefined ? opt.code : opt.id);
            if (String(optVal).toLowerCase() === cleanStr) return optVal;
        } else if (String(opt).toLowerCase() === cleanStr) {
            return opt;
        }
    }

    // 3. Exact or case-insensitive label / name / code match
    for (const opt of options) {
        if (typeof opt === 'object' && opt !== null) {
            const optVal = opt.value !== undefined ? opt.value : (opt.code !== undefined ? opt.code : opt.id);
            const optLabel = opt.label !== undefined ? String(opt.label).trim() : '';
            const optName = opt.name !== undefined ? String(opt.name).trim() : '';
            const optCode = opt.code !== undefined ? String(opt.code).trim() : '';

            if (
                optLabel.toLowerCase() === cleanStr ||
                optName.toLowerCase() === cleanStr ||
                optCode.toLowerCase() === cleanStr
            ) {
                return optVal;
            }
        }
    }

    // 4. Parentheses matching (e.g. "Kilogram (kg)" -> matches "kg", or "kg" -> matches "Kilogram (kg)")
    const parenMatch = strVal.match(/\(([^)]+)\)/);
    const textBeforeParen = strVal.replace(/\s*\([^)]*\).*/, '').trim().toLowerCase();
    const textInsideParen = parenMatch ? parenMatch[1].trim().toLowerCase() : '';

    for (const opt of options) {
        if (typeof opt === 'object' && opt !== null) {
            const optVal = opt.value !== undefined ? opt.value : (opt.code !== undefined ? opt.code : opt.id);
            const optLabel = opt.label !== undefined ? String(opt.label).trim() : '';
            const optName = opt.name !== undefined ? String(opt.name).trim() : '';
            const optCode = opt.code !== undefined ? String(opt.code).trim() : '';

            const optValLower = String(optVal).toLowerCase();
            const optCodeLower = optCode.toLowerCase();
            const optNameLower = optName.toLowerCase();
            const optLabelLower = optLabel.toLowerCase();

            if (textInsideParen && (optValLower === textInsideParen || optCodeLower === textInsideParen)) {
                return optVal;
            }
            if (textBeforeParen && (optNameLower === textBeforeParen || optLabelLower === textBeforeParen)) {
                return optVal;
            }

            const optParen = optLabel.match(/\(([^)]+)\)/);
            if (optParen) {
                const optInside = optParen[1].trim().toLowerCase();
                const optBefore = optLabel.replace(/\s*\([^)]*\).*/, '').trim().toLowerCase();
                if (cleanStr === optInside || cleanStr === optBefore) {
                    return optVal;
                }
            }
        } else {
            const optStr = String(opt).trim().toLowerCase();
            if (textBeforeParen && optStr === textBeforeParen) return opt;
            if (textInsideParen && optStr === textInsideParen) return opt;
        }
    }

    // 5. Prefix match
    for (const opt of options) {
        if (typeof opt === 'object' && opt !== null) {
            const optVal = opt.value !== undefined ? opt.value : (opt.code !== undefined ? opt.code : opt.id);
            const optLabel = opt.label !== undefined ? String(opt.label).toLowerCase() : '';
            const optName = opt.name !== undefined ? String(opt.name).toLowerCase() : '';
            if (optLabel.startsWith(cleanStr) || optName.startsWith(cleanStr)) {
                return optVal;
            }
        } else {
            const optStr = String(opt).toLowerCase();
            if (optStr.startsWith(cleanStr)) {
                return opt;
            }
        }
    }

    return strVal;
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
export const downloadExcelTemplate = async (columns = [], entityName = 'Data', includeSampleRows = true) => {
    const activeCols = columns.filter(c => !c.readOnly && c.key !== 'permissions_access' && c.key !== 'permissions_action');
    const sampleRows = includeSampleRows ? generateDemoSampleRows(activeCols, entityName) : [];
    return downloadProfessionalTemplate({
        columns: activeCols,
        entityName,
        sampleRows
    });
};

/**
 * Downloads a starter CSV template file (.csv) prefilled with sample demo rows.
 */
export const downloadCSVTemplate = (columns = [], entityName = 'Data', includeSampleRows = true) => {
    const activeCols = columns.filter(c => !c.readOnly && c.key !== 'permissions_access' && c.key !== 'permissions_action');
    let dataRows = [];
    if (includeSampleRows) {
        const sampleRows = generateDemoSampleRows(activeCols, entityName);
        dataRows = sampleRows.map(row => activeCols.map(c => row[c.key] ?? ''));
    }

    const headers = activeCols.map(c => c.label || c.key);
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
 * Exports current grid data to Microsoft Excel (.xlsx) file with real formula support,
 * executive theme styling, and auto-adjusted column widths.
 */
export const exportToExcelFile = async (gridData = [], columns = [], entityName = 'Data') => {
    return exportProfessionalExcel({
        data: gridData,
        columns,
        entityName
    });
};

/**
 * Exports current grid data to CSV (.csv) file via PapaParse with evaluated formula results.
 */
export const exportToCSVFile = (gridData = [], columns = [], entityName = 'Data') => {
    return exportProfessionalCSV({
        data: gridData,
        columns,
        entityName
    });
};

/**
 * Converts raw parsed rows (from SheetJS / PapaParse) into typed entities matching columns.
 */
export const parseRawRowsToEntities = (rawRows = [], columns = [], primaryKey = 'id') => {
    if (!rawRows || rawRows.length === 0) return [];

    let bestHeaderRowIndex = -1;
    let bestColIndexMap = {};
    let maxMatchedCols = 0;

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

        if (matchedCols > maxMatchedCols) {
            maxMatchedCols = matchedCols;
            bestHeaderRowIndex = r;
            bestColIndexMap = tempMap;
        }
    }

    let headerRowIndex = maxMatchedCols > 0 ? bestHeaderRowIndex : -1;
    let colIndexMap = maxMatchedCols > 0 ? bestColIndexMap : {};

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

            if (col.key === 'type' && val) {
                const lower = val.toLowerCase();
                if (lower === 'material' || lower === 'materials') val = 'material';
                else if (lower === 'item' || lower === 'items') val = 'item';
                else if (lower === 'labour' || lower === 'labor' || lower === 'labours') val = 'labour';
            }

            if (col.type === 'number' && val !== '') {
                const cleanStr = String(val).replace(/[₹$€£,\s]/g, '');
                const num = Number(cleanStr);
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

    if (value !== undefined && value !== null && value !== '') {
        const strVal = String(value).trim();
        if (strVal.startsWith('=')) {
            const evalRes = evaluateFormula(strVal, rowData);
            if (!evalRes.success) {
                return evalRes.error || 'Formula syntax error';
            }
            if (colDef.type === 'number' && isNaN(Number(evalRes.result))) {
                return 'Formula must evaluate to a valid number';
            }
            return null;
        }

        if (colDef.type === 'number' && isNaN(Number(value))) {
            return 'Must be a valid number';
        }
    }

    return null;
};

/**
 * Validate an entire row object against columns schema.
 */
export const validateRow = (row, columns = [], allRows = []) => {
    const errors = {};
    columns.forEach(col => {
        const err = validateCell(row[col.key], col, row);
        if (err) errors[col.key] = err;
    });

    if (Array.isArray(allRows) && allRows.length > 0 && row) {
        columns.forEach(col => {
            const k = (col.key || col.accessor || '').toLowerCase();
            const isCode = k === 'code' || k === 'item_code' || k === 'resource_code';
            const isUnique = col.unique === true || col.isUnique === true || isCode;
            if (isUnique) {
                const colKey = col.key || col.accessor;
                const val = row[colKey];
                const normVal = String(val || '').trim().toLowerCase();
                if (normVal) {
                    const rowId = row.id;
                    const hasDup = allRows.some(r =>
                        r !== row &&
                        (rowId == null || String(r.id) !== String(rowId)) &&
                        String(r[colKey] || '').trim().toLowerCase() === normVal
                    );
                    if (hasDup) {
                        errors[colKey] = isCode
                            ? `Resource code already exists: "${val}". Resource code must be strictly unique. Please change it.`
                            : `${col.label || colKey} already exists: "${val}". Must be unique.`;
                    }
                }
            }
        });
    }

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
    const presentIds = new Set((currentRows || []).map((r) => String(r[primaryKey])));
    const deleted = Array.from(deletedIdsSet).filter(
        (id) => !String(id).startsWith('temp_') && !presentIds.has(String(id))
    );

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

/**
 * Determine the identifying column that should remain unique across sheet rows.
 */
export const getUniqueKeyColumn = (columns = []) => {
    if (!columns || columns.length === 0) return 'name';
    const explicitlyUnique = columns.find((c) => c.unique === true);
    if (explicitlyUnique) return explicitlyUnique.key || explicitlyUnique.accessor;

    const commonKeys = ['name', 'item_name', 'company_name', 'party_name', 'title', 'code', 'category_name'];
    for (const key of commonKeys) {
        const found = columns.find((c) => c.key === key || c.accessor === key);
        if (found) return found.key || found.accessor;
    }

    const firstTextCol = columns.find(
        (c) =>
            !c.readOnly &&
            c.key !== 'id' &&
            c.key !== 'created_at' &&
            c.key !== 'updated_at' &&
            c.type !== 'number' &&
            c.type !== 'checkbox' &&
            c.type !== 'date'
    );
    return firstTextCol?.key || 'name';
};

/**
 * Extract normalized unique string value from a row object.
 */
export const getRowUniqueValue = (row, keyCol) => {
    if (!row || !keyCol) return '';
    const val = row[keyCol];
    if (val === null || val === undefined) return '';
    return String(val).trim().toLowerCase();
};

/**
 * Detect all duplicate groups in rows data based on identifying column.
 */
export const findDuplicateGroups = (rows = [], keyCol = 'name', primaryKey = 'id') => {
    if (!rows || rows.length === 0 || !keyCol) return [];

    const groupsMap = new Map();
    rows.forEach((row) => {
        const rawVal = row[keyCol];
        if (rawVal === null || rawVal === undefined) return;
        const normKey = String(rawVal).trim().toLowerCase();
        if (!normKey) return; // Blank rows do not count as duplicates of each other

        if (!groupsMap.has(normKey)) {
            groupsMap.set(normKey, []);
        }
        groupsMap.get(normKey).push(row);
    });

    const duplicateGroups = [];
    groupsMap.forEach((matchedRows, normKey) => {
        if (matchedRows.length > 1) {
            duplicateGroups.push({
                key: normKey,
                label: matchedRows[0][keyCol] || normKey,
                original: matchedRows[0],
                duplicates: matchedRows.slice(1),
                allRows: matchedRows
            });
        }
    });

    return duplicateGroups;
};

/**
 * Detect all duplicate groups across all unique/identifying columns (e.g., name, code).
 */
export const findAllDuplicateGroups = (rows = [], columns = [], primaryKey = 'id') => {
    if (!rows || rows.length === 0) return [];
    const uniqueCols = [];
    const primaryCol = getUniqueKeyColumn(columns);
    if (primaryCol) uniqueCols.push(primaryCol);

    (columns || []).forEach((col) => {
        const k = col.key || col.accessor;
        if (!k) return;
        const lowerK = k.toLowerCase();
        if (
            (col.unique === true || col.isUnique === true || lowerK === 'code' || lowerK === 'item_code' || lowerK === 'resource_code') &&
            !uniqueCols.includes(k)
        ) {
            uniqueCols.push(k);
        }
    });

    const allGroups = [];
    const seenGroupKeys = new Set();

    uniqueCols.forEach((colKey) => {
        const groups = findDuplicateGroups(rows, colKey, primaryKey);
        groups.forEach((g) => {
            const compositeKey = `${colKey}::${g.key}`;
            if (!seenGroupKeys.has(compositeKey)) {
                seenGroupKeys.add(compositeKey);
                allGroups.push({ ...g, columnKey: colKey });
            }
        });
    });

    return allGroups;
};

/**
 * Consolidate duplicate rows into a single Master record.
 * Fills any blank fields in masterRow from duplicateRows, and returns merged row + duplicate row IDs.
 */
export const mergeDuplicateGroup = (masterRow, duplicateRows = [], columns = [], primaryKey = 'id') => {
    const merged = { ...masterRow };
    const duplicateRowIds = [];

    duplicateRows.forEach((dup) => {
        const dupId = dup[primaryKey];
        if (dupId !== undefined && dupId !== null) {
            duplicateRowIds.push(dupId);
        }

        // Fill empty / missing columns from duplicate row
        columns.forEach((col) => {
            const key = col.key;
            if (key === primaryKey || key.startsWith('_')) return;

            const masterVal = merged[key];
            const dupVal = dup[key];

            const isMasterEmpty = masterVal === null || masterVal === undefined || String(masterVal).trim() === '';
            const isDupValid = dupVal !== null && dupVal !== undefined && String(dupVal).trim() !== '';

            if (isMasterEmpty && isDupValid) {
                merged[key] = dupVal;
            }
        });

        // Merge remarks / notes if both contain unique text
        if (dup.remarks && merged.remarks && !merged.remarks.includes(dup.remarks)) {
            merged.remarks = `${merged.remarks}; ${dup.remarks}`;
        } else if (dup.remarks && !merged.remarks) {
            merged.remarks = dup.remarks;
        }

        if (dup.description && !merged.description) {
            merged.description = dup.description;
        }
    });

    // Mark merged record as modified unless it's a new row
    if (merged._status !== 'new') {
        merged._status = 'modified';
    }
    merged._errors = {};

    return {
        mergedMasterRow: merged,
        duplicateRowIds
    };
};

