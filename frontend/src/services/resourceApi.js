import api from './api';

export const resourceApi = {
    getResources: async (params = {}) => {
        const response = await api.get('/resources', { params });
        return response.data;
    },

    getResourceById: async (id) => {
        const response = await api.get(`/resources/${id}`);
        return response.data;
    },

    createResource: async (data) => {
        const response = await api.post('/resources', data);
        return response.data;
    },

    updateResource: async (id, data) => {
        const response = await api.put(`/resources/${id}`, data);
        return response.data;
    },

    deleteResource: async (id) => {
        const response = await api.delete(`/resources/${id}`);
        return response.data;
    },

    setCompositions: async (id, compositions) => {
        const response = await api.put(`/resources/${id}/compositions`, { compositions });
        return response.data;
    },

    addConversion: async (id, data) => {
        const response = await api.post(`/resources/${id}/conversions`, data);
        return response.data;
    },

    removeConversion: async (id, convId) => {
        const response = await api.delete(`/resources/${id}/conversions/${convId}`);
        return response.data;
    }
};
