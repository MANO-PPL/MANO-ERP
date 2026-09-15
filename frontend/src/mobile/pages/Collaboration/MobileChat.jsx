import React, { useState } from 'react';
import { Hash, Lock, Send } from 'lucide-react';
import { CHANNELS, CHANNEL_MESSAGES } from '../../../pages/Collaboration/constants';
import MobileCard from '../../components/MobileCard';
import MobileConversationPicker from './MobileConversationPicker';
import { conversationMessages } from './mobileCollaborationModel';

export default function MobileChat() {
    const [active, setActive] = useState({ ...CHANNELS[0], kind: 'channel' });
    const [pickerOpen, setPickerOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const messages = conversationMessages(active, CHANNEL_MESSAGES);
    return <div className="space-y-4 px-4 pb-[calc(var(--mobile-agent-clearance,4.75rem)+1rem)]" data-mobile-collaboration-chat>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">Messaging is preview-only. Messages are not sent or saved.</div>
        <MobileCard className="flex items-start gap-3">
            <span className="mt-0.5 text-gray-500">{active.kind === 'channel' ? (active.type === 'private' ? <Lock size={18} /> : <Hash size={18} />) : <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${active.color} text-xs font-bold text-white`}>{active.initials}</span>}</span>
            <div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold">{active.name}</h2><p className="text-xs leading-5 text-gray-500 dark:text-gh-muted">{active.kind === 'channel' ? active.description : active.status}</p></div>
            <button type="button" onClick={() => setPickerOpen(true)} className="min-h-11 rounded-xl border border-gray-200 px-3 text-xs font-bold dark:border-gh-border">Switch</button>
        </MobileCard>
        <div className="space-y-3" aria-label="Messages">{messages.map((message) => <MobileCard key={message.id} className="flex gap-3 p-3">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${message.color} text-xs font-bold text-white`}>{message.initials}</span>
            <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-2"><strong className="text-sm">{message.author}</strong><span className="text-[11px] text-gray-400">{message.time}</span></div><p className="mt-1 break-words text-sm leading-6 text-gray-700 dark:text-gh-text">{message.text}</p></div>
        </MobileCard>)}</div>
        <form onSubmit={(event) => event.preventDefault()} className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gh-border dark:bg-gh-subtle">
            <label htmlFor="mobile-chat-draft" className="sr-only">Message draft</label><textarea id="mobile-chat-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a local draft…" className="min-h-24 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none dark:border-gh-border dark:bg-gh-input" />
            <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-gray-500">Draft remains only until this view is closed.</span><button type="button" disabled className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white opacity-45"><Send size={17} />Send</button></div>
        </form>
        <MobileConversationPicker open={pickerOpen} onClose={() => setPickerOpen(false)} active={active} onSelect={setActive} />
    </div>;
}
