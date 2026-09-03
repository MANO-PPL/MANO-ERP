import { BUSY_STATES, isAgentEvent, isExpired, safeError } from './agentModel.js';

export function initialAgentState(conversationId) {
    return { conversationId, messages: [], status: 'idle', activeRequestId: null, request: null,
        seenEvents: [], pending: null, decisionBusy: false, error: null };
}
export const canSend = state => !BUSY_STATES.has(state.status) && !state.activeRequestId && !state.pending;
const retireConfirmations = messages => messages.map(message => message.kind === 'confirmation' && !message.decision
    ? { ...message, unavailable: true } : message);
const finishInterruptedMessages = messages => retireConfirmations(messages).map(message => message.streaming
    ? { ...message, streaming: false, text: message.text || 'Response interrupted.' } : message);

export function agentReducer(state, action) {
    if (action.type === 'reset') return initialAgentState(action.conversationId);
    if (action.type === 'start') {
        if (!canSend(state)) return state;
        return { ...state, status: 'submitting', activeRequestId: action.requestId, request: action.request,
            error: null, pending: null, decisionBusy: false, seenEvents: [],
            messages: action.retry ? state.messages.filter(message => message.kind !== 'error')
                : [...state.messages, { id: action.requestId, role: 'user', kind: 'text', text: action.request.message,
                    context: action.request.context }] };
    }
    if (action.type === 'decision_start') {
        if (!state.pending || state.decisionBusy || state.pending.confirmationId !== action.confirmationId
            || (action.decision === 'confirm' && isExpired(state.pending, action.now))) return state;
        return { ...state, decisionBusy: true };
    }
    if (action.type === 'cancel_response') {
        if (state.activeRequestId !== action.requestId) return state;
        return { ...state, status: 'cancelled', activeRequestId: null, pending: null, decisionBusy: false,
            messages: [...finishInterruptedMessages(state.messages), { id: `${action.requestId}-stopped`, role: 'status',
                kind: 'text', text: 'Response stopped. This does not confirm cancellation of any ERP operation.' }] };
    }
    if (action.type === 'failure') {
        if (state.activeRequestId !== action.requestId) return state;
        const error = safeError(action.error);
        return { ...state, status: 'error', activeRequestId: null, pending: null, decisionBusy: false, error,
            messages: [...finishInterruptedMessages(state.messages), { id: `${action.requestId}-error`, kind: 'error', error }] };
    }
    if (action.type !== 'event') return state;
    const event = action.event;
    if (!isAgentEvent(event) || event.conversationId !== state.conversationId
        || event.requestId !== state.activeRequestId || state.seenEvents.includes(event.eventId)) return state;
    const next = { ...state, seenEvents: [...state.seenEvents, event.eventId] };
    const append = message => ({ ...next, messages: [...state.messages, message] });
    switch (event.type) {
        case 'message_started':
            if (state.messages.some(message => message.id === event.messageId)) return next;
            return { ...append({ id: event.messageId, role: event.role, kind: 'text', text: '', streaming: true }),
                status: state.pending ? 'waiting_for_confirmation' : 'thinking' };
        case 'text_delta':
            return { ...next, messages: state.messages.map(message => message.id === event.messageId && message.streaming
                ? { ...message, text: message.text + event.delta } : message) };
        case 'text_completed':
            return { ...next, messages: state.messages.map(message => message.id === event.messageId
                ? { ...message, text: event.text, streaming: false, result: event.result, provenance: event.provenance } : message) };
        case 'tool_proposed':
            return append({ id: event.eventId, kind: 'action', actionId: event.actionId, action: event.action });
        case 'confirmation_required':
            if (state.pending || state.messages.some(message => message.confirmation?.confirmationId === event.confirmation.confirmationId)) return next;
            return { ...append({ id: event.eventId, kind: 'confirmation', confirmation: event.confirmation }),
                pending: event.confirmation, status: 'waiting_for_confirmation' };
        case 'confirmation_resolved':
            if (state.pending?.confirmationId !== event.confirmationId) return next;
            return { ...next, pending: null, decisionBusy: false, status: 'thinking', messages: state.messages.map(message =>
                message.confirmation?.confirmationId === event.confirmationId ? { ...message, decision: event.decision } : message) };
        case 'tool_started': return { ...next, status: state.pending ? 'waiting_for_confirmation' : 'executing' };
        case 'tool_completed': return append({ id: event.eventId, kind: 'result', result: event.result, provenance: event.provenance });
        case 'tool_failed':
        case 'agent_error': return agentReducer(next, { type: 'failure', requestId: event.requestId, error: event.error });
        case 'conversation_completed':
            if (state.pending) return next;
            return { ...next, status: 'completed', activeRequestId: null, messages: state.messages.map(message => ({ ...message, streaming: false })) };
        default: return state;
    }
}
