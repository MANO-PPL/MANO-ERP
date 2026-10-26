import { fail } from './agentValidation.js';

const DELETE_ROOTS = Object.freeze({
    'clients.deleteSelected': { table: 'crm_contacts', label: 'clients', owned: ['crm_interactions.contact_id'] },
    'vendors.deleteSelected': { table: 'crm_contacts', label: 'vendors', owned: ['crm_interactions.contact_id'] },
    'resources.deleteSelected': { table: 'res_resources', label: 'resources', owned: [
        'res_rates.resource_id', 'res_conversions.resource_id', 'res_compositions.item_id'
    ] },
});
const EXTRA_REFERENCES = Object.freeze({
    'crm_contacts': [['proj_parties', 'contact_id'], ['pdoc_parties', 'party_id']],
    'res_resources': [['txn_transaction_lines', 'project_resource_id']],
});
const LABELS = Object.freeze({
    crm_interactions: 'CRM interactions', pdoc_parties: 'project document parties',
    proj_parties: 'project parties', res_rates: 'rate versions', res_conversions: 'unit conversions',
    res_compositions: 'composition rows', res_resources: 'project resource copies',
    txn_transaction_lines: 'transaction lines', proj_members: 'project memberships',
    proj_tasks: 'tasks', proj_task_categories: 'task categories', txn_transactions: 'transactions',
    wf_documents: 'documents', wf_document_instances: 'document instances',
});
const safeIdentifier = value => /^[a-z][a-z0-9_]*$/i.test(value);
const sameName = (a, b) => String(a || '').trim().toLocaleLowerCase() === String(b || '').trim().toLocaleLowerCase();

async function references(connection, root) {
    const [rows] = await connection.raw(
        'SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ?',
        [root]
    );
    if (!Array.isArray(rows)) fail('execution_failure', 'delete_dependency_schema_unavailable');
    const pairs = [...rows.map(row => [row.tableName, row.columnName]), ...(EXTRA_REFERENCES[root] || [])];
    const unique = new Map();
    for (const [table, column] of pairs) {
        if (!safeIdentifier(table) || !safeIdentifier(column) || table === root && column === 'id') {
            fail('execution_failure', 'delete_dependency_schema_unavailable');
        }
        unique.set(`${table}.${column}`, { table, column, label: LABELS[table] || 'other linked records' });
    }
    return [...unique.values()].sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`));
}

export async function inspectDelete(tool, args, scope, connection, lock = false) {
    const definition = DELETE_ROOTS[tool.name];
    if (!definition) fail('validation_error', 'unknown_delete_operation');
    const ids = args.targets.map(target => target.id);
    const query = connection(definition.table).where({ org_id: scope.orgId }).whereIn('id', ids);
    if (lock) query.forUpdate();
    const columns = definition.table === 'crm_contacts' ? ['id', 'name', 'category']
        : definition.table === 'res_resources' ? ['id', 'name', 'project_id', 'parent_id'] : ['id', 'name'];
    const rows = await query.select(...columns);
    if (rows.length !== ids.length) fail('authorization_denied', 'delete_target_out_of_scope');
    const byId = new Map(rows.map(row => [Number(row.id), row]));
    for (const target of args.targets) {
        const row = byId.get(target.id);
        if (!row || !sameName(row.name, target.expectedName)) fail('request_rejected', 'delete_target_name_changed');
        if (tool.name === 'clients.deleteSelected' && String(row.category || '').toLowerCase() !== 'client') {
            fail('authorization_denied', 'not_a_client');
        }
        if (tool.name === 'vendors.deleteSelected' && ['client', 'pmc'].includes(String(row.category || '').toLowerCase())) {
            fail('authorization_denied', 'not_a_vendor');
        }
        if (tool.name === 'resources.deleteSelected' && row.project_id != null) {
            fail('validation_error', 'project_resource_requires_project_workflow');
        }
    }
    const refs = await references(connection, definition.table);
    const dependencies = [];
    for (const ref of refs) {
        const result = await connection(ref.table).whereIn(ref.column, ids).count({ count: '*' }).first();
        const count = Number(result?.count ?? 0);
        if (!Number.isSafeInteger(count) || count < 0) fail('execution_failure', 'invalid_delete_impact_count');
        dependencies.push({ ...ref, count, owned: definition.owned.includes(`${ref.table}.${ref.column}`) });
    }
    if (dependencies.some(ref => ref.count && !ref.owned)) fail('validation_error', 'delete_has_related_records');
    return {
        operation: tool.name,
        targets: args.targets.map(target => ({ id: target.id, name: byId.get(target.id).name })),
        dependencies,
        linkedRecordsRemoved: dependencies.filter(ref => ref.owned).reduce((sum, ref) => sum + ref.count, 0),
    };
}

export async function executeDelete(tool, args, scope, trx, snapshot) {
    const definition = DELETE_ROOTS[tool.name];
    if (!definition || !snapshot || snapshot.operation !== tool.name) fail('execution_failure', 'delete_snapshot_required');
    const ids = args.targets.map(target => target.id);
    for (const ref of snapshot.dependencies.filter(item => item.owned && item.count)) {
        const removed = await trx(ref.table).whereIn(ref.column, ids).del();
        if (removed !== ref.count) fail('request_rejected', 'delete_relationships_changed');
    }
    const removed = await trx(definition.table).where({ org_id: scope.orgId }).whereIn('id', ids).del();
    if (removed !== ids.length) fail('request_rejected', 'delete_targets_changed');
    return { deletedCount: removed, linkedRecordsRemoved: snapshot.linkedRecordsRemoved };
}

export const isGuardedDelete = name => Object.hasOwn(DELETE_ROOTS, name);
export const deleteLabel = name => DELETE_ROOTS[name]?.label;
