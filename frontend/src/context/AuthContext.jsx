import React, { createContext, useState, useEffect, useContext } from 'react';
import { authApi } from '../services/authApi';
import { setAccessToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const clearClientCaches = () => {
        try {
            sessionStorage.clear();
            const theme = localStorage.getItem('theme');
            localStorage.clear();
            if (theme) localStorage.setItem('theme', theme);
        } catch (e) {
            console.warn('Failed to clear client caches:', e);
        }
    };

    const refreshUser = async () => {
        const hasUserTypeCookie = document.cookie.split(';').some((item) => item.trim().startsWith('userType='));
        if (!hasUserTypeCookie) {
            setUser(null);
            setAccessToken(null);
            clearClientCaches();
            setLoading(false);
            return;
        }

        try {
            const data = await authApi.getMe();
            if (data.success && data.user) {
                setUser(data.user);
            } else {
                // Clear state if failed
                setUser(null);
                setAccessToken(null);
                clearClientCaches();
            }
        } catch (err) {
            console.error('Failed to retrieve user profile:', err);
            // If the error is auth-related, clear token
            if (err.response?.status === 401 || err.response?.status === 403) {
                setUser(null);
                setAccessToken(null);
                clearClientCaches();
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    const login = (token, userData) => {
        clearClientCaches();
        setAccessToken(token);
        setUser(userData);
    };

    const logout = async () => {
        try {
            await authApi.logout();
        } catch (err) {
            console.error('Logout request failed:', err);
        } finally {
            setUser(null);
            setAccessToken(null);
            clearClientCaches();
            sessionStorage.setItem('logged_out', 'true');
            window.location.href = '/login';
        }
    };

    const userType = (user?.user_type || '').toLowerCase();
    const isAdmin = userType === 'admin' || userType === 'superadmin' || Boolean(user?.is_super_admin) || Boolean(user?.isAdmin);
    const isClient = userType === 'client';
    const isEmployee = userType === 'employee';

    // Helper to check user system_permissions
    // Levels: None = 0, Read = 1, Write = 2, Full = 3
    const hasPermission = (pageId, requiredLevel = 1) => {
        if (!user) return false;
        
        // Dashboard is universal for all authenticated users who have access to ERP
        if (!pageId || pageId === 'dashboard' || pageId === 'Dashboard') {
            return true;
        }

        // Admins have absolute access to everything
        if (isAdmin) {
            return true;
        }

        // Parse system_permissions if stored as string JSON
        let permissions = user.system_permissions || {};
        if (typeof permissions === 'string') {
            try {
                permissions = JSON.parse(permissions);
            } catch (e) {
                permissions = {};
            }
        }

        // Case-insensitive key resolution
        const normKey = String(pageId).toLowerCase().trim();
        let userLevel = permissions[pageId] ?? permissions[normKey];

        // Also check if stored under alternative naming (e.g. employee vs admin)
        if (userLevel === undefined) {
            if (normKey === 'admin' || normKey === 'employee') {
                userLevel = permissions['admin'] ?? permissions['employee'] ?? 0;
            } else {
                userLevel = 0;
            }
        }

        if (typeof userLevel === 'string') {
            const map = { 
                'none': 0, '0': 0,
                'view': 1, 'read': 1, '1': 1,
                'edit': 2, 'write': 2, '2': 2,
                'full': 3, 'admin': 3, '3': 3,
                'true': 1
            };
            userLevel = map[userLevel.toLowerCase().trim()] ?? 0;
        } else if (typeof userLevel === 'boolean') {
            userLevel = userLevel ? 1 : 0;
        }

        return Number(userLevel) >= Number(requiredLevel);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, hasPermission, isAdmin, isClient, isEmployee }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
