import { object, text, integer, dateOnly, uuid, fail } from './agentValidation.js';

export const CONTRACT_VERSION = 'mano-agent-v1';
const list = { query: 'query?', limit: 'limit?', offset: 'offset?' };
const resource = { resourceId: 'id', projectId: 'id?', asOfDate: 'date?' };
const definitions = {
    'projects.search': { args: list, module: 'projects' },
    'projects.get': { args: { projectId: 'id' }, module: 'projects' },
    'projects.getExecutiveBriefing': { args: { projectId: 'id' }, module: 'projects' },
    'tasks.search': { args: { ...list, projectId: 'id?' }, module: 'projects' },
    'clients.search': { args: list, module: 'clients' },
    'clients.get': { args: { contactId: 'id' }, module: 'clients' },
    'vendors.search': { args: list, module: 'vendors' },
    'vendors.get': { args: { contactId: 'id' }, module: 'vendors' },
    'resources.search': { args: { ...list, type: 'type?' }, module: 'materials' },
    'resources.get': { args: resource, module: 'materials' },
    'resources.getRate': { args: resource, module: 'materials' },
    'resources.getRateHistory': { args: { ...resource, limit: 'limit?', offset: 'offset?' }, module: 'materials' },
    'resources.getComposition': { args: resource, module: 'materials' },
    'resources.simulateCostImpact': { args: { resourceId: 'id?', resourceName: 'name?', rateDelta: 'signedRate?', percentageDelta: 'percentage?', newRate: 'rate?', projectId: 'id?' }, module: 'materials' },
    'projectParties.list': { args: { projectId: 'id', category: 'category?', limit: 'limit?', offset: 'offset?' }, module: 'parties' },
    'interactions.search': { args: { contactId: 'id', limit: 'limit?', offset: 'offset?' }, module: 'contacts' },
    'analytics.query': { args: { entity: 'entity', dimension: 'dimension?', metric: 'metric?', visualization: 'viz?', limit: 'limit?' }, module: 'analytics' },
    'transactions.search': { args: { ...list, projectId: 'id?' }, module: 'projects' },
    'billing.search': { args: { ...list, projectId: 'id?', type: 'type?' }, module: 'projects' },
    'reports.exportExcel': { args: { entity: 'exportEntity', query: 'query?', limit: 'exportLimit?' }, module: 'projects' },
    'reports.getDPR': { args: { projectId: 'id?', date: 'date?', dprId: 'id?', limit: 'limit?' }, module: 'projects' },
    'reports.getWPR': { args: { projectId: 'id?', date: 'date?', startDate: 'date?', endDate: 'date?', weekNumber: 'id?' }, module: 'projects' },
    'reports.getMPR': { args: { projectId: 'id?', date: 'date?', month: 'id?', year: 'id?' }, module: 'projects' },
    'approvals.listPending': { args: { projectId: 'id?', limit: 'limit?', offset: 'offset?' }, module: 'projects' },
    'approvals.decide': { args: { itemType: 'itemType', itemId: 'id', action: 'action', comments: 'remarks?' }, module: 'projects', risk: 'WRITE' },
    'approvals.batchDecide': { args: { itemType: 'itemType?', action: 'action', comments: 'remarks?' }, module: 'projects', risk: 'WRITE' },
    'vendors.create': { args: { name: 'name', contact_person: 'name?', mobile: 'phone?', email: 'email?', address: 'address?' }, module: 'vendors', risk: 'WRITE' },
    'vendors.bulkImport': { args: { uploadId: 'uuid', mapping: 'mapping?' }, module: 'vendors', risk: 'BULK_WRITE' },
    'resources.createRateVersion': { args: { resourceId: 'id', projectId: 'id?', rate: 'rate', unit_code: 'unit', effective_from: 'date', remarks: 'remarks?' }, module: 'materials', risk: 'WRITE' }
};
export const TOOLS = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([name, d]) => [name,
    Object.freeze({ name, version: 1, risk: d.risk || 'READ', module: d.module, args: Object.freeze(d.args) })])));
