import { TOOLS } from './agentTools.js';
import { fail } from './agentValidation.js';

const fields = ['id', 'name', 'category', 'contact_person', 'mobile', 'email', 'address', 'location', 'project_code', 'status', 'code', 'type', 'base_unit_code', 'description', 'project_id', 'parent_id'];
const project = row => Object.fromEntries(fields.filter(k => row[k] !== undefined && row[k] !== null).map(k => [k, row[k]]));
export function createReadService({ db, projects, clients, vendors, resources, parties, authorize }) {
    return async function read(actor, tool, args, scope, options = {}) {
        const { orgId, userId, userType } = scope;
        const authorizeResource = async id => {
            if (options.deadline !== undefined && Date.now() >= options.deadline) fail('request_rejected', 'read_deadline');
            const ref = { resourceId: Number(id) };
            await authorize(actor, TOOLS['resources.get'], ref);
            options.recordAuthorization?.(TOOLS['resources.get'], ref);
        };
        const paging = { limit: args.limit || 20, offset: args.offset || 0 };
        const crmQuery = { name: args.query, limit: paging.limit, agentOffset: paging.offset, agentMasterOnly: true, agentRead: true, include_interactions: false };
        let result;
        switch (tool.name) {
            case 'projects.search': result = await projects.getProjects(orgId, userId, userType, { ...paging, query: args.query, agentRead: true }); break;
            case 'projects.get': result = [project(await projects.getProjectById(orgId, args.projectId, { agentRead: true }))]; break;
            case 'clients.search': result = (await clients.getClients(orgId, crmQuery)).clients.map(project); break;
            case 'vendors.search': result = (await vendors.getVendors(orgId, crmQuery)).vendors.map(project); break;
            case 'clients.get': result = [project(await clients.getClientById(orgId, args.contactId, { agentRead: true }))]; break;
            case 'vendors.get': result = [project(await vendors.getVendorById(orgId, args.contactId, { agentRead: true }))]; break;
            case 'resources.search': result = (await resources.getResources(orgId, { ...paging, search: args.query, type: args.type, includeDetails: false, includeRates: false })).map(project); break;
            case 'resources.get': result = [project(await resources.getResourceById(orgId, args.resourceId, args.asOfDate, null, { agentSummary: true }))]; break;
            case 'resources.getRate': result = [await resources.getResolvedRate(orgId, args.resourceId, args.asOfDate, scope.projectId, {
                authorizeResource: resource => authorizeResource(resource.id)
            })]; break;
            case 'resources.getRateHistory':
                // Deliberately not getRateHistory(): the legacy method can initialize rates.
                result = await db('res_rates as rr').join('res_resources as r', 'rr.resource_id', 'r.id')
                    .where({ 'r.id': args.resourceId, 'r.org_id': orgId })
                    .select('rr.id', 'rr.resource_id', 'rr.rate', 'rr.unit_code', 'rr.effective_from', 'rr.effective_to', 'rr.is_active')
                    .orderBy('rr.effective_from', 'desc').orderBy('rr.id', 'desc').limit(paging.limit).offset(paging.offset); break;
            case 'resources.getComposition': {
                result = []; const visited = new Set();
                const walk = async (id, depth, ancestors) => {
                    if (depth >= 8 || ancestors.has(id) || visited.size >= 200) fail('request_rejected', 'composition_limit_or_cycle');
                    if (visited.has(id)) return;
                    visited.add(id);
                    await authorizeResource(id);
                    const item = await resources.getResourceById(orgId, id, args.asOfDate, null, { agentBounded: true });
                    const components = item.compositions || [];
                    result.push({ ...project(item), components });
                    const next = new Set(ancestors); next.add(id);
                    for (const component of components) await walk(Number(component.component_resource_id), depth + 1, next);
                };
                await walk(args.resourceId, 0, new Set()); break;
            }
            case 'projectParties.list': result = (await parties.getProjectParties(args.projectId, 'name,category', orgId, { ...paging, category: args.category, agentRead: true })).parties; break;
            case 'interactions.search': result = await db('crm_interactions').where({ contact_id: args.contactId, org_id: orgId })
                .select('id', 'contact_id', 'type', 'interaction_date', 'follow_up_date', 'remarks').orderBy('interaction_date', 'desc').orderBy('id', 'desc').limit(paging.limit).offset(paging.offset); break;
            default: fail('validation_error', 'unknown_read_tool');
        }
        if (!Array.isArray(result) || result.length > (tool.name === 'resources.getComposition' ? 200 : 50)) fail('execution_failure', 'read_result_limit');
        const encoded = JSON.stringify(result);
        if (Buffer.byteLength(encoded) > 32768) fail('request_rejected', 'read_result_bytes');
        return JSON.parse(encoded);
    };
}
