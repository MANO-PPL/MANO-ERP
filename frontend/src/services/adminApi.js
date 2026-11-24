import api from './api';

function employeePayload(data) {
    const payload = {};
    if (data.name !== undefined || data.user_name !== undefined) {
        payload.user_name = data.name ?? data.user_name;
    }
    if (data.email !== undefined || data.email_id !== undefined) {
        payload.email = data.email ?? data.email_id;
    }
    if (data.password || data.user_password) {
        payload.user_password = data.password || data.user_password;
    }
    if (data.user_type !== undefined || data.role !== undefined) {
        payload.user_type = data.user_type ?? data.role;
    }
    if (data.phone_no !== undefined) {
        payload.phone_no = data.phone_no;
    }
    if (data.department !== undefined) {
        payload.department = data.department;
    }
    if (data.dept_id !== undefined) {
        payload.dept_id = data.dept_id;
    }
    if (data.desg_id !== undefined) {
        payload.desg_id = data.desg_id;
    }
    if (data.system_permissions !== undefined) {
        payload.system_permissions = data.system_permissions;
    }
    if ('profile_image_url' in data) {
        payload.profile_image_url = data.profile_image_url;
    }
    return payload;
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
        if (userData instanceof FormData) {
            const response = await api.put(`/admin/user/${id}`, userData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        }
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
