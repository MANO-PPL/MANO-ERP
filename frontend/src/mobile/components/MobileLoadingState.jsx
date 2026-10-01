import React from 'react';

/** Reusable shimmer block with smooth pulse */
const Shimmer = ({ className = '', style }) => (
    <div
        style={style}
        className={`animate-pulse rounded-md bg-gray-200/90 dark:bg-white/[0.07] ${className}`}
    />
);

/** Dedicated Mobile Card Skeleton */
export const MobileCardSkeleton = ({ compact = true }) => (
    <div className={`w-full min-w-0 rounded-xl border border-gray-100 bg-white dark:border-white/5 dark:bg-[#161b22] ${compact ? 'p-2.5' : 'p-3'} space-y-2`}>
        <div className="flex items-center gap-2.5">
            <Shimmer className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
                <Shimmer className="h-3.5 w-3/5 rounded" />
                <Shimmer className="h-2.5 w-4/5 rounded" />
            </div>
            <Shimmer className="h-4 w-12 shrink-0 rounded-full" />
        </div>
    </div>
);

/** Dedicated Mobile Stat Cards Skeleton */
export const MobileStatsSkeleton = () => (
    <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-white p-2.5 dark:border-white/5 dark:bg-[#161b22] space-y-1.5">
                <div className="flex items-center justify-between">
                    <Shimmer className="h-2.5 w-16 rounded" />
                    <Shimmer className="h-4 w-4 rounded-full" />
                </div>
                <Shimmer className="h-5 w-20 rounded" />
            </div>
        ))}
    </div>
);

/** Dedicated Mobile Detail Skeleton */
export const MobileDetailSkeleton = () => (
    <div className="w-full min-w-0 space-y-2.5">
        <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-white/5 dark:bg-[#161b22] space-y-2">
            <Shimmer className="h-4 w-2/5 rounded" />
            <Shimmer className="h-3 w-4/5 rounded" />
            <div className="grid grid-cols-2 gap-2 pt-1">
                <Shimmer className="h-8 rounded-lg" />
                <Shimmer className="h-8 rounded-lg" />
            </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-white/5 dark:bg-[#161b22] space-y-2">
            <Shimmer className="h-3.5 w-1/3 rounded" />
            <Shimmer className="h-2.5 w-full rounded" />
            <Shimmer className="h-2.5 w-5/6 rounded" />
            <Shimmer className="h-2.5 w-2/3 rounded" />
        </div>
    </div>
);

/**
 * Dedicated Mobile Skeleton Loading View
 * Replaces generic spinners with native-feeling content shimmer
 */
export default function MobileLoadingState({
    rows = 4,
    variant = 'list',
    showHeader = true,
    showSearch = true,
    className = ''
}) {
    const rowCount = Math.max(1, rows || 4);

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label="Loading content"
            className={`w-full min-w-0 space-y-2.5 pb-24 ${className}`}
        >
            {/* Header Shimmer */}
            {showHeader && (
                <div className="space-y-1.5 pb-1 pt-1">
                    <Shimmer className="h-2.5 w-20 rounded" />
                    <Shimmer className="h-5 w-44 rounded-lg" />
                    <Shimmer className="h-3 w-32 rounded" />
                </div>
            )}

            {/* Search & Filter Bar Shimmer */}
            {showSearch && (
                <div className="flex gap-2">
                    <Shimmer className="h-9 flex-1 rounded-xl" />
                    <Shimmer className="h-9 w-16 shrink-0 rounded-xl" />
                </div>
            )}

            {/* Main Content Skeleton by Variant */}
            {variant === 'stats' && <MobileStatsSkeleton />}
            {variant === 'detail' && <MobileDetailSkeleton />}

            {/* List / Card Skeletons */}
            <div className="space-y-2">
                {Array.from({ length: rowCount }).map((_, index) => (
                    <MobileCardSkeleton key={index} />
                ))}
            </div>
        </div>
    );
}
