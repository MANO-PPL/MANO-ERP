import React from 'react';

export default function MobilePageHeader({ title, subtitle, actions }) {
    if (!actions && !subtitle) {
        return null;
    }

    return (
        <header className="w-full min-w-0 px-2 sm:px-3 py-1.5">
            <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {subtitle && (
                        <p className="truncate text-xs font-normal text-gray-500 dark:text-gh-muted">
                            {subtitle}
                        </p>
                    )}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
            </div>
        </header>
    );
}


