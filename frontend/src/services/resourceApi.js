import api from './api';

const unwrap = (request) => request.then(({ data }) => data);

export const resourceApi = {
    // ─── List with optional filters ────────────────────────────────────────────
    getResources: (params = {}) => unwrap(api.get('/resources', { params })),

    // Resolve multiple resource rates for one date in a single API request.
    getResolvedRates: (resourceIds, date, projectId = null) => {
        const ids = [...new Set((resourceIds || []).map(Number).filter(Number.isInteger))];
        if (ids.length === 0) return Promise.resolve({ rates: [] });
        return unwrap(api.get('/resources/rates', {
            params: { ids: ids.join(','), ...(date ? { date } : {}), ...(projectId ? { project_id: projectId } : {}) }
        }));
    },

    // ─── Get single resource with conversions & compositions ──────────────────
    getResourceById: (id, date, projectId = null) => unwrap(api.get(`/resources/${id}`, {
        params: { ...(date ? { date } : {}), ...(projectId ? { project_id: projectId } : {}) }
    })),

    // Resolve the effective manual or computed rate for a resource.
    getResolvedRate: (id, date, projectId = null) => unwrap(api.get(`/resources/${id}/rate`, {
        params: { ...(date ? { date } : {}), ...(projectId ? { project_id: projectId } : {}) }
    })),

    // ─── Create single resource ────────────────────────────────────────────────
    // Payload: { name, code?, type, base_unit_code, description?, remarks?,
    //            conversions?: [{name, quantity, unit_code}],
    //            compositions?: [{component_resource_id, quantity, unit_code}] }
    createResource: (data) => unwrap(api.post('/resources', data)),

    // ─── Bulk create resources ─────────────────────────────────────────────────
    // payload: Array of resource objects (same shape as single create)
    bulkCreateResources: (data) => unwrap(api.post('/resources', data)),

    // ─── Bulk update resources ─────────────────────────────────────────────────
    // payload: Array of resource objects with id
    bulkUpdateResources: (data) => unwrap(api.put('/resources', data)),

    // ─── Update resource (conversions & compositions included if provided) ─────
    updateResource: (id, data) => unwrap(api.put(`/resources/${id}`, data)),

    // ─── Delete resource ──────────────────────────────────────────────────────
    deleteResource: (id) => unwrap(api.delete(`/resources/${id}`)),

    // ─── Create/replace one effective-dated composition version ───────────────
    // compositions: [{component_resource_id, quantity, unit_code}]
    setCompositions: (id, compositions, effective_from, projectId = null) => unwrap(api.put(`/resources/${id}/compositions`, {
        compositions,
        ...(effective_from ? { effective_from } : {}),
        ...(projectId ? { project_id: projectId } : {})
    })),

    getCompositionHistory: (id, projectId = null) => unwrap(api.get(`/resources/${id}/compositions`, {
        params: projectId ? { project_id: projectId } : undefined
    })),

    // ─── Add a single conversion to a resource ────────────────────────────────
    // data: { name, quantity, unit_code }
    addConversion: (id, data) => unwrap(api.post(`/resources/${id}/conversions`, data)),

    // Adding a row creates a manual rate.
    addRate: (id, data, projectId = null) => unwrap(api.post(`/resources/${id}/rates`, {
        ...data,
        ...(projectId ? { project_id: projectId } : {})
    })),

    // Read all manual rate versions, newest first.
    getRateHistory: (id, projectId = null) => unwrap(api.get(`/resources/${id}/rates`, {
        params: projectId ? { project_id: projectId } : undefined
    })),

    // ─── Remove a specific conversion by its ID ──────────────────────────────
    removeConversion: (id, convId) => unwrap(api.delete(`/resources/${id}/conversions/${convId}`)),

    clearManualRate: (resourceId, effectiveFrom, projectId = null) => unwrap(
        api.post(`/resources/${resourceId}/clear-rate`, {
            effective_from: effectiveFrom,
            ...(projectId ? { project_id: projectId } : {})
        })
    ),
};
