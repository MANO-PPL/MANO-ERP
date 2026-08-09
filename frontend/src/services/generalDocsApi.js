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

    // ---- STAFF ROLES ----
    getStaff: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/staff`);
        return response.data;
    },
    addStaff: async (projectId, itemData) => {
        const response = await api.post(`/projects/${projectId}/staff`, itemData);
        return response.data;
    },
    updateStaff: async (projectId, psrrId, itemData) => {
        const response = await api.put(`/projects/${projectId}/staff/${psrrId}`, itemData);
        return response.data;
    },
    deleteStaff: async (projectId, psrrId) => {
        const response = await api.delete(`/projects/${projectId}/staff/${psrrId}`);
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

    // ---- ORGANIZATION CHART ----
    getOrgChart: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/org`);
        return response.data;
    },

    // ---- AGENDAS ----
    getAgendas: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/agendas`);
        return response.data;
    },
    getAgenda: async (projectId, agendaId) => {
        const response = await api.get(`/projects/${projectId}/agendas/${agendaId}`);
        return response.data;
    },
    createAgenda: async (projectId, data) => {
        const response = await api.post(`/projects/${projectId}/agendas`, data);
        return response.data;
    },
    updateAgenda: async (projectId, agendaId, data) => {
        const response = await api.put(`/projects/${projectId}/agendas/${agendaId}`, data);
        return response.data;
    },
    deleteAgenda: async (projectId, agendaId) => {
        const response = await api.delete(`/projects/${projectId}/agendas/${agendaId}`);
        return response.data;
    },

    // ---- MINUTES OF MEETING ----
    getMoms: async (projectId) => {
        const response = await api.get(`/projects/${projectId}/moms`);
        return response.data;
    },
    getMom: async (projectId, momId) => {
        const response = await api.get(`/projects/${projectId}/moms/${momId}`);
        return response.data;
    },
    createMom: async (projectId, data) => {
        const response = await api.post(`/projects/${projectId}/moms`, data);
        return response.data;
    },
    updateMom: async (projectId, momId, data) => {
        const response = await api.put(`/projects/${projectId}/moms/${momId}`, data);
        return response.data;
    },
    deleteMom: async (projectId, momId) => {
        const response = await api.delete(`/projects/${projectId}/moms/${momId}`);
        return response.data;
    },

};
