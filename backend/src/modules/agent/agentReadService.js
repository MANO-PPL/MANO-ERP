import { TOOLS } from './agentTools.js';
import { fail, integer } from './agentValidation.js';
import { executeAnalyticsQuery } from './agentAnalyticsService.js';

const fields = ['id', 'name', 'category', 'contact_person', 'mobile', 'email', 'address', 'location', 'project_code', 'status', 'code', 'type', 'base_unit_code', 'description', 'project_id', 'parent_id', 'phases', 'completion', 'start_date', 'end_date', 'txn_type', 'txn_date', 'remarks', 'project_name', 'priority', 'due_date', 'duration', 'task_code'];
const project = row => Object.fromEntries(fields.filter(k => row[k] !== undefined && row[k] !== null).map(k => [k, row[k]]));

function parseDprTransaction(t, lines = []) {
    let remarksObj = {};
    if (t.remarks) {
        try {
            remarksObj = typeof t.remarks === 'string' ? JSON.parse(t.remarks) : (t.remarks || {});
        } catch {}
    }

    const labour = [];
    const todayProgress = [];
    const tomorrowPlan = [];
    const events = [];

    lines.forEach(l => {
        let notesObj = {};
        if (l.notes) {
            try {
                notesObj = typeof l.notes === 'string' ? JSON.parse(l.notes) : (l.notes || {});
            } catch {}
        }

        const section = notesObj.section;
        if (section === 'LABOUR') {
            const counts = notesObj.counts || {};
            const trades = {};
            const TRADE_LABELS = {
                super: 'supervisors',
                carp: 'carpenters',
                fitter: 'fitters',
                elect: 'electricians',
                opera: 'operators',
                mason: 'masons',
                labou: 'labourers',
                storel: 'storekeepers',
                staff: 'staff',
                plumber: 'plumbers',
                painter: 'painters'
            };
            let agencyTotal = 0;
            for (const [k, v] of Object.entries(counts)) {
                if (k === 'agency' || k === 'remarks') continue;
                const count = parseInt(v) || 0;
                if (count > 0) {
                    const label = TRADE_LABELS[k] || k;
                    trades[label] = count;
                    agencyTotal += count;
                }
            }
            if (agencyTotal === 0 && l.signed_qty) {
                agencyTotal = Math.round(parseFloat(l.signed_qty) || 0);
            }
            labour.push({
                agency: notesObj.agencyName || counts.agency || 'Contractor',
                headcount: agencyTotal,
                trades,
                remarks: notesObj.remarks || counts.remarks || ''
            });
        } else if (section === 'TODAY_PROGRESS') {
            todayProgress.push({
                item: notesObj.itemName || 'Progress item',
                quantity: parseFloat(l.signed_qty) || 0,
                unit: notesObj.unit || '',
                description: notesObj.description || ''
            });
        } else if (section === 'TOMORROW_PLAN') {
            tomorrowPlan.push({
                item: notesObj.itemName || 'Planned item',
                planned_qty: parseFloat(l.signed_qty) || 0,
                unit: notesObj.unit || '',
                description: notesObj.description || ''
            });
        } else if (section === 'EVENT') {
            if (notesObj.content) events.push(notesObj.content);
        }
    });

    const totalManpower = labour.reduce((acc, row) => acc + (row.headcount || 0), 0);
    let dateStr = '';
    if (t.txn_date instanceof Date) {
        dateStr = t.txn_date.toISOString().slice(0, 10);
    } else if (t.txn_date) {
        const s = String(t.txn_date);
        dateStr = s.includes('T') ? s.split('T')[0] : (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(s).toISOString().slice(0, 10));
    } else if (t.created_at) {
        dateStr = t.created_at instanceof Date ? t.created_at.toISOString().slice(0, 10) : String(t.created_at).split('T')[0];
    }

    return {
        id: t.id,
        kind: 'dpr_report',
        report_type: 'DAILY_PROGRESS',
        date: dateStr,
        project_id: t.project_id,
        project_name: t.project_name || `Project #${t.project_id}`,
        project_code: t.project_code || '',
        status: t.status || 'CONFIRMED',
        weather: remarksObj.weather || 'sunny',
        site_condition: remarksObj.siteCondition || 'dry',
        time_slots: remarksObj.timeSlots || [],
        distribution: remarksObj.distribution || 'CLIENT',
        prepared_by: remarksObj.preparedBy || 'SITE ENGINEER',
        remarks: Array.isArray(remarksObj.remarksList) ? remarksObj.remarksList.filter(Boolean) : (remarksObj.summaryNotes ? [remarksObj.summaryNotes] : []),
        total_manpower: totalManpower,
        labour_summary: labour,
        today_progress: todayProgress,
        tomorrow_plan: tomorrowPlan,
        events,
        audit: {
            created_at: t.created_at,
            updated_at: t.updated_at,
            status: t.status || 'CONFIRMED'
        }
    };
}

