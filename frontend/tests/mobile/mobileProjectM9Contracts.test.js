import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetChartData, computeBudgetItem, computeBudgetSection, createM9RequestGuard, cumulativeMaterialSeries, dateDiff, deliveryHeatmap, durationDays, enforceWorkflowUniqueness, equipmentCost, importSelectedProjectPlan, materialCostDistribution, normalizeAdminUser, normalizePermissionMap, rebuildWorkflow, resolveManpowerView, resolvePlanningReport, serializePermissionMap, templatesToWorkflowConfigs, updateSearch, vendorPerformance, workflowDocType } from '../../src/mobile/pages/ProjectDetails/M9/mobileM9Model.js';

test('M9 planning and manpower query contracts preserve unrelated parameters', () => {
    assert.equal(resolvePlanningReport('project-planning'), 'project-planning');
    assert.equal(resolvePlanningReport('unknown'), 'hub');
    assert.equal(resolveManpowerView('planning'), 'planning');
    assert.equal(resolveManpowerView('unknown'), 'histogram');
    const next = updateSearch('?tab=Planning&foo=keep', { report: 'manpower-histogram', mpView: 'planning' });
    assert.equal(next.get('tab'), 'Planning'); assert.equal(next.get('foo'), 'keep'); assert.equal(next.get('report'), 'manpower-histogram'); assert.equal(next.get('mpView'), 'planning');
});

test('M9 source schedule calculations preserve inclusive duration and signed variance', () => {
    assert.equal(durationDays('2026-01-01', '2026-01-10'), 10);
    assert.equal(dateDiff('2026-01-12', '2026-01-10'), 2);
    assert.equal(dateDiff('2026-01-08', '2026-01-10'), -2);
    assert.equal(dateDiff('', '2026-01-10'), 0);
});

test('M9 budget calculations preserve material labour override GST consumed and utilisation contracts', () => {
    const normal = computeBudgetItem({ quantity: 10, materialRate: 20, labourRate: 5, consumed: 50 }, 100, 0.18);
    assert.equal(normal.combinedRate, 25); assert.equal(normal.basic, 250); assert.equal(normal.gstInclusive, 295); assert.equal(normal.remaining, 200); assert.equal(normal.utilisation, 20);
    const override = computeBudgetItem({ quantity: 2, materialRate: 99, labourRate: 99, totalRateOverride: 50 }, 10, 0.1);
    assert.equal(override.basic, 100); assert.equal(override.combinedRate, 50);
    const section = computeBudgetSection({ id: 'x', items: [{ quantity: 2, materialRate: 5, labourRate: 5 }, { quantity: 1, totalRateOverride: 30, consumed: 10 }] }, 10, 0.1);
    assert.equal(section.basic, 50); assert.ok(Math.abs(section.gstInclusive - 55) < 1e-9); assert.equal(section.remaining, 40);
});

test('M9 admin users and permission values use real user_id response shapes', () => {
    assert.deepEqual(normalizeAdminUser({ user_id: 7, user_name: 'Ada Lovelace', user_type: 'employee' }, 0), { id: 7, name: 'Ada Lovelace', role: 'employee', initials: 'AL', colorIndex: 0, raw: { user_id: 7, user_name: 'Ada Lovelace', user_type: 'employee' } });
    assert.deepEqual(normalizePermissionMap({ Planning: 'write', Billing: 'view', Safety: 'none' }), { Planning: 2, Billing: 1, Safety: 0 });
    assert.deepEqual(serializePermissionMap({ Planning: 2, Billing: 1, Safety: 0 }), { Planning: 'edit', Billing: 'view', Safety: 'none' });
});

test('M9 workflow normalization uses document role user_id and enforces mutual exclusion', () => {
    const users = [{ id: 7, name: 'Ada' }, { id: 8, name: 'Lin' }];
    const configs = templatesToWorkflowConfigs({ templates: [{ document_id: 2, name: 'Tasks' }], users, details: [{ success: true, template: { name: 'Tasks', approval_levels: [{ level_id: 3, label: 'Review' }], document_roles: [{ id: 100, user_id: 7, role: 'reporter' }, { id: 101, user_id: 8, role: 'approver', level_id: 3 }] } }] });
    assert.equal(configs.Tasks.reporters[0].id, 7); assert.equal(configs.Tasks.approvalLevels[0].approvers[0].id, 8);
    const unique = enforceWorkflowUniqueness({ reporters: [users[0]], approvalLevels: [{ id: 1, label: 'One', approvers: [users[0], users[1]] }, { id: 2, label: 'Two', approvers: [users[1]] }] });
    assert.deepEqual(unique.approvalLevels[0].approvers.map((user) => user.id), [8]); assert.deepEqual(unique.approvalLevels[1].approvers, []);
});

test('M9 workflow document type preserves episodic source categories', () => {
    assert.equal(workflowDocType('Agenda of Meeting'), 'episodic'); assert.equal(workflowDocType('Minutes of Meeting'), 'episodic'); assert.equal(workflowDocType('Daily Progress Report (DPR)'), 'episodic'); assert.equal(workflowDocType('Tasks'), 'singleton');
});

