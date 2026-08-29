import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { UNIT_OPTIONS } from './resourceConstants';

export const ResourceFilterDropdown = ({
    activeFilters = { types: [], units: [], statuses: [] },
    onApply,
    activeTypeFilters = [],
    setActiveTypeFilters,
    activeUnitFilters = [],
    setActiveUnitFilters,
    activeStatusFilters = [],
    setActiveStatusFilters
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [unitSearch, setUnitSearch] = useState('');
    const dropdownRef = useRef(null);

    // Derive effective filter arrays from either prop pattern
    const types = onApply
        ? activeFilters?.types || []
        : activeTypeFilters || [];

    const units = onApply
        ? activeFilters?.units || []
        : activeUnitFilters || [];

    const statuses = onApply
        ? activeFilters?.statuses || []
        : activeStatusFilters || [];

    // Auto-close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const activeCount = types.length + units.length + statuses.length;

    const toggleType = (typeVal) => {
        const next = types.includes(typeVal)
            ? types.filter((t) => t !== typeVal)
            : [...types, typeVal];

        if (onApply) {
            onApply({ ...activeFilters, types: next });
        } else if (setActiveTypeFilters) {
            setActiveTypeFilters(next);
        }
    };

    const toggleUnit = (unitCode) => {
        const next = units.includes(unitCode)
            ? units.filter((u) => u !== unitCode)
            : [...units, unitCode];

        if (onApply) {
            onApply({ ...activeFilters, units: next });
        } else if (setActiveUnitFilters) {
            setActiveUnitFilters(next);
        }
    };

    const toggleStatus = (statusVal) => {
        const next = statuses.includes(statusVal)
            ? statuses.filter((s) => s !== statusVal)
            : [...statuses, statusVal];

        if (onApply) {
            onApply({ ...activeFilters, statuses: next });
        } else if (setActiveStatusFilters) {
            setActiveStatusFilters(next);
        }
    };

    const handleReset = () => {
        if (onApply) {
            onApply({ types: [], units: [], statuses: [] });
        } else {
            if (setActiveTypeFilters) setActiveTypeFilters([]);
            if (setActiveUnitFilters) setActiveUnitFilters([]);
            if (setActiveStatusFilters) setActiveStatusFilters([]);
        }
    };

    const filteredUnits = UNIT_OPTIONS.filter(
        (u) =>
            !unitSearch ||
            u.name.toLowerCase().includes(unitSearch.toLowerCase()) ||
            u.symbol.toLowerCase().includes(unitSearch.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Filter Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer shadow-2xs ${
                    activeCount > 0
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
            >
                <Filter size={13} />
                <span>Filter</span>
                {activeCount > 0 && (
                    <span className="ml-0.5 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                        {activeCount}
                    </span>
                )}
                <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Inline Dropdown Popup */}
            {isOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[6000] p-4 font-medium text-xs flex flex-col gap-3 text-gray-800 dark:text-gray-200 select-none animate-in fade-in zoom-in-95">
                    {/* Resource Type Section */}
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                            Resource Type
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { value: 'material', label: 'Material' },
                                { value: 'item', label: 'Item' },
                                { value: 'labour', label: 'Labour' }
                            ].map((t) => {
                                const isSelected = types.includes(t.value);
                                return (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => toggleType(t.value)}
                                        className={`px-2.5 py-1 rounded-md border text-xs font-semibold transition cursor-pointer ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                                                : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Base Unit Searchable Section */}
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                            Base Unit
                        </p>
                        <input
                            type="text"
                            placeholder="Search unit..."
                            className="w-full px-2.5 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs mb-1.5 focus:outline-none font-semibold text-gray-900 dark:text-white"
                            value={unitSearch}
                            onChange={(e) => setUnitSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                        <div
                            className="max-h-32 overflow-y-auto border border-gray-150 dark:border-white/10 rounded-lg p-1 space-y-0.5 [&::-webkit-scrollbar]:hidden"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {filteredUnits.length > 0 ? (
                                filteredUnits.slice(0, 6).map((u) => {
                                    const isSelected = units.includes(u.code);
                                    return (
                                        <div
                                            key={u.code}
                                            onClick={() => toggleUnit(u.code)}
                                            className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition text-xs ${
                                                isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 font-bold text-blue-600 dark:text-blue-400'
                                                    : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <span>{u.name}</span>
                                            <span className="text-[10px] text-gray-400 font-mono">
                                                ({u.symbol})
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[11px] text-gray-400 text-center py-2">No units found</p>
                            )}
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-white/10">
                        <button
                            type="button"
                            onClick={handleReset}
                            className="text-[11px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-semibold cursor-pointer"
                        >
                            Reset All
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourceFilterDropdown;
