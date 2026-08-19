import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { rankAndFilter, HighlightMatch } from './SearchableDropdownPortal';

const CustomSelect = ({ 
    label, 
    options = [], 
    value, 
    onChange, 
    placeholder = 'Select option', 
    className = '', 
    buttonClassName = '',
    direction = 'down', 
    alwaysOpenDownward = true,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 240 });
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const listRef = useRef(null);
    const searchInputRef = useRef(null);

    const updateCoords = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpward = (!alwaysOpenDownward && direction !== 'down') && (spaceBelow < 180 && rect.top > 180);
            
            setMenuCoords({
                top: openUpward ? rect.top : rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                openUpward,
                maxHeight: openUpward ? Math.min(240, rect.top - 10) : Math.min(260, Math.max(140, spaceBelow - 10))
            });
        }
    };

    const toggleOpen = (e) => {
        e.stopPropagation();
        if (disabled) return;
        if (!isOpen) {
            setSearchQuery('');
            setActiveIndex(0);
            updateCoords();
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (event) => {
            if (
                buttonRef.current && !buttonRef.current.contains(event.target) &&
                menuRef.current && !menuRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        const handleScrollOrResize = () => {
            updateCoords();
        };

        document.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);

        if (searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen]);

    const normalizedOptions = useMemo(() => {
        return (options || []).map(opt => {
            if (typeof opt === 'object' && opt !== null) {
                return { label: opt.label !== undefined ? String(opt.label) : String(opt.value), value: opt.value };
            }
            return { label: String(opt), value: opt };
        });
    }, [options]);

    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return normalizedOptions;
        return rankAndFilter(normalizedOptions, searchQuery, opt => opt.label);
    }, [normalizedOptions, searchQuery]);

    // Reset activeIndex on search query change
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

    const selectedOpt = normalizedOptions.find(o => String(o.value) === String(value));
    const displayLabel = selectedOpt ? selectedOpt.label : (value !== undefined && value !== '' ? value : placeholder);

    const handleOptionClick = (optValue, e) => {
        e?.stopPropagation();
        if (onChange) {
            onChange({ target: { value: optValue } });
        }
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filteredOptions.length > 0) {
                setActiveIndex(prev => (prev + 1) % filteredOptions.length);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filteredOptions.length > 0) {
                setActiveIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredOptions.length > 0 && activeIndex >= 0 && activeIndex < filteredOptions.length) {
                handleOptionClick(filteredOptions[activeIndex].value, e);
            }
        }
    };

    return (
        <div className={`relative ${className}`}>
            {label && <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>}
            
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onClick={toggleOpen}
                className={buttonClassName || `w-full flex items-center justify-between px-3 py-1.5 bg-white dark:bg-[#161b22] border rounded-lg text-xs text-gray-900 dark:text-white transition-all cursor-pointer shadow-2xs hover:border-blue-500/40 text-left ${
                    disabled ? 'opacity-60 cursor-not-allowed' : ''
                } ${
                    isOpen ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm' : 'border-gray-200 dark:border-white/10'
                }`}
            >
                <span className="truncate pr-1 font-medium">{displayLabel}</span>
                <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        top: menuCoords.openUpward ? 'auto' : `${menuCoords.top}px`,
                        bottom: menuCoords.openUpward ? `${window.innerHeight - menuCoords.top + 4}px` : 'auto',
                        left: `${menuCoords.left}px`,
                        width: `${Math.max(menuCoords.width, 180)}px`,
                        maxHeight: `${menuCoords.maxHeight || 260}px`,
                        zIndex: 999999
                    }}
                    className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in-50 duration-150 py-1"
                >
                    {normalizedOptions.length > 5 && (
                        <div className="px-2 py-1.5 border-b border-gray-100 dark:border-white/5 sticky top-0 bg-white dark:bg-[#161b22] z-10">
                            <div className="relative">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search options..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full pl-7 pr-7 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md text-xs outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-blue-500"
                                    onClick={e => e.stopPropagation()}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            searchInputRef.current?.focus();
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div ref={listRef} className="overflow-y-auto custom-scrollbar flex-1 py-1 px-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500 text-center italic">No options found</div>
                        ) : (
                            filteredOptions.map((opt, idx) => {
                                const isSelected = String(opt.value) === String(value);
                                const isActive = activeIndex === idx;
                                return (
                                    <button
                                        key={idx}
                                        data-index={idx}
                                        type="button"
                                        onMouseEnter={() => setActiveIndex(idx)}
                                        onClick={(e) => handleOptionClick(opt.value, e)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                                            isSelected 
                                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold' 
                                                : isActive
                                                ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                                        }`}
                                    >
                                        <span className="truncate flex-1">
                                            <HighlightMatch text={opt.label} query={searchQuery} />
                                        </span>
                                        {isSelected && <Check size={13} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CustomSelect;
