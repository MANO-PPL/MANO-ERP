import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowRight, Home, LogIn, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * AccessRestricted
 *
 * Friendly, secure restricted access screen with automated countdown redirect
 * and immediate navigation options.
 *
 * Types:
 * - 'lab_closed': Dev Lab is closed/disabled via environment kill-switch.
 * - 'lab_unauthorized': Dev Lab is active, but current user lacks admin/developer clearance.
 * - 'permission_denied': Standard ERP module restricted based on RBAC permissions.
 * - 'project_denied': User is not assigned to or not authorized for this project.
 */
export default function AccessRestricted({
    type = 'permission_denied',
    title,
    message,
    redirectTo = '/',
    redirectLabel = 'Go to Dashboard',
    countdownSeconds = 8,
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [timeLeft, setTimeLeft] = useState(countdownSeconds);
    const [isPaused, setIsPaused] = useState(false);

    // Default configuration based on restriction type
    const config = {
        lab_closed: {
            badge: 'Feature Disabled',
            badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
            title: title || 'Developer Lab is Closed',
            message: message || 'Developer Labs and testing environments are currently disabled in this environment. Please contact system administrators or enable VITE_ENABLE_DEV_LAB in your environment configuration.',
            icon: Lock,
            iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
            defaultRedirect: user ? '/' : '/login',
            defaultLabel: user ? 'Return to Dashboard' : 'Sign In',
        },
        lab_unauthorized: {
            badge: 'Access Restricted',
            badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
            title: title || 'Developer Clearance Required',
            message: message || 'You are signed in, but your account does not have developer or administrator clearance to access this lab environment.',
            icon: ShieldAlert,
            iconBg: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
            defaultRedirect: '/',
            defaultLabel: 'Return to Dashboard',
        },
        project_denied: {
            badge: 'Project Restricted',
            badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
            title: title || 'Project Not Assigned',
            message: message || 'You do not have access to this project or you have not been assigned to it. Request access from the project owner or administrator.',
            icon: Lock,
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
            defaultRedirect: '/projects',
            defaultLabel: 'Back to Projects',
        },
        unauthenticated: {
            badge: 'Sign In Required',
            badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
            title: title || 'Authentication Required',
            message: message || 'You must be signed in with an authorized account to access this page.',
            icon: LogIn,
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
            defaultRedirect: '/login',
            defaultLabel: 'Sign In',
        },
        permission_denied: {
            badge: 'Restricted Area',
            badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
            title: title || 'Permission Denied',
            message: message || 'Your user role does not have authorization to view or manage this section of MANO-ERP.',
            icon: ShieldAlert,
            iconBg: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
            defaultRedirect: user ? '/' : '/login',
            defaultLabel: user ? 'Go to Dashboard' : 'Sign In',
        },
    }[type] || {
        badge: 'Restricted',
        badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        title: title || 'Access Restricted',
        message: message || 'You do not have permission to access this resource.',
        icon: ShieldAlert,
        iconBg: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
        defaultRedirect: user ? '/' : '/login',
        defaultLabel: user ? 'Go to Dashboard' : 'Sign In',
    };

    const targetRoute = redirectTo || config.defaultRedirect;
    const buttonLabel = redirectLabel || config.defaultLabel;
    const Icon = config.icon;

    // Countdown and automatic redirect timer
    useEffect(() => {
        if (isPaused) return;

        if (timeLeft <= 0) {
            navigate(targetRoute, { replace: true });
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, isPaused, navigate, targetRoute]);

    const handleRedirectNow = () => {
        navigate(targetRoute, { replace: true });
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 p-4 transition-colors">
            <div className="max-w-md w-full bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-2xl shadow-xl p-6 sm:p-8 text-center relative overflow-hidden">
                {/* Decorative top accent line */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-indigo-500" />

                {/* Badge */}
                <div className="flex justify-center mb-5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${config.badgeColor}`}>
                        <Icon size={13} />
                        <span>{config.badge}</span>
                    </span>
                </div>

                {/* Icon Circle */}
                <div className="flex justify-center mb-4">
                    <div className={`p-4 rounded-2xl border ${config.iconBg} shadow-sm`}>
                        <Icon size={36} strokeWidth={2} />
                    </div>
                </div>

                {/* Title & Message */}
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
                    {config.title}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                    {config.message}
                </p>

                {/* Attempted path reference (sanitized, path only) */}
                <div className="mb-6 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[11px] font-mono text-gray-600 dark:text-gray-400 truncate">
                    Attempted: <span className="font-semibold text-gray-800 dark:text-gray-200">{location.pathname}</span>
                </div>

                {/* Redirect Button with Countdown */}
                <div className="space-y-3">
                    <button
                        onClick={handleRedirectNow}
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 group"
                    >
                        {user ? <Home size={16} /> : <LogIn size={16} />}
                        <span>{buttonLabel}</span>
                        <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Timer banner & pause control */}
                    <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <Clock size={12} className="animate-pulse" />
                        <span>Redirecting automatically in <strong className="text-gray-900 dark:text-gray-100 font-mono">{timeLeft}s</strong></span>
                        <button
                            onClick={() => setIsPaused(!isPaused)}
                            className="underline ml-1 hover:text-gray-700 dark:hover:text-gray-300"
                            title={isPaused ? 'Resume countdown' : 'Pause countdown'}
                        >
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
