import React, { forwardRef, useId } from 'react';

const MobileDatePicker = forwardRef(function MobileDatePicker({ label, error, hint, className = '', ...props }, ref) {
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    return (
        <div className={`min-w-0 ${className}`}>
            {label && <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gh-text">{label}</label>}
            <input
                ref={ref}
                id={id}
                type="date"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : hint ? hintId : undefined}
                className={`min-h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-gh-input dark:text-gh-text dark:[color-scheme:dark] ${error ? 'border-red-500' : 'border-gray-200 focus:border-blue-500 dark:border-gh-border'}`}
                {...props}
            />
            {error ? <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : hint && <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gh-muted">{hint}</p>}
        </div>
    );
});

export default MobileDatePicker;
