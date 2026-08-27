import React, { useState, useEffect, useRef } from 'react';
import {
    Check,
    X,
    Search
} from 'lucide-react';
import { getA1Notation } from './excelUtils';

export const ExcelFormulaBar = ({
    selectionFocus,
    columns = [],
    sortedGridData = [],
    onChangeValue,
    onOpenFindReplace,
    canWrite = true
}) => {
    const activeRow = selectionFocus ? sortedGridData[selectionFocus.r] : null;
    const activeCol = selectionFocus ? columns[selectionFocus.c] : null;
    const activeValue = activeRow && activeCol ? activeRow[activeCol.key] ?? '' : '';

    const [formulaValue, setFormulaValue] = useState(activeValue);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isFocused) {
            setFormulaValue(activeValue);
        }
    }, [activeValue, isFocused]);

    const a1Address = selectionFocus ? getA1Notation(selectionFocus.r, selectionFocus.c) : '';
    const colName = activeCol ? activeCol.label || activeCol.key : '';

    const handleCommit = () => {
        if (selectionFocus && activeCol && canWrite) {
            onChangeValue(selectionFocus.r, activeCol.key, formulaValue, true);
        }
    };

    const handleCancel = () => {
        setFormulaValue(activeValue);
        if (inputRef.current) inputRef.current.blur();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCommit();
            if (inputRef.current) inputRef.current.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    return (
        <div className="px-3 py-1.5 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#161b22]/50 flex items-center gap-2 text-xs select-none shrink-0">
            {/* Cell Address Name Box */}
            <div
                className="w-20 px-2 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 text-center truncate shadow-2xs"
                title={selectionFocus ? `Cell ${a1Address} (${colName})` : 'Select a cell'}
            >
                {selectionFocus ? a1Address : '—'}
            </div>

            {/* Formula fx Symbol */}
            <div className="font-serif italic font-bold text-gray-400 dark:text-gray-500 text-xs px-1 select-none">
                fx
            </div>

            {/* Commit & Discard Mini Buttons (visible when modified or focused) */}
            {canWrite && selectionFocus && (
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={handleCommit}
                        className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-gray-400 hover:text-emerald-600 rounded transition cursor-pointer"
                        title="Commit Formula / Value (Enter)"
                    >
                        <Check size={13} className="stroke-[2.5]" />
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                        title="Cancel (Esc)"
                    >
                        <X size={13} />
                    </button>
                </div>
            )}

            {/* Formula / Cell Content Input */}
            <div className="flex-1 relative">
                <input
                    ref={inputRef}
                    type="text"
                    disabled={!selectionFocus || !canWrite || activeCol?.readOnly}
                    value={selectionFocus ? String(formulaValue ?? '') : ''}
                    onChange={(e) => setFormulaValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        setIsFocused(false);
                        handleCommit();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        selectionFocus
                            ? activeCol?.readOnly
                                ? `Read-only column: ${colName}`
                                : `Edit ${colName}…`
                            : 'Click any cell to edit value or formula…'
                    }
                    className="w-full px-2.5 py-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                />
            </div>

            {/* Find & Replace Action */}
            {canWrite && onOpenFindReplace && (
                <div className="flex items-center gap-1 border-l border-gray-200 dark:border-white/10 pl-2">
                    <button
                        type="button"
                        onClick={onOpenFindReplace}
                        className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-gray-500 hover:text-purple-600 rounded-md transition cursor-pointer flex items-center gap-1 font-semibold text-[11px]"
                        title="Find & Replace in Table (Ctrl+H)"
                    >
                        <Search size={13} />
                        <span className="hidden sm:inline">Find</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExcelFormulaBar;