// Deliberately not environment-configurable baseline. Runtime enables writes via agentRuntime configuration.
export const LIVE_WRITE_ENABLEMENT = Object.freeze({ 'vendors.create': false, 'resources.createRateVersion': false, 'approvals.decide': false, 'approvals.batchDecide': false });
export const RUNTIME_WRITE_ENABLEMENT = Object.freeze({ 'vendors.create': true, 'vendors.bulkImport': true, 'resources.createRateVersion': true, 'approvals.decide': true, 'approvals.batchDecide': true });
export function validateIntent(intent) {
    object(intent, ['kind', 'tool', 'version', 'arguments']);
    if (intent.kind !== 'tool') fail('validation_error', 'invalid_intent');
    const tool = Object.hasOwn(TOOLS, intent.tool) ? TOOLS[intent.tool] : null;
    if (!tool || intent.version !== tool.version) fail('validation_error', 'unknown_tool_or_version');
    const args = object(intent.arguments, Object.keys(tool.args));
    for (const [key, declaration] of Object.entries(tool.args)) {
        if (args[key] === undefined && declaration.endsWith('?')) continue;
        const type = declaration.replace('?', ''); const value = args[key];
        if (type === 'id') integer(value);
        else if (type === 'uuid') uuid(value);
        else if (type === 'limit') integer(value, 1, 50);
        else if (type === 'exportLimit') integer(value, 1, 500);
        else if (type === 'offset') integer(value, 0, 10000);
        else if (type === 'date') dateOnly(value);
        else if (type === 'exportEntity') {
            text(value, 40);
            if (!['vendors', 'projects', 'clients', 'resources', 'materials', 'approvals', 'transactions', 'billing'].includes(value.toLowerCase())) {
                fail('validation_error', 'invalid_export_entity');
            }
        }
        else if (type === 'entity') {
            text(value, 40);
            if (!['vendors', 'projects', 'clients', 'resources', 'interactions', 'materials', 'suppliers', 'vendor', 'project',
                  'client', 'customer', 'customers', 'transactions', 'approvals', 'billing', 'bills', 'invoices', 'overview', 'tasks', 'task'].includes(value.toLowerCase())) {
                fail('validation_error', 'invalid_analytics_entity');
            }
        } else if (type === 'dimension') {
            text(value, 40);
            if (!['category', 'status', 'sector', 'type', 'location', 'month', 'unit',
                  'site', 'worker_type', 'date_range'].includes(value.toLowerCase())) {
                fail('validation_error', 'invalid_analytics_dimension');
            }
        } else if (type === 'metric') {
            text(value, 40);
        } else if (type === 'viz') {
            text(value, 20);
            if (!['bar', 'donut', 'metric', 'table', 'line'].includes(value.toLowerCase())) {
                fail('validation_error', 'invalid_visualization_type');
            }
        } else if (type === 'mapping') {
            if (value !== undefined) {
                if (!value || typeof value !== 'object' || Array.isArray(value)) fail('validation_error', 'invalid_mapping');
                for (const [k, v] of Object.entries(value)) {
                    text(k, 60);
                    text(v, 120);
                }
            }
        } else if (type === 'rate') {
            if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value)) fail('validation_error', 'invalid_rate');
        } else if (type === 'signedRate') {
            if (typeof value !== 'string' || !/^[+-]?(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value)) fail('validation_error', 'invalid_signed_rate');
        } else if (type === 'percentage') {
            integer(value, -100, 500);
        } else if (type === 'itemType') {
            text(value, 40);
            if (!['qaqc_observation', 'document_cycle', 'milestone_task', 'all'].includes(value.toLowerCase())) {
                fail('validation_error', 'invalid_item_type');
            }
        } else if (type === 'action') {
            text(value, 20);
            if (!['approve', 'reject'].includes(value.toLowerCase())) {
                fail('validation_error', 'invalid_action');
            }
        } else {
            text(value, ({ query: 120, name: 120, phone: 32, email: 254, address: 500, unit: 30, remarks: 500, type: 20, category: 30 })[type]);
            if (type === 'type' && !['material', 'labour', 'item'].includes(value)) fail('validation_error', 'invalid_resource_type');
            if (type === 'category' && !['Supplier', 'Contractor', 'Consultant', 'Manufacturer', 'Service Provider', 'Client', 'PMC'].includes(value)) fail('validation_error', 'invalid_category');
            if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail('validation_error', 'invalid_email');
        }
    }
    return { tool, args: structuredClone(args) };
}
export function validateModelResponse(value) {
    if (value?.kind === 'tool') { validateIntent(value); return value; }
    object(value, ['kind', 'text', 'sources']);
    if (value.kind !== 'assistant') fail('protocol_error', 'invalid_model_response');
    text(value.text, 8000);
    if (!Array.isArray(value.sources) || value.sources.length > 10) fail('protocol_error', 'invalid_sources');
    for (const source of value.sources) text(source, 100);
    return value;
}
