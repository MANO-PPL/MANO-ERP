import { fail, integer } from './agentValidation.js';

const permissions = value => { try { const p = typeof value === 'string' ? JSON.parse(value) : value; return p && !Array.isArray(p) ? p : {}; } catch { return {}; } };
export function hasLevel(value, edit) {
    if (typeof value === 'number') return value >= (edit ? 2 : 1);
    return (edit ? ['edit', 'admin', 'full'] : ['view', 'edit', 'admin', 'full']).includes(String(value).toLowerCase().trim());
}
function system(user, module, edit) {
    if (user.user_type === 'admin') return;
    const p = permissions(user.system_permissions);
    if (user.user_type === 'client' || !hasLevel(p[module] ?? p[module.toLowerCase()], edit)) fail('authorization_denied');
}
export function createPolicy(db) {
    return async function authorize(actor, tool, args, connection = db, lock = false) {
        integer(actor.userId); integer(actor.orgId);
        const one = async (table, where) => {
            const q = connection(table).where(where);
            if (lock) q.forUpdate();
            return q.first();
        };
        const user = await one('iam_users', { user_id: actor.userId, org_id: actor.orgId });
        if (!user) fail('authorization_denied');
        user.user_type = String(user.user_type || 'employee').toLowerCase();
        const edit = tool.risk === 'WRITE';
        const scope = { orgId: actor.orgId, userId: actor.userId, projectId: null, userType: user.user_type };
        let projectId = args.projectId;
        if (args.resourceId !== undefined) {
            const resource = await one('res_resources', { id: args.resourceId, org_id: actor.orgId });
            if (!resource || (projectId !== undefined && Number(resource.project_id) !== projectId)) fail('authorization_denied');
            projectId = resource.project_id ? Number(resource.project_id) : undefined;
            scope.resource = resource;
        }
        if (args.contactId !== undefined) {
            const contact = await one('crm_contacts', { id: args.contactId, org_id: actor.orgId });
            if (!contact) fail('authorization_denied');
            const category = String(contact.category || '').toLowerCase();
            if ((tool.module === 'clients' && category !== 'client') || (tool.module === 'vendors' && ['client', 'pmc'].includes(category))) fail('authorization_denied');
            system(user, tool.module === 'contacts' ? (['client', 'pmc'].includes(category) ? 'clients' : 'vendors') : tool.module, edit);
            // Project-local contacts need a live project association as well as CRM permission.
            if (contact.scope === 'project') {
                const links = await connection('pdoc_parties').where({ party_id: contact.id }).whereNull('deleted_at').select('project_id').limit(2);
                if (links.length !== 1) fail('authorization_denied');
                projectId = Number(links[0].project_id);
            }
            scope.contact = contact;
        }
        if (projectId !== undefined) {
            const project = await one('proj_projects', { id: projectId, org_id: actor.orgId });
            if (!project) fail('authorization_denied');
            scope.projectId = projectId;
            if (user.user_type !== 'admin') {
                const member = await one('proj_members', { project_id: projectId, user_id: actor.userId, org_id: actor.orgId });
                if (!member || (edit && user.user_type === 'client')) fail('authorization_denied');
                const module = tool.module === 'materials' ? 'Material Management' : 'General Documents';
                const p = permissions(member.project_permissions);
                if (tool.module !== 'projects' && user.user_type !== 'client'
                    && !hasLevel(p[module] ?? p[module.toLowerCase()] ?? p[tool.module], edit)) fail('authorization_denied');
            }
        } else if (tool.module !== 'projects' && !scope.contact) system(user, tool.module, edit);
        return scope;
    };
}
