import { lazy } from 'react';

/**
 * Wraps React.lazy with automatic retry logic for dynamic imports.
 * Catches 'Failed to fetch dynamically imported module' (Vite HMR drops, server restarts, chunk cache mismatch).
 */
export function lazyWithRetry(componentImport, key = 'page_chunk') {
    return lazy(async () => {
        const reloadKey = `chunk_reload_${key}`;
        try {
            const module = await componentImport();
            sessionStorage.removeItem(reloadKey);
            return module;
        } catch (error) {
            console.warn(`Dynamic import failed for ${key}, attempting retry:`, error);
            // Wait 1.2s for dev server/network to recover
            await new Promise((res) => setTimeout(res, 1200));

            try {
                const retryModule = await componentImport();
                sessionStorage.removeItem(reloadKey);
                return retryModule;
            } catch (retryError) {
                const hasReloaded = sessionStorage.getItem(reloadKey);
                if (!hasReloaded) {
                    sessionStorage.setItem(reloadKey, 'true');
                    console.warn(`Refreshing window to synchronize module chunks for ${key}...`);
                    window.location.reload();
                    return new Promise(() => {}); // Hold suspense until reload executes
                }
                sessionStorage.removeItem(reloadKey);
                throw retryError;
            }
        }
    });
}

export default lazyWithRetry;
