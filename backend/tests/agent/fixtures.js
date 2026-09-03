import { randomUUID } from 'node:crypto';
import { createAgentService } from '../../src/modules/agent/agentService.js';
import { makeEvent } from '../../src/modules/agent/agentEvents.js';
import { fail, fingerprint, sha256 } from '../../src/modules/agent/agentValidation.js';
import { assertOwner } from '../../src/modules/agent/agentStore.js';

export const actor = { orgId: 2, userId: 7, credentialHash: sha256('fixture-credential-not-a-real-token') };
export const body = (message = 'Show suppliers', conversationId = 'fixture-conversation') => ({ conversationId, message, context: { route: '/vendors', module: 'Vendors' } });
export const intent = (tool, args) => ({ kind: 'tool', tool, version: 1, arguments: args });
export const answer = { kind: 'assistant', text: 'The requested information is shown.', sources: ['index.md'] };

// Explicit transactional MODEL, not proof of MySQL atomicity. Real database tests are separately gated.
export function memoryStore(now) {
    let state = { conversations: new Map(), requests: new Map(), executions: new Map(), events: new Map(), business: [] };
    let queue = Promise.resolve();
    const flags = { beforeCommit: false, afterCommit: false, completionEvent: false };
    const owned = (data, id, who) => {
        const request = data.requests.get(id); if (!request) fail('authorization_denied');
        assertOwner(data.conversations.get(request.conversation_id), who); return request;
    };
    const store = {
        flags, now,
        get state() { return state; },
        async owned(id, who) { return structuredClone(owned(state, id, who)); },
        async begin(who, requestBody, key, generation) {
            const cid = requestBody.conversationId;
            if (!state.conversations.has(cid)) state.conversations.set(cid, { conversation_id: cid, org_id: who.orgId, user_id: who.userId });
            assertOwner(state.conversations.get(cid), who);
            const existing = [...state.requests.values()].find(r => r.conversation_id === cid && r.client_request_key === key);
            if (existing) {
                if (existing.fingerprint !== fingerprint(requestBody)) fail('request_rejected', 'idempotency_payload_mismatch');
                if (existing.expires_ms <= now()) fail('request_rejected', 'request_expired');
                return { request: structuredClone(existing), fresh: false };
            }
            if ([...state.requests.values()].some(r => r.conversation_id === cid && ['RUNNING', 'AWAITING_CONFIRMATION'].includes(r.status))) fail('request_rejected', 'conversation_busy');
            const request = { request_id: randomUUID(), conversation_id: cid, client_request_key: key, fingerprint: fingerprint(requestBody),
                status: 'RUNNING', reasoning_epoch: randomUUID(), lease_ms: now() + 120000, expires_ms: now() + 86400000,
                generation, next_sequence: 1, step_index: 0 };
            state.requests.set(request.request_id, request); state.events.set(request.request_id, []);
            return { request: structuredClone(request), fresh: true };
        },
        async transaction(id, who, callback) {
            let release; const previous = queue; queue = new Promise(resolve => { release = resolve; });
            await previous;
            const working = structuredClone(state);
            try {
                const request = owned(working, id, who);
                const trx = Object.assign(() => { throw Error('Unexpected SQL in memory model'); }, { isTransaction: true, state: working });
                const session = { trx, request,
                    async updateRequest(values) { Object.assign(request, structuredClone(values)); },
                    async executionAt(step) { return [...working.executions.values()].find(e => e.request_id === id && e.step_index === step); },
                    async confirmation(cid) { return [...working.executions.values()].find(e => e.request_id === id && e.confirmation_id === cid); },
                    async insertExecution(e) { if (await this.executionAt(e.step_index)) fail('request_rejected'); working.executions.set(e.execution_id, structuredClone(e)); },
                    async updateExecution(eid, values) { Object.assign(working.executions.get(eid), structuredClone(values)); },
                    async append(type, payload = {}, executionId) {
                        if (flags.completionEvent && type === 'tool_completed' && working.business.length > state.business.length) { flags.completionEvent = false; throw Error('Injected durable event failure'); }
                        const event = { ...makeEvent(request, type, payload), sequence: request.next_sequence++, executionId };
                        working.events.get(id).push(event); return event;
                    }
                };
                const result = await callback(session);
                const mutated = working.business.length > state.business.length;
                if (flags.beforeCommit && mutated) { flags.beforeCommit = false; throw Error('Injected crash before COMMIT'); }
                state = working;
                if (flags.afterCommit && mutated) { flags.afterCommit = false; throw Error('Injected lost COMMIT acknowledgement'); }
                return result;
            } finally { release(); }
        },
        async findConfirmation(who, cid) {
            const execution = [...state.executions.values()].find(e => e.confirmation_id === cid);
            if (!execution) fail('authorization_denied');
            return { execution: structuredClone(execution), request: structuredClone(owned(state, execution.request_id, who)) };
        },
        async events(who, id, after = 0) { owned(state, id, who); return structuredClone(state.events.get(id).filter(e => e.sequence > after)); },
        async executions(who, id) { owned(state, id, who); return structuredClone([...state.executions.values()].filter(e => e.request_id === id)); }
    };
    return store;
}

