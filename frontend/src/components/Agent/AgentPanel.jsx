import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Loader2 } from 'lucide-react';
import AgentConversation from './AgentConversation.jsx';
import AgentComposer from './AgentComposer.jsx';
import { canSend } from './agentReducer.js';

export default function AgentPanel({ open, onClose, launcherRef, inputRef, context, projectName, state, draft,
    onDraft, onSend, onNew, onDecision, onRetry, transport, onStop,
    attachment, onAttachFile, onRemoveAttachment, uploading, onClearEntityContext }) {
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const pointerDownTargetRef = useRef(null);
    const [debugMode, setDebugMode] = useState(false);

    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (!open) { if (dialog.open) dialog.close(); return; }
        if (dialog.open) dialog.close();
        dialog.showModal();
        closeRef.current?.focus();
        return () => { dialog.close(); launcherRef.current?.focus(); };
    }, [open, launcherRef]);

    const preview = transport.mode !== 'connected';
    const latest    = [...state.messages].reverse().find(message => message.role === 'assistant' && !message.streaming);
    const isWorking = state.status === 'submitting' || state.status === 'thinking' || state.status === 'executing';

    return createPortal(<dialog ref={dialogRef} id="erp-agent-panel" aria-labelledby="erp-agent-title"
        aria-modal={open ? 'true' : undefined}
        onCancel={event => { event.preventDefault(); onClose(); }}
        onPointerDown={event => {
            pointerDownTargetRef.current = event.target;
        }}
        onTouchStart={event => {
            pointerDownTargetRef.current = event.target;
        }}
        onTouchEnd={event => {
            if (event.target === dialogRef.current && pointerDownTargetRef.current === dialogRef.current && event.changedTouches?.length > 0) {
                const touch = event.changedTouches[0];
                const rect = dialogRef.current.getBoundingClientRect();
                const isOutside =
                    touch.clientX < rect.left ||
                    touch.clientX > rect.right ||
                    touch.clientY < rect.top ||
                    touch.clientY > rect.bottom;
                if (isOutside) {
                    onClose();
                }
            }
        }}
        onClick={event => {
            if (event.target === dialogRef.current && pointerDownTargetRef.current === dialogRef.current) {
                const rect = dialogRef.current.getBoundingClientRect();
                const isOutside =
                    event.clientX < rect.left ||
                    event.clientX > rect.right ||
                    event.clientY < rect.top ||
                    event.clientY > rect.bottom;
                if (isOutside) {
                    onClose();
                }
            }
        }}
        onKeyDown={event => {
            if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose(); }
            if (event.key === 'Tab' && !event.defaultPrevented) {
                const controls = [...dialogRef.current.querySelectorAll('button:not([disabled]), textarea:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])')]
                    .filter(element => element.getClientRects().length > 0);
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        }}
        className={`${open ? 'flex' : 'hidden'} fixed right-0 top-0 bottom-0 z-50 m-0 h-screen h-dvh max-h-none flex-col overflow-hidden border-0 border-l border-gray-200 bg-white p-0 text-gray-900 shadow-2xl outline-none backdrop:bg-black/40 backdrop:backdrop-blur-xs dark:border-gh-border dark:bg-gh-bg dark:text-gh-text`}
        style={{ width: '50vw', maxWidth: '50vw', left: 'auto', right: 0, margin: 0 }}>
        

        {/* Header */}
        <header className="shrink-0 border-b border-gray-200/90 bg-white/95 px-3.5 py-2 backdrop-blur-md dark:border-gh-border dark:bg-gh-bg/95">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <h2 id="erp-agent-title" className="text-sm font-bold tracking-tight text-gray-900 dark:text-white truncate">
                        ERP Assistant
                    </h2>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${preview ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {isWorking && <Loader2 size={11} className="animate-spin text-blue-500 dark:text-blue-400" aria-hidden="true" />}
                    {context.projectId && (
                        <span className="hidden sm:inline max-w-[140px] truncate rounded border border-blue-200 bg-blue-50/70 px-1.5 py-0.5 font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 text-[10px]">
                            {projectName || context.projectId}
                        </span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button type="button"
                        onClick={() => setDebugMode(v => !v)}
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${debugMode ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'border-gray-200 bg-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-muted dark:hover:bg-gh-hover'}`}
                        title="Toggle developer debug mode">
                        {debugMode ? 'Debug: ON' : 'Debug'}
                    </button>
                    <button type="button"
                        onClick={onNew}
                        disabled={!canSend(state) || !state.messages.length}
                        aria-label="New conversation"
                        title="New conversation"
                        className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50/70 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gh-border dark:bg-gh-subtle dark:text-gh-muted dark:hover:bg-gh-hover dark:hover:text-gh-text transition-all">
                        <Plus size={13} aria-hidden="true" />
                        <span>New</span>
                    </button>
                    <button ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Close ERP Assistant"
                        title="Close assistant (Esc)"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gh-muted dark:hover:bg-gh-hover dark:hover:text-white transition-colors">
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </header>

        {/* Conversation — flex-1 fills all remaining space */}
        <div id="panel-chat" role="region" aria-label="Conversation" className="flex flex-1 flex-col overflow-hidden">
            <AgentConversation
                state={state}
                context={context}
                debugMode={debugMode}
                onPrompt={prompt => { onDraft(prompt); inputRef.current?.focus(); }}
                onDecision={onDecision}
                onRetry={onRetry}
                preview={preview}
            />
            <div className="sr-only" aria-live="polite" aria-atomic="true">{latest ? <span key={latest.id}>ERP Assistant: {latest.text}</span> : null}</div>
        </div>

        {/* Bottom Composer */}
        <AgentComposer draft={draft} onDraft={onDraft} onSend={onSend} blocked={!canSend(state)} inputRef={inputRef}
            preview={preview}
            attachment={attachment} onAttachFile={onAttachFile} onRemoveAttachment={onRemoveAttachment} uploading={uploading}
            canStop={transport.supportsStop && !!state.activeRequestId && !state.pending && state.status !== 'executing'} onStop={onStop} />
    </dialog>, document.body);
}
