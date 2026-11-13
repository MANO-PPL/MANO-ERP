import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';
import AccessRestricted from '../pages/Auth/AccessRestricted';
import NotFoundPage from '../pages/Auth/NotFoundPage';
import { getAccessToken } from '../services/api';

/**
 * Probes the backend clearance endpoint using native fetch.
 * NOTE: We deliberately use native fetch instead of the axios instance so that
 * 401/403 responses do NOT trigger the axios interceptor (which auto-redirects
 * the entire page via window.location.href = '/login').
 */
async function probeClearance() {
    try {
        const token = getAccessToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/dev/clearance', {
            method: 'GET',
            headers,
            credentials: 'include'
        });
        const data = await res.json().catch(() => ({}));
        return { status: res.status, ok: res.ok, data };
    } catch (networkErr) {
        return {
            status: 500,
            ok: false,
            data: { error: { message: networkErr.message } }
        };
    }
}

/**
 * DevRoute
 *
 * Strict Two-Level Security Hierarchy:
 *
 * =========================================================================
 * LEVEL 1 (PRIMARY): OPEN OR CLOSED CHECK (CONCEALMENT)
 * =========================================================================
 * Before anything else, verify whether Developer Labs are active/open:
 * 1. Frontend Kill-Switch: If VITE_ENABLE_DEV_LAB !== 'true' -> Return 404 immediately.
 * 2. Backend Kill-Switch Probe: Calls /api/dev/clearance via native fetch.
 *    If backend responds with 404 or DEV_LAB_DISABLED -> Return 404 immediately.
 *
 * -> Under NO circumstances is it revealed that dev labs exist when closed.
 *    Anyone (logged in or logged out) simply sees the standard 404 page.
 *
 * =========================================================================
 * LEVEL 2 (SECONDARY): PERMISSION & WHITELIST CHECK
 * =========================================================================
 * Only evaluated IF the lab is verified to be OPEN:
 * 1. Authentication Check: If logged out (or incognito) -> AccessRestricted (type: 'unauthenticated')
 *    with explanation and countdown to login.
 * 2. Role Check: If user is not admin -> AccessRestricted (type: 'lab_unauthorized').
 * 3. Whitelist Clearance: If user is not in DEV_LAB_ALLOWED_USERS/DEV_LAB_ALLOWED_EMAILS ->
 *    AccessRestricted (type: 'lab_unauthorized') with explicit error message from backend.
 */
export default function DevRoute({ children }) {
    const { user, loading: authLoading, isAdmin } = useAuth();
    const isDevEnabled = import.meta.env.VITE_ENABLE_DEV_LAB === 'true';

    // State tracks Level 1 (Lab Open vs Closed) and Level 2 (User Whitelisted)
    const [status, setStatus] = useState({
        checking: true,
        isLabOpen: true,     // Level 1: false -> 404
        isCleared: false,     // Level 2: true -> allow access
        errorType: null,      // 'unauthenticated' | 'lab_unauthorized'
        errorMessage: null,
    });

    useEffect(() => {
        // LEVEL 1 (Frontend): Kill-switch disabled -> mark closed immediately
        if (!isDevEnabled) {
            setStatus({ checking: false, isLabOpen: false, isCleared: false, errorType: null, errorMessage: null });
            return;
        }

        // Wait until auth session check finishes
        if (authLoading) return;

        let isMounted = true;

        probeClearance().then(({ status: httpStatus, data }) => {
            if (!isMounted) return;

            const errCode = data?.error?.code;
            const errMsg = data?.error?.message;

            // LEVEL 1: Lab is CLOSED on the backend (404 or DEV_LAB_DISABLED) -> Conceal via 404
            if (httpStatus === 404 || errCode === 'DEV_LAB_DISABLED') {
                setStatus({ checking: false, isLabOpen: false, isCleared: false, errorType: null, errorMessage: null });
                return;
            }

            // LEVEL 2 - Case A: Unauthenticated (401 or no user session)
            if (httpStatus === 401 || !user) {
                setStatus({
                    checking: false,
                    isLabOpen: true,
                    isCleared: false,
                    errorType: 'unauthenticated',
                    errorMessage: 'You must be signed in with an authorized account to access this page.'
                });
                return;
            }

            // LEVEL 2 - Case B: Not an administrator
            if (!isAdmin) {
                setStatus({
                    checking: false,
                    isLabOpen: true,
                    isCleared: false,
                    errorType: 'lab_unauthorized',
                    errorMessage: 'Developer and administrator clearance required.'
                });
                return;
            }

            // LEVEL 2 - Case C: Whitelist verification
            if (data?.success && data?.cleared) {
                setStatus({ checking: false, isLabOpen: true, isCleared: true, errorType: null, errorMessage: null });
            } else {
                setStatus({
                    checking: false,
                    isLabOpen: true,
                    isCleared: false,
                    errorType: 'lab_unauthorized',
                    errorMessage: errMsg || 'Access denied: User ID or email is not in the whitelist.'
                });
            }
        });

        return () => {
            isMounted = false;
        };
    }, [isDevEnabled, authLoading, user, isAdmin]);

    // =========================================================================
    // LEVEL 1 CHECK: IS LAB OPEN OR CLOSED?
    // =========================================================================
    // If closed (frontend kill-switch OFF or backend reports 404 / DEV_LAB_DISABLED),
    // return standard 404 so existence is never revealed.
    if (!isDevEnabled || (!status.checking && !status.isLabOpen)) {
        return <NotFoundPage countdownSeconds={5} />;
    }

    // Loading indicator while resolving session & clearance
    if (authLoading || status.checking) {
        return <LoadingScreen message="Connecting to workspace..." />;
    }

    // =========================================================================
    // LEVEL 2 CHECK: PERMISSIONS & WHITELIST (ONLY IF LAB IS CONFIRMED OPEN)
    // =========================================================================

    // Case A: User is not logged in
    if (!user || status.errorType === 'unauthenticated') {
        return (
            <AccessRestricted
                type="unauthenticated"
                title="Authentication Required"
                message="Developer Labs are restricted internal tools. You must be signed in with an authorized developer account to access this page."
                redirectTo="/login"
                redirectLabel="Go to Login"
                countdownSeconds={6}
            />
        );
    }

    // Case B: Logged-in user is not whitelisted or not an admin
    if (!status.isCleared) {
        return (
            <AccessRestricted
                type="lab_unauthorized"
                title="Developer Clearance Required"
                message={status.errorMessage || 'You are signed in, but your account does not have developer clearance for this lab.'}
                countdownSeconds={8}
            />
        );
    }

    // All Level 1 and Level 2 checks passed
    return children;
}
