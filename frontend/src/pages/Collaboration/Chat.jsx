import React, { useState } from 'react';
import {
    Hash, Lock, Plus, Search, Bell, ChevronRight, ChevronDown,
    Send, Paperclip, Smile, AtSign, Users, UserPlus, Phone, Video,
    MoreHorizontal, Star, MessageSquare
} from 'lucide-react';
import {
    CHANNELS, DMS, CHANNEL_MESSAGES, PINNED,
    statusColor, statusLabel
} from './constants';

export default function Chat({ activeTab, setActiveTab }) {
    const [activeChannel, setActiveChannel] = useState(CHANNELS[0]);
    const [activeDM, setActiveDM] = useState(null);
    const [message, setMessage] = useState('');
    const [channelsOpen, setChannelsOpen] = useState(true);
    const [dmsOpen, setDmsOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const messages = activeDM
        ? (CHANNEL_MESSAGES[1] || [])
        : (CHANNEL_MESSAGES[activeChannel?.id] || []);

    const handleSend = (e) => {
        e.preventDefault();
        setMessage('');
    };

    return (
        <div className="flex flex-1 overflow-hidden min-w-0">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tab Bar Integration */}
                <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-white dark:bg-[#0d1117]">
                    <div className="inline-flex p-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full">
                        {['chat', 'calendar'].map(tabId => (
                            <button
                                key={tabId}
                                onClick={() => setActiveTab(tabId)}
                                className={`flex items-center px-6 py-2 text-sm font-medium rounded-full transition-all ${activeTab === tabId
                                    ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {tabId.charAt(0).toUpperCase() + tabId.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Header */}
                <div className="h-12 px-6 flex items-center justify-between border-b border-gray-200 dark:border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {activeDM ? (
                            <>
                                <div className="relative">
                                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${activeDM.color} flex items-center justify-center text-xs font-bold text-white`}>{activeDM.initials}</div>
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#0d1117] ${statusColor[activeDM.status]}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{activeDM.name}</p>
                                    <p className={`text-xs ${activeDM.status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>{statusLabel[activeDM.status]}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                {activeChannel?.type === 'private' ? <Lock size={15} className="text-gray-500" /> : <Hash size={15} className="text-gray-500" />}
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{activeChannel?.name}</p>
                                    <p className="text-xs text-gray-500">{activeChannel?.description}</p>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><Bell size={14} /></button>
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><MoreHorizontal size={14} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar space-y-5">
                    {!activeDM && (
                        <div className="pb-5 border-b border-gray-100 dark:border-white/5 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-2">
                                <Hash size={20} className="text-blue-500" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">#{activeChannel?.name}</h2>
                            <p className="text-sm text-gray-500">{activeChannel?.description}. This is the start of the channel.</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className="flex items-start gap-3 group">
                            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${msg.color} flex-shrink-0 flex items-center justify-center text-xs font-bold text-white`}>{msg.initials}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-0.5">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{msg.author}</span>
                                    <span className="text-xs text-gray-400">{msg.time}</span>
                                </div>
                                <p className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed ${msg.isEmoji ? 'text-2xl' : ''}`}>{msg.text}</p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
                                <button className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"><Star size={12} /></button>
                                <button className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"><MessageSquare size={12} /></button>
                                <button className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"><MoreHorizontal size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input */}
                <div className="px-6 pb-5 pt-2 flex-shrink-0">
                    <form onSubmit={handleSend} className="flex items-center gap-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 focus-within:border-blue-400 dark:focus-within:border-blue-500/50 transition-colors">
                        <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"><Paperclip size={15} /></button>
                        <input value={message} onChange={e => setMessage(e.target.value)} placeholder={activeDM ? `Message ${activeDM.name}...` : `Message #${activeChannel?.name}...`} className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none" />
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><AtSign size={14} /></button>
                            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><Smile size={14} /></button>
                            <button type="submit" disabled={!message.trim()} className="w-7 h-7 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors">
                                <Send size={12} className="text-white" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Right Panel - Collaboration List Moved Here */}
            <aside className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-white/5 flex flex-col bg-gray-50 dark:bg-[#0d1117]">
                <div className="h-12 px-4 flex items-center border-b border-gray-200 dark:border-white/5 flex-shrink-0">
                    <span className="font-bold text-sm text-gray-900 dark:text-white truncate">Collaboration</span>
                </div>
                <div className="flex-1 py-2">
                    {/* Channels */}
                    <div className="mb-2">
                        <button onClick={() => setChannelsOpen(o => !o)} className="w-full flex items-center px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                            {channelsOpen ? <ChevronDown size={11} className="mr-1" /> : <ChevronRight size={11} className="mr-1" />}
                            Channels
                            <span className="ml-auto bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{CHANNELS.length}</span>
                        </button>
                        {channelsOpen && CHANNELS.filter(c => !searchQuery || c.name.includes(searchQuery.toLowerCase())).map(chan => (
                            <button key={chan.id} onClick={() => { setActiveChannel(chan); setActiveDM(null); }}
                                className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md mx-1 transition-colors ${activeChannel?.id === chan.id && !activeDM ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                                {chan.type === 'private' ? <Lock size={12} className="mr-2 flex-shrink-0 opacity-70" /> : <Hash size={12} className="mr-2 flex-shrink-0 opacity-70" />}
                                <span className="truncate flex-1 text-left text-xs">{chan.name}</span>
                                {chan.unread > 0 && <span className="ml-1 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">{chan.unread}</span>}
                            </button>
                        ))}
                        <button className="w-full flex items-center px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                            <Plus size={11} className="mr-2" /> Add Channel
                        </button>
                    </div>
                    {/* DMs */}
                    <div>
                        <button onClick={() => setDmsOpen(o => !o)} className="w-full flex items-center px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                            {dmsOpen ? <ChevronDown size={11} className="mr-1" /> : <ChevronRight size={11} className="mr-1" />}
                            Direct Messages
                        </button>
                        {dmsOpen && DMS.filter(d => !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase())).map(dm => (
                            <button key={dm.id} onClick={() => { setActiveDM(dm); setActiveChannel(null); }}
                                className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md mx-1 transition-colors ${activeDM?.id === dm.id ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                                <div className="relative flex-shrink-0 mr-2">
                                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${dm.color} flex items-center justify-center text-[9px] font-bold text-white`}>{dm.initials}</div>
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-gray-50 dark:border-[#0d1117] ${statusColor[dm.status]}`} />
                                </div>
                                <span className="truncate flex-1 text-left text-xs">{dm.name}</span>
                                {dm.unread > 0 && <span className="ml-1 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">{dm.unread}</span>}
                            </button>
                        ))}
                        <button className="w-full flex items-center px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                            <UserPlus size={11} className="mr-2" /> Add Colleague
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
