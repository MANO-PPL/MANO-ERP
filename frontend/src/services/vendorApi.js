import api from './api';

export const vendorApi = {
    // ─── List Vendors ────────────────────────────────────────────────────────
    getVendors: async (params = {}) => {
        const response = await api.get('/vendors', { params });
        return response.data;
    },

    // ─── Get Single Vendor ───────────────────────────────────────────────────
    getVendorById: async (id) => {
        const response = await api.get(`/vendors/${id}`);
        return response.data;
    },

    // ─── Create Single Vendor ────────────────────────────────────────────────
    createVendor: async (data) => {
        const response = await api.post('/vendors', data);
        return response.data;
    },

    // ─── Update Single Vendor ────────────────────────────────────────────────
    updateVendor: async (id, data) => {
        const response = await api.put(`/vendors/${id}`, data);
        return response.data;
    },

    // ─── Delete Single Vendor ────────────────────────────────────────────────
    deleteVendor: async (id) => {
        const response = await api.delete('/vendors', { data: { ids: [id] } });
        return response.data;
    },

    // ─── Delete Multiple Vendors ──────────────────────────────────────────────
    deleteVendors: async (ids) => {
        const response = await api.delete('/vendors', { data: { ids } });
        return response.data;
    },

    // ─── Bulk Create Vendors (JSON) ──────────────────────────────────────────
    bulkCreateVendors: async (vendors) => {
        const response = await api.post('/vendors/bulk-json', { vendors });
        return response.data;
    }
};

export default vendorApi;
