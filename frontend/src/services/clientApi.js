import api from './api';

export const clientApi = {
    // ─── List Clients ────────────────────────────────────────────────────────
    getClients: async (params = {}) => {
        const response = await api.get('/clients', { params });
        return response.data;
    },

    // ─── Get Single Client ───────────────────────────────────────────────────
    getClientById: async (id) => {
        const response = await api.get(`/clients/${id}`);
        return response.data;
    },

    // ─── Create Single Client ────────────────────────────────────────────────
    createClient: async (data) => {
        const response = await api.post('/clients', data);
        return response.data;
    },

    // ─── Update Single Client ────────────────────────────────────────────────
    updateClient: async (id, data) => {
        const response = await api.put(`/clients/${id}`, data);
        return response.data;
    },

    // ─── Delete Single Client ────────────────────────────────────────────────
    deleteClient: async (id) => {
        const response = await api.delete(`/clients/${id}`);
        return response.data;
    },

    // ─── Delete Multiple Clients ──────────────────────────────────────────────
    deleteClients: async (ids) => {
        const response = await api.delete('/clients', { data: { ids } });
        return response.data;
    },

    // ─── Bulk Create Clients (JSON) ──────────────────────────────────────────
    bulkCreateClients: async (clients) => {
        const response = await api.post('/clients/bulk-json', { clients });
        return response.data;
    }
};

export default clientApi;
