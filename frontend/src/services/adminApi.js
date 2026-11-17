import api from './api';

function employeePayload(data) {
    return {
        user_name: data.name ?? data.user_name,
        email: data.email ?? data.email_id,
        user_password: data.password || data.user_password || undefined,
        user_type: data.user_type ?? data.role,
        phone_no: data.phone_no,
        department: data.department,
        dept_id: data.dept_id,
        desg_id: data.desg_id,
        system_permissions: data.system_permissions,
    };
}

export const adminApi = {
    listReference: async key => (await api.get('/admin/' + key)).data[key],
    createReference: async (key, data) => (await api.post('/admin/' + key, data)).data,
    renameReference: async (key, id, data) => (await api.put('/admin/' + key + '/' + id, data)).data,
    deleteReference: async (key, id) => (await api.delete('/admin/' + key + '/' + id)).data,
    getDesignations: async () => (await api.get('/admin/designations')).data,
    getUsers: async (params = {}) => {
        const response = await api.get('/admin/users', { params });
        return response.data;
    },

    createUser: async (userData) => {
        const phone = String(userData.phone_no ?? '').trim();
        if (!phone) throw new Error('Enter a mobile number to create this employee.');
        const payload = employeePayload({ ...userData, phone_no: phone });
        const response = await api.post('/admin/user', payload);
        return response.data;
    },

    updateUser: async (id, userData) => {
        const payload = employeePayload(userData);
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
    },

    bulkValidate: async (users) => {
        const response = await api.post('/admin/users/bulk-validate', { users });
        return response.data;
    },

    bulkCreateJson: async (users) => {
        const response = await api.post('/admin/users/bulk-json', { users });
        return response.data;
    }
};
