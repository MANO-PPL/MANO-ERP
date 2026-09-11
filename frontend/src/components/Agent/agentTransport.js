import { createDecision, isAgentEvent, isPreviewEvent } from './agentModel.js';

// ── Legacy preview stub ───────────────────────────────────────────────────────
export const PREVIEW_RESPONSE = 'The ERP agent backend is not connected yet. No ERP data was read or changed.';

export const previewTransport = Object.freeze({
  mode: 'preview',
  supportsStop: false,
  async send(request, { requestId, signal, onEvent }) {
    let seq = 0;
    const emit = ev => { if (!signal.aborted) onEvent({ ...ev, eventId: `${requestId}-${++seq}`, conversationId: request.conversationId, requestId }); };
    await Promise.resolve();
    const msgId = `${requestId}-reply`;
    emit({ type: 'message_started', messageId: msgId, role: 'assistant' });
    emit({ type: 'text_completed', messageId: msgId, text: PREVIEW_RESPONSE });
    emit({ type: 'conversation_completed' });
  },
  async decide(payload, { conversationId, requestId, signal, onEvent }) {
    createDecision(payload.confirmationId, payload.decision);
    if (!signal.aborted) onEvent({ type: 'agent_error', eventId: `${requestId}-unavailable`, conversationId, requestId, error: { code: 'backend_unavailable', retryable: false } });
  },
});
