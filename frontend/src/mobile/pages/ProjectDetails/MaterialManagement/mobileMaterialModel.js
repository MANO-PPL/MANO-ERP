export const MATERIAL_TABS = Object.freeze(['grid', 'recipes', 'rates', 'conversions']);

export const resolveMaterialTab = (value) => MATERIAL_TABS.includes(value) ? value : 'grid';

export const resourceRowId = (row) => String(row?.resource_id ?? row?.id ?? '');

export const resolveMaterialResourceId = (rows, candidate) => {
    const requested = String(candidate || '');
    if (requested && rows.some((row) => resourceRowId(row) === requested)) return requested;
    return rows[0] ? resourceRowId(rows[0]) : '';
};

export const buildProjectRecipePayload = (rows) => rows
    .filter((row) => row.component_resource_id && Number(row.quantity) > 0 && row.unit_code)
    .map((row) => ({ component_resource_id: Number(row.component_resource_id), quantity: Number(row.quantity), unit_code: row.unit_code }));

export const buildProjectRatePayload = (form, baseUnit) => ({
    mode: form.mode,
    rate: form.mode === 'computed' ? null : Number(form.rate),
    unit_code: form.unit_code || baseUnit || 'nos',
    effective_from: form.effective_from,
    effective_to: form.effective_to || null,
    remarks: form.remarks || (form.mode === 'computed' ? 'Dynamic recipe calculation' : 'Project override rate'),
});

export async function importProjectResources({ projectId, resourceIds, effectiveFrom, service }) {
    const ids = [...new Set(resourceIds.map(Number).filter(Number.isInteger))];
    if (!ids.length) return { mode: 'none', succeeded: [], failed: [] };
    try {
        await service.importResourcesBatch(projectId, ids, effectiveFrom);
        return { mode: 'batch', succeeded: ids, failed: [] };
    } catch (batchError) {
        const settled = await Promise.all(ids.map(async (id) => {
            try { await service.importResource(projectId, id, effectiveFrom); return { id, ok: true }; }
            catch (error) { return { id, ok: false, error }; }
        }));
        return { mode: 'fallback', batchError, succeeded: settled.filter((row) => row.ok).map((row) => row.id), failed: settled.filter((row) => !row.ok) };
    }
}

export const materialLoadResult = ({ projectResult, masterResult, rateResult }) => {
    const readRows = (value) => value?.resources || value?.data || (Array.isArray(value) ? value : []);
    const projectRows = projectResult?.status === 'fulfilled' ? readRows(projectResult.value) : [];
    const masterRows = masterResult?.status === 'fulfilled' ? readRows(masterResult.value) : [];
    const imported = new Set(projectRows.map(resourceRowId));
    const rows = [
        ...projectRows.map((row) => ({ ...row, id: row.id || row.project_resource_id || row.resource_id, isImported: true })),
        ...masterRows.filter((row) => !imported.has(resourceRowId(row))).map((row) => ({ ...row, scope: 'master' })),
    ];
    const rates = Object.fromEntries((rateResult?.rates || []).map((row) => [String(row.resource_id || row.id), row]));
    return { rows, rates, projectError: projectResult?.status === 'rejected' ? projectResult.reason : null, masterError: masterResult?.status === 'rejected' ? masterResult.reason : null };
};
