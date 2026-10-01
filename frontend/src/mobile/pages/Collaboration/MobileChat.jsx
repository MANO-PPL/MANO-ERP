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
    return <div className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24" data-mobile-collaboration-chat>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs font-normal leading-5 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">Messaging is preview-only. Messages are not sent or saved.</div>
        <MobileCard className="flex items-start gap-2.5 p-2.5 sm:p-3">
            <span className="mt-0.5 text-gray-500">{active.kind === 'channel' ? (active.type === 'private' ? <Lock size={16} /> : <Hash size={16} />) : <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${active.color} text-xs font-semibold text-white`}>{active.initials}</span>}</span>
            <div className="min-w-0 flex-1"><h2 className="truncate text-xs font-semibold">{active.name}</h2><p className="text-[11px] leading-4 font-normal text-gray-500 dark:text-gh-muted">{active.kind === 'channel' ? active.description : active.status}</p></div>
            <button type="button" onClick={() => setPickerOpen(true)} className="min-h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-semibold dark:border-gh-border">Switch</button>
        </MobileCard>
        <div className="space-y-2" aria-label="Messages">{messages.map((message) => <MobileCard key={message.id} className="flex gap-2.5 p-2.5">
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${message.color} text-xs font-semibold text-white`}>{message.initials}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-1.5"><span className="text-xs font-semibold">{message.author}</span><span className="text-[10px] font-normal text-gray-400">{message.time}</span></div><p className="mt-0.5 break-words text-xs leading-5 font-normal text-gray-700 dark:text-gh-text">{message.text}</p></div>
        </MobileCard>)}</div>
        <form onSubmit={(event) => event.preventDefault()} className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gh-border dark:bg-gh-subtle">
            <label htmlFor="mobile-chat-draft" className="sr-only">Message draft</label><textarea id="mobile-chat-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a local draft…" className="min-h-16 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs font-normal outline-none dark:border-gh-border dark:bg-gh-input" />
            <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] font-normal text-gray-500">Draft remains only until this view is closed.</span><button type="button" disabled className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white opacity-45"><Send size={13} />Send</button></div>
        </form>
        <MobileConversationPicker open={pickerOpen} onClose={() => setPickerOpen(false)} active={active} onSelect={setActive} />
    </div>;
}
