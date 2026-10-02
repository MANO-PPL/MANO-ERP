import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientPayload, buildInteractionPayload, clientFormValues, filterClients, normalizeClient, normalizeClientImportRows } from '../../src/mobile/pages/Clients/clientModel.js';

test('client model preserves sector, job, contact, and interaction contracts', () => {
    assert.equal(clientFormValues(null).name, '');
    const client = normalizeClient({ id: 4, name: 'Client', sector_name: 'Construction', job_name: 'PMC', telephone_no: '555', interactions: [{ id: 1 }] });
    assert.equal(client.sector, 'Construction'); assert.equal(client.jobNature, 'PMC'); assert.equal(client.contactNumber, '555');
    assert.equal(filterClients([client], { query: 'construct', sectors: ['Construction'], jobs: ['PMC'] }).length, 1);
    assert.deepEqual(buildClientPayload({ name: ' Client ', sector: ' Construction ' }), { name: 'Client', sector: 'Construction' });
    assert.deepEqual(buildInteractionPayload({ type: 'Call', interaction_date: '2026-09-10', follow_up_date: '', remarks: ' Follow up ' }), { type: 'Call', interaction_date: '2026-09-10', follow_up_date: '', remarks: 'Follow up' });
});

test('client import preserves partial-result row eligibility', () => {
    const rows = normalizeClientImportRows([{ Name: 'Valid Client', Sector: 'Build' }, { Name: 'Duplicate' }], { duplicates: [{ row: 2, reason: 'Email already exists' }] });
    assert.equal(rows[0].status, 'Valid'); assert.equal(rows[1].status, 'Error'); assert.deepEqual(rows[1].issues, ['Email already exists']);
});
