import React, { useRef, useState } from 'react';
import { ArrowUp, Square, Paperclip, FileSpreadsheet, File, X, Loader2 } from 'lucide-react';

/**
 * Prompt input composer supporting file attachments, question submission, and cancellation.
 */
export default function AgentComposer({
    draft,
    onDraft,
    onSend,
    blocked,
    decisionReply = false,
    inputRef,
    canStop,
    onStop,
    preview,
    attachment,
    attachmentError,
    onAttachFile,
    onRemoveAttachment,
    uploading
}) {
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [approvedForAgentWrite, setApprovedForAgentWrite] = useState(false);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!blocked && !decisionReply && !uploading) setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (blocked || decisionReply || uploading) return;
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile && onAttachFile) {
            onAttachFile(droppedFile, { approvedForAgentWrite });
        }
    };

    return (
        <form className="shrink-0 border-t border-gray-200/90 bg-white/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md dark:border-gh-border dark:bg-gh-bg/95"
            onSubmit={event => { event.preventDefault(); onSend(); }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}>
            
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => {
                    if (!decisionReply && e.target.files?.[0] && onAttachFile) {
                        onAttachFile(e.target.files[0], { approvedForAgentWrite });
                    }
                    e.target.value = '';
                }}
            />

            {/* Accessible label required for accessibility and harness test inspection */}
            <label htmlFor="erp-agent-input" className="sr-only">What would you like help with?</label>

            <div className={`rounded-xl border transition-all ${isDragging
                ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                : 'border-gray-300/80 bg-gray-50/60 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-gh-border dark:bg-gh-input dark:focus-within:border-blue-500 dark:focus-within:bg-gh-subtle'}`}>

                {attachmentError && <p role="alert" className="mx-2.5 mt-2 text-xs text-red-600 dark:text-red-400">{attachmentError}</p>}
                {/* Uploading progress indicator */}
                {uploading && (
                    <div className="mx-2.5 mt-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1.5 text-xs text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                        <Loader2 size={13} className="animate-spin text-blue-600 dark:text-blue-400" />
                        <span>Preparing the attachment…</span>
                    </div>
                )}

                {/* Attached file chip */}
                {attachment && !uploading && (
                    <div className="mx-2.5 mt-2 flex items-center justify-between gap-2 rounded-lg border border-blue-200/90 bg-blue-50/80 px-2.5 py-1.5 text-xs text-blue-900 dark:border-blue-800/80 dark:bg-blue-950/40 dark:text-blue-200">
                        <div className="flex items-center gap-2 overflow-hidden min-w-0">
                            {attachment.uploadInfo?.kind === 'attachment' ? <File size={15} className="shrink-0 text-blue-600 dark:text-blue-400" /> : <FileSpreadsheet size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />}
                            <span className="truncate font-semibold">{attachment.uploadInfo?.filename || attachment.file?.name}</span>
                            {attachment.uploadInfo?.totalRows && (
                                <span className="shrink-0 rounded bg-blue-200/80 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                    {attachment.uploadInfo.totalRows} rows
                                </span>
                            )}
                            {attachment.uploadInfo?.kind === 'attachment' && (
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${attachment.uploadInfo.approvedForAgentWrite
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'}`}>
                                    {attachment.uploadInfo.approvedForAgentWrite ? 'Approved' : 'Not approved'}
                                </span>
                            )}
                        </div>
                        <button type="button" onClick={onRemoveAttachment} aria-label="Remove attached file"
                            className="shrink-0 rounded p-1 text-blue-600 hover:bg-blue-200/60 dark:text-blue-400 dark:hover:bg-blue-900/60 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                )}

                <textarea ref={inputRef} id="erp-agent-input" rows={1} maxLength={8000} value={draft}
                    onChange={event => onDraft(event.target.value)}
                    placeholder={decisionReply ? "Reply yes to confirm or no to cancel…" : attachment ? "Tell the assistant how to handle this file…" : "Ask about projects, inventory, vendors…"}
                    aria-describedby="erp-agent-input-help"
                    className="block max-h-28 min-h-[40px] w-full resize-none bg-transparent px-3 pt-2 text-xs sm:text-sm leading-relaxed outline-none placeholder:text-gray-400 dark:placeholder:text-gh-muted"
                    onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                            event.preventDefault();
                            if (!blocked && (draft.trim() || attachment)) onSend();
                        }
                    }} />
                
                <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-1 border-t border-gray-200/40 dark:border-gh-border/40">
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gh-muted">
                            <input type="checkbox" checked={approvedForAgentWrite} onChange={event => setApprovedForAgentWrite(event.target.checked)}
                                className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            Approved quality file
                        </label>
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={blocked || decisionReply || uploading}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-200/60 hover:text-gray-800 dark:text-gh-muted dark:hover:bg-gh-hover dark:hover:text-gh-text transition-colors disabled:opacity-50"
                            title="Attach a spreadsheet, approved quality document, or resolution image">
                            <Paperclip size={13} />
                            <span>Attach file</span>
                        </button>
                    </div>

                    {canStop ? (
                        <button key="stop" type="button" aria-label="Stop response"
                            onClick={event => { event.preventDefault(); onStop(); }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 transition-all"
                            title="Stop generation">
                            <Square size={13} aria-hidden="true" />
                        </button>
                    ) : (
                        <button key="send" type="submit" disabled={blocked || (!draft.trim() && !attachment) || uploading} aria-label="Send task"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs transition-all hover:bg-blue-700 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gh-hover dark:disabled:text-gh-muted">
                            <ArrowUp size={15} aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

        </form>
    );
}
