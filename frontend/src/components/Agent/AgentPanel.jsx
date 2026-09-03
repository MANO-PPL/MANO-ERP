import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, MessageSquare, Unplug } from 'lucide-react';
import AgentConversation from './AgentConversation.jsx';
import AgentComposer from './AgentComposer.jsx';
import { canSend } from './agentReducer.js';

const STATUS = { idle: 'Ready for a preview', submitting: 'Submitting request…', thinking: 'Preparing response…',
    waiting_for_confirmation: 'Waiting for confirmation', executing: 'Execution reported in progress',
    completed: 'Response complete', error: 'Request needs attention', cancelled: 'Response stopped' };
const iconButton = 'rounded-md p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40 dark:text-gh-muted dark:hover:bg-gh-hover';

export default function AgentPanel({ open, onClose, launcherRef, inputRef, context, projectName, state, draft,
    onDraft, onSend, onNew, onDecision, onRetry, transport, onStop }) {
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
    useEffect(() => {
        const query = window.matchMedia('(max-width: 1023px)');
        const update = () => setCompact(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (!open) { if (dialog.open) dialog.close(); return; }
        if (dialog.open) dialog.close();
        if (compact) dialog.showModal(); else dialog.show();
        (compact ? closeRef.current : inputRef.current)?.focus();
        return () => { dialog.close(); launcherRef.current?.focus(); };
    }, [open, compact, inputRef, launcherRef]);
    const preview = transport.mode !== 'connected';
    const latest = [...state.messages].reverse().find(message => message.role === 'assistant' && !message.streaming);
    return createPortal(<dialog ref={dialogRef} id="erp-agent-panel" aria-labelledby="erp-agent-title"
        aria-modal={compact && open ? 'true' : undefined}
        onCancel={event => { event.preventDefault(); onClose(); }}
        onKeyDown={event => {
            if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose(); }
            if (compact && event.key === 'Tab' && !event.defaultPrevented) {
                const controls = [...dialogRef.current.querySelectorAll('button:not([disabled]), textarea:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])')]
                    .filter(element => element.getClientRects().length > 0);
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        }}
        className={`${open ? 'flex' : 'hidden'} fixed inset-auto right-0 top-0 z-40 m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-hidden border-0 bg-white p-0 text-gray-900 shadow-xl outline-none backdrop:bg-black/30 dark:bg-gh-bg dark:text-gh-text lg:top-[44px] lg:h-[calc(100dvh-44px)] lg:w-[440px] lg:border-l lg:border-gray-200 dark:lg:border-gh-border`}>
        <header className="shrink-0 border-b border-gray-200 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] dark:border-gh-border">
            <div className="flex items-center justify-between gap-2">
                <h2 id="erp-agent-title" className="flex items-center gap-2 text-sm font-semibold"><MessageSquare size={18} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />ERP Assistant</h2>
                <div className="flex shrink-0 items-center">
                    <button type="button" className={iconButton} onClick={onNew} disabled={!canSend(state) || !state.messages.length} aria-label="New conversation" title="New conversation"><Plus size={18} aria-hidden="true" /></button>
                    <button ref={closeRef} type="button" className={iconButton} onClick={onClose} aria-label="Close ERP Assistant"><X size={19} aria-hidden="true" /></button>
                </div>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gh-muted"><Unplug size={12} aria-hidden="true" />{transport.mode === 'fixture' ? 'Simulation · Test fixtures only' : preview ? 'Agent backend not connected' : 'Agent service connected'}</p>
            <div className="mt-3 rounded-md bg-gray-50 px-2.5 py-2 text-xs leading-relaxed dark:bg-gh-subtle">
                <p className="text-[10px] text-gray-500 dark:text-gh-muted">Working in</p>
                {context.projectId && <p className="break-words font-medium">Project: {projectName || context.projectId}</p>}
                <p className="break-words">{context.module}</p>
            </div>
        </header>
        <AgentConversation state={state} context={context} onPrompt={prompt => { onDraft(prompt); inputRef.current?.focus(); }} onDecision={onDecision} onRetry={onRetry} preview={preview} />
        <div className="shrink-0 px-4 pb-2 text-[11px] text-gray-500 dark:text-gh-muted" role="status" aria-live="polite" aria-atomic="true">{STATUS[state.status]}</div>
        <div className="sr-only" aria-live="polite" aria-atomic="true">{latest ? <span key={latest.id}>ERP Assistant: {latest.text}</span> : null}</div>
        <AgentComposer draft={draft} onDraft={onDraft} onSend={onSend} blocked={!canSend(state)} inputRef={inputRef}
            preview={preview}
            canStop={transport.supportsStop && !!state.activeRequestId && !state.pending && state.status !== 'executing'} onStop={onStop} />
    </dialog>, document.body);
}
