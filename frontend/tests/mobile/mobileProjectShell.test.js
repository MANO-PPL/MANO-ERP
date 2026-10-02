import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MOBILE_PROJECT_MODULES,
    createProjectRequestGuard,
    getProjectPermissionLevel,
    getVisibleProjectModules,
    normalizeProjectPermissions,
    resolveProjectModule,
    updateProjectModuleSearch,
} from '../../src/mobile/pages/ProjectDetails/mobileProjectModules.js';

test('project mobile registry preserves the exact runtime order and labels', () => {
    assert.deepEqual(MOBILE_PROJECT_MODULES.map((module) => module.key), [
        'Dashboard', 'Tasks', 'WIP', 'Reports', 'General Documents', 'Spreadsheets', 'Drawings',
        'Planning', 'Phases', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management',
        'Transactions', 'Approvals', 'Settings',
    ]);
    assert.deepEqual(MOBILE_PROJECT_MODULES.map((module) => module.label), MOBILE_PROJECT_MODULES.map((module) => module.key));
});

test('project module visibility preserves runtime permission lookup semantics', () => {
    const permissions = normalizeProjectPermissions({ tasks: 'read', wip: 'write', general_documents: 1, Settings: 0 });
    assert.equal(getProjectPermissionLevel(permissions, 'Tasks'), 1);
    assert.equal(getProjectPermissionLevel(permissions, 'WIP'), 2);
    assert.equal(getProjectPermissionLevel(permissions, 'General Documents'), 1);
    assert.deepEqual(getVisibleProjectModules({ permissions }).map((module) => module.key), ['Dashboard', 'Tasks', 'WIP', 'General Documents']);
    assert.equal(getVisibleProjectModules({ permissions, isAdmin: true }).length, 17);
});

test('project module selection falls back safely and preserves unrelated query state', () => {
    const visible = getVisibleProjectModules({ permissions: { tasks: 1 } });
    assert.equal(resolveProjectModule('Missing', visible), 'Dashboard');
    assert.equal(updateProjectModuleSearch('?project_id=77&foo=bar', 'Tasks'), '?project_id=77&foo=bar&tab=Tasks');
});

test('stale project responses cannot overwrite the latest project context', async () => {
    const guard = createProjectRequestGuard();
    const state = { project: null, activeProjectEvents: [] };
    const resolveProject = async (projectId, delay) => {
        const token = guard.begin(projectId);
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (!guard.isCurrent(token)) return;
        state.project = projectId;
        state.activeProjectEvents.push(projectId);
    };

    const projectA = resolveProject('A', 40);
    await new Promise((resolve) => setTimeout(resolve, 1));
    const projectB = resolveProject('B', 5);
    await Promise.all([projectA, projectB]);

    assert.equal(state.project, 'B');
    assert.deepEqual(state.activeProjectEvents, ['B']);
});