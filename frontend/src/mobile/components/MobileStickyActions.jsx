import React from 'react';

export default function MobileStickyActions({ children, className = '', label = 'Page actions', style }) {
    return (
        <div
            role="group"
            aria-label={label}
            style={{ bottom: 'var(--mobile-agent-clearance, 4.75rem)', ...style }}
            className={`sticky z-20 flex min-h-12 w-full items-center gap-2 border-t border-gray-200 bg-white/95 px-2 sm:px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-gh-border dark:bg-gh-subtle/95 ${className}`}
        >
            {children}
        </div>
    );
}
