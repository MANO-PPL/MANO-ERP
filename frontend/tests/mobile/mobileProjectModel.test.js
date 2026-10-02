import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCreateProjectPayload,
    buildProjectMetadataPatch,
    buildUpdateProjectPayload,
    filterProjects,
    getCreatedProjectId,
    isArchivedProject,
    normalizeProject,
    parseProjectMetadata,
} from '../../src/mobile/pages/Projects/projectModel.js';

const rawActive = {
    id: 7,
    name: 'Alpha Site',
    project_code: 'ALP-7',
    status: 'active',
    location: 'Chennai',
    start_date: '2026-01-02T00:00:00.000Z',
    end_date: '2026-12-10',
    member_count: 3,
    metadata: JSON.stringify({ description: 'Build', employer: 'MANO', completion: 25, issues: 'Risk', tags: ['pilot'], phases: [{ progress: 100 }, { progress: 20 }] }),
};

test('project normalization preserves status, metadata, dates, and archive semantics', () => {
    const project = normalizeProject(rawActive);
    assert.equal(project.code, 'ALP-7');
    assert.equal(project.owner, 'MANO');
    assert.equal(project.startDate, '2026-01-02');
    assert.equal(project.completion, 25);
    assert.equal(project.completedPhases, 1);
    assert.equal(project.archived, false);
    assert.equal(isArchivedProject({ status: 'completed' }), true);
    assert.equal(isArchivedProject({ status: 'archived' }), true);
    assert.equal(isArchivedProject({ status: 'active', is_archived: true }), true);
    assert.equal(isArchivedProject({ status: 'planning' }), false);
});

test('Active and Archived collections use the existing status/archive fields', () => {
    const projects = [
        normalizeProject(rawActive),
        normalizeProject({ ...rawActive, id: 8, name: 'Old Site', status: 'completed' }),
        normalizeProject({ ...rawActive, id: 9, name: 'Stored Archive', status: 'active', archived: true }),
    ];
    assert.deepEqual(filterProjects(projects, { collection: 'active' }).map((item) => item.id), [7]);
    assert.deepEqual(filterProjects(projects, { collection: 'archived' }).map((item) => item.id), [8, 9]);
    assert.deepEqual(filterProjects(projects, { collection: 'active', query: 'mano', issues: ['Risk'] }).map((item) => item.id), [7]);
});

test('create payload matches the existing project contract', () => {
    assert.deepEqual(buildCreateProjectPayload({
        name: '  New Site ', projectCode: ' N-1 ', description: ' Pilot ', location: ' Pune ', status: 'planning', startDate: '2026-09-10', endDate: '',
    }, { organization_name: 'MANO' }, [7, '9', 7, 'bad']), {
        name: 'New Site',
        project_code: 'N-1',
        location: 'Pune',
        status: 'planning',
        start_date: '2026-09-10',
        member_ids: [7, 9],
        metadata: { description: 'Pilot', employer: 'MANO' },
    });
});

test('edit and metadata patches preserve unrelated metadata', () => {
    const existing = { tags: ['a'], issues: 'Blocked', phases: [{ progress: 20 }], employer: 'MANO' };
    assert.deepEqual(buildUpdateProjectPayload({
        name: ' Alpha ', projectCode: '', description: ' Revised ', location: '', startDate: '', endDate: '2026-12-01',
    }, existing), {
        name: 'Alpha', project_code: null, location: null, start_date: null, end_date: '2026-12-01',
        metadata: { ...existing, description: 'Revised' },
    });
    assert.deepEqual(buildProjectMetadataPatch({ metadata: existing }, { issues: 'Resolved' }), {
        metadata: { ...existing, issues: 'Resolved' },
    });
    assert.deepEqual(parseProjectMetadata('{bad'), {});
});

test('create response IDs support the current backend and desktop-tolerated shapes', () => {
    assert.equal(getCreatedProjectId({ project_id: 12 }), 12);
    assert.equal(getCreatedProjectId({ project: { id: 13 } }), 13);
    assert.equal(getCreatedProjectId({ project: { project_id: 14 } }), 14);
    assert.equal(getCreatedProjectId({ success: true }), null);
});
