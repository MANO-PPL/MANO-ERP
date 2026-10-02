import { useCallback, useEffect, useReducer, useRef } from 'react';
import useBodyScrollLock from './useBodyScrollLock.js';

export const MOBILE_DRAWER_HISTORY_KEY = '__manoMobileDrawer';

let drawerSequence = 0;

export function drawerReducer(isOpen, action) {
    if (action === 'open') return true;
    if (action === 'close') return false;
    if (action === 'toggle') return !isOpen;
    return isOpen;
}

export function createDrawerMarkerState(state, token) {
    const current = state && typeof state === 'object' ? state : {};
    return {
        ...current,
        [MOBILE_DRAWER_HISTORY_KEY]: { token },
    };
}

export function hasDrawerMarker(state, token) {
    return state?.[MOBILE_DRAWER_HISTORY_KEY]?.token === token;
}

export function removeDrawerMarkerState(state) {
    if (!state || typeof state !== 'object' || !(MOBILE_DRAWER_HISTORY_KEY in state)) return state ?? null;
    const next = { ...state };
    delete next[MOBILE_DRAWER_HISTORY_KEY];
    return Object.keys(next).length === 0 ? null : next;
}

export default function useMobileDrawer({ navigate } = {}) {
    const [isOpen, dispatch] = useReducer(drawerReducer, false);
    const isOpenRef = useRef(false);
    const pendingNavigationRef = useRef(null);
    const navigationUnwindRef = useRef(false);
    const tokenRef = useRef(null);
    const mountedRef = useRef(true);

    if (!tokenRef.current) {
        drawerSequence += 1;
        tokenRef.current = `mobile-drawer-${drawerSequence}`;
    }

    const token = tokenRef.current;
    useBodyScrollLock(isOpen);

    const setOpen = useCallback((nextOpen) => {
        isOpenRef.current = nextOpen;
        dispatch(nextOpen ? 'open' : 'close');
    }, []);

    const runNavigation = useCallback((request) => {
        if (!request || typeof navigate !== 'function') return;
        navigate(request.to, request.options);
    }, [navigate]);

    const openDrawer = useCallback(() => {
        if (isOpenRef.current || typeof window === 'undefined') return;
        pendingNavigationRef.current = null;
        window.history.pushState(createDrawerMarkerState(window.history.state, token), '', window.location.href);
        setOpen(true);
    }, [setOpen, token]);

    const closeDrawer = useCallback(() => {
        if (!isOpenRef.current || navigationUnwindRef.current) return;
        pendingNavigationRef.current = null;
        const ownsCurrentEntry = typeof window !== 'undefined' && hasDrawerMarker(window.history.state, token);
        setOpen(false);
        if (ownsCurrentEntry) window.history.back();
    }, [setOpen, token]);

    const navigateFromDrawer = useCallback((to, options) => {
        if (navigationUnwindRef.current) return;
        const request = { to, options };
        const ownsCurrentEntry = typeof window !== 'undefined' && hasDrawerMarker(window.history.state, token);

        if (ownsCurrentEntry) {
            pendingNavigationRef.current = request;
            navigationUnwindRef.current = true;
            window.history.back();
            return;
        }

        pendingNavigationRef.current = null;
        setOpen(false);
        runNavigation(request);
    }, [runNavigation, setOpen, token]);

    const toggleDrawer = useCallback(() => {
        if (isOpenRef.current) closeDrawer();
        else openDrawer();
    }, [closeDrawer, openDrawer]);

    useEffect(() => {
        mountedRef.current = true;
        const onPopState = (event) => {
            if (!mountedRef.current) return;

            if (isOpenRef.current && !hasDrawerMarker(event.state, token)) {
                setOpen(false);
                const request = pendingNavigationRef.current;
                pendingNavigationRef.current = null;
                navigationUnwindRef.current = false;
                if (request) queueMicrotask(() => runNavigation(request));
                return;
            }

            if (!isOpenRef.current && hasDrawerMarker(event.state, token)) {
                window.history.replaceState(removeDrawerMarkerState(event.state), '', window.location.href);
            }
        };

        window.addEventListener('popstate', onPopState);
        return () => {
            mountedRef.current = false;
            window.removeEventListener('popstate', onPopState);
            pendingNavigationRef.current = null;
            navigationUnwindRef.current = false;
            if (hasDrawerMarker(window.history.state, token)) {
                window.history.back();
            }
        };
    }, [runNavigation, setOpen, token]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeDrawer();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [closeDrawer, isOpen]);

    return {
        isOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        navigateFromDrawer,
    };
}
