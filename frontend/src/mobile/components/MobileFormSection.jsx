import React from 'react';

export default function MobileFormSection({ title, description, children, actions, className = '' }) {
    return (
        <fieldset className={`min-w-0 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gh-border dark:bg-gh-subtle ${className}`}>
            <legend className="sr-only">{title}</legend>
            <div className="mb-4 flex min-w-0 items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-gh-text">{title}</h2>
                    {description && <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gh-muted">{description}</p>}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
            </div>
            <div className="space-y-4">{children}</div>
        </fieldset>
    );
}
