import React from 'react';
import { ChevronRight } from 'lucide-react';

export function MobileCard({ children, className = '', as: Component = 'section', ...props }) {
    return (
        <Component
            className={`w-full min-w-0 rounded-xl border border-gray-200/90 bg-white p-2.5 sm:p-3 shadow-2xs dark:border-gh-border dark:bg-gh-subtle ${className}`}
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
            className={`flex w-full items-center gap-2.5 text-left ${onClick ? 'min-h-12 py-2 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-gh-hover' : ''} ${className}`}
        >
            {Icon && (
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    <Icon size={18} aria-hidden="true" />
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gh-text">{title}</span>
                {subtitle && <span className="mt-0.5 block truncate text-xs font-normal text-gray-500 dark:text-gh-muted">{subtitle}</span>}
                {meta && <span className="mt-0.5 block text-[11px] font-normal text-gray-400 dark:text-gray-500">{meta}</span>}
            </span>
            {trailing || (onClick && <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-gray-400" />)}
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
        <MobileCard className={`p-2.5 ${className}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-[11px] font-normal text-gray-500 dark:text-gh-muted">{label}</p>
                    <p className="mt-0.5 break-words text-lg font-bold tracking-tight text-gray-950 dark:text-gh-text">{value}</p>
                    {detail && <p className="mt-0.5 text-[10px] font-normal leading-tight text-gray-500 dark:text-gh-muted">{detail}</p>}
                </div>
                {Icon && <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone] || tones.blue}`}><Icon size={16} aria-hidden="true" /></span>}
            </div>
        </MobileCard>
    );
}

export default MobileCard;
