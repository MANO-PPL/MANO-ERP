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
    'tasks.deleteSelected': { args: { projectId: 'id', taskIds: 'idList' }, module: 'projects', risk: 'BULK_WRITE' },
    // Phase 2 project-delivery operations. These deliberately operate only on
    // existing, in-scope records. The member operation is admin-only and does
    // not accept a permission payload, so it cannot grant arbitrary access.
    'projectParties.add': { args: { projectId: 'id', contactId: 'id' }, module: 'parties', risk: 'WRITE' },
    'projectParties.update': { args: { projectId: 'id', projectPartyId: 'id', ...contactEdit }, module: 'parties', risk: 'WRITE' },
    'projects.assignMember': { args: { projectId: 'id', userId: 'id' }, module: 'projects', risk: 'WRITE' },
    'projects.setMemberPermissions': { args: { projectId: 'id', userId: 'id', expectedName: 'name', permissions: 'projectPermissions' }, module: 'projects', risk: 'WRITE' },
    'tasks.assign': { args: { projectId: 'id', taskId: 'id', assigneeIds: 'idList' }, module: 'projects', risk: 'WRITE' },
    'tasks.createCategory': { args: { projectId: 'id', name: 'name' }, module: 'projects', risk: 'WRITE' },
    'tasks.updateCategory': { args: { projectId: 'id', categoryId: 'id', name: 'name' }, module: 'projects', risk: 'WRITE' },
    'tasks.reorder': { args: { projectId: 'id', type: 'reorderType', items: 'orderItems' }, module: 'projects', risk: 'WRITE' },
    'meetings.create': { args: { projectId: 'id', subject: 'name', venue: 'name?', date: 'date?', time: 'time?', status: 'meetingStatus?', agendaPoints: 'points?', momPoints: 'points?' }, module: 'documents', risk: 'WRITE' },
    'meetings.update': { args: { projectId: 'id', meetingId: 'id', subject: 'name?', venue: 'name?', date: 'date?', time: 'time?', status: 'meetingStatus?', agendaPoints: 'points?', momPoints: 'points?' }, module: 'documents', risk: 'WRITE' },
    'directory.create': { args: { projectId: 'id', partyId: 'id?', contact_person: 'name', designation: 'name?', responsibilities: 'remarks?', mobile_no: 'phone?', email: 'email?', address_line: 'address?' }, module: 'documents', risk: 'WRITE' },
    'directory.update': { args: { projectId: 'id', directoryId: 'id', partyId: 'id?', contact_person: 'name?', designation: 'name?', responsibilities: 'remarks?', mobile_no: 'phone?', email: 'email?', address_line: 'address?' }, module: 'documents', risk: 'WRITE' },
    'summaries.create': { args: { projectId: 'id', title: 'name', details: 'remarks', status: 'summaryStatus?', date: 'date?' }, module: 'documents', risk: 'WRITE' },
    'summaries.update': { args: { projectId: 'id', summaryId: 'id', title: 'name?', details: 'remarks?', status: 'summaryStatus?', date: 'date?' }, module: 'documents', risk: 'WRITE' },
    'documents.saveDraft': { args: { projectId: 'id', cycleId: 'id', content: 'json' }, module: 'documents', risk: 'WRITE' },
    'documents.submitDraft': { args: { projectId: 'id', cycleId: 'id', changes_summary: 'remarks?', comments: 'remarks?' }, module: 'documents', risk: 'WRITE' },
    'documents.requestRevision': { args: { projectId: 'id', cycleId: 'id', comments: 'remarks?' }, module: 'documents', risk: 'WRITE' },
    'documents.cancelCycle': { args: { projectId: 'id', cycleId: 'id', comments: 'remarks?' }, module: 'documents', risk: 'WRITE' },
    'documents.claimRevision': { args: { projectId: 'id', cycleId: 'id' }, module: 'documents', risk: 'WRITE' },
    'documents.archiveInstance': { args: { projectId: 'id', instanceId: 'id' }, module: 'documents', risk: 'WRITE' },
    'documentCycles.search': { args: { projectId: 'id', query: 'query?', limit: 'limit?', offset: 'offset?' }, module: 'documents' },
    'documentInstances.search': { args: { projectId: 'id', query: 'query?', limit: 'limit?', offset: 'offset?' }, module: 'documents' },
    'documentTemplates.create': { args: { projectId: 'id', name: 'name', docType: 'docType', description: 'remarks?' }, module: 'documents', risk: 'WRITE' },
    'documentTemplates.update': { args: { projectId: 'id', documentId: 'id', expectedName: 'name', name: 'name?', description: 'remarks?' }, module: 'documents', risk: 'WRITE' },
    'adminDepartments.create': { args: { name: 'name' }, module: 'admin', risk: 'WRITE' },
    'adminDesignations.create': { args: { name: 'name' }, module: 'admin', risk: 'WRITE' },
    'adminSectors.create': { args: { name: 'name' }, module: 'admin', risk: 'WRITE' },
    'adminJobNatures.create': { args: { name: 'name' }, module: 'admin', risk: 'WRITE' },
    'permissionTemplates.create': { args: { name: 'name', type: 'permissionType', permissions: 'templatePermissions' }, module: 'admin', risk: 'WRITE' },
    'permissionTemplates.update': { args: { templateId: 'id', type: 'permissionType', expectedName: 'name', name: 'name?', permissions: 'templatePermissions?' }, module: 'admin', risk: 'WRITE' },
    'adminUsers.updateProfile': { args: { userId: 'id', expectedName: 'name', user_name: 'name?', email: 'email?', phone_no: 'phone?' }, module: 'admin', risk: 'WRITE' },
    'adminUsers.setSystemPermissions': { args: { userId: 'id', expectedName: 'name', permissions: 'systemPermissions' }, module: 'admin', risk: 'WRITE' },
    'qualityObservations.create': { args: { projectId: 'id', location: 'name', note: 'remarks' }, module: 'quality', risk: 'WRITE' },
    'qualityObservations.update': { args: { projectId: 'id', observationId: 'id', location: 'name?', note: 'remarks?' }, module: 'quality', risk: 'WRITE' },
    'qualityObservations.submitFix': { args: { projectId: 'id', observationId: 'id', uploadId: 'uuid', note: 'remarks?' }, module: 'quality', risk: 'WRITE' },
    'qualityMethodologies.create': { args: { projectId: 'id', title: 'name', uploadId: 'uuid' }, module: 'quality', risk: 'WRITE' },
    'qualityMethodologies.update': { args: { projectId: 'id', documentId: 'id', title: 'name?', uploadId: 'uuid' }, module: 'quality', risk: 'WRITE' },
    'qualityChecklists.create': { args: { projectId: 'id', title: 'name', uploadId: 'uuid' }, module: 'quality', risk: 'WRITE' },
    'qualityChecklists.update': { args: { projectId: 'id', documentId: 'id', title: 'name?', uploadId: 'uuid' }, module: 'quality', risk: 'WRITE' },
    'projects.search': { args: list, module: 'projects' },
    'adminUsers.search': { args: list, module: 'admin' },
    'permissionTemplates.search': { args: list, module: 'admin' },
    'documentTemplates.search': { args: { ...list, projectId: 'id' }, module: 'documents' },
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
export const RUNTIME_WRITE_ENABLEMENT = Object.freeze({ 'resources.create': true, 'resources.update': true, 'resources.addConversion': true, 'clients.bulkImport': true, 'clients.create': true, 'clients.update': true, 'clients.addInteraction': true, 'vendors.update': true, 'vendors.create': true, 'vendors.bulkImport': true, 'resources.createRateVersion': true, 'approvals.decide': true, 'approvals.batchDecide': true, 'projects.create': true, 'projects.update': true, 'projectParties.add': true, 'projectParties.update': true, 'projects.assignMember': true, 'projects.setMemberPermissions': true, 'tasks.create': true, 'tasks.update': true, 'tasks.deleteSelected': true, 'tasks.assign': true, 'tasks.createCategory': true, 'tasks.updateCategory': true, 'tasks.reorder': true, 'meetings.create': true, 'meetings.update': true, 'directory.create': true, 'directory.update': true, 'summaries.create': true, 'summaries.update': true, 'documents.saveDraft': true, 'documents.submitDraft': true, 'documents.requestRevision': true, 'documents.cancelCycle': true, 'documents.claimRevision': true, 'documents.archiveInstance': true, 'documentTemplates.create': true, 'documentTemplates.update': true, 'adminDepartments.create': true, 'adminDesignations.create': true, 'adminSectors.create': true, 'adminJobNatures.create': true, 'permissionTemplates.create': true, 'permissionTemplates.update': true, 'adminUsers.updateProfile': true, 'adminUsers.setSystemPermissions': true, 'qualityObservations.create': true, 'qualityObservations.update': true, 'qualityObservations.submitFix': true, 'qualityMethodologies.create': true, 'qualityMethodologies.update': true, 'qualityChecklists.create': true, 'qualityChecklists.update': true });
export function allowedToolsForRequest(context, message, enablement) {
    const modules = new Set();
    const page = `${context?.module || ''} ${context?.route || ''}`.toLowerCase();
    const explicit = String(message || '').toLowerCase();
    for (const [module, pattern] of [['clients', /\bclients?\b/], ['vendors', /\b(vendors?|suppliers?|contractors?)\b/], ['materials', /\b(resources?|materials?|rates?)\b/], ['projects', /\b(projects?|tasks?|approvals?|approve|reject|members?)\b/], ['parties', /\b(part(?:y|ies)|stakeholders?|contractors?)\b/], ['documents', /\b(meetings?|agendas?|mom|minutes|directory|summar(?:y|ies)|documents?|drafts?|workflows?|cycles?|revisions?|archiv(?:e|ing))\b/], ['quality', /\b(observations?|quality|checklists?|methodolog(?:y|ies)|corrective|rectif)\b/], ['admin', /\b(admin|departments?|designations?|sectors?|job natures?|permission templates?|users?|employees?)\b/]]) {
        if (pattern.test(page) || pattern.test(explicit)) modules.add(module);
    }
    if (/\bdocument\s+templates?\b/.test(explicit)) modules.add('documents');
    const available = Object.values(TOOLS).filter(tool => tool.risk === 'READ' || (enablement[tool.name] === true && modules.has(tool.module)));
    // The Python protocol caps allowed tools at 50. A multi-domain request can
    // otherwise cross that bound after adding Phase 2 operations; keep every
    // enabled write and only module-relevant reads in that exceptional case.
    const bounded = available.length > 50
        ? available.filter(tool => tool.risk !== 'READ' || modules.has(tool.module))
        : available;
    return bounded.slice(0, 50).map(tool => tool.name);
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
        else if (type === 'docType') {
            if (!['singleton', 'episodic'].includes(value)) fail('validation_error', 'invalid_document_type');
        }
        else if (type === 'permissionType') {
            if (!['system', 'project'].includes(value)) fail('validation_error', 'invalid_permission_type');
        }
        else if (type === 'projectPermissions' || type === 'templatePermissions') {
            if (!value || typeof value !== 'object' || Array.isArray(value)) fail('validation_error', 'invalid_permission_map');
            const projectKeys = ['Tasks', 'WIP', 'Reports', 'General Documents', 'Drawings', 'Planning', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management', 'Approvals'];
            const systemKeys = ['projects', 'vendors', 'clients', 'resources', 'units', 'collaboration', 'admin'];
            const keys = type === 'projectPermissions' || args.type === 'project' ? projectKeys : systemKeys;
            if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail('validation_error', 'invalid_permission_map');
            if (type === 'projectPermissions') {
                if (Object.values(value).some(level => !['none', 'view', 'edit'].includes(level))) fail('validation_error', 'invalid_permission_map');
            } else if (Object.values(value).some(level => !Number.isInteger(level) || level < 0 || level > 2)) {
                fail('validation_error', 'invalid_permission_map');
            }
        }
        else if (type === 'systemPermissions') {
            if (!value || typeof value !== 'object' || Array.isArray(value)) fail('validation_error', 'invalid_permission_map');
            const keys = ['projects', 'vendors', 'clients', 'resources', 'units', 'collaboration', 'admin'];
            if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
                || Object.values(value).some(level => !['none', 'view', 'edit'].includes(level))) fail('validation_error', 'invalid_permission_map');
        }
        else if (type === 'idList') {
            if (!Array.isArray(value) || value.length < 1 || value.length > 20) fail('validation_error', 'invalid_id_list');
            for (const id of value) integer(id);
            if (new Set(value).size !== value.length) fail('validation_error', 'duplicate_id');
        } else if (type === 'orderItems') {
            if (!Array.isArray(value) || value.length < 1 || value.length > 50) fail('validation_error', 'invalid_order_items');
            const ids = new Set();
            for (const item of value) {
                object(item, ['id', 'sortOrder']); integer(item.id); integer(item.sortOrder, 0, 1000000);
                if (ids.has(item.id)) fail('validation_error', 'duplicate_order_item');
                ids.add(item.id);
            }
        } else if (type === 'reorderType') {
            if (!['task', 'category'].includes(value)) fail('validation_error', 'invalid_reorder_type');
        } else if (type === 'points') {
            if (!Array.isArray(value) || value.length > 30) fail('validation_error', 'invalid_points');
            for (const point of value) text(point, 500);
        } else if (type === 'time') {
            if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('validation_error', 'invalid_time');
        } else if (type === 'meetingStatus') {
            if (!['scheduled', 'postponed', 'cancelled', 'completed'].includes(value)) fail('validation_error', 'invalid_meeting_status');
        } else if (type === 'summaryStatus') {
            if (!['pending', 'in progress', 'completed', 'on hold'].includes(value)) fail('validation_error', 'invalid_summary_status');
        } else if (type === 'json') {
            if (!value || typeof value !== 'object' || Array.isArray(value)) fail('validation_error', 'invalid_json_content');
            const inspect = (item, depth = 0) => {
                if (depth > 12 || item === null || ['boolean', 'number'].includes(typeof item)) return;
                if (typeof item === 'string') { text(item, 8000); return; }
                if (Array.isArray(item)) { if (item.length > 100) fail('validation_error', 'invalid_json_content'); item.forEach(entry => inspect(entry, depth + 1)); return; }
                if (!item || typeof item !== 'object' || Object.keys(item).length > 100) fail('validation_error', 'invalid_json_content');
                for (const [key, entry] of Object.entries(item)) { text(key, 100); inspect(entry, depth + 1); }
            };
            inspect(value);
            if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 32000) fail('validation_error', 'json_content_too_large');
        }
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
    if (tool.name === 'documentTemplates.update' && Object.keys(args).every(key => ['projectId', 'documentId', 'expectedName'].includes(key))) fail('validation_error', 'empty_update');
    if (tool.name === 'permissionTemplates.update' && Object.keys(args).every(key => ['templateId', 'type', 'expectedName'].includes(key))) fail('validation_error', 'empty_update');
    if (tool.name === 'adminUsers.updateProfile' && Object.keys(args).every(key => ['userId', 'expectedName'].includes(key))) fail('validation_error', 'empty_update');
    if (tool.name === 'resources.update' && !['name', 'code', 'description', 'remarks'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name === 'projects.update' && !['name', 'location', 'project_code', 'start_date', 'end_date'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name.startsWith('projects.') && tool.risk === 'WRITE' && args.start_date && args.end_date && args.end_date < args.start_date) fail('validation_error', 'invalid_project_dates');
    if (tool.name === 'tasks.update' && !['name', 'description', 'status', 'priority', 'start_date', 'due_date'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name === 'meetings.update' && !['subject', 'venue', 'date', 'time', 'status', 'agendaPoints', 'momPoints'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name === 'directory.update' && !['partyId', 'contact_person', 'designation', 'responsibilities', 'mobile_no', 'email', 'address_line'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name === 'summaries.update' && !['title', 'details', 'status', 'date'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name === 'qualityObservations.update' && !['location', 'note'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
    if (tool.name === 'projectParties.update' && !['name', 'contact_person', 'mobile', 'email', 'address', 'location', 'remarks'].some(key => args[key] !== undefined)) fail('validation_error', 'empty_update');
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
