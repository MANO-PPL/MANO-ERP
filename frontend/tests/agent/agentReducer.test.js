import test from 'node:test';
import assert from 'node:assert/strict';
import { agentReducer, initialAgentState, canSend } from '../../src/components/Agent/agentReducer.js';
import { isAgentEvent, isExpired, ERROR_COPY } from '../../src/components/Agent/agentModel.js';
import { fixtureAction, fixtureConfirmation, fixtureResults } from './fixtures.js';

const request = { conversationId: 'c1', message: 'Fixture request', context: { route: '/projects/42', module: 'Reports', projectId: '42' } };
const start = () => agentReducer(initialAgentState('c1'), { type: 'start', requestId: 'r1', request });
let sequence = 0;
const event = (state, data) => agentReducer(state, { type: 'event', event: { conversationId: 'c1', requestId: 'r1', eventId: `e${++sequence}`, ...data } });

test('starts once, snapshots request context, blocks duplicate send', () => {
    const state = start();
    assert.equal(state.status, 'submitting');
    assert.equal(canSend(state), false);
    assert.equal(state.messages[0].context.projectId, '42');
    assert.equal(agentReducer(state, { type: 'start', requestId: 'r2', request }), state);
});
test('streaming deltas update one message and completion replaces text', () => {
    let state = event(start(), { type: 'message_started', messageId: 'm1', role: 'assistant' });
    state = event(state, { type: 'text_delta', messageId: 'm1', delta: 'Hello ' });
    state = event(state, { type: 'text_delta', messageId: 'm1', delta: 'world' });
    assert.equal(state.messages.length, 2);
    assert.equal(state.messages[1].text, 'Hello world');
    state = event(state, { type: 'text_completed', messageId: 'm1', text: 'Final answer' });
    state = event(state, { type: 'text_delta', messageId: 'm1', delta: 'late' });
    assert.equal(state.messages[1].text, 'Final answer');
});
test('duplicate events, stale request/conversation events and post-completion events are ignored', () => {
    let state = event(start(), { type: 'message_started', messageId: 'm1', role: 'assistant' });
    const delta = { type: 'event', event: { type: 'text_delta', eventId: 'same', conversationId: 'c1', requestId: 'r1', messageId: 'm1', delta: 'Once' } };
    state = agentReducer(state, delta);
    assert.equal(agentReducer(state, delta), state);
    assert.equal(event(state, { type: 'conversation_completed', requestId: 'old' }), state);
    assert.equal(event(state, { type: 'conversation_completed', conversationId: 'old' }), state);
    state = event(state, { type: 'conversation_completed' });
    assert.equal(event(state, { type: 'text_delta', messageId: 'm1', delta: 'Too late' }), state);
});
test('proposal never implies success, confirmation blocks sends until resolved', () => {
    let state = event(start(), { type: 'tool_proposed', actionId: 'a1', action: fixtureAction });
    assert.equal(state.messages[1].kind, 'action');
    state = event(state, { type: 'confirmation_required', confirmation: fixtureConfirmation });
    assert.equal(state.status, 'waiting_for_confirmation');
    assert.equal(canSend(state), false);
    state = event(state, { type: 'conversation_completed' });
    assert.ok(state.pending);
    state = agentReducer(state, { type: 'decision_start', confirmationId: fixtureConfirmation.confirmationId, decision: 'confirm', now: 0 });
    assert.equal(state.decisionBusy, true);
    assert.equal(agentReducer(state, { type: 'decision_start', confirmationId: fixtureConfirmation.confirmationId, decision: 'confirm' }), state);
    state = event(state, { type: 'confirmation_resolved', confirmationId: fixtureConfirmation.confirmationId, decision: 'confirm' });
    assert.equal(state.pending, null);
    assert.equal(state.messages.at(-1).decision, 'confirm');
    assert.ok(!state.messages.some(message => message.kind === 'result'));
    state = event(state, { type: 'conversation_completed' });
    assert.equal(canSend(state), true);
});
test('expired confirmations cannot confirm but can cancel', () => {
    const confirmation = { ...fixtureConfirmation, expiresAt: '2000-01-01T00:00:00Z' };
    let state = event(start(), { type: 'confirmation_required', confirmation });
    assert.equal(isExpired(confirmation), true);
    assert.equal(isExpired({ expiresAt: 'invalid' }), true);
    assert.equal(agentReducer(state, { type: 'decision_start', confirmationId: confirmation.confirmationId, decision: 'confirm' }), state);
    state = agentReducer(state, { type: 'decision_start', confirmationId: confirmation.confirmationId, decision: 'cancel' });
    assert.equal(state.decisionBusy, true);
});
test('all error categories retire confirmations without indicating success', () => {
    for (const code of Object.keys(ERROR_COPY)) {
        const state = event(event(start(), { type: 'confirmation_required', confirmation: fixtureConfirmation }), { type: 'agent_error', error: { code } });
        assert.equal(state.status, 'error');
        assert.equal(state.pending, null);
        assert.equal(state.messages[1].unavailable, true);
        assert.equal(state.error.retryable, false);
        assert.ok(!state.messages.some(message => message.result?.outcome === 'success'));
    }
});
test('retry removes prior error and does not duplicate user message or change context', () => {
    let state = event(start(), { type: 'agent_error', error: { code: 'network_failure', retryable: true, retrySafety: 'safe' } });
    assert.equal(state.error.retryable, true);
    state = agentReducer(state, { type: 'start', requestId: 'r2', request: state.request, retry: true });
    assert.equal(state.messages.filter(message => message.role === 'user').length, 1);
    assert.equal(state.messages.filter(message => message.kind === 'error').length, 0);
    assert.equal(state.request.context.projectId, '42');
});
test('execution result requires a valid structured event; generic completion produces none', () => {
    let state = start();
    for (const result of fixtureResults) state = event(state, { type: 'tool_completed', actionId: 'a1', result });
    assert.equal(state.messages.length, 7);
    const complete = event(start(), { type: 'conversation_completed' });
    assert.equal(complete.messages.length, 1);
    assert.equal(isAgentEvent({ type: 'text_completed', eventId: 'e', conversationId: 'c', requestId: 'r', messageId: 'm', text: 'ok', result: fixtureResults[4] }), false);
});
test('unknown/malformed events fail validation and cannot render action success', () => {
    for (const data of [{ type: 'unknown' }, { type: 'tool_completed', actionId: 'a', result: { kind: 'execution', title: 'Bad', outcome: 'maybe' } },
        { type: 'confirmation_required', confirmation: { ...fixtureConfirmation, riskLevel: 'ADMIN' } },
        { type: 'tool_proposed', actionId: 'a', action: { ...fixtureAction, fields: [{ label: 'Unsafe', value: {} }] } }]) {
        const state = start();
        assert.equal(event(state, data), state);
    }
});
test('reset and stopping isolate late events', () => {
    const state = agentReducer(start(), { type: 'reset', conversationId: 'c2' });
    assert.equal(state.messages.length, 0);
    assert.equal(event(state, { type: 'conversation_completed' }), state);
    const cancelled = agentReducer(start(), { type: 'cancel_response', requestId: 'r1' });
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(event(cancelled, { type: 'conversation_completed' }), cancelled);
});

test('interruption terminates the streaming placeholder without creating another user request', () => {
    let state = event(start(), { type: 'message_started', messageId: 'm1', role: 'assistant' });
    state = agentReducer(state, { type: 'cancel_response', requestId: 'r1' });
    assert.equal(state.messages.filter(message => message.role === 'user').length, 1);
    assert.equal(state.messages[1].streaming, false);
    assert.equal(state.messages[1].text, 'Response interrupted.');
    assert.equal(canSend(state), true);
});

test('tool-started events expose executing state and block new requests', () => {
    const state = event(start(), { type: 'tool_started', actionId: 'a1' });
    assert.equal(state.status, 'executing');
    assert.equal(canSend(state), false);
});
