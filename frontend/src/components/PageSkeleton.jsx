import React from 'react';

/* ─── Reusable shimmer block ─────────────────────────────────────────────── */
const Shimmer = ({ className = '' }) => (
    <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-white/[0.06] ${className}`} />
);

/* ─── Card skeleton (mirrors a project/vendor/doc card) ─────────────────── */
const CardSkeleton = () => (
    <div className="rounded-2xl border border-gray-100 dark:border-white/[0.05] bg-white dark:bg-[#161b22] p-4 space-y-3">
        {/* 2×2 image grid */}
        <div className="grid grid-cols-2 gap-2">
            <Shimmer className="h-16" />
            <Shimmer className="h-16" />
            <Shimmer className="h-16" />
            <Shimmer className="h-16" />
        </div>
        {/* text lines */}
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-2.5 w-1/2" />
        <Shimmer className="h-6 w-20 rounded-full" />
    </div>
);

/* ─── Table-row skeleton (mirrors list pages) ────────────────────────────── */
const TableSkeleton = () => (
    <div className="space-y-0 divide-y divide-gray-100 dark:divide-white/5">
        {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
                <Shimmer className="w-8 h-8 rounded-full shrink-0" />
                <Shimmer className="h-3 w-40" />
                <Shimmer className="h-3 w-24 ml-6" />
                <Shimmer className="h-3 w-28 ml-auto" />
                <Shimmer className="h-6 w-16 rounded-full" />
            </div>
        ))}
    </div>
);

/* ─── Main PageSkeleton export ────────────────────────────────────────────── */
/**
 * variant:
 *   'grid'  – card grid (Projects, Vendors default)
 *   'table' – row list (Users, etc.)
 *   'auto'  – default (grid)
 */
const PageSkeleton = ({ variant = 'grid' }) => (
    <div className="flex flex-col h-[calc(100vh-7vh)] w-full bg-gray-50 dark:bg-[#0d1117] animate-[fadeIn_0.2s_ease]">

        {/* ── Toolbar shimmer ── */}
        <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/[0.05]">
            {/* Tab pills */}
            <div className="flex gap-2">
                {[80, 60, 72, 56].map((w, i) => (
                    <Shimmer key={i} className="h-8 rounded-full" style={{ width: w }} />
                ))}
            </div>
            {/* Action buttons */}
            <div className="flex gap-2">
                <Shimmer className="h-8 w-24 rounded-lg" />
                <Shimmer className="h-8 w-32 rounded-lg" />
            </div>
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 overflow-hidden p-6">
            {variant === 'table' ? (
                <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/[0.05] overflow-hidden">
                    {/* Table header */}
                    <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 dark:border-white/5">
                        {[120, 96, 80, 108, 72, 64].map((w, i) => (
                            <Shimmer key={i} className="h-3 rounded" style={{ width: w }} />
                        ))}
                    </div>
                    <TableSkeleton />
                </div>
            ) : (
                <div className="grid grid-cols-5 gap-4 h-full">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            )}
        </div>
    </div>
);

export default PageSkeleton;
