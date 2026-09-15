import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Lock, Mail, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import { customToast } from '../../../utils/toast';

const requestLogin = (credentials) => api.post('/auth/login', credentials).then(({ data }) => data);

export default function MobileLogin({ loginRequest = requestLogin, authOverride, onNavigate }) {
    const auth = useAuth();
    const navigate = useNavigate();
    const { resolvedTheme, setTheme } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const activeAuth = authOverride || auth;
    const isDark = resolvedTheme === 'dark';

    useEffect(() => {
        if (!sessionStorage.getItem('logged_out')) return;
        sessionStorage.removeItem('logged_out');
        customToast.success('Logged out successfully! See you soon.', 'Logged Out');
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (loading) return;
        setLoading(true);
        setError('');
        try {
            const result = await loginRequest({ email, password, rememberMe });
            if (!result?.success || !result?.accessToken || !result?.user) {
                throw new Error(result?.message || 'Failed to login. Please check your credentials.');
            }
            activeAuth.login(result.accessToken, result.user);
            customToast.success('Successfully logged in!', 'Welcome');
            if (onNavigate) onNavigate('/');
            else navigate('/');
        } catch (loginError) {
            const message = loginError?.response?.data?.message
                || loginError?.message
                || 'Failed to login. Please check your credentials.';
            setError(message);
            customToast.error(message, 'Login Failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main data-mobile-page="login" className="relative flex min-h-[100dvh] w-full min-w-0 items-center overflow-x-hidden bg-slate-50 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] font-sans text-slate-900 dark:bg-gh-bg dark:text-gh-text">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
            </div>

            <button
                type="button"
                aria-label={`Use ${isDark ? 'light' : 'dark'} theme`}
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gh-border dark:bg-gh-subtle dark:text-gh-muted"
            >
                {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            </button>

            <section className="relative mx-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 dark:border-gh-border dark:bg-gh-subtle dark:shadow-black/30">
                <div className="mb-8 flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-gh-border dark:bg-gh-bg">
                        <img src="/mano-logo.svg" alt="" className="h-8 w-8 object-contain" />
                    </span>
                    <div>
                        <p className="text-xl font-black tracking-tight">MANO ERP</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-gh-muted">Enterprise Operations</p>
                    </div>
                </div>

                <div className="mb-6">
                    <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
                    <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-gh-muted">Use your existing ERP credentials.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="mobile-login-email" className="mb-1.5 block text-xs font-semibold">Email address</label>
                        <div className="relative">
                            <Mail size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="mobile-login-email"
                                type="email"
                                required
                                autoComplete="username"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gh-border dark:bg-gh-input"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="mobile-login-password" className="mb-1.5 block text-xs font-semibold">Password</label>
                        <div className="relative">
                            <Lock size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="mobile-login-password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-12 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gh-border dark:bg-gh-input"
                                placeholder="Enter your password"
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                onClick={() => setShowPassword((visible) => !visible)}
                                className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gh-muted"
                            >
                                {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                            </button>
                        </div>
                    </div>

                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(event) => setRememberMe(event.target.checked)}
                            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-gh-border dark:bg-gh-input"
                        />
                        Remember me for 30 days
                    </label>

                    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-900/15 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-wait disabled:opacity-60"
                    >
                        {loading && <LoaderCircle size={19} aria-hidden="true" className="animate-spin" />}
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
            </section>
        </main>
    );
}
