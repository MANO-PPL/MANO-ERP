/**
 * Frontend adapter contracts. Context is a UI hint, never authorization.
 * Stage 12 owns authentication, risk classification, confirmation and execution.
 *
 * @typedef {{route: string, module: string, organizationId?: string,
 * projectId?: string, selectedEntityType?: string, selectedEntityId?: string}} AgentContext
 * @typedef {{conversationId: string, message: string, context: AgentContext}} AgentRequest
 * @typedef {{confirmationId: string, decision: 'confirm'|'cancel'}} AgentDecision
 * @typedef {{label: string, value?: string|number, before?: string|number,
 * after?: string|number}} AgentField
 * @typedef {{actionType: string, title: string,
 * description?: string, fields: AgentField[], riskLevel: 'READ'|'WRITE'|'DESTRUCTIVE'|'BULK_WRITE',
 * affectedRecords?: number, simulation?: boolean}} AgentAction
 * @typedef {(AgentAction & {confirmationId: string, expiresAt?: string})} AgentConfirmation
 * @typedef {{label: string, tool?: string, entityId?: string, timestamp?: string}} AgentProvenance
 * @typedef {{code: string, retryable?: boolean, retrySafety?: 'safe'}} AgentError
 * @typedef {({kind: 'list', title: string, count?: number, items: {label: string, detail?: string}[]}
 * | {kind: 'summary', title: string, fields: AgentField[]}
 * | {kind: 'table', title: string, columns: string[], rows: (string|number)[][]}
 * | {kind: 'warning', title: string, text: string}
 * | {kind: 'execution', title: string, outcome: 'success'|'failure', text: string, simulation?: boolean})} AgentResult
 * @typedef {{eventId: string, conversationId: string, requestId: string}} EventEnvelope
 * @typedef {(EventEnvelope & (
 * {type: 'message_started', messageId: string, role: 'assistant'|'status'}
 * | {type: 'text_delta', messageId: string, delta: string}
 * | {type: 'text_completed', messageId: string, text: string, result?: AgentResult, provenance?: AgentProvenance[]}
 * | {type: 'tool_proposed', actionId: string, action: AgentAction}
 * | {type: 'confirmation_required', confirmation: AgentConfirmation}
 * | {type: 'confirmation_resolved', confirmationId: string, decision: 'confirm'|'cancel'}
 * | {type: 'tool_started', actionId: string}
 * | {type: 'tool_completed', actionId: string, result: AgentResult, provenance?: AgentProvenance[]}
 * | {type: 'tool_failed'|'agent_error', error: AgentError}
 * | {type: 'conversation_completed'}))} AgentEvent
 * @typedef {{requestId: string, conversationId: string, signal: AbortSignal,
 * onEvent: (event: AgentEvent) => void}} TransportOptions
 * @typedef {{mode: 'preview'|'fixture'|'connected', supportsStop: boolean,
 * send: (request: AgentRequest, options: TransportOptions) => Promise<void>,
 * decide: (decision: AgentDecision, options: TransportOptions) => Promise<void>}} AgentTransport
 *
 * send resolves after a terminal event or confirmation_required. decide resolves
 * after the decision is acknowledged; further execution events may follow.
 * Abort stops response observation, not necessarily a server-side ERP action.
 * Execution success is accepted only in tool_completed, never text_completed.
 * Adapters must retain correlation IDs and map their wire protocol into these events.
 */

export const BUSY_STATES = new Set(['submitting', 'thinking', 'waiting_for_confirmation', 'executing']);
export const RISKS = ['READ', 'WRITE', 'DESTRUCTIVE', 'BULK_WRITE'];
export const ERROR_COPY = {
    backend_unavailable: 'The ERP agent backend is not connected yet.',
    network_failure: 'The connection was interrupted. The action outcome is unknown.',
    request_rejected: 'The request was rejected.',
    authorization_denied: 'You do not have permission for this request.',
    confirmation_expired: 'This confirmation has expired. Request a new proposal.',
    validation_error: 'Check the request and try again.',
    execution_failure: 'The action could not be completed.',
    protocol_error: 'The assistant received an unsupported response.',
};
export const isText = value => typeof value === 'string' && value.trim().length > 0;
const scalar = value => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
const fieldsValid = fields => Array.isArray(fields) && fields.every(field => field && isText(field.label)
    && ['value', 'before', 'after'].every(key => field[key] === undefined || scalar(field[key])));
