import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    parseTSV,
    stringifyTSV,
    getSelectionBounds,
    isCellInBounds,
    validateRow,
    calculateAutoFitWidth,
    generateBatchPayload,
    transformCase
} from './excelUtils';

export const useExcelGrid = ({
    data = [],
    columns = [],
    primaryKey = 'id',
    canWrite = true,
    initialPageSize = 100,
    showToast = null
}) => {
    // 1. Original database data map for dirty comparison
    const originalDataMap = useMemo(() => {
        const map = new Map();
        (data || []).forEach((row) => {
            if (row && row[primaryKey] !== undefined) {
                map.set(row[primaryKey], JSON.parse(JSON.stringify(row)));
            }
        });
        return map;
    }, [data, primaryKey]);

    // 2. Main Grid Data State
    const [gridData, setGridData] = useState(() =>
        (data || []).map((row) => ({
            ...row,
            _status: 'saved',
            _errors: {}
        }))
    );
    const gridDataRef = useRef(gridData);
    gridDataRef.current = gridData;
    const isSavingRef = useRef(false);

    // Synchronize whenever prop data changes
    useEffect(() => {
        setGridData((prevGrid) => {
            if (isSavingRef.current) {
                // When a save completes, data from server is authoritative.
                // Reset to saved rows and clear any lingering temporary rows.
                isSavingRef.current = false;
                deletedIdsRef.current = new Set();
                setDeletedIds(new Set());
                return (data || []).map((item) => ({
                    ...item,
                    _status: 'saved',
                    _errors: {}
                }));
            }

            const existingNames = new Set(
                (data || []).map((d) => (d.name ? String(d.name).trim().toLowerCase() : null)).filter(Boolean)
            );

            const newUnsaved = prevGrid.filter((r) => {
                const isTemp = String(r[primaryKey]).startsWith('temp_');
                if (!isTemp && r._status !== 'new') return false;

                // Do not resurrect completely empty temp rows
                const hasAnyContent = Object.entries(r).some(
                    ([k, v]) => !k.startsWith('_') && k !== primaryKey && v != null && String(v).trim() !== ''
                );
                if (!hasAnyContent) return false;

                // Do not keep as new if already represented in incoming server data
                if (r.name && existingNames.has(String(r.name).trim().toLowerCase())) {
                    return false;
                }

                return true;
            });

            const modifiedMap = new Map(
                prevGrid
                    .filter((r) => r._status === 'modified' || r._status === 'error')
                    .map((r) => [r[primaryKey], r])
            );
            const curDeletedIds = deletedIdsRef.current;

            const updatedGrid = (data || [])
                .filter((item) => !curDeletedIds.has(item[primaryKey]))
                .map((item) => {
                    if (modifiedMap.has(item[primaryKey])) {
                        return modifiedMap.get(item[primaryKey]);
                    }
                    return {
                        ...item,
                        _status: 'saved',
                        _errors: {}
                    };
                });

            return [...updatedGrid, ...newUnsaved];
        });
    }, [data, primaryKey]);

    // 3. Deleted IDs Tracking
    const [deletedIds, setDeletedIds] = useState(new Set());
    const deletedIdsRef = useRef(deletedIds);
    deletedIdsRef.current = deletedIds;

    // 4. Undo / Redo Stacks
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const cellEditInitialStateRef = useRef(null);

    const pushUndoState = useCallback((currentGrid) => {
        if (!currentGrid) return;
        const snapshot = currentGrid.map((r) => ({
            ...r,
            _errors: r._errors ? { ...r._errors } : {}
        }));
        undoStackRef.current.push(snapshot);
        if (undoStackRef.current.length > 80) undoStackRef.current.shift();
        redoStackRef.current = [];
    }, []);

    // 5. Selection Coordinates State
    const [selectionAnchor, setSelectionAnchor] = useState(null); // { r: rowIndex, c: colIndex }
    const [selectionFocus, setSelectionFocus] = useState(null);   // { r: rowIndex, c: colIndex }
    const [copiedBounds, setCopiedBounds] = useState(null);       // Active copied bounding box for marching ants
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [isFillDragging, setIsFillDragging] = useState(false);
    const [fillDragTargetRow, setFillDragTargetRow] = useState(null);

    const selectionAnchorRef = useRef(null);
    selectionAnchorRef.current = selectionAnchor;
    const selectionFocusRef = useRef(null);
    selectionFocusRef.current = selectionFocus;

    // Compute active selection bounding box
    const selectionBounds = useMemo(() => {
        return getSelectionBounds(selectionAnchor, selectionFocus);
    }, [selectionAnchor, selectionFocus]);

    const getBoundsFromRefs = useCallback(() => {
        return getSelectionBounds(selectionAnchorRef.current, selectionFocusRef.current);
    }, []);

    // 6. Cell Editing State
    const [editingCell, setEditingCell] = useState(null); // { rowIndex, colKey }
    const [activeDropdownCell, setActiveDropdownCell] = useState(null);
    const [dropdownPortalProps, setDropdownPortalProps] = useState(null);

    // 7. Modals State
    const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
    const [findReplaceMode, setFindReplaceMode] = useState('find');
    const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

    // 8. Clipboard Buffer Ref
    const internalClipboardRef = useRef('');

    // 9. Row Selection Checkboxes
    const [selectedIds, setSelectedIds] = useState(new Set());
    const selectedIdsRef = useRef(new Set());
    selectedIdsRef.current = selectedIds;
    const [lastSelectedId, setLastSelectedId] = useState(null);

    // 10. Sorting, Filtering & Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [customColWidths, setCustomColWidths] = useState({});
    const [contextMenu, setContextMenu] = useState(null);

    // 11. Filtered and Sorted Data
    const filteredGridData = useMemo(() => {
        if (!searchTerm.trim()) return gridData;
        const lower = searchTerm.toLowerCase();
        return gridData.filter((row) =>
            columns.some((col) => {
                const val = row[col.key];
                return val !== undefined && val !== null && String(val).toLowerCase().includes(lower);
            })
        );
    }, [gridData, columns, searchTerm]);

    const sortedGridData = useMemo(() => {
        if (!sortConfig.key) return filteredGridData;
        const { key, direction } = sortConfig;
        return [...filteredGridData].sort((a, b) => {
            const valA = a[key] ?? '';
            const valB = b[key] ?? '';
            if (typeof valA === 'number' && typeof valB === 'number') {
                return direction === 'asc' ? valA - valB : valB - valA;
            }
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA < strB) return direction === 'asc' ? -1 : 1;
            if (strA > strB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredGridData, sortConfig]);

    const sortedGridDataRef = useRef(sortedGridData);
    sortedGridDataRef.current = sortedGridData;

    // Paginated Data
    const paginatedGridData = useMemo(() => {
        if (pageSize === 'All') return sortedGridData;
        const size = Number(pageSize);
        const start = (currentPage - 1) * size;
        return sortedGridData.slice(start, start + size);
    }, [sortedGridData, currentPage, pageSize]);

    // Total page count
    const totalPages = useMemo(() => {
        if (pageSize === 'All') return 1;
        return Math.max(1, Math.ceil(sortedGridData.length / Number(pageSize)));
    }, [sortedGridData.length, pageSize]);

    // Reset current page if exceeds totalPages
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    // 12. Dirty Counts & Unsaved Changes
    const isRowDirty = useCallback(
        (row, original) => {
            if (!row) return false;
            if (!original) {
                return (
                    row._status === 'new' &&
                    columns.some((col) => row[col.key] !== undefined && String(row[col.key]).trim() !== '')
                );
            }
            return columns.some((col) => {
                const curVal = String(row[col.key] ?? '').trim();
                const origVal = String(original[col.key] ?? '').trim();
                return curVal !== origVal;
            });
        },
        [columns]
    );

    const { hasUnsavedChanges, unsavedCount, dirtyCounts } = useMemo(() => {
        let createdCount = 0;
        let updatedCount = 0;
        const deletedCount = deletedIds.size;

        for (let i = 0; i < gridData.length; i++) {
            const row = gridData[i];
            if (row._status === 'new' || String(row[primaryKey]).startsWith('temp_')) {
                const hasContent = columns.some(
                    (col) => row[col.key] !== undefined && String(row[col.key]).trim() !== ''
                );
                if (hasContent) createdCount++;
            } else {
                const original = originalDataMap.get(row[primaryKey]);
                if (row._status === 'modified' || (original && isRowDirty(row, original))) {
                    updatedCount++;
                }
            }
        }

        const total = createdCount + updatedCount + deletedCount;
        return {
            hasUnsavedChanges: total > 0,
            unsavedCount: total,
            dirtyCounts: { created: createdCount, updated: updatedCount, deleted: deletedCount, total }
        };
    }, [gridData, originalDataMap, deletedIds, primaryKey, columns, isRowDirty]);

    // Mouse Cell Selection & Drag Handlers
    const handleCellMouseDown = useCallback((rowIndex, colIndex, isShift = false, isCtrl = false) => {
        if (isShift && selectionAnchorRef.current) {
            setSelectionFocus({ r: rowIndex, c: colIndex });
        } else {
            setSelectionAnchor({ r: rowIndex, c: colIndex });
            setSelectionFocus({ r: rowIndex, c: colIndex });
            setIsMouseDown(true);
        }
    }, []);

    const handleCellMouseEnter = useCallback(
        (rowIndex, colIndex) => {
            if (isFillDragging) {
                setFillDragTargetRow(rowIndex);
            } else if (isMouseDown) {
                setSelectionFocus({ r: rowIndex, c: colIndex });
            }
        },
        [isFillDragging, isMouseDown]
    );

    // Helper notification toast
    const notify = useCallback(
        (type, title, message) => {
            if (showToast && typeof showToast === 'function') {
                showToast(type, title, message);
            }
        },
        [showToast]
    );

    // 13. Cell Value Mutations
    const handleCellChange = useCallback(
        (rowIndex, colKey, value, isAtomic = false) => {
            if (!canWrite) return;
            const targetRowObj = sortedGridDataRef.current[rowIndex];
            if (!targetRowObj) return;

            if (isAtomic) {
                pushUndoState(gridDataRef.current);
            }

            setGridData((prevGrid) => {
                const realIdx = prevGrid.findIndex((r) => r[primaryKey] === targetRowObj[primaryKey]);
                if (realIdx === -1) return prevGrid;

                const next = [...prevGrid];
                const updatedRow = { ...next[realIdx], [colKey]: value };

                updatedRow._errors = validateRow(updatedRow, columns);

                if (updatedRow._status !== 'new' && !String(updatedRow[primaryKey]).startsWith('temp_')) {
                    updatedRow._status = 'modified';
                }

                next[realIdx] = updatedRow;
                return next;
            });
        },
        [canWrite, primaryKey, columns, pushUndoState]
    );

    const handleCellBlur = useCallback(() => {
        if (editingCell) {
            setEditingCell(null);
            cellEditInitialStateRef.current = null;
        }
    }, [editingCell]);

    // 14. Excel Shortcuts & Actions

    // Copy to Clipboard (TSV)
    const executeCopy = useCallback(async () => {
        let rowsToCopy = [];
        let minCol = 0;
        let maxCol = columns.length - 1;

        const curSelectedIds = selectedIdsRef.current;
        const bounds = getBoundsFromRefs();

        if (curSelectedIds.size > 0) {
            rowsToCopy = sortedGridDataRef.current.filter((r) => curSelectedIds.has(r[primaryKey]));
        } else if (bounds) {
            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                if (sortedGridDataRef.current[r]) rowsToCopy.push(sortedGridDataRef.current[r]);
            }
            minCol = bounds.minCol;
            maxCol = bounds.maxCol;
            setCopiedBounds(bounds);
        }

        if (rowsToCopy.length === 0) return;

        const matrix = rowsToCopy.map((rowObj) => {
            const rowVals = [];
            for (let c = minCol; c <= maxCol; c++) {
                const colKey = columns[c]?.key;
                rowVals.push(colKey ? rowObj[colKey] ?? '' : '');
            }
            return rowVals;
        });

        const tsvData = stringifyTSV(matrix);
        if (tsvData) {
            internalClipboardRef.current = tsvData;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(tsvData);
                }
            } catch (err) {
                console.warn('Clipboard write error:', err);
            }
            const cellCount = matrix.length * (maxCol - minCol + 1);
            notify(
                'sparkle',
                'Copied',
                cellCount === 1 ? 'Copied 1 cell to clipboard' : `Copied ${cellCount} cells to clipboard`
            );
        }
    }, [columns, primaryKey, getBoundsFromRefs, notify]);

    // Cut to Clipboard
    const executeCut = useCallback(async () => {
        if (!canWrite) return;
        await executeCopy();
        pushUndoState(gridDataRef.current);

        const bounds = getBoundsFromRefs();
        if (!bounds) return;

        setGridData((prevGrid) => {
            const next = [...prevGrid];
            let numCleared = 0;

            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                const targetRowObj = sortedGridDataRef.current[r];
                if (!targetRowObj) continue;
                const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                if (realIdx === -1) continue;

                const rowCopy = { ...next[realIdx] };
                for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                    const col = columns[c];
                    if (col && !col.readOnly) {
                        rowCopy[col.key] = '';
                        numCleared++;
                    }
                }
                if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                rowCopy._errors = validateRow(rowCopy, columns);
                next[realIdx] = rowCopy;
            }

            if (numCleared > 0) {
                notify(
                    'sparkle',
                    'Cut',
                    numCleared === 1 ? 'Cut 1 cell to clipboard' : `Cut ${numCleared} cells to clipboard`
                );
            }
            return next;
        });
    }, [canWrite, executeCopy, pushUndoState, getBoundsFromRefs, columns, primaryKey, notify]);

    // Paste from Clipboard (with smart 1D/2D range replication)
    const executePaste = useCallback(
        async (pastedText = null, forcedStartRow = undefined, forcedStartCol = undefined) => {
            if (!canWrite) return;
            let textToPaste = pastedText;
            if (!textToPaste) {
                try {
                    if (navigator.clipboard && navigator.clipboard.readText) {
                        textToPaste = await navigator.clipboard.readText();
                    }
                } catch (err) {
                    textToPaste = internalClipboardRef.current;
                }
            }
            if (!textToPaste) textToPaste = internalClipboardRef.current;

            if (!textToPaste || !textToPaste.trim()) {
                notify('info', 'Clipboard', 'Clipboard is empty');
                return;
            }

            const parsedRows = parseTSV(textToPaste);
            if (parsedRows.length === 0) return;

            pushUndoState(gridDataRef.current);
            setCopiedBounds(null);

            let startRow = 0;
            let startCol = 0;
            const bounds = getBoundsFromRefs();
            const curSelectedIds = selectedIdsRef.current;

            if (forcedStartRow !== undefined && forcedStartCol !== undefined) {
                startRow = forcedStartRow;
                startCol = forcedStartCol;
            } else if (curSelectedIds.size > 0) {
                const firstSelectedId = Array.from(curSelectedIds)[0];
                const foundIdx = sortedGridDataRef.current.findIndex((r) => r[primaryKey] === firstSelectedId);
                if (foundIdx !== -1) startRow = foundIdx;
                startCol = bounds ? bounds.minCol : 0;
            } else if (bounds) {
                startRow = bounds.minRow;
                startCol = bounds.minCol;
            } else if (selectionAnchorRef.current) {
                startRow = selectionAnchorRef.current.r;
                startCol = selectionAnchorRef.current.c;
            }

            // Smart Excel Range Replication
            let expandedRows = parsedRows;
            if (
                bounds &&
                (bounds.maxRow > bounds.minRow || bounds.maxCol > bounds.minCol) &&
                forcedStartRow === undefined
            ) {
                const targetRowCount = bounds.maxRow - bounds.minRow + 1;
                const targetColCount = bounds.maxCol - bounds.minCol + 1;

                if (parsedRows.length === 1 && parsedRows[0].length === 1) {
                    const singleVal = parsedRows[0][0];
                    expandedRows = Array.from({ length: targetRowCount }, () =>
                        Array.from({ length: targetColCount }, () => singleVal)
                    );
                } else if (parsedRows.length === 1 && targetRowCount > 1) {
                    expandedRows = Array.from({ length: targetRowCount }, () => [...parsedRows[0]]);
                } else if (parsedRows[0].length === 1 && targetColCount > 1) {
                    expandedRows = parsedRows.map((row) =>
                        Array.from({ length: targetColCount }, () => row[0])
                    );
                }
            }

            let numCellsUpdated = 0;
            let newRowsAddedCount = 0;

            setGridData((prevGrid) => {
                const next = [...prevGrid];

                expandedRows.forEach((cells, dr) => {
                    const r = startRow + dr;
                    const targetRowObj = sortedGridDataRef.current[r];

                    if (targetRowObj) {
                        const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                        if (realIdx !== -1) {
                            const rowCopy = { ...next[realIdx] };
                            cells.forEach((cellVal, dc) => {
                                const c = startCol + dc;
                                if (c < columns.length) {
                                    const col = columns[c];
                                    if (col && !col.readOnly) {
                                        rowCopy[col.key] = (cellVal ?? '').trim();
                                        numCellsUpdated++;
                                    }
                                }
                            });
                            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                            rowCopy._errors = validateRow(rowCopy, columns);
                            next[realIdx] = rowCopy;
                        }
                    } else {
                        const newRow = {
                            [primaryKey]: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${dr}`,
                            _status: 'new',
                            _errors: {}
                        };
                        columns.forEach((col) => {
                            newRow[col.key] = col.defaultValue ?? '';
                        });
                        cells.forEach((cellVal, dc) => {
                            const c = startCol + dc;
                            if (c < columns.length) {
                                const col = columns[c];
                                if (col && !col.readOnly) {
                                    newRow[col.key] = (cellVal ?? '').trim();
                                    numCellsUpdated++;
                                }
                            }
                        });
                        newRow._errors = validateRow(newRow, columns);
                        next.push(newRow);
                        newRowsAddedCount++;
                    }
                });

                return next;
            });

            if (numCellsUpdated > 0) {
                const endRow = Math.min(
                    startRow + expandedRows.length - 1,
                    sortedGridDataRef.current.length + newRowsAddedCount - 1
                );
                const endCol = Math.min(startCol + (expandedRows[0]?.length || 1) - 1, columns.length - 1);
                setSelectionAnchor({ r: startRow, c: startCol });
                setSelectionFocus({ r: endRow, c: endCol });

                notify(
                    'sparkle',
                    'Pasted',
                    `Pasted ${numCellsUpdated} cell(s)${newRowsAddedCount > 0 ? ` (${newRowsAddedCount} new rows)` : ''}`
                );
            }
        },
        [canWrite, columns, primaryKey, getBoundsFromRefs, pushUndoState, notify]
    );

    // Fill Down (Ctrl+D)
    const handleFillDown = useCallback(() => {
        const bounds = getBoundsFromRefs();
        if (!bounds || bounds.minRow === bounds.maxRow || !canWrite) return;
        pushUndoState(gridDataRef.current);

        setGridData((prevGrid) => {
            const next = [...prevGrid];
            const topRowObj = sortedGridDataRef.current[bounds.minRow];
            if (!topRowObj) return prevGrid;

            for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                const col = columns[c];
                if (!col || col.readOnly) continue;
                const topVal = topRowObj[col.key];

                for (let r = bounds.minRow + 1; r <= bounds.maxRow; r++) {
                    const targetRowObj = sortedGridDataRef.current[r];
                    if (!targetRowObj) continue;
                    const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                    if (realIdx === -1) continue;

                    const rowCopy = { ...next[realIdx], [col.key]: topVal };
                    if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                    rowCopy._errors = validateRow(rowCopy, columns);
                    next[realIdx] = rowCopy;
                }
            }

            notify(
                'sparkle',
                'Fill Down (Ctrl+D)',
                `Filled down across ${bounds.maxRow - bounds.minRow + 1} rows`
            );
            return next;
        });
    }, [getBoundsFromRefs, canWrite, columns, primaryKey, pushUndoState, notify]);

    // Fill Right (Ctrl+R)
    const handleFillRight = useCallback(() => {
        const bounds = getBoundsFromRefs();
        if (!bounds || bounds.minCol === bounds.maxCol || !canWrite) return;
        pushUndoState(gridDataRef.current);

        setGridData((prevGrid) => {
            const next = [...prevGrid];
            const sourceCol = columns[bounds.minCol];
            if (!sourceCol) return prevGrid;

            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                const targetRowObj = sortedGridDataRef.current[r];
                if (!targetRowObj) continue;
                const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                if (realIdx === -1) continue;

                const fillVal = targetRowObj[sourceCol.key];
                const rowCopy = { ...next[realIdx] };

                for (let c = bounds.minCol + 1; c <= bounds.maxCol; c++) {
                    const col = columns[c];
                    if (col && !col.readOnly) {
                        rowCopy[col.key] = fillVal;
                    }
                }
                if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                rowCopy._errors = validateRow(rowCopy, columns);
                next[realIdx] = rowCopy;
            }

            notify('sparkle', 'Fill Right (Ctrl+R)', 'Filled values across columns');
            return next;
        });
    }, [getBoundsFromRefs, canWrite, columns, primaryKey, pushUndoState, notify]);

    // Auto-Fill Down to Table Bottom (Double Click Fill Handle)
    const handleAutoFillDown = useCallback(() => {
        const bounds = getBoundsFromRefs();
        if (!bounds || !canWrite) return;
        const totalRows = sortedGridDataRef.current.length;
        if (bounds.maxRow >= totalRows - 1) return;

        pushUndoState(gridDataRef.current);

        setGridData((prevGrid) => {
            const next = [...prevGrid];
            const sourceRowObj = sortedGridDataRef.current[bounds.maxRow];
            if (!sourceRowObj) return prevGrid;

            for (let r = bounds.maxRow + 1; r < totalRows; r++) {
                const targetRowObj = sortedGridDataRef.current[r];
                if (!targetRowObj) continue;
                const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                if (realIdx === -1) continue;

                const rowCopy = { ...next[realIdx] };
                for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                    const col = columns[c];
                    if (col && !col.readOnly) {
                        rowCopy[col.key] = sourceRowObj[col.key] ?? '';
                    }
                }
                if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                rowCopy._errors = validateRow(rowCopy, columns);
                next[realIdx] = rowCopy;
            }

            setSelectionFocus({ r: totalRows - 1, c: bounds.maxCol });
            notify('sparkle', 'Auto-Fill Down', `Auto-filled values to bottom of table (${totalRows} rows)`);
            return next;
        });
    }, [getBoundsFromRefs, canWrite, columns, primaryKey, pushUndoState, notify]);

    // Date Stamp (Ctrl+;)
    const handleDateStamp = useCallback(() => {
        if (!canWrite) return;
        const bounds = getBoundsFromRefs();
        const anchor = selectionAnchorRef.current;
        if (!bounds && !anchor) return;

        const todayStr = new Date().toISOString().slice(0, 10);
        pushUndoState(gridDataRef.current);

        const activeBounds = bounds || { minRow: anchor.r, maxRow: anchor.r, minCol: anchor.c, maxCol: anchor.c };
        let numUpdated = 0;

        setGridData((prevGrid) => {
            const next = [...prevGrid];

            for (let r = activeBounds.minRow; r <= activeBounds.maxRow; r++) {
                const targetRowObj = sortedGridDataRef.current[r];
                if (!targetRowObj) continue;
                const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                if (realIdx === -1) continue;

                const rowCopy = { ...next[realIdx] };
                for (let c = activeBounds.minCol; c <= activeBounds.maxCol; c++) {
                    const col = columns[c];
                    if (col && !col.readOnly) {
                        rowCopy[col.key] = todayStr;
                        numUpdated++;
                    }
                }
                if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                rowCopy._errors = validateRow(rowCopy, columns);
                next[realIdx] = rowCopy;
            }

            if (numUpdated > 0) {
                if (editingCell) setEditingCell(null);
                notify('sparkle', 'Date Stamp (Ctrl+;)', `Inserted today's date (${todayStr}) into ${numUpdated} cell(s)`);
            }
            return next;
        });
    }, [canWrite, getBoundsFromRefs, columns, primaryKey, pushUndoState, editingCell, notify]);

    // Time Stamp (Ctrl+Shift+:)
    const handleTimeStamp = useCallback(() => {
        if (!canWrite) return;
        const bounds = getBoundsFromRefs();
        const anchor = selectionAnchorRef.current;
        if (!bounds && !anchor) return;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        pushUndoState(gridDataRef.current);

        const activeBounds = bounds || { minRow: anchor.r, maxRow: anchor.r, minCol: anchor.c, maxCol: anchor.c };
        let numUpdated = 0;

        setGridData((prevGrid) => {
            const next = [...prevGrid];

            for (let r = activeBounds.minRow; r <= activeBounds.maxRow; r++) {
                const targetRowObj = sortedGridDataRef.current[r];
                if (!targetRowObj) continue;
                const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                if (realIdx === -1) continue;

                const rowCopy = { ...next[realIdx] };
                for (let c = activeBounds.minCol; c <= activeBounds.maxCol; c++) {
                    const col = columns[c];
                    if (col && !col.readOnly) {
                        rowCopy[col.key] = timeStr;
                        numUpdated++;
                    }
                }
                if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                rowCopy._errors = validateRow(rowCopy, columns);
                next[realIdx] = rowCopy;
            }

            if (numUpdated > 0) {
                if (editingCell) setEditingCell(null);
                notify('sparkle', 'Time Stamp (Ctrl+Shift+:)', `Inserted current time (${timeStr}) into ${numUpdated} cell(s)`);
            }
            return next;
        });
    }, [canWrite, getBoundsFromRefs, columns, primaryKey, pushUndoState, editingCell, notify]);

    // Copy Cell from Above (Ctrl+' or Ctrl+")
    const handleCopyFromAbove = useCallback(() => {
        if (!canWrite) return;
        const curFocus = selectionFocusRef.current;
        if (!curFocus || curFocus.r === 0) return;

        const sourceRowObj = sortedGridDataRef.current[curFocus.r - 1];
        const targetCol = columns[curFocus.c];
        if (!sourceRowObj || !targetCol || targetCol.readOnly) return;

        const valAbove = sourceRowObj[targetCol.key] ?? '';
        handleCellChange(curFocus.r, targetCol.key, valAbove, true);
        notify('sparkle', "Copied Above (Ctrl+')", `Copied value from cell above`);
    }, [canWrite, columns, handleCellChange, notify]);

    // Transform Case (UPPERCASE, lowercase, Title Case)
    const handleTransformCase = useCallback((type = 'uppercase') => {
        if (!canWrite) return;
        const bounds = getBoundsFromRefs();
        const anchor = selectionAnchorRef.current;
        if (!bounds && !anchor) return;

        pushUndoState(gridDataRef.current);
        const activeBounds = bounds || { minRow: anchor.r, maxRow: anchor.r, minCol: anchor.c, maxCol: anchor.c };
        let numUpdated = 0;

        setGridData((prevGrid) => {
            const next = [...prevGrid];

            for (let r = activeBounds.minRow; r <= activeBounds.maxRow; r++) {
                const targetRowObj = sortedGridDataRef.current[r];
                if (!targetRowObj) continue;
                const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                if (realIdx === -1) continue;

                const rowCopy = { ...next[realIdx] };
                for (let c = activeBounds.minCol; c <= activeBounds.maxCol; c++) {
                    const col = columns[c];
                    if (col && !col.readOnly && col.type !== 'checkbox' && col.type !== 'number') {
                        const originalVal = rowCopy[col.key];
                        if (originalVal !== undefined && originalVal !== null) {
                            rowCopy[col.key] = transformCase(originalVal, type);
                            numUpdated++;
                        }
                    }
                }
                if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                rowCopy._errors = validateRow(rowCopy, columns);
                next[realIdx] = rowCopy;
            }

            if (numUpdated > 0) {
                notify('sparkle', 'Text Case Transformed', `Transformed ${numUpdated} cell(s) to ${type}`);
            }
            return next;
        });
    }, [canWrite, getBoundsFromRefs, columns, primaryKey, pushUndoState, notify]);

    // Clear Cell Contents (Delete / Backspace)
    const handleClearCells = useCallback(() => {
        if (!canWrite) return;
        const bounds = getBoundsFromRefs();
        if (!bounds) return;

        pushUndoState(gridDataRef.current);
        let numCleared = 0;

        setGridData((prevGrid) => {
            const next = [...prevGrid];

            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                const targetRowObj = sortedGridDataRef.current[r];
                if (!targetRowObj) continue;
                const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                if (realIdx === -1) continue;

                const rowCopy = { ...next[realIdx] };
                for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
                    const col = columns[c];
                    if (col && !col.readOnly) {
                        rowCopy[col.key] = '';
                        numCleared++;
                    }
                }
                if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                rowCopy._errors = validateRow(rowCopy, columns);
                next[realIdx] = rowCopy;
            }

            if (numCleared > 0) {
                notify('info', 'Cells Cleared', `Cleared contents of ${numCleared} cell(s)`);
            }
            return next;
        });
    }, [canWrite, getBoundsFromRefs, columns, primaryKey, pushUndoState, notify]);

    // Undo / Redo
    const undo = useCallback(() => {
        if (undoStackRef.current.length === 0) return;
        const previousState = undoStackRef.current.pop();

        redoStackRef.current.push(
            gridDataRef.current.map((r) => ({
                ...r,
                _errors: r._errors ? { ...r._errors } : {}
            }))
        );

        setGridData(previousState);
        notify('info', 'Undo', 'Reverted last change');
    }, [notify]);

    const redo = useCallback(() => {
        if (redoStackRef.current.length === 0) return;
        const nextState = redoStackRef.current.pop();

        undoStackRef.current.push(
            gridDataRef.current.map((r) => ({
                ...r,
                _errors: r._errors ? { ...r._errors } : {}
            }))
        );

        setGridData(nextState);
        notify('info', 'Redo', 'Restored change');
    }, [notify]);

    // Add Rows
    const handleAddRows = useCallback(
        (count = 1) => {
            pushUndoState(gridDataRef.current);
            const newRows = Array.from({ length: count }).map((_, idx) => {
                const freshRow = {
                    [primaryKey]: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${idx}`,
                    _status: 'new',
                    _errors: {}
                };
                columns.forEach((col) => {
                    freshRow[col.key] = col.defaultValue ?? '';
                });
                return freshRow;
            });

            const targetIdx = gridDataRef.current.length;
            setGridData((prev) => [...prev, ...newRows]);

            // Immediately focus and start editing the first editable column of the newly added row
            const firstEditableCol = columns.find((c) => !c.readOnly) || columns[0];
            const firstColIdx = firstEditableCol
                ? columns.findIndex((c) => c.key === firstEditableCol.key)
                : 0;
            const finalColIdx = firstColIdx >= 0 ? firstColIdx : 0;

            setSelectionAnchor({ r: targetIdx, c: finalColIdx });
            setSelectionFocus({ r: targetIdx, c: finalColIdx });

            if (firstEditableCol) {
                setEditingCell({ rowIndex: targetIdx, colKey: firstEditableCol.key });
            }

            notify('info', 'Rows Added', `Added ${count} new draft row(s) at bottom`);
        },
        [columns, primaryKey, pushUndoState, notify]
    );

    // Insert Row Above or Below Target
    const handleInsertRow = useCallback(
        (targetRowIndex, position = 'below') => {
            pushUndoState(gridDataRef.current);
            const targetRow = sortedGridDataRef.current[targetRowIndex];
            let realIdx = targetRowIndex;
            if (targetRow) {
                const found = gridDataRef.current.findIndex((r) => r[primaryKey] === targetRow[primaryKey]);
                if (found !== -1) realIdx = found;
            }
            const insertIdx = position === 'above' ? realIdx : realIdx + 1;

            const newRow = {
                [primaryKey]: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                _status: 'new',
                _errors: {}
            };
            columns.forEach((col) => {
                newRow[col.key] = col.defaultValue ?? '';
            });

            setGridData((prev) => {
                const next = [...prev];
                next.splice(insertIdx, 0, newRow);
                return next;
            });

            // Immediately focus and start editing the first editable cell
            const firstEditableCol = columns.find((c) => !c.readOnly) || columns[0];
            const firstColIdx = firstEditableCol
                ? columns.findIndex((c) => c.key === firstEditableCol.key)
                : 0;
            const finalColIdx = firstColIdx >= 0 ? firstColIdx : 0;

            setSelectionAnchor({ r: insertIdx, c: finalColIdx });
            setSelectionFocus({ r: insertIdx, c: finalColIdx });

            if (firstEditableCol) {
                setEditingCell({ rowIndex: insertIdx, colKey: firstEditableCol.key });
            }

            notify('info', 'Row Inserted', `Inserted new row ${position} row #${targetRowIndex + 1}`);
        },
        [columns, primaryKey, pushUndoState, notify]
    );

    // Duplicate Selected Row(s)
    const handleDuplicateRow = useCallback(
        (row) => {
            pushUndoState(gridDataRef.current);
            const clone = {
                ...row,
                [primaryKey]: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                _status: 'new',
                _errors: {}
            };
            if (clone.name) clone.name = `${clone.name} (Copy)`;

            let realIdx = gridDataRef.current.length;
            let sortedIdx = sortedGridDataRef.current.length;
            if (row && row[primaryKey]) {
                const found = gridDataRef.current.findIndex((r) => r[primaryKey] === row[primaryKey]);
                if (found !== -1) realIdx = found + 1;
                const foundSorted = sortedGridDataRef.current.findIndex((r) => r[primaryKey] === row[primaryKey]);
                if (foundSorted !== -1) sortedIdx = foundSorted + 1;
            }

            setGridData((prev) => {
                const next = [...prev];
                next.splice(realIdx, 0, clone);
                return next;
            });

            setSelectionAnchor({ r: sortedIdx, c: 0 });
            setSelectionFocus({ r: sortedIdx, c: 0 });
            notify('sparkle', 'Duplicated', `Duplicated "${row.name || 'Row'}" right below`);
        },
        [primaryKey, pushUndoState, notify]
    );

    // Delete Rows
    const handleDeleteRows = useCallback(
        (rowsToDelete = []) => {
            if (!rowsToDelete || rowsToDelete.length === 0) return;
            pushUndoState(gridDataRef.current);

            const idsToDelete = rowsToDelete.map((r) => r[primaryKey]);
            const savedIds = idsToDelete.filter((id) => !String(id).startsWith('temp_'));

            setGridData((prev) => prev.filter((r) => !idsToDelete.includes(r[primaryKey])));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                idsToDelete.forEach((id) => next.delete(id));
                return next;
            });

            if (savedIds.length > 0) {
                setDeletedIds((prev) => new Set([...prev, ...savedIds]));
            }

            setSelectionAnchor(null);
            setSelectionFocus(null);
            notify('success', 'Deleted', `Deleted ${rowsToDelete.length} row(s) locally`);
        },
        [primaryKey, pushUndoState, notify]
    );

    // Replace All (Find & Replace)
    const handleReplaceAll = useCallback((findText, replaceText, matchCase = false, matchExact = false) => {
        if (!canWrite || !findText) return;
        pushUndoState(gridDataRef.current);

        const query = matchCase ? findText : findText.toLowerCase();
        let numReplaced = 0;

        setGridData((prevGrid) => {
            const next = prevGrid.map((row) => {
                let rowModified = false;
                const updatedRow = { ...row };

                columns.forEach((col) => {
                    if (col.readOnly) return;
                    const val = String(row[col.key] ?? '');
                    const target = matchCase ? val : val.toLowerCase();

                    if (matchExact ? target === query : target.includes(query)) {
                        if (matchExact) {
                            updatedRow[col.key] = replaceText;
                        } else {
                            const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
                            updatedRow[col.key] = val.replace(regex, replaceText);
                        }
                        rowModified = true;
                        numReplaced++;
                    }
                });

                if (rowModified) {
                    if (updatedRow._status !== 'new') updatedRow._status = 'modified';
                    updatedRow._errors = validateRow(updatedRow, columns);
                }
                return updatedRow;
            });

            return next;
        });

        notify('sparkle', 'Replace All Completed', `Replaced ${numReplaced} instance(s) across table`);
    }, [canWrite, columns, pushUndoState, notify]);

    // Column Auto-Fit Double Click
    const handleColumnHeaderDoubleClick = useCallback((colKey, colLabel) => {
        const computed = calculateAutoFitWidth(colKey, colLabel, sortedGridDataRef.current);
        setCustomColWidths((prev) => {
            if (prev[colKey]) {
                const next = { ...prev };
                delete next[colKey];
                return next;
            }
            return { ...prev, [colKey]: computed };
        });
    }, []);

    // 15. Keydown Event Dispatcher (FortuneSheet / Excel Shortcut Engine)
    const handleCellKeyDown = useCallback(
        (e, rowIndex, colKey) => {
            const colIndex = columns.findIndex((c) => c.key === colKey);
            const totalRows = sortedGridData.length;
            const totalCols = columns.length;
            const isModifier = e.ctrlKey || e.metaKey;

            // Inside Cell Editing Mode
            if (editingCell?.rowIndex === rowIndex && editingCell?.colKey === colKey) {
                const inputEl = e.target;
                const isInput =
                    inputEl?.tagName?.toLowerCase() === 'input' || inputEl?.tagName?.toLowerCase() === 'textarea';
                const selStart = isInput ? inputEl.selectionStart ?? 0 : 0;
                const selEnd = isInput ? inputEl.selectionEnd ?? 0 : 0;
                const valLen = isInput ? inputEl.value?.length ?? 0 : 0;

                // Alt+Enter: Insert newline inside multiline text
                if (e.altKey && e.key === 'Enter') {
                    e.preventDefault();
                    if (isInput) {
                        const start = selStart;
                        const end = selEnd;
                        const val = inputEl.value || '';
                        const newVal = val.substring(0, start) + '\n' + val.substring(end);
                        handleCellChange(rowIndex, colKey, newVal);
                        setTimeout(() => {
                            inputEl.selectionStart = inputEl.selectionEnd = start + 1;
                        }, 0);
                    }
                    return;
                }

                // Ctrl+; : Insert Date Stamp
                if (isModifier && !e.shiftKey && (e.key === ';' || e.key === ':')) {
                    e.preventDefault();
                    const todayStr = new Date().toISOString().slice(0, 10);
                    handleCellChange(rowIndex, colKey, todayStr);
                    return;
                }

                // Ctrl+Shift+: : Insert Time Stamp
                if (isModifier && e.shiftKey && (e.key === ';' || e.key === ':')) {
                    e.preventDefault();
                    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    handleCellChange(rowIndex, colKey, timeStr);
                    return;
                }

                // Ctrl+' or Ctrl+" : Copy from cell above
                if (isModifier && (e.key === "'" || e.key === '"')) {
                    e.preventDefault();
                    handleCopyFromAbove();
                    return;
                }

                // Enter / Shift+Enter
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCellBlur();
                    if (!e.shiftKey && rowIndex === totalRows - 1 && canWrite) {
                        handleAddRows(1);
                        return;
                    }
                    const nextRow = e.shiftKey ? Math.max(0, rowIndex - 1) : Math.min(totalRows - 1, rowIndex + 1);
                    setSelectionAnchor({ r: nextRow, c: colIndex });
                    setSelectionFocus({ r: nextRow, c: colIndex });
                    return;
                }

                // Escape: Cancel edit
                if (e.key === 'Escape') {
                    e.preventDefault();
                    if (cellEditInitialStateRef.current) {
                        setGridData(cellEditInitialStateRef.current);
                        cellEditInitialStateRef.current = null;
                    }
                    setEditingCell(null);
                    return;
                }

                // Tab / Shift+Tab
                if (e.key === 'Tab') {
                    e.preventDefault();
                    handleCellBlur();
                    let nextCol = e.shiftKey ? colIndex - 1 : colIndex + 1;
                    let nextRow = rowIndex;
                    if (nextCol < 0) {
                        if (rowIndex > 0) {
                            nextRow = rowIndex - 1;
                            nextCol = totalCols - 1;
                        } else {
                            nextCol = 0;
                        }
                    } else if (nextCol >= totalCols) {
                        if (rowIndex < totalRows - 1) {
                            nextRow = rowIndex + 1;
                            nextCol = 0;
                        } else if (canWrite) {
                            handleAddRows(1);
                            return;
                        } else {
                            nextCol = totalCols - 1;
                        }
                    }
                    setSelectionAnchor({ r: nextRow, c: nextCol });
                    setSelectionFocus({ r: nextRow, c: nextCol });
                    return;
                }

                // ArrowUp / ArrowDown while editing
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    handleCellBlur();
                    const targetRow = isModifier ? 0 : Math.max(0, rowIndex - 1);
                    setSelectionAnchor({ r: targetRow, c: colIndex });
                    setSelectionFocus({ r: targetRow, c: colIndex });
                    return;
                }

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    handleCellBlur();
                    const targetRow = isModifier ? Math.max(0, totalRows - 1) : Math.min(totalRows - 1, rowIndex + 1);
                    setSelectionAnchor({ r: targetRow, c: colIndex });
                    setSelectionFocus({ r: targetRow, c: colIndex });
                    return;
                }

                // ArrowLeft / ArrowRight at edge
                if (e.key === 'ArrowLeft' && (isModifier || (selStart === 0 && selEnd === 0))) {
                    e.preventDefault();
                    handleCellBlur();
                    const targetCol = isModifier ? 0 : Math.max(0, colIndex - 1);
                    setSelectionAnchor({ r: rowIndex, c: targetCol });
                    setSelectionFocus({ r: rowIndex, c: targetCol });
                    return;
                }

                if (e.key === 'ArrowRight' && (isModifier || (selStart === valLen && selEnd === valLen))) {
                    e.preventDefault();
                    handleCellBlur();
                    const targetCol = isModifier ? totalCols - 1 : Math.min(totalCols - 1, colIndex + 1);
                    setSelectionAnchor({ r: rowIndex, c: targetCol });
                    setSelectionFocus({ r: rowIndex, c: targetCol });
                    return;
                }

                return;
            }

            // Normal Navigation Mode

            // Delete / Backspace
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectionBounds && canWrite) {
                    e.preventDefault();
                    const isFullRowSelected = selectionBounds.minCol === 0 && selectionBounds.maxCol === totalCols - 1;
                    if (isFullRowSelected) {
                        const rowsToDelete = [];
                        for (let r = selectionBounds.minRow; r <= selectionBounds.maxRow; r++) {
                            const target = sortedGridDataRef.current[r];
                            if (target) rowsToDelete.push(target);
                        }
                        if (rowsToDelete.length > 0) {
                            handleDeleteRows(rowsToDelete);
                        }
                        return;
                    }
                    handleClearCells();
                }
                return;
            }

            const curFocus = selectionFocusRef.current || selectionFocus || { r: rowIndex, c: colIndex };
            const curAnchor = selectionAnchorRef.current || selectionAnchor || { r: rowIndex, c: colIndex };

            const updateSelection = (anchor, focus) => {
                selectionAnchorRef.current = anchor;
                selectionFocusRef.current = focus;
                setSelectionAnchor(anchor);
                setSelectionFocus(focus);
            };

            // Arrow Keys Navigation
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const targetRow = isModifier ? 0 : Math.max(0, curFocus.r - 1);
                updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: curFocus.c }, { r: targetRow, c: curFocus.c });
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const targetRow = isModifier
                    ? Math.max(0, totalRows - 1)
                    : Math.min(Math.max(0, totalRows - 1), curFocus.r + 1);
                updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: curFocus.c }, { r: targetRow, c: curFocus.c });
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const targetCol = isModifier ? 0 : Math.max(0, curFocus.c - 1);
                updateSelection(e.shiftKey ? curAnchor : { r: curFocus.r, c: targetCol }, { r: curFocus.r, c: targetCol });
                return;
            }

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const targetCol = isModifier ? totalCols - 1 : Math.min(totalCols - 1, curFocus.c + 1);
                updateSelection(e.shiftKey ? curAnchor : { r: curFocus.r, c: targetCol }, { r: curFocus.r, c: targetCol });
                return;
            }

            // Home / End
            if (e.key === 'Home') {
                e.preventDefault();
                const targetRow = isModifier ? 0 : curFocus.r;
                const targetCol = 0;
                updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: targetCol }, { r: targetRow, c: targetCol });
                return;
            }

            if (e.key === 'End') {
                e.preventDefault();
                const targetRow = isModifier ? Math.max(0, totalRows - 1) : curFocus.r;
                const targetCol = totalCols - 1;
                updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: targetCol }, { r: targetRow, c: targetCol });
                return;
            }

            // PageUp / PageDown
            if (e.key === 'PageUp') {
                e.preventDefault();
                if (e.altKey) {
                    // Alt+PageUp: jump 5 columns left
                    const targetCol = Math.max(0, curFocus.c - 5);
                    updateSelection(e.shiftKey ? curAnchor : { r: curFocus.r, c: targetCol }, { r: curFocus.r, c: targetCol });
                } else {
                    const targetRow = Math.max(0, curFocus.r - 10);
                    updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: curFocus.c }, { r: targetRow, c: targetCol });
                }
                return;
            }

            if (e.key === 'PageDown') {
                e.preventDefault();
                if (e.altKey) {
                    // Alt+PageDown: jump 5 columns right
                    const targetCol = Math.min(totalCols - 1, curFocus.c + 5);
                    updateSelection(e.shiftKey ? curAnchor : { r: curFocus.r, c: targetCol }, { r: curFocus.r, c: targetCol });
                } else {
                    const targetRow = Math.min(Math.max(0, totalRows - 1), curFocus.r + 10);
                    updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: curFocus.c }, { r: targetRow, c: curFocus.c });
                }
                return;
            }

            // Tab / Shift+Tab
            if (e.key === 'Tab') {
                e.preventDefault();
                let nextCol = e.shiftKey ? curFocus.c - 1 : curFocus.c + 1;
                let nextRow = curFocus.r;
                if (nextCol < 0) {
                    if (curFocus.r > 0) {
                        nextRow = curFocus.r - 1;
                        nextCol = totalCols - 1;
                    } else {
                        nextCol = 0;
                    }
                } else if (nextCol >= totalCols) {
                    if (curFocus.r < totalRows - 1) {
                        nextRow = curFocus.r + 1;
                        nextCol = 0;
                    } else if (canWrite) {
                        handleAddRows(1);
                        return;
                    } else {
                        nextCol = totalCols - 1;
                    }
                }
                updateSelection({ r: nextRow, c: nextCol }, { r: nextRow, c: nextCol });
                return;
            }

            // Enter / Shift+Enter
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!e.shiftKey && curFocus.r === totalRows - 1 && canWrite) {
                    handleAddRows(1);
                    return;
                }
                const nextRow = e.shiftKey
                    ? Math.max(0, curFocus.r - 1)
                    : Math.min(Math.max(0, totalRows - 1), curFocus.r + 1);
                updateSelection({ r: nextRow, c: curFocus.c }, { r: nextRow, c: curFocus.c });
                return;
            }

            // Spacebar Selection (Shift+Space: Row, Ctrl+Space: Col)
            if (e.key === ' ' || e.key === 'Spacebar') {
                if (e.shiftKey && !isModifier) {
                    e.preventDefault();
                    const bounds = selectionBounds || { minRow: curFocus.r, maxRow: curFocus.r };
                    const newSelectedIds = new Set();
                    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                        const target = sortedGridDataRef.current[r];
                        if (target) newSelectedIds.add(target[primaryKey]);
                    }
                    setSelectedIds(newSelectedIds);
                    setSelectionAnchor({ r: bounds.minRow, c: 0 });
                    setSelectionFocus({ r: bounds.maxRow, c: totalCols - 1 });
                    return;
                }
                if (isModifier && !e.shiftKey) {
                    e.preventDefault();
                    const bounds = selectionBounds || { minCol: curFocus.c, maxCol: curFocus.c };
                    setSelectionAnchor({ r: 0, c: bounds.minCol });
                    setSelectionFocus({ r: Math.max(0, totalRows - 1), c: bounds.maxCol });
                    return;
                }
            }

            // F2: Start Edit
            if (e.key === 'F2') {
                e.preventDefault();
                if (canWrite) {
                    cellEditInitialStateRef.current = gridDataRef.current.map((r) => ({
                        ...r,
                        _errors: r._errors ? { ...r._errors } : {}
                    }));
                    setEditingCell({ rowIndex: curFocus.r, colKey });
                }
                return;
            }

            // Ctrl+; : Insert Date Stamp
            if (canWrite && isModifier && !e.shiftKey && (e.key === ';' || e.key === ':')) {
                e.preventDefault();
                handleDateStamp();
                return;
            }

            // Ctrl+Shift+: : Insert Time Stamp
            if (canWrite && isModifier && e.shiftKey && (e.key === ';' || e.key === ':')) {
                e.preventDefault();
                handleTimeStamp();
                return;
            }

            // Ctrl+' or Ctrl+" : Copy value from cell above
            if (canWrite && isModifier && (e.key === "'" || e.key === '"')) {
                e.preventDefault();
                handleCopyFromAbove();
                return;
            }

            // Ctrl+U: UPPERCASE
            if (canWrite && isModifier && e.key.toLowerCase() === 'u') {
                e.preventDefault();
                handleTransformCase('uppercase');
                return;
            }

            // Ctrl+L: lowercase
            if (canWrite && isModifier && e.key.toLowerCase() === 'l' && !e.shiftKey) {
                e.preventDefault();
                handleTransformCase('lowercase');
                return;
            }

            // Ctrl+K: Title Case
            if (canWrite && isModifier && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                handleTransformCase('titlecase');
                return;
            }

            // Ctrl+H: Open Find & Replace
            if (isModifier && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                setFindReplaceMode('replace');
                setIsFindReplaceOpen(true);
                return;
            }

            // F1: Open Shortcuts Modal
            if (e.key === 'F1') {
                e.preventDefault();
                setIsShortcutsModalOpen(true);
                return;
            }

            // Shift+F10 / ContextMenu
            if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
                e.preventDefault();
                setContextMenu({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                    rowIndex: curFocus.r,
                    colIndex: curFocus.c
                });
                return;
            }

            // Character typing directly starts editing
            if (canWrite && e.key.length === 1 && !isModifier && !e.altKey) {
                const targetCol = columns[colIndex];
                if (targetCol && !targetCol.readOnly && targetCol.type !== 'select' && targetCol.type !== 'searchable-select') {
                    cellEditInitialStateRef.current = gridDataRef.current.map((r) => ({
                        ...r,
                        _errors: r._errors ? { ...r._errors } : {}
                    }));
                    setEditingCell({ rowIndex: curFocus.r, colKey });
                    handleCellChange(curFocus.r, colKey, e.key);
                }
            }
        },
        [
            columns,
            sortedGridData.length,
            editingCell,
            selectionFocus,
            selectionAnchor,
            selectionBounds,
            canWrite,
            handleCellChange,
            handleCellBlur,
            handleDeleteRows,
            handleClearCells,
            handleDateStamp,
            handleTimeStamp,
            handleCopyFromAbove,
            handleTransformCase,
            primaryKey
        ]
    );

    // Global KeyDown Listener (Copy, Paste, Cut, Undo, Redo, Fill Down/Right, Shortcuts)
    useEffect(() => {
        const handleGlobalKeyDown = async (e) => {
            const activeElem = document.activeElement;
            const isTyping =
                activeElem &&
                (activeElem.tagName === 'INPUT' ||
                    activeElem.tagName === 'SELECT' ||
                    activeElem.tagName === 'TEXTAREA');

            if (isTyping && editingCell) {
                return;
            }

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            // F1: Open Keyboard Shortcuts
            if (e.key === 'F1') {
                e.preventDefault();
                setIsShortcutsModalOpen(true);
                return;
            }

            // Ctrl + H: Find and Replace
            if (isCtrlOrCmd && e.key.toLowerCase() === 'h' && !isTyping) {
                e.preventDefault();
                setFindReplaceMode('replace');
                setIsFindReplaceOpen(true);
                return;
            }

            // Ctrl + F: Find in Sheet
            if (isCtrlOrCmd && e.key.toLowerCase() === 'f' && !isTyping) {
                e.preventDefault();
                setFindReplaceMode('find');
                setIsFindReplaceOpen(true);
                return;
            }

            // Ctrl + C: Copy
            if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
                if (!selectionAnchorRef.current && selectedIdsRef.current.size === 0) return;
                e.preventDefault();
                await executeCopy();
                return;
            }

            // Ctrl + X: Cut
            if (isCtrlOrCmd && e.key.toLowerCase() === 'x') {
                if (!selectionAnchorRef.current && selectedIdsRef.current.size === 0) return;
                e.preventDefault();
                await executeCut();
                return;
            }

            // Ctrl + V: Paste
            if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
                if (!selectionAnchorRef.current && selectedIdsRef.current.size === 0) return;
                e.preventDefault();
                await executePaste();
                return;
            }

            // Ctrl + Z: Undo
            if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // Ctrl + Y / Ctrl + Shift + Z: Redo
            if (
                (isCtrlOrCmd && e.key.toLowerCase() === 'y') ||
                (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z')
            ) {
                e.preventDefault();
                redo();
                return;
            }

            // Ctrl + D: Fill Down
            if (isCtrlOrCmd && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                handleFillDown();
                return;
            }

            // Ctrl + R: Fill Right
            if (isCtrlOrCmd && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                handleFillRight();
                return;
            }

            // Ctrl + A: Select All
            if (isCtrlOrCmd && e.key.toLowerCase() === 'a' && !isTyping) {
                e.preventDefault();
                const totalR = sortedGridDataRef.current.length;
                const totalC = columns.length;
                if (totalR > 0 && totalC > 0) {
                    setSelectionAnchor({ r: 0, c: 0 });
                    setSelectionFocus({ r: totalR - 1, c: totalC - 1 });
                }
                return;
            }

            // Ctrl + + / Ctrl + = / Insert : Add Row
            if (canWrite && (e.key === 'Insert' || (isCtrlOrCmd && (e.key === '+' || e.key === '=')))) {
                e.preventDefault();
                handleAddRows(1);
                return;
            }

            // Ctrl + - : Delete Active Row
            if (canWrite && isCtrlOrCmd && (e.key === '-' || e.key === '_') && !isTyping) {
                e.preventDefault();
                const focus = selectionFocusRef.current;
                if (focus && sortedGridDataRef.current[focus.r]) {
                    handleDeleteRows([sortedGridDataRef.current[focus.r]]);
                }
                return;
            }

            // Cell Navigation & Keyboard Gestures (When a cell is selected / active)
            const focus = selectionFocusRef.current;
            if (focus && !editingCell) {
                // If user is inside an external modal / search input outside the grid, ignore
                if (isTyping && !activeElem?.closest('td[data-excel-cell="true"]') && !activeElem?.closest('[data-excel-grid="true"]')) {
                    return;
                }

                const col = columns[focus.c];
                if (col) {
                    const navKeys = [
                        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                        'Tab', 'Enter', 'Home', 'End', 'PageUp', 'PageDown',
                        'Delete', 'Backspace', 'F2', ' ', 'Spacebar'
                    ];
                    const isNavigationKey = navKeys.includes(e.key);
                    const isCaseTransform = isCtrlOrCmd && ['u', 'l', 'k'].includes(e.key.toLowerCase());
                    const isDateTimeStamp = isCtrlOrCmd && (e.key === ';' || e.key === ':');
                    const isCopyFromAbove = isCtrlOrCmd && (e.key === "'" || e.key === '"');
                    const isDirectTyping = canWrite && e.key.length === 1 && !isCtrlOrCmd && !e.altKey && !e.metaKey;

                    if (isNavigationKey || isCaseTransform || isDateTimeStamp || isCopyFromAbove || isDirectTyping) {
                        handleCellKeyDown(e, focus.r, col.key);
                        return;
                    }
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [
        editingCell,
        columns,
        canWrite,
        executeCopy,
        executeCut,
        executePaste,
        undo,
        redo,
        handleFillDown,
        handleFillRight,
        handleAddRows,
        handleDeleteRows,
        handleCellKeyDown
    ]);

    // Global MouseUp to terminate drag selection or fill drag
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isFillDragging && fillDragTargetRow !== null && selectionBounds) {
                const startRow = selectionBounds.maxRow + 1;
                const endRow = fillDragTargetRow;
                if (endRow >= startRow) {
                    pushUndoState(gridDataRef.current);
                    setGridData((prevGrid) => {
                        const next = [...prevGrid];
                        const sourceRowObj = sortedGridDataRef.current[selectionBounds.maxRow];
                        if (!sourceRowObj) return prevGrid;

                        for (let r = startRow; r <= endRow; r++) {
                            const targetRowObj = sortedGridDataRef.current[r];
                            if (!targetRowObj) continue;
                            const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                            if (realIdx === -1) continue;

                            const rowCopy = { ...next[realIdx] };
                            for (let c = selectionBounds.minCol; c <= selectionBounds.maxCol; c++) {
                                const col = columns[c];
                                if (col && !col.readOnly) {
                                    rowCopy[col.key] = sourceRowObj[col.key] ?? '';
                                }
                            }
                            if (rowCopy._status !== 'new') rowCopy._status = 'modified';
                            rowCopy._errors = validateRow(rowCopy, columns);
                            next[realIdx] = rowCopy;
                        }
                        return next;
                    });
                    setSelectionFocus({ r: endRow, c: selectionBounds.maxCol });
                    notify('sparkle', 'Fill Drag', `Filled down across ${endRow - startRow + 1} rows`);
                }
            }

            setIsMouseDown(false);
            setIsFillDragging(false);
            setFillDragTargetRow(null);
        };

        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [
        isFillDragging,
        fillDragTargetRow,
        selectionBounds,
        columns,
        primaryKey,
        pushUndoState,
        notify
    ]);

    // Global click outside to clear selection / dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                e.target.closest('.z-\\[6000\\]') ||
                e.target.closest('.z-\\[7000\\]') ||
                e.target.closest('.z-\\[9999\\]') ||
                e.target.closest('[data-context-menu="true"]') ||
                e.target.closest('[role="dialog"]')
            ) {
                return;
            }
            if (!e.target.closest('td[data-excel-cell="true"]') && !e.target.closest('input')) {
                setSelectionAnchor(null);
                setSelectionFocus(null);
                setEditingCell(null);
                setActiveDropdownCell(null);
                setDropdownPortalProps(null);
                setContextMenu(null);
            }
        };

        const handleEscapeKey = (e) => {
            if (e.key === 'Escape') {
                setCopiedBounds(null);
                setContextMenu(null);
                if (!editingCell) {
                    setSelectionAnchor(null);
                    setSelectionFocus(null);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleEscapeKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleEscapeKey);
        };
    }, [editingCell]);

    // High performance viewport auto-scroll to focused cell
    useEffect(() => {
        if (selectionFocus && sortedGridDataRef.current && sortedGridDataRef.current[selectionFocus.r]) {
            const col = columns[selectionFocus.c];
            if (col) {
                const cellEl = document.getElementById(`excel-cell-${selectionFocus.r}-${col.key}`);
                if (cellEl) {
                    if (document.activeElement !== cellEl && !editingCell) {
                        cellEl.focus({ preventScroll: true });
                    }
                    const container = cellEl.closest('.overflow-auto');
                    if (container) {
                        const cellRect = cellEl.getBoundingClientRect();
                        const containerRect = container.getBoundingClientRect();
                        if (cellRect.top < containerRect.top + 32) {
                            container.scrollTop -= containerRect.top + 32 - cellRect.top;
                        } else if (cellRect.bottom > containerRect.bottom - 12) {
                            container.scrollTop += cellRect.bottom - (containerRect.bottom - 12);
                        }
                        if (cellRect.left < containerRect.left + 50) {
                            container.scrollLeft -= containerRect.left + 50 - cellRect.left;
                        } else if (cellRect.right > containerRect.right - 50) {
                            container.scrollLeft += cellRect.right - (containerRect.right - 50);
                        }
                    }
                }
            }
        }
    }, [selectionFocus, editingCell, columns]);

    return {
        gridData,
        setGridData,
        sortedGridData,
        paginatedGridData,
        originalDataMap,
        deletedIds,
        setDeletedIds,

        // Selection & Editing
        selectionAnchor,
        setSelectionAnchor,
        selectionFocus,
        setSelectionFocus,
        selectionBounds,
        copiedBounds,
        setCopiedBounds,
        isMouseDown,
        setIsMouseDown,
        isFillDragging,
        setIsFillDragging,
        fillDragTargetRow,
        setFillDragTargetRow,
        editingCell,
        setEditingCell,
        activeDropdownCell,
        setActiveDropdownCell,
        dropdownPortalProps,
        setDropdownPortalProps,

        // Find & Replace + Shortcuts Modals
        isFindReplaceOpen,
        setIsFindReplaceOpen,
        findReplaceMode,
        setFindReplaceMode,
        isShortcutsModalOpen,
        setIsShortcutsModalOpen,

        // Multi Row Selection Checkboxes
        selectedIds,
        setSelectedIds,
        lastSelectedId,
        setLastSelectedId,

        // Table UI Config
        searchTerm,
        setSearchTerm,
        sortConfig,
        setSortConfig,
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
        totalPages,
        customColWidths,
        setCustomColWidths,
        contextMenu,
        setContextMenu,

        // Dirty status & Undo/Redo
        isSavingRef,
        hasUnsavedChanges,
        unsavedCount,
        dirtyCounts,
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
        undo,
        redo,
        pushUndoState,

        // Actions
        handleCellMouseDown,
        handleCellMouseEnter,
        handleCellChange,
        handleCellBlur,
        handleCellKeyDown,
        executeCopy,
        executeCut,
        executePaste,
        handleFillDown,
        handleFillRight,
        handleAutoFillDown,
        handleDateStamp,
        handleTimeStamp,
        handleCopyFromAbove,
        handleTransformCase,
        handleReplaceAll,
        handleClearCells,
        handleAddRows,
        handleInsertRow,
        handleDuplicateRow,
        handleDeleteRows,
        handleColumnHeaderDoubleClick
    };
};
