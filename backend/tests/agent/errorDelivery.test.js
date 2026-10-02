import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../../src/modules/agent/agentController.js';
import { harness, body, intent } from './fixtures.js';
import { isAgentEvent } from '../../../frontend/src/components/Agent/agentModel.js';

test('live streaming flushes terminal provider errors once and completes the stream', async () => {
    const conversationId = 'fixture-conversation'; const requestId = 'fixture-request';
    const base = { conversationId, requestId: 'server-request' };
    const started = { ...base, eventId: 'started', type: 'message_started', messageId: 'message', role: 'assistant' };
    const error = { ...base, eventId: 'failed', type: 'agent_error', error: { code: 'provider_rate_limited', retryable: false } };
    const completed = { ...base, eventId: 'completed', type: 'conversation_completed' };
    const service = { async submit(actor, input, key, emit) { emit(started); return { requestId: 'server-request', events: [started, error, completed] }; } };
    const lines = []; const res = { locals: {}, destroyed: false, headersSent: false,
        status() { return this; }, set() { return this; }, flushHeaders() { this.headersSent = true; },
        write(value) { if (value.trim()) lines.push(JSON.parse(value)); }, end() { this.ended = true; } };
    const req = { body: { conversationId }, headers: { authorization: 'Bearer fixture', 'x-agent-request-id': requestId }, user: { id: 1, org_id: 1 } };
    await createController(async () => service, async (actor, op, callback) => callback())('request')(req, res);
    assert.deepEqual(lines.map(e => e.eventId), ['started', 'failed', 'completed']);
    assert.ok(lines.every(e => e.requestId === requestId && isAgentEvent(e)));
    assert.equal(res.ended, true);
});

test('Node rejects invented write-data requests even if a model proposes a valid tool', async () => {
    const h = harness({ enableWrites: true, responses: [intent('vendors.create', { name: 'Invented supplier' })] });
    const result = await h.submit(body('Create a vendor with random dummy details'));
    assert.ok(result.events.some(e => e.type === 'agent_error' && e.error.code === 'validation_error'));
    assert.equal(result.events.some(e => e.type === 'confirmation_required'), false);
    assert.equal(h.attempts, 0);
});
