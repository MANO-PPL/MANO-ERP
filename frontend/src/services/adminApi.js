import api from './api';

export const adminApi = {
    getUsers: async (params = {}) => {
        const response = await api.get('/admin/users', { params });
        return response.data;
    },

    createUser: async (userData) => {
        const payload = {
            ...userData,
            user_name: userData.name || userData.user_name,
            email: userData.email || userData.email_id,
            user_password: userData.password || userData.user_password,
            user_status: userData.status || 'Active',
            system_permissions: userData.system_permissions,
            project_permissions: userData.project_permissions,
            project_ids: userData.project_ids,
            user_type: (userData.user_type || userData.role || 'employee').toLowerCase() === 'admin' ? 'admin' : 'employee'
        };
        const response = await api.post('/admin/user', payload);
        return response.data;
    },

    updateUser: async (id, userData) => {
        const payload = {
            ...userData,
            user_name: userData.name || userData.user_name,
            email: userData.email || userData.email_id,
            user_status: userData.status,
            system_permissions: userData.system_permissions,
            project_permissions: userData.project_permissions,
            project_ids: userData.project_ids,
            user_type: (userData.user_type || userData.role || 'employee').toLowerCase() === 'admin' ? 'admin' : 'employee'
        };
        const response = await api.put(`/admin/user/${id}`, payload);
        return response.data;
    },

    deleteUser: async (id) => {
        const response = await api.delete(`/admin/user/${id}`);
        return response.data;
    },

    getUser: async (id) => {
        const response = await api.get(`/admin/user/${id}`);
        return response.data;
    },

    getPermissionTemplates: async (type) => {
        const params = type ? { type } : {};
        const response = await api.get('/admin/permission-templates', { params });
        return response.data;
    },

    createPermissionTemplate: async (data) => {
        const response = await api.post('/admin/permission-templates', data);
        return response.data;
    },

    updatePermissionTemplate: async (id, data) => {
        const response = await api.put(`/admin/permission-templates/${id}`, data);
        return response.data;
    },

    deletePermissionTemplate: async (id) => {
        const response = await api.delete(`/admin/permission-templates/${id}`);
        return response.data;
    },

    bulkUpload: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/admin/users/bulk', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    }
};
