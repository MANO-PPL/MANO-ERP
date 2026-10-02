import test from 'node:test';
import assert from 'node:assert/strict';
import { agentReducer, initialAgentState } from '../../src/components/Agent/agentReducer.js';
import { confirmationReplyDecision, createDecision, safeError } from '../../src/components/Agent/agentModel.js';

const action = { actionType: 'clients.create', title: 'Create client', riskLevel: 'WRITE', fields: [{ label: 'name', value: 'QA fixture' }] };
let serial = 0;
function event(state, type, payload = {}) {
    return agentReducer(state, { type: 'event', event: { eventId: `e${++serial}`, conversationId: 'c', requestId: 'r', type, ...payload } });
}
function pending() {
    let state = agentReducer(initialAgentState('c'), { type: 'start', requestId: 'r', request: { message: 'Create test client', context: {} } });
    state = event(state, 'tool_proposed', { actionId: 'a', action });
    state = event(state, 'tool_proposed', { actionId: 'other', action });
    return event(state, 'confirmation_required', { actionId: 'a', confirmation: { ...action, confirmationId: 'confirmation', expiresAt: '2099-01-01T00:00:00Z' } });
}
test('confirmation replaces only its exact proposal, preserving the preview and unrelated actions', () => {
    const state = pending();
    assert.equal(state.messages.filter(m => m.actionId === 'a').length, 1);
    assert.equal(state.messages.find(m => m.actionId === 'a').kind, 'confirmation');
    assert.equal(state.messages.find(m => m.actionId === 'other').kind, 'action');
    assert.equal(state.pending.confirmationId, 'confirmation');
});
test('confirmation alone is not success; only correlated committed execution marks success', () => {
    let state = event(pending(), 'confirmation_resolved', { confirmationId: 'confirmation', decision: 'confirm' });
    assert.equal(state.messages.find(m => m.kind === 'confirmation').executionOutcome, undefined);
    state = event(state, 'tool_completed', { actionId: 'other', result: { kind: 'execution', title: 'Other', outcome: 'success', text: 'Committed' } });
    assert.equal(state.messages.find(m => m.kind === 'confirmation').executionOutcome, undefined);
    state = event(state, 'tool_completed', { actionId: 'a', result: { kind: 'execution', title: 'Client', outcome: 'success', text: 'Committed' } });
    assert.equal(state.messages.find(m => m.kind === 'confirmation').executionOutcome, 'success');
    assert.equal(state.messages.at(-1).actionRiskLevel, 'WRITE');
});
test('cancel never becomes successful and exact tool failures mark failure', () => {
    let cancelled = event(pending(), 'confirmation_resolved', { confirmationId: 'confirmation', decision: 'cancel' });
    cancelled = event(cancelled, 'tool_completed', { actionId: 'a', result: { kind: 'execution', title: 'Client', outcome: 'success', text: 'Committed' } });
    assert.equal(cancelled.messages.find(m => m.kind === 'confirmation').executionOutcome, undefined);
    let failed = event(pending(), 'confirmation_resolved', { confirmationId: 'confirmation', decision: 'confirm' });
    failed = event(failed, 'tool_failed', { actionId: 'a', error: { code: 'execution_failure' } });
    assert.equal(failed.messages.find(m => m.kind === 'confirmation').executionOutcome, 'failure');
});
test('rate-limited read-back preserves prior successful writes and uses the specific message', () => {
    let state = event(pending(), 'confirmation_resolved', { confirmationId: 'confirmation', decision: 'confirm' });
    state = event(state, 'tool_completed', { actionId: 'a', result: { kind: 'execution', title: 'Client', outcome: 'success', text: 'Committed' } });
    state = event(state, 'agent_error', { error: { code: 'provider_rate_limited' } });
    assert.equal(state.messages.find(m => m.kind === 'confirmation').executionOutcome, 'success');
    assert.match(state.error.message, /rate-limited/);
    assert.equal(safeError({ code: 'provider_rate_limited' }).retryable, false);
});
test('typed destructive confirmation text is included in the server decision and bounded', () => {
    assert.deepEqual(createDecision('confirmation', 'confirm', 'DELETE 2 TASKS'), {
        confirmationId: 'confirmation', decision: 'confirm', confirmationText: 'DELETE 2 TASKS'
    });
    assert.throws(() => createDecision('confirmation', 'confirm', 'x'.repeat(81)));
});
test('yes and no resolve only an unexpired ordinary confirmation', () => {
    const ordinary = { confirmationId: 'confirmation', expiresAt: '2099-01-01T00:00:00Z' };
    assert.equal(confirmationReplyDecision('yes', ordinary), 'confirm');
    assert.equal(confirmationReplyDecision('No', ordinary), 'cancel');
    assert.equal(confirmationReplyDecision('yes', { ...ordinary, confirmationPhrase: 'DELETE 2 TASKS' }), null);
    assert.equal(confirmationReplyDecision('no', { ...ordinary, expiresAt: '2000-01-01T00:00:00Z' }), null);
});
