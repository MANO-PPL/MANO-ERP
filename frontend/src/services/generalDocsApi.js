import api from './api';

export const generalDocsApi = {
    // ---- PROJECT SUMMARY ----
    getSummaries: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/summary`);
        return response.data;
    },
    addSummaries: async (projectId, items) => {
        const response = await api.post(`/projects/${projectId}/summary`, items);
        return response.data;
    },
    updateSummaries: async (projectId, items) => {
        const response = await api.put(`/projects/${projectId}/summary`, items);
        return response.data;
    },
    deleteSummaries: async (projectId, ids) => {
        // Axios delete body goes in 'data' config property
        const response = await api.delete(`/projects/${projectId}/summary`, { data: ids });
        return response.data;
    },

    // ---- PROJECT DIRECTORY ----
    getDirectory: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/directory`);
        return response.data;
    },
    getStaff: async () => ({ staff: [] }),
    
    addDirectoryItem: async (projectId, itemData) => {
        const response = await api.post(`/projects/${projectId}/directory`, itemData);
        return response.data;
    },
    updateDirectoryItem: async (projectId, pdId, itemData) => {
        const response = await api.put(`/projects/${projectId}/directory/${pdId}`, itemData);
        return response.data;
    },
    deleteDirectoryItem: async (projectId, pdId) => {
        const response = await api.delete(`/projects/${projectId}/directory/${pdId}`);
        return response.data;
    },

    // ---- PROJECT PARTIES ----
    getParties: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/parties`);
        return response.data;
    },
    getAvailableParties: async (projectId, params = {}) => {
        const response = await api.get(`/projects/${projectId}/parties/available`, { params });
        return response.data;
    },
    addParties: async (projectId, partyIds) => {
        const response = await api.post(`/projects/${projectId}/parties`, { parties: partyIds });
        return response.data;
    },
    deleteParty: async (projectId, ppId) => {
        const response = await api.delete(`/projects/${projectId}/parties`, { data: { pp_ids: [ppId] } });
        return response.data;
    },
    syncParties: async (projectId, payload) => {
        const response = await api.put(`/projects/${projectId}/parties/sync`, payload);
        return response.data;
    },

    // ---- ORGANIZATION CHART ----
    getOrgChart: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/org`);
        return response.data;
    },

    // ---- MEETINGS (Unified Agenda & MoM) ----
    getMeetings: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/meetings`);
        return response.data;
    },
    getMeeting: async (projectId, meetingId) => {
        const response = await api.get(`/projects/${projectId}/meetings/${meetingId}`);
        return response.data;
    },
    createMeeting: async (projectId, data) => {
        const response = await api.post(`/projects/${projectId}/meetings`, data);
        return response.data;
    },
    updateMeeting: async (projectId, meetingId, data) => {
        const response = await api.put(`/projects/${projectId}/meetings/${meetingId}`, data);
        return response.data;
    },
    deleteMeeting: async (projectId, meetingId) => {
        const response = await api.delete(`/projects/${projectId}/meetings/${meetingId}`);
        return response.data;
    }
};
