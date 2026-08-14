import React from 'react';
import { GridCell } from './GridCell';
import { isCellInBounds } from './gridUtils';

export const GridTable = ({
    rows,
    originalRowsMap,
    columns,
    primaryKey,
    deletedRowIds,
    selectedCell,
    editingCell,
    selectionBounds,
    filteredRowIndices,
    onSelectCell,
    onStartEditing,
    onStopEditing,
    onChangeValue,
    onNavigate
}) => {

    return (
        <div className="overflow-auto flex-1 max-h-[calc(100vh-280px)] border border-slate-800 rounded-lg bg-slate-900/80 scrollbar-thin scrollbar-thumb-slate-700">
            <table className="w-full border-collapse text-left table-fixed">
                <thead className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold tracking-wider">
                    <tr>
                        {/* Index / Selection Column */}
                        <th className="w-14 px-2 py-2.5 text-center border-r border-slate-800 bg-slate-950 font-mono text-slate-500">
                            #
                        </th>
                        {/* Status Column */}
                        <th className="w-16 px-2 py-2.5 text-center border-r border-slate-800 bg-slate-950">
                            State
                        </th>
                        {/* Data Columns */}
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className="px-3 py-2.5 border-r border-slate-800 truncate"
                                style={{ width: col.width || '160px', minWidth: col.width || '160px' }}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>{col.label || col.key}</span>
                                    {col.required && <span className="text-red-400 text-xs">*</span>}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {filteredRowIndices.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length + 2}
                                className="px-4 py-8 text-center text-slate-500 text-sm font-sans"
                            >
                                No matching records found. Click "+ Add Row" to insert data.
                            </td>
                        </tr>
                    ) : (
                        filteredRowIndices.map((actualRowIndex, displayIndex) => {
                            const row = rows[actualRowIndex];
                            if (!row) return null;

                            const rowId = row[primaryKey];
                            const isNew = row._isNew;
                            const isDeleted = deletedRowIds.has(rowId);
                            const isModified = row._isModified;
                            const errors = row._errors || {};

                            return (
                                <tr
                                    key={rowId || actualRowIndex}
                                    className={`group transition-colors ${
                                        isDeleted
                                            ? 'bg-red-950/30 line-through opacity-60'
                                            : isNew
                                            ? 'bg-emerald-950/20'
                                            : 'hover:bg-slate-800/30'
                                    }`}
                                >
                                    {/* Row Index Number */}
                                    <td className="px-2 py-1.5 text-center border-r border-slate-800/80 bg-slate-950/50 text-slate-500 font-mono text-[11px] select-none">
                                        {displayIndex + 1}
                                    </td>

                                    {/* Status Badge */}
                                    <td className="px-2 py-1.5 text-center border-r border-slate-800/80 select-none">
                                        {isDeleted ? (
                                            <span className="px-1.5 py-0.5 text-[10px] font-sans font-semibold rounded bg-red-900/60 text-red-300">
                                                DEL
                                            </span>
                                        ) : isNew ? (
                                            <span className="px-1.5 py-0.5 text-[10px] font-sans font-semibold rounded bg-emerald-900/60 text-emerald-300">
                                                NEW
                                            </span>
                                        ) : isModified ? (
                                            <span className="px-1.5 py-0.5 text-[10px] font-sans font-semibold rounded bg-amber-900/60 text-amber-300">
                                                MOD
                                            </span>
                                        ) : (
                                            <span className="text-slate-600 text-[10px]">—</span>
                                        )}
                                    </td>

                                    {/* Grid Cells */}
                                    {columns.map((col, colIndex) => {
                                        const isSelected = isCellInBounds(actualRowIndex, colIndex, selectionBounds);
                                        const isEditing =
                                            editingCell?.rowIndex === actualRowIndex && editingCell?.colIndex === colIndex;

                                        const originalRow = originalRowsMap ? originalRowsMap.get(rowId) : null;
                                        const isDirtyCell = !isNew && originalRow && String(row[col.key] ?? '') !== String(originalRow[col.key] ?? '');

                                        return (
                                            <GridCell
                                                key={col.key}
                                                value={row[col.key]}
                                                column={col}
                                                rowIndex={actualRowIndex}
                                                colIndex={colIndex}
                                                isSelected={isSelected}
                                                isEditing={isEditing}
                                                isDirtyCell={isDirtyCell}
                                                error={errors[col.key]}
                                                onSelectCell={onSelectCell}
                                                onStartEditing={onStartEditing}
                                                onStopEditing={onStopEditing}
                                                onChangeValue={onChangeValue}
                                                onNavigate={onNavigate}
                                            />
                                        );
                                    })}

                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};