export function createReadService({ db, projects, clients, vendors, resources, parties, approvalService, exportService, costSimulationService, authorize }) {
    return async function read(actor, tool, args, scope, options = {}) {
        const { orgId, userId, userType } = scope;
        const authorizeResource = async id => {
            if (options.deadline !== undefined && Date.now() >= options.deadline) fail('request_rejected', 'read_deadline');
            const ref = { resourceId: Number(id) };
            await authorize(actor, TOOLS['resources.get'], ref);
            options.recordAuthorization?.(TOOLS['resources.get'], ref);
        };
        const paging = { limit: Math.min(args.limit || 50, 50), offset: args.offset || 0 };
        const crmQuery = { name: args.query, limit: paging.limit, agentOffset: paging.offset, agentMasterOnly: true, agentRead: true, include_interactions: false };
        let result;
        switch (tool.name) {
            case 'resources.simulateCostImpact': {
                if (!costSimulationService) fail('execution_failure', 'cost_simulation_unavailable');
                const simulation = await costSimulationService.simulateCostImpact(orgId, {
                    resourceId: args.resourceId,
                    resourceName: args.resourceName,
                    rateDelta: args.rateDelta,
                    percentageDelta: args.percentageDelta,
                    newRate: args.newRate,
                    projectId: args.projectId
                });
                result = [simulation];
                break;
            }
            case 'reports.exportExcel': {
                if (!exportService) fail('execution_failure', 'export_service_unavailable');
                const descriptor = await exportService.generateExcelReport(orgId, {
                    entity: args.entity,
                    query: args.query,
                    limit: args.limit
                });
                result = [descriptor];
                break;
            }
            case 'reports.getDPR': {
                if (!db) { result = []; break; }
                let q = db('txn_transactions as t')
                    .leftJoin('proj_projects as p', 't.project_id', 'p.id')
                    .where('t.org_id', orgId)
                    .where('t.txn_type', 'DAILY_PROGRESS');

                const targetProjectId = args.projectId || scope.projectId;
                if (targetProjectId) {
                    q = q.where('t.project_id', integer(targetProjectId));
                }
                if (args.dprId) {
                    q = q.where('t.id', integer(args.dprId));
                }
                if (args.date) {
                    q = q.where(function () {
                        this.where('t.txn_date', 'like', `${args.date}%`)
                            .orWhereRaw('DATE(t.txn_date) = ?', [args.date]);
                    });
                }

                const limit = Math.min(args.limit || 10, 20);
                const rows = await q.select(
                    't.id', 't.org_id', 't.project_id', 't.txn_type', 't.txn_date', 't.status', 't.remarks', 't.created_at', 't.updated_at',
                    'p.name as project_name', 'p.project_code'
                ).orderBy('t.txn_date', 'desc').orderBy('t.id', 'desc').limit(limit);

                if (rows.length === 0) {
                    result = [];
                    break;
                }

                const txnIds = rows.map(r => r.id);
                const lines = await db('txn_transaction_lines').whereIn('transaction_id', txnIds);
                const linesByTxn = {};
                for (const l of lines) {
                    if (!linesByTxn[l.transaction_id]) linesByTxn[l.transaction_id] = [];
                    linesByTxn[l.transaction_id].push(l);
                }

                result = rows.map(r => parseDprTransaction(r, linesByTxn[r.id] || []));
                break;
            }
            case 'reports.getWPR': {
                if (!db) { result = []; break; }
                const targetProjectId = args.projectId || scope.projectId;
                let startDateStr, endDateStr, refDate;

                if (args.startDate && args.endDate) {
                    startDateStr = args.startDate;
                    endDateStr = args.endDate;
                    refDate = new Date(startDateStr);
                } else if (args.date) {
                    refDate = new Date(args.date);
                } else if (args.weekNumber) {
                    let targetYear = new Date().getFullYear();
                    let latestQ = db('txn_transactions').where({ org_id: orgId, txn_type: 'DAILY_PROGRESS' });
                    if (targetProjectId) latestQ = latestQ.where({ project_id: integer(targetProjectId) });
                    const latestTxn = await latestQ.orderBy('txn_date', 'desc').first();
                    if (latestTxn && latestTxn.txn_date) {
                        targetYear = new Date(latestTxn.txn_date).getFullYear();
                    }
                    const jan4 = new Date(targetYear, 0, 4);
                    const day = jan4.getDay() || 7;
                    const week1Monday = new Date(jan4);
                    week1Monday.setDate(jan4.getDate() - day + 1);
                    const targetMonday = new Date(week1Monday);
                    targetMonday.setDate(week1Monday.getDate() + (args.weekNumber - 1) * 7);
                    refDate = targetMonday;
                } else {
                    let latestQ = db('txn_transactions').where({ org_id: orgId, txn_type: 'DAILY_PROGRESS' });
                    if (targetProjectId) latestQ = latestQ.where({ project_id: integer(targetProjectId) });
                    const latestTxn = await latestQ.orderBy('txn_date', 'desc').first();
                    if (latestTxn && latestTxn.txn_date) {
                        refDate = new Date(latestTxn.txn_date);
                    } else {
                        refDate = new Date();
                    }
                }

                if (!startDateStr || !endDateStr) {
                    const target = new Date(refDate);
                    const day = target.getDay();
                    const diffToMonday = (day === 0 ? -6 : 1) - day;
                    const monday = new Date(target);
                    monday.setDate(target.getDate() + diffToMonday);
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    startDateStr = monday.toISOString().slice(0, 10);
                    endDateStr = sunday.toISOString().slice(0, 10);
                }

                let q = db('txn_transactions as t')
                    .leftJoin('proj_projects as p', 't.project_id', 'p.id')
                    .where('t.org_id', orgId)
                    .where('t.txn_type', 'DAILY_PROGRESS');

                if (targetProjectId) {
                    q = q.where('t.project_id', integer(targetProjectId));
                }
                if (startDateStr && endDateStr) {
                    q = q.where(function () {
                        this.whereBetween('t.txn_date', [`${startDateStr} 00:00:00`, `${endDateStr} 23:59:59`])
                            .orWhereRaw('DATE(t.txn_date) BETWEEN ? AND ?', [startDateStr, endDateStr]);
                    });
                }

                const rows = await q.select(
                    't.id', 't.org_id', 't.project_id', 't.txn_type', 't.txn_date', 't.status', 't.remarks', 't.created_at', 't.updated_at',
                    'p.name as project_name', 'p.project_code'
                ).orderBy('t.txn_date', 'asc').limit(30);

                let dprs = [];
                if (rows.length > 0) {
                    const txnIds = rows.map(r => r.id);
                    const lines = await db('txn_transaction_lines').whereIn('transaction_id', txnIds);
                    const linesByTxn = {};
                    for (const l of lines) {
                        if (!linesByTxn[l.transaction_id]) linesByTxn[l.transaction_id] = [];
                        linesByTxn[l.transaction_id].push(l);
                    }
                    dprs = rows.map(r => parseDprTransaction(r, linesByTxn[r.id] || []));
                }

                const resolvedProjectId = targetProjectId || dprs[0]?.project_id || null;
                const projRow = resolvedProjectId ? await db('proj_projects').where({ id: resolvedProjectId, org_id: orgId }).first() : (rows[0] || {});
                const projectName = projRow?.name || rows[0]?.project_name || 'Project';
                const projectCode = projRow?.project_code || rows[0]?.project_code || '';

                const dForWeek = new Date(startDateStr);
                const dUtc = new Date(Date.UTC(dForWeek.getFullYear(), dForWeek.getMonth(), dForWeek.getDate()));
                const dayNum = dUtc.getUTCDay() || 7;
                dUtc.setUTCDate(dUtc.getUTCDate() + 4 - dayNum);
                const yearStart = new Date(Date.UTC(dUtc.getUTCFullYear(), 0, 1));
                const isoWeekNum = Math.ceil((((dUtc - yearStart) / 86400000) + 1) / 7);
                const weekNum = args.weekNumber || isoWeekNum;

                let totalManpower = 0;
                const weatherCounts = {};
                const siteConditions = new Set();
                const tradeTotals = {};
                const agencyMap = {};
                const itemsMap = {};
                const tomorrowPlans = [];
                const weeklyEvents = [];
                const weeklyRemarks = [];

                dprs.forEach(dpr => {
                    totalManpower += dpr.total_manpower || 0;
                    if (dpr.weather) weatherCounts[dpr.weather] = (weatherCounts[dpr.weather] || 0) + 1;
                    if (dpr.site_condition) siteConditions.add(dpr.site_condition);
                    if (Array.isArray(dpr.events)) dpr.events.forEach(e => { if (e && !weeklyEvents.includes(e)) weeklyEvents.push(e); });
                    if (Array.isArray(dpr.remarks)) dpr.remarks.forEach(r => { if (r && !weeklyRemarks.includes(r)) weeklyRemarks.push(r); });

                    if (Array.isArray(dpr.labour_summary)) {
                        dpr.labour_summary.forEach(l => {
                            if (!agencyMap[l.agency]) {
                                agencyMap[l.agency] = {
                                    agency: l.agency,
                                    total_manpower: 0,
                                    trades: {},
                                    remarks: []
                                };
                            }
                            agencyMap[l.agency].total_manpower += (l.headcount || 0);
                            if (l.remarks && !agencyMap[l.agency].remarks.includes(l.remarks)) {
                                agencyMap[l.agency].remarks.push(l.remarks);
                            }
                            if (l.trades) {
                                for (const [trade, count] of Object.entries(l.trades)) {
                                    agencyMap[l.agency].trades[trade] = (agencyMap[l.agency].trades[trade] || 0) + count;
                                    tradeTotals[trade] = (tradeTotals[trade] || 0) + count;
                                }
                            }
                        });
                    }

                    if (Array.isArray(dpr.today_progress)) {
                        dpr.today_progress.forEach(p => {
                            if (!itemsMap[p.item]) {
                                itemsMap[p.item] = { item: p.item, total_executed: 0, unit: p.unit, descriptions: [] };
                            }
                            itemsMap[p.item].total_executed = Math.round((itemsMap[p.item].total_executed + (p.quantity || 0)) * 100) / 100;
                            if (p.description && !itemsMap[p.item].descriptions.includes(p.description)) {
                                itemsMap[p.item].descriptions.push(p.description);
                            }
                        });
                    }

                    if (Array.isArray(dpr.tomorrow_plan)) {
                        dpr.tomorrow_plan.forEach(tp => {
                            const exists = tomorrowPlans.some(p => p.item === tp.item && p.description === tp.description && p.unit === tp.unit);
                            if (!exists) {
                                tomorrowPlans.push(tp);
                            }
                        });
                    }
                });

                const dominantWeather = Object.keys(weatherCounts).sort((a, b) => weatherCounts[b] - weatherCounts[a])[0] || 'sunny';
                const avgManpower = dprs.length > 0 ? Math.round(totalManpower / dprs.length) : 0;

                result = [{
                    kind: 'wpr_report',
                    report_type: 'WEEKLY_PROGRESS',
                    week_label: `Week ${weekNum} (${startDateStr} to ${endDateStr})`,
                    week_number: weekNum,
                    date_range: `${startDateStr} to ${endDateStr}`,
                    project_id: resolvedProjectId,
                    project_name: projectName,
                    project_code: projectCode,
                    dpr_count: dprs.length,
                    active_days: dprs.length,
                    total_manpower_deployed: totalManpower,
                    average_daily_personnel: avgManpower,
                    dominant_weather: dominantWeather,
                    site_conditions: Array.from(siteConditions).join(', ') || 'dry',
                    trades_breakdown: tradeTotals,
                    contractors_breakdown: Object.values(agencyMap),
                    progress_items_executed: Object.values(itemsMap),
                    strategic_outlook_next_week: tomorrowPlans,
                    key_events: weeklyEvents,
                    supervisor_remarks: weeklyRemarks
                }];
                break;
            }
            case 'reports.getMPR': {
                if (!db) { result = []; break; }
                const targetProjectId = args.projectId || scope.projectId;
                let targetYear, targetMonth;

                if (args.year && args.month) {
                    targetYear = integer(args.year);
                    targetMonth = integer(args.month);
                } else if (args.date) {
                    const d = new Date(args.date);
                    targetYear = d.getFullYear();
                    targetMonth = d.getMonth() + 1;
                } else {
                    let fallbackQ = db('txn_transactions').where('org_id', orgId).where('txn_type', 'DAILY_PROGRESS');
                    if (targetProjectId) fallbackQ = fallbackQ.where({ project_id: integer(targetProjectId) });
                    const latest = await fallbackQ.orderBy('txn_date', 'desc').first();
                    if (latest && latest.txn_date) {
                        const d = new Date(latest.txn_date);
                        targetYear = d.getFullYear();
                        targetMonth = d.getMonth() + 1;
                    } else {
                        const now = new Date();
                        targetYear = now.getFullYear();
                        targetMonth = now.getMonth() + 1;
                    }
                }

                const padMonth = String(targetMonth).padStart(2, '0');
                const lastDay = new Date(targetYear, targetMonth, 0).getDate();
                const startDateStr = `${targetYear}-${padMonth}-01`;
                const endDateStr = `${targetYear}-${padMonth}-${String(lastDay).padStart(2, '0')}`;

                let q = db('txn_transactions as t')
                    .leftJoin('proj_projects as p', 't.project_id', 'p.id')
                    .where('t.org_id', orgId)
                    .where('t.txn_type', 'DAILY_PROGRESS');

                if (targetProjectId) q = q.where('t.project_id', integer(targetProjectId));
                q = q.where(function () {
                    this.whereBetween('t.txn_date', [`${startDateStr} 00:00:00`, `${endDateStr} 23:59:59`])
                        .orWhereRaw('DATE(t.txn_date) BETWEEN ? AND ?', [startDateStr, endDateStr]);
                });

                const rows = await q.select(
                    't.id', 't.org_id', 't.project_id', 't.txn_type', 't.txn_date', 't.status', 't.remarks', 't.created_at', 't.updated_at',
                    'p.name as project_name', 'p.project_code'
                ).orderBy('t.txn_date', 'asc');

                let dprs = [];
                if (rows.length > 0) {
                    const txnIds = rows.map(r => r.id);
                    const lines = await db('txn_transaction_lines').whereIn('transaction_id', txnIds);
                    const linesByTxn = {};
                    for (const l of lines) {
                        if (!linesByTxn[l.transaction_id]) linesByTxn[l.transaction_id] = [];
                        linesByTxn[l.transaction_id].push(l);
                    }
                    dprs = rows.map(r => parseDprTransaction(r, linesByTxn[r.id] || []));
                }

                const resolvedProjectId = targetProjectId || dprs[0]?.project_id || null;
                const projRow = resolvedProjectId ? await db('proj_projects').where({ id: resolvedProjectId, org_id: orgId }).first() : (rows[0] || {});
                const projectName = projRow?.name || rows[0]?.project_name || 'Project';
                const projectCode = projRow?.project_code || rows[0]?.project_code || '';

                const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthName = `${monthNames[targetMonth] || 'Month'} ${targetYear}`;

                let totalManpower = 0;
                const weatherCounts = {};
                const siteConditions = new Set();
                const tradeTotals = {};
                const agencyMap = {};
                const itemsMap = {};
                const monthlyPlans = [];
                const monthlyEvents = [];
                const monthlyRemarks = [];

                const weeklyGroups = [
                    { week: 'Week 1', range: `1-${Math.min(7, lastDay)} ${monthNames[targetMonth]}`, dprs: [], manpower: 0 },
                    { week: 'Week 2', range: `8-${Math.min(14, lastDay)} ${monthNames[targetMonth]}`, dprs: [], manpower: 0 },
                    { week: 'Week 3', range: `15-${Math.min(21, lastDay)} ${monthNames[targetMonth]}`, dprs: [], manpower: 0 },
                    { week: 'Week 4', range: `22-${lastDay} ${monthNames[targetMonth]}`, dprs: [], manpower: 0 }
                ];

                dprs.forEach(dpr => {
                    totalManpower += dpr.total_manpower || 0;
                    if (dpr.weather) weatherCounts[dpr.weather] = (weatherCounts[dpr.weather] || 0) + 1;
                    if (dpr.site_condition) siteConditions.add(dpr.site_condition);
                    if (Array.isArray(dpr.events)) dpr.events.forEach(e => { if (e && !monthlyEvents.includes(e)) monthlyEvents.push(e); });
                    if (Array.isArray(dpr.remarks)) dpr.remarks.forEach(r => { if (r && !monthlyRemarks.includes(r)) monthlyRemarks.push(r); });

                    const d = new Date(dpr.date);
                    const dayOfMonth = d.getDate();
                    const weekIdx = dayOfMonth <= 7 ? 0 : dayOfMonth <= 14 ? 1 : dayOfMonth <= 21 ? 2 : 3;
                    weeklyGroups[weekIdx].dprs.push(dpr.id);
                    weeklyGroups[weekIdx].manpower += dpr.total_manpower || 0;

                    if (Array.isArray(dpr.labour_summary)) {
                        dpr.labour_summary.forEach(l => {
                            if (!agencyMap[l.agency]) {
                                agencyMap[l.agency] = {
                                    agency: l.agency,
                                    total_manpower: 0,
                                    trades: {},
                                    remarks: []
                                };
                            }
                            agencyMap[l.agency].total_manpower += (l.headcount || 0);
                            if (l.remarks && !agencyMap[l.agency].remarks.includes(l.remarks)) {
                                agencyMap[l.agency].remarks.push(l.remarks);
                            }
                            if (l.trades) {
                                for (const [trade, count] of Object.entries(l.trades)) {
                                    agencyMap[l.agency].trades[trade] = (agencyMap[l.agency].trades[trade] || 0) + count;
                                    tradeTotals[trade] = (tradeTotals[trade] || 0) + count;
                                }
                            }
                        });
                    }

                    if (Array.isArray(dpr.today_progress)) {
                        dpr.today_progress.forEach(p => {
                            if (!itemsMap[p.item]) {
                                itemsMap[p.item] = { item: p.item, total_executed: 0, unit: p.unit, entries_count: 0, descriptions: [] };
                            }
                            itemsMap[p.item].total_executed = Math.round((itemsMap[p.item].total_executed + (p.quantity || 0)) * 100) / 100;
                            itemsMap[p.item].entries_count += 1;
                            if (p.description && !itemsMap[p.item].descriptions.includes(p.description)) {
                                itemsMap[p.item].descriptions.push(p.description);
                            }
                        });
                    }

                    if (Array.isArray(dpr.tomorrow_plan)) {
                        dpr.tomorrow_plan.forEach(tp => {
                            const exists = monthlyPlans.some(p => p.item === tp.item && p.description === tp.description && p.unit === tp.unit);
                            if (!exists) {
                                monthlyPlans.push(tp);
                            }
                        });
                    }
                });

                const dominantWeather = Object.keys(weatherCounts).sort((a, b) => weatherCounts[b] - weatherCounts[a])[0] || 'sunny';

                result = [{
                    kind: 'mpr_report',
                    report_type: 'MONTHLY_PROGRESS',
                    month_label: monthName,
                    month: targetMonth,
                    year: targetYear,
                    date_range: `${startDateStr} to ${endDateStr}`,
                    project_id: resolvedProjectId,
                    project_name: projectName,
                    project_code: projectCode,
                    total_dprs: dprs.length,
                    working_days_recorded: dprs.length,
                    total_manpower_deployed: totalManpower,
                    average_daily_personnel: dprs.length > 0 ? Math.round(totalManpower / dprs.length) : 0,
                    dominant_weather: dominantWeather,
                    site_conditions: Array.from(siteConditions).join(', ') || 'dry',
                    weather_distribution: weatherCounts,
                    trades_breakdown: tradeTotals,
                    contractors_breakdown: Object.values(agencyMap),
                    cumulative_items_executed: Object.values(itemsMap),
                    strategic_outlook_next_month: monthlyPlans,
                    weekly_progression: weeklyGroups.map(w => ({ week: w.week, range: w.range, dpr_count: w.dprs.length, manpower: w.manpower })),
                    key_events_and_milestones: monthlyEvents,
                    executive_observations: monthlyRemarks
                }];
                break;
            }
            case 'approvals.listPending': {
                const queue = await approvalService.listPendingApprovals(orgId, {
                    projectId: args.projectId,
                    limit: paging.limit,
                    offset: paging.offset
                });
                result = [{ kind: 'approval_queue', ...queue }];
                break;
            }
            case 'projects.search': result = await projects.getProjects(orgId, userId, userType, { ...paging, query: args.query, agentRead: true }); break;
            case 'projects.get': result = [project(await projects.getProjectById(orgId, args.projectId, { agentRead: true }))]; break;
            case 'projects.getExecutiveBriefing': result = await projects.getProjectExecutiveBriefing(orgId, args.projectId); break;
            case 'tasks.search': {
                let q = db('proj_tasks as t')
                    .join('proj_projects as p', 't.project_id', 'p.id')
                    .leftJoin('proj_task_categories as c', 't.category_id', 'c.id')
                    .where('p.org_id', orgId);

                const targetProjectId = args.projectId || scope.projectId;
                if (targetProjectId) {
                    q = q.where('t.project_id', integer(targetProjectId));
                }

                if (args.query && String(args.query).trim()) {
                    const term = `%${String(args.query).trim()}%`;
                    q = q.where(function () {
                        this.whereILike('t.name', term)
                            .orWhereILike('t.task_code', term)
                            .orWhereILike('t.description', term)
                            .orWhereILike('c.name', term)
                            .orWhereILike('p.name', term);
                    });
                }

                const rows = await q.select(
                    't.id', 't.name', 't.task_code', 't.description', 't.status', 't.priority',
                    't.start_date', 't.due_date', 't.duration', 't.project_id',
                    'p.name as project_name', 'p.project_code',
                    'c.name as category_name'
                ).orderBy('t.sort_order', 'asc').orderBy('t.id', 'asc').limit(paging.limit).offset(paging.offset);

                result = rows.map(r => {
                    const formattedStart = r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : null;
                    const formattedDue = r.due_date ? new Date(r.due_date).toISOString().slice(0, 10) : null;
                    const code = r.task_code || `T-${r.id}`;
                    return project({
                        id: r.id,
                        name: r.name,
                        code,
                        task_code: code,
                        project_id: r.project_id,
                        project_name: r.project_name || null,
                        project_code: r.project_code || null,
                        category: r.category_name || 'General',
                        status: r.status || 'TODO',
                        priority: r.priority || 'MEDIUM',
                        start_date: formattedStart,
                        due_date: formattedDue,
                        duration: r.duration ? `${r.duration} days` : null,
                        description: r.description || undefined
                    });
                });
                break;
            }
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
            case 'transactions.search': {
                let q = db('txn_transactions as t')
                    .leftJoin('proj_projects as p', 't.project_id', 'p.id')
                    .where('t.org_id', orgId);
                if (args.projectId) {
                    q = q.where('t.project_id', args.projectId);
                }
                if (args.query && String(args.query).trim()) {
                    const term = `%${String(args.query).trim()}%`;
                    q = q.where(function () {
                        this.whereILike('t.txn_type', term)
                            .orWhereILike('t.status', term)
                            .orWhereILike('t.remarks', term)
                            .orWhereILike('p.name', term);
                    });
                }
                const rows = await q.select(
                    't.id', 't.org_id', 't.project_id', 't.txn_type', 't.txn_date', 't.status', 't.remarks', 't.created_at',
                    'p.name as project_name', 'p.project_code'
                ).orderBy('t.txn_date', 'desc').orderBy('t.id', 'desc').limit(paging.limit).offset(paging.offset);

                result = rows.map(r => {
                    let cleanRemarks = r.remarks;
                    if (cleanRemarks && typeof cleanRemarks === 'string' && cleanRemarks.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(cleanRemarks);
                            if (Array.isArray(parsed.remarksList) && parsed.remarksList.filter(Boolean).length > 0) {
                                cleanRemarks = parsed.remarksList.filter(Boolean).join('; ');
                            } else if (parsed.distribution) {
                                cleanRemarks = `Distribution: ${parsed.distribution}${parsed.weather ? ` (${parsed.weather})` : ''}`;
                            }
                        } catch { /* keep original */ }
                    }
                    const formattedDate = r.txn_date ? new Date(r.txn_date).toISOString().slice(0, 10) : (r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : null);
                    const typeLabel = (r.txn_type || 'TRANSACTION').replace(/_/g, ' ');
                    return project({
                        id: r.id,
                        name: `${typeLabel} #${r.id}`,
                        project_id: r.project_id,
                        project_name: r.project_name || null,
                        project_code: r.project_code || null,
                        txn_type: r.txn_type || 'GENERAL',
                        category: typeLabel,
                        status: r.status || 'CONFIRMED',
                        txn_date: formattedDate,
                        remarks: cleanRemarks || undefined,
                    });
                });
                break;
            }
            case 'billing.search': {
                let q = db('txn_transactions as t')
                    .leftJoin('proj_projects as p', 't.project_id', 'p.id')
                    .where('t.org_id', actor.orgId);
                if (args.projectId) {
                    q = q.where('t.project_id', integer(args.projectId));
                }
                if (args.type && String(args.type).trim()) {
                    q = q.whereILike('t.txn_type', `%${String(args.type).trim()}%`);
                }
                if (args.query && String(args.query).trim()) {
                    const term = `%${String(args.query).trim()}%`;
                    q = q.where(function () {
                        this.whereILike('t.txn_type', term)
                            .orWhereILike('t.status', term)
                            .orWhereILike('t.remarks', term)
                            .orWhereILike('p.name', term);
                    });
                }
                const rows = await q.select(
                    't.id', 't.org_id', 't.project_id', 't.txn_type', 't.txn_date', 't.status', 't.remarks', 't.created_at',
                    'p.name as project_name', 'p.project_code'
                ).orderBy('t.txn_date', 'desc').orderBy('t.id', 'desc').limit(paging.limit).offset(paging.offset);

                result = rows.map(r => {
                    let cleanRemarks = r.remarks;
                    if (cleanRemarks && typeof cleanRemarks === 'string' && cleanRemarks.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(cleanRemarks);
                            if (Array.isArray(parsed.remarksList) && parsed.remarksList.filter(Boolean).length > 0) {
                                cleanRemarks = parsed.remarksList.filter(Boolean).join('; ');
                            } else if (parsed.distribution) {
                                cleanRemarks = `Distribution: ${parsed.distribution}${parsed.weather ? ` (${parsed.weather})` : ''}`;
                            }
                        } catch { /* keep original */ }
                    }
                    const formattedDate = r.txn_date ? new Date(r.txn_date).toISOString().slice(0, 10) : (r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : null);
                    const typeLabel = (r.txn_type || 'BILLING').replace(/_/g, ' ');
                    return project({
                        id: r.id,
                        name: `${typeLabel} #${r.id}`,
                        project_id: r.project_id,
                        project_name: r.project_name || null,
                        project_code: r.project_code || null,
                        txn_type: r.txn_type || 'BILLING',
                        category: typeLabel,
                        status: r.status || 'CONFIRMED',
                        txn_date: formattedDate,
                        remarks: cleanRemarks || undefined,
                    });
                });
                break;
            }
            case 'analytics.query': result = await executeAnalyticsQuery(db, actor, args); break;
            default: fail('validation_error', 'unknown_read_tool');
        }
        if (!Array.isArray(result) || result.length > (tool.name === 'resources.getComposition' ? 200 : 50)) fail('execution_failure', 'read_result_limit');
        const encoded = JSON.stringify(result);
        if (Buffer.byteLength(encoded) > 32768) fail('request_rejected', 'read_result_bytes');
        // Search permission is broader than membership-filtered project results.
        // Persist these entity references with the result in the caller's transaction.
        if (tool.name === 'projects.search') {
            for (const row of result) {
                const ref = { projectId: integer(row.id) };
                await authorize(actor, TOOLS['projects.get'], ref);
                options.recordAuthorization(TOOLS['projects.get'], ref);
            }
        }
        return JSON.parse(encoded);
    };
}
