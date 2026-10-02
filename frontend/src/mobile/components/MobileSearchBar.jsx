import React, { forwardRef, useId } from 'react';
import { Search, X } from 'lucide-react';

const MobileSearchBar = forwardRef(function MobileSearchBar({ value, onChange, onClear, placeholder = 'Search', label = 'Search' }, ref) {
    const inputId = useId();
    return (
        <div className="relative w-full min-w-0">
            <label htmlFor={inputId} className="sr-only">{label}</label>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                ref={ref}
                id={inputId}
                type="search"
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
                placeholder={placeholder}
                className="h-9 w-full min-w-0 rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-9 text-xs font-normal text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 dark:border-gh-border dark:bg-gh-input dark:text-gh-text"
            />
            {value && (
                <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => onClear ? onClear() : onChange?.('')}
                    className="absolute right-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:text-gh-text"
                >
                    <X size={15} aria-hidden="true" />
                </button>
            )}
        </div>
    );
});

export default MobileSearchBar;
