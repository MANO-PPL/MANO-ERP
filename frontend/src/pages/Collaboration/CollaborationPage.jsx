import React, { useState } from 'react';
import { MessageCircle, Calendar as CalendarIcon } from 'lucide-react';
import Chat from './Chat';
import Calendar from './Calendar';

export default function CollaborationPage() {
    const [activeTab, setActiveTabOriginal] = useState(window.location.hash.replace('#', '') || 'chat');

    const setActiveTab = (tab) => {
        window.location.hash = tab;
        setActiveTabOriginal(tab);
    };

    React.useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            if (hash && (hash === 'chat' || hash === 'calendar')) {
                setActiveTabOriginal(hash);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const tabs = [
        { id: 'chat', label: 'Chat' },
        { id: 'calendar', label: 'Calendar' },
    ];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 overflow-hidden">
            {/* Tab Content */}
            {activeTab === 'chat' && <Chat activeTab={activeTab} setActiveTab={setActiveTab} />}
            {activeTab === 'calendar' && <Calendar activeTab={activeTab} setActiveTab={setActiveTab} />}
        </div>
    );
}
