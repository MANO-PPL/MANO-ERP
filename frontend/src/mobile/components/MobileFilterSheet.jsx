import React from 'react';
import MobileBottomSheet from './MobileBottomSheet';

export default function MobileFilterSheet({ open, onClose, onApply, onReset, title = 'Filters', children, applyLabel = 'Apply filters' }) {
    const footer = (
        <div className="flex gap-2">
            <button
                type="button"
                onClick={onReset}
                className="min-h-11 flex-1 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 dark:border-gh-border dark:text-gh-text"
            >
                Reset
            </button>
            <button
                type="button"
                onClick={onApply}
                className="min-h-11 flex-[1.4] rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
                {applyLabel}
            </button>
        </div>
    );

    return (
        <MobileBottomSheet open={open} onClose={onClose} title={title} footer={footer}>
            <div className="space-y-4">{children}</div>
        </MobileBottomSheet>
    );
}
