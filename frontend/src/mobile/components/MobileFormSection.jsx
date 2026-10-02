import React from 'react';

export default function MobileFormSection({ title, description, children, actions, className = '' }) {
    return (
        <fieldset className={`min-w-0 rounded-lg border border-gray-200 bg-white p-2.5 sm:p-3 dark:border-gh-border dark:bg-gh-subtle ${className}`}>
            <legend className="sr-only">{title}</legend>
            <div className="mb-2.5 flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                    <h2 className="text-xs font-semibold text-gray-900 dark:text-gh-text">{title}</h2>
                    {description && <p className="mt-0.5 text-xs font-normal leading-relaxed text-gray-500 dark:text-gh-muted">{description}</p>}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
            </div>
            <div className="space-y-2.5">{children}</div>
        </fieldset>
    );
}
