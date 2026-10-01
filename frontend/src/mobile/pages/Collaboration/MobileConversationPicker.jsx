import React from 'react';
import { Hash, Lock } from 'lucide-react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import { CHANNELS, DMS, statusLabel } from '../../../pages/Collaboration/constants';

export default function MobileConversationPicker({ open, onClose, active, onSelect }) {
    const choose = (conversation) => { onSelect?.(conversation); onClose?.(); };
    return <MobileBottomSheet open={open} onClose={onClose} title="Switch conversation" description="Static collaboration preview">
        <div className="space-y-3" data-mobile-conversation-picker>
            <section><h3 className="mb-1.5 text-[11px] font-semibold text-gray-500">Channels</h3><div className="space-y-1.5">
                {CHANNELS.map((channel) => <button key={channel.id} type="button" onClick={() => choose({ ...channel, kind: 'channel' })} className={`flex min-h-10 w-full items-start gap-2.5 rounded-lg border p-2 text-left ${active?.kind === 'channel' && active.id === channel.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gh-border'}`}>
                    {channel.type === 'private' ? <Lock size={16} className="mt-0.5" /> : <Hash size={16} className="mt-0.5" />}<span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-gray-900 dark:text-gh-text">{channel.name}</span><span className="block text-[11px] font-normal text-gray-500 dark:text-gh-muted">{channel.description}</span></span>{channel.unread > 0 && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{channel.unread}</span>}
                </button>)}
            </div></section>
            <section><h3 className="mb-1.5 text-[11px] font-semibold text-gray-500">Direct messages</h3><div className="space-y-1.5">
                {DMS.map((dm) => <button key={dm.id} type="button" onClick={() => choose({ ...dm, kind: 'dm' })} className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg border p-2 text-left ${active?.kind === 'dm' && active.id === dm.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gh-border'}`}>
                    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${dm.color} text-xs font-semibold text-white`}>{dm.initials}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-gray-900 dark:text-gh-text">{dm.name}</span><span className="block text-[11px] font-normal text-gray-500 dark:text-gh-muted">{statusLabel[dm.status]}</span></span>{dm.unread > 0 && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{dm.unread}</span>}
                </button>)}
            </div></section>
        </div>
    </MobileBottomSheet>;
}
