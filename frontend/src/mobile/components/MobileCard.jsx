import React from 'react';
import { ChevronRight } from 'lucide-react';

export function MobileCard({ children, className = '', as: Component = 'section', ...props }) {
    return (
        <Component
            className={`min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gh-border dark:bg-gh-subtle ${className}`}
            {...props}
        >
            {children}
        </Component>
    );
}

export function MobileEntityCard({ title, subtitle, meta, icon: Icon, onClick, trailing, className = '' }) {
    const Component = onClick ? 'button' : 'article';
    return (
        <MobileCard
            as={Component}
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`flex w-full items-center gap-3 text-left ${onClick ? 'min-h-14 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-gh-hover' : ''} ${className}`}
        >
            {Icon && (
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    <Icon size={20} aria-hidden="true" />
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-900 dark:text-gh-text">{title}</span>
                {subtitle && <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gh-muted">{subtitle}</span>}
                {meta && <span className="mt-1 block text-[11px] font-medium text-gray-400 dark:text-gray-500">{meta}</span>}
            </span>
            {trailing || (onClick && <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-gray-400" />)}
        </MobileCard>
    );
}

export function MobileStatCard({ label, value, detail, icon: Icon, tone = 'blue', className = '' }) {
    const tones = {
        blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
        green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
        amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
        red: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    };
    return (
        <MobileCard className={className}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-gray-500 dark:text-gh-muted">{label}</p>
                    <p className="mt-1 break-words text-2xl font-extrabold tracking-tight text-gray-950 dark:text-gh-text">{value}</p>
                    {detail && <p className="mt-1 text-[11px] leading-4 text-gray-500 dark:text-gh-muted">{detail}</p>}
                </div>
                {Icon && <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}><Icon size={19} aria-hidden="true" /></span>}
            </div>
        </MobileCard>
    );
}

export default MobileCard;
