import test from 'node:test';
import assert from 'node:assert/strict';
import {
    filterMobileNavigation,
    MOBILE_NAV_ITEMS,
    normalizeRecentProjects,
} from '../../src/mobile/layout/mobileNavigation.js';

test('dashboard is universal and other navigation follows read permission', () => {
    const seen = [];
    const filtered = filterMobileNavigation(MOBILE_NAV_ITEMS, (pageId, level) => {
        seen.push([pageId, level]);
        return ['projects', 'resources'].includes(pageId);
    });

    assert.deepEqual(filtered.map((item) => item.id), ['dashboard', 'projects', 'resources']);
    assert.equal(seen.some(([pageId]) => pageId === 'dashboard'), false);
    assert.ok(seen.every(([, level]) => level === 1));
});

test('no permissions exposes only the authenticated dashboard destination', () => {
    assert.deepEqual(filterMobileNavigation(MOBILE_NAV_ITEMS, () => false).map((item) => item.path), ['/']);
});

test('recent projects use valid assigned-project records and stop at five', () => {
    const projects = Array.from({ length: 7 }, (_, index) => ({
        id: index + 1,
        name: index === 0 ? '  Alpha  ' : `Project ${index + 1}`,
        project_code: `P-${index + 1}`,
    }));
    projects.splice(2, 0, { id: null, name: 'Invalid' }, { id: 99, name: 42 });

    const normalized = normalizeRecentProjects({ success: true, projects });
    assert.equal(normalized.length, 5);
    assert.deepEqual(normalized[0], { id: 1, name: 'Alpha', code: 'P-1' });
    assert.equal(normalized.at(-1).id, 5);
    assert.deepEqual(normalizeRecentProjects({ success: false, projects }), []);
});
