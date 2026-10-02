export const PLANNING_REPORTS = Object.freeze(['project-planning', 'logistic-plan', 'manpower-histogram', 'material-histogram', 'hindrance-report', 'budget']);
export const MANPOWER_VIEWS = Object.freeze(['histogram', 'planning']);
export const APPROVAL_MAIN_SECTIONS = Object.freeze(['Tasks', 'WIP', 'Reports', 'General Documents', 'Drawings', 'Planning', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management']);
export const GENERAL_DOCUMENT_SECTIONS = Object.freeze(['Project Vendor List', 'Project Directory', 'Staff Roles', 'Project Summary', 'Agenda of Meeting', 'Minutes of Meeting', 'Organisation Chart', 'Daily Progress Report (DPR)']);
export const APPROVAL_CONFIG_SECTIONS = Object.freeze([...APPROVAL_MAIN_SECTIONS.filter((item) => item !== 'General Documents'), ...GENERAL_DOCUMENT_SECTIONS]);
export const EPISODIC_WORKFLOWS = Object.freeze(['Agenda of Meeting', 'Minutes of Meeting', 'Daily Progress Report (DPR)']);
export const PROJECT_PERMISSION_PAGES = Object.freeze(['Tasks', 'WIP', 'Reports', 'General Documents', 'Spreadsheets', 'Drawings', 'Planning', 'Phases', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management', 'Transactions', 'Approvals']);

export const resolvePlanningReport = (value) => PLANNING_REPORTS.includes(value) ? value : 'hub';
export const resolveManpowerView = (value) => MANPOWER_VIEWS.includes(value) ? value : 'histogram';
export const updateSearch = (search, updates = {}) => {
    const next = new URLSearchParams(search || '');
    Object.entries(updates).forEach(([key, value]) => value == null || value === '' ? next.delete(key) : next.set(key, value));
    return next;
};
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const makeLocalId = (prefix = 'local') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
export const dateDiff = (actual, planned) => {
    if (!actual || !planned) return 0;
    const delta = new Date(actual) - new Date(planned);
    return Number.isFinite(delta) ? Math.ceil(delta / 86400000) : 0;
};
export const durationDays = (start, end) => {
    if (!start || !end) return 0;
    const delta = new Date(end) - new Date(start);
    return Number.isFinite(delta) ? Math.max(0, Math.round(delta / 86400000) + 1) : 0;
};
export const formatMoney = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);

// M9 local/demo planning analytics. These intentionally operate only on the
// source workspace's local state; none of these calculations imply ERP data.
export const cumulativeMaterialSeries = (rows = [], months = []) => {
    let planned = 0; let actual = 0;
    return months.map((month, index) => {
        rows.forEach((row) => { planned += Number(row.values?.[index]?.planned || 0) * Number(row.rate || 0); actual += Number(row.values?.[index]?.actual || 0) * Number(row.rate || 0); });
        return { month, planned, actual };
    });
};
export const materialCostDistribution = (rows = []) => {
    const total = rows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
    return rows.map((row) => ({ id: row.id, name: row.name, color: row.color, cost: Number(row.cost || 0), share: total ? (Number(row.cost || 0) / total) * 100 : 0 }));
};
export const importSelectedProjectPlan = (sourcePhases = [], selection = {}) => sourcePhases.flatMap((phase) => {
    const selected = selection[phase.id] || {};
    const tasks = (phase.activities || []).filter((task) => selected.all || selected[task.id]).map((task) => ({ id: makeLocalId('import-task'), name: task.name, start: task.start, end: task.end, manpower: {} }));
    return tasks.length ? [{ id: makeLocalId('import-phase'), name: phase.name, color: phase.color, icon: phase.icon, tasks }] : [];
});
export const deliveryHeatmap = (deliveries = [], months = []) => months.map((month, index) => ({ month, count: deliveries.filter((delivery) => Number(String(delivery.expected || '').slice(5, 7)) === index + 1).length }));
export const vendorPerformance = (deliveries = [], vendors = []) => vendors.map((vendor) => {
    const rows = deliveries.filter((delivery) => delivery.vendor === vendor.id && delivery.status === 'delivered');
    const onTime = rows.filter((delivery) => delivery.actual && delivery.expected && delivery.actual <= delivery.expected).length;
    return { ...vendor, delivered: rows.length, onTime, percentage: rows.length ? Math.round((onTime / rows.length) * 100) : 0 };
});
export const equipmentCost = (equipment = {}) => ({ duration: durationDays(equipment.assignedFrom, equipment.assignedTo), total: durationDays(equipment.assignedFrom, equipment.assignedTo) * Number(equipment.rate || 0) });
export const budgetChartData = (sections = []) => {
    const total = sections.reduce((sum, section) => sum + Number(section.basic || 0), 0);
    return sections.map((section) => ({ id: section.id, name: section.name, basic: Number(section.basic || 0), consumed: Number(section.consumed || 0), remaining: Number(section.remaining || 0), share: total ? (Number(section.basic || 0) / total) * 100 : 0 }));
};

export const computeBudgetItem = (item, slabArea, gstRate) => {
    const combinedRate = item.totalRateOverride == null || item.totalRateOverride === '' ? (Number(item.materialRate) || 0) + (Number(item.labourRate) || 0) : Number(item.totalRateOverride) || 0;
    const basic = (Number(item.quantity) || 0) * combinedRate;
    const gst = basic * (Number(gstRate) || 0);
    const consumed = Number(item.consumed) || 0;
    return { ...item, combinedRate, basic, gstInclusive: basic + gst, ratePerSqft: slabArea ? basic / Number(slabArea) : 0, consumed, remaining: basic - consumed, utilisation: basic ? (consumed / basic) * 100 : 0 };
};
export const computeBudgetSection = (section, slabArea, gstRate) => {
    const items = (section.items || []).map((item) => computeBudgetItem(item, slabArea, gstRate));
    const basic = items.reduce((sum, item) => sum + item.basic, 0);
    const consumed = items.reduce((sum, item) => sum + item.consumed, 0);
    return { ...section, items, basic, gstInclusive: basic * (1 + Number(gstRate || 0)), ratePerSqft: slabArea ? basic / Number(slabArea) : 0, consumed, remaining: basic - consumed, utilisation: basic ? (consumed / basic) * 100 : 0 };
};

export const normalizeAdminUser = (user, index = 0) => {
    const id = user?.user_id ?? user?.id;
    const name = user?.user_name || user?.name || user?.email || `User ${id}`;
    return { id, name, role: user?.user_type || user?.role || 'employee', initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), colorIndex: index % 6, raw: user };
};
export const normalizePermissionLevel = (value) => typeof value === 'string' ? ({ none: 0, view: 1, read: 1, edit: 2, write: 2 }[value.toLowerCase()] ?? 0) : Number(value) || 0;
export const normalizePermissionMap = (permissions = {}) => Object.fromEntries(Object.entries(typeof permissions === 'string' ? JSON.parse(permissions || '{}') : permissions || {}).map(([key, value]) => [key, normalizePermissionLevel(value)]));
export const serializePermissionMap = (permissions = {}) => Object.fromEntries(Object.entries(permissions).map(([key, value]) => [key, ({ 0: 'none', 1: 'view', 2: 'edit' })[Number(value)] || 'none']));
export const emptyWorkflow = () => ({ reporters: [], approvalLevels: [{ id: makeLocalId('level'), label: 'Approval 1', approvers: [] }] });
export const userKey = (user) => String(user?.id ?? user?.user_id ?? '');
export const enforceWorkflowUniqueness = (config) => {
    const used = new Set();
    const reporters = (config.reporters || []).filter((user) => { const key = userKey(user); if (!key || used.has(key)) return false; used.add(key); return true; });
    const approvalLevels = (config.approvalLevels || []).map((level) => ({ ...level, approvers: (level.approvers || []).filter((user) => { const key = userKey(user); if (!key || used.has(key)) return false; used.add(key); return true; }).slice(0, 1) }));
    return { reporters, approvalLevels: approvalLevels.length ? approvalLevels : emptyWorkflow().approvalLevels };
};
export const templatesToWorkflowConfigs = ({ templates = [], details = [], users = [] }) => {
    const byId = new Map(users.map((user) => [String(user.id), user]));
    const configs = Object.fromEntries(APPROVAL_CONFIG_SECTIONS.map((section) => [section, emptyWorkflow()]));
    templates.forEach((template) => { if (!configs[template.name]) configs[template.name] = emptyWorkflow(); });
    details.forEach((response) => {
        const template = response?.template || response;
        if (!template?.name) return;
        const roles = template.document_roles || [];
        configs[template.name] = enforceWorkflowUniqueness({
            reporters: roles.filter((role) => role.role === 'reporter').map((role) => byId.get(String(role.user_id ?? role.id))).filter(Boolean),
            approvalLevels: (template.approval_levels || []).map((level) => ({ id: level.level_id, label: level.label, approvers: roles.filter((role) => role.role === 'approver' && String(role.level_id) === String(level.level_id)).map((role) => byId.get(String(role.user_id ?? role.id))).filter(Boolean).slice(0, 1) })),
        });
    });
    return configs;
};
export const workflowDocType = (section) => EPISODIC_WORKFLOWS.includes(section) ? 'episodic' : 'singleton';

export function createM9RequestGuard() {
    let generation = 0;
    let projectId = null;
    return {
        begin(id) { projectId = String(id); generation += 1; return { projectId, generation }; },
        isCurrent(token, id = projectId) { return token?.generation === generation && token?.projectId === projectId && String(id) === projectId; },
        invalidate(id) { projectId = id == null ? null : String(id); generation += 1; },
    };
}

export async function rebuildWorkflow({ section, projectId, config, templates, workflow, isCurrent = () => true }) {
    const existing = (templates || []).find((item) => item.name === section);
    let documentId = existing?.document_id;
    let changed = false;
    if (!documentId) {
        const created = await workflow.createTemplate({ name: section, doc_type: workflowDocType(section), description: `${section} Workflow`, project_id: projectId });
        changed = true;
        if (!created?.success || !created.document_id) throw Object.assign(new Error(`Failed to create template for ${section}`), { partial: changed });
        documentId = created.document_id;
        if (!isCurrent()) return { success: false, stale: true, partial: changed, documentId };
    }
    const detail = await workflow.getTemplate(documentId);
    if (!detail?.success || !detail.template) throw Object.assign(new Error(`Failed to fetch template detail for ${section}`), { partial: changed });
    if (!isCurrent()) return { success: false, stale: true, partial: changed, documentId };
    try {
        for (const role of detail.template.document_roles || []) { await workflow.removeRole(documentId, role.id); changed = true; if (!isCurrent()) return { success: false, stale: true, partial: true, documentId }; }
        for (const level of detail.template.approval_levels || []) { await workflow.removeLevel(documentId, level.level_id); changed = true; if (!isCurrent()) return { success: false, stale: true, partial: true, documentId }; }
        const safeConfig = enforceWorkflowUniqueness(config);
        for (let index = 0; index < safeConfig.approvalLevels.length; index += 1) {
            const level = safeConfig.approvalLevels[index];
            const added = await workflow.addLevel(documentId, { label: level.label, level_order: index + 1 });
            changed = true;
            if (!added?.success || !added.level_id) throw new Error(`Failed to add ${level.label}`);
            if (!isCurrent()) return { success: false, stale: true, partial: true, documentId };
            for (const user of level.approvers || []) { await workflow.assignRole(documentId, { user_id: Number(user.id), role: 'approver', level_id: added.level_id }); if (!isCurrent()) return { success: false, stale: true, partial: true, documentId }; }
        }
        for (const user of safeConfig.reporters) { await workflow.assignRole(documentId, { user_id: Number(user.id), role: 'reporter' }); changed = true; if (!isCurrent()) return { success: false, stale: true, partial: true, documentId }; }
        return { success: true, stale: !isCurrent(), documentId };
    } catch (error) {
        error.partial = changed;
        throw error;
    }
}

export const errorMessage = (error, fallback) => Number(error?.response?.status || error?.status) === 403 ? 'Access denied by the current ERP permission policy.' : (error?.response?.data?.message || error?.message || fallback);
