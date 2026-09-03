import { randomBytes } from 'node:crypto';
import { initializeAgentSchema } from './agentSchema.js';
import { createAgentStore } from './agentStore.js';
import { createPolicy } from './agentPolicy.js';
import { createReadService } from './agentReadService.js';
import { createWriteService } from './agentWriteService.js';
import { createAgentService } from './agentService.js';
import { createPythonClient } from './agentPythonClient.js';
import { createSafeOkfProvider } from './safeOkfProvider.js';
import { fail } from './agentValidation.js';

export const agentInternalSecret = randomBytes(32).toString('hex');
let service;
let cleanup;
export function getAgentService() { if (!service) fail('backend_unavailable', 'agent_not_ready'); return service; }
export async function initializeAgentRuntime() {
    const [{ db }, projects, clients, vendors, resources, parties] = await Promise.all([
        import('../../config/database.js'), import('../projects/core/projectService.js'), import('../clients/clientService.js'),
        import('../vendors/vendorService.js'), import('../inventory/resourceService.js'), import('../projects/parties/partyService.js')
    ]);
    await initializeAgentSchema(db);
    const store = createAgentStore(db); const authorize = createPolicy(db); const okf = createSafeOkfProvider();
    await okf.acquire();
    service = createAgentService({ store, authorize, okf, reason: createPythonClient({ secret: agentInternalSecret }),
        read: createReadService({ db, projects, clients, vendors, resources, parties, authorize }), writes: createWriteService({ db, vendors, resources }) });
    cleanup = setInterval(() => store.cleanup().catch(() => { /* No request data or database diagnostics are logged. */ }), 60000);
    cleanup.unref();
    return service;
}

export function createRuntimeLimits({ now = Date.now } = {}) {
    const buckets = new Map(); const active = new Set(); let total = 0;
    return async function limited(actor, operation, work) {
        const timestamp = now();
        for (const [key, value] of buckets) if (value.until <= timestamp) buckets.delete(key);
        const keys = [`u:${actor.orgId}:${actor.userId}:${operation}`, `o:${actor.orgId}:${operation}`];
        for (const [index, key] of keys.entries()) {
            const limit = index ? 60 : operation === 'replay' ? 30 : 10;
            const bucket = buckets.get(key) || { count: 0, until: timestamp + 60000 };
            if (bucket.count >= limit || buckets.size > 5000) fail('request_rejected', 'agent_rate_limit');
            bucket.count++; buckets.set(key, bucket);
        }
        const owner = `${actor.orgId}:${actor.userId}`;
        if (operation !== 'replay' && (active.has(owner) || total >= 4)) fail('request_rejected', 'agent_concurrency_limit');
        if (operation !== 'replay') { active.add(owner); total++; }
        try { return await work(); } finally { if (operation !== 'replay') { active.delete(owner); total--; } }
    };
}
