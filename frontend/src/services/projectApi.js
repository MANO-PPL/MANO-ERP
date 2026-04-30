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
    }
};
