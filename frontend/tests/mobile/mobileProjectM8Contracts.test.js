import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTransactionPayload, createPartyRequestGuard, createRegisterRow, createTransactionRequestGuard, partyPositionParams, partyStatementParams, reducedStatementDetail, registerRowToPayload, resolveTransactionView, saveRegisterSequential, saveRegisterSequentialGuarded, signedQuantity, transactionRemarkPoints, updateTransactionViewSearch, validateRegisterRow, validateLedgerLines } from '../../src/mobile/pages/ProjectDetails/Transactions/mobileTransactionModel.js';

test('M8 transaction view preserves unrelated query keys and defaults invalid views to history', () => {
    assert.equal(resolveTransactionView('party-stock'), 'party-stock'); assert.equal(resolveTransactionView('nope'), 'history');
    const next = updateTransactionViewSearch('?tab=Transactions&foo=keep', 'register'); assert.equal(next.get('tab'), 'Transactions'); assert.equal(next.get('foo'), 'keep'); assert.equal(next.get('txnView'), 'register');
});

test('M8 transaction payload preserves confirmed ledger contract and signed quantities', () => {
    const payload = buildTransactionPayload({ projectId: 42, orgId: 7, txnType: 'TRANSFER_PARTY', remarks: '', lines: [{ partyId: '2', projectResourceId: '9', direction: 'OUT', qty: '5', uomId: '3', role: 'SENDER' }, { partyId: '3', projectResourceId: '9', direction: 'IN', qty: '5', uomId: '3', role: 'RECEIVER' }] });
    assert.equal(payload.project_id, 42); assert.equal(payload.org_id, 7); assert.equal(payload.status, 'CONFIRMED'); assert.equal(payload.lines[0].signed_qty, -5); assert.equal(payload.lines[1].signed_qty, 5); assert.equal(signedQuantity('OUT', 2), -2);
});

test('M8 validation blocks imbalance and non-supplier stock deficits but allows supplier outflow', () => {
    const parties = [{ pv_id: 1, category: 'Client' }, { pv_id: 2, category: 'Supplier' }]; const balanced = [{ partyId: 1, projectResourceId: 8, direction: 'OUT', qty: 5 }, { partyId: 2, projectResourceId: 8, direction: 'IN', qty: 5 }];
    assert.match(validateLedgerLines(balanced, parties, { '1_8': 3 }), /sufficient stock/); assert.equal(validateLedgerLines([{ ...balanced[0], partyId: 2 }, balanced[1]], parties, {}), null); assert.match(validateLedgerLines([{ ...balanced[0], qty: 4 }, balanced[1]], parties, { '1_8': 8 }), /imbalance/);
});

test('M8 request guard rejects stale project completion', () => {
    const guard = createTransactionRequestGuard(); const a = guard.begin(42); const b = guard.begin(77); assert.equal(guard.isCurrent(a), false); assert.equal(guard.isCurrent(b), true);
});

test('M8 register validation preserves source contracts and supplier stock semantics', () => {
    const parties = [{ pv_id: 1, name: 'Client', category: 'Client' }, { pv_id: 2, name: 'Supplier', category: 'Supplier' }]; const resources = [{ project_resource_id: 8, name: 'Cement', base_unit_code: 'kg' }];
    const base = { ...createRegisterRow(), from_party_id: '1', to_party_id: '2', project_resource_id: '8', qty: '5' };
    assert.equal(validateRegisterRow(base, parties, resources, { '1_8': 10 }), null); assert.match(validateRegisterRow({ ...base, to_party_id: '1' }, parties, resources, {}), /same party/); assert.match(validateRegisterRow({ ...base, from_party_id: '99' }, parties, resources, {}), /resolve/); assert.match(validateRegisterRow({ ...base, project_resource_id: '99' }, parties, resources, {}), /resource/); assert.match(validateRegisterRow({ ...base, qty: '0' }, parties, resources, {}), /greater than 0/); assert.match(validateRegisterRow(base, parties, resources, { '1_8': 2 }), /Insufficient/); assert.equal(validateRegisterRow({ ...base, from_party_id: '2', to_party_id: '1' }, parties, resources, {}), null);
    const payload = registerRowToPayload({ row: { ...base, remarks: 'Move', status: 'DRAFT' }, projectId: 42, orgId: 7, parties, resources, units: [{ id: 3, code: 'kg' }] }); assert.equal(payload.project_id, 42); assert.equal(payload.status, 'DRAFT'); assert.equal(payload.remarks, '[Entry Register] Move'); assert.deepEqual(payload.lines.map((line) => line.signed_qty), [-5, 5]);
});

test('M8 register sequential save reports all-success, first failure, and partial success truthfully', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]; const calls = []; const all = await saveRegisterSequential(rows, async (row) => calls.push(row.id)); assert.deepEqual(all.saved, [0, 1, 2, 3]);
    const partial = await saveRegisterSequential(rows, async (row) => { calls.push(row.id); if (row.id === 'c') throw new Error('failed'); }); assert.deepEqual(partial.saved, [0, 1]); assert.equal(partial.failed, 2); assert.deepEqual(partial.unattempted, [3]);
    const first = await saveRegisterSequential(rows, async () => { throw new Error('first'); }); assert.deepEqual(first.saved, []); assert.equal(first.failed, 0); assert.deepEqual(first.unattempted, [1, 2, 3]);
});

test('M8 guarded register sequence stops before the next row after project switch', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }]; let current = true; const calls = []; const result = await saveRegisterSequentialGuarded(rows, async (row) => { calls.push(row.id); current = false; }, () => current); assert.deepEqual(calls, ['a']); assert.equal(result.stale, true); assert.deepEqual(result.unattempted, [1]);
});

test('M8 party stock contracts preserve API params and reduced detail fallback', () => {
    assert.deepEqual(partyPositionParams(42, 7, 3), { party_id: 7, project_id: 42, org_id: 3 }); assert.deepEqual(partyStatementParams(42, 3), { project_id: 42, org_id: 3 }); const detail = reducedStatementDetail({ transaction_id: 9, txn_date: '2026-01-01', project_resource_id: 8, signed_qty: -4 }, 7); assert.equal(detail.id, 9); assert.equal(detail.lines[0].party_id, 7); assert.equal(detail.lines[0].signed_qty, -4); assert.deepEqual(createPartyRequestGuard().begin(42, 7), { generation: 1, projectId: '42', partyId: '7' });
});

test('M8 transaction remarks present serialized data as readable points', () => {
    const points = transactionRemarkPoints(JSON.stringify({ weather: 'sunny', siteCondition: 'dry', timeSlots: [{ from: '08:00', to: '17:30' }], remarksList: ['Keep access clear'] }));
    assert.deepEqual(points, ['Weather: sunny', 'Site Condition: dry', 'Time Slots 1: From: 08:00 · To: 17:30', 'Remarks List 1: Keep access clear']);
    assert.deepEqual(transactionRemarkPoints('Gate cleared; Materials received'), ['Gate cleared', 'Materials received']);
    assert.deepEqual(transactionRemarkPoints(''), []);
});
