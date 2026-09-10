import { randomUUID } from 'node:crypto';
import { fail } from './agentValidation.js';

export function makeEvent(request, type, payload = {}) {
    const event = { ...payload, type, eventId: randomUUID(), conversationId: request.conversation_id, requestId: request.request_id };
    if (Buffer.byteLength(JSON.stringify(event)) > 65536) fail('execution_failure', 'event_too_large');
    return event;
}
export function actionFor(tool, args, preconditions = null) {
    if (tool.name === 'vendors.bulkImport') {
        const count = preconditions?.validCount ?? 0;
        const total = preconditions?.totalRows ?? 0;
        const skipped = (preconditions?.duplicateCount || 0) + (preconditions?.invalidCount || 0);
        return {
            actionType: tool.name,
            title: 'Bulk Vendor Import',
            riskLevel: 'BULK_WRITE',
            affectedRecords: count,
            description: `Import ${count} vendors from uploaded spreadsheet (${total} total rows, ${skipped} skipped).`,
            fields: [
                { label: 'Ready to import', value: `${count} vendor${count === 1 ? '' : 's'}` },
                { label: 'Total spreadsheet rows', value: String(total) },
                ...(preconditions?.duplicateCount ? [{ label: 'Duplicates skipped', value: String(preconditions.duplicateCount) }] : []),
                ...(preconditions?.invalidCount ? [{ label: 'Invalid rows (missing name)', value: String(preconditions.invalidCount) }] : []),
                ...(preconditions?.sampleValid?.length ? [{
                    label: 'Sample vendors to import',
                    value: preconditions.sampleValid.map(s => `${s.name} (${s.category || 'Supplier'})`).join(', ')
                }] : []),
                ...(preconditions?.issues?.length ? [{
                    label: 'Noted issues',
                    value: preconditions.issues.join('; ')
                }] : [])
            ]
        };
    }
    if (tool.name === 'approvals.decide') {
        const actionWord = String(args.action || 'approve').toLowerCase() === 'approve' ? 'Approve' : 'Reject';
        const typeLabel = args.itemType === 'qaqc_observation' ? 'Quality Observation' : (args.itemType === 'document_cycle' ? 'Document Cycle' : 'Milestone Task');
        return {
            actionType: tool.name,
            title: `${actionWord} ${typeLabel}`,
            riskLevel: 'WRITE',
            affectedRecords: 1,
            description: `${actionWord} ${typeLabel} #${args.itemId} in ERP.`,
            fields: [
                { label: 'Item Type', value: typeLabel },
                { label: 'Item ID', value: `#${args.itemId}` },
                { label: 'Action', value: actionWord },
                ...(args.comments ? [{ label: 'Comments', value: args.comments }] : [])
            ]
        };
    }
    if (tool.name === 'approvals.batchDecide') {
        const actionWord = String(args.action || 'approve').toLowerCase() === 'approve' ? 'Approve All' : 'Reject All';
        const typeLabel = args.itemType && args.itemType !== 'all' ? (args.itemType === 'qaqc_observation' ? 'Quality Observations' : (args.itemType === 'document_cycle' ? 'Document Cycles' : 'Milestone Tasks')) : 'All Pending Items';
        return {
            actionType: tool.name,
            title: `Batch ${actionWord} (${typeLabel})`,
            riskLevel: 'WRITE',
            affectedRecords: preconditions?.affectedCount ?? 1,
            description: `${actionWord} across ${typeLabel} queue.`,
            fields: [
                { label: 'Scope', value: typeLabel },
                { label: 'Action', value: actionWord },
                ...(args.comments ? [{ label: 'Comments', value: args.comments }] : [])
            ]
        };
    }
    return { actionType: tool.name, title: tool.name, riskLevel: tool.risk, affectedRecords: 1,
        fields: Object.entries(args).map(([label, value]) => ({ label, value })) };
}
export function isVisualizationRequested(queryText = '', toolName = '', context = {}) {
    if (!queryText || typeof queryText !== 'string') return false;
    const q = queryText.toLowerCase().trim();
    const visualKeywords = [
        'chart', 'graph', 'donut', 'bar chart', 'pie chart', 'line chart',
        'visualize', 'visualization', 'visualisations', 'visualisation',
        'breakdown', 'distribution', 'trends', 'analytics', 'dashboard',
        'powerbi', 'power bi', 'compare', 'comparison', 'kpi', 'metrics',
        'statistics', 'proportion', 'percentage share', 'transactions', 'transaction', 'ledger', 'register',
        'billing', 'bill', 'bills', 'invoice', 'invoices', 'phases', 'phase', 'planning', 'wip', 'drawings', 'contracts', 'quality', 'safety'
    ];
    if (visualKeywords.some(keyword => q.includes(keyword))) {
        return true;
    }
    if (typeof toolName === 'string' && (toolName.startsWith('analytics.') || toolName === 'resources.simulateCostImpact' || toolName.startsWith('transactions.') || toolName.startsWith('billing.'))) {
        return true;
    }
    return false;
}

