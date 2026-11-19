/**
 * Safe UUID v4 generator with fallback for non-secure contexts (e.g. HTTP over LAN IP).
 */
export function safeRandomUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch {
            // fallback if randomUUID fails
        }
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        try {
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
            );
        } catch {
            // fallback to Math.random
        }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Polyfill window.crypto.randomUUID if in non-secure context (e.g. mobile/LAN HTTP)
if (typeof window !== 'undefined') {
    try {
        if (!window.crypto) {
            window.crypto = {};
        }
        if (typeof window.crypto.randomUUID !== 'function') {
            window.crypto.randomUUID = safeRandomUUID;
        }
    } catch {
        // Ignore if window.crypto is non-extensible
    }
}
