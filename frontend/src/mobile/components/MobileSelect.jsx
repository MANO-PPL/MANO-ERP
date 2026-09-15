import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

const MobileSelect = forwardRef(function MobileSelect({ label, options = [], error, hint, className = '', ...props }, ref) {
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    return (
        <div className={`min-w-0 ${className}`}>
            {label && <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gh-text">{label}</label>}
            <div className="relative">
                <select
                    ref={ref}
                    id={id}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : hint ? hintId : undefined}
                    className={`min-h-11 w-full appearance-none rounded-xl border bg-white px-3 pr-10 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-gh-input dark:text-gh-text ${error ? 'border-red-500' : 'border-gray-200 focus:border-blue-500 dark:border-gh-border'}`}
                    {...props}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
                    ))}
                </select>
                <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            {error ? <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : hint && <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gh-muted">{hint}</p>}
        </div>
    );
});

export default MobileSelect;
