import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GLOBAL_SPREADSHEET_DISCLOSURE,
    GLOBAL_WORKBOOK_BODY_PREFIX,
    GLOBAL_WORKBOOK_LIST_KEY,
    canWriteGlobalSpreadsheets,
    createGlobalWorkbook,
    createImportedGlobalWorkbook,
    duplicateGlobalWorkbook,
    filterGlobalWorkbooks,
    isGlobalWorkbookOwner,
    isGlobalWorkbookReachable,
} from '../../src/mobile/pages/Spreadsheets/mobileGlobalSpreadsheetModel.js';

const template = { id: 'boq', name: 'Bill of Quantities', sheets: [{ id: 'sheet-1', celldata: [{ r: 0, c: 0, v: { v: 4 } }] }] };

test('global workbooks preserve the source localStorage namespaces and null ownership', () => {
    const workbook = createGlobalWorkbook(template, () => 'fixed');
    assert.equal(GLOBAL_WORKBOOK_LIST_KEY, 'mano_spreadsheet_list_global');
    assert.equal(GLOBAL_WORKBOOK_BODY_PREFIX, 'mano_spreadsheet_wb_');
    assert.equal(workbook.id, 'wb_fixed');
    assert.equal(workbook.projectId, null);
    assert.notEqual(workbook.sheets, template.sheets);
    assert.deepEqual(workbook.sheets, template.sheets);
});

test('global reachability requires global index membership and global-compatible ownership', () => {
    const global = { id: 'global-1', projectId: null };
    const legacy = { id: 'legacy-1' };
    const project = { id: 'project-1', projectId: 42 };
    assert.equal(isGlobalWorkbookOwner(global), true);
    assert.equal(isGlobalWorkbookOwner(legacy), true);
    assert.equal(isGlobalWorkbookOwner(project), false);
    assert.equal(isGlobalWorkbookReachable(global, [global]), true);
    assert.equal(isGlobalWorkbookReachable(legacy, [legacy]), true);
    assert.equal(isGlobalWorkbookReachable(global, []), false);
    assert.equal(isGlobalWorkbookReachable(project, [project]), false);
});

test('global import and duplicate preserve null ownership without project labels', () => {
    const imported = createImportedGlobalWorkbook({ workbookName: 'Rates', sheets: [{ id: 'rates' }] }, { name: 'rates.xlsx' }, () => 'import');
    const copy = duplicateGlobalWorkbook(imported, () => 'copy');
    assert.equal(imported.projectId, null);
    assert.equal(imported.id, 'wb_import');
    assert.equal(copy.id, 'wb_copy');
    assert.equal(copy.projectId, null);
    assert.equal(copy.name, 'Rates (Copy)');
    assert.notEqual(copy.sheets, imported.sheets);
});

test('global write gate is source-compatible and search is non-mutating', () => {
    assert.equal(canWriteGlobalSpreadsheets({ isAdmin: true }), true);
    assert.equal(canWriteGlobalSpreadsheets({ isAdmin: false, hasPermission: () => true }), true);
    assert.equal(canWriteGlobalSpreadsheets({ isAdmin: false, hasPermission: () => false }), false);
    const rows = [{ name: 'Bill of Quantities' }, { name: 'Daily Progress' }];
    assert.deepEqual(filterGlobalWorkbooks(rows, 'bill'), [rows[0]]);
    assert.equal(rows.length, 2);
    assert.equal(GLOBAL_SPREADSHEET_DISCLOSURE.some((line) => /project/i.test(line)), false);
});
