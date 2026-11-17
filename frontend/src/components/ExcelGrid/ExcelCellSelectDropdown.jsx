import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, ChevronDown } from 'lucide-react';

/**
 * Highlights matching search terms in option labels.
 */
function HighlightMatch({ text, query }) {
    if (!query || !query.trim() || !text) {
        return <span>{text}</span>;
    }
    const safe = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safe})`, 'gi');
    const parts = String(text).split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <span
                        key={i}
                        className="text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 dark:bg-blue-400/20 px-0.5 rounded"
                    >
                        {part}
                    </span>
                ) : (
                    part
                )
            )}
        </span>
    );
}

/**
 * Enterprise theme-aware portal dropdown for ExcelGrid select cells.
 * Fully adapts to White (Light) and Black (Dark) theme modes with smooth
 * animations, keyboard navigation, smart search, and badge rendering.
 */
export const ExcelCellSelectDropdown = ({
    anchorEl,
    value,
    options = [],
    placeholder = 'Search or select...',
    renderOption = null,
    onSelect,
    onClose,
    allowClear = true,
    clearLabel = '-- Select --'
}) => {
    const [coords, setCoords] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    const menuRef = useRef(null);
    const listRef = useRef(null);
    const searchInputRef = useRef(null);

    // Compute bounding coordinates relative to viewport
    const updatePosition = () => {
        if (!anchorEl) return;
        const rect = anchorEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Auto direction: open upward if cramped below and more room above
        const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;

        const dropdownWidth = Math.max(rect.width, 220);
        let left = rect.left;

        // Viewport horizontal boundary clamp
        if (left + dropdownWidth > window.innerWidth - 12) {
            left = Math.max(12, window.innerWidth - dropdownWidth - 12);
        }
        if (left < 12) {
            left = 12;
        }

        const availableHeight = openUpward ? spaceAbove - 16 : spaceBelow - 16;
        const maxHeight = Math.max(120, Math.min(280, availableHeight));

        setCoords({
            top: openUpward ? 'auto' : `${rect.bottom + 4}px`,
            bottom: openUpward ? `${window.innerHeight - rect.top + 4}px` : 'auto',
            left: `${left}px`,
            width: `${dropdownWidth}px`,
            maxHeight: `${maxHeight}px`,
            openUpward
        });
    };

    useEffect(() => {
        updatePosition();

        const handleOutsideClick = (e) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target) &&
                anchorEl && !anchorEl.contains(e.target)
            ) {
                onClose?.();
            }
        };

        const handleScrollOrResize = () => {
            updatePosition();
        };

        document.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);

        const timer = setTimeout(() => {
            if (searchInputRef.current) {
                searchInputRef.current.focus({ preventScroll: true });
            }
        }, 30);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [anchorEl]);

    // Normalize incoming options array
    const normalizedOptions = useMemo(() => {
        const list = (options || []).map((opt) => {
            if (typeof opt === 'object' && opt !== null) {
                const optVal = opt.value !== undefined ? opt.value : (opt.code !== undefined ? opt.code : opt.id);
                const optLabel = opt.label !== undefined ? opt.label : (opt.name ? `${opt.name} (${opt.code || opt.symbol || opt.value || ''})` : (opt.code || opt.value || String(optVal)));
                return { value: optVal, label: String(optLabel) };
            }
            return { value: opt, label: String(opt) };
        });
        return list;
    }, [options]);

    // Filter options based on typed search query
    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return normalizedOptions;
        const q = searchQuery.trim().toLowerCase();
        return normalizedOptions.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [normalizedOptions, searchQuery]);

    // Total selectable options count including clear option if present
    const showClearOption = allowClear && !searchQuery.trim();
    const totalSelectableCount = filteredOptions.length + (showClearOption ? 1 : 0);

    // Reset activeIndex when query changes
    useEffect(() => {
        setActiveIndex(0);
    }, [searchQuery]);

    // Scroll active item into view
    useEffect(() => {
        if (!listRef.current) return;
        const activeElem = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
        if (activeElem) {
            activeElem.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex]);

    const handleSelectOption = (optVal) => {
        onSelect?.(optVal);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose?.();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            if (totalSelectableCount > 0) {
                setActiveIndex((prev) => (prev + 1) % totalSelectableCount);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            if (totalSelectableCount > 0) {
                setActiveIndex((prev) => (prev - 1 + totalSelectableCount) % totalSelectableCount);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (totalSelectableCount > 0) {
                if (showClearOption && activeIndex === 0) {
                    handleSelectOption('');
                } else {
                    const itemIdx = showClearOption ? activeIndex - 1 : activeIndex;
                    if (filteredOptions[itemIdx]) {
                        handleSelectOption(filteredOptions[itemIdx].value);
                    }
                }
            }
        } else if (e.key === 'Tab') {
            e.stopPropagation();
            if (showClearOption && activeIndex === 0) {
                handleSelectOption('');
            } else {
                const itemIdx = showClearOption ? activeIndex - 1 : activeIndex;
                if (filteredOptions[itemIdx]) {
                    handleSelectOption(filteredOptions[itemIdx].value);
                } else {
                    onClose?.();
                }
            }
        }
    };

    if (!coords) return null;

    return createPortal(
        <div
            ref={menuRef}
            data-excel-select-portal="true"
            style={{
                position: 'fixed',
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
                maxHeight: coords.maxHeight,
                zIndex: 999999
            }}
            className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col py-1.5 transition-all text-left select-none ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-100 font-sans"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
        >
            {/* Search Input Bar (Shown when more than 5 options or when actively searching) */}
            {(normalizedOptions.length > 5 || searchQuery) && (
                <div className="px-2 py-1 border-b border-gray-100 dark:border-white/5 sticky top-0 bg-white dark:bg-[#161b22] z-10">
                    <div className="relative">
                        <Search
                            size={12}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
                        />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={placeholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-7 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md text-xs outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 font-medium"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    searchInputRef.current?.focus();
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Options List */}
            <div
                ref={listRef}
                className="overflow-y-auto custom-scrollbar flex-1 py-1 px-1 space-y-0.5"
                role="listbox"
            >
                {/* Clear / Empty Default Option */}
                {showClearOption && (
                    <button
                        type="button"
                        data-index={0}
                        onMouseEnter={() => setActiveIndex(0)}
                        onClick={() => handleSelectOption('')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer italic ${
                            activeIndex === 0
                                ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                                : 'text-gray-400 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                        }`}
                        role="option"
                        aria-selected={!value}
                    >
                        <span className="truncate">{clearLabel}</span>
                        {!value && <Check size={13} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                    </button>
                )}

                {/* No Matches Found Notice */}
                {filteredOptions.length === 0 && (
                    <div className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500 text-center italic">
                        No options found
                    </div>
                )}

                {/* Option Items */}
                {filteredOptions.map((opt, idx) => {
                    const optionIndex = showClearOption ? idx + 1 : idx;
                    const isSelected = String(opt.value ?? '').trim().toLowerCase() === String(value ?? '').trim().toLowerCase();
                    const isActive = activeIndex === optionIndex;

                    return (
                        <button
                            key={opt.value !== undefined && opt.value !== null ? String(opt.value) : idx}
                            type="button"
                            data-index={optionIndex}
                            onMouseEnter={() => setActiveIndex(optionIndex)}
                            onClick={() => handleSelectOption(opt.value)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                                isSelected
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                                    : isActive
                                    ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                            }`}
                            role="option"
                            aria-selected={isSelected}
                        >
                            <span className="truncate flex-1 min-w-0 pr-1">
                                {renderOption ? (
                                    renderOption(opt.value, isSelected, isActive)
                                ) : (
                                    <HighlightMatch text={opt.label} query={searchQuery} />
                                )}
                            </span>
                            {isSelected && (
                                <Check size={13} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>,
        document.body
    );
};

export default ExcelCellSelectDropdown;
