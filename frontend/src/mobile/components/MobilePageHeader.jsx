import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function MobilePageHeader({ title, subtitle, onBack, actions, eyebrow }) {
    return (
        <header className="w-full min-w-0 px-4 pb-3 pt-4">
            <div className="flex min-w-0 items-start gap-3">
                {onBack && (
                    <button
                        type="button"
                        aria-label="Go back"
                        onClick={onBack}
                        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-gh-border dark:bg-gh-subtle dark:text-gh-muted"
                    >
                        <ArrowLeft size={20} aria-hidden="true" />
                    </button>
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                    {eyebrow && <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">{eyebrow}</p>}
                    <h1 className="break-words text-xl font-extrabold tracking-tight text-gray-950 dark:text-gh-text">{title}</h1>
                    {subtitle && <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gh-muted">{subtitle}</p>}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
            </div>
        </header>
    );
}
