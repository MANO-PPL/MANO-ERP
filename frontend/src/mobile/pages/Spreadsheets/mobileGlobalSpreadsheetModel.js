export const GLOBAL_WORKBOOK_LIST_KEY = 'mano_spreadsheet_list_global';
export const GLOBAL_WORKBOOK_BODY_PREFIX = 'mano_spreadsheet_wb_';

export const GLOBAL_SPREADSHEET_DISCLOSURE = Object.freeze([
    'Stored locally on this device/browser.',
    'These workbooks are not synchronized to the ERP server.',
    "Clearing this site's browser data may remove locally stored workbooks.",
]);

const cloneSheets = (sheets) => typeof structuredClone === 'function'
    ? structuredClone(sheets || [])
    : JSON.parse(JSON.stringify(sheets || []));

export function isGlobalWorkbookOwner(workbook) {
    return Boolean(workbook) && (workbook.projectId === null || workbook.projectId === undefined);
}

export function isGlobalWorkbookReachable(workbook, globalIndex = []) {
    const isIndexed = (globalIndex || []).some((item) => String(item?.id) === String(workbook?.id));
    return isIndexed && isGlobalWorkbookOwner(workbook);
}

export function createGlobalWorkbook(template, idFactory = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`) {
    return {
        id: `wb_${idFactory()}`,
        name: `${template.name} - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
        projectId: null,
        sheets: cloneSheets(template.sheets),
        templateId: template.id,
    };
}

export function createImportedGlobalWorkbook(parsed, file, idFactory = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`) {
    return {
        id: `wb_${idFactory()}`,
        name: parsed.workbookName || String(file?.name || 'Imported workbook').replace(/\.[^/.]+$/, ''),
        projectId: null,
        sheets: parsed.sheets,
        templateId: 'imported',
    };
}

export function duplicateGlobalWorkbook(workbook, idFactory = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`) {
    return {
        ...workbook,
        id: `wb_${idFactory()}`,
        name: `${workbook.name} (Copy)`,
        projectId: null,
        sheets: cloneSheets(workbook.sheets),
        templateId: workbook.templateId || 'custom',
    };
}

export function filterGlobalWorkbooks(workbooks, query) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return workbooks || [];
    return (workbooks || []).filter((workbook) => String(workbook.name || '').toLowerCase().includes(normalized));
}

export function canWriteGlobalSpreadsheets({ isAdmin, hasPermission } = {}) {
    return Boolean(isAdmin || hasPermission?.('spreadsheets', 2));
}

export const GLOBAL_EDITOR_WORKSPACE = Object.freeze({
    key: 'global',
    label: 'Global spreadsheets',
    ownsWorkbook: isGlobalWorkbookOwner,
    unavailableDescription: 'This workbook is not in the global workbook list, is project-owned, or is no longer stored on this device.',
});
