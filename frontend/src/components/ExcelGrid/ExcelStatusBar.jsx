import React, { useMemo } from 'react';
import { calculateSelectionMetrics } from './excelUtils';
import { Calculator } from 'lucide-react';

export const ExcelStatusBar = ({
    sortedGridData = [],
    columns = [],
    selectionBounds = null
}) => {
    const metrics = useMemo(() => {
        return calculateSelectionMetrics(sortedGridData, columns, selectionBounds);
    }, [sortedGridData, columns, selectionBounds]);

    if (!metrics || metrics.totalCells <= 1) {
        return null;
    }

    return (
        <div className="px-3 py-1 bg-gray-50 dark:bg-[#161b22] border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-gray-500 dark:text-gray-400 select-none shrink-0 animate-in fade-in">
            {/* Left: Dimensions */}
            <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Selected: {metrics.rowCount}R × {metrics.colCount}C ({metrics.totalCells} cells)
                </span>
            </div>

            {/* Right: Live Calculation Metrics (Count, Sum, Avg, Min, Max) */}
            <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                    <span className="text-gray-400">Count:</span>
                    <strong className="text-gray-800 dark:text-gray-200 font-bold">{metrics.count}</strong>
                </span>

                {metrics.hasNumbers && (
                    <>
                        <span className="w-px h-3 bg-gray-300 dark:bg-white/10" />
                        <span className="flex items-center gap-1">
                            <span className="text-gray-400">Sum:</span>
                            <strong className="text-blue-600 dark:text-blue-400 font-bold">
                                {metrics.sum.toLocaleString('en-IN')}
                            </strong>
                        </span>

                        <span className="w-px h-3 bg-gray-300 dark:bg-white/10" />
                        <span className="flex items-center gap-1">
                            <span className="text-gray-400">Average:</span>
                            <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                                {metrics.average.toLocaleString('en-IN')}
                            </strong>
                        </span>

                        <span className="w-px h-3 bg-gray-300 dark:bg-white/10" />
                        <span className="flex items-center gap-1">
                            <span className="text-gray-400">Min:</span>
                            <strong className="text-amber-600 dark:text-amber-400 font-bold">
                                {metrics.min.toLocaleString('en-IN')}
                            </strong>
                        </span>

                        <span className="w-px h-3 bg-gray-300 dark:bg-white/10" />
                        <span className="flex items-center gap-1">
                            <span className="text-gray-400">Max:</span>
                            <strong className="text-purple-600 dark:text-purple-400 font-bold">
                                {metrics.max.toLocaleString('en-IN')}
                            </strong>
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

export default ExcelStatusBar;
