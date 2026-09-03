
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AgentShell from '../Agent/AgentShell';
import { connectedTransport } from '../../services/agentTransport';

const MainLayout = () => {
    return (
        <div className="flex w-full h-screen bg-gray-50 dark:bg-gh-bg text-gray-900 dark:text-gh-text font-sans transition-colors overflow-hidden">
            <Sidebar />
            <div className="flex-1 ml-[200px] flex flex-col min-w-0 h-full overflow-hidden">
                <TopBar />
                <main className="flex-1 min-h-0 min-w-0 w-full flex flex-col overflow-hidden">
                    <Outlet />
                </main>
            </div>
            <AgentShell transport={connectedTransport} />
        </div>
    );
};

export default MainLayout;
