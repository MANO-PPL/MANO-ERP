import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, ArrowDown, ArrowUpRight } from 'lucide-react';
import { starterPrompts } from './agentContext.js';
import { isUserVisibleConversationMessage } from './agentModel.js';
import { AgentActionCard, AgentConfirmationCard, AgentErrorCard, AgentProvenance, AgentResultCard } from './AgentCards.jsx';

export default function AgentConversation({ state, context, onPrompt, onDecision, onRetry, preview }) {
    const scrollRef = useRef(null);
    const following = useRef(true);
    const [showLatest, setShowLatest] = useState(false);
    useEffect(() => { following.current = true; setShowLatest(false); }, [state.conversationId]);
    useEffect(() => {
        if (following.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        else setShowLatest(true);
    }, [state.messages, state.status]);
    const visibleMessages = state.messages.filter(isUserVisibleConversationMessage);
    return <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
            role="region" aria-label="Assistant conversation" tabIndex={0}
            onScroll={event => {
                const element = event.currentTarget;
                following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 60;
                if (following.current) setShowLatest(false);
            }}>
            {!visibleMessages.length ? <div className="flex min-h-full flex-col justify-center py-4">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400"><MessageSquare size={21} aria-hidden="true" /></div>
                <h3 className="text-lg font-semibold tracking-tight">Help with your workspace</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gh-muted">Ask about projects, vendors, clients, or resources.{preview ? ' The agent service is not connected yet.' : ''}</p>
                <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gh-muted">Try a question</p>
                <div className="space-y-2">{starterPrompts(context).map(prompt => <button key={prompt} type="button" onClick={() => onPrompt(prompt)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-left text-xs leading-relaxed hover:border-blue-300 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-gh-border dark:hover:bg-gh-hover"><span>{prompt}</span><ArrowUpRight size={15} className="shrink-0 text-gray-400" aria-hidden="true" /></button>)}</div>
            </div> : <ol className="space-y-5" aria-label="Conversation messages">{visibleMessages.map(message => <li key={message.id}>
                {message.kind === 'text' && <>
                    <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-gh-muted">{message.role === 'user' ? 'You' : message.role === 'status' ? 'Status' : 'ERP Assistant'}</p>
                    <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${message.role === 'user' ? 'rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/30' : ''}`}>
                        {message.text || (message.streaming ? 'Preparing response…' : '')}
                    </div>
                    {message.context && <p className="mt-1 text-[10px] text-gray-500 dark:text-gh-muted">Context: {message.context.module}{message.context.projectId ? ` · Project ${message.context.projectId}` : ''}</p>}
                    {message.result && <div className="mt-2"><AgentResultCard result={message.result} preview={preview} /></div>}
                </>}
                {message.kind === 'action' && <AgentActionCard action={message.action} preview={preview} />}
                {message.kind === 'confirmation' && <AgentConfirmationCard message={message} pending={state.pending} busy={state.decisionBusy} onDecision={onDecision} preview={preview} />}
                {message.kind === 'result' && <AgentResultCard result={message.result} preview={preview} />}
                {message.kind === 'error' && <AgentErrorCard error={message.error} onRetry={onRetry} retryDisabled={!!state.activeRequestId} />}
                <AgentProvenance provenance={message.provenance} />
            </li>)}</ol>}
        </div>
        {showLatest && <button type="button" className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs shadow-sm focus-visible:outline focus-visible:outline-blue-500 dark:border-gh-border dark:bg-gh-subtle" onClick={() => {
            following.current = true;
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            setShowLatest(false);
        }}><ArrowDown size={14} aria-hidden="true" />Latest message</button>}
    </div>;
}
