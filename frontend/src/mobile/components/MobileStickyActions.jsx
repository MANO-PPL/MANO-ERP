import React from 'react';

export default function MobileStickyActions({ children, className = '', label = 'Page actions', style }) {
    return (
        <div
            role="group"
            aria-label={label}
            style={{ bottom: 'var(--mobile-agent-clearance, 4.75rem)', ...style }}
            className={`sticky z-20 flex min-h-16 w-full items-center gap-2 border-t border-gray-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-gh-border dark:bg-gh-subtle/95 ${className}`}
        >
            {children}
        </div>
    );
}
