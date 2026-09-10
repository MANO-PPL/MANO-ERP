import { randomUUID } from 'node:crypto';
import { getAgentService, createRuntimeLimits } from './agentRuntime.js';
import { fail, identity, integer, safeError, sha256 } from './agentValidation.js';
import { parseSpreadsheet } from './agentUploadService.js';
import { getExportedDataset } from './agentExportService.js';

const limit = createRuntimeLimits();
export function actorFromRequest(req) {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    const token = bearer || req.cookies?.accessToken;
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
        if (operation === 'export') {
            try {
                const actor = actorFromRequest(req);
                const downloadId = req.params.downloadId;
                identity(downloadId);
                const dataset = getExportedDataset(downloadId, actor.orgId);
                if (!dataset) {
                    return res.status(404).json({ error: 'Export file not found or expired' });
                }
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${dataset.filename}"`);
                res.setHeader('Content-Length', dataset.buffer.length);
                return res.status(200).send(dataset.buffer);
            } catch (error) {
                return res.status(error?.code === 'authorization_denied' ? 403 : 400).json({ error: safeError(error) });
            }
        }
        if (operation === 'upload') {
            try {
                const actor = actorFromRequest(req);
                if (!req.file) fail('validation_error', 'no_file_uploaded');
                const result = await parseSpreadsheet(req.file.buffer, req.file.originalname, actor.orgId);
                return res.status(200).json(result);
            } catch (error) {
                return res.status(error?.code === 'authorization_denied' ? 403 : 400).json({ error: safeError(error) });
            }
        }
        let heartbeat;
        let conversationId = req.body?.conversationId || req.headers['x-agent-conversation-id'];
        let requestId = req.headers['x-agent-request-id'];
        try {
            identity(conversationId); identity(requestId);
            const actor = actorFromRequest(req);
            res.status(200).set({ 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
            res.flushHeaders();
            heartbeat = setInterval(() => { if (!res.destroyed) res.write('\n'); }, 15000);

            /**
             * Write a single event to the NDJSON stream immediately.
             * Used both for the live streaming callback and for batch fallback.
             */
            const writeEvent = event => {
                if (event.conversationId !== conversationId) fail('authorization_denied', 'conversation_correlation');
                if (!res.destroyed) res.write(JSON.stringify({ ...event, serverRequestId: event.requestId, requestId }) + '\n');
            };

            const events = await limiter(actor, operation, async () => {
                const service = await resolve();
                if (operation === 'request') {
                    // For a fresh request, pass a live onStreamEvent callback so each event
                    // is written to the HTTP response immediately as reasoning progresses.
                    // For idempotent retries (non-fresh), the callback is ignored inside
                    // submit() since the inflight promise has already resolved, and we fall
                    // back to the batch event array returned below.
                    let liveStreamUsed = false;
                    const onStreamEvent = event => {
                        liveStreamUsed = true;
                        writeEvent(event);
                    };
                    const result = await service.submit(actor, req.body, req.headers['x-agent-client-request-key'], onStreamEvent);
                    res.locals.agentRequestId = result.requestId;
                    // If events were already streamed live, return an empty array to avoid
                    // writing duplicates. For non-fresh idempotent replays, return the full list.
                    return liveStreamUsed ? [] : result.events;
                }
                if (operation === 'decision') return service.decide(actor, req.body, conversationId);
                const after = req.query.after === undefined ? 0 : Number(req.query.after);
                integer(after, 0, 512);
                return service.replay(actor, identity(req.params.requestId), after);
            });

            // Batch path: write any remaining events (decision, replay, or non-fresh request)
            for (const event of events) { writeEvent(event); }
        } catch (error) {
            const payload = { eventId: randomUUID(), conversationId: typeof conversationId === 'string' ? conversationId : 'unavailable',
                requestId: typeof requestId === 'string' ? requestId : 'unavailable', type: 'agent_error', error: safeError(error) };
            if (!res.headersSent) res.status(error?.code === 'authorization_denied' ? 403 : 400).json({ error: safeError(error) });
            else if (!res.destroyed) res.write(JSON.stringify(payload) + '\n');
        } finally { clearInterval(heartbeat); if (!res.destroyed) res.end(); }
    };
}
