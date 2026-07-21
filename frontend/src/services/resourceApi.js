import api from './api';

export const resourceApi = {
    // ─── List with optional filters ────────────────────────────────────────────
    getResources: async (params = {}) => {
        const response = await api.get('/resources', { params });
        return response.data;
    },

    // ─── Get single resource with conversions & compositions ──────────────────
    getResourceById: async (id) => {
        const response = await api.get(`/resources/${id}`);
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

    // ─── Replace ALL compositions for an item resource ────────────────────────
    // compositions: [{component_resource_id, quantity, unit_code}]
    setCompositions: async (id, compositions) => {
        const response = await api.put(`/resources/${id}/compositions`, { compositions });
        return response.data;
    },

    // ─── Add a single conversion to a resource ────────────────────────────────
    // data: { name, quantity, unit_code }
    addConversion: async (id, data) => {
        const response = await api.post(`/resources/${id}/conversions`, data);
        return response.data;
    },

    // ─── Remove a specific conversion by its ID ──────────────────────────────
    removeConversion: async (id, convId) => {
        const response = await api.delete(`/resources/${id}/conversions/${convId}`);
        return response.data;
    }
};
