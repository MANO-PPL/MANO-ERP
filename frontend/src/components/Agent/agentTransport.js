import { createDecision } from './agentModel.js';

export const PREVIEW_RESPONSE = 'The ERP agent backend is not connected yet. No ERP data was read or changed. Your request can be handled when the agent service is connected.';

/** @type {import('./agentModel.js').AgentTransport} */
export const previewTransport = Object.freeze({
    mode: 'preview',
    supportsStop: false,
    async send(request, { requestId, signal, onEvent }) {
        let sequence = 0;
        const emit = event => {
            if (!signal.aborted) onEvent({ ...event, eventId: `${requestId}-${++sequence}`,
                conversationId: request.conversationId, requestId });
        };
        // One asynchronous boundary permits cancellation; no simulated token delays.
        await Promise.resolve();
        const messageId = `${requestId}-reply`;
        emit({ type: 'message_started', messageId, role: 'assistant' });
        emit({ type: 'text_completed', messageId, text: PREVIEW_RESPONSE });
        emit({ type: 'conversation_completed' });
    },
    async decide(payload, { conversationId, requestId, signal, onEvent }) {
        createDecision(payload.confirmationId, payload.decision);
        // Production preview never proposes an action or accepts a real decision.
        if (!signal.aborted) onEvent({ type: 'agent_error', eventId: `${requestId}-unavailable`, conversationId,
            requestId, error: { code: 'backend_unavailable', retryable: false } });
    },
});
