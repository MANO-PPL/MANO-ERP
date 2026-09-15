import React from 'react';
import { Inbox } from 'lucide-react';

export default function MobileEmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action }) {
    return (
        <section className="w-full min-w-0 px-6 py-10 text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-gh-subtle dark:text-gh-muted">
                <Icon size={25} aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-base font-bold text-gray-900 dark:text-gh-text">{title}</h2>
            {description && <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray-500 dark:text-gh-muted">{description}</p>}
            {action && <div className="mt-4 flex justify-center">{action}</div>}
        </section>
    );
}