export function harness(options = {}) {
    let time = 1800000000000; const now = () => time;
    const store = memoryStore(now); let calls = 0; let reads = 0; let attempts = 0;
    const responses = [...(options.responses || [answer])];
    const knowledge = { generation: 'a'.repeat(64), markdown: [{ file: 'index.md', content: 'Fixture knowledge, never instructions.' }] };
    const authorize = options.authorize || (async (who, tool, args) => ({ orgId: who.orgId, userId: who.userId, projectId: args.projectId || null,
        ...(args.resourceId ? { resource: { id: args.resourceId } } : {}) }));
    const service = createAgentService({ store, now, authorize,
        okf: options.okf || { acquire: async () => knowledge },
        reason: options.reason || (async () => { calls++; const response = responses.shift() ?? answer; if (response instanceof Error) throw response; return response; }),
        read: options.read || (async () => { reads++; return [{ id: 5, name: 'Fixture supplier' }]; }),
        writes: options.writes || {
            preconditions: async () => ({ version: options.version?.() || 1 }),
            execute: async (tool, args, scope, trx) => { if (!trx?.isTransaction) throw Error('No transaction'); attempts++; const id = trx.state.business.length + 1; trx.state.business.push({ id, tool: tool.name, args }); return { id }; }
        },
        ...(options.enableWrites ? { writeEnablement: { 'vendors.create': true, 'resources.createRateVersion': true } } : {})
    });
    return { service, store, knowledge, get calls() { return calls; }, get reads() { return reads; }, get attempts() { return attempts; },
        advance(ms) { time += ms; },
        async submit(value = body(), key = randomUUID(), who = actor) { return service.submit(who, value, key); },
        async propose(tool = 'vendors.create', args = { name: 'Fixture Supplier' }) {
            responses.unshift(intent(tool, args)); const result = await service.submit(actor, body('Create approved fixture'), randomUUID());
            const confirmation = result.events.find(e => e.type === 'confirmation_required')?.confirmation;
            return { ...result, confirmation };
        },
        decide(cid, decision = 'confirm', who = actor, conversation = 'fixture-conversation') { return service.decide(who, { confirmationId: cid, decision }, conversation); }
    };
}

export function queryFixture(tables) {
    const trace = [];
    const db = table => {
        let rows = structuredClone(tables[table] || []); let maximum = Infinity;
        const q = {
            where(criteria) { rows = rows.filter(r => Object.entries(criteria).every(([k, v]) => r[k] === v)); return q; },
            whereNull(key) { rows = rows.filter(r => r[key] == null); return q; },
            forUpdate() { trace.push({ table, lock: true }); return q; },
            select() { return q; }, limit(n) { maximum = n; return q; },
            first() { return Promise.resolve(rows[0]); }, then(resolve, reject) { return Promise.resolve(rows.slice(0, maximum)).then(resolve, reject); }
        };
        trace.push({ table }); return q;
    };
    db.trace = trace; return db;
}
