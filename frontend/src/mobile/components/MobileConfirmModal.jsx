import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, AlertCircle, X } from 'lucide-react';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

export default function MobileConfirmModal({
    open,
    onClose,
    onConfirm,
    title = 'Confirm action',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    pending = false,
}) {
    const dialogRef = useRef(null);
    useBodyScrollLock(open);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !pending && onClose) {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        dialogRef.current?.focus();
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, pending, onClose]);

    if (!open || typeof document === 'undefined') return null;

    const Icon = danger ? AlertTriangle : AlertCircle;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none" role="alertdialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
                onClick={pending ? undefined : onClose}
            />

            {/* Centered Popup Dialog Card */}
            <div
                ref={dialogRef}
                tabIndex={-1}
                className="relative w-full max-w-sm my-auto rounded-2xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-2xl p-5 overflow-hidden animate-in zoom-in-95 duration-150 z-10 outline-none"
            >
                {/* Close Button */}
                {!pending && onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}

                <div className="flex items-start gap-3.5">
                    {/* Warning / Danger Icon Badge */}
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        danger
                            ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/60'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                    }`}>
                        <Icon size={22} strokeWidth={2.2} />
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                            {title}
                        </h3>
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gh-muted leading-relaxed break-words font-normal">
                            {message}
                        </p>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-5 flex gap-2.5">
                    <button
                        type="button"
                        disabled={pending}
                        onClick={onClose}
                        className="min-h-10 flex-1 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        disabled={pending}
                        onClick={onConfirm}
                        className={`min-h-10 flex-1 rounded-xl text-xs font-semibold text-white shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center ${
                            danger
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/25'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                        }`}
                    >
                        {pending ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
