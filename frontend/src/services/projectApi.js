import api from './api';

export const projectApi = {
    listProjects: async () => {
        const response = await api.get('/projects');
        return response.data;
    },

    getProject: async (id) => {
        const response = await api.get(`/projects/${id}`);
        return response.data;
    },

    createProject: async (projectData) => {
        const response = await api.post('/projects', projectData);
        return response.data;
    },

    updateProject: async (id, projectData) => {
        const response = await api.put(`/projects/${id}`, projectData);
        return response.data;
    },

    getProjectMembers: async (id) => {
        const response = await api.get(`/projects/${id}/members`);
        return response.data;
    },

    assignProjectMember: async (id, memberData) => {
        const response = await api.post(`/projects/${id}/members`, memberData);
        return response.data;
    },

    removeProjectMember: async (id, userId) => {
        const response = await api.delete(`/projects/${id}/members/${userId}`);
        return response.data;
    },

    uploadProjectLogo: async (id, file) => {
        const formData = new FormData();
        formData.append('logo', file);
        const response = await api.post(`/projects/${id}/logo`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    listProjectResources: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/resources`);
        return response.data;
    },

    removeProjectResource: async (projectId, resourceId) => {
        const response = await api.delete(`/projects/${projectId}/resources/${resourceId}`);
        return response.data;
    },

    importResource: async (projectId, resourceId, effectiveFrom) => {
        const response = await api.post(`/projects/${projectId}/resources/${resourceId}/import`, {
            effective_from: effectiveFrom
        });
        return response.data;
    },

    getResolvedResourceRate: async (projectId, resourceId, date) => {
        const response = await api.get(`/projects/${projectId}/resources/${resourceId}/rate`, {
            params: date ? { date } : undefined
        });
        return response.data;
    },

    addResourceRate: async (projectId, resourceId, data) => {
        const response = await api.post(`/projects/${projectId}/resources/${resourceId}/rates`, data);
        return response.data;
    },

    getResourceRateHistory: async (projectId, resourceId) => {
        const response = await api.get(`/projects/${projectId}/resources/${resourceId}/rates`);
        return response.data;
    },

    clearResourceRate: async (projectId, resourceId, effectiveFrom) => {
        const response = await api.post(`/projects/${projectId}/resources/${resourceId}/clear-rate`, {
            effective_from: effectiveFrom
        });
        return response.data;
    },

    setProjectCompositions: async (projectId, resourceId, compositions, effectiveFrom) => {
        const response = await api.put(`/projects/${projectId}/resources/${resourceId}/compositions`, {
            compositions,
            effective_from: effectiveFrom
        });
        return response.data;
    },

    getProjectCompositionHistory: async (projectId, resourceId) => {
        const response = await api.get(`/projects/${projectId}/resources/${resourceId}/compositions`);
        return response.data;
    }
};
