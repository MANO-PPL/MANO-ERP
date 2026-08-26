import React, { useRef, useEffect, useState } from 'react';
import { AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';

export const ExcelCell = ({
    value,
    row,
    column,
    rowIndex,
    colIndex,
    selectionAnchor,
    selectionFocus,
    selectionBounds,
    isCopied = false,
    editingCell,
    isDirtyCell,
    error,
    canWrite = true,
    customColWidth,
    onSelectCell,
    onCellMouseDown,
    onCellMouseEnter,
    onStartEditing,
    onStopEditing,
    onChangeValue,
    onKeyDown,
    onContextMenu,
    onStartFillDrag,
    onAutoFillDown,
    onOpenDropdownPortal,
    isFindMatch = false,
    isFindCurrentMatch = false,
    findHighlightQuery = '',
    findHighlightMatchCase = false
}) => {
    const inputRef = useRef(null);
    const [localValue, setLocalValue] = useState(value ?? '');
    const localValueRef = useRef(value ?? '');

    const isAnchor = selectionAnchor?.r === rowIndex && selectionAnchor?.c === colIndex;
    const isFocus = selectionFocus?.r === rowIndex && selectionFocus?.c === colIndex;
    const isInRange = selectionBounds &&
        rowIndex >= selectionBounds.minRow && rowIndex <= selectionBounds.maxRow &&
        colIndex >= selectionBounds.minCol && colIndex <= selectionBounds.maxCol;

    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colKey === column.key;
    const isFillHandleCell = selectionBounds &&
        rowIndex === selectionBounds.maxRow &&
        colIndex === selectionBounds.maxCol;

    const isTopEdge = selectionBounds && rowIndex === selectionBounds.minRow && isInRange;
    const isBottomEdge = selectionBounds && rowIndex === selectionBounds.maxRow && isInRange;
    const isLeftEdge = selectionBounds && colIndex === selectionBounds.minCol && isInRange;
    const isRightEdge = selectionBounds && colIndex === selectionBounds.maxCol && isInRange;

    useEffect(() => {
        setLocalValue(value ?? '');
        localValueRef.current = value ?? '';
    }, [value]);

    const updateLocalValue = (newVal) => {
        localValueRef.current = newVal;
        setLocalValue(newVal);
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current.select && column.type !== 'select' && column.type !== 'checkbox') {
                inputRef.current.select();
            }
        }
    }, [isEditing, column.type]);

    const handleBlur = (overrideVal) => {
        const valToCommit = overrideVal !== undefined ? overrideVal : localValueRef.current;
        onChangeValue(rowIndex, column.key, valToCommit);
        onStopEditing();
    };

    const widthStyle = customColWidth
        ? { width: customColWidth, minWidth: customColWidth }
        : column.width
        ? { width: column.width, minWidth: column.minWidth || column.width }
        : { width: '160px', minWidth: '150px' };

    const renderCellContent = () => {
        if (column.renderCell && typeof column.renderCell === 'function') {
            return column.renderCell(value, row, column, (newVal) => onChangeValue && onChangeValue(rowIndex, column.key, newVal, true), rowIndex);
        }

        if (column.type === 'checkbox') {
            return (
                <div className="flex items-center justify-center w-full h-full">
                    <input
                        type="checkbox"
                        checked={Boolean(value)}
                        disabled={!canWrite || column.readOnly}
                        onChange={(e) => onChangeValue(rowIndex, column.key, e.target.checked, true)}
                        className="rounded border-gray-300 dark:border-white/20 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                </div>
            );
        }

        const displayVal = value !== undefined && value !== null && String(value).trim() !== ''
            ? String(value)
            : '';

        let contentNode = displayVal;
        if (isFindMatch && findHighlightQuery && displayVal) {
            const query = findHighlightMatchCase ? findHighlightQuery : findHighlightQuery.toLowerCase();
            const strVal = String(displayVal);
            const comp = findHighlightMatchCase ? strVal : strVal.toLowerCase();
            const idx = comp.indexOf(query);
            if (idx !== -1) {
                const before = strVal.substring(0, idx);
                const match = strVal.substring(idx, idx + findHighlightQuery.length);
                const after = strVal.substring(idx + findHighlightQuery.length);
                contentNode = (
                    <span>
                        {before}
                        <mark className="bg-amber-300 dark:bg-amber-500 text-black dark:text-gray-900 font-bold px-0.5 rounded-xs">
                            {match}
                        </mark>
                        {after}
                    </span>
                );
            }
        }

        return (
            <div className={`truncate w-full text-xs font-semibold text-gray-800 dark:text-gray-200 ${column.align === 'right' ? 'text-right font-mono' : column.align === 'center' ? 'text-center' : 'text-left'}`}>
                {contentNode}
            </div>
        );
    };

    const renderEditor = () => {
        if (column.renderEditor && typeof column.renderEditor === 'function') {
            return column.renderEditor(localValue, row, column, updateLocalValue, handleBlur, rowIndex, onChangeValue);
        }

        if (column.renderCell && typeof column.renderCell === 'function') {
            return column.renderCell(localValue, row, column, (newVal) => onChangeValue && onChangeValue(rowIndex, column.key, newVal, true), rowIndex);
        }

        if (column.type === 'select') {
            return (
                <select
                    ref={inputRef}
                    value={localValue}
                    onChange={(e) => updateLocalValue(e.target.value)}
                    onBlur={() => handleBlur()}
                    onKeyDown={(e) => onKeyDown(e, rowIndex, column.key)}
                    className="w-full h-full px-2 py-0.5 bg-white dark:bg-[#161b22] text-gray-900 dark:text-white border border-blue-500 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                    <option value="">-- Select --</option>
                    {(column.options || []).map((opt) => {
                        const optVal = typeof opt === 'object' ? opt.value : opt;
                        const optLabel = typeof opt === 'object' ? opt.label : opt;
                        return (
                            <option key={String(optVal)} value={optVal} className="text-gray-900 dark:text-white dark:bg-[#161b22]">
                                {optLabel}
                            </option>
                        );
                    })}
                </select>
            );
        }

        if (column.type === 'number') {
            return (
                <input
                    ref={inputRef}
                    type="number"
                    step={column.step || 'any'}
                    value={localValue}
                    onChange={(e) => updateLocalValue(e.target.value)}
                    onBlur={() => handleBlur()}
                    onKeyDown={(e) => onKeyDown(e, rowIndex, column.key)}
                    className="w-full min-w-0 bg-transparent border-0 outline-none p-0 text-xs font-semibold text-gray-900 dark:text-white text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
            );
        }

        if (column.type === 'date') {
            return (
                <input
                    ref={inputRef}
                    type="date"
                    value={localValue}
                    onChange={(e) => updateLocalValue(e.target.value)}
                    onBlur={() => handleBlur()}
                    onKeyDown={(e) => onKeyDown(e, rowIndex, column.key)}
                    className="w-full min-w-0 bg-transparent border-0 outline-none p-0 text-xs font-semibold text-gray-900 dark:text-white"
                />
            );
        }

        return (
            <input
                ref={inputRef}
                type="text"
                value={localValue}
                onChange={(e) => updateLocalValue(e.target.value)}
                onBlur={() => handleBlur()}
                onKeyDown={(e) => onKeyDown(e, rowIndex, column.key)}
                className="w-full min-w-0 bg-transparent border-0 outline-none p-0 text-xs font-semibold text-gray-900 dark:text-white"
            />
        );
    };

    return (
        <td
            id={`excel-cell-${rowIndex}-${column.key}`}
            data-excel-cell="true"
            data-row-idx={rowIndex}
            data-col-idx={colIndex}
            style={widthStyle}
            onMouseDown={(e) => {
                if (e.button !== 0) return;
                if (e.target.closest('.z-\\[6000\\]') || e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
                if (isEditing) return;

                if (onCellMouseDown) {
                    onCellMouseDown(rowIndex, colIndex, e.shiftKey, e.ctrlKey || e.metaKey);
                } else if (onSelectCell) {
                    onSelectCell(rowIndex, colIndex, e.shiftKey);
                }

                if (column.type === 'searchable-select' && onOpenDropdownPortal) {
                    onOpenDropdownPortal(rowIndex, column.key);
                }
            }}
            onMouseEnter={() => {
                if (onCellMouseEnter) {
                    onCellMouseEnter(rowIndex, colIndex);
                }
            }}
            onDoubleClick={(e) => {
                if (canWrite && !column.readOnly && !column.renderCell) {
                    if (column.type === 'searchable-select' && onOpenDropdownPortal) {
                        onOpenDropdownPortal(rowIndex, column.key);
                    } else {
                        onStartEditing(rowIndex, column.key);
                    }
                }
            }}
            onContextMenu={(e) => onContextMenu(e, rowIndex, colIndex)}
            tabIndex={-1}
            onKeyDown={(e) => onKeyDown && onKeyDown(e, rowIndex, column.key)}
            className={`px-3 py-1.5 border-r border-b border-gray-100 dark:border-white/5 relative outline-none select-none cursor-pointer overflow-hidden transition-colors ${
                isEditing
                    ? 'bg-white dark:bg-[#161b22]'
                    : isFindCurrentMatch
                    ? 'bg-amber-200/90 dark:bg-amber-900/50 text-amber-950 dark:text-amber-50'
                    : isFindMatch
                    ? 'bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100'
                    : isInRange
                    ? 'bg-blue-50/50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50/70 dark:hover:bg-white/[0.03]'
            }`}
        >
            {/* Find Match Indicator Ring */}
            {isFindMatch && !isEditing && (
                <div
                    className={`absolute inset-0 pointer-events-none z-10 ${
                        isFindCurrentMatch
                            ? 'ring-2 ring-blue-500 shadow-md animate-pulse'
                            : 'border border-amber-300/80 dark:border-amber-700/60'
                    }`}
                />
            )}

            {/* Active Cell Blue Ring */}
            {(isAnchor || isEditing) && (
                <div className="absolute inset-0 pointer-events-none z-20 border-2 border-blue-500 shadow-xs" />
            )}

            {/* Selection Range Perimeter Borders */}
            {isInRange && !isAnchor && !isEditing && (
                <div className="absolute inset-0 pointer-events-none z-10">
                    {isTopEdge && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />}
                    {isBottomEdge && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500" />}
                    {isLeftEdge && <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-blue-500" />}
                    {isRightEdge && <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-blue-500" />}
                </div>
            )}

            {/* Copied Cells Marching Ants Dashed Border */}
            {isCopied && !isInRange && !isEditing && (
                <div className="absolute inset-0 pointer-events-none z-15 border border-dashed border-blue-500 animate-pulse bg-blue-50/20" />
            )}

            {/* Fill Handle Square */}
            {isFillHandleCell && !isEditing && canWrite && (
                <div
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (onStartFillDrag) onStartFillDrag();
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (onAutoFillDown) onAutoFillDown();
                    }}
                    className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-600 border border-white dark:border-gray-900 rounded-xs z-30 cursor-crosshair shadow-sm hover:scale-125 transition-transform"
                    title="Drag or double-click to Auto-Fill Down"
                />
            )}

            {/* Dirty cell amber indicator dot */}
            {isDirtyCell && !error && (
                <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 z-10 shadow-xs"
                    title="Modified locally"
                />
            )}

            {/* Validation Error indicator */}
            {error && (
                <div className="absolute top-1 right-1 group/err z-20 cursor-help">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    <div className="hidden group-hover/err:block absolute bottom-full right-0 mb-1 px-2 py-1 bg-red-600 text-white text-[10px] font-semibold rounded shadow-lg whitespace-nowrap z-50 animate-in fade-in zoom-in-95">
                        {error}
                    </div>
                </div>
            )}

            {/* Cell Editor or View Value */}
            {isEditing ? renderEditor() : renderCellContent()}
        </td>
    );
};

export default ExcelCell;
