// Global toast event emitter to bridge all toast notifications (including react-toastify calls) to MANO-ERP custom Toast component

const listeners = new Set();

export const customToast = {
    success: (msg, title = 'Success', duration = 3500) => {
        const text = typeof msg === 'string' ? msg : (msg?.message || String(msg));
        listeners.forEach(fn => fn({ type: 'success', title: typeof title === 'string' ? title : 'Success', message: text, duration }));
    },
    error: (msg, title = 'Error', duration = 4500) => {
        const text = typeof msg === 'string' ? msg : (msg?.message || String(msg));
        listeners.forEach(fn => fn({ type: 'error', title: typeof title === 'string' ? title : 'Error', message: text, duration }));
    },
    warning: (msg, title = 'Warning', duration = 4000) => {
        const text = typeof msg === 'string' ? msg : (msg?.message || String(msg));
        listeners.forEach(fn => fn({ type: 'warning', title: typeof title === 'string' ? title : 'Warning', message: text, duration }));
    },
    warn: (msg, title = 'Warning', duration = 4000) => {
        const text = typeof msg === 'string' ? msg : (msg?.message || String(msg));
        listeners.forEach(fn => fn({ type: 'warning', title: typeof title === 'string' ? title : 'Warning', message: text, duration }));
    },
    info: (msg, title = 'Info', duration = 3500) => {
        const text = typeof msg === 'string' ? msg : (msg?.message || String(msg));
        listeners.forEach(fn => fn({ type: 'info', title: typeof title === 'string' ? title : 'Info', message: text, duration }));
    },
    sparkle: (msg, title = 'Notification', duration = 3500) => {
        const text = typeof msg === 'string' ? msg : (msg?.message || String(msg));
        listeners.forEach(fn => fn({ type: 'sparkle', title: typeof title === 'string' ? title : 'Notification', message: text, duration }));
    },
    show: (type, title, message, duration = 3500) => {
        listeners.forEach(fn => fn({ type, title, message, duration }));
    },
    subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }
};

export default customToast;
