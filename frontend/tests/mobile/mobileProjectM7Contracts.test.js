import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualityRequestGuard, documentPreviewUrl, observationFormData, observationPhotoState, QUALITY_STATUSES, resolveQualityView, shouldClearObservationPhotos } from '../../src/mobile/pages/ProjectDetails/Quality/mobileQualityModel.js';
import { cloneQualityMatrix, QUALITY_MATRIX_INITIAL_DATA } from '../../src/mobile/pages/ProjectDetails/Quality/mobileQualityMatrixData.js';
import { buildProjectRatePayload, buildProjectRecipePayload, importProjectResources, materialLoadResult, resolveMaterialResourceId, resolveMaterialTab } from '../../src/mobile/pages/ProjectDetails/MaterialManagement/mobileMaterialModel.js';

test('Quality only accepts existing ERP child views and statuses', () => {
    assert.equal(resolveQualityView('control'), 'control');
    assert.equal(resolveQualityView('not-a-real-view'), 'hub');
    assert.deepEqual(QUALITY_STATUSES, ['ALL', 'PENDING', 'FIXED', 'APPROVED']);
});

test('quality observation multipart payload preserves existing field names', () => {
    const create = observationFormData({ location: 'Level 2', note: 'Crack', photos: [] });
    assert.equal(create.get('location'), 'Level 2'); assert.equal(create.get('note'), 'Crack'); assert.equal(create.get('clearPhotos'), null);
    const edit = observationFormData({ location: 'Level 2', note: 'Updated', clearPhotos: true });
    assert.equal(edit.get('clearPhotos'), 'true');
    const fix = observationFormData({ note: 'Patched', mode: 'fix' });
    assert.equal(fix.get('location'), null); assert.equal(fix.get('note'), 'Patched');
});

test('quality request guard rejects stale project responses', () => {
    const guard = createQualityRequestGuard(); const projectA = guard.begin(42, 'control'); const projectB = guard.begin(77, 'control');
    assert.equal(guard.isCurrent(projectA, 42, 'control'), false);
    assert.equal(guard.isCurrent(projectB, 77, 'control'), true);
    assert.equal(guard.isCurrent(projectB, 42, 'control'), false);
});

test('quality edit preserves existing photos unless explicitly cleared', () => {
    const existing = observationPhotoState({ before_photos: ['https://files/one.jpg'], before_photo_url: 'https://files/two.jpg' });
    assert.deepEqual(existing, ['https://files/one.jpg', 'https://files/two.jpg']);
    assert.equal(shouldClearObservationPhotos({ mode: 'edit', existingPhotos: existing, keepExisting: true }), false);
    assert.equal(shouldClearObservationPhotos({ mode: 'edit', existingPhotos: existing, keepExisting: false }), true);
    assert.equal(shouldClearObservationPhotos({ mode: 'fix', existingPhotos: existing, keepExisting: false }), false);
    assert.equal(observationFormData({ location: 'L2', note: 'Text only', clearPhotos: false }).get('clearPhotos'), null);
    assert.equal(observationFormData({ location: 'L2', note: 'Clear', clearPhotos: true }).get('clearPhotos'), 'true');
});

test('quality edit adds new photos without clearing retained evidence and fix keeps its existing payload shape', () => {
    const original = ['https://files/one.jpg'];
    const photo = new Blob(['photo'], { type: 'image/jpeg' });
    const edit = observationFormData({ location: 'L2', note: 'Add evidence', photos: [{ file: photo, label: 'Front View' }], clearPhotos: shouldClearObservationPhotos({ mode: 'edit', existingPhotos: original, retainedExistingPhotos: original }) });
    assert.equal(edit.get('clearPhotos'), null);
    assert.equal(edit.get('photos').name, 'blob');
    assert.equal(edit.get('labels'), 'Front View');
    assert.equal(shouldClearObservationPhotos({ mode: 'edit', existingPhotos: original, retainedExistingPhotos: [] }), true);
    const fix = observationFormData({ note: 'Resolved', photos: [{ file: photo, label: 'After view' }], mode: 'fix' });
    assert.equal(fix.get('location'), null);
    assert.equal(fix.get('note'), 'Resolved');
    assert.equal(fix.get('photos').name, 'blob');
    assert.equal(fix.get('labels'), 'After view');
});

