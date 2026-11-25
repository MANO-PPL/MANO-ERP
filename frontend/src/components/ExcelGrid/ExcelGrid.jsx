import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useExcelGrid } from './useExcelGrid';
import { ExcelToolbar } from './ExcelToolbar';
import { ExcelFormulaBar } from './ExcelFormulaBar';
import { ExcelTable } from './ExcelTable';
import { ExcelStatusBar } from './ExcelStatusBar';
import { ExcelContextMenu } from './ExcelContextMenu';
import { ExcelAddColumnModal } from './ExcelAddColumnModal';
import { ExcelFindReplaceModal } from './ExcelFindReplaceModal';
import { ExcelImportModal } from './ExcelImportModal';
import { ExcelShortcutsModal } from './ExcelShortcutsModal';
import { ExcelFormulaAssistantModal } from '../common/ExcelFormulas';
import {
    downloadExcelTemplate,
    exportToExcelFile,
    exportToCSVFile,
    generateBatchPayload,
    findDuplicateGroups,
    findAllDuplicateGroups,
    getUniqueKeyColumn,
    getRowUniqueValue
} from './excelUtils';
import ConfirmModal from '../ConfirmModal';
import DuplicateResolverModal from '../DuplicateResolverModal';
import Toast from '../Toast';
import { customToast } from '../../utils/toast';
import { ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react';

/**
 * ExcelGrid - Unified Enterprise Spreadsheet Grid Component
 * Supports dynamic formulas, inline multi-cell editing, real-time imports, and responsive drawers.
 * Coordinates z-index stacking layers between ExcelToolbar (z-40) and ExcelTable (z-0 container).
 */
const PageSizeDropdown = ({ pageSize, setPageSize, totalCount }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [50, 100, 250, 500, 1000, 'All'];

    return (
        <div className="relative inline-block text-left select-none">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 hover:border-blue-500/50 transition-all shadow-2xs cursor-pointer"
            >
                <span>{pageSize === 'All' ? `All (${totalCount})` : `${pageSize} per page`}</span>
                <ChevronDown
                    size={13}
                    className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute left-0 bottom-full mb-1 w-36 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-[7000] py-1 text-xs text-gray-700 dark:text-gray-300 font-semibold overflow-hidden animate-in fade-in zoom-in-95 select-none">
                    <div className="px-2.5 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-white/5">
                        Rows per page
                    </div>
                    {options.map((opt) => (
                        <button
                            key={String(opt)}
                            onClick={() => {
                                setPageSize(opt);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-white/5 flex items-center justify-between transition-colors cursor-pointer ${pageSize === opt
                                    ? 'bg-blue-50/70 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold'
                                    : ''
                                }`}
                        >
                            <span>{opt === 'All' ? `All (${totalCount})` : `${opt} rows`}</span>
                            {pageSize === opt && <Check size={12} className="stroke-[3]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const ExcelGrid = ({
    data = [],
    columns = [],
    primaryKey = 'id',
    entityName = 'Items',
    canWrite = true,
    isLoading = false,
    onSave = null,
    onDelete = null,
    onRefresh = null,
    onViewRow = null,
    onArchiveRow = null,
    onRestoreRow = null,
    onDeleteRow = null,
    customActions = null,
    extraTools = null,
    bulkActions = null,
    topContent = null,
    bottomContent = null,
    extraFilters = null,
    emptyMessage = 'No records found',
    initialPageSize = 100,
    enablePagination = true,
    showFormulaBar = true,
    allowAddColumn = false,
    renderExpandedRow = null,
    expandedRowIds = undefined,
    onToggleExpandRow = null,
    isRowExpandable = null,
    onUndo = null,
    onRedo = null,
    canUndo = undefined,
    canRedo = undefined,
    onAddRows = null,
    onCellChange = null,
    storageKey = null,
    isDuplicateModalOpen: externalIsDuplicateModalOpen = undefined,
    setIsDuplicateModalOpen: externalSetIsDuplicateModalOpen = undefined
}) => {
    const [toast, setToast] = useState(null);
    const showToast = useCallback((type, title, message, duration = 3000) => {
        setToast({ type, title, message, duration, id: Date.now() });
    }, []);

    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importModalTab, setImportModalTab] = useState('upload');
    const [extraColumns, setExtraColumns] = useState([]);
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [isFormulaAssistantOpen, setIsFormulaAssistantOpen] = useState(false);
    const [findHighlightConfig, setFindHighlightConfig] = useState(null);

    const mergedColumns = useMemo(() => [...columns, ...extraColumns], [columns, extraColumns]);
    const [internalIsDuplicateModalOpen, setInternalIsDuplicateModalOpen] = useState(false);
    const isDuplicateModalOpen = externalIsDuplicateModalOpen !== undefined ? externalIsDuplicateModalOpen : internalIsDuplicateModalOpen;
    const setIsDuplicateModalOpen = externalSetIsDuplicateModalOpen || setInternalIsDuplicateModalOpen;

    // Browser persistence storage key scoped to entity & page path
    const computedStorageKey = useMemo(() => {
        if (storageKey) return `mano_excel_draft_${storageKey}`;
        const cleanEntity = entityName ? entityName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') : 'sheet';
        const cleanPath = typeof window !== 'undefined' ? window.location.pathname.replace(/[^a-z0-9_-]/g, '_') : 'root';
        return `mano_excel_draft_${cleanEntity}_${cleanPath}`;
    }, [storageKey, entityName]);

    // Confirmation Modal
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'danger',
        onConfirm: () => { }
    });

    const closeConfirmModal = () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    };

    const grid = useExcelGrid({
        data,
        columns: mergedColumns,
        primaryKey,
        canWrite,
        initialPageSize,
        showToast,
        onUndo,
        onRedo,
        canUndo,
        canRedo,
        onCellChange,
        storageKey: computedStorageKey
    });

    // Compute duplicate groups across active spreadsheet rows (including code & unique columns)
    const duplicateGroups = useMemo(() => {
        return findAllDuplicateGroups(grid.gridData, mergedColumns, primaryKey);
    }, [grid.gridData, mergedColumns, primaryKey]);

    // Discard unsaved draft changes
    const handleRequestDiscardDraft = useCallback(() => {
        setConfirmModal({
            isOpen: true,
            title: 'Discard Unsaved Changes?',
            message: 'Are you sure you want to discard your unsaved draft and reload from cloud? This will erase any uncommitted local edits.',
            confirmText: 'Discard Draft',
            cancelText: 'Keep Editing',
            variant: 'danger',
            onConfirm: () => {
                if (grid.discardDraft) {
                    grid.discardDraft();
                }
                closeConfirmModal();
            }
        });
    }, [grid]);

    // Merge a single duplicate group into a Master record
    const handleMergeDuplicateGroup = useCallback(
        (mergedMasterRow, duplicateRowIds) => {
            grid.pushUndoState(grid.gridData);
            const dupIdSet = new Set(duplicateRowIds.map(String));

            const persistentIds = duplicateRowIds.filter((id) => !String(id).startsWith('temp_'));
            if (persistentIds.length > 0) {
                grid.setDeletedIds((prev) => {
                    const next = new Set(prev);
                    persistentIds.forEach((id) => next.add(id));
                    return next;
                });
            }

            grid.setGridData((prev) => {
                return prev
                    .filter((r) => !dupIdSet.has(String(r[primaryKey])))
                    .map((r) =>
                        String(r[primaryKey]) === String(mergedMasterRow[primaryKey])
                            ? mergedMasterRow
                            : r
                    );
            });

            showToast(
                'success',
                'Merged into Single Record',
                `Successfully merged ${duplicateRowIds.length} duplicate copy/copies into "${mergedMasterRow.name || 'Master Record'}". Click "Save Changes" to apply.`
            );
            customToast.success(
                `Successfully merged ${duplicateRowIds.length} duplicate copy/copies into "${mergedMasterRow.name || 'Master Record'}". Click "Save Changes" to apply.`,
                'Duplicates Merged'
            );
        },
        [grid, primaryKey, showToast]
    );

    // Merge all duplicate groups into single records
    const handleMergeAllDuplicates = useCallback(
        (mergedMasterRows, allDuplicateRowIds) => {
            grid.pushUndoState(grid.gridData);
            const dupIdSet = new Set(allDuplicateRowIds.map(String));
            const masterMap = new Map();
            mergedMasterRows.forEach((r) => masterMap.set(String(r[primaryKey]), r));

            const persistentIds = allDuplicateRowIds.filter((id) => !String(id).startsWith('temp_'));
            if (persistentIds.length > 0) {
                grid.setDeletedIds((prev) => {
                    const next = new Set(prev);
                    persistentIds.forEach((id) => next.add(id));
                    return next;
                });
            }

            grid.setGridData((prev) => {
                return prev
                    .filter((r) => !dupIdSet.has(String(r[primaryKey])))
                    .map((r) =>
                        masterMap.has(String(r[primaryKey]))
                            ? masterMap.get(String(r[primaryKey]))
                            : r
                    );
            });

            showToast(
                'sparkle',
                'All Duplicates Merged',
                `Successfully merged ${allDuplicateRowIds.length} duplicate copy/copies into ${mergedMasterRows.length} consolidated record(s). Click "Save Changes" to save to database.`
            );
            customToast.success(
                `Successfully merged ${allDuplicateRowIds.length} duplicate copy/copies into ${mergedMasterRows.length} consolidated record(s). Click "Save Changes" to save to database.`,
                'All Duplicates Merged'
            );
        },
        [grid, primaryKey, showToast]
    );

    // Delete redundant duplicate copies
    const handleDeleteDuplicates = useCallback(
        (idsToDelete) => {
            grid.pushUndoState(grid.gridData);
            const delSet = new Set(idsToDelete.map(String));
            const persistentIds = idsToDelete.filter((id) => !String(id).startsWith('temp_'));

            if (persistentIds.length > 0) {
                grid.setDeletedIds((prev) => {
                    const next = new Set(prev);
                    persistentIds.forEach((id) => next.add(id));
                    return next;
                });
            }

            grid.setGridData((prev) => prev.filter((r) => !delSet.has(String(r[primaryKey]))));

            showToast(
                'success',
                'Duplicates Removed',
                `Removed ${idsToDelete.length} duplicate copy/copies locally. Click "Save Changes" to apply to database.`
            );
            customToast.success(
                `Removed ${idsToDelete.length} duplicate copy/copies locally. Click "Save Changes" to apply to database.`,
                'Duplicates Removed'
            );
        },
        [grid, primaryKey, showToast]
    );

    const handleAddColumn = useCallback(
        (newCol) => {
            setExtraColumns((prev) => [...prev, newCol]);
            if (newCol.defaultValue !== undefined && newCol.defaultValue !== '') {
                grid.setGridData((prev) =>
                    prev.map((r) => ({
                        ...r,
                        [newCol.key]: r[newCol.key] !== undefined ? r[newCol.key] : newCol.defaultValue
                    }))
                );
            }
            showToast('success', 'Column Added', `Added "${newCol.label}" column to the table`);
        },
        [grid, showToast]
    );

    // Save batch changes
    const handleSaveBatch = async () => {
        if (!onSave || !canWrite) return;
        if (grid.commitEditingCell) {
            grid.commitEditingCell();
        }

        // Check for duplicate records before saving to prevent duplicate insertion
        if (duplicateGroups.length > 0) {
            const hasDuplicateCode = duplicateGroups.some((g) => {
                const k = (g.columnKey || '').toLowerCase();
                return k === 'code' || k === 'item_code' || k === 'resource_code';
            });
            const dupCodeSample = hasDuplicateCode
                ? duplicateGroups.find((g) => ['code', 'item_code', 'resource_code'].includes((g.columnKey || '').toLowerCase()))?.label
                : null;

            const alertTitle = hasDuplicateCode ? 'Resource Code Already Exists' : 'Duplicate Records Detected';
            const alertMsg = hasDuplicateCode
                ? `Cannot save: Resource code already exists: "${dupCodeSample || ''}". Resource code must be strictly unique. Please change it.`
                : `Cannot save: Found ${duplicateGroups.length} duplicate group(s). Please merge duplicates in the sidebar before saving.`;

            showToast('error', alertTitle, alertMsg, 6000);
            customToast.error(alertMsg, alertTitle);
            setIsDuplicateModalOpen(true);
            return;
        }

        const hasErrors = grid.gridData.some((r) => {
            if (!r._errors || Object.keys(r._errors).length === 0) return false;
            const isTemp = !r[primaryKey] || String(r[primaryKey]).startsWith('temp_') || r._status === 'new';
            if (isTemp) {
                const hasAnyContent = Object.entries(r).some(
                    ([k, v]) => !k.startsWith('_') && k !== primaryKey && v != null && String(v).trim() !== ''
                );
                if (!hasAnyContent) return false;
            }
            return true;
        });
        if (hasErrors) {
            showToast('error', 'Validation Error', 'Please fix red highlighted validation errors before saving');
            return;
        }

        const currentData = grid.gridDataRef?.current || grid.gridData;
        const payload = {
            ...generateBatchPayload(
                currentData,
                grid.originalDataMap,
                primaryKey,
                grid.deletedIds,
                mergedColumns
            ),
            allCurrentRows: currentData
        };

        setIsSaving(true);
        if (grid.isSavingRef) grid.isSavingRef.current = true;
        try {
            await onSave(payload);
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            grid.setDeletedIds(new Set());
            grid.setGridData((prev) =>
                (prev || []).map((r) => ({
                    ...r,
                    _status: 'saved',
                    _errors: {}
                }))
            );
            if (grid.clearDraftFromStorage) {
                grid.clearDraftFromStorage();
            }
            if (computedStorageKey && typeof window !== 'undefined') {
                try {
                    window.localStorage.removeItem(computedStorageKey);
                } catch (_) {}
            }
            showToast('success', 'Saved', 'All spreadsheet changes saved successfully');
            if (onRefresh) onRefresh();
        } catch (err) {
            if (grid.isSavingRef) grid.isSavingRef.current = false;
            console.error('Save failed:', err);
            showToast(
                'error',
                'Save Failed',
                err.response?.data?.message || err.message || 'Failed to save changes'
            );
        } finally {
            if (grid.isSavingRef) grid.isSavingRef.current = false;
            setIsSaving(false);
        }
    };

    // Delete single row with confirmation
    const handleRequestDeleteRow = (row) => {
        if (!canWrite) return;
        const rowId = row[primaryKey];
        if (String(rowId).startsWith('temp_') || row._status === 'new') {
            grid.handleDeleteRows([row]);
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: `Delete ${entityName.slice(0, -1) || 'Item'}?`,
            message: `Are you sure you want to delete "${row.name || 'this entry'}" locally? Click "Save Changes" after deletion to apply to cloud.`,
            confirmText: 'Delete Locally',
            cancelText: 'Cancel',
            variant: 'danger',
            onConfirm: () => {
                grid.handleDeleteRows([row]);
                closeConfirmModal();
            }
        });
    };

    // Bulk delete with confirmation
    const handleRequestBulkDelete = () => {
        if (grid.selectedIds.size === 0 || !canWrite) return;
        const count = grid.selectedIds.size;
        const rowsToDelete = grid.sortedGridData.filter((r) => grid.selectedIds.has(r[primaryKey]));

        setConfirmModal({
            isOpen: true,
            title: `Delete ${count} Selected ${entityName}?`,
            message: `Are you sure you want to delete ${count} selected item(s) locally? Click "Save Changes" after deletion to apply to cloud.`,
            confirmText: `Delete (${count})`,
            cancelText: 'Cancel',
            variant: 'danger',
            onConfirm: () => {
                grid.handleDeleteRows(rowsToDelete);
                closeConfirmModal();
            }
        });
    };

    // Commit import from modal with duplicate prevention
    const handleCommitImport = (importedRows, mode = 'append') => {
        grid.pushUndoState(grid.gridData);

        const uniqueCol = getUniqueKeyColumn(mergedColumns);
        const existingUniqueKeys = new Set(
            (mode === 'append' ? grid.gridData : [])
                .map((row) => getRowUniqueValue(row, uniqueCol))
                .filter(Boolean)
        );

        const validImportRows = [];
        let duplicateSkippedCount = 0;

        importedRows.forEach((row) => {
            const rowKey = getRowUniqueValue(row, uniqueCol);
            if (rowKey && existingUniqueKeys.has(rowKey)) {
                duplicateSkippedCount++;
                return;
            }
            if (rowKey) {
                existingUniqueKeys.add(rowKey);
            }
            validImportRows.push(row);
        });

        if (mode === 'append') {
            grid.setGridData((prev) => [...validImportRows, ...prev]);
        } else {
            grid.setGridData(validImportRows);
        }

        if (duplicateSkippedCount > 0) {
            showToast(
                'warning',
                'Duplicate Data Skipped',
                `Data already exists! Skipped ${duplicateSkippedCount} duplicate record(s) already in the sheet.`
            );
            customToast.warning(
                `Data already exists! Skipped ${duplicateSkippedCount} duplicate record(s) already in the sheet.`,
                'Duplicate Data Skipped'
            );
        }

        showToast(
            'sparkle',
            'Imported',
            `Successfully imported ${validImportRows.length} ${entityName.toLowerCase()} row(s). Click "Save Changes" to save to cloud.`
        );
    };


    const totalCount = grid.sortedGridData.length;
    const startIdx =
        grid.pageSize === 'All'
            ? 1
            : Math.min((grid.currentPage - 1) * Number(grid.pageSize) + 1, totalCount);
    const endIdx =
        grid.pageSize === 'All'
            ? totalCount
            : Math.min(grid.currentPage * Number(grid.pageSize), totalCount);

    // Unified Add Rows Handler with immediate focus and editing activation
    const handleUnifiedAddRows = useCallback((count = 1, position = 'top') => {
        if (!canWrite) return;

        if (onAddRows) {
            onAddRows(count, position);
        } else {
            grid.handleAddRows(count, position);
        }

        if (grid.searchTerm) {
            grid.setSearchTerm('');
        }

        const isBottom = position === 'bottom';
        const targetRowIdx = isBottom ? grid.sortedGridData.length : 0;
        const targetPage = isBottom && grid.pageSize !== 'All'
            ? Math.max(1, Math.ceil((grid.sortedGridData.length + count) / Number(grid.pageSize)))
            : 1;

        grid.setCurrentPage(targetPage);

        const firstEditableCol = mergedColumns.find((c) => !c.readOnly) || mergedColumns[0];
        const firstColIdx = firstEditableCol
            ? mergedColumns.findIndex((c) => c.key === firstEditableCol.key)
            : 0;
        const finalColIdx = Math.max(0, firstColIdx);

        grid.setSelectionAnchor({ r: targetRowIdx, c: finalColIdx });
        grid.setSelectionFocus({ r: targetRowIdx, c: finalColIdx });

        if (firstEditableCol) {
            grid.setEditingCell({ rowIndex: targetRowIdx, colKey: firstEditableCol.key });
        }

        const focusNewCell = (attempts = 0) => {
            const gridContainer = document.querySelector('[data-excel-grid="true"]');
            if (gridContainer) {
                if (isBottom) {
                    gridContainer.scrollTop = gridContainer.scrollHeight;
                } else {
                    gridContainer.scrollTop = 0;
                }
            }
            const cellEl = document.getElementById(`excel-cell-${targetRowIdx}-${firstEditableCol?.key}`);
            if (cellEl) {
                try {
                    cellEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                } catch {}
                const inp = cellEl.querySelector('input, select, textarea');
                if (inp) {
                    inp.focus();
                    try {
                        const len = inp.value ? inp.value.length : 0;
                        inp.setSelectionRange?.(len, len);
                    } catch {}
                    return;
                }
            }
            if (attempts < 8) {
                setTimeout(() => focusNewCell(attempts + 1), 40);
            }
        };
        setTimeout(() => focusNewCell(0), 40);
    }, [canWrite, onAddRows, grid, mergedColumns]);

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full relative font-sans">
            {/* Custom Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={closeConfirmModal}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                variant={confirmModal.variant}
            />

            {/* Toast Notification */}
            <Toast toast={toast} onClose={() => setToast(null)} />

            {/* Custom Top Content */}
            {topContent}

            {/* Excel Action Toolbar */}
            <ExcelToolbar
                entityName={entityName}
                searchTerm={grid.searchTerm}
                setSearchTerm={grid.setSearchTerm}
                hasUnsavedChanges={grid.hasUnsavedChanges}
                unsavedCount={grid.unsavedCount}
                isSaving={isSaving}
                lastSavedTime={lastSavedTime}
                onSave={handleSaveBatch}
                onDiscardDraft={handleRequestDiscardDraft}
                canUndo={canUndo !== undefined ? canUndo : grid.canUndo}
                canRedo={canRedo !== undefined ? canRedo : grid.canRedo}
                onUndo={onUndo || grid.undo}
                onRedo={onRedo || grid.redo}
                onAddRows={handleUnifiedAddRows}
                selectedIds={grid.selectedIds}
                onBulkDelete={handleRequestBulkDelete}
                onBulkDuplicate={() => {
                    const selectedRows = grid.sortedGridData.filter((r) =>
                        grid.selectedIds.has(r[primaryKey])
                    );
                    selectedRows.forEach((r) => grid.handleDuplicateRow(r));
                }}
                onClearSelection={() => grid.setSelectedIds(new Set())}
                onOpenImportModal={(tab) => {
                    setImportModalTab(tab);
                    setIsImportModalOpen(true);
                }}
                onOpenAddColumn={allowAddColumn ? () => setIsAddColumnModalOpen(true) : null}
                onDownloadTemplate={() => downloadExcelTemplate(mergedColumns, entityName)}
                onExportCSV={() => exportToCSVFile(grid.sortedGridData, mergedColumns, entityName)}
                onExportExcel={() => exportToExcelFile(grid.sortedGridData, mergedColumns, entityName)}
                onOpenShortcutsModal={() => grid.setIsShortcutsModalOpen(true)}
                onOpenFormulaAssistant={() => setIsFormulaAssistantOpen(true)}
                onOpenDuplicateModal={() => setIsDuplicateModalOpen(true)}
                duplicateCount={duplicateGroups.length}
                canWrite={canWrite}
                customActions={customActions}
                extraTools={extraTools}
                bulkActions={bulkActions}
                extraFilters={extraFilters}
            />

            {/* Formula / Active Cell Address Bar */}
            {showFormulaBar && (
                <ExcelFormulaBar
                    selectionFocus={grid.selectionFocus}
                    columns={mergedColumns}
                    sortedGridData={grid.sortedGridData}
                    primaryKey={primaryKey}
                    editingCell={grid.editingCell}
                    activeEditorValue={grid.activeEditorValue}
                    onChangeValue={grid.handleCellChange}
                    onOpenFindReplace={() => {
                        grid.setFindReplaceMode('find');
                        grid.setIsFindReplaceOpen(true);
                    }}
                    canWrite={canWrite}
                    onUndo={onUndo || grid.undo}
                    onRedo={onRedo || grid.redo}
                />
            )}

            {/* Main Interactive Table Grid */}
            <ExcelTable
                columns={mergedColumns}
                sortedGridData={grid.sortedGridData}
                paginatedGridData={grid.paginatedGridData}
                originalDataMap={grid.originalDataMap}
                primaryKey={primaryKey}
                canWrite={canWrite}
                isLoading={isLoading}
                selectedIds={grid.selectedIds}
                lastSelectedId={grid.lastSelectedId}
                setSelectedIds={grid.setSelectedIds}
                setLastSelectedId={grid.setLastSelectedId}
                selectionAnchor={grid.selectionAnchor}
                selectionFocus={grid.selectionFocus}
                selectionBounds={grid.selectionBounds}
                copiedBounds={grid.copiedBounds}
                editingCell={grid.editingCell}
                isMouseDown={grid.isMouseDown}
                setIsMouseDown={grid.setIsMouseDown}
                sortConfig={grid.sortConfig}
                onSort={(key) => {
                    grid.setSortConfig((prev) => ({
                        key,
                        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
                    }));
                }}
                customColWidths={grid.customColWidths}
                setCustomColWidths={grid.setCustomColWidths}
                onColumnHeaderDoubleClick={grid.handleColumnHeaderDoubleClick}
                onSelectCell={(rowIndex, colIndex, isShift) => {
                    if (isShift && grid.selectionAnchor) {
                        grid.setSelectionFocus({ r: rowIndex, c: colIndex });
                    } else {
                        grid.setSelectionAnchor({ r: rowIndex, c: colIndex });
                        grid.setSelectionFocus({ r: rowIndex, c: colIndex });
                    }
                }}
                onCellMouseDown={grid.handleCellMouseDown}
                onCellMouseEnter={grid.handleCellMouseEnter}
                onSelectRowHeader={grid.handleSelectRowHeader}
                onRowHeaderMouseEnter={grid.handleRowHeaderMouseEnter}
                onSelectColumnHeader={grid.handleSelectColumnHeader}
                onColumnHeaderMouseEnter={grid.handleColumnHeaderMouseEnter}
                onSelectAllCells={grid.handleSelectAllCells}
onOpenAddColumn={allowAddColumn ? () => setIsAddColumnModalOpen(true) : null}
                onStartEditing={grid.handleStartEditing || ((rowIndex, colKey) => grid.setEditingCell({ rowIndex, colKey }))}
                onStopEditing={grid.handleCellBlur}
                onChangeValue={grid.handleCellChange}
                onCellKeyDown={grid.handleCellKeyDown}
                onEditorValueChange={grid.handleEditorValueChange}
                onPasteCell={grid.executePaste}
                onContextMenu={(e, rowIndex, colIndex) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (grid.selectedIds && grid.selectedIds.size > 0) {
                        grid.setSelectedIds(new Set());
                    }
                    grid.setSelectionAnchor({ r: rowIndex, c: colIndex });
                    grid.setSelectionFocus({ r: rowIndex, c: colIndex });
                    grid.setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        rowIndex,
                        colIndex
                    });
                }}
                onStartFillDrag={() => grid.setIsFillDragging(true)}
                onAutoFillDown={grid.handleAutoFillDown}
                onViewRow={onViewRow}
                onArchiveRow={onArchiveRow}
                onRestoreRow={onRestoreRow}
                onDeleteRow={
                    onDeleteRow
                        ? (row) => {
                              const rowId = row[primaryKey];
                              if (String(rowId).startsWith('temp_') || row._status === 'new') {
                                  handleRequestDeleteRow(row);
                              } else {
                                  onDeleteRow(row);
                              }
                          }
                        : handleRequestDeleteRow
                }
                emptyMessage={emptyMessage}
                onAddRows={handleUnifiedAddRows}
                onOpenImportModal={(tab) => {
                    setImportModalTab(tab);
                    setIsImportModalOpen(true);
                }}
                currentPage={grid.currentPage}
                pageSize={grid.pageSize}
                findHighlightConfig={findHighlightConfig}
                renderExpandedRow={renderExpandedRow}
                expandedRowIds={expandedRowIds}
                onToggleExpandRow={onToggleExpandRow}
                isRowExpandable={isRowExpandable}
            />

            {/* Live Calculation Status Bar */}
            <ExcelStatusBar
                sortedGridData={grid.sortedGridData}
                columns={columns}
                selectionBounds={grid.selectionBounds}
            />

            {/* ─── PAGINATION & SHORTCUTS FOOTER ─── */}
            <div className="px-3 py-1.5 border-t border-gray-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs bg-white dark:bg-[#0d1117] select-none shrink-0">
                {/* Left: Page Size & Entry Count */}
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                    {enablePagination && (
                        <PageSizeDropdown
                            pageSize={grid.pageSize}
                            setPageSize={grid.setPageSize}
                            totalCount={totalCount}
                        />
                    )}
                    <span className="font-semibold text-[11px]">
                        {totalCount === 0
                            ? '0 entries'
                            : `Showing ${startIdx} to ${endIdx} of ${totalCount} entries`}
                    </span>
                </div>

                {/* Middle: Quick Keyboard Shortcuts Chips */}
                <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-gray-200 font-bold">
                            Ctrl+C
                        </kbd>{' '}
                        Copy
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-gray-200 font-bold">
                            Ctrl+V
                        </kbd>{' '}
                        Paste
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-gray-200 font-bold">
                            Ctrl+D
                        </kbd>{' '}
                        Fill
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-gray-200 font-bold">
                            Ctrl+H
                        </kbd>{' '}
                        Replace
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-gray-200 font-bold">
                            Ctrl+;
                        </kbd>{' '}
                        Date
                    </span>
                    <button
                        onClick={() => grid.setIsShortcutsModalOpen(true)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-sans font-bold cursor-pointer ml-1"
                    >
                        Shortcuts (F1)
                    </button>
                </div>

                {/* Right: Pagination Navigation */}
                {enablePagination && grid.pageSize !== 'All' && grid.totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={grid.currentPage === 1}
                            onClick={() => grid.setCurrentPage((p) => Math.max(1, p - 1))}
                            className="p-1 rounded-md border border-gray-200 dark:border-white/10 disabled:opacity-40 disabled:hover:bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition cursor-pointer"
                            title="Previous Page"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="px-2 font-semibold text-gray-800 dark:text-gray-200 text-xs">
                            {grid.currentPage} / {grid.totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={grid.currentPage === grid.totalPages}
                            onClick={() => grid.setCurrentPage((p) => Math.min(grid.totalPages, p + 1))}
                            className="p-1 rounded-md border border-gray-200 dark:border-white/10 disabled:opacity-40 disabled:hover:bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition cursor-pointer"
                            title="Next Page"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Custom Bottom Content */}
            {bottomContent}

            {/* Right Click Context Menu */}
            <ExcelContextMenu
                contextMenu={grid.contextMenu}
                onClose={() => grid.setContextMenu(null)}
                onCut={grid.executeCut}
                onCopy={grid.executeCopy}
                onPaste={() => grid.executePaste(null, grid.contextMenu?.rowIndex, grid.contextMenu?.colIndex)}
                onFillDown={grid.handleFillDown}
                onFillRight={grid.handleFillRight}
                onDateStamp={grid.handleDateStamp}
                onTimeStamp={grid.handleTimeStamp}
                onTransformCase={grid.handleTransformCase}
                onInsertRowAbove={() => {
                    if (grid.contextMenu) grid.handleInsertRow(grid.contextMenu.rowIndex, 'above');
                }}
                onInsertRowBelow={() => {
                    if (grid.contextMenu) grid.handleInsertRow(grid.contextMenu.rowIndex, 'below');
                }}
                onDuplicateRow={() => {
                    if (grid.contextMenu) {
                        const targetRow = grid.sortedGridData[grid.contextMenu.rowIndex];
                        if (targetRow) grid.handleDuplicateRow(targetRow);
                    }
                }}
                onDeleteRows={() => {
                    if (grid.contextMenu) {
                        const targetRow = grid.sortedGridData[grid.contextMenu.rowIndex];
                        if (targetRow) handleRequestDeleteRow(targetRow);
                    }
                }}
                onClearCells={grid.handleClearCells}
                canWrite={canWrite}
            />

            {/* Find & Replace Modal */}
            <ExcelFindReplaceModal
                isOpen={grid.isFindReplaceOpen}
                onClose={() => grid.setIsFindReplaceOpen(false)}
                columns={mergedColumns}
                sortedGridData={grid.sortedGridData}
                selectionFocus={grid.selectionFocus}
                setSelectionAnchor={grid.setSelectionAnchor}
                setSelectionFocus={grid.setSelectionFocus}
                onReplaceValue={grid.handleCellChange}
                onReplaceAll={grid.handleReplaceAll}
                initialMode={grid.findReplaceMode}
                currentPage={grid.currentPage}
                setCurrentPage={grid.setCurrentPage}
                pageSize={grid.pageSize}
                onFindQueryChange={setFindHighlightConfig}
            />

            {/* Excel Import Modal */}
            <ExcelImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                columns={mergedColumns}
                primaryKey={primaryKey}
                entityName={entityName}
                onCommitImport={handleCommitImport}
                initialTab={importModalTab}
            />

            {/* Add Custom Column Modal */}
            {allowAddColumn && isAddColumnModalOpen && (
                <ExcelAddColumnModal
                    isOpen={isAddColumnModalOpen}
                    onClose={() => setIsAddColumnModalOpen(false)}
                    onAddColumn={handleAddColumn}
                    existingColumns={mergedColumns}
                />
            )}

            {/* Keyboard Shortcuts Reference Modal */}
            <ExcelShortcutsModal
                isOpen={grid.isShortcutsModalOpen}
                onClose={() => grid.setIsShortcutsModalOpen(false)}
            />

            {/* Global Excel Formula Assistant Modal */}
            <ExcelFormulaAssistantModal
                isOpen={isFormulaAssistantOpen}
                onClose={() => setIsFormulaAssistantOpen(false)}
                onInsertFormula={(insertedFormula) => {
                    if (grid.selectionFocus && canWrite) {
                        const activeCol = mergedColumns[grid.selectionFocus.c];
                        if (activeCol && !activeCol.readOnly) {
                            grid.handleCellChange(grid.selectionFocus.r, activeCol.key, insertedFormula, true);
                        }
                    }
                }}
            />

            {/* Centralized Duplicate Records & Merge Sidebar Drawer */}
            <DuplicateResolverModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                items={grid.gridData}
                columns={mergedColumns}
                primaryKey={primaryKey}
                entityName={entityName}
                onMergeGroup={handleMergeDuplicateGroup}
                onMergeAll={handleMergeAllDuplicates}
                onDeleteDuplicates={handleDeleteDuplicates}
                onViewRow={onViewRow}
                onUpdateCell={(rowIndex, colKey, value, isAtomic, rowId) =>
                    grid.handleCellChange(rowIndex, colKey, value, isAtomic, rowId)
                }
            />
        </div>
    );
};

export default ExcelGrid;
