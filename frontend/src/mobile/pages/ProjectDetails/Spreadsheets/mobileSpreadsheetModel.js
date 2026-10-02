export function createSpreadsheetProjectGuard() {
    let generation = 0;
    let activeProjectId = null;
    return {
        begin(projectId) {
            generation += 1;
            activeProjectId = String(projectId ?? '');
            return { generation, projectId: activeProjectId };
        },
        invalidate(projectId) {
            generation += 1;
            activeProjectId = String(projectId ?? '');
        },
        isCurrent(token, projectId = activeProjectId) {
            return Boolean(token)
                && token.generation === generation
                && token.projectId === activeProjectId
                && String(projectId ?? '') === activeProjectId;
        },
    };
}

export function workbookBelongsToProject(workbook, projectId) {
    return Boolean(workbook)
        && String(workbook.projectId ?? '') === String(projectId ?? '');
}

export function createProjectWorkbook(template, project, idFactory = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`) {
    const projectId = project?.id;
    return {
        id: `wb_proj_${projectId}_${idFactory()}`,
        name: `${project?.project_code || 'PRJ'} - ${template.name}`,
        projectId,
        sheets: typeof structuredClone === 'function'
            ? structuredClone(template.sheets)
            : JSON.parse(JSON.stringify(template.sheets)),
        templateId: template.id,
    };
}

export function createImportedWorkbook(parsed, file, project, idFactory = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`) {
    return {
        id: `wb_proj_${project?.id}_${idFactory()}`,
        name: `${project?.project_code || 'PRJ'} - ${parsed.workbookName || file.name.replace(/\.[^/.]+$/, '')}`,
        projectId: project?.id,
        sheets: parsed.sheets,
        templateId: 'imported',
    };
}

export function duplicateProjectWorkbook(workbook, project, idFactory = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`) {
    return {
        ...workbook,
        id: `wb_proj_${project?.id}_${idFactory()}`,
        name: `${workbook.name} (Copy)`,
        projectId: project?.id,
        sheets: typeof structuredClone === 'function'
            ? structuredClone(workbook.sheets)
            : JSON.parse(JSON.stringify(workbook.sheets)),
        templateId: workbook.templateId || 'custom',
    };
}

export function filterProjectWorkbooks(workbooks, query) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return workbooks || [];
    return (workbooks || []).filter((workbook) => String(workbook.name || '').toLowerCase().includes(normalized));
}

export const LOCAL_SPREADSHEET_DISCLOSURE = Object.freeze([
    'Stored locally on this device/browser for this project.',
    'Not synchronized to the ERP server.',
    "Clearing this site's browser data may remove locally stored workbooks.",
]);
