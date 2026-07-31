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
            window.location.href = '/login';
        }
    };

    // Helper to check user system_permissions
    // Levels: None = 0, Read = 1, Write = 2, Full = 3
    const hasPermission = (pageId, requiredLevel = 1) => {
        if (!user) return false;
        
        // Admins have absolute access to everything
        const userType = (user.user_type || '').toLowerCase();
        if (userType === 'admin' || userType === 'super admin' || userType === 'super_admin') {
            return true;
        }

        // Check configured system_permissions matrix
        const permissions = user.system_permissions || {};
        let userLevel = permissions[pageId] ?? 0;
        if (typeof userLevel === 'string') {
            const map = { 'none': 0, 'view': 1, 'edit': 2, 'read': 1, 'write': 2 };
            userLevel = map[userLevel.toLowerCase()] ?? 0;
        }
        return userLevel >= requiredLevel;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, hasPermission }}>
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
