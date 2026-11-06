import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

export default function DevRoute({ children }) {
    const { user, loading } = useAuth();

    // 1. Check frontend environment kill-switch
    const isDevEnabled = import.meta.env.VITE_ENABLE_DEV_LAB === 'true';
    if (!isDevEnabled) {
        return <Navigate to="/" replace />;
    }

    if (loading) {
        return <LoadingScreen message="Verifying developer clearance..." />;
    }

    // 2. Must be logged in
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // 3. Must be an administrator
    const isAdmin = 
        user.user_type === 'admin' || 
        user.isAdmin === true || 
        user.is_super_admin === true || 
        Boolean(user.is_super_admin);

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return children;
}

