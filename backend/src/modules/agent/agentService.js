import { randomUUID } from 'node:crypto';
import { AgentError, fail, fingerprint, identity, requestKey, safeError, validateRequest, validateDecision } from './agentValidation.js';
import { CONTRACT_VERSION, TOOLS, LIVE_WRITE_ENABLEMENT, validateIntent, validateModelResponse } from './agentTools.js';
import { actionFor, provenance, resultCard } from './agentEvents.js';

const scopeRecord = scope => ({ orgId: scope.orgId, userId: scope.userId, projectId: scope.projectId || null,
    resourceId: scope.resource?.id ? Number(scope.resource.id) : null, contactId: scope.contact?.id ? Number(scope.contact.id) : null });
const operationDigest = (request, execution) => fingerprint({ requestId: request.request_id, generation: request.generation,
    executionId: execution.execution_id, tool: execution.tool, version: execution.tool_version, args: execution.args_json,
    scope: execution.scope_json, preconditions: execution.preconditions_json, credential: execution.credential_hash });

export function createAgentService({ store, authorize, read, writes, reason, okf, now = Date.now, writeEnablement = LIVE_WRITE_ENABLEMENT }) {
    const inflight = new Map();
    const memory = new Map();
    const memoryKey = (actor, conversationId) => `${actor.orgId}:${actor.userId}:${conversationId}`;
    function remember(actor, body, request, text) {
        for (const [key, value] of memory) if (value.expires <= now()) memory.delete(key);
        const key = memoryKey(actor, body.conversationId);
        const existing = memory.get(key)?.entries || [];
        const entries = [...existing.filter(e => e.requestId !== request.request_id), { requestId: request.request_id, user: body.message, assistant: text.slice(0, 8000) }].slice(-4);
        memory.set(key, { expires: now() + 1800000, entries });
        if (memory.size > 1000) memory.delete(memory.keys().next().value);
    }
    async function checkReplayAuthority(actor, requestId) {
        const request = await store.owned(requestId, actor);
        const references = request.context_json?.authorizationRefs || [];
        if (!Array.isArray(references) || references.length > 256) fail('authorization_denied', 'invalid_authorization_references');
        const all = [...references];
        for (const execution of await store.executions(actor, requestId)) {
            if (execution.args_json) all.push({ kind: 'tool', tool: execution.tool, version: execution.tool_version, arguments: execution.args_json });
        }
        const unique = [...new Map(all.map(ref => [fingerprint(ref), ref])).values()];
        if (unique.length > 256) fail('authorization_denied', 'authorization_reference_limit');
        for (const reference of unique) { const { tool, args } = validateIntent(reference); await authorize(actor, tool, args); }
        return unique;
    }
    async function authorizedEvents(actor, requestId, after = 0) {
        await checkReplayAuthority(actor, requestId);
        return store.events(actor, requestId, after);
    }
    async function historyFor(actor, conversationId) {
        const key = memoryKey(actor, conversationId); const cached = memory.get(key);
        if (!cached || cached.expires <= now()) { memory.delete(key); return { messages: [], references: [] }; }
        const references = new Map();
        try {
            for (const entry of cached.entries) for (const reference of await checkReplayAuthority(actor, entry.requestId)) references.set(fingerprint(reference), reference);
            if (references.size > 256) fail('authorization_denied');
        } catch { memory.delete(key); return { messages: [], references: [] }; }
        return { messages: cached.entries.flatMap(entry => [{ role: 'user', text: entry.user }, { role: 'assistant', text: entry.assistant }]), references: [...references.values()] };
    }
    function current(session, request) {
        if (session.request.status !== 'RUNNING' || session.request.reasoning_epoch !== request.reasoning_epoch
            || Number(session.request.lease_ms) <= now()) fail('request_rejected', 'stale_reasoning_attempt');
    }
    async function terminalError(actor, request, error) {
        await store.transaction(request.request_id, actor, async session => {
            if (session.request.status !== 'RUNNING') return;
            await session.updateRequest({ status: 'FAILED', error_category: error instanceof AgentError ? error.category : 'internal_failure' });
            await session.append('agent_error', { error: safeError(error) });
            await session.append('conversation_completed');
        });
    }
    async function run(actor, body, request, knowledge) {
        const results = []; const messageId = randomUUID();
        try {
            const history = await historyFor(actor, body.conversationId);
            const authority = new Map(history.references.map(ref => [fingerprint(ref), ref]));
            const recordAuthorization = (tool, args) => {
                const reference = { kind: 'tool', tool: tool.name, version: tool.version, arguments: args };
                authority.set(fingerprint(reference), reference);
                if (authority.size > 256) fail('request_rejected', 'authorization_reference_limit');
            };
            await store.transaction(request.request_id, actor, async session => {
                current(session, request);
                await session.updateRequest({ context_json: { ...body.context, authorizationRefs: [...authority.values()] } });
                await session.append('message_started', { messageId, role: 'assistant' });
            });
            for (let step = 1; step <= 4; step++) {
                if (now() >= Number(request.lease_ms)) fail('backend_unavailable', 'request_deadline');
                const stepId = `${request.request_id}_${step}`;
                const response = validateModelResponse(await reason({ protocol: CONTRACT_VERSION, requestId: request.request_id, stepId,
                    message: body.message, history: history.messages, context: body.context, generation: knowledge.generation, knowledge: knowledge.markdown,
                    results, allowedTools: Object.values(TOOLS).filter(t => t.risk === 'READ' || writeEnablement[t.name] === true).map(t => t.name) }, { deadline: Number(request.lease_ms) }));
                if (response.kind === 'assistant') {
                    const references = new Set([...knowledge.markdown.map(k => k.file), ...results.map(r => r.stepId)]);
                    if (response.sources.some(s => !references.has(s))) fail('protocol_error', 'unverified_provenance');
                    await store.transaction(request.request_id, actor, async session => {
                        current(session, request);
                        const text = `No ERP changes were made.\n${response.text}`;
                        await session.append('text_delta', { messageId, delta: text });
                        await session.append('text_completed', { messageId, text, provenance: response.sources.map(label => ({ label, timestamp: new Date(now()).toISOString() })) });
                        await session.updateRequest({ status: 'COMPLETE' }); await session.append('conversation_completed');
                    });
                    remember(actor, body, request, `No ERP changes were made.\n${response.text}`);
                    return;
                }
                const { tool, args } = validateIntent(response);
                if (tool.risk === 'WRITE' && writeEnablement[tool.name] !== true) fail('request_rejected', 'write_integration_gate_closed');
                const scope = await authorize(actor, tool, args);
                recordAuthorization(tool, args);
                const execution = { execution_id: randomUUID(), request_id: request.request_id, step_index: step, tool: tool.name, tool_version: tool.version,
                    risk: tool.risk, authorization_decision: 'ALLOW', scope_json: scopeRecord(scope), args_json: args,
                    preconditions_json: null, operation_fingerprint: '', confirmation_id: null, confirmation_expires_ms: null,
                    credential_hash: tool.risk === 'WRITE' ? actor.credentialHash : null, status: 'SUCCEEDED', result_json: null,
                    error_category: null, created_ms: now(), completed_ms: null };
                if (tool.risk === 'WRITE') {
                    execution.preconditions_json = await writes.preconditions(tool, args, scope);
                    execution.confirmation_id = randomUUID(); execution.confirmation_expires_ms = Math.min(now() + 300000, Number(request.expires_ms));
                    execution.status = 'PENDING_CONFIRMATION'; execution.operation_fingerprint = operationDigest(request, execution);
                    await store.transaction(request.request_id, actor, async session => {
                        current(session, request);
                        if (await session.executionAt(step)) fail('request_rejected', 'duplicate_tool_step');
                        await session.insertExecution(execution);
                        const action = actionFor(tool, args);
                        await session.append('tool_proposed', { actionId: execution.execution_id, action }, execution.execution_id);
                        await session.append('confirmation_required', { confirmation: { ...action, confirmationId: execution.confirmation_id,
                            expiresAt: new Date(execution.confirmation_expires_ms).toISOString() } }, execution.execution_id);
                        await session.updateRequest({ status: 'AWAITING_CONFIRMATION', step_index: step });
                        await session.updateRequest({ context_json: { ...body.context, authorizationRefs: [...authority.values()] } });
                    });
                    remember(actor, body, request, 'A confirmation was requested. No ERP write has been reported.');
                    return;
                }
                const data = await read(actor, tool, args, scope, { recordAuthorization, deadline: Number(request.lease_ms) });
                execution.result_json = data; execution.completed_ms = now(); execution.operation_fingerprint = operationDigest(request, execution);
                await store.transaction(request.request_id, actor, async session => {
                    current(session, request);
                    if (await session.executionAt(step)) fail('request_rejected', 'duplicate_tool_step');
                    await session.insertExecution(execution);
                    await session.append('tool_proposed', { actionId: execution.execution_id, action: actionFor(tool, args) }, execution.execution_id);
                    await session.append('tool_started', { actionId: execution.execution_id }, execution.execution_id);
                    await session.append('tool_completed', { actionId: execution.execution_id, result: resultCard(tool, data), provenance: provenance(tool, scope, now()) }, execution.execution_id);
                    await session.updateRequest({ step_index: step, context_json: { ...body.context, authorizationRefs: [...authority.values()] } });
                });
                results.push({ stepId, tool: tool.name, data });
            }
            fail('request_rejected', 'tool_loop_limit');
        } catch (error) { await terminalError(actor, request, error); }
    }

    return {
        async submit(actor, input, key) {
            const body = validateRequest(input); requestKey(key);
            const knowledge = await okf.acquire();
            const { request, fresh } = await store.begin(actor, body, key, knowledge.generation);
            if (fresh) {
                const work = run(actor, body, request, knowledge);
                inflight.set(request.request_id, work);
                try { await work; } finally { inflight.delete(request.request_id); }
            } else if (inflight.has(request.request_id)) await inflight.get(request.request_id);
            return { requestId: request.request_id, events: await authorizedEvents(actor, request.request_id) };
        },
        async replay(actor, requestId, after = 0) {
            identity(requestId);
            return authorizedEvents(actor, requestId, after);
        },
        async decide(actor, input, conversationId) {
            const decision = validateDecision(input);
            const found = await store.findConfirmation(actor, decision.confirmationId);
            if (found.request.conversation_id !== identity(conversationId)) fail('authorization_denied', 'confirmation_conversation');
            if (found.execution.credential_hash !== actor.credentialHash) fail('authorization_denied', 'credential_binding_changed');
            // Replays do not call Python, load a new operation, or dispatch a tool.
            if (found.execution.status !== 'PENDING_CONFIRMATION') return authorizedEvents(actor, found.request.request_id);
            let generation;
            if (decision.decision === 'confirm') generation = (await okf.acquire()).generation;
            try {
                await store.transaction(found.request.request_id, actor, async session => {
                    const execution = await session.confirmation(decision.confirmationId);
                    if (!execution || execution.credential_hash !== actor.credentialHash) fail('authorization_denied');
                    if (execution.status !== 'PENDING_CONFIRMATION') return;
                    if (decision.decision === 'cancel') {
                        await session.updateExecution(execution.execution_id, { status: 'CANCELLED', completed_ms: now() });
                        await session.updateRequest({ status: 'CANCELLED' });
                        await session.append('confirmation_resolved', { ...decision }, execution.execution_id);
                        await session.append('conversation_completed'); return;
                    }
                    if (Number(execution.confirmation_expires_ms) <= now()) fail('confirmation_expired');
                    if (generation !== session.request.generation) fail('request_rejected', 'knowledge_generation_changed');
                    const { tool, args } = validateIntent({ kind: 'tool', tool: execution.tool, version: execution.tool_version, arguments: execution.args_json });
                    if (tool.risk !== 'WRITE' || writeEnablement[tool.name] !== true) fail('request_rejected', 'write_integration_gate_closed');
                    if (execution.operation_fingerprint !== operationDigest(session.request, execution)) fail('request_rejected', 'operation_integrity');
                    const scope = await authorize(actor, tool, args, session.trx, true);
                    if (fingerprint(scopeRecord(scope)) !== fingerprint(execution.scope_json)) fail('authorization_denied', 'scope_changed');
                    const preconditions = await writes.preconditions(tool, args, scope, session.trx, true);
                    if (fingerprint(preconditions) !== fingerprint(execution.preconditions_json)) fail('request_rejected', 'stale_preconditions');
                    const result = await writes.execute(tool, args, scope, session.trx);
                    await session.updateExecution(execution.execution_id, { status: 'SUCCEEDED', result_json: result, completed_ms: now() });
                    await session.append('confirmation_resolved', { ...decision }, execution.execution_id);
                    await session.append('tool_started', { actionId: execution.execution_id }, execution.execution_id);
                    await session.append('tool_completed', { actionId: execution.execution_id,
                        result: { kind: 'execution', title: tool.name, outcome: 'success', text: `Committed record ${result.id}.` },
                        provenance: provenance(tool, scope, now()) }, execution.execution_id);
                    await session.updateRequest({ status: 'COMPLETE' }); await session.append('conversation_completed');
                });
            } catch (error) {
                if (error?.code === 'authorization_denied') throw error;
                // A fresh locking transaction resolves lost COMMIT acknowledgements too. Never blindly rerun a mutation.
                await store.transaction(found.request.request_id, actor, async session => {
                    const execution = await session.confirmation(decision.confirmationId);
                    if (!execution) fail('execution_failure', 'execution_record_missing');
                    if (execution.status === 'SUCCEEDED' || execution.status !== 'PENDING_CONFIRMATION') return;
                    await session.updateExecution(execution.execution_id, { status: error?.code === 'confirmation_expired' ? 'EXPIRED' : 'FAILED',
                        error_category: error instanceof AgentError ? error.category : 'execution_or_commit_failure', completed_ms: now() });
                    await session.updateRequest({ status: 'FAILED' });
                    await session.append('confirmation_resolved', { ...decision }, execution.execution_id);
                    await session.append('tool_failed', { actionId: execution.execution_id, error: safeError(error) }, execution.execution_id);
                    await session.append('conversation_completed');
                });
            }
            // No success is exposed until the transaction promise (or reconciliation) has completed.
            const finalEvents = await authorizedEvents(actor, found.request.request_id);
            const entry = memory.get(memoryKey(actor, conversationId))?.entries.find(e => e.requestId === found.request.request_id);
            if (entry) {
                const completed = finalEvents.find(e => e.type === 'tool_completed' && e.result?.kind === 'execution');
                entry.assistant = completed ? completed.result.text : 'This request did not commit an ERP write.';
            }
            return finalEvents;
        }
    };
}
