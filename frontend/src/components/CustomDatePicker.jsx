import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, startOfWeek, endOfMonth, endOfWeek, isSameMonth, isSameDay, addDays } from 'date-fns';

const CustomDatePicker = ({ label, value: externalValue, onChange: externalOnChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [internalValue, setInternalValue] = useState('');
    const dropdownRef = useRef(null);

    const value = externalValue !== undefined ? externalValue : internalValue;

    const handleDateChange = (dateStr) => {
        if (externalOnChange) {
            externalOnChange({ target: { value: dateStr } });
        } else {
            setInternalValue(dateStr);
        }
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedDate = value ? new Date(value) : null;

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
        <div className="w-full relative" ref={dropdownRef}>
            {label && <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>}

            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-white dark:bg-[#161b22] border rounded-lg px-3 py-2 flex items-center justify-between transition-all cursor-pointer shadow-sm dark:shadow-none
                ${isOpen ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg shadow-blue-500/5' : 'border-gray-200 dark:border-white/10 hover:border-blue-500/30 dark:hover:border-white/20'}`}
            >
                <span className={`text-sm tracking-wide ${value ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-[#7A8AAB]'}`}>
                    {value ? format(new Date(value), 'dd - MM - yyyy') : 'dd - mm - yyyy'}
                </span>
                <CalendarIcon size={16} className={`${isOpen ? 'text-blue-500' : 'text-gray-500 dark:text-[#7A8AAB]'}`} />
            </div>

            {/* Custom Dropdown Calendar */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-[280px] bg-white dark:bg-[#1c2128] border border-gray-100 dark:border-white/10 shadow-2xl rounded-2xl p-5 z-50 anim-fade-in">
                    {renderHeader()}
                    {renderDays()}
                    {renderCells()}
                </div>
            )}
        </div>
    );
};

export default CustomDatePicker;
