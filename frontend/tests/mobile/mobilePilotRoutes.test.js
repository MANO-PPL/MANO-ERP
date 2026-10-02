import test from 'node:test';
import assert from 'node:assert/strict';
import { isMobilePilotPath, normalizePilotPath } from '../../src/mobile/routing/mobilePilotRoutes.js';

test('approved M2-M4 pilot paths select mobile presentation', () => {
    for (const path of ['/', '/projects', '/projects/create', '/projects/new', '/vendors', '/vendors/bulk-upload', '/clients', '/clients/bulk-upload', '/resources', '/resources/bulk-upload', '/spreadsheets', '/collaboration', '/admin']) {
        assert.equal(isMobilePilotPath(path), true, path);
    }
    assert.equal(isMobilePilotPath('/projects/42'), true);
    for (const path of ['/login', '/project', '/projects/create/extra', '/vendors/42', '/units']) {
        assert.equal(isMobilePilotPath(path), false, path);
    }
});

test('pilot paths tolerate leading and trailing slash normalization only', () => {
    assert.equal(normalizePilotPath('projects/'), '/projects');
    assert.equal(isMobilePilotPath('/projects/'), true);
    assert.equal(isMobilePilotPath('/projects/42/'), true);
});
