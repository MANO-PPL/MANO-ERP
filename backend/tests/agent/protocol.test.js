import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, intent, answer, body } from './fixtures.js';
import { createRuntimeLimits } from '../../src/modules/agent/agentRuntime.js';
import { fail } from '../../src/modules/agent/agentValidation.js';
import { actor } from './fixtures.js';

test('S20 text events are ordered and never contain an execution result', async () => {
    const h = harness(); const r = await h.submit();
    assert.deepEqual(r.events.map(e => e.type), ['message_started', 'text_delta', 'text_completed', 'conversation_completed']);
    assert.ok(r.events.every(e => !e.result));
});
test('S23 provider failure before a tool produces no ERP mutation', async () => { const h = harness({ responses: [Error('provider failed')] }); await h.submit(); assert.equal(h.reads, 0); assert.equal(h.store.state.business.length, 0); });
test('S24 provider failure after a read never reports write success', async () => {
    const h = harness({ responses: [intent('vendors.search', {}), Error('provider failed')] }); const r = await h.submit();
    assert.equal(h.reads, 1); assert.ok(!r.events.some(e => e.result?.kind === 'execution')); assert.equal(h.store.state.business.length, 0);
});
test('S28 read success records scoped audit and provenance', async () => {
    const h = harness({ responses: [intent('vendors.search', {}), answer] }); const r = await h.submit();
    const e = [...h.store.state.executions.values()][0]; assert.equal(e.risk, 'READ'); assert.equal(e.scope_json.orgId, 2);
    assert.equal(e.authorization_decision, 'ALLOW'); assert.equal(r.events.find(e => e.type === 'tool_completed').provenance.length, 1);
});
test('S30 hidden reasoning fields are rejected, never emitted or persisted', async () => {
    const h = harness({ responses: [{ ...answer, reasoning_content: 'PRIVATE_SENTINEL' }] }); const r = await h.submit();
    assert.doesNotMatch(JSON.stringify([...h.store.state.executions.values(), ...r.events]), /PRIVATE_SENTINEL|reasoning_content/);
    assert.ok(r.events.some(e => e.type === 'agent_error'));
});
test('S31 malformed Python model response cannot reach Node execution', async () => {
    for (const response of ['not json', { kind: 'tool', tool: 'vendors.create', arguments: { name: 'A' } }, null]) {
        const h = harness({ reason: async () => response }); await h.submit(); assert.equal(h.reads, 0); assert.equal(h.attempts, 0);
    }
});
test('model/tool loop is bounded to four steps', async () => {
    const h = harness({ responses: Array(5).fill(intent('vendors.search', {})) }); await h.submit(body('Keep reading forever'));
    assert.equal(h.calls, 4); assert.equal(h.reads, 4);
});
test('runtime limiter works without Redis', async () => {
    const limited = createRuntimeLimits({ now: () => 1000 }); const actor = { orgId: 2, userId: 7 };
    for (let i = 0; i < 10; i++) await limited(actor, 'request', async () => {});
    await assert.rejects(limited(actor, 'request', async () => assert.fail('rate limit bypass')));
});
test('conversation history is bounded, expiring and not an authority channel', async () => {
    const seen = []; const h = harness({ reason: async request => { seen.push(request.history); return answer; } });
    for (let i = 0; i < 6; i++) await h.submit(body(`Question ${i}`));
    assert.equal(seen[0].length, 0); assert.equal(seen[5].length, 8);
    h.advance(1800001); await h.submit(body('New context')); assert.equal(seen.at(-1).length, 0);
});
test('replay of an answer derived from history rechecks inherited authorization', async () => {
    let permitted = true;
    const h = harness({ responses: [intent('vendors.search', {}), answer, answer], authorize: async who => {
        if (!permitted) fail('authorization_denied'); return { orgId: who.orgId, userId: who.userId, projectId: null };
    } });
    await h.submit(body('Read vendors')); const derived = await h.submit(body('Summarize that result'));
    permitted = false; await assert.rejects(h.service.replay(actor, derived.requestId), { code: 'authorization_denied' });
});
