import { BUSY_STATES, isAgentEvent, isExpired, safeError } from './agentModel.js';

export function initialAgentState(conversationId) {
    return { conversationId, messages: [], status: 'idle', activeRequestId: null, request: null,
        seenEvents: [], pending: null, decisionBusy: false, error: null,
        // thinkingPhase: 'thinking' | 'executing' | 'writing' | null
        thinkingPhase: null, activeToolName: null };
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
            thinkingPhase: 'thinking', activeToolName: null,
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
            thinkingPhase: null, activeToolName: null,
            messages: [...finishInterruptedMessages(state.messages), { id: `${action.requestId}-stopped`, role: 'status',
                kind: 'text', text: 'Response stopped. This does not confirm cancellation of any ERP operation.' }] };
    }
    if (action.type === 'failure') {
        if (state.activeRequestId !== action.requestId) return state;
        const error = safeError(action.error);
        return { ...state, status: 'error', activeRequestId: null, pending: null, decisionBusy: false, error,
            thinkingPhase: null, activeToolName: null,
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
                status: state.pending ? 'waiting_for_confirmation' : 'thinking',
                thinkingPhase: 'thinking', activeToolName: null };
        case 'text_delta':
            return { ...next,
                thinkingPhase: 'writing',
                messages: state.messages.map(message => message.id === event.messageId && message.streaming
                    ? { ...message, text: message.text + event.delta } : message) };
        case 'text_completed':
            return { ...next, messages: state.messages.map(message => message.id === event.messageId
                ? { ...message, text: event.text, streaming: false, result: event.result, trace: event.trace, provenance: event.provenance } : message) };
        case 'tool_proposed': {
            const aid = event.actionId || event.toolId;
            // simulation emits tool_proposed with name+input rather than action object
            if (!event.action && event.name) return { ...next, thinkingPhase: 'executing', activeToolName: event.name };
            return append({ id: event.eventId, kind: 'action', actionId: aid, action: event.action });
        }
        case 'confirmation_required':
            if (state.pending || state.messages.some(message => message.confirmation?.confirmationId === event.confirmation.confirmationId)) return next;
            return { ...append({ id: event.eventId, kind: 'confirmation', confirmation: event.confirmation }),
                pending: event.confirmation, status: 'waiting_for_confirmation',
                thinkingPhase: null, activeToolName: null };
        case 'confirmation_resolved':
            if (state.pending?.confirmationId !== event.confirmationId) return next;
            return { ...next, pending: null, decisionBusy: false, status: 'thinking',
                thinkingPhase: 'thinking', activeToolName: null,
                messages: state.messages.map(message =>
                message.confirmation?.confirmationId === event.confirmationId ? { ...message, decision: event.decision } : message) };
        case 'tool_started': {
            const aid = event.actionId || event.toolId;
            return { ...next, status: state.pending ? 'waiting_for_confirmation' : 'executing',
                thinkingPhase: 'executing',
                activeToolName: state.messages.find(m => m.kind === 'action' && m.actionId === aid)?.action?.actionType ||
                    state.activeToolName || null };
        }
        case 'tool_completed': {
            const aid = event.actionId || event.toolId;
            if (!event.result && event.output) {
                // simulation: tool_completed carries output object, not a typed result
                return { ...next, thinkingPhase: 'thinking', activeToolName: null };
            }
            const action = state.messages.find(message => message.kind === 'action' && message.actionId === aid);
            return { ...append({ id: event.eventId, kind: 'result', actionRiskLevel: action?.action?.riskLevel,
                result: event.result, provenance: event.provenance }),
                thinkingPhase: 'thinking', activeToolName: null };
        }
        case 'result_ready': {
            // simulation: attach the rich simulation result to the nearest text message
            return { ...next, messages: state.messages.map(message =>
                message.id === event.messageId && message.kind === 'text'
                    ? { ...message, result: event.result } : message) };
        }
        case 'tool_failed':
        case 'agent_error': return agentReducer(next, { type: 'failure', requestId: event.requestId, error: event.error });
        case 'conversation_completed':
            if (state.pending) return next;
            return { ...next, status: 'completed', activeRequestId: null,
                thinkingPhase: null, activeToolName: null,
                messages: state.messages.map(message => ({ ...message, streaming: false })) };
        default: return state;
    }
}
