import React, { useRef, useEffect, useState, useMemo } from 'react';
import { AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { evaluateFormula } from '../../utils/excelFormulaEngine';
import { ExcelCellSelectDropdown } from './ExcelCellSelectDropdown';

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
    onEditorValueChange,
    onPasteCell,
    isFindMatch = false,
    isFindCurrentMatch = false,
    findHighlightQuery = '',
    findHighlightMatchCase = false
}) => {
    const cellRef = useRef(null);
    const inputRef = useRef(null);
    const [localValue, setLocalValue] = useState(value ?? '');
    const localValueRef = useRef(value ?? '');

    const isAnchor = selectionAnchor?.r === rowIndex && selectionAnchor?.c === colIndex;
    const isFocus = selectionFocus?.r === rowIndex && selectionFocus?.c === colIndex;
    const isInRange = selectionBounds &&
        rowIndex >= selectionBounds.minRow && rowIndex <= selectionBounds.maxRow &&
        colIndex >= selectionBounds.minCol && colIndex <= selectionBounds.maxCol;

    const rowId = row?.id || row?._id || (column.primaryKey ? row[column.primaryKey] : null);
    const isEditing = Boolean(
        editingCell &&
        (editingCell.rowId != null && rowId != null
            ? String(editingCell.rowId) === String(rowId)
            : editingCell.rowIndex === rowIndex) &&
        editingCell.colKey === column.key
    );
    const isFillHandleCell = selectionBounds &&
        rowIndex === selectionBounds.maxRow &&
        colIndex === selectionBounds.maxCol;

    const isTopEdge = selectionBounds && rowIndex === selectionBounds.minRow && isInRange;
    const isBottomEdge = selectionBounds && rowIndex === selectionBounds.maxRow && isInRange;
    const isLeftEdge = selectionBounds && colIndex === selectionBounds.minCol && isInRange;
    const isRightEdge = selectionBounds && colIndex === selectionBounds.maxCol && isInRange;

    const initialChar = isEditing ? editingCell?.initialChar : undefined;

    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value ?? '');
            localValueRef.current = value ?? '';
        } else {
            // When editing starts, check if editingCell provided an initial character or starting value
            const initVal = editingCell?.initialValue !== undefined
                ? editingCell.initialValue
                : (editingCell?.initialChar !== undefined ? editingCell.initialChar : (initialChar !== undefined ? initialChar : (value ?? '')));
            setLocalValue(initVal);
            localValueRef.current = initVal;
            if (onEditorValueChange) {
                onEditorValueChange(initVal);
            }
        }
    }, [value, isEditing, editingCell?.initialValue, editingCell?.initialChar, initialChar, onEditorValueChange]);

    const updateLocalValue = (newVal) => {
        localValueRef.current = newVal;
        setLocalValue(newVal);
        if (onEditorValueChange) {
            onEditorValueChange(newVal);
        }
    };

    useEffect(() => {
        if (isEditing) {
            const focusAndSelect = () => {
                if (inputRef.current) {
                    inputRef.current.focus({ preventScroll: false });
                    try {
                        inputRef.current.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
                    } catch {}
                    if (inputRef.current && column.type !== 'select' && column.type !== 'searchable-select' && column.type !== 'checkbox') {
                        const valLen = inputRef.current.value ? inputRef.current.value.length : 0;
                        try {
                            // Place cursor at the end so Backspace deletes character-by-character instead of wiping the whole word
                            inputRef.current.setSelectionRange(valLen, valLen);
                        } catch {}
                    }
                }
            };

            // Immediate attempt if element already mounted
            focusAndSelect();

            // Next-tick fallback for fresh DOM mount
            const timer = setTimeout(focusAndSelect, 0);
            return () => clearTimeout(timer);
        }
    }, [isEditing, column.type, editingCell?.isDirectTyping, editingCell?.initialChar, initialChar]);

    const handleBlur = (overrideVal) => {
        const valToCommit = overrideVal !== undefined ? overrideVal : (inputRef.current?.value ?? localValueRef.current);
        if (onStopEditing) {
            onStopEditing(valToCommit);
        } else if (onChangeValue) {
            if (String(valToCommit ?? '').trim() !== String(value ?? '').trim()) {
                onChangeValue(rowIndex, column.key, valToCommit, false, rowId);
            }
        }
    };

    const handleInputKeyDown = (e) => {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const keyLower = e.key.toLowerCase();
        // Allow standard copy, cut, paste, undo, redo to pass through to grid listeners
        if (isCtrlOrCmd && ['c', 'x', 'v', 'z', 'y'].includes(keyLower)) {
            if (onKeyDown) {
                onKeyDown(e, rowIndex, column.key);
            }
            return;
        }
        e.stopPropagation();
        if (e.nativeEvent) {
            e.nativeEvent.stopImmediatePropagation?.();
        }
        if (onKeyDown) {
            onKeyDown(e, rowIndex, column.key);
        }
    };

    const widthStyle = customColWidth
        ? { width: customColWidth, minWidth: customColWidth }
        : column.width
        ? { width: column.width, minWidth: column.minWidth || column.width }
        : { width: '160px', minWidth: '150px' };

    const renderCellContent = () => {
        if (column.type === 'checkbox') {
            return (
                <div className="flex items-center justify-center w-full h-full">
                    <input
                        type="checkbox"
                        checked={Boolean(value)}
                        disabled={!canWrite || column.readOnly}
                        onChange={(e) => onChangeValue(rowIndex, column.key, e.target.checked, true, rowId)}
                        className="rounded border-gray-300 dark:border-white/20 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                </div>
            );
        }

        const isFormula = typeof value === 'string' && value.trim().startsWith('=');
        let displayVal = value !== undefined && value !== null && String(value).trim() !== ''
            ? String(value)
            : '';

        let formulaResult = null;
        let formulaError = null;

        if (isFormula) {
            const evalRes = evaluateFormula(value, row);
            if (evalRes.success) {
                displayVal = evalRes.formattedResult || String(evalRes.result);
                formulaResult = evalRes.result;
            } else {
                displayVal = evalRes.formattedResult || '#ERROR!';
                formulaError = evalRes.error;
            }
        }

        if ((column.type === 'select' || column.type === 'searchable-select') && !isFormula && displayVal) {
            const opts = column.options || [];
            const matchedOpt = opts.find((opt) => {
                if (typeof opt === 'object' && opt !== null) {
                    const optVal = opt.value !== undefined ? opt.value : (opt.code !== undefined ? opt.code : opt.id);
                    return String(optVal) === String(displayVal);
                }
                return String(opt) === String(displayVal);
            });
            if (matchedOpt && typeof matchedOpt === 'object') {
                displayVal = matchedOpt.label !== undefined ? matchedOpt.label : (matchedOpt.name || displayVal);
            }
        }

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

        let renderedCustomCell = null;
        if (column.renderCell && typeof column.renderCell === 'function') {
            const cellValToPass = isFormula && formulaResult !== null && formulaResult !== undefined
                ? formulaResult
                : value;
            renderedCustomCell = column.renderCell(
                cellValToPass,
                row,
                column,
                (newVal) => onChangeValue && onChangeValue(rowIndex, column.key, newVal, true, rowId),
                rowIndex,
                () => onStartEditing && onStartEditing(rowIndex, column.key)
            );
            if (column.type !== 'select' && column.type !== 'searchable-select') {
                return renderedCustomCell;
            }
        }

        const cellBody = renderedCustomCell || contentNode || (column.type === 'select' || column.type === 'searchable-select' ? <span className="text-gray-400 font-normal italic text-[11px]">{column.placeholder || 'Select...'}</span> : '');

        if (column.type === 'select' || column.type === 'searchable-select') {
            return (
                <div
                    className="flex items-center justify-between w-full gap-1.5 min-w-0"
                    onClick={(e) => {
                        if (isAnchor && canWrite && !column.readOnly) {
                            e.stopPropagation();
                            onStartEditing(rowIndex, column.key);
                        }
                    }}
                    onPaste={(e) => {
                        const text = e.clipboardData?.getData('text/plain');
                        if (text) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onPasteCell) {
                                onPasteCell(text, rowIndex, colIndex);
                            }
                        }
                    }}
                >
                    <div className="truncate flex-1 min-w-0 text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {cellBody}
                    </div>
                    {canWrite && !column.readOnly && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStartEditing(rowIndex, column.key);
                            }}
                            className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-white/10 shrink-0 transition-colors cursor-pointer"
                            title="Open dropdown"
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div
                title={isFormula ? `Formula: ${value} (Result: ${displayVal})${formulaError ? `\nError: ${formulaError}` : ''}` : undefined}
                className={`truncate w-full text-xs font-semibold text-gray-800 dark:text-gray-200 relative ${column.align === 'right' ? 'text-right font-mono' : column.align === 'center' ? 'text-center' : 'text-left'}`}
            >
                {cellBody}
            </div>
        );
    };

    const renderEditor = () => {
        const displayVal = (isEditing && initialChar !== undefined && localValue === '') ? initialChar : localValue;

        if (column.renderEditor && typeof column.renderEditor === 'function') {
            return column.renderEditor(displayVal, row, column, updateLocalValue, handleBlur, rowIndex, onChangeValue);
        }

        if (column.type === 'select' || column.type === 'searchable-select') {
            const opts = column.options || [];

            let activeDisplayNode = null;
            if (column.renderCell && typeof column.renderCell === 'function') {
                activeDisplayNode = column.renderCell(
                    localValue,
                    row,
                    column,
                    (newVal) => onChangeValue && onChangeValue(rowIndex, column.key, newVal, true, rowId),
                    rowIndex,
                    () => {}
                );
            } else if (localValue) {
                const getOptValue = (opt) => (typeof opt === 'object' && opt !== null ? (opt.value !== undefined ? opt.value : (opt.code !== undefined ? opt.code : opt.id)) : opt);
                const getOptLabel = (opt) => (typeof opt === 'object' && opt !== null ? (opt.label !== undefined ? opt.label : (opt.name ? `${opt.name} (${opt.code || opt.symbol || opt.value || ''})` : (opt.code || opt.value || ''))) : opt);
                const matched = opts.find((o) => String(getOptValue(o)) === String(localValue));
                const labelText = matched ? getOptLabel(matched) : localValue;
                activeDisplayNode = <span className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">{labelText}</span>;
            } else {
                activeDisplayNode = <span className="text-gray-400 italic text-xs">{column.placeholder || '-- Select --'}</span>;
            }

            return (
                <div
                    ref={inputRef}

                    tabIndex={0}
                    onKeyDown={handleInputKeyDown}
                    onPaste={(e) => {
                        const text = e.clipboardData?.getData('text/plain');
                        if (text) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onPasteCell) {
                                onPasteCell(text, rowIndex, colIndex);
                            }
                        }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-between w-full h-full px-1 text-xs outline-none select-none"
                >
                    <div className="truncate flex-1 min-w-0 pr-1">
                        {activeDisplayNode}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-blue-500 shrink-0 rotate-180 transition-transform duration-200" />
                    <ExcelCellSelectDropdown
                        anchorEl={cellRef.current}
                        value={localValue}
                        options={opts}
                        placeholder={column.placeholder || 'Select or search...'}
                        renderOption={column.renderOption}
                        onSelect={(selectedVal) => {
                            updateLocalValue(selectedVal);
                            onChangeValue(rowIndex, column.key, selectedVal, true, rowId);
                            handleBlur(selectedVal);
                        }}
                        onClose={() => {
                            handleBlur(localValueRef.current);
                        }}
                    />
                </div>
            );
        }

        if (column.type === 'number') {
            return (
                <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    data-initial-value={value ?? ''}
                    inputMode={String(localValue || '').startsWith('=') ? 'text' : 'decimal'}
                    value={localValue}
                    onChange={(e) => updateLocalValue(e.target.value)}
                    onBlur={() => handleBlur()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onKeyDown={handleInputKeyDown}
                    onPaste={(e) => {
                        const text = e.clipboardData?.getData('text/plain');
                        if (text && (text.includes('\n') || text.includes('\t'))) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onPasteCell) {
                                onPasteCell(text, rowIndex, colIndex);
                            }
                        }
                    }}
                    className="w-full min-w-0 bg-transparent border-0 outline-none p-0 text-xs font-semibold text-gray-900 dark:text-white text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
            );
        }

        if (column.type === 'date') {
            return (
                <input
                    ref={inputRef}
                    type="date"
                    autoFocus
                    data-initial-value={value ?? ''}
                    value={displayVal}
                    onChange={(e) => updateLocalValue(e.target.value)}
                    onBlur={() => handleBlur()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onKeyDown={handleInputKeyDown}
                    onPaste={(e) => {
                        const text = e.clipboardData?.getData('text/plain');
                        if (text && (text.includes('\n') || text.includes('\t'))) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onPasteCell) {
                                onPasteCell(text, rowIndex, colIndex);
                            }
                        }
                    }}
                    className="w-full min-w-0 bg-transparent border-0 outline-none p-0 text-xs font-semibold text-gray-900 dark:text-white"
                />
            );
        }

        return (
            <input
                ref={inputRef}
                type="text"
                autoFocus
                data-initial-value={value ?? ''}
                value={displayVal}
                onChange={(e) => updateLocalValue(e.target.value)}
                onBlur={() => handleBlur()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={handleInputKeyDown}
                onPaste={(e) => {
                    const text = e.clipboardData?.getData('text/plain');
                    if (text && (text.includes('\n') || text.includes('\t'))) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onPasteCell) {
                            onPasteCell(text, rowIndex, colIndex);
                        }
                    }
                }}
                className="w-full min-w-0 bg-transparent border-0 outline-none p-0 text-xs font-semibold text-gray-900 dark:text-white"
            />
        );
    };

    return (
        <td
            ref={cellRef}
            id={`excel-cell-${rowIndex}-${column.key}`}
            data-excel-cell="true"
            data-row-idx={rowIndex}
            data-col-idx={colIndex}
            style={widthStyle}
            onMouseDown={(e) => {
                if (e.button !== 0) return;
                if (e.target.closest('.z-\\[6000\\]') || e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
                if (isEditing) return;

                try {
                    e.currentTarget.focus({ preventScroll: true });
                } catch {}

                if (onCellMouseDown) {
                    onCellMouseDown(rowIndex, colIndex, e.shiftKey, e.ctrlKey || e.metaKey);
                } else if (onSelectCell) {
                    onSelectCell(rowIndex, colIndex, e.shiftKey);
                }


                if (column.type === 'searchable-select' && onOpenDropdownPortal) {
                    onOpenDropdownPortal(rowIndex, column.key);
                }
            }}
            onClick={(e) => {
                if (e.button !== 0) return;
                if (e.target.closest('.z-\\[6000\\]') || e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
                if (isEditing) return;

                if (column.type === 'select' && !column.renderCell && canWrite && !column.readOnly && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    onStartEditing(rowIndex, column.key);
                } else if (canWrite && !column.readOnly && (!value || String(value).trim() === '') && column.type !== 'select' && column.type !== 'searchable-select' && column.type !== 'checkbox' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    onStartEditing(rowIndex, column.key);
                }
            }}
            onMouseEnter={() => {
                if (onCellMouseEnter) {
                    onCellMouseEnter(rowIndex, colIndex);
                }
            }}
            onDoubleClick={(e) => {
                if (canWrite && !column.readOnly) {
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
            onPaste={(e) => {
                const text = e.clipboardData?.getData('text/plain');
                if (text) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onPasteCell) {
                        onPasteCell(text, rowIndex, colIndex);
                    }
                }
            }}
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
