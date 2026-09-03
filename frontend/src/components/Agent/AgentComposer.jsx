import React from 'react';
import { ArrowUp, Square } from 'lucide-react';

export default function AgentComposer({ draft, onDraft, onSend, blocked, inputRef, canStop, onStop, preview }) {
    return <form className="shrink-0 border-t border-gray-200 bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 dark:border-gh-border dark:bg-gh-bg"
        onSubmit={event => { event.preventDefault(); onSend(); }}>
        <label htmlFor="erp-agent-input" className="mb-2 block text-xs font-medium">What would you like help with?</label>
        <div className="rounded-lg border border-gray-300 bg-gray-50 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-gh-border dark:bg-gh-input">
            <textarea ref={inputRef} id="erp-agent-input" rows={3} maxLength={8000} value={draft}
                onChange={event => onDraft(event.target.value)} placeholder="Ask about your ERP workspace…"
                aria-describedby="erp-agent-input-help" className="block max-h-40 min-h-20 w-full resize-y rounded-t-lg bg-transparent px-3 pt-3 text-base leading-relaxed outline-none lg:text-sm"
                onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                        event.preventDefault();
                        if (!blocked) onSend();
                    }
                }} />
            <div className="flex items-center justify-between gap-2 p-2">
                <p id="erp-agent-input-help" className="pl-1 text-[11px] text-gray-500 dark:text-gh-muted">{blocked ? 'Wait for the current request or confirmation.' : 'Enter to send · Shift+Enter for a new line'}</p>
                {canStop ? <button key="stop" type="button" aria-label="Stop response" onClick={event => { event.preventDefault(); onStop(); }} className="rounded-md border border-gray-300 p-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-gh-border"><Square size={16} aria-hidden="true" /></button>
                    : <button key="send" type="submit" disabled={blocked || !draft.trim()} aria-label="Send task" className="rounded-md bg-blue-600 p-2.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gh-hover"><ArrowUp size={18} aria-hidden="true" /></button>}
            </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gh-muted">{preview ? 'Preview mode. No ERP data is read or changed.' : 'Review proposed actions before confirming.'}</p>
    </form>;
}