test('quality document previews follow existing file URL and type behaviour', () => {
    assert.equal(documentPreviewUrl({ file_url: 'https://files/a.pdf', file_type: 'PDF' }, 'methodology'), 'https://files/a.pdf');
    assert.match(documentPreviewUrl({ file_url: 'https://files/a.docx', file_type: 'DOCX' }, 'methodology'), /officeapps/);
    assert.match(documentPreviewUrl({ file_url: 'https://files/a.pptx', file_type: 'PPTX' }, 'checklist'), /docs\.google\.com/);
    assert.equal(documentPreviewUrl({ file_url: 'https://files/a.heic', file_type: 'HEIC' }, 'checklist'), 'https://files/a.heic');
});

test('quality matrix retains the complete current local sample dataset', () => {
    assert.equal(QUALITY_MATRIX_INITIAL_DATA.filter((row) => row.type === 'material').length, 4);
    assert.equal(QUALITY_MATRIX_INITIAL_DATA.find((row) => row.id === 'mat_15').subdivisions.length, 2);
    assert.equal(QUALITY_MATRIX_INITIAL_DATA.find((row) => row.id === 'mat_1').tests.length, 5);
});

test('quality matrix clones reset local edits for a replacement project', () => {
    const projectA = cloneQualityMatrix(); const projectB = cloneQualityMatrix();
    projectA.find((row) => row.id === 'mat_1').title = 'A-only local edit';
    assert.equal(projectB.find((row) => row.id === 'mat_1').title, 'Ordinary Portland Cement');
    assert.notEqual(projectA, projectB);
});

test('material query, recipe and rate contracts preserve real project shapes', () => {
    const rows = [{ resource_id: 7 }, { resource_id: 8 }];
    assert.equal(resolveMaterialTab('rates'), 'rates'); assert.equal(resolveMaterialTab('nope'), 'grid');
    assert.equal(resolveMaterialResourceId(rows, '8'), '8'); assert.equal(resolveMaterialResourceId(rows, '99'), '7');
    assert.deepEqual(buildProjectRecipePayload([{ component_resource_id: '9', quantity: '2.5', unit_code: 'kg' }, { component_resource_id: '', quantity: 1, unit_code: 'kg' }]), [{ component_resource_id: 9, quantity: 2.5, unit_code: 'kg' }]);
    assert.deepEqual(buildProjectRatePayload({ mode: 'manual', rate: '42', unit_code: 'kg', effective_from: '2026-01-01', effective_to: '', remarks: '' }, 'Nos'), { mode: 'manual', rate: 42, unit_code: 'kg', effective_from: '2026-01-01', effective_to: null, remarks: 'Project override rate' });
    assert.equal(buildProjectRatePayload({ mode: 'computed', rate: '', effective_from: '2026-01-01', effective_to: '', remarks: '' }, 'Nos').rate, null);
});

test('material load retains project truth and batch fallback reports partial results', async () => {
    const loaded = materialLoadResult({ projectResult: { status: 'fulfilled', value: { resources: [{ id: 1, resource_id: 10, name: 'Project cement' }] } }, masterResult: { status: 'rejected', reason: new Error('catalog unavailable') }, rateResult: { rates: [{ resource_id: 10, rate: 100 }] } });
    assert.equal(loaded.rows.length, 1); assert.equal(loaded.rows[0].isImported, true); assert.equal(loaded.masterError.message, 'catalog unavailable');
    const calls = [];
    const result = await importProjectResources({ projectId: 42, resourceIds: [10, 11], effectiveFrom: '2026-01-01', service: { importResourcesBatch: async () => { throw new Error('batch unavailable'); }, importResource: async (_projectId, id) => { calls.push(id); if (id === 11) throw new Error('single failed'); } } });
    assert.deepEqual(calls, [10, 11]); assert.deepEqual(result.succeeded, [10]); assert.equal(result.failed.length, 1); assert.equal(result.mode, 'fallback');
});
