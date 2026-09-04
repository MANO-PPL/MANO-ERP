import { createHash } from 'node:crypto';

export class AgentError extends Error {
    constructor(code = 'validation_error', category = code) { super(category); this.code = code; this.category = category; }
}
export const fail = (code, category) => { throw new AgentError(code, category); };
export function object(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('validation_error', 'object_required');
    if (Object.keys(value).some(key => !keys.includes(key))) fail('validation_error', 'unknown_field');
    return value;
}
export function text(value, max = 4000, empty = false) {
    if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || value.includes('\0')) fail('validation_error', 'invalid_text');
    return value;
}
export function integer(value, min = 1, max = 4294967295) {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail('validation_error', 'invalid_integer');
    return value;
}
export function identity(value) {
    text(value, 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) fail('validation_error', 'invalid_identity');
    return value;
}
export function requestKey(value) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail('validation_error', 'invalid_request_key');
    return value;
}
export function dateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
        || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('validation_error', 'invalid_date');
    return value;
}
export function stable(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
    fail('validation_error', 'non_json_value');
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const fingerprint = value => sha256(stable(value));
export function validateRequest(value) {
    object(value, ['conversationId', 'message', 'context']);
    identity(value.conversationId); text(value.message);
    const c = object(value.context, ['route', 'module', 'organizationId', 'projectId', 'projectName', 'selectedEntityType', 'selectedEntityId']);
    text(c.route, 512); text(c.module, 80);
    const context = { route: c.route, module: c.module };
    if (c.projectId !== undefined) context.projectId = text(c.projectId, 80);
    if (c.projectName !== undefined) context.projectName = text(c.projectName, 200);
    for (const key of ['selectedEntityType', 'selectedEntityId']) if (c[key] !== undefined) context[key] = text(c[key], 80);
    // organizationId is intentionally not forwarded, persisted, or used for authorization.
    return { conversationId: value.conversationId, message: value.message, context };
}
export function validateDecision(value) {
    object(value, ['confirmationId', 'decision']); identity(value.confirmationId);
    if (!['confirm', 'cancel'].includes(value.decision)) fail('validation_error', 'invalid_decision');
    return value;
}
export function safeError(error) {
    const allowed = ['backend_unavailable', 'provider_unavailable', 'model_unavailable', 'network_failure', 'request_rejected', 'authorization_denied', 'confirmation_expired', 'validation_error', 'execution_failure', 'protocol_error'];
    return { code: allowed.includes(error?.code) ? error.code : 'execution_failure', retryable: false };
}
