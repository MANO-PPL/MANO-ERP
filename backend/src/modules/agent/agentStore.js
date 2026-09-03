import { randomUUID } from 'node:crypto';
import { fail, fingerprint } from './agentValidation.js';
import { CONTRACT_VERSION } from './agentTools.js';
import { makeEvent } from './agentEvents.js';

export const DAY = 86400000;
export const decode = row => row && Object.fromEntries(Object.entries(row).map(([k, v]) => [k, k.endsWith('_json') && typeof v === 'string' ? JSON.parse(v) : v]));
const encode = row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, k.endsWith('_json') && v !== null ? JSON.stringify(v) : v]));
export function assertOwner(conversation, actor) {
    if (!conversation || Number(conversation.user_id) !== actor.userId || Number(conversation.org_id) !== actor.orgId) fail('authorization_denied');
}

export class AgentSession {
    constructor(trx, request, now) { this.trx = trx; this.request = decode(request); this.now = now; }
    async updateRequest(values) { await this.trx('agent_requests').where({ request_id: this.request.request_id }).update(encode(values)); Object.assign(this.request, values); }
    async executionAt(step) { return decode(await this.trx('agent_executions').where({ request_id: this.request.request_id, step_index: step }).forUpdate().first()); }
    async confirmation(id) { return decode(await this.trx('agent_executions').where({ request_id: this.request.request_id, confirmation_id: id }).forUpdate().first()); }
    async insertExecution(execution) { await this.trx('agent_executions').insert(encode(execution)); return execution; }
    async updateExecution(id, values) { await this.trx('agent_executions').where({ execution_id: id, request_id: this.request.request_id }).update(encode(values)); }
    async append(type, payload = {}, executionId = null, audit = type) {
        if (this.request.next_sequence > 512) fail('execution_failure', 'event_limit');
        const event = makeEvent(this.request, type, payload);
        await this.trx('agent_events').insert({ event_id: event.eventId, request_id: this.request.request_id, execution_id: executionId,
            sequence: this.request.next_sequence, type, payload_json: JSON.stringify(event), audit_category: audit, created_ms: this.now() });
        await this.updateRequest({ next_sequence: this.request.next_sequence + 1 });
        return event;
    }
}

export async function expireSession(session, timestamp) {
    if (session.request.status === 'RUNNING' && Number(session.request.lease_ms) <= timestamp) {
        await session.updateRequest({ status: 'FAILED', error_category: 'reasoning_interrupted' });
        await session.append('agent_error', { error: { code: 'backend_unavailable', retryable: false } });
        await session.append('conversation_completed');
    } else if (session.request.status === 'AWAITING_CONFIRMATION') {
        const execution = await session.executionAt(session.request.step_index);
        if (!execution || execution.status !== 'PENDING_CONFIRMATION') fail('execution_failure', 'pending_execution_integrity');
        if (Number(execution.confirmation_expires_ms) <= timestamp) {
            await session.updateExecution(execution.execution_id, { status: 'EXPIRED', completed_ms: timestamp, error_category: 'confirmation_expired' });
            await session.updateRequest({ status: 'EXPIRED' });
            await session.append('tool_failed', { actionId: execution.execution_id, error: { code: 'confirmation_expired', retryable: false } }, execution.execution_id);
            await session.append('conversation_completed');
        }
    }
}

