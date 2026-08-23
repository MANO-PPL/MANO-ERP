import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, Trash2, X } from 'lucide-react';

const VARIANT_CONFIG = {
    danger: {
        icon: Trash2,
        iconBg: 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20',
        btnBg: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20',
    },
    warning: {
        icon: AlertTriangle,
        iconBg: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20',
        btnBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/20',
    },
    info: {
        icon: Info,
        iconBg: 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
        btnBg: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20',
    },
};

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false
}) => {
    React.useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (!isLoading && onClose) {
                    onClose();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, isLoading, onClose]);

    if (!isOpen) return null;

    const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.danger;
    const Icon = config.icon;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={isLoading ? undefined : onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
                    />

                    {/* Dialog Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="relative w-full max-w-md bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-sm shadow-2xl overflow-hidden z-10 p-6 select-none"
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-1 rounded-sm hover:bg-gray-100 dark:hover:bg-white/5"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-start gap-4">
                            {/* Icon Badge */}
                            <div className={`w-11 h-11 rounded-sm flex items-center justify-center shrink-0 ${config.iconBg}`}>
                                <Icon size={22} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 pt-0.5">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                                    {title}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                                    {message}
                                </p>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-6 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 rounded-sm transition cursor-pointer"
                            >
                                {cancelText}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onConfirm();
                                }}
                                disabled={isLoading}
                                className={`px-4 py-2 text-xs font-bold rounded-sm transition flex items-center gap-2 ${config.btnBg} disabled:opacity-50 cursor-pointer`}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    confirmText
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmModal;
