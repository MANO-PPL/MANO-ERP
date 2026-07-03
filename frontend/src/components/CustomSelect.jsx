import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomSelect = ({ label, options, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalizedOptions = (options || []).map(opt => {
        if (typeof opt === 'object' && opt !== null) {
            return { label: opt.label, value: opt.value };
        }
        return { label: opt, value: opt };
    });

    const selectedOpt = normalizedOptions.find(o => o.value === value) || normalizedOptions[0];
    const displayLabel = selectedOpt ? selectedOpt.label : '';

    const handleOptionClick = (optValue) => {
        if (onChange) {
            onChange({ target: { value: optValue } });
        }
        setIsOpen(false);
    };

    return (
        <div className="w-full relative" ref={selectRef}>
            {label && <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>}
            
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#161b22] border rounded-lg text-sm text-gray-900 dark:text-white transition-all cursor-pointer shadow-sm dark:shadow-none hover:border-blue-500/30 dark:hover:border-white/20 text-left
                    ${isOpen ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg shadow-blue-500/5' : 'border-gray-200 dark:border-white/10'}`}
                >
                    <span className="truncate">{displayLabel}</span>
                    <ChevronDown size={16} className={`text-gray-500 dark:text-[#7A8AAB] transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-[#1A2235] border border-gray-200 dark:border-[#2A3445] rounded-xl shadow-xl z-50 overflow-hidden max-h-[250px] overflow-y-auto anim-fade-in">
                        {normalizedOptions.map((opt, idx) => {
                            const isSelected = opt.value === value;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleOptionClick(opt.value)}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left text-sm ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                >
                                    <span className="truncate">{opt.label}</span>
                                    {isSelected && <Check size={14} className="text-green-500 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomSelect;
