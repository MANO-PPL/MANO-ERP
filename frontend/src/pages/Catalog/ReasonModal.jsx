import React, { useState } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';

export default function ReasonModal({
    isOpen,
    title = 'Confirm Action',
    subtitle = '',
    confirmText = 'Confirm',
    confirmCls = 'bg-blue-600 hover:bg-blue-700 text-white',
    onClose,
    onConfirm
}) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = reason.trim();
        if (!trimmed) {
            setError('An audit reason is required for this action.');
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            await onConfirm(trimmed);
            setReason('');
            onClose();
        } catch (err) {
            setError(err?.message || 'Failed to submit. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-xl shadow-2xl p-6 overflow-hidden">
                <button
                    onClick={onClose}
                    disabled={submitting}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    <X size={18} />
                </button>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {title}
                </h3>
                {subtitle && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        {subtitle}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                            Audit Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            rows={3}
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="Enter the reason for this correction or removal..."
                            className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 dark:bg-gh-subtle border-gray-300 dark:border-gh-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            autoFocus
                        />
                        {error && (
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-red-600 dark:text-red-400">
                                <AlertCircle size={14} />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gh-hover rounded-lg hover:bg-gray-200 dark:hover:bg-gh-subtle transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !reason.trim()}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmCls}`}
                        >
                            {submitting && <Loader2 size={14} className="animate-spin" />}
                            {confirmText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

