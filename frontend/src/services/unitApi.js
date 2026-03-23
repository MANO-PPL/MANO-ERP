import api from './api';

export const unitApi = {
    getUnits: async (unitType = null) => {
        const params = unitType ? { unit_type: unitType } : {};
        const response = await api.get('/units', { params });
        return response.data;
    },

    createUnit: async (data) => {
        const response = await api.post('/units', data);
        return response.data;
    },

    updateUnit: async (id, data) => {
        const response = await api.put(`/units/${id}`, data);
        return response.data;
    },

    deleteUnit: async (id) => {
        const response = await api.delete(`/units/${id}`);
        return response.data;
    }
};
