import React, { forwardRef, useId, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    isSameMonth,
    isSameDay,
    isToday,
    setMonth,
    setYear
} from 'date-fns';
import { formatOrdinalDate } from '../../utils/dateUtils';

const MobileDatePicker = forwardRef(function MobileDatePicker(
    {
        label,
        value: externalValue,
        defaultValue,
        onChange,
        error,
        hint,
        placeholder = 'Select date',
        disabled = false,
        className = '',
        name,
        id: propId,
        min,
        max,
        required = false,
        ...props
    },
    ref
) {
    const generatedId = useId();
    const id = propId || generatedId;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    const [isOpen, setIsOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue || '');
    const [viewMode, setViewMode] = useState('days'); // 'days' | 'months' | 'years'
    const value = externalValue !== undefined ? externalValue : internalValue;

    // Helper to parse date string without timezone offset bugs
    const parseDateValue = (val) => {
        if (!val) return null;
        let dateToParse = val;
        if (typeof val === 'object' && val.target && typeof val.target.value === 'string') {
            dateToParse = val.target.value;
        }
        if (typeof dateToParse === 'string') {
            const cleanStr = dateToParse.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
                const [y, m, dayVal] = cleanStr.split('-').map(Number);
                const d = new Date(y, m - 1, dayVal);
                return isNaN(d.getTime()) ? null : d;
            }
        }
        const d = new Date(dateToParse);
        return isNaN(d.getTime()) ? null : d;
    };

    const selectedDate = useMemo(() => parseDateValue(value), [value]);
    const [currentMonth, setCurrentMonth] = useState(() => selectedDate || new Date());

    // Sync currentMonth when opened or value changed
    useEffect(() => {
        if (selectedDate) {
            setCurrentMonth(selectedDate);
        }
    }, [selectedDate]);

    // Parse min/max boundaries
    const minDate = useMemo(() => parseDateValue(min), [min]);
    const maxDate = useMemo(() => parseDateValue(max), [max]);

    const isDateDisabled = (day) => {
        if (minDate && day < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) {
            return true;
        }
        if (maxDate && day > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59)) {
            return true;
        }
        return false;
    };

    const handleSelectDate = (day) => {
        if (isDateDisabled(day)) return;
        const formatted = format(day, 'yyyy-MM-dd');
        setInternalValue(formatted);
        if (onChange) {
            onChange({ target: { value: formatted, name } });
        }
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e?.stopPropagation?.();
        setInternalValue('');
        if (onChange) {
            onChange({ target: { value: '', name } });
        }
    };

    const handleSelectToday = () => {
        const today = new Date();
        if (!isDateDisabled(today)) {
            handleSelectDate(today);
        }
    };

    const nextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
    const prevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));

    // Lock body scroll when bottom sheet is open
    useEffect(() => {
        if (!isOpen) return;
        const origOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = origOverflow;
        };
    }, [isOpen]);

    // Calendar Cells Generation
    const renderCalendarGrid = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        const days = [];
        let day = startDate;

        while (day <= endDate) {
            days.push(day);
            day = addDays(day, 1);
        }

        return (
            <div>
                {/* Weekdays */}
                <div className="grid grid-cols-7 mb-1.5 text-center">
                    {weekdays.map((wd, i) => (
                        <div
                            key={i}
                            className={`text-[11px] font-semibold py-1 uppercase tracking-wider ${
                                i === 0 || i === 6 ? 'text-red-400 dark:text-red-400/80' : 'text-gray-400 dark:text-gh-muted'
                            }`}
                        >
                            {wd}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                    {days.map((d, index) => {
                        const isCurrentM = isSameMonth(d, monthStart);
                        const isSel = selectedDate && isSameDay(d, selectedDate);
                        const isTod = isToday(d);
                        const isDis = isDateDisabled(d);

                        return (
                            <button
                                key={index}
                                type="button"
                                disabled={isDis}
                                onClick={() => handleSelectDate(d)}
                                className={`
                                    relative h-10 w-full rounded-xl flex flex-col items-center justify-center text-xs font-medium transition-all active:scale-95
                                    ${isDis ? 'opacity-25 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
                                    ${isSel
                                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30 scale-105 z-10'
                                        : isTod
                                        ? 'border border-blue-500/70 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20 font-semibold'
                                        : isCurrentM
                                        ? 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-white/10 active:bg-gray-200 dark:active:bg-white/15'
                                        : 'text-gray-300 dark:text-gray-600 opacity-60'
                                    }
                                `}
                            >
                                <span>{format(d, 'd')}</span>
                                {isTod && !isSel && (
                                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Month Selector Grid
    const renderMonthGrid = () => {
        const months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        const currentMonthIdx = currentMonth.getMonth();

        return (
            <div className="grid grid-cols-3 gap-2.5 py-2">
                {months.map((m, idx) => {
                    const isCurrent = idx === currentMonthIdx;
                    return (
                        <button
                            key={m}
                            type="button"
                            onClick={() => {
                                setCurrentMonth(prev => setMonth(prev, idx));
                                setViewMode('days');
                            }}
                            className={`h-11 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                                isCurrent
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                                    : 'bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                            }`}
                        >
                            {m}
                        </button>
                    );
                })}
            </div>
        );
    };

    // Year Selector Grid
    const renderYearGrid = () => {
        const currentYear = currentMonth.getFullYear();
        const years = [];
        for (let y = currentYear - 6; y <= currentYear + 5; y++) {
            years.push(y);
        }

        return (
            <div className="grid grid-cols-3 gap-2.5 py-2">
                {years.map((y) => {
                    const isCurrent = y === currentYear;
                    return (
                        <button
                            key={y}
                            type="button"
                            onClick={() => {
                                setCurrentMonth(prev => setYear(prev, y));
                                setViewMode('days');
                            }}
                            className={`h-11 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                                isCurrent
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                                    : 'bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                            }`}
                        >
                            {y}
                        </button>
                    );
                })}
            </div>
        );
    };

    const displayDateString = selectedDate ? formatOrdinalDate(selectedDate) : placeholder;

    return (
        <div className={`min-w-0 ${className}`}>
            {label && (
                <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gh-text">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            {/* Hidden Input for standard form submissions & ref preservation */}
            <input
                ref={ref}
                type="hidden"
                id={id}
                name={name}
                value={value || ''}
                {...props}
            />

            {/* Custom Interactive Trigger Button */}
            <button
                type="button"
                id={`${id}-trigger`}
                disabled={disabled}
                onClick={() => {
                    if (!disabled) {
                        setViewMode('days');
                        if (selectedDate) setCurrentMonth(selectedDate);
                        setIsOpen(true);
                    }
                }}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : hint ? hintId : undefined}
                className={`group min-h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-left transition-all active:scale-[0.99] flex items-center justify-between gap-2.5 outline-none
                    dark:bg-gh-input dark:text-gh-text
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gh-hover' : 'cursor-pointer hover:border-blue-500/40'}
                    ${error
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : isOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-gray-200 dark:border-gh-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }
                `}
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                        selectedDate
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gh-muted'
                    }`}>
                        <CalendarIcon size={16} />
                    </div>
                    <span className={`truncate text-xs ${
                        selectedDate
                            ? 'font-semibold text-gray-900 dark:text-gh-text'
                            : 'font-normal text-gray-400 dark:text-gh-muted'
                    }`}>
                        {displayDateString}
                    </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {selectedDate && !disabled && (
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label="Clear date"
                            onClick={handleClear}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleClear(e);
                                }
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <X size={14} />
                        </div>
                    )}
                </div>
            </button>

            {/* Error & Hint Messages */}
            {error ? (
                <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
            ) : (
                hint && <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gh-muted">{hint}</p>
            )}

            {/* Custom Mobile Date Picker Popup */}
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Popup Container */}
                    <div className="relative w-full max-w-sm sm:max-w-md my-auto rounded-2xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-2xl p-4 overflow-hidden animate-in zoom-in-95 duration-150 z-10">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-100 dark:border-white/5">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {label || 'Select Date'}
                                </h3>
                                <p className="text-[11px] text-gray-500 dark:text-gh-muted">
                                    {selectedDate ? formatOrdinalDate(selectedDate) : 'No date selected'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Quick Shortcuts */}
                        <div className="flex items-center gap-1.5 pb-3 overflow-x-auto no-scrollbar">
                            <button
                                type="button"
                                onClick={handleSelectToday}
                                className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const tomorrow = addDays(new Date(), 1);
                                    if (!isDateDisabled(tomorrow)) handleSelectDate(tomorrow);
                                }}
                                className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                            >
                                Tomorrow
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const yesterday = addDays(new Date(), -1);
                                    if (!isDateDisabled(yesterday)) handleSelectDate(yesterday);
                                }}
                                className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                            >
                                Yesterday
                            </button>
                            {selectedDate && (
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-auto"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Month / Year Navigator Bar */}
                        <div className="flex items-center justify-between px-1 py-1 mb-2">
                            <button
                                type="button"
                                onClick={prevMonth}
                                aria-label="Previous month"
                                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>

                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
                                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        viewMode === 'months'
                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10'
                                    }`}
                                >
                                    {format(currentMonth, 'MMMM')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
                                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        viewMode === 'years'
                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10'
                                    }`}
                                >
                                    {format(currentMonth, 'yyyy')}
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={nextMonth}
                                aria-label="Next month"
                                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {/* Body Views */}
                        <div className="min-h-[250px]">
                            {viewMode === 'days' && renderCalendarGrid()}
                            {viewMode === 'months' && renderMonthGrid()}
                            {viewMode === 'years' && renderYearGrid()}
                        </div>

                        {/* Footer Done Action */}
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="min-h-10 flex-1 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                            >
                                <Check size={16} />
                                Done
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

export default MobileDatePicker;
