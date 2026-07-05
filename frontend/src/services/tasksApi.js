import api from './api';

export const tasksApi = {
    getTasks: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/tasks`);
        return response.data;
    },

    createCategory: async (projectId, categoryData) => {
        const response = await api.post(`/projects/${projectId}/tasks/categories`, categoryData);
        return response.data;
    },

    updateCategory: async (projectId, categoryId, categoryData) => {
        const response = await api.put(`/projects/${projectId}/tasks/categories/${categoryId}`, categoryData);
        return response.data;
    },

    deleteCategory: async (projectId, categoryId) => {
        const response = await api.delete(`/projects/${projectId}/tasks/categories/${categoryId}`);
        return response.data;
    },

    createTask: async (projectId, taskData) => {
        const response = await api.post(`/projects/${projectId}/tasks`, taskData);
        return response.data;
    },

    updateTask: async (projectId, taskId, taskData) => {
        const response = await api.put(`/projects/${projectId}/tasks/${taskId}`, taskData);
        return response.data;
    },

    deleteTask: async (projectId, taskId) => {
        const response = await api.delete(`/projects/${projectId}/tasks/${taskId}`);
        return response.data;
    },

    reorder: async (projectId, reorderData) => {
        const response = await api.post(`/projects/${projectId}/tasks/reorder`, reorderData);
        return response.data;
    },

    updateTaskAssignees: async (projectId, taskId, assigneesData) => {
        const response = await api.put(`/projects/${projectId}/tasks/${taskId}/assignees`, assigneesData);
        return response.data;
    }
};
