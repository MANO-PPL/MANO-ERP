import React, { forwardRef, useId } from 'react';
import { Search, X } from 'lucide-react';

const MobileSearchBar = forwardRef(function MobileSearchBar({ value, onChange, onClear, placeholder = 'Search', label = 'Search' }, ref) {
    const inputId = useId();
    return (
        <div className="relative w-full min-w-0">
            <label htmlFor={inputId} className="sr-only">{label}</label>
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                ref={ref}
                id={inputId}
                type="search"
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
                placeholder={placeholder}
                className="min-h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-11 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gh-border dark:bg-gh-input dark:text-gh-text"
            />
            {value && (
                <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => onClear ? onClear() : onChange?.('')}
                    className="absolute right-0 top-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:text-gh-text"
                >
                    <X size={18} aria-hidden="true" />
                </button>
            )}
        </div>
    );
});

export default MobileSearchBar;
