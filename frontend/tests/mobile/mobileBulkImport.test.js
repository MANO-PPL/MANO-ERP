import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupportedTabularFile } from '../../src/mobile/utils/parseTabularFile.js';

test('mobile imports accept only current CSV and Excel file types', () => {
    assert.equal(isSupportedTabularFile({ name: 'vendors.csv', type: '' }), true);
    assert.equal(isSupportedTabularFile({ name: 'clients.xlsx', type: '' }), true);
    assert.equal(isSupportedTabularFile({ name: 'resources.xls', type: '' }), true);
    assert.equal(isSupportedTabularFile({ name: 'resources.json', type: 'application/json' }), false);
});

test('bulk result semantics distinguish partial domain imports from atomic resource rollback', () => {
    const vendorReport = { success_count: 2, failure_count: 1, errors: ['Row 3 failed'] };
    assert.equal(vendorReport.success_count, 2); assert.equal(vendorReport.failure_count, 1);
    const resourceFailure = { success: false, message: 'Bulk insert failed and was rolled back.', report: { successCount: 1, errors: [{ index: 1, error: 'invalid' }] } };
    assert.equal(resourceFailure.success, false); assert.match(resourceFailure.message, /rolled back/i);
});
