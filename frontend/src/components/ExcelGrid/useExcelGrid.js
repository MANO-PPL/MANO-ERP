import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    parseTSV,
    stringifyTSV,
    cleanClipboardText,
    getSelectionBounds,
    isCellInBounds,
    validateRow,
    calculateAutoFitWidth,
    generateBatchPayload,
    transformCase,
    getUniqueKeyColumn,
    getRowUniqueValue,
    findDuplicateGroups,
    resolveDropdownValue
} from './excelUtils';
import { customToast } from '../../utils/toast';

// Centralized clipboard and keyboard event handlers


/**
 * Core spreadsheet hook managing grid state, cell selections, undo/redo history,
 * clipboard actions, formula evaluations, and batch modifications.
 */
export const useExcelGrid = ({
    data = [],
    columns = [],
    primaryKey = 'id',
    canWrite = true,
    initialPageSize = 100,
    showToast = null,
    onUndo = null,
    onRedo = null,
    canUndo: externalCanUndo = undefined,
    canRedo: externalCanRedo = undefined,
    onCellChange = null,
    storageKey = null
}) => {
    // Helper to read draft from localStorage
    const loadDraftFromStorage = useCallback(() => {
        if (!storageKey || typeof window === 'undefined') return null;
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        } catch (err) {
            console.warn('Failed to load draft from localStorage:', err);
        }
        return null;
    }, [storageKey]);

    // Helper to clear draft from localStorage
    const clearDraftFromStorage = useCallback(() => {
        if (!storageKey || typeof window === 'undefined') return;
        try {
            window.localStorage.removeItem(storageKey);
        } catch (err) {
            console.warn('Failed to clear draft from localStorage:', err);
        }
    }, [storageKey]);

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

    // 2. Main Grid Data State - Hydrated from localStorage draft if present
    const [gridData, setGridData] = useState(() => {
        const draft = loadDraftFromStorage();
        if (draft) {
            if (Array.isArray(draft.allRows) && draft.allRows.length > 0) {
                return draft.allRows;
            }
            if (Array.isArray(draft.newRows) && draft.newRows.length > 0 && (!data || data.length === 0)) {
                return draft.newRows;
            }
        }
        return (data || []).map((row) => ({
            ...row,
            _status: 'saved',
            _errors: {}
        }));
    });
    const gridDataRef = useRef(gridData);
    gridDataRef.current = gridData;
    const isSavingRef = useRef(false);

    // 3. Deleted IDs Tracking - Hydrated from localStorage draft if present
    const [deletedIds, setDeletedIds] = useState(() => {
        const draft = loadDraftFromStorage();
        if (draft && Array.isArray(draft.deletedIds) && draft.deletedIds.length > 0) {
            return new Set(draft.deletedIds);
        }
        return new Set();
    });
    const deletedIdsRef = useRef(deletedIds);
    deletedIdsRef.current = deletedIds;

    // Synchronize whenever prop data changes
    useEffect(() => {
        setGridData((prevGrid) => {
            if (isSavingRef.current) {
                // When a save completes, data from server is authoritative.
                // Reset to saved rows and clear any lingering temporary rows.
                isSavingRef.current = false;
                deletedIdsRef.current = new Set();
                setDeletedIds(new Set());
                clearDraftFromStorage();
                return (data || []).map((item) => ({
                    ...item,
                    _status: 'saved',
                    _errors: {}
                }));
            }

            // Check if there is an unsaved draft in localStorage or in prevGrid
            const draft = loadDraftFromStorage();
            const draftModifiedMap = new Map();
            const draftNewRows = [];
            const draftDeletedIdSet = new Set(deletedIdsRef.current);

            if (draft) {
                if (Array.isArray(draft.deletedIds)) {
                    draft.deletedIds.forEach((id) => draftDeletedIdSet.add(id));
                }
                if (Array.isArray(draft.modifiedRows)) {
                    draft.modifiedRows.forEach((r) => {
                        if (r && r[primaryKey] !== undefined) {
                            draftModifiedMap.set(String(r[primaryKey]), r);
                        }
                    });
                }
                if (Array.isArray(draft.newRows)) {
                    draft.newRows.forEach((r) => draftNewRows.push(r));
                }
            }

            // Also check prevGrid for any in-memory unsaved rows
            (prevGrid || []).forEach((r) => {
                const idStr = String(r[primaryKey] || '');
                if (r._status === 'modified' || r._status === 'duplicate' || r._status === 'error') {
                    if (!draftModifiedMap.has(idStr)) {
                        draftModifiedMap.set(idStr, r);
                    }
                } else if (r._status === 'new' || idStr.startsWith('temp_')) {
                    if (!draftNewRows.some((nr) => String(nr[primaryKey]) === idStr)) {
                        draftNewRows.push(r);
                    }
                }
            });

            // If incoming data from server is empty and we have draft/prevGrid, preserve it
            if ((!data || data.length === 0) && (prevGrid.length > 0 || draftNewRows.length > 0)) {
                return prevGrid.length > 0 ? prevGrid : draftNewRows;
            }

            // Filter new unsaved rows
            const newUnsaved = draftNewRows.filter((r) => {
                const isTemp = !r[primaryKey] || String(r[primaryKey]).startsWith('temp_') || r._status === 'new';
                if (!isTemp) return false;
                const hasAnyContent = Object.entries(r).some(
                    ([k, v]) => !k.startsWith('_') && k !== primaryKey && v != null && String(v).trim() !== ''
                );
                return hasAnyContent;
            });

            const updatedGrid = (data || [])
                .filter((item) => !draftDeletedIdSet.has(item[primaryKey]) && !draftDeletedIdSet.has(String(item[primaryKey])))
                .map((item) => {
                    const itemKey = String(item[primaryKey]);
                    if (draftModifiedMap.has(itemKey)) {
                        const modRow = draftModifiedMap.get(itemKey);
                        return {
                            ...item,
                            ...modRow,
                            _status: modRow._status || 'modified',
                            _errors: modRow._errors || {},
                            personnel: (Array.isArray(item.personnel) && item.personnel.length > 0)
                                ? item.personnel
                                : modRow.personnel
                        };
                    }
                    const isNew = item._status === 'new' || String(item[primaryKey] || '').startsWith('temp_');
                    return {
                        ...item,
                        _status: isNew ? 'new' : (item._status || 'saved'),
                        _errors: item._errors || {}
                    };
                });

            return [...updatedGrid, ...newUnsaved];
        });
    }, [data, primaryKey, loadDraftFromStorage, clearDraftFromStorage]);
    deletedIdsRef.current = deletedIds;

    // 4. Undo / Redo Stacks
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const cellEditInitialStateRef = useRef(null);
    const [historyVersion, setHistoryVersion] = useState(0);
    const [undoVersion, setUndoVersion] = useState(0);
    const lastUndoTimeRef = useRef(0);
    const lastRedoTimeRef = useRef(0);

    const pushUndoState = useCallback((currentGrid) => {
        if (!currentGrid) return;
        const snapshot = {
            grid: currentGrid.map((r) => ({
                ...r,
                _errors: r._errors ? { ...r._errors } : {}
            })),
            deletedIds: new Set(deletedIdsRef.current)
        };
        undoStackRef.current.push(snapshot);
        if (undoStackRef.current.length > 80) undoStackRef.current.shift();
        redoStackRef.current = [];
        setHistoryVersion((v) => v + 1);
        setUndoVersion((v) => v + 1);
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
    const editingCellRef = useRef(null);
    editingCellRef.current = editingCell;
    const activeEditorValueRef = useRef(undefined);
    const [activeDropdownCell, setActiveDropdownCell] = useState(null);
    const [dropdownPortalProps, setDropdownPortalProps] = useState(null);

    // 7. Modals State
    const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
    const [findReplaceMode, setFindReplaceMode] = useState('find');
    const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

    // 8. Clipboard Buffer Ref
    const internalClipboardRef = useRef('');
    const internalClipboardRowsRef = useRef([]);
    const lastPasteHandledTimestampRef = useRef(0);
    const lastNavEventRef = useRef({ time: 0, key: '' });

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
            row._status === 'new' ||
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

    
    const prevPageRef = useRef(currentPage);
    const prevFocusRowRef = useRef(selectionFocus?.r);

    // Synchronize currentPage and selectionFocus so focused cell is always rendered in UI
    useEffect(() => {
        if (pageSize === 'All') {
            prevPageRef.current = 1;
            prevFocusRowRef.current = selectionFocus?.r;
            return;
        }

        const size = Number(pageSize);
        if (!size || size <= 0) return;

        const currentFocusRow = selectionFocus?.r;
        const pageChanged = currentPage !== prevPageRef.current;
        const focusRowChanged = typeof currentFocusRow === 'number' && currentFocusRow !== prevFocusRowRef.current;

        if (focusRowChanged) {
            const targetPage = Math.floor(currentFocusRow / size) + 1;
            if (targetPage >= 1 && targetPage <= totalPages && targetPage !== currentPage) {
                setCurrentPage(targetPage);
                prevPageRef.current = targetPage;
            }
            prevFocusRowRef.current = currentFocusRow;
        } else if (pageChanged) {
            prevPageRef.current = currentPage;
            if (typeof currentFocusRow === 'number') {
                const minRow = (currentPage - 1) * size;
                const maxRow = Math.min(sortedGridData.length - 1, minRow + size - 1);
                if (maxRow >= minRow && (currentFocusRow < minRow || currentFocusRow > maxRow)) {
                    const newRow = minRow;
                    const newFocus = { r: newRow, c: selectionFocus?.c ?? 0 };
                    selectionFocusRef.current = newFocus;
                    setSelectionFocus(newFocus);
                    if (selectionAnchorRef.current) {
                        selectionAnchorRef.current = newFocus;
                        setSelectionAnchor(newFocus);
                    }
                    prevFocusRowRef.current = newRow;
                }
            }
        }
    }, [selectionFocus?.r, selectionFocus?.c, currentPage, pageSize, totalPages, sortedGridData.length]);

    // Clamp selection focus if dataset shrinks
    useEffect(() => {
        if (sortedGridData.length === 0) {
            if (selectionFocus) {
                selectionFocusRef.current = null;
                setSelectionFocus(null);
                selectionAnchorRef.current = null;
                setSelectionAnchor(null);
            }
            return;
        }
        if (selectionFocus && selectionFocus.r >= sortedGridData.length) {
            const clampedRow = sortedGridData.length - 1;
            const newFocus = { r: clampedRow, c: selectionFocus.c };
            selectionFocusRef.current = newFocus;
            setSelectionFocus(newFocus);
            if (selectionAnchor) {
                selectionAnchorRef.current = newFocus;
                setSelectionAnchor(newFocus);
            }
            prevFocusRowRef.current = clampedRow;
        }
    }, [sortedGridData.length]);

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

    // Auto-save draft to browser localStorage across page refreshes
    useEffect(() => {
        if (!storageKey || typeof window === 'undefined') return;
        if (isSavingRef.current) return;

        const timer = setTimeout(() => {
            try {
                const currentData = gridDataRef.current || gridData;
                const curDeleted = deletedIdsRef.current || deletedIds;

                const modifiedRows = [];
                const newRows = [];

                currentData.forEach((row) => {
                    const idStr = String(row[primaryKey] || '');
                    const isNew = row._status === 'new' || idStr.startsWith('temp_');
                    if (isNew) {
                        const hasContent = columns.some(
                            (col) => row[col.key] !== undefined && String(row[col.key]).trim() !== ''
                        );
                        if (hasContent) newRows.push(row);
                    } else if (row._status === 'modified' || row._status === 'duplicate' || row._status === 'error') {
                        modifiedRows.push(row);
                    } else {
                        const original = originalDataMap.get(row[primaryKey]);
                        if (original && isRowDirty(row, original)) {
                            modifiedRows.push(row);
                        }
                    }
                });

                const totalChanges = modifiedRows.length + newRows.length + curDeleted.size;

                if (totalChanges > 0) {
                    const draftPayload = {
                        modifiedRows,
                        newRows,
                        deletedIds: Array.from(curDeleted),
                        allRows: currentData.length <= 1000 ? currentData : undefined,
                        timestamp: Date.now()
                    };
                    window.localStorage.setItem(storageKey, JSON.stringify(draftPayload));
                } else {
                    window.localStorage.removeItem(storageKey);
                }
            } catch (err) {
                console.warn('Failed to auto-save spreadsheet draft to localStorage:', err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [gridData, deletedIds, storageKey, primaryKey, columns, originalDataMap, isRowDirty]);

    // Discard local draft and reset to database data
    const discardDraft = useCallback(() => {
        clearDraftFromStorage();
        deletedIdsRef.current = new Set();
        setDeletedIds(new Set());
        setGridData((data || []).map((item) => ({
            ...item,
            _status: 'saved',
            _errors: {}
        })));
        if (showToast) {
            showToast('info', 'Draft Discarded', 'Reverted unsaved changes to cloud data');
        } else {
            customToast.info('Reverted unsaved changes to cloud data', 'Draft Discarded');
        }
    }, [clearDraftFromStorage, data, showToast]);

    // Helper to focus active cell DOM element
    const focusCellElement = useCallback(
        (r, c) => {
            if (r == null || c == null) return;
            const col = columns[c];
            if (!col) return;
            const cellId = `excel-cell-${r}-${col.key}`;
            const cellEl = document.getElementById(cellId);
            if (cellEl) {
                try {
                    cellEl.focus({ preventScroll: true });
                    cellEl.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
                } catch {}
            } else {
                setTimeout(() => {
                    const fallbackEl = document.getElementById(cellId);
                    if (fallbackEl) {
                        try {
                            fallbackEl.focus({ preventScroll: true });
                            fallbackEl.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
                        } catch {}
                    }
                }, 15);
            }
        },
        [columns]
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
        (rowIndex, colKey, value, isAtomic = false, explicitRowId = null) => {
            if (!canWrite) return;
            const targetRowObj =
                (explicitRowId != null ? gridDataRef.current.find((r) => String(r[primaryKey]) === String(explicitRowId)) : null) ||
                sortedGridDataRef.current[rowIndex] ||
                gridDataRef.current[rowIndex];
            if (!targetRowObj) return;

            if (isAtomic) {
                pushUndoState(gridDataRef.current);
            }

            // Immediately synchronize gridDataRef so that direct save or commit reads the updated value
            const realIdx = gridDataRef.current.findIndex(
                (r) => String(r[primaryKey]) === String(targetRowObj[primaryKey])
            );
            const uniqueKeyCol = getUniqueKeyColumn(columns);
            const targetCol = columns.find((c) => c.key === colKey || c.accessor === colKey);
            const isCodeCol = colKey === 'code' || colKey === 'item_code' || colKey === 'resource_code' || targetCol?.label?.toLowerCase().includes('code');
            const isUniqueCol = isCodeCol || targetCol?.unique === true || targetCol?.isUnique === true || colKey === uniqueKeyCol;

            const normVal = String(value || '').trim().toLowerCase();
            const duplicateRow = normVal && isUniqueCol ? gridDataRef.current.find(
                (r) =>
                    String(r[primaryKey]) !== String(targetRowObj[primaryKey]) &&
                    String(r[colKey] || '').trim().toLowerCase() === normVal
            ) : null;
            const isDuplicate = Boolean(duplicateRow);

            if (realIdx !== -1) {
                const nextRef = [...gridDataRef.current];
                const updatedRowRef = { ...nextRef[realIdx], [colKey]: value };
                updatedRowRef._errors = validateRow(updatedRowRef, columns, nextRef);
                if (isDuplicate) {
                    const dupLabel = duplicateRow?.name ? ` (${duplicateRow.name})` : '';
                    const errText = isCodeCol
                        ? `Resource code already exists: "${value}"${dupLabel}. Resource code must be strictly unique. Please change it.`
                        : `Data already exists: "${value}" is already present in this sheet`;
                    updatedRowRef._errors = {
                        ...(updatedRowRef._errors || {}),
                        [colKey]: errText
                    };
                    updatedRowRef._status = 'duplicate';
                } else if (updatedRowRef._status === 'duplicate') {
                    const hasOtherDup = Boolean(
                        updatedRowRef._errors && Object.values(updatedRowRef._errors).some(msg =>
                            typeof msg === 'string' && (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('strictly unique'))
                        )
                    );
                    if (!hasOtherDup) {
                        updatedRowRef._status = String(updatedRowRef[primaryKey]).startsWith('temp_') ? 'new' : 'modified';
                    }
                } else if (updatedRowRef._status !== 'new' && !String(updatedRowRef[primaryKey]).startsWith('temp_')) {
                    updatedRowRef._status = 'modified';
                }
                nextRef[realIdx] = updatedRowRef;
                gridDataRef.current = nextRef;
            }

            setGridData((prevGrid) => {
                const realIdx = prevGrid.findIndex((r) => String(r[primaryKey]) === String(targetRowObj[primaryKey]));
                if (realIdx === -1) return prevGrid;

                const next = [...prevGrid];
                const updatedRow = { ...next[realIdx], [colKey]: value };

                updatedRow._errors = validateRow(updatedRow, columns, next);
                if (isDuplicate) {
                    const dupLabel = duplicateRow?.name ? ` (${duplicateRow.name})` : '';
                    const errText = isCodeCol
                        ? `Resource code already exists: "${value}"${dupLabel}. Resource code must be strictly unique. Please change it.`
                        : `Data already exists: "${value}" is already present in this sheet`;
                    updatedRow._errors = {
                        ...(updatedRow._errors || {}),
                        [colKey]: errText
                    };
                    updatedRow._status = 'duplicate';
                } else if (updatedRow._status === 'duplicate') {
                    const hasOtherDup = Boolean(
                        updatedRow._errors && Object.values(updatedRow._errors).some(msg =>
                            typeof msg === 'string' && (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('strictly unique'))
                        )
                    );
                    if (!hasOtherDup) {
                        updatedRow._status = String(updatedRow[primaryKey]).startsWith('temp_') ? 'new' : 'modified';
                    }
                } else if (updatedRow._status !== 'new' && !String(updatedRow[primaryKey]).startsWith('temp_')) {
                    updatedRow._status = 'modified';
                }

                next[realIdx] = updatedRow;
                return next;
            });

            if (onCellChange && typeof onCellChange === 'function') {
                onCellChange(rowIndex, colKey, value, isAtomic, targetRowObj);
            }
        },
        [canWrite, primaryKey, columns, pushUndoState, onCellChange]
    );

    const [activeEditorValue, setActiveEditorValue] = useState(undefined);
    const handleEditorValueChange = useCallback((val) => {
        activeEditorValueRef.current = val;
        setActiveEditorValue(val);
    }, []);

    const commitEditingCell = useCallback(
        (overrideVal) => {
            const curEdit = editingCellRef.current;
            if (!curEdit) return;

            let valToCommit = overrideVal;
            if (valToCommit === undefined && activeEditorValueRef.current !== undefined) {
                valToCommit = activeEditorValueRef.current;
            }
            if (valToCommit === undefined) {
                const activeInput = document.activeElement;
                if (
                    activeInput &&
                    (activeInput.tagName === 'INPUT' ||
                        activeInput.tagName === 'TEXTAREA' ||
                        activeInput.tagName === 'SELECT')
                ) {
                    valToCommit = activeInput.value;
                }
            }

            if (valToCommit !== undefined) {
                const targetRow =
                    (curEdit.rowId != null ? gridDataRef.current.find((r) => String(r[primaryKey]) === String(curEdit.rowId)) : null) ||
                    sortedGridDataRef.current[curEdit.rowIndex] ||
                    gridDataRef.current[curEdit.rowIndex];
                const oldVal = targetRow ? targetRow[curEdit.colKey] : undefined;

                // Duplicate Check on unique/identifying column (including resource code)
                const uniqueKeyCol = getUniqueKeyColumn(columns);
                const colDef = columns.find((c) => c.key === curEdit.colKey || c.accessor === curEdit.colKey);
                const isCodeCol = curEdit.colKey === 'code' || curEdit.colKey === 'item_code' || curEdit.colKey === 'resource_code' || colDef?.label?.toLowerCase().includes('code');
                const isUniqueCol = isCodeCol || colDef?.unique === true || colDef?.isUnique === true || curEdit.colKey === uniqueKeyCol;

                if (isUniqueCol) {
                    const trimmedVal = String(valToCommit || '').trim();
                    if (trimmedVal) {
                        const norm = trimmedVal.toLowerCase();
                        const curRowId = curEdit.rowId != null ? curEdit.rowId : targetRow?.[primaryKey];
                        const duplicateRow = gridDataRef.current.find(
                            (r) =>
                                String(r[primaryKey]) !== String(curRowId) &&
                                String(r[curEdit.colKey] || '').trim().toLowerCase() === norm
                        );
                        if (duplicateRow) {
                            const isCode = isCodeCol;
                            const title = isCode ? 'Resource Code Already Exists' : 'Duplicate Entry';
                            const msg = isCode
                                ? `Resource code already exists: "${trimmedVal}"${duplicateRow.name ? ` (${duplicateRow.name})` : ''}. Resource code must be strictly unique. Please change it.`
                                : `Data already exists! A record with "${trimmedVal}" is already present in this sheet. Please change it.`;

                            notify('error', title, msg);
                            customToast.error(msg, title);
                        }
                    }
                }

                if (String(oldVal ?? '') !== String(valToCommit ?? '')) {
                    pushUndoState(cellEditInitialStateRef.current || gridDataRef.current);
                }
                handleCellChange(curEdit.rowIndex, curEdit.colKey, valToCommit, false, curEdit.rowId);
            }

            editingCellRef.current = null;
            activeEditorValueRef.current = undefined;
            setActiveEditorValue(undefined);
            setEditingCell(null);
            cellEditInitialStateRef.current = null;
        },
        [handleCellChange, pushUndoState, primaryKey, columns, notify]
    );


    const handleStartEditing = useCallback(
        (rowIndex, colKey, initialChar = undefined) => {
            if (!canWrite) return;
            const col = columns.find((c) => c.key === colKey);
            if (col?.readOnly) return;

            if (editingCellRef.current) {
                commitEditingCell();
            }

            cellEditInitialStateRef.current = gridDataRef.current.map((r) => ({
                ...r,
                _errors: r._errors ? { ...r._errors } : {}
            }));

            const targetRow = sortedGridDataRef.current[rowIndex] || gridDataRef.current[rowIndex];
            const curVal = targetRow ? (targetRow[colKey] ?? '') : '';
            const startVal = initialChar !== undefined ? initialChar : curVal;
            const isDirectTyping = initialChar !== undefined;

            activeEditorValueRef.current = startVal;
            const editObj = {
                rowIndex,
                colKey,
                rowId: targetRow?.[primaryKey],
                initialValue: startVal,
                isDirectTyping
            };
            editingCellRef.current = editObj;
            setEditingCell(editObj);

            if (initialChar !== undefined) {
                handleCellChange(rowIndex, colKey, initialChar, false, targetRow?.[primaryKey]);
            }
        },
        [canWrite, columns, commitEditingCell, handleCellChange, primaryKey]
    );

    const handleCellBlur = useCallback(
        (overrideVal) => {
            commitEditingCell(overrideVal);
        },
        [commitEditingCell]
    );

    // Mouse Cell Selection & Drag Handlers
    const handleCellMouseDown = useCallback(
        (rowIndex, colIndex, isShift = false, isCtrl = false) => {
            if (editingCellRef.current) {
                const curEdit = editingCellRef.current;
                const curColIdx = columns.findIndex((c) => c.key === curEdit.colKey);
                if (curEdit.rowIndex !== rowIndex || curColIdx !== colIndex) {
                    commitEditingCell();
                }
            }

            if (!isShift && !isCtrl && selectedIdsRef.current.size > 0) {
                setSelectedIds(new Set());
            }
            if (isShift && selectionAnchorRef.current) {
                selectionFocusRef.current = { r: rowIndex, c: colIndex };
                setSelectionFocus({ r: rowIndex, c: colIndex });
            } else {
                selectionAnchorRef.current = { r: rowIndex, c: colIndex };
                selectionFocusRef.current = { r: rowIndex, c: colIndex };
                setSelectionAnchor({ r: rowIndex, c: colIndex });
                setSelectionFocus({ r: rowIndex, c: colIndex });
                setIsMouseDown(true);
            }
            focusCellElement(rowIndex, colIndex);
        },
        [columns, commitEditingCell, focusCellElement]
    );

    const handleCellMouseEnter = useCallback(
        (rowIndex, colIndex) => {
            if (isFillDragging) {
                setFillDragTargetRow(rowIndex);
            } else if (isMouseDown) {
                selectionFocusRef.current = { r: rowIndex, c: colIndex };
                setSelectionFocus({ r: rowIndex, c: colIndex });
            }
        },
        [isFillDragging, isMouseDown]
    );

    // 14. Excel Shortcuts & Actions

    // Helper to get formatted pure text TSV matrix and row objects for the current selection
    const getSelectedDataMatrix = useCallback(() => {
        let bounds = getBoundsFromRefs();
        const curSelectedIds = selectedIdsRef.current;
        const focus = selectionFocusRef.current;
        const curEdit = editingCellRef.current;

        let rowsToCopy = [];
        let minCol = 0;
        let maxCol = columns.length - 1;

        if (!bounds && focus) {
            bounds = { minRow: focus.r, maxRow: focus.r, minCol: focus.c, maxCol: focus.c };
        } else if (!bounds && curEdit) {
            const colIdx = columns.findIndex((c) => c.key === curEdit.colKey);
            if (colIdx !== -1) {
                bounds = { minRow: curEdit.rowIndex, maxRow: curEdit.rowIndex, minCol: colIdx, maxCol: colIdx };
            }
        }

        if (bounds) {
            for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                if (sortedGridDataRef.current[r]) rowsToCopy.push(sortedGridDataRef.current[r]);
            }
            minCol = bounds.minCol;
            maxCol = bounds.maxCol;
            setCopiedBounds(bounds);
        } else if (curSelectedIds.size > 0) {
            rowsToCopy = sortedGridDataRef.current.filter((r) => curSelectedIds.has(r[primaryKey]));
        }

        if (rowsToCopy.length === 0) return { matrix: [], tsvData: '', rowsToCopy: [], cellCount: 0 };

        const matrix = rowsToCopy.map((rowObj) => {
            const rowVals = [];
            for (let c = minCol; c <= maxCol; c++) {
                const colKey = columns[c]?.key;
                const rawVal = colKey ? rowObj[colKey] : '';
                let cellText = '';
                if (rawVal !== undefined && rawVal !== null) {
                    if (typeof rawVal === 'object') {
                        cellText = rawVal.value !== undefined ? String(rawVal.value) : (rawVal.code !== undefined ? String(rawVal.code) : (rawVal.name || ''));
                    } else {
                        cellText = String(rawVal);
                    }
                }
                rowVals.push(cleanClipboardText(cellText));
            }
            return rowVals;
        });

        const tsvData = stringifyTSV(matrix);
        const cellCount = matrix.length * (maxCol - minCol + 1);
        return { matrix, tsvData, rowsToCopy, cellCount };
    }, [columns, primaryKey, getBoundsFromRefs]);

    // Copy to Clipboard (TSV)
    const executeCopy = useCallback(() => {
        const { tsvData, rowsToCopy, cellCount } = getSelectedDataMatrix();
        if (!tsvData) return;

        internalClipboardRef.current = tsvData;
        window.__manoExcelClipboard = tsvData;
        internalClipboardRowsRef.current = rowsToCopy.map((r) => JSON.parse(JSON.stringify(r)));
        window.__manoExcelClipboardRows = internalClipboardRowsRef.current;
        try {
            sessionStorage.setItem('__manoExcelClipboard', tsvData);
            sessionStorage.setItem('__manoExcelClipboardRows', JSON.stringify(internalClipboardRowsRef.current));
        } catch {}

        const curFocus = selectionFocusRef.current || selectionAnchorRef.current;

        // 1. Synchronous clipboard copy within user gesture
        try {
            const textArea = document.createElement('textarea');
            textArea.value = tsvData;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            textArea.style.opacity = '0';
            textArea.setAttribute('readonly', '');
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        } catch (err) {
            console.warn('execCommand copy fallback error:', err);
        }

        // 2. Modern async clipboard API in parallel
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(tsvData).catch(() => {});
        }

        if (curFocus) {
            focusCellElement(curFocus.r, curFocus.c);
        }

        notify(
            'sparkle',
            'Copied',
            cellCount === 1 ? 'Copied 1 cell to clipboard' : `Copied ${cellCount} cells to clipboard`
        );
    }, [getSelectedDataMatrix, focusCellElement, notify]);

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
                    textToPaste = window.__manoExcelClipboard || sessionStorage.getItem('__manoExcelClipboard') || internalClipboardRef.current;
                }
            }
            if (!textToPaste) {
                textToPaste = window.__manoExcelClipboard || sessionStorage.getItem('__manoExcelClipboard') || internalClipboardRef.current;
            }

            textToPaste = cleanClipboardText(textToPaste);

            if (!textToPaste || !textToPaste.trim()) {
                notify('info', 'Clipboard', 'Clipboard is empty');
                return;
            }

            const parsedRows = parseTSV(textToPaste);
            if (parsedRows.length === 0) return;

            pushUndoState(gridDataRef.current);
            setCopiedBounds(null);
            if (editingCellRef.current) {
                commitEditingCell();
            }

            let startRow = 0;
            let startCol = 0;
            const bounds = getBoundsFromRefs();
            const curSelectedIds = selectedIdsRef.current;
            const focus = selectionFocusRef.current;
            const curEdit = editingCellRef.current;

            if (forcedStartRow !== undefined && forcedStartCol !== undefined) {
                const isInsideSelection = bounds &&
                    forcedStartRow >= bounds.minRow && forcedStartRow <= bounds.maxRow &&
                    forcedStartCol >= bounds.minCol && forcedStartCol <= bounds.maxCol &&
                    (bounds.maxRow > bounds.minRow || bounds.maxCol > bounds.minCol);

                if (isInsideSelection) {
                    startRow = bounds.minRow;
                    startCol = bounds.minCol;
                } else {
                    startRow = forcedStartRow;
                    startCol = forcedStartCol;
                }
            } else if (focus) {
                startRow = focus.r;
                startCol = focus.c;
            } else if (curEdit) {
                startRow = curEdit.rowIndex;
                const colIdx = columns.findIndex((c) => c.key === curEdit.colKey);
                startCol = colIdx !== -1 ? colIdx : 0;
            } else if (bounds) {
                startRow = bounds.minRow;
                startCol = bounds.minCol;
            } else if (selectionAnchorRef.current) {
                startRow = selectionAnchorRef.current.r;
                startCol = selectionAnchorRef.current.c;
            } else if (curSelectedIds.size > 0) {
                const firstSelectedId = Array.from(curSelectedIds)[0];
                const foundIdx = sortedGridDataRef.current.findIndex((r) => r[primaryKey] === firstSelectedId);
                if (foundIdx !== -1) startRow = foundIdx;
                startCol = 0;
            }

            // Smart Excel Range Replication
            let expandedRows = parsedRows;
            if (
                bounds &&
                (bounds.maxRow > bounds.minRow || bounds.maxCol > bounds.minCol)
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
            let skippedDuplicatesCount = 0;
            const pastedDuplicateCodes = [];

            const uniqueKeyCol = getUniqueKeyColumn(columns);
            const existingUniqueKeys = new Set(
                gridDataRef.current
                    .map((row) => getRowUniqueValue(row, uniqueKeyCol))
                    .filter(Boolean)
            );
            const existingCodes = new Set(
                gridDataRef.current
                    .map((row) => String(row.code || '').trim().toLowerCase())
                    .filter(Boolean)
            );

            setGridData((prevGrid) => {
                const next = [...prevGrid];

                const savedCopiedRows = internalClipboardRowsRef.current?.length
                    ? internalClipboardRowsRef.current
                    : window.__manoExcelClipboardRows || [];

                expandedRows.forEach((cells, dr) => {
                    const r = startRow + dr;
                    const targetRowObj = sortedGridDataRef.current[r];
                    const sourceCopiedRow = savedCopiedRows.length
                        ? savedCopiedRows[dr % savedCopiedRows.length]
                        : null;

                    if (targetRowObj) {
                        const realIdx = next.findIndex((row) => row[primaryKey] === targetRowObj[primaryKey]);
                        if (realIdx !== -1) {
                            const rowCopy = { ...next[realIdx] };
                            let rowModified = false;
                            cells.forEach((cellVal, dc) => {
                                const c = startCol + dc;
                                if (c < columns.length) {
                                    const col = columns[c];
                                    if (col && !col.readOnly) {
                                        let finalVal = cleanClipboardText(cellVal ?? '');
                                        if (col.type === 'number' && finalVal !== '') {
                                            const cleanStr = String(finalVal).replace(/[₹$,\s]/g, '');
                                            const num = Number(cleanStr);
                                            finalVal = isNaN(num) ? finalVal : num;
                                        } else if (col.type === 'checkbox') {
                                            finalVal = finalVal === true || finalVal === 'true' || finalVal === '1';
                                        } else if (col.type === 'select' || col.type === 'searchable-select') {
                                            finalVal = resolveDropdownValue(finalVal, col);
                                        }

                                        const k = (col.key || col.accessor || '').toLowerCase();
                                        if (k === 'code' || k === 'item_code' || k === 'resource_code' || col.unique) {
                                            const norm = String(finalVal || '').trim().toLowerCase();
                                            if (norm) {
                                                const hasCollision = next.some(
                                                    (otherRow, oIdx) => oIdx !== realIdx && String(otherRow[col.key] || '').trim().toLowerCase() === norm
                                                );
                                                if (hasCollision) {
                                                    pastedDuplicateCodes.push(String(finalVal).trim());
                                                }
                                            }
                                        }

                                        rowCopy[col.key] = finalVal;
                                        numCellsUpdated++;
                                        rowModified = true;
                                    }
                                }
                            });

                            // ONLY pasted cells are modified in existing rows;
                            // never alter other corresponding fields (like type, compositions, conversions)
                            if (rowModified) {
                                rowCopy._errors = validateRow(rowCopy, columns, next);
                                const isDup = Boolean(
                                    rowCopy._errors && Object.values(rowCopy._errors).some(msg =>
                                        typeof msg === 'string' && (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('strictly unique'))
                                    )
                                );
                                if (isDup) {
                                    rowCopy._status = 'duplicate';
                                    if (rowCopy.code) pastedDuplicateCodes.push(String(rowCopy.code).trim());
                                } else if (rowCopy._status !== 'new') {
                                    rowCopy._status = 'modified';
                                }
                                next[realIdx] = rowCopy;
                            }
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
                                    let finalVal = cleanClipboardText(cellVal ?? '');
                                    if (col.type === 'number' && finalVal !== '') {
                                        const cleanStr = String(finalVal).replace(/[₹$,\s]/g, '');
                                        const num = Number(cleanStr);
                                        finalVal = isNaN(num) ? finalVal : num;
                                    } else if (col.type === 'checkbox') {
                                        finalVal = finalVal === true || finalVal === 'true' || finalVal === '1';
                                    } else if (col.type === 'select' || col.type === 'searchable-select') {
                                        finalVal = resolveDropdownValue(finalVal, col);
                                    }
                                    newRow[col.key] = finalVal;
                                    numCellsUpdated++;
                                }
                            }
                        });

                        // Only transfer whole-row recipe/conversion metadata if an entire row was copied
                        const isFullRowCopy = cells.length >= columns.length;
                        if (sourceCopiedRow && isFullRowCopy) {
                            const isSourceItem = String(sourceCopiedRow.type || '').toLowerCase() === 'item';
                            if (isSourceItem && (!newRow.type || newRow.type === 'material')) {
                                newRow.type = 'item';
                            }
                            const isTargetItem = String(newRow.type || '').toLowerCase() === 'item';
                            if ((isTargetItem || isSourceItem) && Array.isArray(sourceCopiedRow.compositions) && sourceCopiedRow.compositions.length > 0) {
                                newRow.compositions = JSON.parse(JSON.stringify(sourceCopiedRow.compositions));
                            }
                            if (Array.isArray(sourceCopiedRow.conversions) && sourceCopiedRow.conversions.length > 0) {
                                newRow.conversions = JSON.parse(JSON.stringify(sourceCopiedRow.conversions));
                            }
                        }

                        // Ensure unique name on new row if identifying column collides
                        const newNorm = getRowUniqueValue(newRow, uniqueKeyCol);
                        if (newNorm && existingUniqueKeys.has(newNorm)) {
                            let candidate = newRow[uniqueKeyCol] || '';
                            let copyIdx = 1;
                            let suffixed = `${candidate} (Copy)`;
                            while (existingUniqueKeys.has(suffixed.trim().toLowerCase())) {
                                copyIdx++;
                                suffixed = `${candidate} (Copy ${copyIdx})`;
                            }
                            newRow[uniqueKeyCol] = suffixed;
                            existingUniqueKeys.add(suffixed.trim().toLowerCase());
                        } else if (newNorm) {
                            existingUniqueKeys.add(newNorm);
                        }

                        if (newRow.code && String(newRow.code).trim()) {
                            const normCode = String(newRow.code).trim().toLowerCase();
                            if (existingCodes.has(normCode)) {
                                pastedDuplicateCodes.push(String(newRow.code).trim());
                            } else {
                                existingCodes.add(normCode);
                            }
                        }

                        newRow._errors = validateRow(newRow, columns, next);
                        const isDup = Boolean(
                            newRow._errors && Object.values(newRow._errors).some(msg =>
                                typeof msg === 'string' && (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('strictly unique'))
                            )
                        );
                        if (isDup) {
                            newRow._status = 'duplicate';
                        }
                        next.push(newRow);
                        newRowsAddedCount++;
                    }
                });

                gridDataRef.current = next;
                return next;
            });

            if (pastedDuplicateCodes.length > 0) {
                const uniqueSamples = [...new Set(pastedDuplicateCodes)].join(', ');
                const alertTitle = 'Resource Code Already Exists';
                const alertMsg = `Resource code already exists: "${uniqueSamples}". Resource code must be strictly unique. Please change it.`;
                notify('error', alertTitle, alertMsg);
                customToast.error(alertMsg, alertTitle);
            }

            if (numCellsUpdated > 0 || newRowsAddedCount > 0) {
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
                    `Pasted ${numCellsUpdated} cell(s)${newRowsAddedCount > 0 ? ` (${newRowsAddedCount} new row${newRowsAddedCount > 1 ? 's' : ''})` : ''}`
                );
            }
        },
        [canWrite, columns, primaryKey, getBoundsFromRefs, pushUndoState, notify]
    );

    // High-reliability paste handler across single/multi cells
    const handlePasteAction = useCallback(
        async (pastedText = null, forcedStartRow = undefined, forcedStartCol = undefined) => {
            if (!canWrite) return;
            let text = pastedText;
            if (!text) {
                try {
                    if (navigator.clipboard && navigator.clipboard.readText) {
                        text = await navigator.clipboard.readText();
                    }
                } catch {}
            }
            if (!text) {
                text = window.__manoExcelClipboard || sessionStorage.getItem('__manoExcelClipboard') || internalClipboardRef.current;
            }

            if (text) {
                lastPasteHandledTimestampRef.current = Date.now();
                if (editingCellRef.current) {
                    commitEditingCell();
                }
                await executePaste(text, forcedStartRow, forcedStartCol);
                const curFocus = selectionFocusRef.current || selectionAnchorRef.current;
                const r = forcedStartRow !== undefined ? forcedStartRow : curFocus?.r;
                const c = forcedStartCol !== undefined ? forcedStartCol : curFocus?.c;
                if (r != null && c != null) {
                    focusCellElement(r, c);
                }
            } else {
                notify('info', 'Clipboard', 'Clipboard is empty');
            }
        },
        [canWrite, executePaste, commitEditingCell, focusCellElement, notify]
    );

    const triggerPasteWithTrap = handlePasteAction;

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
        const now = performance.now();
        if (now - lastUndoTimeRef.current < 200) {
            return;
        }
        lastUndoTimeRef.current = now;
        if (editingCellRef.current) {
            editingCellRef.current = null;
            activeEditorValueRef.current = undefined;
            setActiveEditorValue(undefined);
            setEditingCell(null);
            cellEditInitialStateRef.current = null;
        }
        if (undoStackRef.current.length === 0) return;
        const previousSnapshot = undoStackRef.current.pop();

        redoStackRef.current.push({
            grid: gridDataRef.current.map((r) => ({
                ...r,
                _errors: r._errors ? { ...r._errors } : {}
            })),
            deletedIds: new Set(deletedIdsRef.current)
        });

        if (previousSnapshot && previousSnapshot.grid) {
            setGridData(previousSnapshot.grid);
            setDeletedIds(new Set(previousSnapshot.deletedIds || []));
        } else if (Array.isArray(previousSnapshot)) {
            setGridData(previousSnapshot);
        }
        setHistoryVersion((v) => v + 1);
        notify('info', 'Undo', 'Reverted last change');

        const curFocus = selectionFocusRef.current;
        if (curFocus) {
            focusCellElement(curFocus.r, curFocus.c);
        }
    }, [notify, focusCellElement]);

    const redo = useCallback(() => {
        const now = performance.now();
        if (now - lastRedoTimeRef.current < 200) {
            return;
        }
        lastRedoTimeRef.current = now;
        if (editingCellRef.current) {
            editingCellRef.current = null;
            activeEditorValueRef.current = undefined;
            setActiveEditorValue(undefined);
            setEditingCell(null);
            cellEditInitialStateRef.current = null;
        }
        if (redoStackRef.current.length === 0) return;
        const nextSnapshot = redoStackRef.current.pop();

        undoStackRef.current.push({
            grid: gridDataRef.current.map((r) => ({
                ...r,
                _errors: r._errors ? { ...r._errors } : {}
            })),
            deletedIds: new Set(deletedIdsRef.current)
        });

        if (nextSnapshot && nextSnapshot.grid) {
            setGridData(nextSnapshot.grid);
            setDeletedIds(new Set(nextSnapshot.deletedIds || []));
        } else if (Array.isArray(nextSnapshot)) {
            setGridData(nextSnapshot);
        }
        setHistoryVersion((v) => v + 1);
        notify('info', 'Redo', 'Restored change');

        const curFocus = selectionFocusRef.current;
        if (curFocus) {
            focusCellElement(curFocus.r, curFocus.c);
        }
    }, [notify, focusCellElement]);

    // Add Rows
    const handleAddRows = useCallback(
        (count = 1, position = 'bottom') => {
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

            const isBottom = position === 'bottom';
            const targetIdx = isBottom ? gridDataRef.current.length : 0;

            if (isBottom) {
                setGridData((prev) => [...prev, ...newRows]);
            } else {
                setGridData((prev) => [...newRows, ...prev]);
            }

            // Immediately focus and start editing the first editable column of the newly added row
            const firstEditableCol = columns.find((c) => !c.readOnly) || columns[0];
            const firstColIdx = firstEditableCol
                ? columns.findIndex((c) => c.key === firstEditableCol.key)
                : 0;
            const finalColIdx = firstColIdx >= 0 ? firstColIdx : 0;

            if (searchTerm) {
                setSearchTerm('');
            }

            if (isBottom) {
                if (pageSize !== 'All') {
                    const nextTotal = gridDataRef.current.length + count;
                    const lastPage = Math.max(1, Math.ceil(nextTotal / Number(pageSize)));
                    setCurrentPage(lastPage);
                }
            } else {
                setCurrentPage(1);
            }

            setSelectionAnchor({ r: targetIdx, c: finalColIdx });
            setSelectionFocus({ r: targetIdx, c: finalColIdx });

            if (firstEditableCol) {
                setEditingCell({
                    rowIndex: targetIdx,
                    rowId: newRows[0][primaryKey],
                    colKey: firstEditableCol.key
                });
            }

            notify('info', 'Rows Added', `Added ${count} new draft row(s)`);
        },
        [columns, primaryKey, pushUndoState, notify, searchTerm, pageSize]
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
                setEditingCell({
                    rowIndex: insertIdx,
                    rowId: newRow[primaryKey],
                    colKey: firstEditableCol.key
                });
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
            if (Array.isArray(row?.compositions)) {
                clone.compositions = JSON.parse(JSON.stringify(row.compositions));
            }
            if (Array.isArray(row?.conversions)) {
                clone.conversions = JSON.parse(JSON.stringify(row.conversions));
            }

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
            if (!e) return;
            if (e.defaultPrevented || e._excelHandled || (e.nativeEvent && (e.nativeEvent._excelHandled || e.nativeEvent.defaultPrevented))) return;

            const markHandled = (evt) => {
                if (!evt) return;
                evt._excelHandled = true;
                if (evt.nativeEvent) {
                    evt.nativeEvent._excelHandled = true;
                    evt.nativeEvent.stopImmediatePropagation?.();
                }
                evt.stopPropagation?.();
            };

            // Deduplicate rapid duplicate navigation events on the same keypress (within 50ms)
            // (Only for normal grid navigation mode, never inside an active text input editor)
            const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'PageUp', 'PageDown', 'Home', 'End'];
            if (!editingCell && navKeys.includes(e.key)) {
                const now = performance.now();
                if (now - lastNavEventRef.current.time < 50 && lastNavEventRef.current.key === e.key) {
                    markHandled(e);
                    return;
                }
                lastNavEventRef.current = { time: now, key: e.key };
            }

            const colIndex = columns.findIndex((c) => c.key === colKey);
            const totalRows = sortedGridDataRef.current.length;
            const totalCols = columns.length;
            const isModifier = e.ctrlKey || e.metaKey;
            const curEdit = editingCellRef.current;

            // Ctrl + Z: Undo (works seamlessly whether cell is selected or in edit mode)
            if (isModifier && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                markHandled(e);
                if (curEdit) {
                    commitEditingCell();
                }
                if (onUndo) onUndo();
                else undo();
                const focus = selectionFocusRef.current || { r: rowIndex, c: colIndex };
                if (focus) {
                    focusCellElement(focus.r, focus.c);
                }
                return;
            }

            // Ctrl + Y / Ctrl + Shift + Z: Redo (works seamlessly whether cell is selected or in edit mode)
            if (
                (isModifier && e.key.toLowerCase() === 'y') ||
                (isModifier && e.shiftKey && e.key.toLowerCase() === 'z')
            ) {
                e.preventDefault();
                markHandled(e);
                if (curEdit) {
                    commitEditingCell();
                }
                if (onRedo) onRedo();
                else redo();
                const focus = selectionFocusRef.current || { r: rowIndex, c: colIndex };
                if (focus) {
                    focusCellElement(focus.r, focus.c);
                }
                return;
            }

            // Ctrl + C: Copy
            if (isModifier && e.key.toLowerCase() === 'c') {
                const activeElem = document.activeElement;
                const isInput = activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA');
                if (isInput && activeElem.selectionStart !== activeElem.selectionEnd) {
                    return;
                }
                e.preventDefault();
                markHandled(e);
                executeCopy();
                return;
            }

            // Ctrl + X: Cut
            if (isModifier && e.key.toLowerCase() === 'x') {
                const activeElem = document.activeElement;
                const isInput = activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA');
                if (isInput && activeElem.selectionStart !== activeElem.selectionEnd) {
                    return;
                }
                e.preventDefault();
                markHandled(e);
                executeCut();
                return;
            }

            // Ctrl + V: Paste
            if (isModifier && e.key.toLowerCase() === 'v') {
                const activeElem = document.activeElement;
                const isInput = activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA');
                if (isInput && curEdit) {
                    return;
                }
                e.preventDefault();
                markHandled(e);
                const colIdx = columns.findIndex((c) => c.key === colKey);
                handlePasteAction(null, rowIndex, colIdx !== -1 ? colIdx : undefined);
                return;
            }

            // Inside Cell Editing Mode
            if (curEdit?.rowIndex === rowIndex && curEdit?.colKey === colKey) {
                const inputEl = e.target;
                const isInput =
                    inputEl?.tagName?.toLowerCase() === 'input' || inputEl?.tagName?.toLowerCase() === 'textarea';
                const selStart = isInput ? inputEl.selectionStart ?? 0 : 0;
                const selEnd = isInput ? inputEl.selectionEnd ?? 0 : 0;
                const valLen = isInput ? inputEl.value?.length ?? 0 : 0;
                const currentVal = isInput && inputEl ? inputEl.value : activeEditorValueRef.current;

                // Backspace when editing a non-text-input cell (e.g. select dropdown wrapper): clear value
                if (e.key === 'Backspace' && !isInput) {
                    e.preventDefault();
                    markHandled(e);
                    activeEditorValueRef.current = '';
                    handleCellChange(rowIndex, colKey, '', false, curEdit.rowId);
                    return;
                }

                // Direct typing before input is focused
                if (!isInput && e.key.length === 1 && !isModifier && !e.altKey) {
                    const newVal = (activeEditorValueRef.current || '') + e.key;
                    activeEditorValueRef.current = newVal;
                    handleCellChange(rowIndex, colKey, newVal, false, curEdit.rowId);
                    return;
                }

                // Alt+Enter: Insert newline inside multiline text
                if (e.altKey && e.key === 'Enter') {
                    e.preventDefault();
                    markHandled(e);
                    if (isInput) {
                        const start = selStart;
                        const end = selEnd;
                        const val = inputEl.value || '';
                        const newVal = val.substring(0, start) + '\n' + val.substring(end);
                        activeEditorValueRef.current = newVal;
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
                    markHandled(e);
                    const todayStr = new Date().toISOString().slice(0, 10);
                    activeEditorValueRef.current = todayStr;
                    handleCellChange(rowIndex, colKey, todayStr);
                    return;
                }

                // Ctrl+Shift+: : Insert Time Stamp
                if (isModifier && e.shiftKey && (e.key === ';' || e.key === ':')) {
                    e.preventDefault();
                    markHandled(e);
                    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    activeEditorValueRef.current = timeStr;
                    handleCellChange(rowIndex, colKey, timeStr);
                    return;
                }

                // Ctrl+' or Ctrl+" : Copy from cell above
                if (isModifier && (e.key === "'" || e.key === '"')) {
                    e.preventDefault();
                    markHandled(e);
                    handleCopyFromAbove();
                    return;
                }

                // Enter / Shift+Enter
                if (e.key === 'Enter') {
                    e.preventDefault();
                    markHandled(e);
                    commitEditingCell(currentVal);
                    if (!e.shiftKey && rowIndex === totalRows - 1 && canWrite) {
                        handleAddRows(1, 'bottom');
                        return;
                    }
                    const nextRow = e.shiftKey ? Math.max(0, rowIndex - 1) : Math.min(totalRows - 1, rowIndex + 1);
                    selectionAnchorRef.current = { r: nextRow, c: colIndex };
                    selectionFocusRef.current = { r: nextRow, c: colIndex };
                    setSelectionAnchor({ r: nextRow, c: colIndex });
                    setSelectionFocus({ r: nextRow, c: colIndex });
                    focusCellElement(nextRow, colIndex);
                    return;
                }

                // Escape: Cancel edit
                if (e.key === 'Escape') {
                    e.preventDefault();
                    markHandled(e);
                    if (cellEditInitialStateRef.current) {
                        setGridData(cellEditInitialStateRef.current);
                        cellEditInitialStateRef.current = null;
                    }
                    editingCellRef.current = null;
                    activeEditorValueRef.current = undefined;
                    setEditingCell(null);
                    focusCellElement(rowIndex, colIndex);
                    return;
                }

                // Tab / Shift+Tab
                if (e.key === 'Tab') {
                    e.preventDefault();
                    markHandled(e);
                    commitEditingCell(currentVal);
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
                            handleAddRows(1, 'bottom');
                            return;
                        } else {
                            nextCol = totalCols - 1;
                        }
                    }
                    selectionAnchorRef.current = { r: nextRow, c: nextCol };
                    selectionFocusRef.current = { r: nextRow, c: nextCol };
                    setSelectionAnchor({ r: nextRow, c: nextCol });
                    setSelectionFocus({ r: nextRow, c: nextCol });
                    focusCellElement(nextRow, nextCol);
                    return;
                }

                // ArrowUp / ArrowDown while editing
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    markHandled(e);
                    commitEditingCell(currentVal);
                    const targetRow = isModifier ? 0 : Math.max(0, rowIndex - 1);
                    selectionAnchorRef.current = { r: targetRow, c: colIndex };
                    selectionFocusRef.current = { r: targetRow, c: colIndex };
                    setSelectionAnchor({ r: targetRow, c: colIndex });
                    setSelectionFocus({ r: targetRow, c: colIndex });
                    focusCellElement(targetRow, colIndex);
                    return;
                }

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    markHandled(e);
                    commitEditingCell(currentVal);
                    const targetRow = isModifier ? Math.max(0, totalRows - 1) : Math.min(totalRows - 1, rowIndex + 1);
                    selectionAnchorRef.current = { r: targetRow, c: colIndex };
                    selectionFocusRef.current = { r: targetRow, c: colIndex };
                    setSelectionAnchor({ r: targetRow, c: colIndex });
                    setSelectionFocus({ r: targetRow, c: colIndex });
                    focusCellElement(targetRow, colIndex);
                    return;
                }

                // ArrowLeft: If cursor is within text (selStart > 0 and no modifier), allow in-between letter navigation.
                // Otherwise (at left edge selStart === 0, or modifier key, or non-input), commit edit and navigate to cell on left!
                if (e.key === 'ArrowLeft') {
                    if (isInput && !isModifier && selStart > 0) {
                        // Allow natural cursor movement between letters within input
                        return;
                    }

                    // At beginning of text or modifier pressed: commit and move to cell on the left
                    e.preventDefault();
                    markHandled(e);
                    commitEditingCell(currentVal);
                    const targetCol = isModifier ? 0 : Math.max(0, colIndex - 1);
                    selectionAnchorRef.current = { r: rowIndex, c: targetCol };
                    selectionFocusRef.current = { r: rowIndex, c: targetCol };
                    setSelectionAnchor({ r: rowIndex, c: targetCol });
                    setSelectionFocus({ r: rowIndex, c: targetCol });
                    focusCellElement(rowIndex, targetCol);
                    return;
                }

                // ArrowRight: If cursor is within text (selEnd < valLen and no modifier), allow in-between letter navigation.
                // Otherwise (at right edge selEnd === valLen, or modifier key, or non-input), commit edit and navigate to cell on right!
                if (e.key === 'ArrowRight') {
                    if (isInput && !isModifier && selEnd < valLen) {
                        // Allow natural cursor movement between letters within input
                        return;
                    }

                    // At end of text or modifier pressed: commit and move to cell on the right
                    e.preventDefault();
                    markHandled(e);
                    commitEditingCell(currentVal);
                    const targetCol = isModifier ? totalCols - 1 : Math.min(totalCols - 1, colIndex + 1);
                    selectionAnchorRef.current = { r: rowIndex, c: targetCol };
                    selectionFocusRef.current = { r: rowIndex, c: targetCol };
                    setSelectionAnchor({ r: rowIndex, c: targetCol });
                    setSelectionFocus({ r: rowIndex, c: targetCol });
                    focusCellElement(rowIndex, targetCol);
                    return;
                }

                // Home / End: If modifier (Ctrl+Home / Ctrl+End), navigate grid. Otherwise allow cursor jump to line start/end.
                if (e.key === 'Home') {
                    if (isModifier) {
                        e.preventDefault();
                        markHandled(e);
                        commitEditingCell(currentVal);
                        selectionAnchorRef.current = { r: 0, c: 0 };
                        selectionFocusRef.current = { r: 0, c: 0 };
                        setSelectionAnchor({ r: 0, c: 0 });
                        setSelectionFocus({ r: 0, c: 0 });
                        focusCellElement(0, 0);
                        return;
                    }
                    return;
                }

                if (e.key === 'End') {
                    if (isModifier) {
                        e.preventDefault();
                        markHandled(e);
                        commitEditingCell(currentVal);
                        const targetR = Math.max(0, totalRows - 1);
                        const targetC = Math.max(0, totalCols - 1);
                        selectionAnchorRef.current = { r: targetR, c: targetC };
                        selectionFocusRef.current = { r: targetR, c: targetC };
                        setSelectionAnchor({ r: targetR, c: targetC });
                        setSelectionFocus({ r: targetR, c: targetC });
                        focusCellElement(targetR, targetC);
                        return;
                    }
                    return;
                }

                return;
            }

            // Normal Navigation Mode
            const curFocus = selectionFocusRef.current || selectionFocus || (rowIndex != null && colIndex !== -1 ? { r: rowIndex, c: colIndex } : { r: 0, c: 0 });
            const curAnchor = selectionAnchorRef.current || selectionAnchor || (rowIndex != null && colIndex !== -1 ? { r: rowIndex, c: colIndex } : { r: 0, c: 0 });
            const activeBounds = getBoundsFromRefs() || selectionBounds || (curFocus ? { minRow: curFocus.r, maxRow: curFocus.r, minCol: curFocus.c, maxCol: curFocus.c } : null);

            const updateSelection = (anchor, focus) => {
                selectionAnchorRef.current = anchor;
                selectionFocusRef.current = focus;
                setSelectionAnchor(anchor);
                setSelectionFocus(focus);
                if (focus) {
                    focusCellElement(focus.r, focus.c);
                }
            };

            // Backspace: Delete a single character from the cell and keep editing at the end
            if (e.key === 'Backspace') {
                if (canWrite && (activeBounds || curFocus)) {
                    e.preventDefault();
                    markHandled(e);

                    const targetRow = curFocus ? curFocus.r : activeBounds.minRow;
                    const targetColIdx = curFocus ? curFocus.c : activeBounds.minCol;
                    const targetCol = columns[targetColIdx];

                    if (targetCol && !targetCol.readOnly) {
                        pushUndoState(gridDataRef.current);

                        if (targetCol.type === 'checkbox') {
                            const targetRowObj = sortedGridDataRef.current[targetRow] || gridDataRef.current[targetRow];
                            handleCellChange(targetRow, targetCol.key, false, true, targetRowObj?.[primaryKey]);
                            return;
                        }

                        const targetRowObj = sortedGridDataRef.current[targetRow] || gridDataRef.current[targetRow];
                        const curVal = String(targetRowObj ? (targetRowObj[targetCol.key] ?? '') : '');
                        // Remove a single character from the end instead of deleting the whole word
                        const newVal = curVal.length > 0 ? curVal.slice(0, -1) : '';

                        handleStartEditing(targetRow, targetCol.key, newVal);

                        selectionAnchorRef.current = { r: targetRow, c: targetColIdx };
                        selectionFocusRef.current = { r: targetRow, c: targetColIdx };
                        setSelectionAnchor({ r: targetRow, c: targetColIdx });
                        setSelectionFocus({ r: targetRow, c: targetColIdx });
                    }
                    return;
                }
                return;
            }

            // Delete: Clear selected cell(s) contents without entering edit mode, or delete full rows if full rows selected
            if (e.key === 'Delete') {
                if (canWrite && activeBounds) {
                    e.preventDefault();
                    markHandled(e);
                    const isFullRowSelected = activeBounds.minCol === 0 && activeBounds.maxCol === totalCols - 1;
                    if (isFullRowSelected) {
                        const rowsToDelete = [];
                        for (let r = activeBounds.minRow; r <= activeBounds.maxRow; r++) {
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

            // Arrow Keys Navigation
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                markHandled(e);
                const targetRow = isModifier ? 0 : Math.max(0, curFocus.r - 1);
                updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: curFocus.c }, { r: targetRow, c: curFocus.c });
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                markHandled(e);
                const targetRow = isModifier
                    ? Math.max(0, totalRows - 1)
                    : Math.min(Math.max(0, totalRows - 1), curFocus.r + 1);
                updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: curFocus.c }, { r: targetRow, c: curFocus.c });
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                markHandled(e);
                const targetCol = isModifier ? 0 : Math.max(0, curFocus.c - 1);
                updateSelection(e.shiftKey ? curAnchor : { r: curFocus.r, c: targetCol }, { r: curFocus.r, c: targetCol });
                return;
            }

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                markHandled(e);
                const targetCol = isModifier ? totalCols - 1 : Math.min(totalCols - 1, curFocus.c + 1);
                updateSelection(e.shiftKey ? curAnchor : { r: curFocus.r, c: targetCol }, { r: curFocus.r, c: targetCol });
                return;
            }

            // Home / End
            if (e.key === 'Home') {
                e.preventDefault();
                markHandled(e);
                const targetRow = isModifier ? 0 : curFocus.r;
                const targetCol = 0;
                updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: targetCol }, { r: targetRow, c: targetCol });
                return;
            }

            if (e.key === 'End') {
                e.preventDefault();
                markHandled(e);
                const targetRow = isModifier ? Math.max(0, totalRows - 1) : curFocus.r;
                const targetCol = totalCols - 1;
                updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: targetCol }, { r: targetRow, c: targetCol });
                return;
            }

            // PageUp / PageDown
            if (e.key === 'PageUp') {
                e.preventDefault();
                markHandled(e);
                if (e.altKey) {
                    const targetCol = Math.max(0, curFocus.c - 5);
                    updateSelection(e.shiftKey ? curAnchor : { r: curFocus.r, c: targetCol }, { r: curFocus.r, c: targetCol });
                } else {
                    const targetRow = Math.max(0, curFocus.r - 10);
                    updateSelection(e.shiftKey ? curAnchor : { r: targetRow, c: curFocus.c }, { r: targetRow, c: curFocus.c });
                }
                return;
            }

            if (e.key === 'PageDown') {
                e.preventDefault();
                markHandled(e);
                if (e.altKey) {
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
                markHandled(e);
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
                        handleAddRows(1, 'bottom');
                        return;
                    } else {
                        nextCol = totalCols - 1;
                    }
                }
                updateSelection({ r: nextRow, c: nextCol }, { r: nextRow, c: nextCol });
                return;
            }

            // Alt+ArrowDown or Enter: Open Dropdown in Select Cell
            if ((e.altKey && e.key === 'ArrowDown') || e.key === 'Enter') {
                const targetCol = columns[curFocus.c];
                if (targetCol && (targetCol.type === 'select' || targetCol.type === 'searchable-select') && canWrite && !targetCol.readOnly) {
                    e.preventDefault();
                    markHandled(e);
                    handleStartEditing(curFocus.r, targetCol.key);
                    return;
                }
            }

            // Enter / Shift+Enter
            if (e.key === 'Enter') {
                e.preventDefault();
                markHandled(e);
                if (!e.shiftKey && curFocus.r === totalRows - 1 && canWrite) {
                    handleAddRows(1, 'bottom');
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
                    markHandled(e);
                    const bounds = selectionBounds || { minRow: curFocus.r, maxRow: curFocus.r };
                    const newSelectedIds = new Set();
                    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                        const target = sortedGridDataRef.current[r];
                        if (target) newSelectedIds.add(target[primaryKey]);
                    }
                    setSelectedIds(newSelectedIds);
                    selectionAnchorRef.current = { r: bounds.minRow, c: 0 };
                    selectionFocusRef.current = { r: bounds.maxRow, c: totalCols - 1 };
                    setSelectionAnchor({ r: bounds.minRow, c: 0 });
                    setSelectionFocus({ r: bounds.maxRow, c: totalCols - 1 });
                    return;
                }
                if (isModifier && !e.shiftKey) {
                    e.preventDefault();
                    markHandled(e);
                    const bounds = selectionBounds || { minCol: curFocus.c, maxCol: curFocus.c };
                    selectionAnchorRef.current = { r: 0, c: bounds.minCol };
                    selectionFocusRef.current = { r: Math.max(0, totalRows - 1), c: bounds.maxCol };
                    setSelectionAnchor({ r: 0, c: bounds.minCol });
                    setSelectionFocus({ r: Math.max(0, totalRows - 1), c: bounds.maxCol });
                    return;
                }
            }

            // F2: Start Edit
            if (e.key === 'F2') {
                e.preventDefault();
                markHandled(e);
                if (canWrite) {
                    const col = columns[curFocus.c];
                    if (col && !col.readOnly) {
                        handleStartEditing(curFocus.r, col.key);
                    }
                }
                return;
            }

            // Ctrl+; : Insert Date Stamp
            if (canWrite && isModifier && !e.shiftKey && (e.key === ';' || e.key === ':')) {
                e.preventDefault();
                markHandled(e);
                handleDateStamp();
                return;
            }

            // Ctrl+Shift+: : Insert Time Stamp
            if (canWrite && isModifier && e.shiftKey && (e.key === ';' || e.key === ':')) {
                e.preventDefault();
                markHandled(e);
                handleTimeStamp();
                return;
            }

            // Ctrl+' or Ctrl+" : Copy value from cell above
            if (canWrite && isModifier && (e.key === "'" || e.key === '"')) {
                e.preventDefault();
                markHandled(e);
                handleCopyFromAbove();
                return;
            }

            // Ctrl+U: UPPERCASE
            if (canWrite && isModifier && e.key.toLowerCase() === 'u') {
                e.preventDefault();
                markHandled(e);
                handleTransformCase('uppercase');
                return;
            }

            // Ctrl+L: lowercase
            if (canWrite && isModifier && e.key.toLowerCase() === 'l' && !e.shiftKey) {
                e.preventDefault();
                markHandled(e);
                handleTransformCase('lowercase');
                return;
            }

            // Ctrl+K: Title Case
            if (canWrite && isModifier && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                markHandled(e);
                handleTransformCase('titlecase');
                return;
            }

            // Ctrl+H: Open Find & Replace
            if (isModifier && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                markHandled(e);
                setFindReplaceMode('replace');
                setIsFindReplaceOpen(true);
                return;
            }

            // F1: Open Shortcuts Modal
            if (e.key === 'F1') {
                e.preventDefault();
                markHandled(e);
                setIsShortcutsModalOpen(true);
                return;
            }

            // Shift+F10 / ContextMenu
            if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
                e.preventDefault();
                markHandled(e);
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
                const targetCol = columns[curFocus.c];
                if (targetCol && !targetCol.readOnly && targetCol.type !== 'select' && targetCol.type !== 'searchable-select') {
                    markHandled(e);
                    handleStartEditing(curFocus.r, targetCol.key, e.key);
                }
            }
        },
        [
            columns,
            canWrite,
            commitEditingCell,
            handleStartEditing,
            handleCellChange,
            handleAddRows,
            handleDeleteRows,
            handleClearCells,
            handleDateStamp,
            handleTimeStamp,
            handleCopyFromAbove,
            handleTransformCase,
            primaryKey,
            focusCellElement,
            undo,
            redo,
            onUndo,
            onRedo,
            pushUndoState,
            getBoundsFromRefs
        ]
    );

    // Global KeyDown Listener (Copy, Paste, Cut, Undo, Redo, Fill Down/Right, Shortcuts)
    useEffect(() => {
        const handleGlobalKeyDown = async (e) => {
            if (!e) return;
            if (e.defaultPrevented || e._excelHandled || (e.nativeEvent && (e.nativeEvent._excelHandled || e.nativeEvent.defaultPrevented))) return;

            const activeElem = document.activeElement;
            const isTyping =
                activeElem &&
                (activeElem.tagName === 'INPUT' ||
                    activeElem.tagName === 'SELECT' ||
                    activeElem.tagName === 'TEXTAREA');

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            const isGridElement = Boolean(
                activeElem?.closest('td[data-excel-cell="true"]') ||
                activeElem?.closest('[data-excel-grid="true"]') ||
                activeElem?.closest('[data-excel-select-portal="true"]') ||
                activeElem?.closest('table')
            );

            // If user is actively typing in an input field outside the grid:
            if (isTyping && !isGridElement) {
                return;
            }

            // Inside an editing cell input:
            if (isTyping && isGridElement) {
                if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
                    if (activeElem.selectionStart !== activeElem.selectionEnd) {
                        return; // user highlighted partial text to copy
                    }
                    executeCopy();
                    return;
                }
                if (isCtrlOrCmd && e.key.toLowerCase() === 'x') {
                    if (activeElem.selectionStart !== activeElem.selectionEnd) {
                        return;
                    }
                    e.preventDefault();
                    await executeCut();
                    return;
                }
                if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
                    if (activeElem?.closest('[data-excel-select-portal="true"]')) {
                        // Allow dropdown search input normal typing/pasting
                        return;
                    }
                    const curEdit = editingCellRef.current;
                    const colIdx = curEdit ? columns.findIndex((c) => c.key === curEdit.colKey) : undefined;
                    triggerPasteWithTrap(curEdit?.rowIndex, colIdx);
                    return;
                }
                if (editingCellRef.current && !isCtrlOrCmd) {
                    return;
                }
            }

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
                if (isTyping && activeElem?.selectionStart !== activeElem?.selectionEnd) return;
                if (!selectionAnchorRef.current && !selectionFocusRef.current && selectedIdsRef.current.size === 0 && !editingCellRef.current) return;
                e.preventDefault();
                executeCopy();
                return;
            }

            // Ctrl + X: Cut
            if (isCtrlOrCmd && e.key.toLowerCase() === 'x') {
                if (isTyping && activeElem?.selectionStart !== activeElem?.selectionEnd) return;
                if (!selectionAnchorRef.current && !selectionFocusRef.current && selectedIdsRef.current.size === 0 && !editingCellRef.current) return;
                e.preventDefault();
                await executeCut();
                return;
            }

            // Ctrl + V: Paste
            if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
                if (isTyping && editingCellRef.current) return;
                if (!selectionAnchorRef.current && !selectionFocusRef.current && selectedIdsRef.current.size === 0 && !editingCellRef.current) return;
                e.preventDefault();
                handlePasteAction();
                return;
            }

            // Ctrl + Z: Undo
            if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                if (e.repeat) {
                    e.preventDefault();
                    return;
                }
                const isInsideExcel =
                    activeElem?.closest('td[data-excel-cell="true"]') ||
                    activeElem?.closest('[data-excel-grid="true"]') ||
                    activeElem?.closest('[data-excel-formula-bar="true"]');

                if (isTyping && !isInsideExcel) {
                    return;
                }
                if (isTyping) {
                    const val = activeElem.value || '';
                    const initVal = activeElem.dataset?.initialValue || '';
                    if (val === '' || val === initVal) {
                        e.preventDefault();
                        activeElem.blur();
                        if (onUndo) onUndo();
                        else undo();
                        const curFocus = selectionFocusRef.current;
                        if (curFocus) {
                            focusCellElement(curFocus.r, curFocus.c);
                        }
                        return;
                    }
                    return;
                }
                e.preventDefault();
                if (onUndo) onUndo();
                else undo();
                const curFocus = selectionFocusRef.current;
                if (curFocus) {
                    focusCellElement(curFocus.r, curFocus.c);
                }
                return;
            }

            // Ctrl + Y / Ctrl + Shift + Z: Redo
            if (
                (isCtrlOrCmd && e.key.toLowerCase() === 'y') ||
                (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z')
            ) {
                if (e.repeat) {
                    e.preventDefault();
                    return;
                }
                const isInsideExcel =
                    activeElem?.closest('td[data-excel-cell="true"]') ||
                    activeElem?.closest('[data-excel-grid="true"]') ||
                    activeElem?.closest('[data-excel-formula-bar="true"]');

                if (isTyping && !isInsideExcel) {
                    return;
                }
                if (isTyping) {
                    const val = activeElem.value || '';
                    const initVal = activeElem.dataset?.initialValue || '';
                    if (val === '' || val === initVal) {
                        e.preventDefault();
                        activeElem.blur();
                        if (onRedo) onRedo();
                        else redo();
                        const curFocus = selectionFocusRef.current;
                        if (curFocus) {
                            focusCellElement(curFocus.r, curFocus.c);
                        }
                        return;
                    }
                    return;
                }
                e.preventDefault();
                if (onRedo) onRedo();
                else redo();
                const curFocus = selectionFocusRef.current;
                if (curFocus) {
                    focusCellElement(curFocus.r, curFocus.c);
                }
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
            if (focus && !editingCellRef.current) {
                // If user is inside an external modal / search input outside the grid, ignore
                if (isTyping && !activeElem?.closest('td[data-excel-cell="true"]') && !activeElem?.closest('[data-excel-grid="true"]')) {
                    return;
                }

                // If active element is ALREADY a cell, it already handled key events directly in ExcelCell.onKeyDown!
                if (activeElem?.closest('td[data-excel-cell="true"]')) {
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

        const handleNativePaste = async (e) => {
            const now = Date.now();
            if (now - lastPasteHandledTimestampRef.current < 100) return;

            const active = document.activeElement;
            const isPortal = Boolean(active?.closest('[data-excel-select-portal="true"]'));
            const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
            const isInsideCell = Boolean(active?.closest('td[data-excel-cell="true"]'));
            const isGrid = Boolean(
                isInsideCell ||
                active?.closest('[data-excel-grid="true"]') ||
                isPortal ||
                active?.closest('table')
            );
            if (isInput && !isGrid) return;

            let text = e.clipboardData ? e.clipboardData.getData('text/plain') : null;
            if (!text) {
                text = window.__manoExcelClipboard || sessionStorage.getItem('__manoExcelClipboard') || internalClipboardRef.current;
            }

            if (isInput && editingCellRef.current && !isPortal) {
                if (text && !text.includes('\t') && !text.includes('\n')) {
                    return;
                }
            }

            const focus = selectionFocusRef.current;
            const bounds = getBoundsFromRefs();
            const curSelectedIds = selectedIdsRef.current;
            const curEdit = editingCellRef.current;
            if (!focus && !bounds && curSelectedIds.size === 0 && !curEdit) return;

            if (text) {
                lastPasteHandledTimestampRef.current = now;
                e.preventDefault();
                e.stopPropagation();
                if (editingCellRef.current) {
                    commitEditingCell();
                }
                await executePaste(text);
            }
        };

        const handleNativeCopy = (e) => {
            const active = document.activeElement;
            const isPortal = Boolean(active?.closest('[data-excel-select-portal="true"]'));
            const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
            const isGrid = Boolean(
                active?.closest('td[data-excel-cell="true"]') ||
                active?.closest('[data-excel-grid="true"]') ||
                isPortal ||
                active?.closest('table')
            );
            if (isInput && !isGrid) return;
            if (isInput && active.selectionStart !== active.selectionEnd) {
                return;
            }

            const focus = selectionFocusRef.current;
            const bounds = getBoundsFromRefs();
            const curSelectedIds = selectedIdsRef.current;
            const curEdit = editingCellRef.current;
            if (!focus && !bounds && curSelectedIds.size === 0 && !curEdit) return;

            const { tsvData, rowsToCopy, cellCount } = getSelectedDataMatrix();
            if (!tsvData) return;

            if (e && e.clipboardData) {
                e.preventDefault();
                e.clipboardData.clearData();
                e.clipboardData.setData('text/plain', tsvData);
            }

            internalClipboardRef.current = tsvData;
            window.__manoExcelClipboard = tsvData;
            internalClipboardRowsRef.current = rowsToCopy.map((r) => JSON.parse(JSON.stringify(r)));
            window.__manoExcelClipboardRows = internalClipboardRowsRef.current;
            try {
                sessionStorage.setItem('__manoExcelClipboard', tsvData);
                sessionStorage.setItem('__manoExcelClipboardRows', JSON.stringify(internalClipboardRowsRef.current));
            } catch {}

            notify(
                'sparkle',
                'Copied',
                cellCount === 1 ? 'Copied 1 cell to clipboard' : `Copied ${cellCount} cells to clipboard`
            );
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('paste', handleNativePaste);
        window.addEventListener('copy', handleNativeCopy);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('paste', handleNativePaste);
            window.removeEventListener('copy', handleNativeCopy);
        };
    }, [
        editingCell,
        columns,
        canWrite,
        executeCopy,
        executeCut,
        executePaste,
        triggerPasteWithTrap,
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
                if (editingCellRef.current) {
                    commitEditingCell();
                }
                setSelectionAnchor(null);
                setSelectionFocus(null);
                selectionAnchorRef.current = null;
                selectionFocusRef.current = null;
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

        gridDataRef,
        activeEditorValue,

        // Dirty status & Undo/Redo & Storage
        isSavingRef,
        hasUnsavedChanges,
        unsavedCount,
        dirtyCounts,
        undoVersion,
        historyVersion,
        canUndo: externalCanUndo !== undefined ? externalCanUndo : ((undoVersion >= 0 || historyVersion >= 0) && undoStackRef.current.length > 0),
        canRedo: externalCanRedo !== undefined ? externalCanRedo : ((undoVersion >= 0 || historyVersion >= 0) && redoStackRef.current.length > 0),
        undo: onUndo || undo,
        redo: onRedo || redo,
        pushUndoState,
        clearDraftFromStorage,
        discardDraft,
        storageKey,

        // Actions
        commitEditingCell,
        handleStartEditing,
        handleEditorValueChange,
        handleCellMouseDown,
        handleCellMouseEnter,
        handleCellChange,
        handleCellBlur,
        handleCellKeyDown,
        executeCopy,
        executeCut,
        executePaste,
        triggerPasteWithTrap,
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
