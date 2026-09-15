import React from 'react';
import { LoaderCircle } from 'lucide-react';

export default function MobileLoadingState({ label = 'Loading…', rows = 0 }) {
    return (
        <div role="status" aria-live="polite" className="w-full min-w-0 px-4 py-8 text-center">
            <LoaderCircle size={26} aria-hidden="true" className="mx-auto animate-spin text-blue-600 dark:text-blue-400" />
            <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-gh-muted">{label}</p>
            {rows > 0 && (
                <div className="mt-5 space-y-3" aria-hidden="true">
                    {Array.from({ length: rows }, (_, index) => (
                        <div key={index} className="h-20 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gh-border dark:bg-gh-subtle" />
                    ))}
                </div>
            )}
        </div>
    );
}
