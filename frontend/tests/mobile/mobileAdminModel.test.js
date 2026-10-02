import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SYSTEM_PERMISSION_KEYS, SYSTEM_PERMISSION_TREE, classifyReconciledCreate, createEmployeePayload,
    createOwnershipSlots, defaultSystemPermissions, isBackendAdmin, normalizeAdminUser,
    normalizeImportResult, permissionStats, serializeSystemPermissions, templatePayload,
    updateEmployeePayload, validateAdminImportFile,
} from '../../src/mobile/pages/Admin/mobileAdminModel.js';

test('Admin mutation gate accepts only the actual backend admin role', () => {
    assert.equal(isBackendAdmin({ user_type: 'admin' }), true);
    assert.equal(isBackendAdmin({ user_type: 'superadmin' }), false);
    assert.equal(isBackendAdmin({ user_type: 'employee', system_permissions: { admin: 'edit' } }), false);
});

test('system permission tree and serialization use only exact source keys and values', () => {
    assert.deepEqual(SYSTEM_PERMISSION_KEYS, ['projects', 'vendors', 'clients', 'resources', 'spreadsheets', 'units', 'collaboration', 'collaboration.chat', 'collaboration.calendar', 'admin']);
    assert.equal(SYSTEM_PERMISSION_TREE.some((row) => row.id === 'Drawings'), false);
    const serialized = serializeSystemPermissions({ projects: 2, collaboration: 'read', admin: 'none', fake_key: 2 });
    assert.equal(serialized.projects, 'edit');
    assert.equal(serialized.collaboration, 'view');
    assert.equal(serialized.admin, 'none');
    assert.equal('fake_key' in serialized, false);
});

test('employee normalization uses production identifiers and source-backed fields', () => {
    const user = normalizeAdminUser({ user_id: 7, user_name: 'Ada', email: 'ada@example.test', user_type: 'employee', phone_no: '99', department_name: 'Site', system_permissions: '{"projects":"view"}', project_ids: [4] });
    assert.equal(user.id, 7); assert.equal(user.name, 'Ada'); assert.equal(user.phone, '99'); assert.equal(user.systemPermissions.projects, 1); assert.deepEqual(user.projectIds, ['4']);
});

test('create and update payloads preserve membership contract and omit ignored metadata', () => {
    const create = createEmployeePayload({ name: 'Ada', email: 'ada@example.test', password: 'secret', user_type: 'admin', project_ids: ['4'], system_permissions: { projects: 2 }, status: 'Active', template_id: 9 });
    assert.deepEqual(create.project_ids, [4]); assert.deepEqual(create.project_permissions, {}); assert.equal(create.password, 'secret'); assert.equal(create.status, undefined); assert.equal(create.template_id, undefined);
    const update = updateEmployeePayload({ ...create, id: 7, password: 'new-secret' });
    assert.equal(update.user_password, 'new-secret'); assert.equal(update.password, undefined);
});

test('template payload and statistics count each explicit stored entry once', () => {
    const stats = permissionStats({ permissions: { collaboration: 'view', 'collaboration.chat': 'edit', projects: 'none' } });
    assert.deepEqual(stats, { write: 1, read: 1, none: 1, total: 3 });
    const payload = templatePayload({ name: ' Site ', permissions: defaultSystemPermissions({ admin: 2 }) });
    assert.equal(payload.name, 'Site'); assert.equal(payload.type, 'system'); assert.equal(payload.permissions.admin, 'edit');
});

test('Admin import accepts CSV/XLSX only and normalizes partial results', () => {
    assert.equal(validateAdminImportFile({ name: 'users.csv' }), '');
    assert.equal(validateAdminImportFile({ name: 'users.XLSX' }), '');
    assert.match(validateAdminImportFile({ name: 'users.xls' }), /Only CSV and XLSX/);
    assert.deepEqual(normalizeImportResult({ total_processed: 3, success_count: 2, failure_count: 1, errors: ['row 3'] }), { total: 3, succeeded: 2, failed: 1, errors: ['row 3'] });
});

test('partial create wording requires reconciled server truth', () => {
    assert.equal(classifyReconciledCreate({ form: { email: 'a@b.c' }, users: [] }).partial, false);
    assert.match(classifyReconciledCreate({ form: { email: 'a@b.c', project_ids: [4] }, users: [normalizeAdminUser({ user_id: 1, email: 'a@b.c', project_ids: [] })] }).message, /project access is incomplete/);
});

test('independent ownership slots suppress stale operations without invalidating siblings', () => {
    const slots = createOwnershipSlots(['users', 'templates']); const first = slots.begin('users'); const templates = slots.begin('templates'); const second = slots.begin('users');
    assert.equal(slots.isCurrent(first), false); assert.equal(slots.isCurrent(second), true); assert.equal(slots.isCurrent(templates), true);
});
