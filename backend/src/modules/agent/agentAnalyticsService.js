import { fail } from './agentValidation.js';

// ─────────────────────────────────────────────────────────────
// TABLE REGISTRY  (single source of truth — no scattered magic strings)
// Each entry declares the knex table expression, the org_id boundary,
// which dimensions are supported, and how to build the base query.
// ─────────────────────────────────────────────────────────────
function buildEntityRegistry(db) {
    return {
        vendors: {
            label: 'Vendors',
            base: orgId => db('crm_contacts as c')
                .where('c.org_id', orgId)
                .where(function () {
                    this.whereNull('c.category')
                        .orWhereRaw('LOWER(c.category) NOT IN (?, ?)', ['client', 'pmc']);
                }),
            dimensions: {
                category: { col: () => db.raw("COALESCE(NULLIF(TRIM(c.category),''),'Uncategorized') as label"), title: 'Vendors by Category', viz: 'donut' },
                sector: {
                    join: q => q.leftJoin('crm_sectors as s', 'c.sector_id', 's.id'),
                    col: () => db.raw("COALESCE(NULLIF(TRIM(s.sector_name),''),'General') as label"),
                    title: 'Vendors by Sector', viz: 'bar',
                },
                location: { col: () => db.raw("COALESCE(NULLIF(TRIM(c.location),''),'Unspecified') as label"), title: 'Vendors by Location', viz: 'bar' },
                month: {
                    col: () => db.raw("SUBSTR(c.created_at,1,7) as label"),
                    filter: q => q.whereNotNull('c.created_at'),
                    timeSeries: true,
                    title: 'Monthly Vendor Additions', viz: 'line',
                },
            },
            defaultDimension: 'category',
        },

        projects: {
            label: 'Projects',
            base: orgId => db('proj_projects').where({ org_id: orgId }),
            dimensions: {
                status: { col: () => db.raw("COALESCE(NULLIF(TRIM(status),''),'active') as label"), title: 'Projects by Status', viz: 'donut' },
                location: { col: () => db.raw("COALESCE(NULLIF(TRIM(location),''),'Unspecified') as label"), title: 'Projects by Location', viz: 'bar' },
                month: {
                    col: () => db.raw("SUBSTR(created_at,1,7) as label"),
                    filter: q => q.whereNotNull('created_at'),
                    timeSeries: true,
                    title: 'Projects Timeline', viz: 'line',
                },
            },
            defaultDimension: 'status',
        },

        clients: {
            label: 'Clients',
            base: orgId => db('crm_contacts as c')
                .where('c.org_id', orgId)
                .whereRaw("LOWER(COALESCE(c.category, '')) = ?", ['client']),
            dimensions: {
                location: { col: () => db.raw("COALESCE(NULLIF(TRIM(c.location),''),'Unspecified') as label"), title: 'Clients by Location', viz: 'bar' },
                sector: {
                    join: q => q.leftJoin('crm_sectors as s', 'c.sector_id', 's.id'),
                    col: () => db.raw("COALESCE(NULLIF(TRIM(s.sector_name),''),'General') as label"),
                    title: 'Clients by Sector', viz: 'bar',
                },
                month: {
                    col: () => db.raw("SUBSTR(c.created_at,1,7) as label"),
                    filter: q => q.whereNotNull('c.created_at'),
                    timeSeries: true,
                    title: 'Monthly Client Additions', viz: 'line',
                },
            },
            defaultDimension: 'location',
        },

        resources: {
            label: 'Resources',
            base: orgId => db('res_resources').where({ org_id: orgId }),
            dimensions: {
                type: { col: () => db.raw("COALESCE(NULLIF(TRIM(type),''),'material') as label"), title: 'Resources by Type', viz: 'donut' },
                unit: { col: () => db.raw("COALESCE(NULLIF(TRIM(base_unit_code),''),'Unit') as label"), title: 'Resources by Unit of Measure', viz: 'bar' },
            },
            defaultDimension: 'type',
        },

        interactions: {
            label: 'CRM Interactions',
            base: orgId => db('crm_interactions').where({ org_id: orgId }),
            dimensions: {
                type: { col: () => db.raw("COALESCE(NULLIF(TRIM(type),''),'General') as label"), title: 'CRM Interactions by Channel', viz: 'donut' },
                month: {
                    col: () => db.raw("SUBSTR(interaction_date,1,7) as label"),
                    filter: q => q.whereNotNull('interaction_date'),
                    timeSeries: true,
                    title: 'Monthly Interactions', viz: 'line',
                },
            },
            defaultDimension: 'type',
        },

        transactions: {
            label: 'Transactions',
            base: orgId => db('txn_transactions').where({ org_id: orgId }),
            dimensions: {
                type: { col: () => db.raw("COALESCE(NULLIF(TRIM(txn_type),''),'General') as label"), title: 'Transactions by Type', viz: 'donut' },
                status: { col: () => db.raw("COALESCE(NULLIF(TRIM(status),''),'pending') as label"), title: 'Transactions by Status', viz: 'bar' },
                month: {
                    col: () => db.raw("SUBSTR(COALESCE(txn_date, created_at),1,7) as label"),
                    filter: q => q.where(q2 => q2.whereNotNull('txn_date').orWhereNotNull('created_at')),
                    timeSeries: true,
                    title: 'Monthly Transactions', viz: 'line',
                },
            },
            defaultDimension: 'type',
        },

        billing: {
            label: 'Billing & Invoicing',
            base: orgId => db('txn_transactions').where({ org_id: orgId }),
            dimensions: {
                type: { col: () => db.raw("COALESCE(NULLIF(TRIM(txn_type),''),'General') as label"), title: 'Billing by Type', viz: 'donut' },
                status: { col: () => db.raw("COALESCE(NULLIF(TRIM(status),''),'confirmed') as label"), title: 'Billing by Status', viz: 'bar' },
                month: {
                    col: () => db.raw("SUBSTR(COALESCE(txn_date, created_at),1,7) as label"),
                    filter: q => q.where(q2 => q2.whereNotNull('txn_date').orWhereNotNull('created_at')),
                    timeSeries: true,
                    title: 'Monthly Billing & Invoicing', viz: 'line',
                },
            },
            defaultDimension: 'type',
        },

        approvals: {
            label: 'Approvals',
            // Joins wf_approval_cycles against proj_projects to scope by org_id
            base: orgId => db('wf_approval_cycles as wac')
                .join('proj_projects as pp', 'wac.project_id', 'pp.id')
                .where('pp.org_id', orgId),
            dimensions: {
                status: { col: () => db.raw("COALESCE(NULLIF(TRIM(wac.status),''),'pending') as label"), title: 'Approvals by Status', viz: 'donut' },
                type: { col: () => db.raw("COALESCE(NULLIF(TRIM(wac.document_type),''),'General') as label"), title: 'Approvals by Document Type', viz: 'bar' },
                month: {
                    col: () => db.raw("SUBSTR(wac.created_at,1,7) as label"),
                    filter: q => q.whereNotNull('wac.created_at'),
                    timeSeries: true,
                    title: 'Monthly Approval Cycles', viz: 'line',
                },
            },
            defaultDimension: 'status',
        },
    };
}

