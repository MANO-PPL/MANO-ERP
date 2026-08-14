import { useState, useCallback, useMemo, useEffect } from 'react';
import { parseTSV, stringifyTSV, getSelectionBounds, validateCell, generateBatchPayload } from './gridUtils';

export const useGridState = ({ config, initialData = [] }) => {
    const { primaryKey = 'id', columns = [] } = config;

    // Track original data map for diff calculation
    const originalRowsMap = useMemo(() => {
        const map = new Map();
        initialData.forEach((row) => {
            if (row && row[primaryKey] !== undefined) {
                map.set(row[primaryKey], JSON.parse(JSON.stringify(row)));
            }
        });
        return map;
    }, [initialData, primaryKey]);

    const [rows, setRows] = useState([]);
    const [deletedRowIds, setDeletedRowIds] = useState(new Set());
    const [selectedCell, setSelectedCell] = useState(null);
    const [selectionEndCell, setSelectionEndCell] = useState(null);
    const [editingCell, setEditingCell] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Undo / Redo history
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);

    // Initialize rows when initialData changes
    useEffect(() => {
        const cloned = initialData.map((row) => ({
            ...row,
            _isNew: false,
            _isModified: false,
            _errors: {}
        }));
        setRows(cloned);
        setDeletedRowIds(new Set());
        setHistory([]);
        setFuture([]);
        setSelectedCell(null);
        setSelectionEndCell(null);
        setEditingCell(null);
    }, [initialData]);

    // Push snapshot to undo history before making mutations
    const pushHistory = useCallback((currentRows, currentDeleted) => {
        setHistory((prev) => [
            ...prev,
            {
                rows: JSON.parse(JSON.stringify(currentRows)),
                deletedRowIds: new Set(currentDeleted)
            }
        ]);
        setFuture([]); // Clear redo stack on new operation
    }, []);

    // Filter rows based on search term if present
    const filteredRowIndices = useMemo(() => {
        if (!searchTerm.trim()) return rows.map((_, idx) => idx);
        const lower = searchTerm.toLowerCase();
        return rows
            .map((row, idx) => {
                const match = columns.some((col) => {
                    const val = row[col.key];
                    return val !== undefined && val !== null && String(val).toLowerCase().includes(lower);
                });
                return match ? idx : null;
            })
            .filter((idx) => idx !== null);
    }, [rows, columns, searchTerm]);

    // Calculate bounding box of selection
    const selectionBounds = useMemo(() => {
        return getSelectionBounds(selectedCell, selectionEndCell);
    }, [selectedCell, selectionEndCell]);

    // Validate a single row and return errors object
    const validateRow = useCallback(
        (row) => {
            const errors = {};
            columns.forEach((col) => {
                const err = validateCell(row[col.key], col, row);
                if (err) {
                    errors[col.key] = err;
                }
            });
            return errors;
        },
        [columns]
    );

    // Update single cell value
    const updateCell = useCallback(
        (rowIndex, key, value) => {
            setRows((prevRows) => {
                const newRows = [...prevRows];
                const targetRow = { ...newRows[rowIndex] };
                targetRow[key] = value;

                // Mark modified status & re-validate
                const original = originalRowsMap.get(targetRow[primaryKey]);
                targetRow._isModified = original ? String(original[key] ?? '') !== String(value ?? '') : false;
                targetRow._errors = validateRow(targetRow);

                newRows[rowIndex] = targetRow;
                pushHistory(prevRows, deletedRowIds);
                return newRows;
            });
        },
        [originalRowsMap, primaryKey, validateRow, pushHistory, deletedRowIds]
    );

    // Paste matrix starting from selected cell
    const pasteMatrix = useCallback(
        (matrix) => {
            if (!selectedCell || !matrix || matrix.length === 0) return;
            const startRow = selectedCell.rowIndex;
            const startCol = selectedCell.colIndex;

            setRows((prevRows) => {
                pushHistory(prevRows, deletedRowIds);
                const newRows = [...prevRows];

                matrix.forEach((matrixRow, rOffset) => {
                    const targetRowIndex = startRow + rOffset;

                    // If row doesn't exist yet, create a new draft row
                    if (targetRowIndex >= newRows.length) {
                        const newId = `temp_${Date.now()}_${targetRowIndex}`;
                        const freshRow = {
                            [primaryKey]: newId,
                            _isNew: true,
                            _isModified: false,
                            _errors: {}
                        };
                        columns.forEach((col) => {
                            freshRow[col.key] = col.defaultValue ?? '';
                        });
                        newRows.push(freshRow);
                    }

                    const targetRow = { ...newRows[targetRowIndex] };

                    matrixRow.forEach((cellValue, cOffset) => {
                        const targetColIndex = startCol + cOffset;
                        if (targetColIndex < columns.length) {
                            const colDef = columns[targetColIndex];
                            if (colDef && !colDef.readOnly) {
                                targetRow[colDef.key] = cellValue;
                            }
                        }
                    });

                    // Re-validate and mark modified
                    targetRow._errors = validateRow(targetRow);
                    const original = originalRowsMap.get(targetRow[primaryKey]);
                    if (!targetRow._isNew && original) {
                        targetRow._isModified = true;
                    }

                    newRows[targetRowIndex] = targetRow;
                });

                return newRows;
            });
        },
        [selectedCell, columns, primaryKey, originalRowsMap, validateRow, pushHistory, deletedRowIds]
    );

    // Add new draft row at bottom
    const addRow = useCallback(
        (customDefaults = {}) => {
            setRows((prevRows) => {
                pushHistory(prevRows, deletedRowIds);
                const tempId = `temp_${Date.now()}_${prevRows.length}`;
                const freshRow = {
                    [primaryKey]: tempId,
                    _isNew: true,
                    _isModified: false,
                    _errors: {},
                    ...customDefaults
                };
                columns.forEach((col) => {
                    if (freshRow[col.key] === undefined) {
                        freshRow[col.key] = col.defaultValue ?? '';
                    }
                });
                freshRow._errors = validateRow(freshRow);
                return [...prevRows, freshRow];
            });

            // Focus on first editable column of newly added row
            const newIndex = rows.length;
            const firstEditableCol = columns.findIndex((c) => !c.readOnly);
            setSelectedCell({ rowIndex: newIndex, colIndex: firstEditableCol >= 0 ? firstEditableCol : 0 });
            setEditingCell({ rowIndex: newIndex, colIndex: firstEditableCol >= 0 ? firstEditableCol : 0 });
        },
        [rows.length, primaryKey, columns, validateRow, pushHistory, deletedRowIds]
    );

    // Duplicate selected row(s)
    const duplicateSelectedRows = useCallback(() => {
        if (!selectionBounds) return;
        const { minRow, maxRow } = selectionBounds;

        setRows((prevRows) => {
            pushHistory(prevRows, deletedRowIds);
            const newRows = [...prevRows];
            const rowsToDuplicate = prevRows.slice(minRow, maxRow + 1);

            const duplicatedClones = rowsToDuplicate.map((row, idx) => {
                const tempId = `temp_dup_${Date.now()}_${idx}`;
                const clone = {
                    ...row,
                    [primaryKey]: tempId,
                    _isNew: true,
                    _isModified: false
                };
                // Make name/company unique if applicable
                if (clone.name) clone.name = `${clone.name} (Copy)`;
                if (clone.company) clone.company = `${clone.company} (Copy)`;
                if (clone.company_name) clone.company_name = `${clone.company_name} (Copy)`;

                clone._errors = validateRow(clone);
                return clone;
            });

            newRows.splice(maxRow + 1, 0, ...duplicatedClones);
            return newRows;
        });
    }, [selectionBounds, primaryKey, validateRow, pushHistory, deletedRowIds]);

    // Delete selected row(s)
    const deleteSelectedRows = useCallback(() => {
        if (!selectionBounds) return;
        const { minRow, maxRow } = selectionBounds;

        setRows((prevRows) => {
            pushHistory(prevRows, deletedRowIds);
            const targetIds = new Set(deletedRowIds);
            const newRows = [...prevRows];

            for (let r = minRow; r <= maxRow; r++) {
                const row = newRows[r];
                if (row) {
                    const id = row[primaryKey];
                    if (String(id).startsWith('temp_')) {
                        // Draft rows removed immediately
                        newRows[r] = null;
                    } else {
                        // Persistent rows flagged as pending deletion
                        targetIds.add(id);
                    }
                }
            }

            setDeletedRowIds(targetIds);
            return newRows.filter(Boolean);
        });
    }, [selectionBounds, primaryKey, deletedRowIds, pushHistory]);

    // Clear contents of selected cells
    const clearSelectedCells = useCallback(() => {
        if (!selectionBounds) return;
        const { minRow, maxRow, minCol, maxCol } = selectionBounds;

        setRows((prevRows) => {
            pushHistory(prevRows, deletedRowIds);
            const newRows = [...prevRows];

            for (let r = minRow; r <= maxRow; r++) {
                const row = { ...newRows[r] };
                for (let c = minCol; c <= maxCol; c++) {
                    const col = columns[c];
                    if (col && !col.readOnly) {
                        row[col.key] = '';
                    }
                }
                row._errors = validateRow(row);
                newRows[r] = row;
            }

            return newRows;
        });
    }, [selectionBounds, columns, validateRow, pushHistory, deletedRowIds]);

    // Undo action
    const undo = useCallback(() => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];

        setFuture((prev) => [
            ...prev,
            {
                rows: JSON.parse(JSON.stringify(rows)),
                deletedRowIds: new Set(deletedRowIds)
            }
        ]);

        setRows(previousState.rows);
        setDeletedRowIds(previousState.deletedRowIds);
        setHistory((prev) => prev.slice(0, prev.length - 1));
    }, [history, rows, deletedRowIds]);

    // Redo action
    const redo = useCallback(() => {
        if (future.length === 0) return;
        const nextState = future[future.length - 1];

        setHistory((prev) => [
            ...prev,
            {
                rows: JSON.parse(JSON.stringify(rows)),
                deletedRowIds: new Set(deletedRowIds)
            }
        ]);

        setRows(nextState.rows);
        setDeletedRowIds(nextState.deletedRowIds);
        setFuture((prev) => prev.slice(0, prev.length - 1));
    }, [future, rows, deletedRowIds]);

    // Generate payload to submit to backend
    const getBatchPayload = useCallback(() => {
        return generateBatchPayload(rows, originalRowsMap, primaryKey, deletedRowIds);
    }, [rows, originalRowsMap, primaryKey, deletedRowIds]);

    // Count of dirty operations
    const dirtyCounts = useMemo(() => {
        const payload = getBatchPayload();
        return {
            created: payload.created.length,
            updated: payload.updated.length,
            deleted: payload.deleted.length,
            total: payload.created.length + payload.updated.length + payload.deleted.length
        };
    }, [getBatchPayload]);

    return {
        rows,
        originalRowsMap,
        columns,
        primaryKey,

        deletedRowIds,
        selectedCell,
        setSelectedCell,
        selectionEndCell,
        setSelectionEndCell,
        selectionBounds,
        editingCell,
        setEditingCell,
        searchTerm,
        setSearchTerm,
        filteredRowIndices,
        updateCell,
        pasteMatrix,
        addRow,
        duplicateSelectedRows,
        deleteSelectedRows,
        clearSelectedCells,
        undo,
        redo,
        canUndo: history.length > 0,
        canRedo: future.length > 0,
        dirtyCounts,
        getBatchPayload
    };
};