export const isExpired = (confirmation, now = Date.now()) => confirmation.expiresAt !== undefined
    && (!Number.isFinite(Date.parse(confirmation.expiresAt)) || Date.parse(confirmation.expiresAt) <= now);

export function isAction(action, confirmation = false) {
    return !!action && isText(action.title) && isText(action.actionType) && RISKS.includes(action.riskLevel)
        && fieldsValid(action.fields) && (!confirmation || isText(action.confirmationId))
        && (action.description === undefined || typeof action.description === 'string')
        && (action.affectedRecords === undefined || (Number.isInteger(action.affectedRecords) && action.affectedRecords >= 0))
        && (action.expiresAt === undefined || typeof action.expiresAt === 'string');
}

export function isResult(result) {
    if (!result || !isText(result.title)) return false;
    if (result.kind === 'summary') return fieldsValid(result.fields);
    if (result.kind === 'warning') return isText(result.text);
    if (result.kind === 'list') return Array.isArray(result.items) && result.items.every(item => item && isText(item.label)
        && (item.detail === undefined || typeof item.detail === 'string'))
        && (result.count === undefined || (Number.isInteger(result.count) && result.count >= 0));
    if (result.kind === 'table') return Array.isArray(result.columns) && result.columns.length > 0
        && result.columns.every(isText) && Array.isArray(result.rows)
        && result.rows.every(row => Array.isArray(row) && row.length === result.columns.length && row.every(scalar));
    if (result.kind === 'execution') return ['success', 'failure'].includes(result.outcome) && typeof result.text === 'string';
    return false;
}

export function isAgentEvent(event) {
    if (!event || !['eventId', 'conversationId', 'requestId'].every(key => isText(event[key]))) return false;
    switch (event.type) {
        case 'message_started': return isText(event.messageId) && ['assistant', 'status'].includes(event.role);
        case 'text_delta': return isText(event.messageId) && typeof event.delta === 'string';
        case 'text_completed': return isText(event.messageId) && typeof event.text === 'string'
            && (event.result === undefined || (isResult(event.result) && event.result.kind !== 'execution'));
        case 'tool_proposed': return isText(event.actionId) && isAction(event.action);
        case 'confirmation_required': return isAction(event.confirmation, true);
        case 'confirmation_resolved': return isText(event.confirmationId) && ['confirm', 'cancel'].includes(event.decision);
        case 'tool_started': return isText(event.actionId);
        case 'tool_completed': return isText(event.actionId) && isResult(event.result);
        case 'tool_failed':
        case 'agent_error': return !!event.error && Object.hasOwn(ERROR_COPY, event.error.code);
        case 'conversation_completed': return true;
        default: return false;
    }
}

// An exact allowlist prevents an unconnected adapter from displaying ERP cards.
export function isPreviewEvent(event) {
    return ['message_started', 'text_delta', 'text_completed', 'agent_error', 'conversation_completed'].includes(event.type)
        && event.result === undefined;
}

export function createDecision(confirmationId, decision) {
    if (!isText(confirmationId) || !['confirm', 'cancel'].includes(decision)) throw new Error('Invalid confirmation decision');
    return { confirmationId, decision };
}

export function safeError(error = {}) {
    const code = Object.hasOwn(ERROR_COPY, error.code) ? error.code : 'protocol_error';
    return { code, message: ERROR_COPY[code], retryable: error.retryable === true && error.retrySafety === 'safe' };
}