// Entity aliases: normalise every synonym a user or LLM might send
const ENTITY_ALIASES = Object.freeze({
    vendor: 'vendors', supplier: 'vendors', suppliers: 'vendors', contractor: 'vendors',
    project: 'projects',
    resource: 'resources', material: 'resources', materials: 'resources',
    interaction: 'interactions', crm: 'interactions',
    transaction: 'transactions', ledger: 'transactions',
    bill: 'billing', bills: 'billing', invoice: 'billing', invoices: 'billing',
    approval: 'approvals', wf: 'approvals', workflow: 'approvals',
});

// Entities included in the "overview" multi-chart snapshot
const OVERVIEW_ENTITIES = Object.freeze(['vendors', 'projects', 'resources', 'clients', 'transactions']);

// ─────────────────────────────────────────────────────────────
// CORE QUERY BUILDER
// ─────────────────────────────────────────────────────────────
async function runEntityQuery(db, orgId, registry, entityKey, dimension, limit, requestedViz) {
    const def = registry[entityKey];
    if (!def) fail('validation_error', 'unsupported_analytics_entity');

    // Resolve dimension — fall back to entity default
    const dimKey = (dimension && Object.hasOwn(def.dimensions, dimension))
        ? dimension
        : def.defaultDimension;
    const dimDef = def.dimensions[dimKey];

    // Build base query from the entity definition
    let q = def.base(orgId);

    // Apply optional join (e.g. sector join for vendor-by-sector)
    if (dimDef.join) dimDef.join(q);

    // Apply optional filter (e.g. whereNotNull for month queries)
    if (dimDef.filter) q = dimDef.filter(q);

    const rowLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);

    // Time-series queries: order by label (date) ascending
    // Non-time-series: order by count descending
    let qWithOrder;
    if (dimDef.timeSeries) {
        qWithOrder = q
            .select(dimDef.col())
            .count('* as value')
            .groupBy('label')
            .orderBy('label', 'asc')
            .limit(rowLimit);
    } else {
        qWithOrder = q
            .select(dimDef.col())
            .count('* as value')
            .groupBy('label')
            .orderBy('value', 'desc')
            .limit(rowLimit);
    }

    const rows = await qWithOrder;

    const items = rows.map(r => ({
        label: String(r.label || 'Unknown'),
        value: Number(r.value || 0),
    }));

    const total = items.reduce((acc, cur) => acc + cur.value, 0);
    const itemsWithPct = items.map(item => ({
        ...item,
        percentage: total > 0 ? Number(((item.value / total) * 100).toFixed(1)) : 0,
    }));

    const chartType = requestedViz || dimDef.viz || 'bar';
    const summary = `Total of ${total} record${total === 1 ? '' : 's'} across ${itemsWithPct.length} ${dimKey} segment${itemsWithPct.length === 1 ? '' : 's'}.`;

    return {
        kind: 'chart',
        chartType,
        title: dimDef.title,
        summary,
        total,
        dimension: dimKey,
        entity: entityKey,
        data: itemsWithPct,
    };
}

