import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Sparkles } from 'lucide-react';

const TOAST_VARIANTS = {
    success: {
        icon: CheckCircle2,
        bg: 'bg-emerald-950/90 dark:bg-emerald-950/95 text-emerald-100 border-emerald-500/40 shadow-emerald-950/40',
        iconColor: 'text-emerald-400',
    },
    error: {
        icon: AlertCircle,
        bg: 'bg-red-950/90 dark:bg-red-950/95 text-red-100 border-red-500/40 shadow-red-950/40',
        iconColor: 'text-red-400',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'bg-amber-950/90 dark:bg-amber-950/95 text-amber-100 border-amber-500/40 shadow-amber-950/40',
        iconColor: 'text-amber-400',
    },
    info: {
        icon: Info,
        bg: 'bg-slate-900/90 dark:bg-[#161b22]/95 text-slate-100 border-blue-500/40 shadow-slate-950/40',
        iconColor: 'text-blue-400',
    },
    sparkle: {
        icon: Sparkles,
        bg: 'bg-blue-950/90 dark:bg-blue-950/95 text-blue-100 border-blue-400/40 shadow-blue-950/40',
        iconColor: 'text-blue-300',
    }
};

const Toast = ({ toast, onClose }) => {
    useEffect(() => {
        if (!toast) return;
        const duration = toast.duration || 3500;
        const timer = setTimeout(() => {
            if (onClose) onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [toast, onClose]);

    if (!toast) return null;

    const variantKey = toast.type || 'info';
    const config = TOAST_VARIANTS[variantKey] || TOAST_VARIANTS.info;
    const Icon = config.icon;

    return (
        <AnimatePresence>
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto select-none">
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border backdrop-blur-md shadow-2xl ${config.bg} min-w-[280px] max-w-[520px] relative overflow-hidden`}
                    >
                        <div className={`p-1 rounded-lg ${config.iconColor} shrink-0`}>
                            <Icon size={18} />
                        </div>

                        <div className="flex-1 pr-2">
                            {toast.title && (
                                <p className="text-xs font-bold leading-none mb-0.5 tracking-tight text-white">
                                    {toast.title}
                                </p>
                            )}
                            <p className="text-xs font-medium leading-tight">
                                {toast.message}
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Toast;
