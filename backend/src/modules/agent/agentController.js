import { randomUUID } from 'node:crypto';
import { getAgentService, createRuntimeLimits } from './agentRuntime.js';
import { fail, identity, integer, safeError, sha256 } from './agentValidation.js';

const limit = createRuntimeLimits();
export function actorFromRequest(req) {
    const token = req.cookies?.accessToken || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token || !req.user) fail('authorization_denied');
    return { userId: integer(Number(req.user.user_id || req.user.id)), orgId: integer(Number(req.user.org_id)), credentialHash: sha256(token) };
}
export function requireAgentOrigin(req, res, next) {
    try {
        if (req.method !== 'GET' && req.cookies?.accessToken) {
            const allowed = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', `http://${process.env.URI || '127.0.0.1'}:5173`,
                'https://erp.mano.co.in', 'https://mano.co.in', 'https://www.mano.co.in']);
            if (!allowed.has(req.headers.origin) || req.headers['x-agent-client'] !== 'mano-agent-v1') fail('authorization_denied', 'invalid_agent_origin');
        }
        next();
    } catch (error) { res.status(403).json({ error: safeError(error) }); }
}
export function createController(resolve = getAgentService, limiter = limit) {
    return operation => async (req, res) => {
        let heartbeat;
        let conversationId = req.body?.conversationId || req.headers['x-agent-conversation-id'];
        let requestId = req.headers['x-agent-request-id'];
        try {
            identity(conversationId); identity(requestId);
            const actor = actorFromRequest(req);
            res.status(200).set({ 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
            res.flushHeaders();
            heartbeat = setInterval(() => { if (!res.destroyed) res.write('\n'); }, 15000);
            const events = await limiter(actor, operation, async () => {
                const service = resolve();
                if (operation === 'request') {
                    const result = await service.submit(actor, req.body, req.headers['x-agent-client-request-key']);
                    res.locals.agentRequestId = result.requestId;
                    return result.events;
                }
                if (operation === 'decision') return service.decide(actor, req.body, conversationId);
                const after = req.query.after === undefined ? 0 : Number(req.query.after);
                integer(after, 0, 512);
                return service.replay(actor, identity(req.params.requestId), after);
            });
            for (const event of events) {
                if (event.conversationId !== conversationId) fail('authorization_denied', 'conversation_correlation');
                if (!res.destroyed) res.write(JSON.stringify({ ...event, serverRequestId: event.requestId, requestId }) + '\n');
            }
        } catch (error) {
            const payload = { eventId: randomUUID(), conversationId: typeof conversationId === 'string' ? conversationId : 'unavailable',
                requestId: typeof requestId === 'string' ? requestId : 'unavailable', type: 'agent_error', error: safeError(error) };
            if (!res.headersSent) res.status(error?.code === 'authorization_denied' ? 403 : 400).json({ error: safeError(error) });
            else if (!res.destroyed) res.write(JSON.stringify(payload) + '\n');
        } finally { clearInterval(heartbeat); if (!res.destroyed) res.end(); }
    };
}
