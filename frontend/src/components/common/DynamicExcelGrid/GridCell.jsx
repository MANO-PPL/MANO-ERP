import React, { useRef, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

export const GridCell = ({
    value,
    column,
    rowIndex,
    colIndex,
    isSelected,
    isEditing,
    isDirtyCell,
    error,
    onSelectCell,
    onStartEditing,
    onStopEditing,
    onChangeValue,
    onNavigate
}) => {
    const inputRef = useRef(null);
    const [localValue, setLocalValue] = useState(value ?? '');

    useEffect(() => {
        setLocalValue(value ?? '');
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current.select && column.type !== 'select' && column.type !== 'checkbox') {
                inputRef.current.select();
            }
        }
    }, [isEditing, column.type]);

    const handleBlur = () => {
        onChangeValue(rowIndex, column.key, localValue);
        onStopEditing();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onChangeValue(rowIndex, column.key, localValue);
            onStopEditing();
            onNavigate(e.shiftKey ? 'UP' : 'DOWN');
        } else if (e.key === 'Tab') {
            e.preventDefault();
            onChangeValue(rowIndex, column.key, localValue);
            onStopEditing();
            onNavigate(e.shiftKey ? 'LEFT' : 'RIGHT');
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setLocalValue(value ?? '');
            onStopEditing();
        }
    };

    const renderEditor = () => {
        if (column.type === 'select') {
            return (
                <select
                    ref={inputRef}
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-full h-full px-2 py-1 bg-slate-900 text-slate-100 border-none outline-none focus:ring-2 focus:ring-blue-500 rounded font-sans text-xs"
                >
                    <option value="">-- Select --</option>
                    {(column.options || []).map((opt) => {
                        const optVal = typeof opt === 'object' ? opt.value : opt;
                        const optLabel = typeof opt === 'object' ? opt.label : opt;
                        return (
                            <option key={optVal} value={optVal}>
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
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-full h-full px-2 py-1 bg-slate-900 text-slate-100 border-none outline-none focus:ring-2 focus:ring-blue-500 rounded font-sans text-xs text-right"
                />
            );
        }

        return (
            <input
                ref={inputRef}
                type="text"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="w-full h-full px-2 py-1 bg-slate-900 text-slate-100 border-none outline-none focus:ring-2 focus:ring-blue-500 rounded font-sans text-xs"
            />
        );
    };

    return (
        <td
            onClick={(e) => onSelectCell(rowIndex, colIndex, e.shiftKey)}
            onDoubleClick={() => !column.readOnly && onStartEditing(rowIndex, colIndex)}
            className={`relative border-b border-r border-slate-700/60 px-2 py-1.5 text-xs text-slate-200 select-none transition-colors ${
                isSelected ? 'bg-blue-900/30 ring-2 ring-blue-500 z-10' : 'hover:bg-slate-800/50'
            } ${error ? 'bg-red-950/40 ring-1 ring-red-500' : ''}`}
            style={{ width: column.width || '160px', minWidth: column.width || '160px' }}
        >
            {/* Dirty cell amber indicator dot */}
            {isDirtyCell && !error && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" title="Modified" />
            )}

            {/* Error indicator icon */}
            {error && (
                <div className="absolute top-1 right-1 group/err cursor-help">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <div className="hidden group-hover/err:block absolute bottom-full right-0 mb-1 z-50 px-2 py-1 bg-red-900 text-white text-[10px] rounded shadow-lg whitespace-nowrap">
                        {error}
                    </div>
                </div>
            )}

            {isEditing ? (
                renderEditor()
            ) : (
                <div className="truncate w-full h-full flex items-center">
                    {column.type === 'checkbox' ? (
                        <input
                            type="checkbox"
                            checked={Boolean(value)}
                            disabled={column.readOnly}
                            onChange={(e) => onChangeValue(rowIndex, column.key, e.target.checked)}
                            className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500"
                        />
                    ) : (
                        <span className={`${!value ? 'text-slate-500 italic' : ''}`}>
                            {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
                        </span>
                    )}
                </div>
            )}
        </td>
    );
};
