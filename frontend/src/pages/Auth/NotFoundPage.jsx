import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Compass, Home, LogIn, ArrowRight, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * NotFoundPage (404)
 *
 * Rendered when a route doesn't match any registered route.
 * Redirects authenticated users to dashboard, and unauthenticated users to login.
 * Includes a configurable automated countdown timer.
 */
export default function NotFoundPage({ countdownSeconds = 5 }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading } = useAuth();
    const [timeLeft, setTimeLeft] = useState(countdownSeconds);
    const [isPaused, setIsPaused] = useState(false);

    const targetRoute = user ? '/' : '/login';
    const buttonLabel = user ? 'Go to Dashboard' : 'Go to Login';

    useEffect(() => {
        if (loading || isPaused) return;

        if (timeLeft <= 0) {
            navigate(targetRoute, { replace: true });
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, isPaused, loading, navigate, targetRoute]);

    const handleRedirectNow = () => {
        navigate(targetRoute, { replace: true });
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 p-4 transition-colors">
            <div className="max-w-md w-full bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-2xl shadow-xl p-6 sm:p-8 text-center relative overflow-hidden">
                {/* Decorative top accent line */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                {/* Badge */}
                <div className="flex justify-center mb-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                        <Compass size={13} />
                        <span>404 — Page Not Found</span>
                    </span>
                </div>

                {/* Big numeric indicator */}
                <div className="text-6xl sm:text-7xl font-extrabold tracking-tight text-gray-200 dark:text-gray-800 select-none mb-1">
                    404
                </div>

                {/* Title & Message */}
                <h1 className="text-lg sm:text-xl font-bold tracking-tight mb-2 -mt-4">
                    Lost in the system?
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                    The page or endpoint you are trying to reach does not exist or has been moved.
                </p>

                {/* Attempted path reference */}
                <div className="mb-6 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[11px] font-mono text-gray-600 dark:text-gray-400 truncate">
                    Invalid URL: <span className="font-semibold text-gray-800 dark:text-gray-200">{location.pathname}</span>
                </div>

                {/* Action button */}
                <div className="space-y-3">
                    <button
                        onClick={handleRedirectNow}
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 group"
                    >
                        {user ? <Home size={16} /> : <LogIn size={16} />}
                        <span>{buttonLabel}</span>
                        <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Countdown indicator */}
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
