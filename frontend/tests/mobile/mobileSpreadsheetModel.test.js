import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportedWorkbook, createProjectWorkbook, createSpreadsheetProjectGuard, duplicateProjectWorkbook, filterProjectWorkbooks, LOCAL_SPREADSHEET_DISCLOSURE, workbookBelongsToProject } from '../../src/mobile/pages/ProjectDetails/Spreadsheets/mobileSpreadsheetModel.js';

test('M11 spreadsheet workbooks remain project keyed and preserve FortuneSheet sheets', () => {
    const project = { id: 42, project_code: 'P-42' };
    const template = { id: 'boq', name: 'BOQ', sheets: [{ id: 'sheet-1', celldata: [{ r: 0, c: 0, v: { v: 3 } }] }] };
    const workbook = createProjectWorkbook(template, project, () => 'fixed');
    assert.equal(workbook.id, 'wb_proj_42_fixed');
    assert.equal(workbook.projectId, 42);
    assert.equal(workbook.name, 'P-42 - BOQ');
    assert.deepEqual(workbook.sheets, template.sheets);
    assert.notEqual(workbook.sheets, template.sheets);
    assert.equal(workbookBelongsToProject(workbook, 42), true);
    assert.equal(workbookBelongsToProject(workbook, 7), false);
});

test('M11 spreadsheet import and duplication preserve source serialization without cross-project identity', () => {
    const project = { id: 9, project_code: 'SITE' };
    const imported = createImportedWorkbook({ success: true, workbookName: 'Rates', sheets: [{ id: 's1' }] }, { name: 'rates.xlsx' }, project, () => 'import');
    assert.equal(imported.id, 'wb_proj_9_import');
    assert.equal(imported.templateId, 'imported');
    const copy = duplicateProjectWorkbook(imported, project, () => 'copy');
    assert.equal(copy.id, 'wb_proj_9_copy');
    assert.equal(copy.name, 'SITE - Rates (Copy)');
    assert.notEqual(copy.sheets, imported.sheets);
});

test('M11 spreadsheet guard rejects stale project work and search is non-mutating', () => {
    const guard = createSpreadsheetProjectGuard();
    const a = guard.begin(42);
    const b = guard.begin(77);
    assert.equal(guard.isCurrent(a, 42), false);
    assert.equal(guard.isCurrent(b, 77), true);
    const rows = [{ name: 'Bill of Quantities' }, { name: 'Daily Log' }];
    assert.deepEqual(filterProjectWorkbooks(rows, 'bill'), [rows[0]]);
    assert.equal(rows.length, 2);
    assert.equal(LOCAL_SPREADSHEET_DISCLOSURE.length, 3);
});
