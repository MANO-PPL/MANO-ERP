import React from 'react';
import MobileBottomSheet from './MobileBottomSheet';

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
    const footer = (
        <div className="flex gap-2">
            <button
                type="button"
                disabled={pending}
                onClick={onClose}
                className="min-h-11 flex-1 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:border-gh-border dark:text-gh-text"
            >
                {cancelLabel}
            </button>
            <button
                type="button"
                disabled={pending}
                onClick={onConfirm}
                className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {pending ? 'Working…' : confirmLabel}
            </button>
        </div>
    );

    return (
        <MobileBottomSheet open={open} onClose={pending ? undefined : onClose} title={title} footer={footer}>
            <p className="text-sm leading-6 text-gray-600 dark:text-gh-muted">{message}</p>
        </MobileBottomSheet>
    );
}
