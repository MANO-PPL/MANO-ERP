import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';

export default function ReasonModal({
    isOpen,
    title = 'Confirm Action',
    subtitle = '',
    placeholder = 'Enter reason...',
    confirmText = 'Confirm',
    confirmCls = 'bg-amber-600 hover:bg-amber-700 text-white',
    required = true,
    onClose,
    onConfirm
}) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setReason('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = reason.trim();
        if (required && !trimmed) {
            setError('Please enter a reason for this action.');
            return;
        }
        setError('');
        setSubmitting(true);
        try {
            await onConfirm(trimmed);
            setReason('');
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to submit.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[5500] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => !submitting && onClose()} />
            <form
                onSubmit={handleSubmit}
                className="relative w-full max-w-md bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-10"
            >
                <div className="px-5 py-3.5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-3">
                    {subtitle && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">{subtitle}</p>
                    )}
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                            Reason {required && <span className="text-rose-500">*</span>}
                        </label>
                        <textarea
                            rows={3}
                            autoFocus
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={placeholder}
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                        />
                    </div>
                    {error && (
                        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                            <AlertCircle size={13} />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={onClose}
                        className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className={`px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${confirmCls}`}
                    >
                        {submitting && <Loader2 size={13} className="animate-spin" />}
                        <span>{confirmText}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
