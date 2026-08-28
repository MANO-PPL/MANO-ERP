import React, { useState, useMemo, useCallback } from 'react';
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
import {
    downloadExcelTemplate,
    exportToExcelFile,
    exportToCSVFile,
    generateBatchPayload
} from './excelUtils';
import ConfirmModal from '../ConfirmModal';
import Toast from '../Toast';
import { ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react';

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
    onEditRow = null,
    customActions = null,
    bulkActions = null,
    topContent = null,
    bottomContent = null,
    extraFilters = null,
    emptyMessage = 'No records found',
    initialPageSize = 100,
    enablePagination = true,
    showFormulaBar = true
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

    const mergedColumns = useMemo(() => [...columns, ...extraColumns], [columns, extraColumns]);

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
        showToast
    });

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

        const hasErrors = grid.gridData.some(
            (r) => r._errors && Object.keys(r._errors).length > 0
        );
        if (hasErrors) {
            showToast('error', 'Validation Error', 'Please fix red highlighted validation errors before saving');
            return;
        }

        const payload = generateBatchPayload(
            grid.gridData,
            grid.originalDataMap,
            primaryKey,
            grid.deletedIds,
            mergedColumns
        );

        setIsSaving(true);
        try {
            await onSave(payload);
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            grid.setDeletedIds(new Set());
            grid.setGridData((prev) =>
                prev.map((r) => ({
                    ...r,
                    _status: 'saved',
                    _errors: {}
                }))
            );
            showToast('success', 'Saved', 'All spreadsheet changes saved successfully');
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Save failed:', err);
            showToast(
                'error',
                'Save Failed',
                err.response?.data?.message || err.message || 'Failed to save changes'
            );
        } finally {
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

    // Commit import from modal
    const handleCommitImport = (importedRows, mode = 'append') => {
        grid.pushUndoState(grid.gridData);
        if (mode === 'append') {
            grid.setGridData((prev) => [...importedRows, ...prev]);
        } else {
            grid.setGridData(importedRows);
        }
        showToast(
            'sparkle',
            'Imported',
            `Successfully imported ${importedRows.length} ${entityName.toLowerCase()} row(s). Click "Save Changes" to save to cloud.`
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
                canUndo={grid.canUndo}
                canRedo={grid.canRedo}
                onUndo={grid.undo}
                onRedo={grid.redo}
                onAddRows={grid.handleAddRows}
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
                onOpenAddColumn={() => setIsAddColumnModalOpen(true)}
                onDownloadTemplate={() => downloadExcelTemplate(mergedColumns, entityName)}
                onExportCSV={() => exportToCSVFile(grid.sortedGridData, mergedColumns, entityName)}
                onExportExcel={() => exportToExcelFile(grid.sortedGridData, mergedColumns, entityName)}
                onOpenShortcutsModal={() => grid.setIsShortcutsModalOpen(true)}
                canWrite={canWrite}
                customActions={customActions}
                bulkActions={bulkActions}
                extraFilters={extraFilters}
            />

            {/* Formula / Active Cell Address Bar */}
            {showFormulaBar && (
                <ExcelFormulaBar
                    selectionFocus={grid.selectionFocus}
                    columns={mergedColumns}
                    sortedGridData={grid.sortedGridData}
                    onChangeValue={grid.handleCellChange}
                    onOpenFindReplace={() => {
                        grid.setFindReplaceMode('find');
                        grid.setIsFindReplaceOpen(true);
                    }}
                    canWrite={canWrite}
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
                onOpenAddColumn={() => setIsAddColumnModalOpen(true)}
                onStartEditing={(rowIndex, colKey) => grid.setEditingCell({ rowIndex, colKey })}
                onStopEditing={grid.handleCellBlur}
                onChangeValue={grid.handleCellChange}
                onCellKeyDown={grid.handleCellKeyDown}
                onContextMenu={(e, rowIndex, colIndex) => {
                    e.preventDefault();
                    e.stopPropagation();
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
                onEditRow={onEditRow}
                onDeleteRow={handleRequestDeleteRow}
                emptyMessage={emptyMessage}
                onAddRows={grid.handleAddRows}
                onOpenImportModal={(tab) => {
                    setImportModalTab(tab);
                    setIsImportModalOpen(true);
                }}
                currentPage={grid.currentPage}
                pageSize={grid.pageSize}
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
                onPaste={grid.executePaste}
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
            <ExcelAddColumnModal
                isOpen={isAddColumnModalOpen}
                onClose={() => setIsAddColumnModalOpen(false)}
                onAddColumn={handleAddColumn}
                existingColumns={mergedColumns}
            />

            {/* Keyboard Shortcuts Reference Modal */}
            <ExcelShortcutsModal
                isOpen={grid.isShortcutsModalOpen}
                onClose={() => grid.setIsShortcutsModalOpen(false)}
            />
        </div>
    );
};

export default ExcelGrid;