function buildPowerBiDashboard(tool, rows, wantVisualization = false) {
    if (!rows || rows.length === 0) {
        return {
            kind: 'list',
            showVisualization: false,
            title: 'No Data Found',
            tool: tool.name,
            count: 0,
            kpis: [],
            charts: [],
            columns: [],
            matrixRows: [],
            items: [],
        };
    }

    const total = rows.length;
    const sample = rows[0] || {};
    const sampleKeys = Object.keys(sample).filter(k =>
        !['org_id', 'created_by', 'updated_by', 'password_hash', 'deleted_at', 'credential_hash', 'id', 'credential'].includes(k)
    );

    // 1. Dynamic Tool Domain & Route Resolution
    const toolPrefix = (tool.name || '').split('.')[0] || 'data';
    const domain = toolPrefix.charAt(0).toUpperCase() + toolPrefix.slice(1);
    const toolTitle = `${domain} Intelligence & Analytics`;
    const entityType = toolPrefix.endsWith('s') ? toolPrefix.slice(0, -1) : toolPrefix;

    const routeMap = {
        projects: '/projects',
        project: '/projects',
        tasks: '/projects',
        task: '/projects',
        vendors: '/vendors',
        vendor: '/vendors',
        clients: '/clients',
        client: '/clients',
        resources: '/resources',
        resource: '/resources',
        materials: '/resources',
        material: '/resources',
        interactions: '/collaboration',
        approvals: '/admin',
        spreadsheets: '/spreadsheets',
        transactions: '/projects',
        transaction: '/projects',
        billing: '/projects',
        bill: '/projects',
    };
    const defaultRoute = routeMap[toolPrefix] || `/${toolPrefix}`;

    // 2. Dynamic Categorical Candidate Discovery via Cardinality & Shannon Entropy Scoring
    const ignoredKeys = new Set([
        'id', 'org_id', 'created_by', 'updated_by', 'password_hash', 'deleted_at',
        'credential_hash', 'token', 'secret', 'email', 'phone', 'mobile', 'address',
        'notes', 'remarks', 'description', 'detail', 'components', 'created_at', 'updated_at',
        'credential', 'website', 'url', 'avatar'
    ]);

    const candidateScores = {};
    for (const key of sampleKeys) {
        if (ignoredKeys.has(key)) continue;
        const nonNullRows = rows.filter(r => r[key] !== null && r[key] !== undefined && String(r[key]).trim() !== '');
        if (nonNullRows.length === 0) continue;
        const distinctValues = new Set(nonNullRows.map(r => String(r[key]).trim().toLowerCase()));
        const cardinality = distinctValues.size;

        // Skip keys that are completely unique per row (e.g. personal names, emails, unique codes)
        if (cardinality === 0 || (cardinality === rows.length && rows.length > 3)) continue;

        // Skip pure numeric columns
        const isNumeric = nonNullRows.every(r => Number.isFinite(Number(r[key])) && !isNaN(Number(r[key])));
        if (isNumeric) continue;

        let score = 10;
        if (cardinality >= 2 && cardinality <= 15) score += 35; // Perfect range for donut/bar breakdown
        else if (cardinality <= 25) score += 15;

        const kLower = key.toLowerCase();
        if (kLower.includes('category') || kLower.includes('type') || kLower.includes('kind')) score += 40;
        if (kLower.includes('status') || kLower.includes('stage') || kLower.includes('state')) score += 35;
        if (kLower.includes('sector') || kLower.includes('industry') || kLower.includes('dept')) score += 30;
        if (kLower.includes('location') || kLower.includes('city') || kLower.includes('region')) score += 25;
        if (kLower.includes('unit') || kLower.includes('role') || kLower.includes('priority')) score += 20;

        candidateScores[key] = score;
    }

    const sortedDimensions = Object.keys(candidateScores).sort((a, b) => candidateScores[b] - candidateScores[a]);
    const primaryField = sortedDimensions[0] || sampleKeys.find(k => typeof sample[k] === 'string' && !ignoredKeys.has(k)) || 'category';
    const primaryLabel = primaryField.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const secondaryField = sortedDimensions.length > 1 ? sortedDimensions[1] : '';
    const secondaryLabel = secondaryField ? secondaryField.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

    // 3. Dynamic Numeric Metric Discovery (Rates, Amounts, Costs, Budgets, Quantities)
    const numericCandidates = {};
    for (const key of sampleKeys) {
        if (ignoredKeys.has(key)) continue;
        const numericRows = rows.filter(r => r[key] !== null && r[key] !== undefined && Number.isFinite(Number(r[key])) && Number(r[key]) > 0);
        if (numericRows.length === 0) continue;
        const coverage = numericRows.length / total;
        if (coverage < 0.2) continue; // At least 20% of rows have valid numbers

        let score = coverage * 25;
        const kLower = key.toLowerCase();
        if (kLower.includes('rate') || kLower.includes('price')) score += 50;
        if (kLower.includes('amount') || kLower.includes('total') || kLower.includes('cost') || kLower.includes('budget')) score += 45;
        if (kLower.includes('value') || kLower.includes('balance') || kLower.includes('fee')) score += 40;
        if (kLower.includes('quantity') || kLower.includes('qty') || kLower.includes('count')) score += 30;

        numericCandidates[key] = score;
    }
    const sortedNumerics = Object.keys(numericCandidates).sort((a, b) => numericCandidates[b] - numericCandidates[a]);
    const numericKey = sortedNumerics[0] || null;

    // 4. Aggregate Primary Categorical Distribution
    const primaryCounts = {};
    for (const r of rows) {
        const val = String(r[primaryField] || 'General').trim() || 'General';
        primaryCounts[val] = (primaryCounts[val] || 0) + 1;
    }
    const primaryData = Object.entries(primaryCounts)
        .map(([label, value]) => ({
            label,
            value,
            percentage: Number(((value / total) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.value - a.value);

    // 5. Aggregate Secondary Categorical Distribution
    let secondaryData = [];
    if (secondaryField) {
        const secondaryCounts = {};
        for (const r of rows) {
            const val = String(r[secondaryField] || '').trim();
            if (val) secondaryCounts[val] = (secondaryCounts[val] || 0) + 1;
        }
        secondaryData = Object.entries(secondaryCounts)
            .map(([label, value]) => ({
                label,
                value,
                percentage: Number(((value / total) * 100).toFixed(1)),
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }

    // 6. Dynamic KPI Tiles
    const topPrimary = primaryData[0] || { label: 'None', value: 0, percentage: 0 };
    const kpis = [
        {
            label: 'Total Records',
            value: total.toLocaleString(),
            badge: `${primaryData.length} ${primaryLabel}s`,
            icon: 'database',
        },
        {
            label: `Top ${primaryLabel}`,
            value: topPrimary.label,
            badge: `${topPrimary.percentage}%`,
            icon: 'award',
        },
    ];

    if (numericKey) {
        const numericValues = rows.map(r => Number(r[numericKey])).filter(n => Number.isFinite(n) && n > 0);
        if (numericValues.length > 0) {
            const avg = Math.round(numericValues.reduce((a, b) => a + b, 0) / numericValues.length);
            const peak = Math.round(Math.max(...numericValues));
            const numLabel = numericKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            kpis.push({
                label: `Avg ${numLabel}`,
                value: `₹${avg.toLocaleString()}`,
                badge: `Peak ₹${peak.toLocaleString()}`,
                icon: 'trending-up',
            });
        }
    } else if (secondaryData.length > 0) {
        const topSec = secondaryData[0];
        kpis.push({
            label: `Top ${secondaryLabel}`,
            value: topSec.label,
            badge: `${topSec.percentage}%`,
            icon: 'map-pin',
        });
    }

    // Active status / completeness KPI
    const activeCount = rows.filter(r => {
        const s = String(r.status || '').toLowerCase();
        return s === 'active' || s === 'completed' || r.is_active === 1 || r.is_active === true;
    }).length;

    if (activeCount > 0) {
        const activePct = ((activeCount / total) * 100).toFixed(0);
        kpis.push({
            label: 'Status',
            value: `${activePct}%`,
            badge: `${activeCount}/${total} Active`,
            icon: 'check-circle',
        });
    } else {
        kpis.push({
            label: 'Integrity',
            value: `${total} Rows`,
            badge: 'Org Scoped',
            icon: 'shield-check',
        });
    }

    // 7. Dynamic Visual Charts
    const charts = [];
    if (primaryData.length > 0) {
        charts.push({
            kind: 'chart',
            chartType: 'donut',
            title: `${primaryLabel} Distribution`,
            dimension: primaryField,
            entity: entityType,
            total,
            data: primaryData,
        });
    }
    if (secondaryData.length > 1) {
        charts.push({
            kind: 'chart',
            chartType: 'bar',
            title: `${secondaryLabel} Ranking`,
            dimension: secondaryField,
            entity: entityType,
            total,
            data: secondaryData,
        });
    }

    // 8. Dynamic Matrix Columns
    const columns = [
        { key: 'name', label: 'Record Name' },
        { key: 'primary', label: primaryLabel },
    ];
    if (secondaryField) {
        columns.push({ key: 'secondary', label: secondaryLabel });
    }
    if (numericKey) {
        const numLabel = numericKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        columns.push({ key: 'rate', label: numLabel, align: 'right' });
    }
    // Dynamically add extra informative column if present (e.g. contact_person, email, city)
    const extraCandidate = ['contact_person', 'email', 'mobile', 'city', 'base_unit_code', 'status']
        .find(k => k !== primaryField && k !== secondaryField && k !== numericKey && sampleKeys.includes(k) && rows.some(r => r[k]));
    if (extraCandidate) {
        const extraLabel = extraCandidate.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        columns.push({ key: extraCandidate, label: extraLabel });
    }
    columns.push({ key: 'action', label: 'Action', align: 'right' });

    // 9. Dynamic Matrix Rows with Universal Key Resolution
    const candidateNameKeys = ['name', 'resourceName', 'title', 'subject', 'label', 'reference_no', 'ref_no', 'invoice_no', 'voucher_no', 'code', 'txn_type', 'type', 'document_type', 'description'];
    const matrixRows = rows.slice(0, 25).map((r, idx) => {
        let name = null;
        for (const nk of candidateNameKeys) {
            if (r[nk] && String(r[nk]).trim()) {
                name = String(r[nk]).trim();
                break;
            }
        }
        if (!name) name = r.id ? `#${r.id}` : `Record #${idx + 1}`;

        const primary = String(r[primaryField] || 'General');
        const secondary = secondaryField ? String(r[secondaryField] || '—') : '—';
        const numVal = numericKey ? r[numericKey] : null;
        const rate = (numVal !== null && numVal !== undefined && numVal !== '')
            ? `₹${Number(numVal).toLocaleString()}${r.base_unit_code ? ` / ${r.base_unit_code}` : ''}`
            : '—';

        const rowId = r.id ? Number(r.id) : undefined;
        let route = defaultRoute;
        const pid = r.project_id || r.projectId;
        if ((entityType === 'project' || toolPrefix === 'projects') && rowId) {
            route = `/projects/${rowId}`;
        } else if (toolPrefix === 'transactions' || entityType === 'transaction') {
            route = pid ? `/projects/${pid}?tab=Transactions` : '/projects';
        } else if (toolPrefix === 'billing' || entityType === 'billing' || entityType === 'bill') {
            route = pid ? `/projects/${pid}?tab=Billing` : '/projects';
        } else if (toolPrefix === 'tasks' || entityType === 'task') {
            route = pid ? `/projects/${pid}?tab=Tasks` : '/projects';
        } else if (toolPrefix === 'approvals' || entityType === 'approval') {
            route = pid ? `/projects/${pid}?tab=Approvals` : '/admin';
        } else if (toolPrefix === 'projectParties' || entityType === 'party') {
            route = pid ? `/projects/${pid}?tab=Contracts` : '/projects';
        } else if ((toolPrefix === 'resources' || entityType === 'resource' || entityType === 'material') && pid) {
            route = `/projects/${pid}?tab=Material%20Management`;
        }

        const cells = {
            name,
            primary,
            secondary,
            rate,
        };
        if (extraCandidate && r[extraCandidate] !== undefined) {
            cells[extraCandidate] = String(r[extraCandidate] || '—');
        }

        return {
            id: rowId || idx + 1,
            name,
            code: r.code || (r.id ? `#${r.id}` : null),
            primary,
            secondary,
            rate,
            route,
            entityType,
            cells
        };
    });

    const items = rows.map((row, idx) => {
        let label = null;
        for (const nk of candidateNameKeys) {
            if (row[nk] && String(row[nk]).trim()) {
                label = String(row[nk]).trim();
                break;
            }
        }
        if (!label) label = row.id ? `Record #${row.id}` : `${tool.name} #${idx + 1}`;
        let itemRoute = defaultRoute;
        const itemPid = row.project_id || row.projectId;
        if ((entityType === 'project' || toolPrefix === 'projects') && row.id) {
            itemRoute = `/projects/${row.id}`;
        } else if (toolPrefix === 'transactions' || entityType === 'transaction') {
            itemRoute = itemPid ? `/projects/${itemPid}?tab=Transactions` : '/projects';
        } else if (toolPrefix === 'billing' || entityType === 'billing' || entityType === 'bill') {
            itemRoute = itemPid ? `/projects/${itemPid}?tab=Billing` : '/projects';
        } else if (toolPrefix === 'tasks' || entityType === 'task') {
            itemRoute = itemPid ? `/projects/${itemPid}?tab=Tasks` : '/projects';
        } else if (toolPrefix === 'approvals' || entityType === 'approval') {
            itemRoute = itemPid ? `/projects/${itemPid}?tab=Approvals` : '/admin';
        } else if (toolPrefix === 'projectParties' || entityType === 'party') {
            itemRoute = itemPid ? `/projects/${itemPid}?tab=Contracts` : '/projects';
        } else if ((toolPrefix === 'resources' || entityType === 'resource' || entityType === 'material') && itemPid) {
            itemRoute = `/projects/${itemPid}?tab=Material%20Management`;
        }
        let detail = `${row.category || row.type || row.location || ''} ${row.code ? `(${row.code})` : ''}`.trim() || undefined;
        if (toolPrefix === 'tasks' || entityType === 'task') {
            const parts = [];
            if (row.category) parts.push(row.category);
            if (row.status) parts.push(row.status);
            if (row.priority) parts.push(`Priority: ${row.priority}`);
            if (row.due_date) parts.push(`Due: ${row.due_date}`);
            detail = parts.join(' • ') || undefined;
        }
        return {
            label,
            detail,
            entityType,
            entityId: row.id ? Number(row.id) : undefined,
            route: itemRoute,
        };
    });

    return {
        kind: 'list',
        showVisualization: wantVisualization,
        title: toolTitle,
        tool: tool.name,
        count: total,
        entityType,
        kpis: wantVisualization ? kpis : [],
        charts: wantVisualization ? charts : [],
        columns: wantVisualization ? columns : [],
        matrixRows: wantVisualization ? matrixRows : [],
        items,
    };
}

export function resultCard(tool, result, queryText = '', context = {}) {
    const rows = Array.isArray(result) ? result : [result];
    if (rows.length > 0 && (rows[0]?.kind === 'chart' || rows[0]?.kind === 'multi_chart' || rows[0]?.kind === 'briefing' || rows[0]?.kind === 'teleport' || rows[0]?.kind === 'approval_queue' || rows[0]?.kind === 'excel_export' || rows[0]?.kind === 'cost_simulation')) {
        if (rows[0]?.kind === 'briefing' && !rows[0].title) {
            rows[0].title = rows[0].projectName ? `${rows[0].projectName} Executive Briefing` : 'Project Executive Briefing';
        }
        return rows[0];
    }

    if (tool.name === 'reports.getDPR') {
        const dpr = rows[0] || {};
        const pid = dpr.project_id;
        const route = pid ? `/projects/${pid}?tab=Reports&type=daily` : '/projects';
        const kpis = [
            { label: 'Report Date', value: dpr.date || '—' },
            { label: 'Total Manpower', value: String(dpr.total_manpower || 0) },
            { label: 'Progress Items', value: String(dpr.today_progress?.length || 0) },
            { label: 'Weather / Site', value: dpr.weather ? `${dpr.weather} (${dpr.site_condition || 'dry'})` : 'Sunny' },
        ];
        const matrixRows = (dpr.today_progress || []).map((p, idx) => ({
            id: idx + 1,
            name: p.item,
            code: `${p.quantity} ${p.unit}`,
            primary: p.description || 'Executed Work',
            secondary: `${p.quantity} ${p.unit}`,
            route,
            entityType: 'project'
        }));
        return {
            kind: 'powerbi_dashboard',
            title: `DPR: ${dpr.project_name || 'Project'} (${dpr.date || 'Daily Report'})`,
            totalCount: dpr.today_progress?.length || 0,
            entityType: 'project',
            route,
            kpis,
            matrixRows,
            showVisualization: true
        };
    }

    if (tool.name === 'reports.getWPR') {
        const wpr = rows[0] || {};
        const pid = wpr.project_id;
        const route = pid ? `/projects/${pid}?tab=Reports&type=weekly` : '/projects';
        const kpis = [
            { label: 'Week / Period', value: wpr.week_number ? `Week ${wpr.week_number}` : (wpr.week_label || 'Weekly') },
            { label: 'DPRs Recorded', value: String(wpr.dpr_count || 0) },
            { label: 'Total Manpower', value: String(wpr.total_manpower_deployed || 0) },
            { label: 'Avg Personnel/Day', value: String(wpr.average_daily_personnel || 0) },
        ];
        const matrixRows = (wpr.progress_items_executed || []).map((p, idx) => ({
            id: idx + 1,
            name: p.item,
            code: `${p.total_executed} ${p.unit}`,
            primary: (p.descriptions && p.descriptions[0]) || 'Cumulative Execution',
            secondary: `${p.total_executed} ${p.unit}`,
            route,
            entityType: 'project'
        }));
        return {
            kind: 'powerbi_dashboard',
            title: `Weekly Summary: ${wpr.project_name || 'Project'} (${wpr.week_label || 'WPR'})`,
            totalCount: wpr.progress_items_executed?.length || 0,
            entityType: 'project',
            route,
            kpis,
            matrixRows,
            showVisualization: true
        };
    }

    if (tool.name === 'reports.getMPR') {
        const mpr = rows[0] || {};
        const pid = mpr.project_id;
        const route = pid ? `/projects/${pid}?tab=Reports&type=monthly` : '/projects';
        const kpis = [
            { label: 'Month', value: mpr.month_label || 'Monthly' },
            { label: 'Total DPRs', value: String(mpr.total_dprs || 0) },
            { label: 'Total Manpower', value: String(mpr.total_manpower_deployed || 0) },
            { label: 'Items Executed', value: String(mpr.cumulative_items_executed?.length || 0) },
        ];
        const matrixRows = (mpr.cumulative_items_executed || []).map((p, idx) => ({
            id: idx + 1,
            name: p.item,
            code: `${p.total_executed} ${p.unit}`,
            primary: `${p.entries_count || 1} logs recorded`,
            secondary: `${p.total_executed} ${p.unit}`,
            route,
            entityType: 'project'
        }));
        return {
            kind: 'powerbi_dashboard',
            title: `Monthly Archive: ${mpr.project_name || 'Project'} (${mpr.month_label || 'MPR'})`,
            totalCount: mpr.cumulative_items_executed?.length || 0,
            entityType: 'project',
            route,
            kpis,
            matrixRows,
            showVisualization: true
        };
    }

    if (tool.name === 'approvals.decide' || tool.name === 'approvals.batchDecide') {
        const row = rows[0] || {};
        return {
            kind: 'execution',
            title: tool.name === 'approvals.decide' ? 'Approval Decision' : 'Batch Approval Decision',
            outcome: 'success',
            text: row.message || (tool.name === 'approvals.decide' ? `Successfully recorded decision '${row.action}' for ${row.itemType} #${row.id}.` : `Successfully processed ${row.processedCount || 0} pending items with action '${row.action}'.`)
        };
    }

    const wantVisualization = isVisualizationRequested(queryText, tool.name, context);
    return buildPowerBiDashboard(tool, rows, wantVisualization);
}
export function provenance(tool, scope, now) {
    return [{ label: 'Authorized ERP service result', tool: tool.name,
        entityId: String(scope.resource?.id ?? scope.contact?.id ?? scope.projectId ?? ''), timestamp: new Date(now).toISOString() }];
}