test('M9 workflow save performs destructive rebuild in source order with exact user_id role', async () => {
    const calls = []; const workflow = {
        getTemplate: async (id) => { calls.push(['getTemplate', id]); return { success: true, template: { document_roles: [{ id: 31 }], approval_levels: [{ level_id: 41 }] } }; },
        removeRole: async (...args) => { calls.push(['removeRole', ...args]); }, removeLevel: async (...args) => { calls.push(['removeLevel', ...args]); },
        addLevel: async (...args) => { calls.push(['addLevel', ...args]); return { success: true, level_id: 51 }; }, assignRole: async (...args) => { calls.push(['assignRole', ...args]); },
    };
    const result = await rebuildWorkflow({ section: 'Tasks', projectId: 42, templates: [{ name: 'Tasks', document_id: 21 }], workflow, config: { reporters: [{ id: 7 }], approvalLevels: [{ id: 1, label: 'Engineer review', approvers: [{ id: 8 }] }] } });
    assert.equal(result.success, true);
    assert.deepEqual(calls, [['getTemplate', 21], ['removeRole', 21, 31], ['removeLevel', 21, 41], ['addLevel', 21, { label: 'Engineer review', level_order: 1 }], ['assignRole', 21, { user_id: 8, role: 'approver', level_id: 51 }], ['assignRole', 21, { user_id: 7, role: 'reporter' }]]);
});

test('M9 workflow create preserves project and episodic payload', async () => {
    const calls = []; const workflow = { createTemplate: async (payload) => { calls.push(payload); return { success: true, document_id: 9 }; }, getTemplate: async () => ({ success: true, template: { document_roles: [], approval_levels: [] } }), removeRole: async () => {}, removeLevel: async () => {}, addLevel: async () => ({ success: true, level_id: 1 }), assignRole: async () => {} };
    await rebuildWorkflow({ section: 'Agenda of Meeting', projectId: 42, templates: [], workflow, config: { reporters: [], approvalLevels: [{ id: 1, label: 'Approval 1', approvers: [] }] } });
    assert.deepEqual(calls[0], { name: 'Agenda of Meeting', doc_type: 'episodic', description: 'Agenda of Meeting Workflow', project_id: 42 });
});

test('M9 request guard rejects late project completion and halts stale workflow continuation', async () => {
    const guard = createM9RequestGuard(); const a = guard.begin(42); const b = guard.begin(43); assert.equal(guard.isCurrent(a, 42), false); assert.equal(guard.isCurrent(b, 43), true);
    const calls = []; const workflow = { getTemplate: async () => ({ success: true, template: { document_roles: [{ id: 1 }], approval_levels: [] } }), removeRole: async () => calls.push('removeRole'), removeLevel: async () => calls.push('removeLevel'), addLevel: async () => ({ success: true, level_id: 1 }), assignRole: async () => calls.push('assignRole') };
    const result = await rebuildWorkflow({ section: 'Tasks', projectId: 42, templates: [{ name: 'Tasks', document_id: 4 }], workflow, config: { reporters: [], approvalLevels: [{ id: 1, label: 'Approval 1', approvers: [] }] }, isCurrent: () => false });
    assert.equal(result.stale, true); assert.deepEqual(calls, []);
});

test('M9 material analytics aggregate selected rows into cumulative planned actual and cost share', () => {
    const rows = [{ id: 'a', name: 'A', rate: 10, cost: 30, values: [{ planned: 1, actual: 2 }, { planned: 2, actual: 1 }] }, { id: 'b', name: 'B', rate: 5, cost: 10, values: [{ planned: 4, actual: 1 }, { planned: 1, actual: 2 }] }];
    assert.deepEqual(cumulativeMaterialSeries(rows, ['Jan', 'Feb']), [{ month: 'Jan', planned: 30, actual: 25 }, { month: 'Feb', planned: 55, actual: 45 }]);
    assert.deepEqual(materialCostDistribution(rows).map((row) => [row.id, row.share]), [['a', 75], ['b', 25]]);
});

test('M9 manpower import preserves only selected source activities and starts allocations empty', () => {
    const source = [{ id: 'phase-a', name: 'Phase A', color: '#123', icon: 'A', activities: [{ id: 'a1', name: 'One', start: '2026-01-01', end: '2026-01-02' }, { id: 'a2', name: 'Two', start: '2026-01-03', end: '2026-01-04' }] }];
    const imported = importSelectedProjectPlan(source, { 'phase-a': { a2: true } });
    assert.equal(imported.length, 1); assert.equal(imported[0].name, 'Phase A'); assert.equal(imported[0].tasks.length, 1); assert.equal(imported[0].tasks[0].name, 'Two'); assert.deepEqual(imported[0].tasks[0].manpower, {});
    assert.equal(importSelectedProjectPlan(source, { 'phase-a': { all: true } })[0].tasks.length, 2);
});

test('M9 logistics analytics use expected-month counts on-time vendor percentages and inclusive equipment cost', () => {
    const deliveries = [{ vendor: 'v1', status: 'delivered', expected: '2026-03-10', actual: '2026-03-10' }, { vendor: 'v1', status: 'delivered', expected: '2026-03-12', actual: '2026-03-13' }, { vendor: 'v2', status: 'pending', expected: '2026-03-15' }];
    assert.equal(deliveryHeatmap(deliveries, ['Jan', 'Feb', 'Mar'])[2].count, 3);
    assert.deepEqual(vendorPerformance(deliveries, [{ id: 'v1', name: 'One' }])[0].percentage, 50);
    assert.deepEqual(equipmentCost({ assignedFrom: '2026-01-01', assignedTo: '2026-01-03', rate: 100 }), { duration: 3, total: 300 });
});

test('M9 budget chart data follows immediate local basic consumed edits', () => {
    const data = budgetChartData([{ id: 'a', name: 'A', basic: 100, consumed: 20, remaining: 80 }, { id: 'b', name: 'B', basic: 300, consumed: 0, remaining: 300 }]);
    assert.deepEqual(data.map((row) => [row.id, row.share, row.consumed]), [['a', 25, 20], ['b', 75, 0]]);
});
