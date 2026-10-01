import React from 'react';
import { Inbox } from 'lucide-react';

export default function MobileEmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action }) {
    return (
        <section className="w-full min-w-0 px-3 py-6 text-center">
            <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gh-subtle dark:text-gh-muted">
                <Icon size={20} aria-hidden="true" />
            </span>
            <h2 className="mt-2 text-xs font-semibold text-gray-900 dark:text-gh-text">{title}</h2>
            {description && <p className="mx-auto mt-0.5 max-w-sm text-xs font-normal leading-relaxed text-gray-500 dark:text-gh-muted">{description}</p>}
            {action && <div className="mt-3 flex justify-center">{action}</div>}
        </section>
    );
}
