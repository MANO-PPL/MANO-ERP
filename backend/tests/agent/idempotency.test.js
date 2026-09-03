import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { actor, body, intent, harness } from './fixtures.js';

test('S22 duplicate/stale delivery cannot execute again', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); await h.decide(p.confirmation.confirmationId);
    for (let i = 0; i < 3; i++) await h.service.replay(actor, p.requestId); assert.equal(h.attempts, 1);
});
test('S40 legitimate later identical operation gets a new execution identity', async () => {
    const h = harness({ enableWrites: true }); const first = await h.propose(); await h.decide(first.confirmation.confirmationId);
    const second = await h.propose(); await h.decide(second.confirmation.confirmationId);
    assert.notEqual(first.confirmation.confirmationId, second.confirmation.confirmationId); assert.equal(h.store.state.business.length, 2);
});
test('S46 reconnect is event replay only', async () => { const h = harness(); const r = await h.submit(); const calls = h.calls; await h.service.replay(actor, r.requestId, 0); assert.equal(h.calls, calls); assert.equal(h.reads, 0); });
test('S47 same logical request/step never dispatches a second write', async () => {
    const h = harness({ enableWrites: true, responses: [intent('vendors.create', { name: 'A' })] }); const key = randomUUID();
    const r = await h.submit(body(), key); await h.decide(r.events.find(e => e.type === 'confirmation_required').confirmation.confirmationId);
    await h.submit(body(), key); assert.equal(h.calls, 1); assert.equal(h.attempts, 1);
});
test('S48 changed payload and expired dedupe keys cannot restart a request', async () => {
    const h = harness(); const key = randomUUID(); await h.submit(body(), key);
    await assert.rejects(h.submit(body('Different text'), key)); h.advance(86400001); await assert.rejects(h.submit(body(), key));
});