export function createAgentStore(db, { now = Date.now } = {}) {
    const readRequest = async id => decode(await db('agent_requests').where({ request_id: id }).first());
    async function owned(requestId, actor) {
        const request = await readRequest(requestId);
        if (!request) fail('authorization_denied');
        assertOwner(await db('agent_conversations').where({ conversation_id: request.conversation_id }).first(), actor);
        return request;
    }
    async function transaction(requestId, actor, callback) {
        const existing = await owned(requestId, actor);
        return db.transaction(async trx => {
            const conversation = await trx('agent_conversations').where({ conversation_id: existing.conversation_id }).forUpdate().first();
            assertOwner(conversation, actor);
            const request = await trx('agent_requests').where({ request_id: requestId }).forUpdate().first();
            if (!request) fail('authorization_denied');
            return callback(new AgentSession(trx, request, now));
        });
    }
    return {
        db, now, owned, transaction,
        async begin(actor, body, key, generation) {
            return db.transaction(async trx => {
                const timestamp = now();
                await trx('agent_conversations').insert({ conversation_id: body.conversationId, org_id: actor.orgId, user_id: actor.userId,
                    status: 'OPEN', created_ms: timestamp, activity_ms: timestamp, expires_ms: timestamp + DAY }).onConflict('conversation_id').ignore();
                const conversation = await trx('agent_conversations').where({ conversation_id: body.conversationId }).forUpdate().first();
                assertOwner(conversation, actor);
                if (Number(conversation.expires_ms) <= timestamp || conversation.status !== 'OPEN') fail('request_rejected', 'conversation_expired');
                const pending = await trx('agent_requests').where({ conversation_id: body.conversationId }).whereIn('status', ['RUNNING', 'AWAITING_CONFIRMATION']).forUpdate().first();
                if (pending) await expireSession(new AgentSession(trx, pending, now), timestamp);
                const existing = decode(await trx('agent_requests').where({ conversation_id: body.conversationId, client_request_key: key }).first());
                const digest = fingerprint(body);
                if (existing) {
                    if (existing.fingerprint !== digest) fail('request_rejected', 'idempotency_payload_mismatch');
                    if (Number(existing.expires_ms) <= timestamp) fail('request_rejected', 'request_expired');
                    return { request: existing, fresh: false };
                }
                const active = await trx('agent_requests').where({ conversation_id: body.conversationId }).whereIn('status', ['RUNNING', 'AWAITING_CONFIRMATION']).first('request_id');
                if (active) fail('request_rejected', 'conversation_busy');
                const request = { request_id: randomUUID(), conversation_id: body.conversationId, client_request_key: key, fingerprint: digest,
                    context_json: body.context, status: 'RUNNING', reasoning_epoch: randomUUID(), lease_ms: Math.min(timestamp + 120000, Number(conversation.expires_ms)),
                    step_index: 0, next_sequence: 1, generation, registry_version: CONTRACT_VERSION, error_category: null,
                    created_ms: timestamp, expires_ms: Math.min(timestamp + DAY, Number(conversation.expires_ms)) };
                await trx('agent_requests').insert(encode(request));
                await trx('agent_conversations').where({ conversation_id: body.conversationId }).update({ activity_ms: timestamp });
                return { request, fresh: true };
            });
        },
        async findConfirmation(actor, id) {
            const execution = decode(await db('agent_executions').where({ confirmation_id: id }).first());
            if (!execution) fail('authorization_denied');
            return { execution, request: await owned(execution.request_id, actor) };
        },
        async events(actor, requestId, after = 0) {
            const request = await owned(requestId, actor);
            if (Number(request.expires_ms) <= now()) fail('request_rejected', 'replay_expired');
            const rows = await db('agent_events').where({ request_id: requestId }).where('sequence', '>', after).orderBy('sequence').limit(512);
            return rows.map(decode).filter(r => r.payload_json).map(r => ({ ...r.payload_json, sequence: r.sequence }));
        },
        async executions(actor, requestId) {
            await owned(requestId, actor);
            return (await db('agent_executions').where({ request_id: requestId }).orderBy('step_index').limit(4)).map(decode);
        },
        async cleanup() {
            const timestamp = now();
            // Bounded control-plane cleanup only. Identity tombstones are never reused.
            const pending = await db('agent_requests').whereIn('status', ['RUNNING', 'AWAITING_CONFIRMATION']).where('created_ms', '<=', timestamp - 120000)
                .select('request_id', 'conversation_id').limit(100);
            for (const request of pending) {
                const conversation = await db('agent_conversations').where({ conversation_id: request.conversation_id }).first();
                if (conversation) await transaction(request.request_id, { userId: Number(conversation.user_id), orgId: Number(conversation.org_id) }, session => expireSession(session, timestamp));
            }
            const expired = await db('agent_requests').where('expires_ms', '<=', timestamp).whereNotNull('context_json')
                .whereNotIn('status', ['RUNNING', 'AWAITING_CONFIRMATION']).select('request_id').limit(100);
            const ids = expired.map(r => r.request_id);
            if (ids.length) await db.transaction(async trx => {
                await trx('agent_requests').whereIn('request_id', ids).update({ context_json: null });
                await trx('agent_events').whereIn('request_id', ids).update({ payload_json: null });
                await trx('agent_executions').whereIn('request_id', ids).update({ args_json: null, preconditions_json: null, result_json: null });
            });
            const old = await db('agent_executions').where('created_ms', '<', timestamp - 90 * DAY).whereNotNull('scope_json')
                .whereNot('status', 'PENDING_CONFIRMATION').select('execution_id').limit(100);
            if (old.length) await db('agent_executions').whereIn('execution_id', old.map(e => e.execution_id)).update({ scope_json: null, credential_hash: null });
        }
    };
}
