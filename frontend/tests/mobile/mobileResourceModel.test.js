import test from 'node:test';
import assert from 'node:assert/strict';
import { areUnitsCompatible, buildResourceImportPayload, buildResourcePayload, filterResources, isAccessDenied, normalizeResource, normalizeResourceImportRows, normalizeResourceTab } from '../../src/mobile/pages/Resources/resourceModel.js';
import { resourceBulkUploadRequests, resourceRateServices } from '../../src/mobile/pages/Resources/resourceContracts.js';

test('resource mobile defaults use the normalized production service contracts', () => {
    const resourceService = { bulkValidate: () => { }, bulkJson: () => { }, getResolvedRate: () => { }, addRate: () => { }, updateRate: () => { }, getRateHistory: () => { }, clearManualRate: () => { } };
    const projectService = { getResolvedResourceRate: () => { }, addResourceRate: () => { }, updateResourceRate: () => { }, getResourceRateHistory: () => { }, clearResourceRate: () => { } };
    const bulkRequests = resourceBulkUploadRequests(resourceService);
    const rateServices = resourceRateServices(resourceService, projectService);
    assert.deepEqual(Object.keys(rateServices.master), ['resolved', 'add', 'update', 'history', 'clear']);
    assert.deepEqual(Object.keys(rateServices.project), ['resolved', 'add', 'update', 'history', 'clear']);
    assert.equal(rateServices.master.resolved, resourceService.getResolvedRate);
    assert.equal(rateServices.master.add, resourceService.addRate);
    assert.equal(rateServices.master.update, resourceService.updateRate);
    assert.equal(rateServices.master.history, resourceService.getRateHistory);
    assert.equal(rateServices.master.clear, resourceService.clearManualRate);
    assert.equal(rateServices.project.resolved, projectService.getResolvedResourceRate);
    assert.equal(rateServices.project.add, projectService.addResourceRate);
    assert.equal(rateServices.project.update, projectService.updateResourceRate);
    assert.equal(rateServices.project.history, projectService.getResourceRateHistory);
    assert.equal(rateServices.project.clear, projectService.clearResourceRate);
    for (const request of Object.values(bulkRequests)) assert.equal(typeof request, 'function');
    for (const scope of Object.values(rateServices)) for (const method of Object.values(scope)) assert.equal(typeof method, 'function');
});

test('resource tabs accept only the real four workspaces', () => {
    for (const tab of ['directory', 'recipes', 'rates', 'conversions']) assert.equal(normalizeResourceTab(tab), tab);
    assert.equal(normalizeResourceTab('history'), 'directory');
});

test('resource form payload preserves composition and conversion contracts', () => {
    const payload = buildResourcePayload({ name: ' Item ', code: ' I1 ', type: 'item', base_unit_code: 'kg', description: '', remarks: '' }, { conversions: [{ name: 'Bag', quantity: '50', unit_code: 'kg' }], compositions: [{ component_resource_id: '9', quantity: '2.5', unit_code: 'kg' }], includeComposition: true, effectiveFrom: '2026-09-11' });
    assert.deepEqual(payload.conversions, [{ name: 'Bag', quantity: 50, unit_code: 'kg' }]);
    assert.deepEqual(payload.compositions, [{ component_resource_id: 9, quantity: 2.5, unit_code: 'kg' }]);
    assert.equal(payload.effective_from, '2026-09-11'); assert.equal(areUnitsCompatible('kg', 'g'), true); assert.equal(areUnitsCompatible('kg', 'L'), false);
});

test('resource import maps validation and atomic payload fields', () => {
    const rows = normalizeResourceImportRows([{ Name: 'Cement', Type: 'material', 'Base Unit': 'kg', Rate: '8' }, { Name: 'Bad', Type: 'other', 'Base Unit': 'kg' }], { invalid_types: [{ row: 2, reason: 'Invalid type' }] });
    assert.equal(rows[0].status, 'Valid'); assert.equal(rows[1].status, 'Error');
    assert.deepEqual(buildResourceImportPayload([rows[0]]), [{ name: 'Cement', code: undefined, type: 'material', base_unit_code: 'kg', rate: 8, rate_unit_code: 'kg', description: undefined, remarks: undefined }]);
});

test('resource model classifies only proven 403 responses as access denied', () => {
    assert.equal(isAccessDenied({ response: { status: 403 } }), true); assert.equal(isAccessDenied({ response: { status: 401 } }), false); assert.equal(isAccessDenied(new Error('permission')), false);
    const resource = normalizeResource({ resource_id: 3, name: 'Labour', type: 'labour', base_unit_code: 'hr' });
    assert.equal(resource.id, 3); assert.equal(filterResources([resource], { query: 'hour' }).length, 0); assert.equal(filterResources([resource], { units: ['hr'] }).length, 1);
});
