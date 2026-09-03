import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { CONTRACT_VERSION, TOOLS, validateModelResponse } from './agentTools.js';
import { fail, sha256, object, text, integer } from './agentValidation.js';

export const INTERNAL_PATH = '/internal/agent/v1/reason';
export function signature(secret, message) { return createHmac('sha256', secret).update(message).digest('hex'); }
export function secureEqual(a, b) {
    return typeof a === 'string' && typeof b === 'string' && /^[0-9a-f]{64}$/.test(a) && /^[0-9a-f]{64}$/.test(b)
        && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function createPythonClient({ secret, fetchImpl = fetch, now = Date.now, timeoutMs = 45000 } = {}) {
    return async function reason(request, { deadline = now() + timeoutMs } = {}) {
        if (!secret || secret.length < 32) fail('backend_unavailable', 'python_not_ready');
        const body = JSON.stringify(request);
        if (Buffer.byteLength(body) > 98304) fail('request_rejected', 'model_input_limit');
        const nonce = randomUUID(); const timestamp = String(Math.floor(now() / 1000));
        const mac = signature(secret, `POST\n${INTERNAL_PATH}\n${timestamp}\n${nonce}\n${sha256(body)}`);
        let response; let bytes;
        try {
            response = await fetchImpl(`http://127.0.0.1:8000${INTERNAL_PATH}`, { method: 'POST', redirect: 'error',
                headers: { 'Content-Type': 'application/json', 'X-Agent-Time': timestamp, 'X-Agent-Nonce': nonce, 'X-Agent-Signature': mac },
                body, signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, deadline - now()))) });
            if (!response.body) fail('backend_unavailable', 'empty_python_response');
            const chunks = []; let length = 0;
            for await (const chunk of response.body) {
                length += chunk.length;
                if (length > 65536) fail('protocol_error', 'python_output_limit');
                chunks.push(Buffer.from(chunk));
            }
            bytes = Buffer.concat(chunks);
        } catch { fail('backend_unavailable', 'python_transport_failure'); }
        const expected = signature(secret, `${nonce}\n${response.status}\n${sha256(bytes)}`);
        if (!secureEqual(response.headers.get('X-Agent-Signature'), expected)) fail('protocol_error', 'python_signature');
        if (!response.ok) fail('backend_unavailable', 'python_reasoning_failed');
        let value;
        try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('protocol_error', 'python_json'); }
        object(value, ['protocol', 'requestId', 'stepId', 'toolNames', 'response', 'diagnostics']);
        if (value.protocol !== CONTRACT_VERSION || value.requestId !== request.requestId || value.stepId !== request.stepId
            || !Array.isArray(value.toolNames) || JSON.stringify([...value.toolNames].sort()) !== JSON.stringify(Object.keys(TOOLS).sort())) fail('protocol_error', 'python_contract');
        const d = object(value.diagnostics, ['provider', 'finishReason', 'promptTokens', 'completionTokens', 'totalTokens', 'hasReasoningContent']);
        if (d.provider !== 'nvidia' || typeof d.hasReasoningContent !== 'boolean') fail('protocol_error', 'provider_contract');
        text(d.finishReason, 40); integer(d.promptTokens, 0, 200000); integer(d.completionTokens, 0, 4096); integer(d.totalTokens, 0, 204096);
        if (d.finishReason !== 'stop' || d.totalTokens !== d.promptTokens + d.completionTokens) fail('protocol_error', 'provider_completion_integrity');
        return validateModelResponse(value.response);
    };
}
