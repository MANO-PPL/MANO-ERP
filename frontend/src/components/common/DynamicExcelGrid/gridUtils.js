/**
 * Utility functions for DynamicExcelGrid
 */

/**
 * Parse a TSV string (from clipboard paste) into a 2D array matrix.
 * Handles both Windows (\r\n) and Unix (\n) line breaks.
 */
export const parseTSV = (tsvText) => {
    if (!tsvText) return [];
    // Clean up trailing newline
    const cleanText = tsvText.replace(/[\r\n]+$/, '');
    const lines = cleanText.split(/\r\n|\n|\r/);
    return lines.map((line) => line.split('\t').map((val) => val.trim()));
};

/**
 * Convert a 2D matrix array into a TSV string for clipboard copy.
 */
export const stringifyTSV = (matrix) => {
    if (!matrix || matrix.length === 0) return '';
    return matrix.map((row) => row.map((val) => (val === null || val === undefined ? '' : String(val))).join('\t')).join('\n');
};

/**
 * Calculate rectangle bounding box from selection coordinates
 */
export const getSelectionBounds = (startCell, endCell) => {
    if (!startCell) return null;
    const end = endCell || startCell;
    return {
        minRow: Math.min(startCell.rowIndex, end.rowIndex),
        maxRow: Math.max(startCell.rowIndex, end.rowIndex),
        minCol: Math.min(startCell.colIndex, end.colIndex),
        maxCol: Math.max(startCell.colIndex, end.colIndex)
    };
};

/**
 * Check if a specific cell coordinate is within current selection bounds
 */
export const isCellInBounds = (rowIndex, colIndex, bounds) => {
    if (!bounds) return false;
    return (
        rowIndex >= bounds.minRow &&
        rowIndex <= bounds.maxRow &&
        colIndex >= bounds.minCol &&
        colIndex <= bounds.maxCol
    );
};

/**
 * Run field validation based on column definition
 */
export const validateCell = (value, columnDef, rowData) => {
    if (columnDef.required && (value === null || value === undefined || String(value).trim() === '')) {
        return `${columnDef.label || columnDef.key} is required`;
    }

    if (value && columnDef.validate && typeof columnDef.validate === 'function') {
        const result = columnDef.validate(value, rowData);
        if (result && typeof result === 'string') {
            return result;
        }
        if (result === false) {
            return `Invalid ${columnDef.label || columnDef.key}`;
        }
    }

    if (value && columnDef.type === 'number' && isNaN(Number(value))) {
        return `Must be a valid number`;
    }

    return null;
};

/**
 * Compare initial vs current rows and extract delta operations payload
 */
export const generateBatchPayload = (currentRows, originalRowsMap, primaryKey = 'id', deletedIdsSet = new Set()) => {
    const created = [];
    const updated = [];
    const deleted = Array.from(deletedIdsSet).filter((id) => !String(id).startsWith('temp_'));

    currentRows.forEach((row) => {
        const id = row[primaryKey];
        const isNew = !id || String(id).startsWith('temp_');

        if (isNew) {
            // Remove temporary draft properties before sending to backend
            const cleanRow = { ...row };
            delete cleanRow[primaryKey];
            delete cleanRow._isNew;
            delete cleanRow._isModified;
            delete cleanRow._errors;
            created.push(cleanRow);
        } else if (!deletedIdsSet.has(id)) {
            const original = originalRowsMap.get(id);
            if (original) {
                // Check if any field actually changed
                const hasChanges = Object.keys(row).some((key) => {
                    if (key.startsWith('_')) return false;
                    return String(row[key] ?? '') !== String(original[key] ?? '');
                });

                if (hasChanges) {
                    const cleanRow = { ...row };
                    delete cleanRow._isNew;
                    delete cleanRow._isModified;
                    delete cleanRow._errors;
                    updated.push(cleanRow);
                }
            }
        }
    });

    return { created, updated, deleted };
};
