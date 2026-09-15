async function request(url, options) {
    const response = await fetch(url, options);
    let data;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) {
        const error = new Error(data?.message || `Request failed (${response.status})`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

export const mobileDrawingsService = {
    listCategories(projectId) {
        return request(`/api/projects/${projectId}/drawings/categories`);
    },
    createCategory(projectId, payload) {
        return request(`/api/projects/${projectId}/drawings/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },
    updateCategory(projectId, categoryId, payload) {
        return request(`/api/projects/${projectId}/drawings/categories/${categoryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },
    deleteCategory(projectId, categoryId, confirm = false) {
        const suffix = confirm ? '?confirm=true' : '';
        return request(`/api/projects/${projectId}/drawings/categories/${categoryId}${suffix}`, { method: 'DELETE' });
    },
    listDrawings(projectId, categoryId) {
        return request(`/api/projects/${projectId}/drawings/categories/${categoryId}/drawings`);
    },
    uploadDrawing(projectId, formData) {
        return request(`/api/projects/${projectId}/drawings/upload`, { method: 'POST', body: formData });
    },
    updateDrawing(projectId, categoryId, drawingId, payload) {
        return request(`/api/projects/${projectId}/drawings/categories/${categoryId}/drawings/${drawingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },
    deleteDrawing(projectId, categoryId, drawingId) {
        return request(`/api/projects/${projectId}/drawings/categories/${categoryId}/drawings/${drawingId}`, { method: 'DELETE' });
    },
    reorderDrawings(projectId, categoryId, payload) {
        return request(`/api/projects/${projectId}/drawings/categories/${categoryId}/reorder`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },
};

export default mobileDrawingsService;
