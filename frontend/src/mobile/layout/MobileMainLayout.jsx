import React, { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AgentShell from '../../components/Agent/AgentShell';
import { connectedTransport } from '../../services/agentTransport';
import useMobileDrawer from '../hooks/useMobileDrawer';
import MobileSidebar from './MobileSidebar';
import MobileTopBar from './MobileTopBar';

export default function MobileMainLayout({ loadProjects }) {
    const navigate = useNavigate();
    const menuButtonRef = useRef(null);
    const wasOpenRef = useRef(false);
    const drawer = useMobileDrawer({ navigate });

    useEffect(() => {
        if (wasOpenRef.current && !drawer.isOpen) {
            queueMicrotask(() => menuButtonRef.current?.focus());
        }
        wasOpenRef.current = drawer.isOpen;
    }, [drawer.isOpen]);

    return (
        <div
            data-layout-branch="mobile"
            style={{ '--mobile-agent-clearance': '4.75rem' }}
            className="flex h-[100dvh] w-full min-w-0 flex-col overflow-x-hidden bg-gray-50 font-sans text-gray-900 transition-colors dark:bg-gh-bg dark:text-gh-text"
        >
            <MobileTopBar
                menuButtonRef={menuButtonRef}
                navigationOpen={drawer.isOpen}
                onOpenNavigation={drawer.openDrawer}
            />

            <MobileSidebar
                open={drawer.isOpen}
                onClose={drawer.closeDrawer}
                onNavigate={drawer.navigateFromDrawer}
                loadProjects={loadProjects}
            />

            <main
                id="mobile-main-content"
                className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[env(safe-area-inset-bottom)]"
            >
                <Outlet />
            </main>

            <div data-agent-contract="mobile" className="contents">
                <AgentShell transport={connectedTransport} />
            </div>
        </div>
    );
}
