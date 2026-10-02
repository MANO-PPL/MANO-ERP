export const DRAWINGS_GRID = 'grid';
export const DRAWINGS_DETAIL = 'detail';

export function normalizeDrawingsView(value) {
    return value === DRAWINGS_DETAIL ? DRAWINGS_DETAIL : DRAWINGS_GRID;
}

export function updateDrawingsSearch(search, updates = {}) {
    const next = new URLSearchParams(search || '');
    Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
    });
    return next;
}

export function normalizeDrawingsSearch(search, categories = [], categoriesLoaded = false) {
    const next = new URLSearchParams(search || '');
    const requested = next.get('view');
    const view = normalizeDrawingsView(requested);
    let changed = requested !== view;
    if (view === DRAWINGS_GRID) {
        if (next.has('cat')) changed = true;
        next.set('view', DRAWINGS_GRID);
        next.delete('cat');
        return { params: next, view, category: null, changed };
    }
    const category = categories.find((item) => String(item.id) === String(next.get('cat')));
    if (categoriesLoaded && !category) {
        next.set('view', DRAWINGS_GRID);
        next.delete('cat');
        return { params: next, view: DRAWINGS_GRID, category: null, changed: true };
    }
    return { params: next, view, category: category || null, changed };
}

export function createDrawingsRequestGuard() {
    let generation = 0;
    let scope = '';
    return {
        begin(projectId, categoryId = '') {
            generation += 1;
            scope = `${projectId ?? ''}:${categoryId ?? ''}`;
            return { generation, scope };
        },
        invalidate(projectId, categoryId = '') {
            generation += 1;
            scope = `${projectId ?? ''}:${categoryId ?? ''}`;
        },
        isCurrent(token, projectId, categoryId = '') {
            return Boolean(token)
                && token.generation === generation
                && token.scope === scope
                && scope === `${projectId ?? ''}:${categoryId ?? ''}`;
        },
    };
}

export function drawingFileField(file) {
    const extension = String(file?.name || file || '').split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return 'pdfFile';
    if (extension === 'dwg' || extension === 'dxf') return 'dwgFile';
    return null;
}

export function drawingUploadFormData({ categoryId, title, description = '', drawingGroupId, file }, FormDataType = FormData) {
    const field = drawingFileField(file);
    if (!field) throw new Error('Choose a DWG, DXF, or PDF file.');
    const form = new FormDataType();
    form.append('categoryId', categoryId);
    form.append('title', title || '');
    form.append('description', description || '');
    if (drawingGroupId) form.append('drawingGroupId', drawingGroupId);
    form.append(field, file);
    return form;
}

export function reorderDrawingDraft(rows, fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= rows.length || fromIndex === toIndex) return [...rows];
    const next = [...rows];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
}

export function drawingOrderPayload(rows) {
    return { order: (rows || []).map((drawing, index) => ({ id: drawing.id, sort_order: index + 1 })) };
}

export function isForbiddenError(error) {
    return Number(error?.status || error?.response?.status) === 403;
}

export function drawingErrorMessage(error, fallback) {
    if (isForbiddenError(error)) return 'Access denied by the current ERP permission policy.';
    return error?.data?.message || error?.response?.data?.message || error?.message || fallback;
}
