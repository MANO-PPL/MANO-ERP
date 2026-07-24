import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Toast from '../components/Toast';
import { customToast } from '../utils/toast';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);

    const showToast = useCallback((type, title, message, duration = 3500) => {
        setToast({ type, title, message, duration, id: Date.now() });
    }, []);

    useEffect(() => {
        const unsubscribe = customToast.subscribe((toastData) => {
            showToast(toastData.type, toastData.title, toastData.message, toastData.duration);
        });
        return unsubscribe;
    }, [showToast]);

    const showSuccess = useCallback((title, message, duration) => showToast('success', title, message, duration), [showToast]);
    const showError = useCallback((title, message, duration) => showToast('error', title, message, duration), [showToast]);
    const showWarning = useCallback((title, message, duration) => showToast('warning', title, message, duration), [showToast]);
    const showInfo = useCallback((title, message, duration) => showToast('info', title, message, duration), [showToast]);
    const showSparkle = useCallback((title, message, duration) => showToast('sparkle', title, message, duration), [showToast]);

    const hideToast = useCallback(() => setToast(null), []);

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo, showSparkle, hideToast }}>
            {children}
            <Toast toast={toast} onClose={hideToast} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        return {
            showToast: customToast.show,
            showSuccess: (title, message) => customToast.success(message, title),
            showError: (title, message) => customToast.error(message, title),
            showWarning: (title, message) => customToast.warning(message, title),
            showInfo: (title, message) => customToast.info(message, title),
            showSparkle: (title, message) => customToast.sparkle(message, title),
            hideToast: () => {}
        };
    }
    return context;
};
