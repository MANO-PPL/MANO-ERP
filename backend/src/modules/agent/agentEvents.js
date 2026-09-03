import { randomUUID } from 'node:crypto';
import { fail } from './agentValidation.js';

export function makeEvent(request, type, payload = {}) {
    const event = { ...payload, type, eventId: randomUUID(), conversationId: request.conversation_id, requestId: request.request_id };
    if (Buffer.byteLength(JSON.stringify(event)) > 65536) fail('execution_failure', 'event_too_large');
    return event;
}
export function actionFor(tool, args) {
    return { actionType: tool.name, title: tool.name, riskLevel: tool.risk, affectedRecords: 1,
        fields: Object.entries(args).map(([label, value]) => ({ label, value })) };
}
export function resultCard(tool, result) {
    const rows = Array.isArray(result) ? result : [result];
    return { kind: 'list', title: tool.name, count: rows.length, items: rows.map(row => ({
        label: String(row.name ?? row.resourceName ?? row.type ?? row.id ?? tool.name),
        detail: JSON.stringify(row).slice(0, 4000)
    })) };
}
export function provenance(tool, scope, now) {
    return [{ label: 'Authorized ERP service result', tool: tool.name,
        entityId: String(scope.resource?.id ?? scope.contact?.id ?? scope.projectId ?? ''), timestamp: new Date(now).toISOString() }];
}
