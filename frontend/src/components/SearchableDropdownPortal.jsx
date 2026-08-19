import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Search, X, Plus, Check } from 'lucide-react';

/**
 * Intelligent Smart Ranking for search options.
 * Prioritizes: Exact matches -> Starts with query -> Word starts with query -> Substring contains query.
 */
export function rankAndFilter(items, query, getLabel = (item) => (typeof item === 'string' ? item : item.label || item.name || '')) {
    if (!query || !query.trim()) return items;
    const q = query.trim().toLowerCase();

    const exact = [];
    const startsWith = [];
    const wordStartsWith = [];
    const contains = [];

    for (const item of items) {
        const text = String(getLabel(item) || '').trim().toLowerCase();
        if (text === q) {
            exact.push(item);
        } else if (text.startsWith(q)) {
            startsWith.push(item);
        } else if (text.split(/[\s&/_-]+/).some(word => word.startsWith(q))) {
            wordStartsWith.push(item);
        } else if (text.includes(q)) {
            contains.push(item);
        }
    }

    return [...exact, ...startsWith, ...wordStartsWith, ...contains];
}

/**
 * Highlight matching query parts inside the label text.
 */
export function HighlightMatch({ text, query, className = '' }) {
    if (!query || !query.trim() || !text) {
        return <span className={className}>{text}</span>;
    }

    const safeQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    const parts = String(text).split(regex);

    return (
        <span className={className}>
            {parts.map((part, index) =>
                regex.test(part) ? (
                    <span
                        key={index}
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
 * Reusable Accessible Searchable Dropdown with keyboard navigation & smart ranking.
 */
const SearchableDropdownPortal = ({
    coords = { top: 0, left: 0, width: 280 },
    items = [],
    getLabel = (item) => (typeof item === 'string' ? item : item.label || item.name || ''),
    getKey = (item, idx) => (typeof item === 'object' && item !== null ? item.id || item.value || idx : idx),
    selectedValue = '',
    onSelect,
    onClose,
    placeholder = 'Search or enter...',
    allowCreate = false,
    onCreate,
    createLabel = 'Add',
    maxHeight = 220
}) => {
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const containerRef = useRef(null);

    // Filter and rank items intelligently
    const filteredItems = useMemo(() => {
        return rankAndFilter(items, search, getLabel);
    }, [items, search, getLabel]);

    // Check if the exact typed query already exists in the filtered items
    const hasExactMatch = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return items.some(item => String(getLabel(item) || '').trim().toLowerCase() === q);
    }, [items, search, getLabel]);

    const canCreate = allowCreate && search.trim().length > 0 && !hasExactMatch;
    const totalSelectableCount = filteredItems.length + (canCreate ? 1 : 0);

    // Reset active index when query changes
    useEffect(() => {
        setActiveIndex(0);
    }, [search]);

    // Focus input on open
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Outside click listener
    useEffect(() => {
        const handleMouseDown = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                onClose?.();
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [onClose]);

    // Scroll active item into view
    useEffect(() => {
        if (!listRef.current) return;
        const activeElem = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
        if (activeElem) {
            activeElem.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose?.();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (totalSelectableCount > 0) {
                setActiveIndex((prev) => (prev + 1) % totalSelectableCount);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (totalSelectableCount > 0) {
                setActiveIndex((prev) => (prev - 1 + totalSelectableCount) % totalSelectableCount);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (canCreate && activeIndex === filteredItems.length) {
                if (onCreate) onCreate(search.trim());
                else onSelect?.(search.trim());
                onClose?.();
            } else if (filteredItems.length > 0 && activeIndex >= 0 && activeIndex < filteredItems.length) {
                onSelect?.(filteredItems[activeIndex]);
                onClose?.();
            } else if (canCreate) {
                if (onCreate) onCreate(search.trim());
                else onSelect?.(search.trim());
                onClose?.();
            }
        }
    };

    // Keep dropdown inside viewport
    const adjustedTop = Math.min(coords.top, window.innerHeight - 320);
    const adjustedLeft = Math.min(coords.left, window.innerWidth - (coords.width || 280) - 16);

    return ReactDOM.createPortal(
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: Math.max(10, adjustedTop),
                left: Math.max(10, adjustedLeft),
                width: Math.max(coords.width || 280, 260),
                zIndex: 99999
            }}
            className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col p-2 animate-in fade-in-50 duration-150 text-left font-sans"
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Search Input Bar */}
            <div className="relative mb-1.5">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearch('');
                            inputRef.current?.focus();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* List options */}
            <div
                ref={listRef}
                style={{ maxHeight: `${maxHeight}px` }}
                className="overflow-y-auto custom-scrollbar flex flex-col space-y-0.5 pr-0.5"
                role="listbox"
            >
                {filteredItems.length === 0 && !canCreate && (
                    <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500 italic">
                        No matches found
                    </div>
                )}

                {filteredItems.map((item, idx) => {
                    const label = getLabel(item);
                    const isSelected = String(label).toLowerCase() === String(selectedValue).toLowerCase();
                    const isActive = activeIndex === idx;

                    return (
                        <button
                            key={getKey(item, idx)}
                            data-index={idx}
                            type="button"
                            onMouseEnter={() => setActiveIndex(idx)}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelect?.(item);
                                onClose?.();
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between group cursor-pointer ${
                                isActive
                                    ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold'
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                            role="option"
                            aria-selected={isSelected}
                        >
                            <span className="truncate flex-1">
                                <HighlightMatch text={label} query={search} />
                            </span>
                            {isSelected && (
                                <Check size={13} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                            )}
                        </button>
                    );
                })}

                {/* + Add Option */}
                {canCreate && (
                    <button
                        data-index={filteredItems.length}
                        type="button"
                        onMouseEnter={() => setActiveIndex(filteredItems.length)}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onCreate) onCreate(search.trim());
                            else onSelect?.(search.trim());
                            onClose?.();
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 mt-1 border border-dashed border-blue-500/30 cursor-pointer ${
                            activeIndex === filteredItems.length
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-blue-50/70 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        }`}
                        role="option"
                    >
                        <Plus size={12} className="shrink-0" />
                        <span className="truncate">
                            {createLabel} "<span className="font-bold">{search.trim()}</span>"
                        </span>
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
};

export default SearchableDropdownPortal;
