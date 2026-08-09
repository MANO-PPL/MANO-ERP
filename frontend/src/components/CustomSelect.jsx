import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

const CustomSelect = ({ label, options, value, onChange, placeholder = 'Select option', className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 220 });
    const buttonRef = useRef(null);
    const menuRef = useRef(null);

    const updateCoords = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpward = spaceBelow < 180 && rect.top > 180;
            
            setMenuCoords({
                top: openUpward ? rect.top : rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                openUpward,
                maxHeight: openUpward ? Math.min(220, rect.top - 10) : Math.min(220, spaceBelow - 10)
            });
        }
    };

    const toggleOpen = (e) => {
        e.stopPropagation();
        if (!isOpen) {
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

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen]);

    const normalizedOptions = (options || []).map(opt => {
        if (typeof opt === 'object' && opt !== null) {
            return { label: opt.label, value: opt.value };
        }
        return { label: opt, value: opt };
    });

    const selectedOpt = normalizedOptions.find(o => o.value === value);
    const displayLabel = selectedOpt ? selectedOpt.label : (value || placeholder);

    const handleOptionClick = (optValue, e) => {
        e.stopPropagation();
        if (onChange) {
            onChange({ target: { value: optValue } });
        }
        setIsOpen(false);
    };

    return (
        <div className={`w-full relative ${className}`}>
            {label && <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>}
            
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                className={`w-full flex items-center justify-between px-3 py-1.5 bg-white dark:bg-[#161b22] border rounded-md text-xs text-gray-900 dark:text-white transition-all cursor-pointer shadow-2xs hover:border-blue-500/40 text-left ${
                    isOpen ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm' : 'border-gray-200 dark:border-gh-border'
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
                        width: `${Math.max(menuCoords.width, 130)}px`,
                        maxHeight: `${menuCoords.maxHeight || 220}px`,
                        zIndex: 999999
                    }}
                    className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg shadow-xl overflow-hidden overflow-y-auto animate-in fade-in-50 duration-150 py-1"
                >
                    {normalizedOptions.map((opt, idx) => {
                        const isSelected = opt.value === value;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={(e) => handleOptionClick(opt.value, e)}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left cursor-pointer ${
                                    isSelected 
                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold' 
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                                }`}
                            >
                                <span className="truncate">{opt.label}</span>
                                {isSelected && <Check size={13} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

export default CustomSelect;
