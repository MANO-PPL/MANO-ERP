import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAgentContext, projectDisplay, starterPrompts } from '../../src/components/Agent/agentContext.js';

test('current route is included, unknown identity fields are omitted', () => {
    assert.deepEqual(extractAgentContext({ pathname: '/vendors' }), { route: '/vendors', module: 'Vendors' });
    assert.deepEqual(extractAgentContext({ pathname: '/constructor', search: '?organizationId=invented' }), { route: '/constructor', module: 'ERP' });
});
test('project ID is read only from a matching project route', () => {
    assert.deepEqual(extractAgentContext({ pathname: '/projects/42', search: '?tab=Reports' }), { route: '/projects/42', module: 'Reports', projectId: '42' });
    for (const pathname of ['/projects', '/projects/create', '/projects/new', '/projects/42/unknown']) {
        assert.equal(extractAgentContext({ pathname }).projectId, undefined);
    }
});
test('recognized resource tabs and project material tabs supply module context', () => {
    assert.equal(extractAgentContext({ pathname: '/resources', search: '?tab=rates' }).module, 'Resources / Rates');
    assert.equal(extractAgentContext({ pathname: '/projects/42', search: '?tab=Material+Management&matTab=recipes' }).module, 'Material Management / Recipes');
    assert.equal(extractAgentContext({ pathname: '/resources', search: '?tab=constructor' }).module, 'Resources');
    assert.equal(extractAgentContext({ pathname: '/projects/42', search: '?tab=Unknown' }).module, 'Projects');
});
test('query entity IDs and arbitrary parameters never imply selected entity or authorization', () => {
    const context = extractAgentContext({ pathname: '/projects/42', search: '?tab=Material+Management&resourceId=99&role=admin&token=secret' });
    assert.equal(context.selectedEntityId, undefined);
    assert.equal(context.organizationId, undefined);
    assert.equal(context.route, '/projects/42');
    assert.ok(!JSON.stringify(context).includes('secret'));
});
test('already available name is display-only and matching events update it', () => {
    const context = extractAgentContext({ pathname: '/projects/42' });
    const storage = { getItem(key) { assert.equal(key, 'active_project_info_42'); return '{"name":" Fixture Project "}'; } };
    assert.equal(projectDisplay(context, storage), 'Fixture Project');
    assert.equal(projectDisplay(context, storage, { id: '42', name: 'Updated fixture' }), 'Updated fixture');
    assert.equal(projectDisplay(context, storage, { id: '99', name: 'Wrong project' }), null);
    assert.equal(projectDisplay(extractAgentContext({ pathname: '/clients' }), storage), null);
});
test('missing, corrupt or blocked caches do not fail context extraction', () => {
    const context = extractAgentContext({ pathname: '/projects/42' });
    for (const storage of [undefined, { getItem: () => 'invalid' }, { getItem: () => '{"name":42}' }, { getItem() { throw Error('blocked'); } }]) {
        assert.equal(projectDisplay(context, storage), null);
    }
});
test('starter prompts adapt without making write shortcuts', () => {
    assert.ok(starterPrompts(extractAgentContext({ pathname: '/projects/42' })).includes('Show the vendors for this project'));
    assert.ok(starterPrompts(extractAgentContext({ pathname: '/resources' })).includes('Check a resource rate'));
    assert.ok(starterPrompts(extractAgentContext({ pathname: '/clients' })).includes('Summarize recent client interactions'));
});
