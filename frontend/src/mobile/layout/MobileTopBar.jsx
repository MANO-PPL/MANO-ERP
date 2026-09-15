import React, { useState } from 'react';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '../../context/AuthContext';
import MobileBottomSheet from '../components/MobileBottomSheet';

const initialsFor = (name) => String(name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function MobileTopBar({ menuButtonRef, navigationOpen, onOpenNavigation }) {
    const { resolvedTheme, setTheme } = useTheme();
    const { user, logout } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const isDark = resolvedTheme === 'dark';

    const handleLogout = async () => {
        setProfileOpen(false);
        await logout();
    };

    return (
        <>
            <header className="sticky top-0 z-30 shrink-0 border-b border-gray-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-gh-border dark:bg-gh-subtle/95">
                <div className="flex min-h-14 items-center gap-2 px-3">
                    <button
                        ref={menuButtonRef}
                        type="button"
                        aria-label="Open navigation"
                        aria-expanded={navigationOpen}
                        aria-controls="mobile-navigation-drawer"
                        onClick={onOpenNavigation}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-gh-muted dark:hover:bg-gh-hover"
                    >
                        <Menu size={22} aria-hidden="true" />
                    </button>

                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <img src="/mano-logo.svg" alt="" className="h-8 w-8 shrink-0 object-contain" />
                        <span className="truncate text-sm font-extrabold tracking-tight text-gray-900 dark:text-gh-text">MANO ERP</span>
                    </div>

                    <button
                        type="button"
                        aria-label={`Use ${isDark ? 'light' : 'dark'} theme`}
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-gh-muted dark:hover:bg-gh-hover"
                    >
                        {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
                    </button>

                    <button
                        type="button"
                        aria-label="Open profile actions"
                        onClick={() => setProfileOpen(true)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    >
                        {user?.profile_image_url ? (
                            <img
                                src={user.profile_image_url}
                                alt=""
                                className="h-9 w-9 rounded-full border border-blue-200 object-cover dark:border-blue-800"
                            />
                        ) : (
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                {initialsFor(user?.user_name)}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            <MobileBottomSheet open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gh-bg">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {initialsFor(user?.user_name)}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-gh-text">{user?.user_name || 'User'}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gh-muted">{user?.desg_name || user?.user_type || 'Employee'}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
                >
                    <LogOut size={18} aria-hidden="true" />
                    Log out
                </button>
            </MobileBottomSheet>
        </>
    );
}