// ─────────────────────────────────────────────────────────────
// OVERVIEW  (multi-chart fan-out driven by OVERVIEW_ENTITIES constant)
// ─────────────────────────────────────────────────────────────
async function runOverviewQuery(db, orgId, registry, limit) {
    const results = await Promise.allSettled(
        OVERVIEW_ENTITIES.map(entityKey => {
            const def = registry[entityKey];
            return runEntityQuery(db, orgId, registry, entityKey, def.defaultDimension, limit, undefined);
        })
    );

    const charts = results
        .filter(r => r.status === 'fulfilled' && r.value.data.length > 0)
        .map(r => r.value);

    if (charts.length === 0) fail('execution_failure', 'overview_no_data');

    return [{
        kind: 'multi_chart',
        title: 'ERP Overview',
        summary: `Live data breakdown across ${charts.length} entity type${charts.length === 1 ? '' : 's'}.`,
        charts,
    }];
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
export async function executeAnalyticsQuery(db, actor, args = {}) {
    const orgId = actor.orgId;
    const registry = buildEntityRegistry(db);

    const rawEntity = String(args.entity || 'vendors').toLowerCase().trim();
    const entity = ENTITY_ALIASES[rawEntity] ?? rawEntity;
    const dimension = args.dimension ? String(args.dimension).toLowerCase().trim() : undefined;
    const limit = args.limit;
    const visualization = args.visualization;

    if (entity === 'overview') {
        return runOverviewQuery(db, orgId, registry, limit);
    }

    if (!Object.hasOwn(registry, entity)) {
        fail('validation_error', 'unsupported_analytics_entity');
    }

    return [await runEntityQuery(db, orgId, registry, entity, dimension, limit, visualization)];
}

