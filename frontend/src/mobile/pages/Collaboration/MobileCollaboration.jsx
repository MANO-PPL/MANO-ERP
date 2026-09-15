import React, { useEffect, useState } from 'react';
import MobilePageHeader from '../../components/MobilePageHeader';
import MobileTabs from '../../components/MobileTabs';
import MobileChat from './MobileChat';
import MobileCalendar from './MobileCalendar';
import { collaborationHashUrl, resolveCollaborationView, shouldNormalizeCollaborationHash } from './mobileCollaborationModel';

export default function MobileCollaboration() {
    const [view, setView] = useState(() => resolveCollaborationView(window.location.hash));
    useEffect(() => {
        if (shouldNormalizeCollaborationHash(window.location.hash)) window.history.replaceState(window.history.state, '', collaborationHashUrl(window.location, 'chat'));
        setView(resolveCollaborationView(window.location.hash));
        const onHash = () => setView(resolveCollaborationView(window.location.hash));
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);
    const changeView = (next) => { if (resolveCollaborationView(window.location.hash) === next && window.location.hash === `#${next}`) return; window.location.hash = next; };
    return <section className="min-w-0" data-mobile-collaboration data-collaboration-view={view}>
        <MobilePageHeader eyebrow="MANO WORKSPACE" title="Collaboration" subtitle="Static communication and schedule preview" />
        <div className="px-4 pb-4"><MobileTabs segmented label="Collaboration view" value={view} onChange={changeView} items={[{ value: 'chat', label: 'Chat' }, { value: 'calendar', label: 'Calendar' }]} /></div>
        {view === 'calendar' ? <MobileCalendar /> : <MobileChat />}
    </section>;
}
