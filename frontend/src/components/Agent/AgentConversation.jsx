import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Copy, Check } from 'lucide-react';
import { starterPrompts, categorizedStarterPrompts } from './agentContext.js';
import { isUserVisibleConversationMessage } from './agentModel.js';
import { AgentActionCard, AgentConfirmationCard, AgentErrorCard, AgentProvenance, AgentResultCard } from './AgentCards.jsx';
import { AgentEntityChip } from './AgentEntityChip.jsx';

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        if (!text) return;
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
    };
    return (
        <button type="button" onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gh-muted dark:hover:bg-gh-hover dark:hover:text-gh-text transition-colors"
            title="Copy message to clipboard" aria-label="Copy message">
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
    );
}

const PHASE_CONFIG = {
    thinking: { label: 'Thinking', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gh-subtle/60', border: 'border-gray-200/70 dark:border-gh-border/60', dot: 'bg-gray-500 dark:bg-gray-400' },
    executing: { label: 'Reading ERP data', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50/60 dark:bg-blue-950/20', border: 'border-blue-200/60 dark:border-blue-900/30', dot: 'bg-blue-500' },
    writing:   { label: 'Writing response', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gh-subtle/60', border: 'border-gray-200/70 dark:border-gh-border/60', dot: 'bg-gray-500 dark:bg-gray-400' },
};

function ThinkingBlock({ thinkingPhase, activeToolName }) {
    const cfg = PHASE_CONFIG[thinkingPhase] || PHASE_CONFIG.thinking;
    const toolLabel = activeToolName ? activeToolName.replace(/\./g, '.').replace(/_/g, ' ') : null;
    return (
        <div className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all duration-300 ${cfg.bg} ${cfg.border} ${cfg.color}`}>
            <span className="flex-1 leading-snug">
                {cfg.label}
                {toolLabel && <span className="ml-1.5 font-normal opacity-60">({toolLabel})</span>}
            </span>
            <span className="flex items-center gap-0.5 shrink-0">
                {[0, 150, 300].map(d => (
                    <span key={d} className={`h-1.5 w-1.5 rounded-full ${cfg.dot} animate-bounce`} style={{ animationDelay: `${d}ms` }} />
                ))}
            </span>
        </div>
    );
}

function shouldRenderResultCard(result) {
    if (!result) return false;
    if (result.kind === 'list') {
        return Boolean(result.showVisualization && ((result.matrixRows && result.matrixRows.length > 0) || (result.kpis && result.kpis.length > 0)));
    }
    return ['chart', 'multi_chart', 'briefing', 'approval_queue', 'excel_export', 'execution', 'warning'].includes(result.kind);
}

function parseMarkdownSpans(text, keyPrefix = 'md') {
    if (!text || typeof text !== 'string') return text;
    const mdRegex = /(?:\*\*([^*]+?)\*\*)|(?:\*([^*]+?)\*)|(?:`([^`]+)`)/g;
    const segments = [];
    let last = 0;
    let m;
    while ((m = mdRegex.exec(text)) !== null) {
        if (m.index > last) {
            const chunk = text.substring(last, m.index).replace(/\*\*/g, '');
            if (chunk) segments.push(chunk);
        }
        if (m[1] !== undefined) {
            segments.push(
                <strong key={`${keyPrefix}-b-${m.index}`} className="font-semibold text-gray-900 dark:text-white">
                    {m[1]}
                </strong>
            );
        } else if (m[2] !== undefined) {
            segments.push(
                <em key={`${keyPrefix}-i-${m.index}`} className="italic text-gray-800 dark:text-gh-text">
                    {m[2]}
                </em>
            );
        } else if (m[3] !== undefined) {
            segments.push(
                <code key={`${keyPrefix}-c-${m.index}`} className="rounded px-1.5 py-0.5 font-mono text-[11px] bg-gray-100 dark:bg-gh-subtle text-gray-800 dark:text-gh-text border border-gray-200 dark:border-gh-border">
                    {m[3]}
                </code>
            );
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) {
        const remaining = text.substring(last).replace(/\*\*/g, '');
        if (remaining) segments.push(remaining);
    }
    return segments.length > 0 ? segments : text.replace(/\*\*/g, '');
}

function parseFormattedLine(line, onPrompt) {
    if (!line || typeof line !== 'string') return line;
    const combinedRegex = /(?:\[entity:([a-z]+)(?::(\d+))?\|([^\]]+)\])|(?:\[([^\]]+)\]\(([^)]+)\))|(?:Project\s*#(\d+))|(?:\(([A-Z0-9]+(?:[-_][A-Z0-9]+)+)\))/g;
    const parts = []; let lastIndex = 0; let match;
    while ((match = combinedRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            const rawChunk = line.substring(lastIndex, match.index);
            const parsed = parseMarkdownSpans(rawChunk, `txt-${lastIndex}`);
            if (Array.isArray(parsed)) parts.push(...parsed);
            else parts.push(parsed);
        }
        if (match[1]) {
            parts.push(<AgentEntityChip key={`chip-${match.index}`} entityType={match[1]} entityId={match[2] ? Number(match[2]) : undefined} label={match[3]} onPrompt={onPrompt} />);
        } else if (match[4] && match[5]) {
            const route = match[5];
            const inferredType = route.startsWith('/projects') ? 'project' : route.startsWith('/vendors') ? 'vendor' : route.startsWith('/clients') ? 'client' : route.startsWith('/resources') ? 'resource' : 'project';
            parts.push(<AgentEntityChip key={`link-${match.index}`} entityType={inferredType} label={match[4]} route={route} onPrompt={onPrompt} />);
        } else if (match[6]) {
            const projId = Number(match[6]);
            parts.push(<AgentEntityChip key={`proj-${match.index}`} entityType="project" entityId={projId} label={`Project #${projId}`} route={`/projects/${projId}`} onPrompt={onPrompt} />);
        } else if (match[7]) {
            parts.push(<span key={`code-${match.index}`} className="inline-flex items-center mx-1 px-1.5 rounded font-mono text-[11px] font-medium bg-gray-100 dark:bg-gh-subtle text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gh-border">{match[7]}</span>);
        }
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
        const rawChunk = line.substring(lastIndex);
        const parsed = parseMarkdownSpans(rawChunk, `end-${lastIndex}`);
        if (Array.isArray(parsed)) parts.push(...parsed);
        else parts.push(parsed);
    }
    return parts.length > 0 ? parts : parseMarkdownSpans(line);
}

function FormattedMessageText({ text, onPrompt }) {
    if (!text) return null;
    const elements = []; let currentList = null;
    text.split('\n').forEach(line => {
        const trimmed = line.trim();
        const nm = trimmed.match(/^(?:(\d+)[.)\]]|\((\d+)\))\s+(.*)/);
        const bm = trimmed.match(/^[-*•]\s+(.*)/);
        const hm1 = trimmed.match(/^(#{1,2})\s+(.+)$/);
        const hm2 = trimmed.match(/^(#{3,4})\s+(.+)$/);
        const boldHeading = trimmed.match(/^\*\*([^*]+?)\*\*[:]?$/);
        const colonHeading = trimmed.match(/^([A-Z][A-Za-z0-9\s()&/.-]{2,50}:)$/);

        if (nm) {
            if (!currentList || currentList.type !== 'ol') { currentList = { type: 'ol', items: [] }; elements.push(currentList); }
            currentList.items.push({ num: nm[1] || nm[2], content: nm[3] });
        } else if (bm) {
            if (!currentList || currentList.type !== 'ul') { currentList = { type: 'ul', items: [] }; elements.push(currentList); }
            currentList.items.push({ content: bm[1] });
        } else if (hm1) {
            currentList = null;
            elements.push({ type: 'h', level: 1, content: hm1[2] });
        } else if (hm2) {
            currentList = null;
            elements.push({ type: 'h', level: 2, content: hm2[2] });
        } else if (boldHeading) {
            currentList = null;
            elements.push({ type: 'h', level: 1, content: boldHeading[1] });
        } else if (colonHeading) {
            currentList = null;
            elements.push({ type: 'h', level: 2, content: colonHeading[1] });
        } else {
            currentList = null;
            if (trimmed.length > 0) elements.push({ type: 'p', content: trimmed });
        }
    });
    return (
        <div className="space-y-2 leading-relaxed text-xs">
            {elements.map((el, i) => {
                if (el.type === 'h') {
                    if (el.level === 2) {
                        return (
                            <div key={i} className="pt-2 pb-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 dark:bg-blue-500 shrink-0" />
                                <span>{parseFormattedLine(el.content, onPrompt)}</span>
                            </div>
                        );
                    }
                    return (
                        <div key={i} className="pt-2 pb-1 flex items-center">
                            <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50/90 dark:bg-blue-950/50 px-2.5 py-1 text-xs font-bold text-blue-800 dark:text-blue-200 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs">
                                <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                                <span>{parseFormattedLine(el.content, onPrompt)}</span>
                            </div>
                        </div>
                    );
                }
                if (el.type === 'ol') return (
                    <ol key={i} className="my-1.5 space-y-1 pl-1">
                        {el.items.map((item, j) => (
                            <li key={j} className="flex items-baseline gap-2 text-xs text-gray-800 dark:text-gh-text leading-relaxed">
                                <span className="font-normal text-gray-400 dark:text-gray-500 select-none shrink-0 w-4 text-right">{item.num}.</span>
                                <div className="min-w-0 flex-1 break-words">{parseFormattedLine(item.content, onPrompt)}</div>
                            </li>
                        ))}
                    </ol>
                );
                if (el.type === 'ul') return (
                    <ul key={i} className="my-1.5 space-y-1 pl-2">
                        {el.items.map((item, j) => (
                            <li key={j} className="flex items-baseline gap-2 text-xs text-gray-800 dark:text-gh-text leading-relaxed">
                                <span className="text-gray-400 dark:text-gray-500 select-none shrink-0">•</span>
                                <div className="min-w-0 flex-1 break-words">{parseFormattedLine(item.content, onPrompt)}</div>
                            </li>
                        ))}
                    </ul>
                );
                return <p key={i} className="break-words text-xs leading-relaxed text-gray-800 dark:text-gh-text">{parseFormattedLine(el.content, onPrompt)}</p>;
            })}
        </div>
    );
}

function StreamingResponse({ message, onStreamTick, onPrompt }) {
    const text = message.text || '';
    const isStreaming = message.streaming;
    useEffect(() => { if (isStreaming && text) onStreamTick?.(); }, [text, isStreaming, onStreamTick]);
    return (
        <div className="relative">
            <FormattedMessageText text={text} onPrompt={onPrompt} />
            {isStreaming && (
                <span className="inline-block h-3.5 w-0.5 ml-0.5 align-middle rounded-xs bg-blue-600 dark:bg-blue-400"
                    style={{ animation: 'blink-caret 0.7s step-end infinite' }} aria-hidden="true" />
            )}
        </div>
    );
}

export default function AgentConversation({ state, context, onPrompt, onDecision, onRetry, preview, debugMode = false }) {
    const scrollRef = useRef(null);
    const following = useRef(true);
    const [showLatest, setShowLatest] = useState(false);

    useEffect(() => { following.current = true; setShowLatest(false); }, [state.conversationId]);
    useEffect(() => {
        if (following.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        else setShowLatest(true);
    }, [state.messages, state.status, state.thinkingPhase]);

    const rawVisible = state.messages.filter(m => isUserVisibleConversationMessage(m, debugMode));
    const visibleMessages = []; const consumedIds = new Set();
    for (let i = 0; i < rawVisible.length; i++) {
        const msg = rawVisible[i]; if (consumedIds.has(msg.id)) continue;
        if (msg.kind === 'text' && msg.role === 'assistant') {
            const nxt = rawVisible[i + 1]; const prv = rawVisible[i - 1];
            let ar = msg.result;
            if (!ar && nxt?.kind === 'result') { ar = nxt.result; consumedIds.add(nxt.id); }
            else if (!ar && prv?.kind === 'result' && !consumedIds.has(prv.id)) { ar = prv.result; consumedIds.add(prv.id); }
            visibleMessages.push({ ...msg, attachedResult: ar });
        } else { visibleMessages.push(msg); }
    }

    let streamingMsg = null;
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
        if (visibleMessages[i].role === 'assistant' && visibleMessages[i].streaming) { streamingMsg = visibleMessages[i]; break; }
    }

    const handleStreamTick = () => { if (following.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; };
    const isAgentActive = ['submitting', 'thinking', 'executing'].includes(state.status);
    const showThinkingBlock = isAgentActive && (!streamingMsg || streamingMsg.text.length === 0);

    return (
        <>
            <style>{'@keyframes blink-caret { 0%,100%{opacity:1} 50%{opacity:0} }'}</style>
            <div className="relative flex min-h-0 flex-1 flex-col bg-gray-50/40 dark:bg-gh-bg">
                <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
                    role="region" aria-label="Assistant conversation" tabIndex={0}
                    onScroll={e => { const el = e.currentTarget; following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; if (following.current) setShowLatest(false); }}>

                    {!visibleMessages.length ? (
                        <div className="flex min-h-full flex-col justify-center py-3">
                            <div className="rounded-xl border border-gray-200/90 bg-gray-50/60 p-4 dark:border-gh-border dark:bg-gh-subtle/40">
                                <h3 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">ERP Assistant</h3>
                                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gh-muted">
                                    Query real-time projects, inventory, material rates, vendor directories, or run cross-module operations.
                                    {preview ? ' (Preview mode).' : ''}
                                </p>
                            </div>

                            <div className="mt-4">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gh-muted">Suggested Questions</p>
                                <div className="space-y-1.5">
                                    {starterPrompts(context).map(prompt => (
                                        <button key={prompt} type="button" onClick={() => onPrompt(prompt)}
                                            className="w-full rounded-lg border border-gray-200/90 bg-white/90 p-2.5 text-left text-xs font-medium text-gray-700 shadow-2xs transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 dark:border-gh-border dark:bg-gh-subtle/50 dark:text-gh-text dark:hover:border-blue-700 dark:hover:bg-blue-950/30">
                                            <span className="line-clamp-2">{prompt}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <ol className="space-y-3" aria-label="Conversation messages">
                            {visibleMessages.map(message => (
                                <li key={message.id}>
                                    {message.kind === 'text' && (
                                        <>
                                            {message.role === 'user' ? (
                                                <div className="flex flex-col items-end">
                                                    <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gh-muted"><span>You</span></div>
                                                    <div className="max-w-[90%] rounded-2xl rounded-tr-xs bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-xs text-white shadow-sm shadow-blue-500/15 whitespace-pre-wrap break-words leading-relaxed">{message.text}</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-start w-full">
                                                    <div className="mb-1 flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] font-bold text-gray-800 dark:text-gh-text tracking-tight">{message.role === 'status' ? 'System Status' : 'ERP Assistant'}</span>
                                                        </div>
                                                        {message.text && !message.streaming && <CopyButton text={message.text} />}
                                                    </div>

                                                    {message.streaming && !message.text && showThinkingBlock && (
                                                        <div className="w-full mb-1.5">
                                                            <ThinkingBlock thinkingPhase={state.thinkingPhase} activeToolName={state.activeToolName} />
                                                        </div>
                                                    )}

                                                    {message.text && (
                                                        <div className="w-full rounded-xl rounded-tl-xs border border-gray-200/80 bg-white/95 p-2.5 sm:p-3 text-xs text-gray-800 shadow-2xs dark:border-gh-border/80 dark:bg-[#161b22]/80 dark:text-gh-text">
                                                            <StreamingResponse message={message} onStreamTick={handleStreamTick} onPrompt={onPrompt} />
                                                        </div>
                                                    )}

                                                    {shouldRenderResultCard(message.attachedResult || message.result) && (
                                                        <div className="mt-2 w-full">
                                                            <AgentResultCard result={message.attachedResult || message.result} preview={preview} onPrompt={onPrompt} />
                                                        </div>
                                                    )}

                                                    {message.context && debugMode && (
                                                        <p className="mt-1 text-[10px] text-gray-500 dark:text-gh-muted">
                                                            Context: {message.context.module}{message.context.projectId ? ` · Project ${message.context.projectId}` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {message.kind === 'action' && <AgentActionCard action={message.action} preview={preview} />}
                                    {message.kind === 'confirmation' && <AgentConfirmationCard message={message} pending={state.pending} busy={state.decisionBusy} onDecision={onDecision} preview={preview} />}
                                    {message.kind === 'result' && shouldRenderResultCard(message.result) && (
                                        <div className="flex flex-col items-start w-full">
                                            <div className="mb-1 flex items-center gap-1.5">
                                                <span className="text-[11px] font-bold text-gray-800 dark:text-gh-text tracking-tight">ERP Assistant</span>
                                            </div>
                                            <div className="w-full"><AgentResultCard result={message.result} preview={preview} onPrompt={onPrompt} /></div>
                                        </div>
                                    )}
                                    {message.kind === 'error' && <AgentErrorCard error={message.error} onRetry={onRetry} retryDisabled={!!state.activeRequestId} />}
                                    {debugMode && <AgentProvenance provenance={message.provenance} />}
                                </li>
                            ))}

                            {isAgentActive && !streamingMsg && (
                                <li>
                                    <div className="flex flex-col items-start w-full">
                                        <div className="mb-1 flex items-center gap-1.5">
                                            <span className="text-[11px] font-bold text-gray-800 dark:text-gh-text tracking-tight">ERP Assistant</span>
                                        </div>
                                        <ThinkingBlock thinkingPhase={state.thinkingPhase || 'thinking'} activeToolName={state.activeToolName} />
                                    </div>
                                </li>
                            )}
                        </ol>
                    )}
                </div>

                {showLatest && (
                    <button type="button"
                        className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-gray-300 bg-white/95 px-2.5 py-1 text-[11px] font-medium shadow-md hover:bg-gray-50 focus-visible:outline focus-visible:outline-blue-500 dark:border-gh-border dark:bg-gh-subtle/95"
                        onClick={() => { following.current = true; scrollRef.current.scrollTop = scrollRef.current.scrollHeight; setShowLatest(false); }}>
                        <ArrowDown size={12} aria-hidden="true" />
                        <span>Latest message</span>
                    </button>
                )}
            </div>
        </>
    );
}