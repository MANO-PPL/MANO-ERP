import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGridState } from './useGridState';
import { GridToolbar } from './GridToolbar';
import { GridTable } from './GridTable';
import { stringifyTSV, parseTSV } from './gridUtils';
import { toast } from 'react-toastify';

export const DynamicExcelEditor = ({ config, initialData = [], onRefresh, onBackToList }) => {
    const gridRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);

    const {
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
        canUndo,
        canRedo,
        dirtyCounts,
        getBatchPayload
    } = useGridState({ config, initialData });


    // Handle cell selection
    const handleSelectCell = useCallback(
        (rowIndex, colIndex, isShiftPressed) => {
            if (isShiftPressed && selectedCell) {
                setSelectionEndCell({ rowIndex, colIndex });
            } else {
                setSelectedCell({ rowIndex, colIndex });
                setSelectionEndCell({ rowIndex, colIndex });
            }
        },
        [selectedCell, setSelectedCell, setSelectionEndCell]
    );

    // Navigate cell using Arrow keys or Tab/Enter
    const handleNavigate = useCallback(
        (direction) => {
            if (!selectedCell) return;
            let { rowIndex, colIndex } = selectedCell;

            if (direction === 'UP' && rowIndex > 0) rowIndex -= 1;
            if (direction === 'DOWN' && rowIndex < rows.length - 1) rowIndex += 1;
            if (direction === 'LEFT' && colIndex > 0) colIndex -= 1;
            if (direction === 'RIGHT' && colIndex < columns.length - 1) colIndex += 1;

            setSelectedCell({ rowIndex, colIndex });
            setSelectionEndCell({ rowIndex, colIndex });
        },
        [selectedCell, rows.length, columns.length, setSelectedCell, setSelectionEndCell]
    );

    // Global keyboard listener for Excel shortcuts
    useEffect(() => {
        const handleKeyDown = async (e) => {
            // Ignore if active element is an input outside grid or inline editing active
            const activeElem = document.activeElement;
            const isTyping =
                activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'SELECT' || activeElem.tagName === 'TEXTAREA');

            if (isTyping && editingCell) {
                // Inline editing handles its own keys
                return;
            }

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            // Ctrl + C: Copy selected range to TSV
            if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
                if (!selectionBounds) return;
                e.preventDefault();
                const { minRow, maxRow, minCol, maxCol } = selectionBounds;

                const matrix = [];
                for (let r = minRow; r <= maxRow; r++) {
                    const rowData = rows[r];
                    if (rowData) {
                        const rowVals = [];
                        for (let c = minCol; c <= maxCol; c++) {
                            const colDef = columns[c];
                            rowVals.push(rowData[colDef.key] ?? '');
                        }
                        matrix.push(rowVals);
                    }
                }

                const tsvString = stringifyTSV(matrix);
                try {
                    await navigator.clipboard.writeText(tsvString);
                    toast.info(`Copied ${matrix.length} row(s) to clipboard`, { autoClose: 1500 });
                } catch (err) {
                    console.error('Failed to copy to clipboard', err);
                }
                return;
            }

            // Ctrl + V: Paste TSV into grid
            if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
                if (!selectedCell) return;
                e.preventDefault();
                try {
                    const clipboardText = await navigator.clipboard.readText();
                    const matrix = parseTSV(clipboardText);
                    if (matrix.length > 0) {
                        pasteMatrix(matrix);
                        toast.success(`Pasted matrix into grid`, { autoClose: 1500 });
                    }
                } catch (err) {
                    console.error('Failed to read clipboard', err);
                    toast.error('Clipboard permission denied or empty');
                }
                return;
            }

            // Ctrl + Z: Undo
            if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // Ctrl + Y / Ctrl + Shift + Z: Redo
            if ((isCtrlOrCmd && e.key.toLowerCase() === 'y') || (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z')) {
                e.preventDefault();
                redo();
                return;
            }

            // Delete / Backspace: Clear selection range
            if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (selectionBounds) {
                    e.preventDefault();
                    clearSelectedCells();
                }
                return;
            }

            // Arrow Key Navigation
            if (!isTyping && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                if (e.key === 'ArrowUp') handleNavigate('UP');
                if (e.key === 'ArrowDown') handleNavigate('DOWN');
                if (e.key === 'ArrowLeft') handleNavigate('LEFT');
                if (e.key === 'ArrowRight') handleNavigate('RIGHT');
                return;
            }

            // Enter key to start inline editing
            if (!isTyping && e.key === 'Enter' && selectedCell) {
                e.preventDefault();
                setEditingCell(selectedCell);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        selectedCell,
        selectionBounds,
        editingCell,
        rows,
        columns,
        pasteMatrix,
        clearSelectedCells,
        undo,
        redo,
        handleNavigate,
        setEditingCell
    ]);

    // Handle batch save trigger
    const handleSaveBatch = async () => {
        const payload = getBatchPayload();

        // Validate all rows before saving
        const hasErrors = rows.some((r) => r._errors && Object.keys(r._errors).length > 0);
        if (hasErrors) {
            toast.error('Please fix validation errors highlighted in red before saving');
            return;
        }

        setIsSaving(true);
        try {
            if (config.onSaveBatch) {
                await config.onSaveBatch(payload);
                toast.success('All grid modifications saved successfully');
                if (onRefresh) onRefresh();
            }
        } catch (err) {
            console.error('Batch save failed', err);
            toast.error(err.response?.data?.message || 'Failed to save batch changes');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div ref={gridRef} className="flex flex-col space-y-3 w-full h-full font-sans">
            {/* Toolbar Header */}
            <GridToolbar
                entityName={config.entityName || 'Items'}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onAddRow={addRow}
                onDuplicateRows={duplicateSelectedRows}
                onDeleteRows={deleteSelectedRows}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                dirtyCounts={dirtyCounts}
                isSaving={isSaving}
                onSaveBatch={handleSaveBatch}
                onRevert={() => onRefresh && onRefresh()}
                onBackToList={onBackToList}
            />

            {/* Grid Table Body */}
            <GridTable
                rows={rows}
                originalRowsMap={originalRowsMap}
                columns={columns}
                primaryKey={primaryKey}

                deletedRowIds={deletedRowIds}
                selectedCell={selectedCell}
                editingCell={editingCell}
                selectionBounds={selectionBounds}
                filteredRowIndices={filteredRowIndices}
                onSelectCell={handleSelectCell}
                onStartEditing={(r, c) => setEditingCell({ rowIndex: r, colIndex: c })}
                onStopEditing={() => setEditingCell(null)}
                onChangeValue={updateCell}
                onNavigate={handleNavigate}
            />

            {/* Excel Shortcuts Footer Guide */}
            <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-md text-[11px] text-slate-400 font-mono">
                <div className="flex items-center space-x-4">
                    <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Ctrl+C</kbd> Copy</span>
                    <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Ctrl+V</kbd> Paste</span>
                    <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Double Click / Enter</kbd> Edit</span>
                    <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Arrows</kbd> Navigate</span>
                    <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Ctrl+Z</kbd> Undo</span>
                </div>
                <div>
                    <span>Total Rows: <strong className="text-slate-200">{rows.length}</strong></span>
                </div>
            </div>
        </div>
    );
};

export default DynamicExcelEditor;
