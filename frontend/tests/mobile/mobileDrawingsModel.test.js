import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingsRequestGuard, drawingFileField, drawingOrderPayload, drawingUploadFormData, normalizeDrawingsSearch, reorderDrawingDraft, updateDrawingsSearch } from '../../src/mobile/pages/ProjectDetails/Drawings/mobileDrawingsModel.js';

test('M11 drawing query normalization preserves tab and unrelated params', () => {
    const categories = [{ id: 7, name: 'Civil' }];
    let result = normalizeDrawingsSearch('?tab=Drawings&view=bad&foo=keep', categories, true);
    assert.equal(result.view, 'grid'); assert.equal(result.params.get('tab'), 'Drawings'); assert.equal(result.params.get('foo'), 'keep'); assert.equal(result.params.has('cat'), false);
    result = normalizeDrawingsSearch('?tab=Drawings&view=detail&cat=999&foo=keep', categories, true);
    assert.equal(result.view, 'grid'); assert.equal(result.params.get('foo'), 'keep');
    const detail = normalizeDrawingsSearch('?tab=Drawings&view=detail&cat=7&foo=keep', categories, true);
    assert.equal(detail.category.id, 7);
    assert.equal(updateDrawingsSearch(detail.params, { view: 'grid', cat: null }).get('foo'), 'keep');
});

test('M11 drawing multipart mapping uses exact existing fields including DXF as dwgFile', () => {
    assert.equal(drawingFileField('plan.dwg'), 'dwgFile');
    assert.equal(drawingFileField('plan.dxf'), 'dwgFile');
    assert.equal(drawingFileField('plan.pdf'), 'pdfFile');
    assert.equal(drawingFileField('plan.png'), null);
    const entries = [];
    class FakeFormData { append(...args) { entries.push(args); } }
    const file = { name: 'plan.dxf' };
    drawingUploadFormData({ categoryId: 5, title: 'Plan', description: 'R1', drawingGroupId: 12, file }, FakeFormData);
    assert.deepEqual(entries, [['categoryId', 5], ['title', 'Plan'], ['description', 'R1'], ['drawingGroupId', 12], ['dwgFile', file]]);
});

test('M11 drawing ordering and lifecycle contracts are immutable and project scoped', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const moved = reorderDrawingDraft(rows, 0, 2);
    assert.deepEqual(moved.map((row) => row.id), [2, 3, 1]);
    assert.deepEqual(rows.map((row) => row.id), [1, 2, 3]);
    assert.deepEqual(drawingOrderPayload(moved), { order: [{ id: 2, sort_order: 1 }, { id: 3, sort_order: 2 }, { id: 1, sort_order: 3 }] });
    const guard = createDrawingsRequestGuard(); const a = guard.begin(42, 5); const b = guard.begin(43, 5);
    assert.equal(guard.isCurrent(a, 42, 5), false); assert.equal(guard.isCurrent(b, 43, 5), true);
});

test('M11 category delete contract requires separate consequence confirmation', async () => {
    const calls = [];
    const service = { deleteCategory: async (projectId, categoryId, confirm) => { calls.push({ projectId, categoryId, confirm }); return confirm ? { success: true } : { success: false, hasDrawings: true, count: 3, message: 'Contains 3 drawings' }; } };
    const first = await service.deleteCategory(42, 7, false);
    assert.equal(first.hasDrawings, true); assert.equal(first.count, 3); assert.deepEqual(calls, [{ projectId: 42, categoryId: 7, confirm: false }]);
    await service.deleteCategory(42, 7, true);
    assert.deepEqual(calls[1], { projectId: 42, categoryId: 7, confirm: true });
});
