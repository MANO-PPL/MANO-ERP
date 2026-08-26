import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, startOfWeek, endOfMonth, endOfWeek, isSameMonth, isSameDay, addDays } from 'date-fns';
import { formatOrdinalDate } from '../utils/dateUtils';

const CustomDatePicker = ({
    label,
    value: externalValue,
    onChange: externalOnChange,
    className = '',
    buttonClassName = '',
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [internalValue, setInternalValue] = useState('');
    const [coords, setCoords] = useState({ top: 0, left: 0, openUpward: false });
    const dropdownRef = useRef(null);
    const popupRef = useRef(null);
    const value = externalValue !== undefined ? externalValue : internalValue;

    const updateCoords = () => {
        if (dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpward = spaceBelow < 320 && rect.top > 320;
            const leftPos = Math.max(10, Math.min(rect.left, window.innerWidth - 300));
            setCoords({
                top: openUpward ? rect.top - 325 : rect.bottom + 4,
                left: leftPos,
                openUpward
            });
        }
    };

    const handleDateChange = (dateStr) => {
        if (externalOnChange) {
            externalOnChange({ target: { value: dateStr } });
        } else {
            setInternalValue(dateStr);
        }
    };

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                popupRef.current && !popupRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen]);

    const toggleOpen = () => {
        if (disabled) return;
        if (!isOpen) {
            updateCoords();
        }
        setIsOpen(!isOpen);
    };

    const parseDate = (val) => {
        if (!val) return null;
        let dateToParse = val;
        if (typeof val === 'object' && val.target && typeof val.target.value === 'string') {
            dateToParse = val.target.value;
        }
        const d = new Date(dateToParse);
        return isNaN(d.getTime()) ? null : d;
    };

    const selectedDate = parseDate(value);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const onDateClick = (day) => {
        handleDateChange(format(day, 'yyyy-MM-dd'));
        setIsOpen(false);
    };

    // Calendar generation
    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-4">
                <button type="button" onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-[#3A455C] rounded-md transition-colors text-gray-500 dark:text-[#7A8AAB]">
                    <ChevronLeft size={16} />
                </button>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {format(currentMonth, 'MMMM yyyy')}
                </div>
                <button type="button" onClick={nextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-[#3A455C] rounded-md transition-colors text-gray-500 dark:text-[#7A8AAB]">
                    <ChevronRight size={16} />
                </button>
            </div>
        );
    };

    const renderDays = () => {
        const days = [];
        const startDate = startOfWeek(currentMonth);
        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-center text-xs font-medium text-gray-500 dark:text-[#7A8AAB] py-1">
                    {format(addDays(startDate, i), 'EEEEE')}
                </div>
            );
        }
        return <div className="grid grid-cols-7 mb-2">{days}</div>;
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = '';

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, 'd');
                const cloneDay = day;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);

                days.push(
                    <div
                        key={day}
                        onClick={() => onDateClick(cloneDay)}
                        className={`
                            p-1 flex justify-center items-center cursor-pointer transition-colors text-sm rounded-md h-8 w-8 mx-auto
                            ${!isCurrentMonth ? 'text-gray-300 dark:text-[#3A455C]' : ''}
                            ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#3A455C]'}
                        `}
                    >
                        <span>{formattedDate}</span>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div key={day} className="grid grid-cols-7 gap-1">
                    {days}
                </div>
            );
            days = [];
        }
        return <div>{rows}</div>;
    };

    return (
        <div className={`w-full relative ${className || ''}`} ref={dropdownRef}>
            {label && <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>}

            <div
                onClick={toggleOpen}
                className={buttonClassName || `w-full bg-white dark:bg-[#161b22] border rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 transition-all shadow-xs dark:shadow-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-lg shadow-blue-500/5' : 'border-gray-200 dark:border-white/10 hover:border-blue-500/30 dark:hover:border-white/20'}`}
            >
                <span className={`text-xs font-medium tracking-tight whitespace-nowrap truncate ${selectedDate ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400 dark:text-[#7A8AAB]'}`}>
                    {selectedDate ? formatOrdinalDate(selectedDate) : 'Select Date'}
                </span>
                <CalendarIcon size={13} className={`shrink-0 ${isOpen ? 'text-blue-500' : 'text-gray-400 dark:text-[#7A8AAB]'}`} />
            </div>

            {/* Custom Dropdown Calendar Portal */}
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={popupRef}
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        zIndex: 99999
                    }}
                    className="w-[280px] bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 shadow-2xl rounded-2xl p-4 z-[99999] anim-fade-in"
                >
                    {renderHeader()}
                    {renderDays()}
                    {renderCells()}
                </div>,
                document.body
            )}
        </div>
    );
};

export default CustomDatePicker;
