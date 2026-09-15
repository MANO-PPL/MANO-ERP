export const REPORT_TYPES = Object.freeze(['daily', 'weekly', 'monthly', 'employee', 'config']);
export const REPORT_VIEWS = Object.freeze(['list', 'create', 'details']);

export function resolveReportType(value) { return REPORT_TYPES.includes(value) ? value : 'daily'; }
export function resolveReportView(value, { type = 'daily', canWrite = false, hasSelectedReport = false } = {}) {
    if (!REPORT_VIEWS.includes(value)) return 'list';
    if (value === 'create' && (type !== 'daily' || !canWrite)) return 'list';
    if (value === 'details' && !hasSelectedReport) return 'list';
    return value;
}
export function updateReportsSearch(search, changes = {}) {
    const next = new URLSearchParams(search || '');
    Object.entries(changes).forEach(([key, value]) => value == null || value === '' ? next.delete(key) : next.set(key, value));
    return next;
}

export function createReportsRequestGuard() {
    let generation = 0; let projectId = '';
    return {
        begin(id) { generation += 1; projectId = String(id); return { generation, projectId }; },
        invalidate(id = projectId) { generation += 1; projectId = String(id); },
        isCurrent(token, id = projectId) { return token?.generation === generation && token?.projectId === String(id) && projectId === String(id); },
    };
}

export const DEFAULT_DPR_CONFIG = Object.freeze({
    trades: ['Plumber', 'Supervisor', 'Carpenter', 'Fitter', 'Electrician', 'Operator', 'Mason', 'Labour', 'Store Labour', 'Staff'],
    distributions: ['GLOWMEX'], preparedBys: ['SITE ENGINEER'],
});
export const dprConfigKey = (projectId) => `dpr_config_${projectId}`;
export function normalizeDprConfig(value = {}) {
    const unique = (rows, fallback) => [...new Set((Array.isArray(rows) ? rows : fallback).map((item) => String(item).trim()).filter(Boolean))];
    return { trades: unique(value.trades, DEFAULT_DPR_CONFIG.trades), distributions: unique(value.distributions, DEFAULT_DPR_CONFIG.distributions), preparedBys: unique(value.preparedBys, DEFAULT_DPR_CONFIG.preparedBys), updatedAt: value.updatedAt || null };
}
export function readDprConfig(projectId, storage = globalThis.localStorage) {
    try { return normalizeDprConfig(JSON.parse(storage?.getItem(dprConfigKey(projectId)) || '{}')); } catch { return normalizeDprConfig(); }
}
export function saveDprConfig(projectId, value, storage = globalThis.localStorage) {
    const config = { ...normalizeDprConfig(value), updatedAt: new Date().toISOString() }; storage?.setItem(dprConfigKey(projectId), JSON.stringify(config)); return config;
}

export function sortReports(rows = []) { return [...rows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))); }
export function reportTotalLabour(report) { return (report?.labourData || []).reduce((sum, row) => sum + Object.entries(row).filter(([key]) => !['agency', 'remarks'].includes(key)).reduce((n, [, value]) => n + (Number(value) || 0), 0), 0); }
export function enrichAIRequest(report, project) { return { reportData: { ...(report || {}), project: { id: project?.id ?? project?.dbId, name: project?.name || '', code: project?.project_code || '', location: project?.location || project?.metadata?.location || '' } } }; }

