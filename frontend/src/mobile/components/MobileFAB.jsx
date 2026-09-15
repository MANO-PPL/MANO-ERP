import React, { forwardRef } from 'react';
import { Plus } from 'lucide-react';

const MobileFAB = forwardRef(function MobileFAB({ label = 'Add', icon: Icon = Plus, extended = false, className = '', style, ...props }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            aria-label={label}
            style={{
                bottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + var(--mobile-agent-clearance, 4.75rem))',
                ...style,
            }}
            className={`fixed right-4 z-20 inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${className}`}
            {...props}
        >
            <Icon size={21} aria-hidden="true" />
            {extended && <span>{label}</span>}
        </button>
    );
});

export default MobileFAB;
