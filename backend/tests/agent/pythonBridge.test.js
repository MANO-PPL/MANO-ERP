import test from 'node:test';
import assert from 'node:assert/strict';
import { createPythonClient, INTERNAL_PATH, signature } from '../../src/modules/agent/agentPythonClient.js';
import { sha256 } from '../../src/modules/agent/agentValidation.js';
import { TOOLS, CONTRACT_VERSION } from '../../src/modules/agent/agentTools.js';
import { harness, answer } from './fixtures.js';

const secret = 'fixture-secret-'.repeat(4);
const request = { requestId: 'r1', stepId: 'r1_1' };
function responseFor(headers, response = answer, mutate = {}) {
    const data = JSON.stringify({ protocol: CONTRACT_VERSION, requestId: request.requestId, stepId: request.stepId, toolNames: Object.keys(TOOLS), response,
        diagnostics: { provider: 'nvidia', finishReason: 'stop', promptTokens: 10, completionTokens: 20, totalTokens: 30, hasReasoningContent: false }, ...mutate });
    return new Response(data, { headers: { 'X-Agent-Signature': signature(secret, `${headers['X-Agent-Nonce']}\n200\n${sha256(data)}`) } });
}
test('S38 Python unavailable gives zero ERP mutations', async () => {
    const reason = createPythonClient({ secret, fetchImpl: async () => { throw Error('ECONNREFUSED'); } }); const h = harness({ reason }); await h.submit(); assert.equal(h.attempts, 0);
});
test('S39 Python timeout gives zero ERP mutations', async () => {
    const reason = createPythonClient({ secret, fetchImpl: async () => { throw new DOMException('Timeout', 'TimeoutError'); } }); const h = harness({ reason }); await h.submit(); assert.equal(h.attempts, 0);
});
test('S52 HMAC protocol binds exact request/response bytes and correlation', async () => {
    const reason = createPythonClient({ secret, now: () => 1800000000000, fetchImpl: async (url, options) => {
        assert.equal(url, `http://127.0.0.1:8000${INTERNAL_PATH}`);
        const h = options.headers;
        assert.equal(h['X-Agent-Signature'], signature(secret, `POST\n${INTERNAL_PATH}\n${h['X-Agent-Time']}\n${h['X-Agent-Nonce']}\n${sha256(options.body)}`));
        return responseFor(h);
    } }); assert.deepEqual(await reason(request), answer);
    const wrong = createPythonClient({ secret, fetchImpl: async (url, options) => responseFor(options.headers, answer, { stepId: 'other' }) });
    await assert.rejects(wrong(request), { code: 'protocol_error' });
    const unsigned = createPythonClient({ secret, fetchImpl: async () => new Response('{}') }); await assert.rejects(unsigned(request));
});
test('Node validates Python extras even with a valid internal signature', async () => {
    const reason = createPythonClient({ secret, fetchImpl: async (url, options) => responseFor(options.headers, { ...answer, authorization: 'ALLOW' }) });
    await assert.rejects(reason(request));
});
test('Node independently rejects a non-stop provider completion', async () => {
    const reason = createPythonClient({ secret, fetchImpl: async (url, options) => responseFor(options.headers, answer, {
        diagnostics: { provider: 'nvidia', finishReason: 'length', promptTokens: 10, completionTokens: 4096, totalTokens: 4106, hasReasoningContent: true }
    }) });
    await assert.rejects(reason(request), { code: 'protocol_error' });
});