export function moveSlide(slides, from, to) { const next = [...slides]; if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }
export function canDeleteSlide(slides) { return (slides || []).length > 1; }
export function normalizeChartValue(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
export function presentationFilename(month) { return `${String(month || 'Executive_Report').trim().replace(/[^a-z0-9_-]+/gi, '_')}_Presentation.pdf`; }

export const PRESENTATION_TABLE_BASE_COLUMNS = Object.freeze({
    directory_table: ['Role', 'Name', 'Company', 'Contact'],
    variance_table: ['Task Activity', 'Planned', 'Actual', 'Variance', 'Status'],
    labour_table: ['Time Period', 'Predicted Cost', 'Actual Cost', 'Variance'],
    material_table: ['Time Period', 'Predicted Cost', 'Actual Cost', 'Variance'],
    execution_table: ['Task Name', 'Duration', '% Done', 'Planned Start', 'Actual Start', 'Planned End', 'Actual End'],
});

const PRESENTATION_TABLE_DEFAULT_ROWS = Object.freeze({
    directory_table: { role: 'New Role', name: 'New Name', company: 'New Company', contact: 'New Contact' },
    variance_table: { task: 'New Task', plannedQty: 0, executedQty: 0, variance: 0, unit: 'unit' },
    labour_table: { week: 'New Week', labour: [], materials: [] },
    material_table: { week: 'New Week', labour: [], materials: [] },
    execution_table: { task: 'New Task', duration: '0 Days', completionPercentage: 0, plannedStart: 'Date', actualStart: 'Date', plannedEnd: 'Date', actualEnd: 'Date' },
});

export function addPresentationTableRow(table) {
    const row = PRESENTATION_TABLE_DEFAULT_ROWS[table?.type];
    return row ? { ...table, rows: [...(table.rows || []), { ...row }] } : table;
}
export function deletePresentationTableRow(table) {
    return (table?.rows?.length || 0) <= 1 ? table : { ...table, rows: table.rows.slice(0, -1) };
}
export function addPresentationTableColumn(table) {
    return { ...table, headers: [...(table?.headers || []), 'New Column'] };
}
export function deletePresentationTableColumn(table) {
    const minimum = PRESENTATION_TABLE_BASE_COLUMNS[table?.type]?.length || 1;
    return (table?.headers?.length || 0) <= minimum ? table : { ...table, headers: table.headers.slice(0, -1) };
}
export function editPresentationTableHeader(table, columnIndex, value) {
    const headers = [...(table?.headers || [])]; headers[columnIndex] = value; return { ...table, headers };
}
export function presentationTableField(table, columnIndex) {
    const fields = {
        directory_table: ['role', 'name', 'company', 'contact'],
        variance_table: ['task', 'plannedQty', 'executedQty', 'variance', 'status'],
        labour_table: ['week', 'predicted', 'actual', 'variance'],
        material_table: ['week', 'predicted', 'actual', 'variance'],
        execution_table: ['task', 'duration', 'completionPercentage', 'plannedStart', 'actualStart', 'plannedEnd', 'actualEnd'],
    }[table?.type] || [];
    return fields[columnIndex] || `dynamic_${columnIndex - fields.length}`;
}
export function editPresentationTableCell(table, rowIndex, columnIndex, value) {
    const rows = [...(table?.rows || [])];
    const field = presentationTableField(table, columnIndex);
    const numericFields = new Set(['plannedQty', 'executedQty', 'variance', 'completionPercentage']);
    rows[rowIndex] = { ...rows[rowIndex], [field]: numericFields.has(field) ? (parseFloat(value) || 0) : value };
    return { ...table, rows };
}
export function normalizePresentationChartValue(value) {
    const parsed = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed * 100000;
}
export function editPresentationChartItem(chartData, index, field, value) {
    const next = [...(chartData || [])];
    next[index] = { ...next[index], [field]: field === 'value' ? normalizePresentationChartValue(value) : value };
    return next;
}

export const WEEKLY_DEMO = Object.freeze([{ id: 'w1', month: 'April', week: 'Week 4 · 22–28 Apr 2026', workingDays: 6, execution: 78, activities: [{ item: 'RCC slab', description: 'First-floor slab reinforcement', unit: 'm²', total: 1200, previous: 620, planned: 220, executed: 190, balance: 30, cumulative: 810, next: 240, remarks: 'Access coordinated' }], manpower: 84, conditions: 'Mostly dry', progression: 'Structural works continued', strategy: 'Complete remaining slab and begin services.' }]);
export const MONTHLY_DEMO = Object.freeze([{ id: 'm1', month: 'April 2026', efficiency: 82, days: 26, progress: 64, budget: 'Demo budget view', overview: 'Frontend-generated monthly archive demonstration.', variance: [{ task: 'Structure', planned: 70, actual: 64 }], weeks: [48, 54, 59, 64], roadmap: ['Complete structure', 'Begin MEP rough-in'], timeline: [{ item: 'RCC works', start: '01 Apr', end: '24 Apr', status: 'Recorded demo' }], labour: { budget: 120000, actual: 112000 }, materials: { budget: 460000, actual: 438000 }, quality: ['Cube test records reviewed', 'Inspection checklist demonstration'] }]);
export const TEAM_DEMO = Object.freeze([{ id: 'EMP-001', name: 'Asha Rao', role: 'Site Engineer', contribution: 'High', tasks: 18, efficiency: 91, history: [{ taskId: 'TASK-18', name: 'Slab inspection', date: '2026-04-24', status: 'Completed', impact: 'High' }] }, { id: 'EMP-002', name: 'Rahul Sen', role: 'Quantity Surveyor', contribution: 'Medium', tasks: 12, efficiency: 84, history: [{ taskId: 'TASK-09', name: 'Quantity reconciliation', date: '2026-04-21', status: 'Completed', impact: 'Medium' }] }]);
