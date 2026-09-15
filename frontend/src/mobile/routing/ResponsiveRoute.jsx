import React from 'react';
import useMobileViewport from '../hooks/useMobileViewport';

export default function ResponsiveRoute({ mobile, desktop }) {
    const isMobile = useMobileViewport();
    return isMobile ? mobile : desktop;
}
