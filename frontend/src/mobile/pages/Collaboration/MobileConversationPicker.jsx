import React from 'react';
import { Hash, Lock } from 'lucide-react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import { CHANNELS, DMS, statusLabel } from '../../../pages/Collaboration/constants';

export default function MobileConversationPicker({ open, onClose, active, onSelect }) {
    const choose = (conversation) => { onSelect?.(conversation); onClose?.(); };
    return <MobileBottomSheet open={open} onClose={onClose} title="Switch conversation" description="Static collaboration preview">
        <div className="space-y-6" data-mobile-conversation-picker>
            <section><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Channels</h3><div className="space-y-2">
                {CHANNELS.map((channel) => <button key={channel.id} type="button" onClick={() => choose({ ...channel, kind: 'channel' })} className={`flex min-h-14 w-full items-start gap-3 rounded-xl border p-3 text-left ${active?.kind === 'channel' && active.id === channel.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gh-border'}`}>
                    {channel.type === 'private' ? <Lock size={18} /> : <Hash size={18} />}<span className="min-w-0 flex-1"><span className="block text-sm font-bold">{channel.name}</span><span className="block text-xs text-gray-500 dark:text-gh-muted">{channel.description}</span></span>{channel.unread > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{channel.unread}</span>}
                </button>)}
            </div></section>
            <section><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Direct messages</h3><div className="space-y-2">
                {DMS.map((dm) => <button key={dm.id} type="button" onClick={() => choose({ ...dm, kind: 'dm' })} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left ${active?.kind === 'dm' && active.id === dm.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gh-border'}`}>
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${dm.color} text-xs font-bold text-white`}>{dm.initials}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{dm.name}</span><span className="block text-xs text-gray-500 dark:text-gh-muted">{statusLabel[dm.status]}</span></span>{dm.unread > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{dm.unread}</span>}
                </button>)}
            </div></section>
        </div>
    </MobileBottomSheet>;
}
