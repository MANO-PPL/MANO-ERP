import api from './api';

/**
 * REST API client service for Client directory management, creation, updates, and batch deletions.
 */
export const clientApi = {
    getClients: async (params = {}) => {
        const response = await api.get('/parties', { params: { ...params, party_type: 'client' } });
        return response.data;
    },

    getClientById: async (id) => {
        if (!id || String(id).startsWith('temp_') || isNaN(Number(id))) {
            return null;
        }
        const response = await api.get(`/parties/${id}`, { params: { party_type: 'client' } });
        return response.data;
    },

    createClient: async (data) => {
        const response = await api.post('/parties', { ...data, party_type: 'client' });
        return response.data;
    },

    updateClient: async (id, data) => {
        if (!id || String(id).startsWith('temp_') || isNaN(Number(id))) {
            return null;
        }
        const response = await api.put(`/parties/${id}`, { ...data, party_type: 'client' });
        return response.data;
    },

    deleteClient: async (id) => {
        if (!id || String(id).startsWith('temp_') || isNaN(Number(id))) {
            return null;
        }
        const response = await api.delete(`/parties/${id}`, { params: { party_type: 'client' } });
        return response.data;
    },

    deleteClients: async (ids) => {
        const response = await api.delete('/parties', { params: { party_type: 'client' }, data: { ids } });
        return response.data;
    },

    bulkCreateClients: async (clients) => {
        const response = await api.post('/parties/bulk-json', { clients }, { params: { party_type: 'client' } });
        return response.data;
    },

    batchSaveClients: async (payload) => {
        const response = await api.post('/parties/batch-save', payload, { params: { party_type: 'client' } });
        return response.data;
    },

    archiveClient: async (id) => {
        const response = await api.post(`/parties/${id}/archive`, {}, { params: { party_type: 'client' } });
        return response.data;
    },

    restoreClient: async (id) => {
        const response = await api.post(`/parties/${id}/restore`, {}, { params: { party_type: 'client' } });
        return response.data;
    }
};

export default clientApi;
