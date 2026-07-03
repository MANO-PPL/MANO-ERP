import api from './api';

export const authApi = {
    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },
    logout: async () => {
        const response = await api.post('/auth/logout');
        return response.data;
    }
};
