import React from 'react';
import { Search, RefreshCw } from 'lucide-react';

/**
 * Shared Catalog Toolbar
 * Provides unified search, filters, count display, reload trigger, and actions.
 */
export default function CatalogToolbar({
    searchTerm = '',
    onSearchChange,
    searchPlaceholder = 'Search code, name, description...',
    filters = null,
    onRefresh,
    refreshing = false,
    totalCount = 0,
    filteredCount = 0,
    countLabel = '',
    actions = null
}) {
    return (
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#161b22] p-3.5 rounded-xl border border-gray-200 dark:border-gh-border shadow-xs">
            {/* Search, Filters, Refresh, and Count */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                {onSearchChange && (
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                )}

                {filters}

                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg border border-gray-200 dark:border-gh-border bg-gray-50 dark:bg-gh-subtle transition-colors cursor-pointer"
                        title="Refresh from server"
                    >
                        <RefreshCw size={13} className={refreshing ? 'animate-spin text-blue-500' : ''} />
                    </button>
                )}

                {totalCount !== undefined && totalCount !== null && (
                    <span className="text-[11px] text-gray-400 ml-1">
                        Showing {filteredCount ?? totalCount} of {totalCount} {countLabel}
                    </span>
                )}
            </div>

            {/* Right-aligned action buttons */}
            {actions && (
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {actions}
                </div>
            )}
        </div>
    );
}
