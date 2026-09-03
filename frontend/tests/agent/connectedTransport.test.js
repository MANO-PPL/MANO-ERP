import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createConnectedTransport } from '../../src/services/agentTransport.js';
import { isAgentEvent } from '../../src/components/Agent/agentModel.js';

const request = () => ({ conversationId: 'c1', message: 'Same business action', context: { route: '/vendors', module: 'Vendors' } });
const options = (events, requestId = 'r1') => ({ requestId, conversationId: 'c1', onEvent: e => events.push(e), signal: new AbortController().signal });
const response = (rid, events = [{ type: 'conversation_completed' }]) => new Response(events.map((e, i) => JSON.stringify({ eventId: `e${i}`, conversationId: 'c1', requestId: rid, serverRequestId: 'server-request', sequence: i + 1, ...e })).join('\n') + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } });

test('S49 random logical key survives stored-request Retry, not a new identical submission', async () => {
    const sent = []; const transport = createConnectedTransport({ randomKey: randomUUID, fetchImpl: async (url, init) => { sent.push(init); return response(init.headers['X-Agent-Request-Id']); } });
    const stored = request(); await transport.send(stored, options([], 'r1')); await transport.send(stored, options([], 'r2')); await transport.send(request(), options([], 'r3'));
    const keys = sent.map(s => s.headers['X-Agent-Client-Request-Key']); assert.equal(keys[0], keys[1]); assert.notEqual(keys[1], keys[2]);
    assert.notEqual(keys[0], 'r1'); assert.match(keys[0], /^[0-9a-f-]{36}$/); assert.ok(sent.every(s => s.credentials === 'include'));
});
test('S56 connected adapter honors frozen Agent event and exact decision contracts', async () => {
    const captured = []; const events = [];
    const transport = createConnectedTransport({ randomKey: randomUUID, fetchImpl: async (url, init) => { captured.push({ url, init }); return response(init.headers['X-Agent-Request-Id']); } });
    await transport.send(request(), options(events)); await transport.decide({ confirmationId: 'confirm1', decision: 'confirm' }, options(events));
    assert.deepEqual(JSON.parse(captured[1].init.body), { confirmationId: 'confirm1', decision: 'confirm' });
    assert.ok(events.every(isAgentEvent)); assert.equal(transport.mode, 'connected');
    const main = await readFile(new URL('../../src/components/layout/MainLayout.jsx', import.meta.url), 'utf8'); assert.match(main, /AgentShell transport=\{connectedTransport\}/);
});
test('connected replay is GET and cannot dispatch a decision', async () => {
    const sent = []; const transport = createConnectedTransport({ randomKey: randomUUID, fetchImpl: async (url, init) => { sent.push({ url, init }); return response(init.headers['X-Agent-Request-Id']); } });
    await transport.send(request(), options([])); await transport.replay(options([])); assert.equal(sent[1].init.method, 'GET'); assert.equal(sent[1].init.body, undefined);
});
test('malformed and mismatched events fail safely; transport never auto-retries', async () => {
    for (const getResponse of [() => response('wrong-request'), () => new Response('not json\n', { headers: { 'Content-Type': 'application/x-ndjson' } })]) {
        let calls = 0; const events = []; const transport = createConnectedTransport({ randomKey: randomUUID, fetchImpl: async () => { calls++; return getResponse(); } });
        await transport.send(request(), options(events)); assert.equal(calls, 1); assert.equal(events.at(-1).error.code, 'protocol_error');
    }
});
test('network failure before confirmation permits safe same-key UI Retry, never decision redispatch', async () => {
    const sent = []; const events = [];
    const transport = createConnectedTransport({ randomKey: randomUUID, fetchImpl: async (url, init) => { sent.push(init); if (sent.length === 1) throw Error('network'); return response(init.headers['X-Agent-Request-Id']); } });
    const stored = request(); await transport.send(stored, options(events));
    assert.equal(events[0].error.retrySafety, 'safe'); assert.equal(events[0].error.retryable, true);
    await transport.send(stored, options([], 'r2')); assert.equal(sent[0].headers['X-Agent-Client-Request-Key'], sent[1].headers['X-Agent-Client-Request-Key']);
});
