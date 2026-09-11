import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Home, Copy, Check, Sun, Moon, Bug, AlertCircle } from 'lucide-react';
import { useTheme } from 'next-themes';

const ErrorFallback = ({ error, errorInfo, onReload, onGoHome }) => {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [copied, setCopied] = useState(false);
    const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

    const isDarkMode = resolvedTheme === 'dark' || theme === 'dark';

    const toggleTheme = () => {
        setTheme(isDarkMode ? 'light' : 'dark');
    };

    const handleCopy = () => {
        const errorText = [
            `Error: ${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
            `URL: ${window.location.href}`,
            `Timestamp: ${new Date().toISOString()}`,
            errorInfo?.componentStack ? `\nComponent Stack:${errorInfo.componentStack}` : ''
        ].filter(Boolean).join('\n');

        navigator.clipboard.writeText(errorText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
            // Clipboard write fallback
        });
    };

    const isChunkError =
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.name === 'ChunkLoadError';

    const errorMessage = error?.message || 'An unexpected error occurred while rendering this view.';
    const errorName = error?.name || 'Application Error';

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#f8fafc] dark:bg-[#0d1117] text-gray-900 dark:text-[#f0f6fc] p-4 sm:p-6 transition-colors duration-200">
            <div className="max-w-lg w-full bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/60 p-6 sm:p-8 text-center transition-colors relative overflow-hidden">
                {/* Top decorative accent line */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500" />

                {/* Top header row: Badge & Theme Switcher */}
                <div className="flex items-center justify-between mb-5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200/70 dark:border-red-900/50 text-[11px] font-semibold text-red-600 dark:text-red-400">
                        <Bug size={12} />
                        <span>System Error</span>
                    </div>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        title={isDarkMode ? 'Switch to White Mode' : 'Switch to Black Mode'}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#30363d] bg-gray-50 hover:bg-gray-100 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-xs font-medium text-gray-700 dark:text-gray-300 transition-all cursor-pointer select-none active:scale-95"
                        aria-label="Toggle Black/White Theme"
                    >
                        {isDarkMode ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} className="text-gray-600" />}
                        <span className="text-[11px]">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                </div>

                {/* Error Icon Badge */}
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-200/80 ring-4 ring-red-50/70 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50 dark:ring-4 dark:ring-red-950/20 mb-4 transition-colors">
                    <AlertTriangle size={28} />
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
                    {isChunkError ? 'Page Update or Network Interruption' : 'Something Went Wrong'}
                </h2>

                <p className="text-sm text-gray-600 dark:text-[#9da7b3] leading-relaxed mb-5">
                    {isChunkError
                        ? 'A new version or network interruption prevented this page module from loading. Refreshing the browser will fetch the latest assets.'
                        : 'An unexpected error occurred while rendering this view. You can reload the page or return to the dashboard.'}
                </p>

                {/* Error Message Display (States the error message according to Black & White theme) */}
                <div className="mb-6 text-left p-3.5 rounded-xl bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 font-mono flex items-center gap-1">
                            <AlertCircle size={12} />
                            {errorName}
                        </span>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
                        >
                            {copied ? (
                                <>
                                    <Check size={12} className="text-green-600 dark:text-green-400" />
                                    <span className="text-green-600 dark:text-green-400 font-semibold">Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy size={12} />
                                    <span>Copy Error</span>
                                </>
                            )}
                        </button>
                    </div>
                    <div className="text-xs font-mono font-medium text-gray-800 dark:text-[#f0f6fc] break-words leading-relaxed select-text">
                        {errorMessage}
                    </div>
                </div>

                {/* Primary & Secondary Action Buttons (Black & White Theme) */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={onReload}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                    >
                        <RotateCcw size={15} />
                        <span>Refresh Page</span>
                    </button>

                    <button
                        type="button"
                        onClick={onGoHome}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 dark:border-[#30363d] bg-white hover:bg-gray-50 dark:bg-[#21262d] dark:hover:bg-[#30363d] text-gray-700 dark:text-[#f0f6fc] text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                        <Home size={15} />
                        <span>Go to Dashboard</span>
                    </button>
                </div>

                {/* Collapsible Technical Details (Stack Trace) */}
                {(error || errorInfo) && (
                    <div className="mt-6 border-t border-gray-200 dark:border-[#30363d]/80 pt-4 text-left">
                        <button
                            type="button"
                            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                            className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-[#9da7b3] dark:hover:text-gray-200 cursor-pointer select-none flex items-center justify-between w-full transition-colors"
                        >
                            <span>Technical Details & Stack Trace</span>
                            <span className="text-[11px] font-mono">{showTechnicalDetails ? '− Hide' : '+ Show'}</span>
                        </button>

                        {showTechnicalDetails && (
                            <pre className="mt-2.5 p-3 rounded-xl bg-gray-100 dark:bg-[#0d1117] text-[11px] font-mono text-gray-800 dark:text-gray-300 overflow-x-auto max-h-48 border border-gray-200 dark:border-[#30363d] leading-relaxed whitespace-pre-wrap break-all select-all">
                                {error?.toString()}
                                {errorInfo?.componentStack}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error('ErrorBoundary caught an unhandled exception:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <ErrorFallback
                    error={this.state.error}
                    errorInfo={this.state.errorInfo}
                    onReload={this.handleReload}
                    onGoHome={this.handleGoHome}
                />
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
