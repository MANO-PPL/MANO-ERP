import { useSyncExternalStore } from 'react';

export const MOBILE_MAX_WIDTH = 1023;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

export const isMobileViewport = (width) => (
    typeof width === 'number' && Number.isFinite(width) && width >= 0 && width <= MOBILE_MAX_WIDTH
);

const getMediaQuery = () => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(MOBILE_MEDIA_QUERY)
        : null
);

const subscribe = (onChange) => {
    const mediaQuery = getMediaQuery();
    if (!mediaQuery) return () => {};

    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', onChange);
        return () => mediaQuery.removeEventListener('change', onChange);
    }

    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
};

const getSnapshot = () => getMediaQuery()?.matches ?? false;
const getServerSnapshot = () => false;

export default function useMobileViewport() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
