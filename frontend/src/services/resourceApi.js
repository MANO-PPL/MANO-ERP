import api from './api';

export const resourceApi = {
    // ─── List with optional filters ────────────────────────────────────────────
    getResources: async (params = {}) => {
        const response = await api.get('/resources', { params });
        return response.data;
    },

    // ─── Get single resource with conversions & compositions ──────────────────
    getResourceById: async (id, date) => {
        const response = await api.get(`/resources/${id}`, {
            params: date ? { date } : undefined
        });
        return response.data;
    },

    // Resolve the effective manual or computed rate for a resource.
    getResolvedRate: async (id, date) => {
        const response = await api.get(`/resources/${id}/rate`, {
            params: date ? { date } : undefined
        });
        return response.data;
    },

    // ─── Create single resource ────────────────────────────────────────────────
    // Payload: { name, code?, type, base_unit_code, description?, remarks?,
    //            conversions?: [{name, quantity, unit_code}],
    //            compositions?: [{component_resource_id, quantity, unit_code}] }
    createResource: async (data) => {
        const response = await api.post('/resources', data);
        return response.data;
    },

    // ─── Bulk create resources ─────────────────────────────────────────────────
    // payload: Array of resource objects (same shape as single create)
    bulkCreateResources: async (data) => {
        const response = await api.post('/resources', data);
        return response.data;
    },

    // ─── Bulk update resources ─────────────────────────────────────────────────
    // payload: Array of resource objects with id
    bulkUpdateResources: async (data) => {
        const response = await api.put('/resources', data);
        return response.data;
    },

    // ─── Update resource (conversions & compositions included if provided) ─────
    updateResource: async (id, data) => {
        const response = await api.put(`/resources/${id}`, data);
        return response.data;
    },

    // ─── Delete resource ──────────────────────────────────────────────────────
    deleteResource: async (id) => {
        const response = await api.delete(`/resources/${id}`);
        return response.data;
    },

    // ─── Create/replace one effective-dated composition version ───────────────
    // compositions: [{component_resource_id, quantity, unit_code}]
    setCompositions: async (id, compositions, effective_from) => {
        const response = await api.put(`/resources/${id}/compositions`, {
            compositions,
            ...(effective_from ? { effective_from } : {})
        });
        return response.data;
    },

    getCompositionHistory: async (id) => {
        const response = await api.get(`/resources/${id}/compositions`);
        return response.data;
    },

    // ─── Add a single conversion to a resource ────────────────────────────────
    // data: { name, quantity, unit_code }
    addConversion: async (id, data) => {
        const response = await api.post(`/resources/${id}/conversions`, data);
        return response.data;
    },

    // Adding a row creates a manual rate.
    addRate: async (id, data) => {
        const response = await api.post(`/resources/${id}/rates`, data);
        return response.data;
    },

    // Read all manual rate versions, newest first.
    getRateHistory: async (id) => {
        const response = await api.get(`/resources/${id}/rates`);
        return response.data;
    },

    // ─── Remove a specific conversion by its ID ──────────────────────────────
    removeConversion: async (id, convId) => {
        const response = await api.delete(`/resources/${id}/conversions/${convId}`);
        return response.data;
    },

    clearManualRate: (resourceId, effectiveFrom) =>
    api.post(`/resources/${resourceId}/clear-rate`, { effective_from: effectiveFrom })
        .then(res => res.data),
};
