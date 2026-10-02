import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import AgentPanel from './AgentPanel.jsx';
import { agentReducer, canSend, initialAgentState } from './agentReducer.js';
import { createDecision, isAgentEvent, isExpired, isPreviewEvent } from './agentModel.js';
import { extractAgentContext, projectDisplay, getNavigationTrail } from './agentContext.js';
import { previewTransport } from './agentTransport.js';

const makeId = () => crypto.randomUUID();

/**
 * Persistent Agent Shell container providing drawer toggles, entity context propagation,
 * and dispatch bridge across project and system views.
 */
export default function AgentShell({ transport = previewTransport }) {
    const location = useLocation();
    const [entityMeta, setEntityMeta] = useState(null);

    useEffect(() => {
        const onEntityUpdate = event => {
            if (event.detail && typeof event.detail === 'object') {
                setEntityMeta(event.detail);
            } else {
                setEntityMeta(null);
            }
        };
        window.addEventListener('active-entity-updated', onEntityUpdate);
        return () => window.removeEventListener('active-entity-updated', onEntityUpdate);
    }, []);

    useEffect(() => {
        setEntityMeta(null);
    }, [location.pathname]);

    const context = useMemo(() => {
        let recentRoutes = [];
        try { recentRoutes = getNavigationTrail(window.sessionStorage); } catch { /* ignore */ }
        return extractAgentContext(location, {
            ...(entityMeta || {}),
            recentRoutes
        });
    }, [location.pathname, location.search, entityMeta]);
    const [projectName, setProjectName] = useState(null);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [attachmentError, setAttachmentError] = useState('');
    const [state, reactDispatch] = useReducer(agentReducer, undefined, () => initialAgentState(makeId()));
    const stateRef = useRef(state);
    const activeRef = useRef(null);
    const mountedRef = useRef(true);
    const launcherRef = useRef(null);
    const inputRef = useRef(null);

    const handleAttachFile = async (file, { approvedForAgentWrite = false } = {}) => {
        if (!file) return;
        setAttachmentError('');
        if (!/\.(csv|xlsx|xls|pdf|doc|docx|jpg|jpeg|png|webp)$/i.test(file.name)) {
            setAttachmentError('Choose a spreadsheet, PDF, Word document, or image file.');
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            setAttachmentError('The file must be smaller than 15 MB.');
            return;
        }
        setUploading(true);
        try {
            if (typeof transport.uploadFile === 'function') {
                const result = await transport.uploadFile(file, { approvedForAgentWrite });
                setAttachment({ file, uploadInfo: result });
            } else {
                // Preview mode fallback: this remains disconnected and never
                // represents a persisted ERP attachment.
                const isSpreadsheet = /\.(csv|xlsx|xls)$/i.test(file.name);
                setAttachment({
                    file,
                    uploadInfo: isSpreadsheet
                        ? { uploadId: crypto.randomUUID(), kind: 'spreadsheet', filename: file.name, sheetName: 'Sheet1', totalRows: 25,
                            headers: ['Vendor Name', 'Contact Person', 'Phone', 'Category', 'Address'], preview: [] }
                        : { uploadId: crypto.randomUUID(), kind: 'attachment', filename: file.name, mimeType: file.type || 'application/octet-stream',
                            size: file.size, approvedForAgentWrite }
                });
            }
        } catch (err) {
            setAttachmentError(err.message === 'authorization_denied'
                ? 'Attachment upload was denied. Please sign in again and retry.'
                : err.message === 'file_size_exceeded' ? 'The file must be smaller than 15 MB.'
                : 'Could not attach this file. Check its format and try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveAttachment = () => {
        setAttachment(null);
        setAttachmentError('');
    };

    // Update the guard synchronously: two clicks in one render cannot start two requests.
    const dispatch = useCallback(action => {
        if (!mountedRef.current) return;
        stateRef.current = agentReducer(stateRef.current, action);
        reactDispatch(action);
    }, []);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; activeRef.current?.controller.abort(); };
    }, []);
    useEffect(() => {
        let storage;
        try { storage = window.sessionStorage; } catch { /* Storage can be disabled. */ }
        setProjectName({ id: context.projectId, name: projectDisplay(context, storage) });
        const onUpdate = event => {
            if (String(event.detail?.id) === context.projectId) setProjectName({ id: context.projectId, name: projectDisplay(context, storage, event.detail) });
        };
        window.addEventListener('active-project-updated', onUpdate);
        return () => window.removeEventListener('active-project-updated', onUpdate);
    }, [context]);


    const receive = useCallback(event => {
        if (!mountedRef.current || event?.requestId !== stateRef.current.activeRequestId
            || event?.conversationId !== stateRef.current.conversationId) return;
        if (!isAgentEvent(event) ||
            (transport.mode === 'preview' && !isPreviewEvent(event))) {
            dispatch({ type: 'failure', requestId: event.requestId, error: { code: 'protocol_error' } });
            return;
        }
        dispatch({ type: 'event', event });
    }, [dispatch, transport]);

    const submit = async (retry = false) => {
        const current = stateRef.current;
        if (!canSend(current) || (retry && !current.error?.retryable)) return;
        const message = retry ? current.request?.message : (draft.trim() || (attachment
            ? (attachment.uploadInfo?.kind === 'attachment' ? 'Use the attached approved quality file.' : 'Please import these vendors into our system from the attached spreadsheet.') : ''));
        if (!message) return;
        const activeProjectName = (context.projectId && projectName?.id === context.projectId) ? projectName?.name : null;
        const requestContext = activeProjectName ? { ...context, projectName: activeProjectName } : { ...context };
        const request = retry ? current.request : {
            conversationId: current.conversationId,
            message,
            context: requestContext,
            ...(attachment?.uploadInfo ? {
                attachment: attachment.uploadInfo.kind === 'attachment'
                    ? { uploadId: attachment.uploadInfo.uploadId, filename: attachment.uploadInfo.filename, kind: 'attachment',
                        mimeType: attachment.uploadInfo.mimeType, size: attachment.uploadInfo.size,
                        approvedForAgentWrite: attachment.uploadInfo.approvedForAgentWrite === true }
                    : { uploadId: attachment.uploadInfo.uploadId, filename: attachment.uploadInfo.filename, kind: 'spreadsheet',
                        sheetName: attachment.uploadInfo.sheetName || 'Sheet1', totalRows: attachment.uploadInfo.totalRows,
                        headers: attachment.uploadInfo.headers, preview: attachment.uploadInfo.preview || [] }
            } : {})
        };
        const requestId = makeId();
        const controller = new AbortController();
        activeRef.current?.controller.abort();
        activeRef.current = { requestId, controller };
        dispatch({ type: 'start', requestId, request, retry });
        if (!retry) {
            setDraft('');
            setAttachment(null);
        }
        try {
            await transport.send(request, { requestId, conversationId: request.conversationId, signal: controller.signal, onEvent: receive });
            if (!controller.signal.aborted && stateRef.current.activeRequestId === requestId && !stateRef.current.pending) {
                dispatch({ type: 'failure', requestId, error: { code: 'protocol_error' } });
            }
        } catch {
            if (!controller.signal.aborted) dispatch({ type: 'failure', requestId, error: { code: 'network_failure' } });
        }
    };
    const decide = async (confirmationId, decision, confirmationText) => {
        const current = stateRef.current;
        if (current.pending?.confirmationId !== confirmationId || current.decisionBusy || !current.activeRequestId
            || (decision === 'confirm' && isExpired(current.pending))) return;
        const payload = createDecision(confirmationId, decision, confirmationText);
        dispatch({ type: 'decision_start', ...payload, now: Date.now() });
        const { controller, requestId } = activeRef.current;
        try {
            await transport.decide(payload, { requestId, conversationId: current.conversationId, signal: controller.signal, onEvent: receive });
            if (!controller.signal.aborted && stateRef.current.decisionBusy) dispatch({ type: 'failure', requestId, error: { code: 'protocol_error' } });
        } catch {
            if (!controller.signal.aborted) dispatch({ type: 'failure', requestId, error: { code: 'network_failure' } });
        }
    };
    const close = useCallback(() => setOpen(false), []);
    return <>
        <button ref={launcherRef} type="button" aria-label={open ? 'Close ERP Assistant' : 'Open ERP Assistant'} aria-expanded={open}
            aria-controls="erp-agent-panel" onClick={() => { setOpen(value => !value); }}
            className={`fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-11 items-center gap-2.5 rounded-xl border border-blue-500/40 bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-150 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/30 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${open ? 'invisible' : ''}`}>
            <span className="flex h-2 w-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            </span>
            <MessageSquare size={16} aria-hidden="true" />
            <span>ERP Assistant</span>
        </button>
        <AgentPanel open={open} onClose={close} launcherRef={launcherRef} inputRef={inputRef} context={context}
            projectName={(context.projectId && projectName?.id === context.projectId) ? projectName?.name : null} state={state} draft={draft} onDraft={setDraft} onSend={() => submit(false)} onRetry={() => submit(true)}
            onDecision={decide} transport={transport}
            onClearEntityContext={() => setEntityMeta(null)}
            attachment={attachment} attachmentError={attachmentError} onAttachFile={handleAttachFile} onRemoveAttachment={handleRemoveAttachment} uploading={uploading}
            onNew={() => {
                if (!canSend(stateRef.current)) return;
                activeRef.current?.controller.abort();
                dispatch({ type: 'reset', conversationId: makeId() }); setDraft(''); setAttachment(null); inputRef.current?.focus();
            }} onStop={() => {
                if (!transport.supportsStop || !stateRef.current.activeRequestId || stateRef.current.pending || stateRef.current.status === 'executing') return;
                activeRef.current?.controller.abort();
                dispatch({ type: 'cancel_response', requestId: stateRef.current.activeRequestId });
            }} />
    </>;
}
