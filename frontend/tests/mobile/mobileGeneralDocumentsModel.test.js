import test from 'node:test';
import assert from 'node:assert/strict';
import { areAllForbidden, createGeneralDocumentsRequestGuard, directoryPayload, meetingPayload, normalizeAvailableParties, normalizeDirectory, resolveGeneralDocumentsView, summaryPayload } from '../../src/mobile/pages/ProjectDetails/GeneralDocuments/mobileGeneralDocumentsModel.js';

test('general documents view only accepts supported subviews', () => {
    assert.equal(resolveGeneralDocumentsView('meetings'), 'meetings');
    assert.equal(resolveGeneralDocumentsView('mom-list'), 'hub');
});
test('directory normalisation and payload preserve actual service keys', () => {
    assert.deepEqual(normalizeDirectory({ directory: [{ pd_id: 4, party_id: 2, company_name: 'Acme', contact_person: 'Ana' }] })[0], { id: 4, partyId: 2, companyName: 'Acme', category: '', jobNature: '', contactPerson: 'Ana', designation: '', responsibilities: '', mobileNo: '', email: '', addressLine: '', raw: { pd_id: 4, party_id: 2, company_name: 'Acme', contact_person: 'Ana' } });
    assert.deepEqual(directoryPayload({ partyId: '2', pvId: '3', contactPerson: 'Ana', designation: 'Lead', responsibilities: 'Review', mobileNo: '9', email: 'a@x.test', addressLine: 'Road' }), { party_id: '2', pv_id: '2', contact_person: 'Ana', designation: 'Lead', responsibilities: 'Review', mobile_no: '9', email: 'a@x.test', address_line: 'Road' });
});
test('summary and meeting payloads use the real array and point contracts', () => {
    assert.deepEqual(summaryPayload({ title: 'Kickoff', date: '2026-01-01', status: 'open', details: 'Ready' }, 9), { id: 9, title: 'Kickoff', date: '2026-01-01', status: 'open', details: 'Ready' });
    assert.deepEqual(meetingPayload({ subject: 'Kickoff', meeting_no: '1', participants: [{ pd_id: 7, attended: false }], agenda_points: [{ sl_no: '', point: 'Review' }], mom_points: [{ sl_no: 2, point: 'Approved' }] }), { subject: 'Kickoff', meeting_no: 1, venue: '', date: '', time: '', participants: [{ pd_id: 7, attended: false }], agenda_points: [{ sl_no: 1, point: 'Review' }], mom_points: [{ sl_no: 1, point: 'Approved' }], content: { time: '', attendance: { 7: 'absent' }, agenda_points: [{ sl_no: 1, point: 'Review' }], mom_points: [{ sl_no: 1, point: 'Approved' }] } });
});
test('meeting attendance remains distinct from participant membership', () => {
    const payload = meetingPayload({ subject: 'Attendance', participants: [{ pd_id: 7, attended: false }, { pd_id: 8, attended: true }] });
    assert.deepEqual(payload.participants, [{ pd_id: 7, attended: false }, { pd_id: 8, attended: true }]);
    assert.deepEqual(payload.content.attendance, { 7: 'absent', 8: 'present' });
});
test('available party normalisation and request guards prevent stale project writes', () => {
    assert.deepEqual(normalizeAvailableParties({ available_parties: [{ id: 1 }] }), [{ id: 1 }]);
    const guard = createGeneralDocumentsRequestGuard(); const first = guard.begin(1, 'meetings'); const second = guard.begin(2, 'meetings');
    assert.equal(guard.isCurrent(first), false); assert.equal(guard.isCurrent(second), true);
});
test('hub classification identifies only all-403 failures as access denied', () => {
    const forbidden = Array.from({ length: 5 }, () => ({ status: 'rejected', reason: { response: { status: 403 } } }));
    assert.equal(areAllForbidden(forbidden), true);
    assert.equal(areAllForbidden([...forbidden.slice(0, 4), { status: 'rejected', reason: new Error('offline') }]), false);
    assert.equal(areAllForbidden([{ status: 'fulfilled', value: {} }, ...forbidden.slice(1)]), false);
});
