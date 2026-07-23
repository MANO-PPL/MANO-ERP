import api from './api';

export const qualityApi = {
    getObservations: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/quality`);
        return response.data;
    },

    createObservation: async (projectId, formData) => {
        const response = await api.post(`/projects/${projectId}/quality`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    updateObservation: async (projectId, obsId, formData) => {
        const response = await api.put(`/projects/${projectId}/quality/${obsId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    submitFix: async (projectId, obsId, formData) => {
        const response = await api.post(`/projects/${projectId}/quality/${obsId}/fix`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    approveFix: async (projectId, obsId) => {
        const response = await api.post(`/projects/${projectId}/quality/${obsId}/approve`);
        return response.data;
    },

    deleteObservation: async (projectId, obsId) => {
        const response = await api.delete(`/projects/${projectId}/quality/${obsId}`);
        return response.data;
    },

    getMethodologies: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/quality/methodology`);
        return response.data;
    },

    uploadMethodology: async (projectId, formData) => {
        const response = await api.post(`/projects/${projectId}/quality/methodology`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    deleteMethodology: async (projectId, docId) => {
        const response = await api.delete(`/projects/${projectId}/quality/methodology/${docId}`);
        return response.data;
    },

    getChecklists: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/quality/checklist`);
        return response.data;
    },

    uploadChecklist: async (projectId, formData) => {
        const response = await api.post(`/projects/${projectId}/quality/checklist`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    deleteChecklist: async (projectId, docId) => {
        const response = await api.delete(`/projects/${projectId}/quality/checklist/${docId}`);
        return response.data;
    }
};



export default qualityApi;
