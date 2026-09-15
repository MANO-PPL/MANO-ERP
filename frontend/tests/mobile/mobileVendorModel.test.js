import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVendorPayload, filterVendors, normalizeVendor, normalizeVendorImportRows, vendorFormValues } from '../../src/mobile/pages/Vendors/vendorModel.js';

test('vendor model preserves production aliases and exact form keys', () => {
    assert.equal(vendorFormValues(null).name, '');
    const vendor = normalizeVendor({ id: 7, name: 'Acme', telephone_no: '123', job_name: 'Supply', category: 'Supplier' });
    assert.equal(vendor.contactNumber, '123'); assert.equal(vendor.jobNature, 'Supply');
    assert.deepEqual(buildVendorPayload({ name: ' Acme ', contact_no: ' 123 ', job_nature: ' Supply ' }), { name: 'Acme', contact_no: '123', job_nature: 'Supply' });
    assert.equal(filterVendors([vendor], { query: 'supp', categories: ['Supplier'], jobs: ['Supply'] }).length, 1);
});

test('vendor import keeps valid rows and reports duplicate or missing-name rows', () => {
    const rows = normalizeVendorImportRows([{ Name: 'A', Mobile: '1' }, { Email: 'x@example.test' }], { duplicates: [{ row: 1, reason: 'Mobile number already exists' }] });
    assert.equal(rows[0].status, 'Error'); assert.deepEqual(rows[0].issues, ['Mobile number already exists']);
    assert.equal(rows[1].status, 'Error'); assert.deepEqual(rows[1].issues, ['Missing Name']);
});
