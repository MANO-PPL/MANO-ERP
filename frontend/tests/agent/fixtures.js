// Explicit test-only data. Never import this module from src or the production transport.
export const fixtureAction = {
    actionType: 'fixture_change', title: 'Example change — test fixture',
    description: 'Synthetic presentation data. This is not an ERP record or operation.',
    riskLevel: 'WRITE', fields: [{ label: 'Example field', before: 'Old example', after: 'New example' }], simulation: true,
};
export const fixtureConfirmation = {
    ...fixtureAction, confirmationId: 'fixture-confirmation', expiresAt: '2099-01-01T00:00:00.000Z',
};
export const fixtureResults = [
    { kind: 'list', title: 'Example list', count: 2, items: [{ label: 'Fixture item A', detail: 'Synthetic entry' }, { label: 'Fixture item B', detail: 'Synthetic entry' }] },
    { kind: 'summary', title: 'Example summary', fields: [{ label: 'Source', value: 'Test fixture only' }] },
    { kind: 'table', title: 'Example table', columns: ['Example field', 'Example value'], rows: [['Fixture row', 'Synthetic value']] },
    { kind: 'warning', title: 'Example warning', text: 'This is a presentation fixture, not an operational warning.' },
    { kind: 'execution', title: 'Simulated success presentation', outcome: 'success', text: 'Test fixture only. No ERP operation was executed.', simulation: true },
    { kind: 'execution', title: 'Simulated failure presentation', outcome: 'failure', text: 'Test fixture only. No ERP operation was attempted.', simulation: true },
];

export function createFixtureTransport(scenario, observe = () => {}) {
    let sequence = 0;
    let attempts = 0;
    let release;
    const emit = (options, event) => {
        if (!options.signal.aborted) options.onEvent({ ...event, conversationId: options.conversationId,
            requestId: options.requestId, eventId: `${options.requestId}-fixture-${++sequence}` });
    };
    const message = (options, text) => {
        const messageId = `${options.requestId}-fixture-text`;
        emit(options, { type: 'message_started', role: 'assistant', messageId });
        emit(options, { type: 'text_delta', messageId, delta: text.slice(0, 12) });
        emit(options, { type: 'text_delta', messageId, delta: text.slice(12) });
        emit(options, { type: 'text_completed', messageId, text });
    };
    const transport = {
        mode: 'fixture', supportsStop: true,
        async send(request, options) {
            attempts++;
            observe({ type: 'request', request, requestId: options.requestId });
            if (scenario === 'hold') {
                emit(options, { type: 'message_started', role: 'assistant', messageId: `${options.requestId}-held` });
                await new Promise(resolve => {
                    release = resolve;
                    options.signal.addEventListener('abort', resolve, { once: true });
                });
                message(options, 'Simulation complete. No ERP data was read or changed.');
            } else if (scenario.startsWith('error:')) {
                const code = scenario.slice(6);
                if (attempts === 1 || code !== 'network_failure') {
                    emit(options, { type: 'agent_error', error: { code, retryable: code === 'network_failure', retrySafety: 'safe' } });
                    return;
                }
                message(options, 'Safe retry fixture completed. No ERP operation occurred.');
            } else if (['confirmation', 'destructive', 'bulk', 'expired'].includes(scenario)) {
                const confirmation = { ...fixtureConfirmation,
                    riskLevel: scenario === 'destructive' ? 'DESTRUCTIVE' : scenario === 'bulk' ? 'BULK_WRITE' : 'WRITE',
                    ...(scenario === 'bulk' ? { affectedRecords: 12 } : {}),
                    ...(scenario === 'expired' ? { expiresAt: '2000-01-01T00:00:00.000Z' } : {}) };
                emit(options, { type: 'tool_proposed', actionId: 'fixture-action', action: confirmation });
                emit(options, { type: 'confirmation_required', confirmation });
                return;
            } else {
                message(options, 'Explicit component fixtures follow. All values are synthetic.');
                for (const result of fixtureResults) emit(options, { type: 'tool_completed', actionId: 'fixture-action', result,
                    provenance: [{ label: 'Browser test fixture', tool: 'No ERP tool called', entityId: 'fixture-only', timestamp: '2026-09-03T00:00:00Z', hiddenReasoning: 'This field must never render' }] });
            }
            emit(options, { type: 'conversation_completed' });
        },
        async decide(payload, options) {
            observe({ type: 'decision', payload });
            emit(options, { type: 'confirmation_resolved', ...payload });
            message(options, 'Preview decision recorded. No ERP action occurred.');
            emit(options, { type: 'conversation_completed' });
        },
        release() { release?.(); },
    };
    return transport;
}
