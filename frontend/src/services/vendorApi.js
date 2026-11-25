import api from './api';

/**
 * REST API client service for Vendor directory management, creation, updates, and batch deletions.
 */
export const vendorApi = {
    getVendors: async (params = {}) => {
        const response = await api.get('/parties', { params: { ...params, party_type: 'vendor' } });
        return response.data;
    },

    getVendorById: async (id) => {
        if (!id || String(id).startsWith('temp_') || isNaN(Number(id))) {
            return null;
        }
        const response = await api.get(`/parties/${id}`, { params: { party_type: 'vendor' } });
        return response.data;
    },

    createVendor: async (data) => {
        const response = await api.post('/parties', { ...data, party_type: 'vendor' });
        return response.data;
    },

    updateVendor: async (id, data) => {
        if (!id || String(id).startsWith('temp_') || isNaN(Number(id))) {
            return null;
        }
        const response = await api.put(`/parties/${id}`, { ...data, party_type: 'vendor' });
        return response.data;
    },

    deleteVendor: async (id) => {
        if (!id || String(id).startsWith('temp_') || isNaN(Number(id))) {
            return null;
        }
        const response = await api.delete('/parties', { params: { party_type: 'vendor' }, data: { ids: [id] } });
        return response.data;
    },

    deleteVendors: async (ids) => {
        const response = await api.delete('/parties', { params: { party_type: 'vendor' }, data: { ids } });
        return response.data;
    },

    bulkCreateVendors: async (vendors) => {
        const response = await api.post('/parties/bulk-json', { vendors }, { params: { party_type: 'vendor' } });
        return response.data;
    },

    batchSaveVendors: async (payload) => {
        const response = await api.post('/parties/batch-save', payload, { params: { party_type: 'vendor' } });
        return response.data;
    },

    archiveVendor: async (id) => {
        const response = await api.post(`/parties/${id}/archive`, {}, { params: { party_type: 'vendor' } });
        return response.data;
    },

    restoreVendor: async (id) => {
        const response = await api.post(`/parties/${id}/restore`, {}, { params: { party_type: 'vendor' } });
        return response.data;
    }
};

export default vendorApi;
