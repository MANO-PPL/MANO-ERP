import test from 'node:test';
import assert from 'node:assert/strict';
import { actor, harness } from './fixtures.js';

test('S08 writes are gated live; test-enabled proposals still require confirmation', async () => {
    const live = harness(); const rejected = await live.propose(); assert.equal(rejected.confirmation, undefined); assert.equal(live.attempts, 0);
    const h = harness({ enableWrites: true }); const p = await h.propose(); assert.ok(p.confirmation); assert.equal(h.store.state.business.length, 0);
});
test('S09 confirmation executes exact stored operation once', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); const events = await h.decide(p.confirmation.confirmationId);
    assert.deepEqual(h.store.state.business[0].args, { name: 'Fixture Supplier' }); assert.equal(h.attempts, 1);
    assert.equal(events.find(e => e.type === 'tool_completed').result.outcome, 'success');
});
test('S10 cancel performs zero ERP writes', async () => { const h = harness({ enableWrites: true }); const p = await h.propose(); await h.decide(p.confirmation.confirmationId, 'cancel'); assert.equal(h.attempts, 0); });
test('S11 duplicate confirmation replays durable result', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); const a = await h.decide(p.confirmation.confirmationId); const b = await h.decide(p.confirmation.confirmationId);
    assert.deepEqual(b, a); assert.equal(h.attempts, 1);
});
test('S12 expired confirmation never executes', async () => { const h = harness({ enableWrites: true }); const p = await h.propose(); h.advance(300001); const events = await h.decide(p.confirmation.confirmationId); assert.equal(h.attempts, 0); assert.equal(events.find(e => e.type === 'tool_failed').error.code, 'confirmation_expired'); });
test('S13 other user, credential or conversation cannot confirm', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose();
    await assert.rejects(h.decide(p.confirmation.confirmationId, 'confirm', { ...actor, userId: 8 }));
    await assert.rejects(h.decide(p.confirmation.confirmationId, 'confirm', { ...actor, credentialHash: 'x'.repeat(64) }));
    await assert.rejects(h.decide(p.confirmation.confirmationId, 'confirm', actor, 'another-conversation'));
    assert.equal(h.attempts, 0);
});
test('S14 changed preconditions invalidate confirmation', async () => { let version = 1; const h = harness({ enableWrites: true, version: () => version }); const p = await h.propose(); version++; await h.decide(p.confirmation.confirmationId); assert.equal(h.attempts, 0); });
test('S21 proposal/confirmation/commit event ordering is deterministic', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); const events = await h.decide(p.confirmation.confirmationId);
    assert.deepEqual(events.map(e => e.type), ['message_started', 'tool_proposed', 'confirmation_required', 'confirmation_resolved', 'tool_started', 'tool_completed', 'conversation_completed']);
});
test('S25 uncertain or failed execution never emits false success', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); h.store.flags.completionEvent = true;
    const events = await h.decide(p.confirmation.confirmationId); assert.equal(h.store.state.business.length, 0); assert.ok(!events.some(e => e.type === 'tool_completed'));
});
test('S29 write audit records request/execution/owner binding without raw credential', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); await h.decide(p.confirmation.confirmationId);
    const e = [...h.store.state.executions.values()][0]; assert.equal(e.scope_json.userId, actor.userId); assert.equal(e.credential_hash, actor.credentialHash); assert.equal(e.status, 'SUCCEEDED');
    assert.equal(e.confirmation_id, p.confirmation.confirmationId); assert.ok(e.operation_fingerprint); assert.doesNotMatch(JSON.stringify(e), /fixture-credential-not/);
});
test('S41 concurrent duplicate confirms commit one mutation (transaction model)', async () => {
    const h = harness({ enableWrites: true }); const p = await h.propose(); await Promise.all([h.decide(p.confirmation.confirmationId), h.decide(p.confirmation.confirmationId)]);
    assert.equal(h.attempts, 1); assert.equal(h.store.state.business.length, 1);
});
