import { object, text, integer, dateOnly, fail } from './agentValidation.js';

export const CONTRACT_VERSION = 'mano-agent-v1';
const list = { query: 'query?', limit: 'limit?', offset: 'offset?' };
const resource = { resourceId: 'id', projectId: 'id?', asOfDate: 'date?' };
const definitions = {
    'projects.search': { args: list, module: 'projects' },
    'projects.get': { args: { projectId: 'id' }, module: 'projects' },
    'clients.search': { args: list, module: 'clients' },
    'clients.get': { args: { contactId: 'id' }, module: 'clients' },
    'vendors.search': { args: list, module: 'vendors' },
    'vendors.get': { args: { contactId: 'id' }, module: 'vendors' },
    'resources.search': { args: { ...list, type: 'type?' }, module: 'materials' },
    'resources.get': { args: resource, module: 'materials' },
    'resources.getRate': { args: resource, module: 'materials' },
    'resources.getRateHistory': { args: { ...resource, limit: 'limit?', offset: 'offset?' }, module: 'materials' },
    'resources.getComposition': { args: resource, module: 'materials' },
    'projectParties.list': { args: { projectId: 'id', category: 'category?', limit: 'limit?', offset: 'offset?' }, module: 'parties' },
    'interactions.search': { args: { contactId: 'id', limit: 'limit?', offset: 'offset?' }, module: 'contacts' },
    'vendors.create': { args: { name: 'name', contact_person: 'name?', mobile: 'phone?', email: 'email?', address: 'address?' }, module: 'vendors', risk: 'WRITE' },
    'resources.createRateVersion': { args: { resourceId: 'id', projectId: 'id?', rate: 'rate', unit_code: 'unit', effective_from: 'date', remarks: 'remarks?' }, module: 'materials', risk: 'WRITE' }
};
export const TOOLS = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([name, d]) => [name,
    Object.freeze({ name, version: 1, risk: d.risk || 'READ', module: d.module, args: Object.freeze(d.args) })])));
// Deliberately not environment-configurable. Isolated real-MySQL proof and review are required before enabling live writes.
export const LIVE_WRITE_ENABLEMENT = Object.freeze({ 'vendors.create': false, 'resources.createRateVersion': false });
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
        else if (type === 'limit') integer(value, 1, 50);
        else if (type === 'offset') integer(value, 0, 10000);
        else if (type === 'date') dateOnly(value);
        else if (type === 'rate') {
            if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value)) fail('validation_error', 'invalid_rate');
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
