import React, { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { agentReducer, canSend, initialAgentState } from './agentReducer.js';
import { createDecision, isAgentEvent, isExpired, isPreviewEvent } from './agentModel.js';
import { extractAgentContext, projectDisplay } from './agentContext.js';
import { previewTransport } from './agentTransport.js';

const AgentPanel = lazy(() => import('./AgentPanel.jsx'));
const makeId = () => crypto.randomUUID();

export default function AgentShell({ transport = previewTransport }) {
    const location = useLocation();
    const context = useMemo(() => extractAgentContext(location), [location.pathname, location.search]);
    const [projectName, setProjectName] = useState(null);
    const [open, setOpen] = useState(false);
    const [visited, setVisited] = useState(false);
    const [draft, setDraft] = useState('');
    const [state, reactDispatch] = useReducer(agentReducer, undefined, () => initialAgentState(makeId()));
    const stateRef = useRef(state);
    const activeRef = useRef(null);
    const mountedRef = useRef(true);
    const launcherRef = useRef(null);
    const inputRef = useRef(null);
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
        if (!isAgentEvent(event) || (transport.mode === 'preview' && !isPreviewEvent(event))) {
            dispatch({ type: 'failure', requestId: event.requestId, error: { code: 'protocol_error' } });
            return;
        }
        dispatch({ type: 'event', event });
    }, [dispatch, transport]);

    const submit = async (retry = false) => {
        const current = stateRef.current;
        if (!canSend(current) || (retry && !current.error?.retryable)) return;
        const message = retry ? current.request?.message : draft.trim();
        if (!message) return;
        const request = retry ? current.request : { conversationId: current.conversationId, message, context: { ...context } };
        const requestId = makeId();
        const controller = new AbortController();
        activeRef.current?.controller.abort();
        activeRef.current = { requestId, controller };
        dispatch({ type: 'start', requestId, request, retry });
        if (!retry) setDraft('');
        try {
            await transport.send(request, { requestId, conversationId: request.conversationId, signal: controller.signal, onEvent: receive });
            if (!controller.signal.aborted && stateRef.current.activeRequestId === requestId && !stateRef.current.pending) {
                dispatch({ type: 'failure', requestId, error: { code: 'protocol_error' } });
            }
        } catch {
            if (!controller.signal.aborted) dispatch({ type: 'failure', requestId, error: { code: 'network_failure' } });
        }
    };
    const decide = async (confirmationId, decision) => {
        const current = stateRef.current;
        if (current.pending?.confirmationId !== confirmationId || current.decisionBusy || !current.activeRequestId
            || (decision === 'confirm' && isExpired(current.pending))) return;
        const payload = createDecision(confirmationId, decision);
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
            aria-controls={visited ? 'erp-agent-panel' : undefined} onClick={() => { setVisited(true); setOpen(value => !value); }}
            className={`fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-11 items-center gap-2 rounded-lg border border-blue-700 bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${open ? 'invisible' : ''}`}>
            <MessageSquare size={18} aria-hidden="true" />ERP Assistant
        </button>
        {visited && <Suspense fallback={open ? <div role="status" className="fixed bottom-20 right-4 z-40 rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gh-border dark:bg-gh-subtle">Opening assistant… <button type="button" className="ml-2 underline" onClick={close}>Cancel</button></div> : null}>
            <AgentPanel open={open} onClose={close} launcherRef={launcherRef} inputRef={inputRef} context={context}
                projectName={projectName?.id === context.projectId ? projectName.name : null} state={state} draft={draft} onDraft={setDraft} onSend={() => submit(false)} onRetry={() => submit(true)}
                onDecision={decide} transport={transport} onNew={() => {
                    if (!canSend(stateRef.current)) return;
                    activeRef.current?.controller.abort();
                    dispatch({ type: 'reset', conversationId: makeId() }); setDraft(''); inputRef.current?.focus();
                }} onStop={() => {
                    if (!transport.supportsStop || !stateRef.current.activeRequestId || stateRef.current.pending || stateRef.current.status === 'executing') return;
                    activeRef.current?.controller.abort();
                    dispatch({ type: 'cancel_response', requestId: stateRef.current.activeRequestId });
                }} />
        </Suspense>}
    </>;
}
