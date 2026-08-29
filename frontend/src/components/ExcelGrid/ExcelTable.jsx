import React, { useRef, useCallback, useState, useEffect } from 'react';
import { ExcelCell } from './ExcelCell';
import { ArrowUp, ArrowDown, Eye, Trash2, Check, Plus, Table as TableIcon } from 'lucide-react';
import { getColumnLetter } from './excelUtils';

const CustomCheckbox = ({ checked, onChange, title }) => (
    <div
        onClick={onChange}
        title={title}
        className={`w-4 h-4 rounded border transition-all flex items-center justify-center cursor-pointer select-none ${checked
                ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500 shadow-xs'
                : 'border-gray-300 dark:border-white/20 bg-white dark:bg-[#161b22] hover:border-blue-400'
            }`}
    >
        {checked && <Check size={11} className="stroke-[3]" />}
    </div>
);

export const ExcelTable = ({
    columns = [],
    sortedGridData = [],
    paginatedGridData = [],
    originalDataMap = new Map(),
    primaryKey = 'id',
    canWrite = true,
    isLoading = false,
    selectedIds = new Set(),
    lastSelectedId = null,
    setSelectedIds,
    setLastSelectedId,
    selectionAnchor,
    selectionFocus,
    selectionBounds,
    copiedBounds = null,
    editingCell,
    isMouseDown,
    setIsMouseDown,
    sortConfig,
    onSort,
    customColWidths = {},
    setCustomColWidths,
    onColumnHeaderDoubleClick,
    onSelectCell,
    onCellMouseDown,
    onCellMouseEnter,
    onSelectRowHeader,
    onRowHeaderMouseEnter,
    onSelectColumnHeader,
    onColumnHeaderMouseEnter,
    onSelectAllCells,
    onOpenAddColumn,
    onStartEditing,
    onStopEditing,
    onChangeValue,
    onCellKeyDown,
    onContextMenu,
    onStartFillDrag,
    onAutoFillDown,
    onOpenDropdownPortal,
    onViewRow = null,
    onDeleteRow = null,
    emptyMessage = 'No records found',
    onAddRows = null,
    onOpenImportModal = null,
    currentPage = 1,
    pageSize = 100,
    findHighlightConfig = null
}) => {
    // Select All Rows toggle
    const handleToggleSelectAll = () => {
        if (selectedIds.size === sortedGridData.length && sortedGridData.length > 0) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(sortedGridData.map((r) => r[primaryKey]));
            setSelectedIds(allIds);
        }
    };

    // Toggle single row selection with Shift+Click range support
    const handleToggleSelectRow = (e, rowId) => {
        e.stopPropagation();
        const newSelected = new Set(selectedIds);

        if (e.shiftKey && lastSelectedId) {
            const lastIdx = sortedGridData.findIndex((r) => r[primaryKey] === lastSelectedId);
            const curIdx = sortedGridData.findIndex((r) => r[primaryKey] === rowId);

            if (lastIdx !== -1 && curIdx !== -1) {
                const start = Math.min(lastIdx, curIdx);
                const end = Math.max(lastIdx, curIdx);
                for (let i = start; i <= end; i++) {
                    newSelected.add(sortedGridData[i][primaryKey]);
                }
                setSelectedIds(newSelected);
                return;
            }
        }

        if (newSelected.has(rowId)) {
            newSelected.delete(rowId);
        } else {
            newSelected.add(rowId);
        }

        setSelectedIds(newSelected);
        setLastSelectedId(rowId);
    };

    // Interactive Column Drag Resizing
    const resizingColRef = useRef(null);

    const handleResizeMouseDown = (e, colKey, initialWidth) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = parseInt(initialWidth, 10) || 160;

        const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(80, Math.min(600, startWidth + deltaX));
            if (setCustomColWidths) {
                setCustomColWidths((prev) => ({
                    ...prev,
                    [colKey]: `${newWidth}px`
                }));
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const hasActions = Boolean(onViewRow || onDeleteRow);

    return (
        <div
            data-excel-grid="true"
            tabIndex={0}
            className="flex-1 min-h-0 relative overflow-auto scrollbar-thin table-scrollbar theme-scrollbar bg-white dark:bg-[#0d1117] outline-none"
        >
            <table className="w-full border-collapse text-left table-fixed">
                {/* ─── STICKY HEADER ─── */}
                <thead className="sticky top-0 z-30 bg-gray-50/95 dark:bg-[#161b22]/95 backdrop-blur border-b border-gray-200 dark:border-white/10 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none">
                    <tr>
                        {/* Checkbox Column */}
                        <th className="px-3 py-2.5 w-10 min-w-10 max-w-10 text-center border-r border-gray-150 dark:border-white/5">
                            <div className="flex justify-center">
                                <CustomCheckbox
                                    checked={
                                        sortedGridData.length > 0 && selectedIds.size === sortedGridData.length
                                    }
                                    onChange={handleToggleSelectAll}
                                    title="Select All"
                                />
                            </div>
                        </th>

                        {/* Row Number Column */}
                        <th className="px-3 py-2.5 w-11 min-w-11 max-w-11 text-center border-r border-gray-150 dark:border-white/5 font-mono text-[10px]">
                            #
                        </th>

                        {/* Status Column */}
                        <th className="px-1 py-2.5 w-[78px] min-w-[78px] max-w-[78px] text-center border-r border-gray-150 dark:border-white/5">
                            Status
                        </th>

                        {/* Data Columns */}
                        {columns.map((col, colIndex) => {
                            const currentWidth = customColWidths[col.key] || col.width || '160px';
                            const widthStyle = { width: currentWidth, minWidth: currentWidth };
                            const colLetter = getColumnLetter(colIndex);

                            return (
                                <th
                                    key={col.key}
                                    style={widthStyle}
                                    onClick={() => onSort && onSort(col.key)}
                                    className="px-3 py-2.5 border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition truncate relative group/th"
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="font-mono text-[9px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 rounded font-bold">
                                                {colLetter}
                                            </span>
                                            <span className="truncate font-semibold text-gray-800 dark:text-gray-200">
                                                {col.label || col.key}
                                                {col.required && <span className="text-red-500 ml-0.5">*</span>}
                                            </span>
                                        </div>
                                        {sortConfig?.key === col.key && (
                                            <span className="shrink-0 text-blue-500">
                                                {sortConfig.direction === 'asc' ? (
                                                    <ArrowUp size={12} />
                                                ) : (
                                                    <ArrowDown size={12} />
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    {/* Interactive Column Resize Handle */}
                                    <div
                                        onMouseDown={(e) => handleResizeMouseDown(e, col.key, currentWidth)}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            onColumnHeaderDoubleClick(col.key, col.label || col.key);
                                        }}
                                        className="absolute right-0 top-0 bottom-0 w-1.5 hover:w-2 hover:bg-blue-500/60 cursor-col-resize z-40 transition-colors"
                                        title="Drag to resize width, double-click to Auto-Fit"
                                    />
                                </th>
                            );
                        })}

                        {/* + Add Column Header Button */}
                        {canWrite && onOpenAddColumn && (
                            <th
                                onClick={onOpenAddColumn}
                                className="px-2.5 py-2.5 w-10 min-w-10 max-w-10 text-center border-r border-gray-150 dark:border-white/5 cursor-pointer hover:bg-blue-100/70 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors select-none group/addcol"
                                title="Add New Column (+)"
                            >
                                <div className="flex items-center justify-center">
                                    <Plus size={14} className="stroke-[2.5] group-hover/addcol:scale-125 transition-transform" />
                                </div>
                            </th>
                        )}

                        {/* Actions Column */}
                        {hasActions && (
                            <th className="px-3 py-2.5 w-20 min-w-20 max-w-20 text-center">Actions</th>
                        )}
                    </tr>
                </thead>

                {/* ─── TABLE BODY ─── */}
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {/* Skeleton Loading State */}
                    {isLoading && sortedGridData.length === 0 ? (
                        Array.from({ length: 10 }).map((_, i) => (
                            <tr key={`skel-row-${i}`} className="animate-pulse">
                                {Array.from({ length: columns.length + (hasActions ? 4 : 3) }).map((_, j) => (
                                    <td
                                        key={`skel-cell-${i}-${j}`}
                                        className="px-3 py-3.5 border border-gray-100 dark:border-white/5"
                                    >
                                        <div className="h-3 bg-gray-100 dark:bg-white/5 rounded" />
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : sortedGridData.length === 0 ? (
                        /* Empty State */
                        <tr>
                            <td colSpan={columns.length + (hasActions ? 4 : 3)} className="py-24 text-center">
                                <div className="flex flex-col items-center gap-3">
                                    <TableIcon className="text-gray-300 dark:text-white/10" size={44} />
                                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                                        {emptyMessage}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Import an Excel spreadsheet, paste copied cells from Excel, or click below to start.
                                    </p>
                                    {canWrite && (
                                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                            {onAddRows && (
                                                <button
                                                    type="button"
                                                    onClick={() => onAddRows(1)}
                                                    className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition cursor-pointer shadow-xs"
                                                >
                                                    + Add First Row
                                                </button>
                                            )}
                                            {onOpenImportModal && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenImportModal('upload')}
                                                    className="px-3.5 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-xs font-bold transition cursor-pointer"
                                                >
                                                    Import Spreadsheet
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ) : (
                        /* Data Rows */
                        paginatedGridData.map((row, index) => {
                            const rowIndex =
                                pageSize === 'All' ? index : (currentPage - 1) * Number(pageSize) + index;
                            const rowId = row[primaryKey] || `row-${rowIndex}`;
                            const isNew = row._status === 'new' || String(rowId).startsWith('temp_');
                            const isError = row._status === 'error' || (row._errors && Object.keys(row._errors).length > 0);
                            const isModified = row._status === 'modified';
                            const isRowSelected = selectedIds.has(rowId);
                            const originalRow = originalDataMap.get(rowId);

                            return (
                                <tr
                                    key={rowId}
                                    onContextMenu={(e) => onContextMenu(e, rowIndex, 0)}
                                    className={`hover:bg-blue-50/20 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 ${isRowSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                                        }`}
                                >
                                    {/* Checkbox */}
                                    <td className="px-3 py-2 text-center border-r border-gray-100 dark:border-white/5 select-none">
                                        <div className="flex justify-center">
                                            <CustomCheckbox
                                                checked={isRowSelected}
                                                onChange={(e) => handleToggleSelectRow(e, rowId)}
                                                title="Select Row"
                                            />
                                        </div>
                                    </td>

                                    {/* Row # */}
                                    <td className="px-3 py-2 text-center font-mono text-[10px] text-gray-400 border-r border-gray-100 dark:border-white/5 select-none bg-gray-50/50 dark:bg-white/[0.01]">
                                        {rowIndex + 1}
                                    </td>

                                    {/* Status Badge */}
                                    <td className="px-1 py-2 text-center border-r border-gray-100 dark:border-white/5 select-none">
                                        {isNew ? (
                                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 whitespace-nowrap">
                                                NEW
                                            </span>
                                        ) : isError ? (
                                            <span
                                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-500/20 whitespace-nowrap cursor-help"
                                                title="Validation error in row"
                                            >
                                                ERROR
                                            </span>
                                        ) : isModified ? (
                                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 whitespace-nowrap">
                                                MODIFIED
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 whitespace-nowrap">
                                                SAVED
                                            </span>
                                        )}
                                    </td>

                                    {/* Grid Cells */}
                                    {columns.map((col, colIndex) => {
                                        const isDirtyCell =
                                            !isNew &&
                                            originalRow &&
                                            String(row[col.key] ?? '').trim() !==
                                            String(originalRow[col.key] ?? '').trim();

                                        const isCopied =
                                            copiedBounds &&
                                            rowIndex >= copiedBounds.minRow &&
                                            rowIndex <= copiedBounds.maxRow &&
                                            colIndex >= copiedBounds.minCol &&
                                            colIndex <= copiedBounds.maxCol;

                                        let isFindMatch = false;
                                        if (findHighlightConfig && findHighlightConfig.query && !col.readOnly) {
                                            const cellVal = String(row[col.key] ?? '');
                                            const q = findHighlightConfig.matchCase
                                                ? findHighlightConfig.query
                                                : findHighlightConfig.query.toLowerCase();
                                            const target = findHighlightConfig.matchCase
                                                ? cellVal
                                                : cellVal.toLowerCase();
                                            isFindMatch = findHighlightConfig.matchExact
                                                ? target === q
                                                : target.includes(q);
                                        }

                                        const isFindCurrentMatch =
                                            isFindMatch &&
                                            selectionFocus?.r === rowIndex &&
                                            selectionFocus?.c === colIndex;

                                        return (
                                            <ExcelCell
                                                key={col.key}
                                                value={row[col.key]}
                                                row={row}
                                                column={col}
                                                rowIndex={rowIndex}
                                                colIndex={colIndex}
                                                selectionAnchor={selectionAnchor}
                                                selectionFocus={selectionFocus}
                                                selectionBounds={selectionBounds}
                                                isCopied={isCopied}
                                                editingCell={editingCell}
                                                isDirtyCell={isDirtyCell}
                                                error={row._errors?.[col.key]}
                                                canWrite={canWrite}
                                                customColWidth={customColWidths[col.key]}
                                                onSelectCell={onSelectCell}
                                                onCellMouseDown={onCellMouseDown}
                                                onCellMouseEnter={onCellMouseEnter}
                                                onStartEditing={onStartEditing}
                                                onStopEditing={onStopEditing}
                                                onChangeValue={onChangeValue}
                                                onKeyDown={onCellKeyDown}
                                                onContextMenu={onContextMenu}
                                                onStartFillDrag={onStartFillDrag}
                                                onAutoFillDown={onAutoFillDown}
                                                onOpenDropdownPortal={onOpenDropdownPortal}
                                                isFindMatch={isFindMatch}
                                                isFindCurrentMatch={isFindCurrentMatch}
                                                findHighlightQuery={findHighlightConfig?.query}
                                                findHighlightMatchCase={findHighlightConfig?.matchCase}
                                            />
                                        );
                                    })}

                                    {/* + Column Empty Body Cell */}
                                    {canWrite && onOpenAddColumn && (
                                        <td className="px-2 py-2 border-r border-b border-gray-100 dark:border-white/5 bg-gray-50/20 dark:bg-white/[0.005] select-none text-center" />
                                    )}

                                    {/* Action Buttons */}
                                    {hasActions && (
                                        <td className="px-3 py-2 text-center border-b border-gray-100 dark:border-white/5 select-none">
                                            <div className="flex items-center justify-center gap-1">
                                                {onViewRow && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onViewRow(row)}
                                                        className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 hover:text-blue-600 rounded transition cursor-pointer"
                                                        title="View Details"
                                                    >
                                                        <Eye size={13} />
                                                    </button>
                                                )}
                                                {canWrite && onDeleteRow && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteRow(row)}
                                                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-500 hover:text-red-600 rounded transition cursor-pointer"
                                                        title="Delete Row"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {/* Quick "+ Add Row" Button Below Table */}
            {paginatedGridData.length > 0 && canWrite && onAddRows && (
                <div className="p-3 flex items-center">
                    <button
                        type="button"
                        onClick={() => onAddRows(1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#161b22] hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700/60 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                        title="Add a new row below"
                    >
                        <Plus size={13} className="stroke-[2.5] text-blue-600 dark:text-blue-400" />
                        <span>Add Row</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExcelTable;
