import React from 'react';
import MobileCard from '../../components/MobileCard';

export default function MobileProjectModulePlaceholder({ module }) {
    return <div data-mobile-project-module={module.key} className="w-full min-w-0 px-2 sm:px-3 pb-28">
        <MobileCard className="p-2.5 sm:p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">{module.classification} workspace</p>
            <h2 className="mt-1.5 text-xs font-semibold text-gray-950 dark:text-gh-text">{module.label}</h2>
            <p className="mt-1 text-xs font-normal leading-relaxed text-gray-600 dark:text-gh-muted">The mobile {module.label} workspace is planned for {module.stage}. This project shell keeps the module discoverable without loading the desktop workspace.</p>
        </MobileCard>
    </div>;
}