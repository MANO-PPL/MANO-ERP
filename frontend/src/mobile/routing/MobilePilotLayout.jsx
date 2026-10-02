import React from 'react';
import { useLocation } from 'react-router-dom';
import ResponsiveRoute from './ResponsiveRoute';
import { isMobilePilotPath } from './mobilePilotRoutes';

export default function MobilePilotLayout({ mobile, desktop }) {
    const { pathname } = useLocation();

    if (!isMobilePilotPath(pathname)) return desktop;
    return <ResponsiveRoute mobile={mobile} desktop={desktop} />;
}
