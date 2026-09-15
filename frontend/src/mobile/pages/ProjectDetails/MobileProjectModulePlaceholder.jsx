import React from 'react';
import MobileCard from '../../components/MobileCard';

export default function MobileProjectModulePlaceholder({ module }) {
    return <div data-mobile-project-module={module.key} className="px-4 pb-28">
        <MobileCard className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">{module.classification} workspace</p>
            <h2 className="mt-2 text-lg font-black text-gray-950 dark:text-gh-text">{module.label}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gh-muted">The mobile {module.label} workspace is planned for {module.stage}. This project shell keeps the module discoverable without loading the desktop workspace.</p>
        </MobileCard>
    </div>;
}