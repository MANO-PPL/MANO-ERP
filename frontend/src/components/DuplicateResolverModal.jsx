import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { customToast } from '../utils/toast';
import { mergeDuplicateGroup, getUniqueKeyColumn, getRowUniqueValue, findAllDuplicateGroups } from './ExcelGrid/excelUtils';
import { ExcelTable } from './ExcelGrid/ExcelTable';
import { useExcelGrid } from './ExcelGrid/useExcelGrid';

/**
 * DuplicateResolverModal - Sliding Sidebar Drawer Popup for Duplicate Resolution
 * Renders the exact same Excel Grid used across the platform for full visual and behavioral consistency.
 * Dropdowns use custom portal dropdowns with search and options.
 */
const DuplicateResolverModal = ({
    isOpen,
    onClose,
    title,
    entityName = 'Items',
    items = [],
    gridData,
    columns = [],
    primaryKey = 'id',
    getKey,
    getLabel,
    getSubLabel,
    onConfirm,
    onDeleteDuplicates,
    onMergeGroup,
    onMergeAll,
    onViewRow,
    onUpdateCell
}) => {
    const rawData = items || gridData || [];
    const handleConfirmCallback = onConfirm || onDeleteDuplicates;

    const [groupMasterMap, setGroupMasterMap] = useState({}); // { [groupKey]: masterRowId }

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (onClose) onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onClose]);

    const resolveKey = useCallback(
        (row) => {
            if (getKey && typeof getKey === 'function') return getKey(row);
            const uniqueCol = getUniqueKeyColumn(columns);
            const val = getRowUniqueValue(row, uniqueCol);
            if (val) return val;
            if (row[primaryKey] !== undefined && primaryKey !== 'id') {
                return String(row[primaryKey] || '').trim().toLowerCase();
            }
            return String(row.name || row.title || row.code || '').trim().toLowerCase();
        },
        [getKey, columns, primaryKey]
    );

    const resolveLabel = useCallback(
        (row) => {
            if (getLabel && typeof getLabel === 'function') return getLabel(row);
            return row.name || row.item_name || row.company_name || row.party_name || row.title || row.code || 'Unnamed Record';
        },
        [getLabel]
    );

    // Compute duplicate groups with useMemo
    const duplicateGroups = useMemo(() => {
        if (!isOpen || !rawData || rawData.length === 0) return [];

        if (columns && columns.length > 0) {
            const found = findAllDuplicateGroups(rawData, columns, primaryKey);
            if (found && found.length > 0) {
                return found;
            }
        }

        const groupsMap = new Map();
        rawData.forEach((row) => {
            const key = resolveKey(row);
            if (!key) return;

            if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
            }
            groupsMap.get(key).push(row);
        });

        const dupGroups = [];
        groupsMap.forEach((rows, key) => {
            if (rows.length > 1) {
                dupGroups.push({
                    key,
                    original: rows[0],
                    duplicates: rows.slice(1),
                    allRows: rows
                });
            }
        });

        return dupGroups;
    }, [isOpen, rawData, columns, primaryKey, resolveKey]);

    // Initialize default master row selection for each group
    useEffect(() => {
        if (!isOpen) {
            setGroupMasterMap({});
            return;
        }

        const initialMasterMap = {};
        duplicateGroups.forEach((g) => {
            const masterId = g.original[primaryKey] ?? g.original.id ?? g.original.name;
            initialMasterMap[g.key] = masterId;
        });

        setGroupMasterMap(initialMasterMap);
    }, [isOpen, duplicateGroups, primaryKey]);

    // Set designated Master record for a specific duplicate group
    const handleSetMaster = useCallback((groupKey, row) => {
        const rowId = row[primaryKey] ?? row.id ?? row.name;
        setGroupMasterMap((prev) => ({ ...prev, [groupKey]: rowId }));
    }, [primaryKey]);

    // Filter view mode: 'all' to show all rows (default per user request), 'duplicates' to isolate conflicts
    const [viewFilter, setViewFilter] = useState('all');

    // Count of unique duplicate rows across all conflict groups
    const duplicateRowsCount = useMemo(() => {
        let count = 0;
        const seen = new Set();
        duplicateGroups.forEach((g) => {
            g.allRows.forEach((r) => {
                const id = r[primaryKey] ?? r.id ?? r.name;
                if (!seen.has(String(id))) {
                    seen.add(String(id));
                    count++;
                }
            });
        });
        return count;
    }, [duplicateGroups, primaryKey]);

    // All rows from dataset enriched with duplicate status and conflict group keys
    const allGridRows = useMemo(() => {
        const dupRowMap = new Map();
        duplicateGroups.forEach((g) => {
            g.allRows.forEach((r) => {
                const id = r[primaryKey] ?? r.id ?? r.name;
                dupRowMap.set(String(id), {
                    groupKey: g.key,
                    columnKey: g.columnKey
                });
            });
        });

        return (rawData || []).map((row) => {
            const id = row[primaryKey] ?? row.id ?? row.name;
            const dupInfo = dupRowMap.get(String(id));
            if (dupInfo) {
                const codeKey = dupInfo.columnKey || 'code';
                const codeVal = row[codeKey] || '';
                const errText = `Resource code already exists: "${codeVal}". Resource code must be strictly unique. Please change it.`;
                return {
                    ...row,
                    _status: 'duplicate',
                    _duplicateGroupKey: dupInfo.groupKey,
                    _duplicateColumnKey: dupInfo.columnKey,
                    _errors: {
                        ...(row._errors || {}),
                        [codeKey]: row._errors?.[codeKey] || errText
                    }
                };
            }
            return {
                ...row,
                _status: row._status || 'saved'
            };
        });
    }, [rawData, duplicateGroups, primaryKey]);

    // Active rows according to current view filter
    const activeRows = useMemo(() => {
        if (viewFilter === 'duplicates') {
            return allGridRows.filter((r) => Boolean(r._duplicateGroupKey));
        }
        return allGridRows;
    }, [viewFilter, allGridRows]);

    // Table columns matching platform ExcelGrid with Master indicator column
    const tableColumns = useMemo(() => {
        const masterCol = {
            key: '_is_master_record',
            label: 'Keep (Master)',
            width: '125px',
            minWidth: '115px',
            readOnly: true,
            renderCell: (val, row) => {
                const groupKey = row._duplicateGroupKey;
                if (!groupKey) {
                    return <span className="text-gray-300 dark:text-gray-600 text-xs text-center block select-none">—</span>;
                }
                const chosenMasterId = groupMasterMap[groupKey];
                const isMaster = String(row[primaryKey] ?? row.id ?? row.name) === String(chosenMasterId);
                return (
                    <div className="flex items-center justify-center w-full h-full">
                        {isMaster ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider shadow-2xs">
                                Master (Keep)
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetMaster(groupKey, row);
                                }}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 border border-gray-200 dark:border-white/10 hover:border-emerald-500 bg-white dark:bg-white/5 transition cursor-pointer"
                            >
                                Set as Master
                            </button>
                        )}
                    </div>
                );
            }
        };

        const cols = (columns || []).filter((c) => {
            const k = c.key || c.accessor;
            return k && !k.startsWith('_') && k !== primaryKey;
        });

        // Fallback columns if columns array was empty
        let entityCols = cols;
        if (entityCols.length === 0 && rawData.length > 0) {
            const sample = rawData[0];
            entityCols = Object.keys(sample)
                .filter((k) => !k.startsWith('_') && k !== primaryKey)
                .map((k) => ({
                    key: k,
                    label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')
                }));
        }

        return [masterCol, ...entityCols];
    }, [columns, rawData, groupMasterMap, primaryKey, handleSetMaster]);

    // Instantiate ExcelGrid hook for full platform table consistency and custom dropdowns
    const grid = useExcelGrid({
        data: activeRows,
        columns: tableColumns,
        primaryKey,
        canWrite: true,
        initialPageSize: 1000,
        showToast: customToast,
        onCellChange: (rowIndex, colKey, val, isAtomic, targetRowObj) => {
            const rowId = targetRowObj ? targetRowObj[primaryKey] : null;
            if (onUpdateCell) {
                onUpdateCell(rowIndex, colKey, val, isAtomic, rowId);
            }
        }
    });

    // Delete single duplicate copy
    const handleDeleteSingleRow = useCallback((row) => {
        const rowId = row[primaryKey] ?? row.id ?? row.name;
        if (!rowId) return;
        if (onDeleteDuplicates) {
            onDeleteDuplicates([rowId]);
        } else if (handleConfirmCallback) {
            handleConfirmCallback([rowId]);
        }
    }, [onDeleteDuplicates, handleConfirmCallback, primaryKey]);

    // Delete multiple selected duplicate copies
    const handleDeleteSelected = () => {
        if (grid.selectedIds.size === 0) return;
        const ids = Array.from(grid.selectedIds);
        if (onDeleteDuplicates) {
            onDeleteDuplicates(ids);
        } else if (handleConfirmCallback) {
            handleConfirmCallback(ids);
        }
        grid.setSelectedIds(new Set());
    };

    // Execute Merge on a single duplicate group
    const handleExecuteMergeGroup = (group) => {
        const chosenMasterId = groupMasterMap[group.key];
        const masterRow =
            group.allRows.find((r) => String(r[primaryKey] ?? r.id ?? r.name) === String(chosenMasterId)) ||
            group.original;
        const duplicateRows = group.allRows.filter((r) => r !== masterRow);

        const { mergedMasterRow, duplicateRowIds } = mergeDuplicateGroup(
            masterRow,
            duplicateRows,
            columns,
            primaryKey
        );

        if (onMergeGroup && typeof onMergeGroup === 'function') {
            onMergeGroup(mergedMasterRow, duplicateRowIds);
        } else if (handleConfirmCallback) {
            handleConfirmCallback(duplicateRowIds);
            customToast.success(
                `Merged duplicate copies into "${resolveLabel(masterRow)}".`,
                'Group Merged'
            );
        }
    };

    // Execute Merge across all duplicate groups
    const handleExecuteMergeAll = () => {
        if (duplicateGroups.length === 0) return;

        const mergedMasterRows = [];
        const allDuplicateRowIds = [];

        duplicateGroups.forEach((group) => {
            const chosenMasterId = groupMasterMap[group.key];
            const masterRow =
                group.allRows.find((r) => String(r[primaryKey] ?? r.id ?? r.name) === String(chosenMasterId)) ||
                group.original;
            const duplicateRows = group.allRows.filter((r) => r !== masterRow);

            const { mergedMasterRow, duplicateRowIds } = mergeDuplicateGroup(
                masterRow,
                duplicateRows,
                columns,
                primaryKey
            );

            mergedMasterRows.push(mergedMasterRow);
            duplicateRowIds.forEach((id) => allDuplicateRowIds.push(id));
        });

        if (onMergeAll && typeof onMergeAll === 'function') {
            onMergeAll(mergedMasterRows, allDuplicateRowIds);
        } else if (onMergeGroup && typeof onMergeGroup === 'function') {
            mergedMasterRows.forEach((master, idx) => {
                const group = duplicateGroups[idx];
                const dupIds = group.allRows
                    .filter((r) => String(r[primaryKey]) !== String(master[primaryKey]))
                    .map((r) => r[primaryKey]);
                onMergeGroup(master, dupIds);
            });
        } else if (handleConfirmCallback) {
            handleConfirmCallback(allDuplicateRowIds);
            customToast.success(
                `Merged all ${allDuplicateRowIds.length} duplicate copy/copies into ${mergedMasterRows.length} single record(s).`,
                'All Duplicates Merged'
            );
        }

        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs transition-opacity">
                {/* Backdrop Click */}
                <div className="absolute inset-0" onClick={onClose} />

                {/* Sliding Sidebar Drawer */}
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                    className="relative bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-6xl xl:max-w-7xl h-full flex flex-col overflow-hidden"
                >
                    {/* Drawer Header - Clean, No Cluttering Icons or Verbose Descriptions */}
                    <div className="px-6 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/90 dark:bg-white/[0.02] shrink-0">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>Resolve Duplicates</span>
                                {duplicateGroups.length > 0 ? (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                        {duplicateGroups.length} {duplicateGroups.length === 1 ? 'Conflict Group' : 'Conflict Groups'}
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                        All Unique
                                    </span>
                                )}
                            </h3>
                        </div>

                        {/* Top View Filter Toggle: All Rows (N) vs Duplicates Only (N) */}
                        <div className="flex items-center gap-3">
                            <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] p-0.5 text-xs font-semibold shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => setViewFilter('all')}
                                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                                        viewFilter === 'all'
                                            ? 'bg-blue-600 text-white shadow-2xs font-bold'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    All Rows ({allGridRows.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewFilter('duplicates')}
                                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                                        viewFilter === 'duplicates'
                                            ? 'bg-blue-600 text-white shadow-2xs font-bold'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    Duplicates Only ({duplicateRowsCount})
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Conflict Groups Header Sub-bar */}
                    {duplicateGroups.length > 0 && (
                        <div className="px-4 py-2 bg-gray-50/80 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 shrink-0 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                {duplicateGroups.map((g, gIdx) => {
                                    const isCode = ['code', 'item_code', 'resource_code'].includes((g.columnKey || '').toLowerCase());
                                    const label = isCode ? `Code Conflict: "${g.original?.code || g.label}"` : `Duplicate: "${g.label}"`;
                                    return (
                                        <div
                                            key={g.key || gIdx}
                                            className="flex items-center gap-2 px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs"
                                        >
                                            <span className="font-bold text-amber-900 dark:text-amber-200">{label}</span>
                                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                                ({g.allRows.length} rows)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleExecuteMergeGroup(g)}
                                                className="px-2 py-0.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-2xs cursor-pointer ml-1"
                                                title="Merge copies into Master and keep 1 record"
                                            >
                                                Merge into 1
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {duplicateGroups.length > 1 && (
                                <button
                                    type="button"
                                    onClick={handleExecuteMergeAll}
                                    className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-xs cursor-pointer"
                                >
                                    Merge All
                                </button>
                            )}
                        </div>
                    )}

                    {duplicateGroups.length === 0 && (
                        <div className="px-4 py-2 bg-emerald-50/80 dark:bg-emerald-950/20 border-b border-emerald-200 dark:border-emerald-800/30 shrink-0 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                            <span className="font-semibold">✓ All duplicate records resolved! All codes and identifiers are strictly unique.</span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Click Done to return to sheet</span>
                        </div>
                    )}

                    {/* Main Interactive Excel Grid Table - Identical to platform grid */}
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] relative">
                        <ExcelTable
                            columns={tableColumns}
                            sortedGridData={grid.sortedGridData}
                            paginatedGridData={grid.paginatedGridData}
                            originalDataMap={grid.originalDataMap}
                            primaryKey={primaryKey}
                            canWrite={true}
                            isLoading={false}
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
                            onSort={(key) =>
                                grid.setSortConfig((prev) => ({
                                    key,
                                    direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
                                }))
                            }
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
                            onStartEditing={grid.handleStartEditing || ((rowIndex, colKey) => grid.setEditingCell({ rowIndex, colKey }))}
                            onStopEditing={grid.handleCellBlur}
                            onChangeValue={grid.handleCellChange}
                            onCellKeyDown={grid.handleCellKeyDown}
                            onEditorValueChange={grid.handleEditorValueChange}
                            onPasteCell={grid.executePaste}
                            onStartFillDrag={() => grid.setIsFillDragging(true)}
                            onAutoFillDown={grid.handleAutoFillDown}
                            onViewRow={onViewRow}
                            onDeleteRow={(row) => handleDeleteSingleRow(row)}
                            emptyMessage="No records found in this view"
                        />
                    </div>

                    {/* Drawer Footer Actions */}
                    <div className="px-6 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/90 dark:bg-white/[0.02] shrink-0">
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {grid.selectedIds.size > 0
                                ? `${grid.selectedIds.size} row(s) selected`
                                : duplicateGroups.length > 0
                                ? 'Double-click any cell to edit Code, Name, Type, Unit, or Rate.'
                                : 'All duplicates resolved.'}
                        </div>

                        <div className="flex items-center gap-2">
                            {grid.selectedIds.size > 0 && (
                                <button
                                    type="button"
                                    onClick={handleDeleteSelected}
                                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    <Trash2 size={13} />
                                    <span>Delete Selected ({grid.selectedIds.size})</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/15 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DuplicateResolverModal;
