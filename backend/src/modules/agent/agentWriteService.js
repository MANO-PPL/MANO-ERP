import { fail } from './agentValidation.js';

export function createWriteService({ db, vendors, resources }) {
    return {
        async preconditions(tool, args, scope, connection = db, lock = false) {
            if (tool.name === 'vendors.create') return { category: 'Supplier', scope: 'master', orgId: scope.orgId };
            if (tool.name !== 'resources.createRateVersion') fail('validation_error', 'unknown_write_tool');
            const q = connection('res_resources').where({ id: args.resourceId, org_id: scope.orgId });
            if (lock) q.forUpdate();
            const resource = await q.first('id', 'type', 'project_id', 'parent_id', 'base_unit_code');
            if (!resource || !['material', 'labour'].includes(resource.type) || Number(resource.project_id || 0) !== Number(args.projectId || 0)) fail('validation_error', 'unsupported_rate_target');
            const ratesQuery = connection('res_rates').where({ resource_id: resource.id, is_active: 1 }).orderBy('id', 'desc').limit(2);
            if (lock) ratesQuery.forUpdate();
            const rates = await ratesQuery.select('id', 'rate', 'unit_code', 'effective_from', 'effective_to');
            if (rates.length > 1) fail('validation_error', 'ambiguous_active_rate');
            return JSON.parse(JSON.stringify({ resource, rates }));
        },
        async execute(tool, args, scope, trx) {
            if (!trx?.isTransaction) fail('execution_failure', 'caller_transaction_required');
            let id;
            if (tool.name === 'vendors.create') id = await vendors.createVendor(scope.orgId, { ...args, category: 'Supplier' }, { transaction: trx, agentSupplierOnly: true });
            else if (tool.name === 'resources.createRateVersion') id = await resources.addRate(scope.orgId, args.resourceId,
                { rate: args.rate, unit_code: args.unit_code, effective_from: args.effective_from, remarks: args.remarks || null, project_id: args.projectId || null },
                { transaction: trx, agentExistingOnly: true });
            else fail('validation_error', 'unknown_write_tool');
            if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) fail('execution_failure', 'invalid_service_result');
            return { id: Number(id) };
        }
    };
}
