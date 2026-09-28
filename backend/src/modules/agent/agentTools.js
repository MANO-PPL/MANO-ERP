import { object, text, integer, dateOnly, uuid, fail } from './agentValidation.js';

export const CONTRACT_VERSION = 'mano-agent-v1';
const list = { query: 'query?', limit: 'limit?', offset: 'offset?' };
const resource = { resourceId: 'id', projectId: 'id?', asOfDate: 'date?' };
const contactEdit = { name: 'name?', contact_person: 'name?', mobile: 'phone?', email: 'email?', address: 'address?', location: 'name?', remarks: 'remarks?' };
const definitions = {
    'resources.create': { args: { name: 'name', type: 'type', base_unit_code: 'unit', code: 'name?', description: 'remarks?', remarks: 'remarks?' }, module: 'materials', risk: 'WRITE' },
    'resources.update': { args: { resourceId: 'id', projectId: 'id?', name: 'name?', code: 'name?', description: 'remarks?', remarks: 'remarks?' }, module: 'materials', risk: 'WRITE' },
    'resources.addConversion': { args: { resourceId: 'id', projectId: 'id?', name: 'name', quantity: 'quantity', unit_code: 'unit' }, module: 'materials', risk: 'WRITE' },
    'clients.bulkImport': { args: { uploadId: 'uuid', mapping: 'mapping?' }, module: 'clients', risk: 'BULK_WRITE' },
    'clients.create': { args: { ...contactEdit, name: 'name' }, module: 'clients', risk: 'WRITE' },
    'clients.update': { args: { contactId: 'id', ...contactEdit }, module: 'clients', risk: 'WRITE' },
    'vendors.update': { args: { contactId: 'id', ...contactEdit }, module: 'vendors', risk: 'WRITE' },
    'clients.addInteraction': { args: { contactId: 'id', type: 'interactionType', interaction_date: 'date', follow_up_date: 'date?', remarks: 'remarks?' }, module: 'clients', risk: 'WRITE' },
    'projects.create': { args: { name: 'name', location: 'name?', project_code: 'name?', start_date: 'date?', end_date: 'date?' }, module: 'projects', risk: 'WRITE' },
    'projects.update': { args: { projectId: 'id', name: 'name?', location: 'name?', project_code: 'name?', start_date: 'date?', end_date: 'date?' }, module: 'projects', risk: 'WRITE' },
    'tasks.create': { args: { projectId: 'id', categoryName: 'name', name: 'name', description: 'remarks?', status: 'taskStatus?', priority: 'taskPriority?', start_date: 'date?', due_date: 'date?' }, module: 'projects', risk: 'WRITE' },
    'tasks.update': { args: { projectId: 'id', taskId: 'id', name: 'name?', description: 'remarks?', status: 'taskStatus?', priority: 'taskPriority?', start_date: 'date?', due_date: 'date?' }, module: 'projects', risk: 'WRITE' },
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
export const RUNTIME_WRITE_ENABLEMENT = Object.freeze({ 'resources.create': true, 'resources.update': true, 'resources.addConversion': true, 'clients.bulkImport': true, 'clients.create': true, 'clients.update': true, 'clients.addInteraction': true, 'vendors.update': true, 'vendors.create': true, 'vendors.bulkImport': true, 'resources.createRateVersion': true, 'approvals.decide': true, 'approvals.batchDecide': true, 'projects.create': true, 'projects.update': true, 'tasks.create': true, 'tasks.update': true });
export function allowedToolsForRequest(context, message, enablement) {
    const modules = new Set();
    const page = `${context?.module || ''} ${context?.route || ''}`.toLowerCase();
    const explicit = String(message || '').toLowerCase();
    for (const [module, pattern] of [['clients', /\bclients?\b/], ['vendors', /\b(vendors?|suppliers?|contractors?)\b/], ['materials', /\b(resources?|materials?|rates?)\b/], ['projects', /\b(projects?|tasks?|approvals?|approve|reject|meetings?|agendas?|mom|minutes|directory|summar(?:y|ies)|observations?|quality|checklists?|methodolog)\b/], ['parties', /\b(part(?:y|ies)|stakeholders?|contractors?)\b/]]) {
        if (pattern.test(page) || pattern.test(explicit)) modules.add(module);
    }
    return Object.values(TOOLS).filter(tool => tool.risk === 'READ' || (enablement[tool.name] === true && modules.has(tool.module))).map(tool => tool.name);
}
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
        else if (type === 'interactionType') {
            if (!['email', 'whatsapp', 'call', 'site visit', 'meeting'].includes(value)) fail('validation_error', 'invalid_interaction_type');
        }
        else if (type === 'taskStatus') {
            if (!['open', 'in progress', 'on hold', 'completed', 'cancelled'].includes(value)) fail('validation_error', 'invalid_task_status');
        }
        else if (type === 'taskPriority') {
            if (!['Urgent', 'High', 'Medium', 'Low', 'None'].includes(value)) fail('validation_error', 'invalid_task_priority');
        }
        } else if (type === 'quantity') {
            if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,6})?$/.test(value) || Number(value) <= 0) fail('validation_error', 'invalid_quantity');
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
    if (['clients.update', 'vendors.update'].includes(tool.name) && Object.keys(args).every(key => key === 'contactId')) fail('validation_error', 'empty_update');
    if (tool.name === 'resources.update' && !['name', 'code', 'description', 'remarks'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name === 'projects.update' && !['name', 'location', 'project_code', 'start_date', 'end_date'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name.startsWith('projects.') && tool.risk === 'WRITE' && args.start_date && args.end_date && args.end_date < args.start_date) fail('validation_error', 'invalid_project_dates');
    if (tool.name === 'tasks.update' && !['name', 'description', 'status', 'priority', 'start_date', 'due_date'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name.startsWith('tasks.') && tool.risk === 'WRITE' && args.start_date && args.due_date && args.due_date < args.start_date) fail('validation_error', 'invalid_task_dates');
    if (args.follow_up_date && args.follow_up_date < args.interaction_date) fail('validation_error', 'invalid_follow_up_date');
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
