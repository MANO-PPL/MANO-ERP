import { UNIT_REGISTRY } from '../../../pages/Resources/resourceConstants.js';

export const RESOURCE_TABS = Object.freeze(['directory', 'recipes', 'rates', 'conversions']);
export const RESOURCE_TYPES = Object.freeze(['material', 'item', 'labour']);

export function isAccessDenied(error) {
    return Number(error?.response?.status) === 403;
}

const value = (row, keys) => keys.map((key) => row?.[key]).find((item) => item !== undefined && item !== null && item !== '');

export function normalizeResourceTab(valueToNormalize) {
    return RESOURCE_TABS.includes(valueToNormalize) ? valueToNormalize : 'directory';
}

export function normalizeResource(resource = {}) {
    return {
        ...resource,
        id: resource.id ?? resource.resource_id,
        name: String(resource.name || '').trim(),
        type: RESOURCE_TYPES.includes(resource.type) ? resource.type : 'material',
        baseUnit: resource.base_unit_code || '',
    };
}

export function filterResources(resources, { query = '', types = [], units = [] } = {}) {
    const needle = query.trim().toLowerCase();
    return resources.filter((resource) => {
        if (types.length && !types.includes(resource.type)) return false;
        if (units.length && !units.includes(resource.baseUnit)) return false;
        if (!needle) return true;
        return [resource.name, resource.code, resource.type, resource.baseUnit, resource.description]
            .some((field) => String(field || '').toLowerCase().includes(needle));
    });
}

export function areUnitsCompatible(first, second) {
    return Boolean(UNIT_REGISTRY[first] && UNIT_REGISTRY[second] && UNIT_REGISTRY[first].type === UNIT_REGISTRY[second].type);
}

export function buildResourcePayload(form, { conversions = [], compositions = [], includeComposition = false, effectiveFrom } = {}) {
    return {
        name: String(form.name || '').trim(),
        code: String(form.code || '').trim() || undefined,
        type: form.type,
        base_unit_code: form.base_unit_code,
        description: String(form.description || '').trim() || undefined,
        remarks: String(form.remarks || '').trim() || undefined,
        conversions: conversions.filter((row) => row.name && Number(row.quantity) > 0 && row.unit_code).map((row) => ({
            name: String(row.name).trim(), quantity: Number(row.quantity), unit_code: row.unit_code,
        })),
        ...(includeComposition ? {
            compositions: compositions.filter((row) => row.component_resource_id && Number(row.quantity) > 0 && row.unit_code).map((row) => ({
                component_resource_id: Number(row.component_resource_id), quantity: Number(row.quantity), unit_code: row.unit_code,
            })),
            effective_from: effectiveFrom,
        } : {}),
    };
}

export function normalizeResourceImportRows(rows, validation = {}) {
    const byRow = new Map();
    for (const issue of [...(validation.duplicates || []), ...(validation.missing_fields || []), ...(validation.invalid_types || [])]) {
        const key = Number(issue.row);
        byRow.set(key, [...(byRow.get(key) || []), issue.reason]);
    }
    return rows.map((row, index) => {
        const rowNumber = index + 1;
        const name = String(value(row, ['Name', 'name', 'Resource Name', 'resource_name', 'Item Name']) || '').trim();
        const code = String(value(row, ['Code', 'code', 'Resource Code', 'resource_code']) || '').trim();
        const type = String(value(row, ['Type', 'type', 'Resource Type', 'resource_type']) || 'material').toLowerCase().trim();
        const unit = String(value(row, ['Base Unit', 'base_unit', 'Unit', 'unit', 'Unit Code', 'base_unit_code']) || '').trim();
        const rawRate = value(row, ['Rate', 'rate', 'Price']);
        const issues = [...(byRow.get(rowNumber) || [])];
        if (!name && !issues.some((item) => item.includes('Name'))) issues.push('Missing Name');
        if (!unit && !issues.some((item) => item.includes('Unit'))) issues.push('Missing Base Unit');
        if (!RESOURCE_TYPES.includes(type) && !issues.some((item) => item.includes('Type'))) issues.push('Invalid resource type');
        return {
            ...row, rowNumber, name, code, type, base_unit_code: unit,
            rate: rawRate === undefined || rawRate === '' || Number.isNaN(Number(rawRate)) ? undefined : Number(rawRate),
            rate_unit_code: String(value(row, ['Rate Unit', 'rate_unit']) || unit),
            description: String(value(row, ['Description', 'description']) || ''),
            remarks: String(value(row, ['Remarks', 'remarks']) || ''),
            issues, status: issues.length ? 'Error' : 'Valid',
        };
    });
}

export function buildResourceImportPayload(rows) {
    return rows.map((row) => ({
        name: row.name,
        code: row.code || undefined,
        type: row.type,
        base_unit_code: row.base_unit_code,
        rate: row.rate,
        rate_unit_code: row.rate_unit_code || row.base_unit_code,
        description: row.description || undefined,
        remarks: row.remarks || undefined,
    }));
}
