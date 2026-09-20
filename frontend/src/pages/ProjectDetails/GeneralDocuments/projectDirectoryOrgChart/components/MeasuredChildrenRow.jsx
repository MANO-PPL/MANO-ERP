import React, { useState, useEffect, useCallback, useRef } from 'react';
import OrgChartNode from './OrgChartNode';
import {
    CHART_LINE_W,
    CHART_DROP_H,
    CHART_ARROW_W,
    CHART_ARROW_H
} from '../constants';

// ─── MeasuredChildrenRow ─────────────────────────────────────────────────────
// Renders the horizontal bus bar + per-child vertical drop + arrowhead + child
// nodes. Uses offsetLeft and offsetWidth (unscaled layout coordinates) so the
// connector lines connect with mathematical precision regardless of canvas
// zoom, pan, or screen scaling.
// ─────────────────────────────────────────────────────────────────────────────
const MeasuredChildrenRow = React.memo(({
    childNodes,
    level,
    onSelect,
    selectedNodeId,
    hasDraggedRef,
    searchQuery = ''
}) => {
    const childCount = childNodes.length;
    const rowRef = useRef(null);
    const firstRef = useRef(null);
    const lastRef = useRef(null);
    const [busBar, setBusBar] = useState(null);

    const measureBusBar = useCallback(() => {
        if (childCount <= 1 || !rowRef.current || !firstRef.current || !lastRef.current) {
            setBusBar(null);
            return;
        }

        const firstEl = firstRef.current;
        const lastEl = lastRef.current;

        // Use offsetLeft and offsetWidth which are unscaled layout pixels (independent of CSS transform/zoom/pan)
        const firstCenterX = firstEl.offsetLeft + firstEl.offsetWidth / 2;
        const lastCenterX = lastEl.offsetLeft + lastEl.offsetWidth / 2;
        const width = lastCenterX - firstCenterX;

        if (width > 0) {
            setBusBar({
                left: Math.round(firstCenterX),
                width: Math.round(width)
            });
        }
    }, [childCount]);

    useEffect(() => {
        measureBusBar();
        const rafId = requestAnimationFrame(measureBusBar);
        const timer1 = setTimeout(measureBusBar, 50);
        const timer2 = setTimeout(measureBusBar, 150);

        const ro = new ResizeObserver(() => {
            measureBusBar();
        });

        if (rowRef.current) ro.observe(rowRef.current);
        if (firstRef.current) ro.observe(firstRef.current);
        if (lastRef.current) ro.observe(lastRef.current);

        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(timer1);
            clearTimeout(timer2);
            ro.disconnect();
        };
    }, [measureBusBar, childCount, childNodes]);

    return (
        <div ref={rowRef} className="relative flex flex-row items-start justify-center">
            {/* Horizontal bus bar — connects center of first child to center of last child */}
            {childCount > 1 && busBar && (
                <div
                    className="absolute bg-slate-400 dark:bg-slate-500 pointer-events-none"
                    style={{
                        height: `${CHART_LINE_W}px`,
                        top: 0,
                        left: `${busBar.left}px`,
                        width: `${busBar.width}px`
                    }}
                />
            )}

            {childNodes.map((child, idx) => {
                const isFirstChild = idx === 0;
                const isLastChild = idx === childCount - 1;
                return (
                    <div
                        key={child.id}
                        ref={isFirstChild ? firstRef : isLastChild ? lastRef : undefined}
                        className="flex flex-col items-center px-4 flex-shrink-0"
                    >
                        {/* Vertical drop + filled arrowhead above each child */}
                        <div className="flex flex-col items-center" style={{ height: `${CHART_DROP_H}px` }}>
                            <div
                                className="flex-1 bg-slate-400 dark:bg-slate-500"
                                style={{ width: `${CHART_LINE_W}px` }}
                            />
                            <svg
                                width={CHART_ARROW_W}
                                height={CHART_ARROW_H}
                                viewBox={`0 0 ${CHART_ARROW_W} ${CHART_ARROW_H}`}
                                style={{ display: 'block', flexShrink: 0 }}
                            >
                                <path
                                    d={`M0 0L${CHART_ARROW_W / 2} ${CHART_ARROW_H}L${CHART_ARROW_W} 0Z`}
                                    fill="currentColor"
                                    className="text-slate-400 dark:text-slate-500"
                                />
                            </svg>
                        </div>

                        <OrgChartNode
                            node={child}
                            onSelect={onSelect}
                            selectedNodeId={selectedNodeId}
                            level={level + 1}
                            isFirst={isFirstChild}
                            isLast={isLastChild}
                            parentHasMany={childCount > 1}
                            hasDraggedRef={hasDraggedRef}
                            searchQuery={searchQuery}
                        />
                    </div>
                );
            })}
        </div>
    );
});

export default MeasuredChildrenRow;
