import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { customToast } from '../utils/toast';

export { customToast };

const TOAST_VARIANTS = {
    success: {
        dot: 'bg-[#10b981]',
        bg: 'bg-emerald-50/95 border-emerald-500/30 text-[#047857] dark:bg-[#064e3b]/50 dark:border-emerald-500/40 dark:text-[#34d399]',
    },
    error: {
        dot: 'bg-[#ef4444]',
        bg: 'bg-red-50/95 border-red-500/30 text-[#b91c1c] dark:bg-[#7f1d1d]/50 dark:border-red-500/40 dark:text-[#f87171]',
    },
    warning: {
        dot: 'bg-[#f59e0b]',
        bg: 'bg-amber-50/95 border-amber-500/30 text-[#b45309] dark:bg-[#78350f]/50 dark:border-amber-500/40 dark:text-[#fbbf24]',
    },
    info: {
        dot: 'bg-[#3b82f6]',
        bg: 'bg-blue-50/95 border-blue-500/30 text-[#1d4ed8] dark:bg-[#1e3a8a]/50 dark:border-blue-500/40 dark:text-[#60a5fa]',
    },
    sparkle: {
        dot: 'bg-[#a855f7]',
        bg: 'bg-purple-50/95 border-purple-500/30 text-[#6b21a8] dark:bg-[#581c87]/50 dark:border-purple-500/40 dark:text-[#c084fc]',
    }
};

const Toast = ({ toast, toasts, onClose }) => {
    const currentToast = toast || (toasts && toasts.length > 0 ? toasts[toasts.length - 1] : null);

    useEffect(() => {
        if (!currentToast) return;
        const duration = currentToast.duration || 3000;
        const timer = setTimeout(() => {
            if (onClose) onClose(currentToast.id);
        }, duration);
        return () => clearTimeout(timer);
    }, [currentToast, onClose]);

    if (!currentToast) return null;

    const variantKey = currentToast.type || 'info';
    const config = TOAST_VARIANTS[variantKey] || TOAST_VARIANTS.info;

    return (
        <AnimatePresence>
            {currentToast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[99999] pointer-events-auto select-none">
                    <motion.div
                        key={currentToast.id || currentToast.message}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 15, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border backdrop-blur-md shadow-2xl ${config.bg} max-w-[90vw] whitespace-nowrap cursor-pointer`}
                        onClick={() => onClose && onClose(currentToast.id)}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
                        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-tight font-sans">
                            {currentToast.title && currentToast.title !== 'Success' && currentToast.title !== 'Error' && currentToast.title !== 'Info' && currentToast.title !== 'Warning' && currentToast.title !== 'Notification' && (
                                <span className="font-bold uppercase tracking-wider text-[11px] opacity-80 mr-1">
                                    {currentToast.title}:
                                </span>
                            )}
                            <span className="truncate">{currentToast.message}</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Toast;
