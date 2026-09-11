import { isAgentEvent } from '../components/Agent/agentModel.js';
import { getAccessToken, refreshAccessToken } from './api.js';

export function createConnectedTransport({ fetchImpl = (...args) => fetch(...args), randomKey = () => crypto.randomUUID(), refreshAuth = refreshAccessToken } = {}) {
    const logicalKeys = new WeakMap();
    const receipts = new Map();
    const emitError = (options, code, retrySafe = false) => options.onEvent({ type: 'agent_error', eventId: randomKey(),
        conversationId: options.conversationId, requestId: options.requestId, error: { code, retryable: retrySafe, ...(retrySafe ? { retrySafety: 'safe' } : {}) } });
    async function exchange(url, body, options, key, method = 'POST') {
        if (options.signal?.aborted) return;
        let confirmationObserved = false;
        try {
            let response;
            for (let attempt = 0; attempt < 2; attempt++) {
                const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
                response = await fetchImpl(url, { method, credentials: 'include', redirect: 'error', signal: options.signal,
                    headers: { 'Content-Type': 'application/json', 'X-Agent-Client': 'mano-agent-v1', 'X-Agent-Request-Id': options.requestId,
                        'X-Agent-Conversation-Id': options.conversationId, ...(key ? { 'X-Agent-Client-Request-Key': key } : {}),
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
                if (response.ok) break;
                if (attempt === 0 && [401, 403].includes(response.status) && typeof refreshAuth === 'function') {
                    const refreshed = await refreshAuth().catch(() => null);
                    if (refreshed) continue;
                }
                break;
            }
            if (!response.ok) { emitError(options, [401, 403].includes(response.status) ? 'authorization_denied' : 'backend_unavailable'); return; }
            if (!response.headers.get('content-type')?.includes('application/x-ndjson') || !response.body) throw new Error('protocol');
            const decoder = new TextDecoder(); const reader = response.body.getReader();
            let pending = ''; let bytes = 0; let count = 0;
            const consume = line => {
                if (!line.trim()) return;
                if (++count > 512) throw new Error('protocol');
                const event = JSON.parse(line);
                if (!isAgentEvent(event) || event.conversationId !== options.conversationId || event.requestId !== options.requestId) throw new Error('protocol');
                if (event.type === 'confirmation_required') confirmationObserved = true;
                if (event.serverRequestId) {
                    receipts.set(options.conversationId, { id: event.serverRequestId, sequence: event.sequence || 0 });
                    if (receipts.size > 50) receipts.delete(receipts.keys().next().value);
                }
                if (!options.signal?.aborted) options.onEvent(event);
            };
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    bytes += value.length;
                    if (bytes > 2 * 1024 * 1024) throw new Error('protocol');
                    pending += decoder.decode(value, { stream: true });
                    let end;
                    while ((end = pending.indexOf('\n')) >= 0) { consume(pending.slice(0, end)); pending = pending.slice(end + 1); }
                    if (pending.length > 65536) throw new Error('protocol');
                }
                pending += decoder.decode(); if (pending.trim()) consume(pending);
            } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        } catch (error) {
            if (!options.signal?.aborted) {
                const protocolError = error.message === 'protocol' || error instanceof SyntaxError;
                // A send retry reuses the random logical key. Decisions are never retried automatically.
                emitError(options, protocolError ? 'protocol_error' : 'network_failure', !protocolError && Boolean(key) && !confirmationObserved);
            }
        }
    }
    return Object.freeze({ mode: 'connected', supportsStop: true,
        async send(request, options) {
            // Object identity distinguishes a stored UI Retry from a genuinely new submission, even with identical text.
            if (!logicalKeys.has(request)) logicalKeys.set(request, randomKey());
            return exchange('/api/agent/requests', request, options, logicalKeys.get(request));
        },
        async uploadFile(file) {
            const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetchImpl('/api/agent/upload', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'X-Agent-Client': 'mano-agent-v1',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: formData
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.code || 'upload_failed');
            }
            return await response.json();
        },
        decide(decision, options) { return exchange('/api/agent/decisions', decision, options); },
        replay(options) {
            const receipt = receipts.get(options.conversationId);
            if (!receipt) { emitError(options, 'request_rejected'); return Promise.resolve(); }
            return exchange(`/api/agent/requests/${encodeURIComponent(receipt.id)}/events?after=${receipt.sequence}`, null, options, null, 'GET');
        }
    });
}
export const connectedTransport = createConnectedTransport();
