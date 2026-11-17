import React, { useState } from 'react';
import { MessageCircle, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Chat from './Chat';
import Calendar from './Calendar';

export default function CollaborationPage() {
    const { hasPermission } = useAuth();
    const [requestedTab, setActiveTabOriginal] = useState(window.location.hash.replace('#', '') || 'chat');

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

    const tabs = ['chat', 'calendar'].filter(id => hasPermission(`collaboration.${id}`));
    const activeTab = tabs.includes(requestedTab) ? requestedTab : tabs[0];
    if (!activeTab) return <p className="p-6">No collaboration pages assigned.</p>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 overflow-hidden">
            {/* Tab Content */}
            {activeTab === 'chat' && <Chat tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />}
            {activeTab === 'calendar' && <Calendar tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />}
        </div>
    );
}
