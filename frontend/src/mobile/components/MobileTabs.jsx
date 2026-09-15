import React from 'react';

export default function MobileTabs({ items = [], value, onChange, label = 'Sections', segmented = false }) {
    return (
        <div
            role="tablist"
            aria-label={label}
            className={`flex max-w-full gap-1 overflow-x-auto overscroll-x-contain ${segmented ? 'rounded-xl bg-gray-100 p-1 dark:bg-gh-subtle' : 'border-b border-gray-200 dark:border-gh-border'}`}
        >
            {items.map((item) => {
                const selected = item.value === value;
                return (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        disabled={item.disabled}
                        onClick={() => onChange?.(item.value)}
                        className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                            selected
                                ? segmented
                                    ? 'bg-white text-blue-700 shadow-sm dark:bg-gh-hover dark:text-blue-300'
                                    : 'border-b-2 border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gh-muted dark:hover:text-gh-text'
                        }`}
                    >
                        {item.label}
                        {item.count != null && <span className="ml-1.5 text-[11px] opacity-70">{item.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
