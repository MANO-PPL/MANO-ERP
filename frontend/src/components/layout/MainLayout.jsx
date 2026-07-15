
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const MainLayout = () => {
    return (
        <div className="flex w-full h-screen bg-gray-50 dark:bg-gh-bg text-gray-900 dark:text-gh-text font-sans transition-colors">
            <Sidebar />
            <div className="flex-1 ml-[200px] flex flex-col min-w-0">
                <TopBar />
                <main className="flex-1 overflow-x-hidden overflow-y-auto w-full flex flex-col">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
