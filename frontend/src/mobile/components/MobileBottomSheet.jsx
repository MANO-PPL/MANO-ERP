import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import { BOTTOM_SHEET_DEFAULT, BOTTOM_SHEET_EXPANDED, bottomSheetDragOffset, isHorizontalDrag, resolveBottomSheetGesture } from './mobileBottomSheetGesture';

export default function MobileBottomSheet({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    closeLabel = 'Close',
    closeDisabled = false,
    returnFocusRef,
    placement = 'bottom',
    variant,
}) {
    const isCenter = placement === 'center' || variant === 'popup';
    const panelRef = useRef(null);
    const restoreFocusTargetRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const dragRef = useRef(null);
    const titleId = useId();
    const descriptionId = useId();
    const [snap, setSnap] = useState(BOTTOM_SHEET_DEFAULT);
    const [dragOffset, setDragOffset] = useState(0);
    const [dragging, setDragging] = useState(false);
    onCloseRef.current = onClose;
    useBodyScrollLock(open);
    const canClose = typeof onClose === 'function' && !closeDisabled;

    const panelStyle = isCenter ? undefined : {
        transform: dragOffset ? `translate3d(0, ${dragOffset}px, 0)` : undefined,
        ...(snap === BOTTOM_SHEET_EXPANDED
            ? {
                top: 'calc(0.75rem + env(safe-area-inset-top))',
                bottom: 0,
                height: 'auto',
            }
            : {
                bottom: 0,
                maxHeight: 'min(88dvh, 760px)',
            }),
    };

    const restoreFocus = useCallback(() => {
        const target = returnFocusRef?.current || restoreFocusTargetRef.current;
        window.setTimeout(() => target?.focus?.(), 0);
    }, [returnFocusRef]);

    const requestClose = useCallback(() => {
        if (typeof onCloseRef.current !== 'function') return;
        onCloseRef.current();
        restoreFocus();
    }, [restoreFocus]);

    const finishDrag = useCallback((event, cancelled = false) => {
        if (isCenter) return;
        const drag = dragRef.current;
        if (!drag || (event && drag.pointerId !== event.pointerId)) return;
        dragRef.current = null;
        setDragging(false);
        setDragOffset(0);
        const deltaX = (event?.clientX ?? drag.lastX) - drag.startX;
        const deltaY = (event?.clientY ?? drag.lastY) - drag.startY;
        const velocityY = drag.velocityY || 0;
        const result = resolveBottomSheetGesture({ origin: drag.origin, deltaX, deltaY, velocityY, canClose, cancelled: cancelled || drag.horizontal });
        if (result.action === 'dismiss') requestClose();
        else setSnap(result.state);
    }, [canClose, isCenter, requestClose]);

    const startDrag = useCallback((event) => {
        if (isCenter) return;
        if (event.button !== undefined && event.button !== 0) return;
        if (event.target.closest('button, a, input, select, textarea, [data-bottom-sheet-no-drag]')) return;
        dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, lastDeltaY: 0, lastTime: performance.now(), velocityY: 0, origin: snap, horizontal: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
    }, [isCenter, snap]);

    const moveDrag = useCallback((event) => {
        if (isCenter) return;
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (isHorizontalDrag(deltaX, deltaY)) { drag.horizontal = true; return; }
        if (drag.horizontal) return;
        event.preventDefault();
        const now = performance.now();
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        drag.velocityY = (deltaY - drag.lastDeltaY) / Math.max(now - drag.lastTime, 1);
        drag.lastDeltaY = deltaY;
        drag.lastTime = now;
        setDragOffset(bottomSheetDragOffset({ origin: drag.origin, deltaX, deltaY }));
    }, [isCenter]);

    useEffect(() => {
        if (open) { setSnap(BOTTOM_SHEET_DEFAULT); setDragOffset(0); setDragging(false); }
        else { dragRef.current = null; setSnap(BOTTOM_SHEET_DEFAULT); setDragOffset(0); setDragging(false); }
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const activeElement = returnFocusRef?.current || document.activeElement;
        if (activeElement && !panelRef.current?.contains(activeElement)) {
            restoreFocusTargetRef.current = activeElement;
        }
        panelRef.current?.focus();

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (canClose) requestClose();
                return;
            }

            if (event.key !== 'Tab' || !panelRef.current) return;
            const focusable = [...panelRef.current.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            )].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

            if (focusable.length === 0) {
                event.preventDefault();
                panelRef.current.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement;
            if (activeElement === panelRef.current) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            } else if (!panelRef.current.contains(activeElement)) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            } else if (event.shiftKey && activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            restoreFocus();
        };
    }, [canClose, open, requestClose, restoreFocus, returnFocusRef]);

    if (!open || typeof document === 'undefined') return null;

    if (isCenter) {
        return createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4" data-testid="mobile-bottom-sheet-layer">
                <div
                    aria-hidden="true"
                    onClick={canClose ? requestClose : undefined}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
                />
                <section
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={title ? titleId : undefined}
                    aria-describedby={description ? descriptionId : undefined}
                    tabIndex={-1}
                    className="relative w-full max-w-lg max-h-[85dvh] my-auto flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl outline-none dark:border-gh-border dark:bg-gh-subtle z-10 animate-in fade-in zoom-in-95 duration-150"
                >
                    {(title || description || canClose) && (
                        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gh-border shrink-0">
                            <div className="min-w-0 flex-1">
                                {title && <h2 id={titleId} className="text-sm font-semibold text-gray-900 dark:text-gh-text truncate">{title}</h2>}
                                {description && <p id={descriptionId} className="mt-0.5 text-xs font-normal leading-relaxed text-gray-500 dark:text-gh-muted">{description}</p>}
                            </div>
                            <button
                                type="button"
                                aria-label={closeLabel}
                                disabled={!canClose}
                                onClick={canClose ? requestClose : undefined}
                                className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gh-muted dark:hover:text-white dark:hover:bg-gh-hover transition-colors"
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>
                    )}
                    <div data-testid="mobile-bottom-sheet-content" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4">
                        {children}
                    </div>
                    {footer && <div className="shrink-0 border-t border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-gh-border dark:bg-gh-subtle">{footer}</div>}
                </section>
            </div>,
            document.body,
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" data-testid="mobile-bottom-sheet-layer">
            <button
                type="button"
                tabIndex={-1}
                aria-label={closeLabel}
                disabled={!canClose}
                onClick={canClose ? requestClose : undefined}
                className="fixed inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
            />
            <section
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                data-bottom-sheet-snap={snap}
                data-bottom-sheet-dragging={dragging ? 'true' : 'false'}
                style={panelStyle}
                className={`relative w-full max-w-lg mx-auto flex flex-col overflow-hidden rounded-t-3xl border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none transition-[transform,height,top] duration-200 motion-reduce:transition-none dark:border-gh-border dark:bg-gh-subtle animate-in slide-in-from-bottom duration-200 z-10 ${dragging ? 'transition-none' : ''}`}
            >
                <div
                    data-testid="mobile-bottom-sheet-drag-region"
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={finishDrag}
                    onPointerCancel={(event) => finishDrag(event, true)}
                    onLostPointerCapture={(event) => finishDrag(event, true)}
                    className="shrink-0 touch-none select-none pt-2.5 pb-1"
                >
                    <div className="mx-auto h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
                </div>
                <div className="flex min-h-11 items-center justify-between gap-3 border-b border-gray-100 px-4 py-2 dark:border-gh-border shrink-0">
                    <div className="min-w-0 flex-1">
                        {title && <h2 id={titleId} className="text-sm font-semibold text-gray-900 dark:text-gh-text truncate">{title}</h2>}
                        {description && <p id={descriptionId} className="mt-0.5 text-xs font-normal leading-relaxed text-gray-500 dark:text-gh-muted">{description}</p>}
                    </div>
                    <button
                        type="button"
                        aria-label={closeLabel}
                        disabled={!canClose}
                        data-bottom-sheet-no-drag
                        onClick={canClose ? requestClose : undefined}
                        className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gh-muted dark:hover:text-white dark:hover:bg-gh-hover transition-colors"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                <div data-testid="mobile-bottom-sheet-content" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4">
                    {children}
                </div>
                {footer && <div className="shrink-0 border-t border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-gh-border dark:bg-gh-subtle">{footer}</div>}
            </section>
        </div>,
        document.body,
    );
}

export function MobileActionSheet({ open, onClose, title = 'Actions', actions = [] }) {
    return (
        <MobileBottomSheet open={open} onClose={onClose} title={title}>
            <div className="space-y-1">
                {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                        <button
                            key={action.id || action.label}
                            type="button"
                            disabled={action.disabled}
                            onClick={() => {
                                action.onSelect?.();
                                if (action.closeOnSelect !== false) onClose?.();
                            }}
                            className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                action.danger
                                    ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40'
                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gh-text dark:hover:bg-gh-hover'
                            }`}
                        >
                            {Icon && <Icon size={16} aria-hidden="true" />}
                            <span className="min-w-0 flex-1">{action.label}</span>
                        </button>
                    );
                })}
            </div>
        </MobileBottomSheet>
    );
}
