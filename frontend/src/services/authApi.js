import api from './api';

export const authApi = {
    logout: async () => {
        const response = await api.post('/auth/logout');
        return response.data;
    }
};
