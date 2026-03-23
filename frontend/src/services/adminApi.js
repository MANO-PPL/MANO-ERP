import api from './api';

export const adminApi = {
    getUsers: async (params = {}) => {
        const response = await api.get('/admin/users', { params });
        return response.data;
    },

    createUser: async (userData) => {
        // Send both standard and DB-specific keys to ensure backend compatibility
        const payload = {
            ...userData,
            user_name: userData.name,
            email_id: userData.email,
            user_password: userData.password,
            user_status: userData.status || 'Active'
        };
        const response = await api.post('/admin/user', payload);
        return response.data;
    },

    updateUser: async (id, userData) => {
        const payload = {
            ...userData,
            user_name: userData.name,
            email_id: userData.email,
            user_status: userData.status
        };
        const response = await api.put(`/admin/user/${id}`, payload);
        return response.data;
    },

    deleteUser: async (id) => {
        const response = await api.delete(`/admin/user/${id}`);
        return response.data;
    }
};
