import api from './api';

export const workflowApi = {
    // Get optimized workflow status for a template in a project in a single call
    getTemplateWorkflowStatus: async (projectId, templateName, instanceId) => {
        const response = await api.get(`/v1/instances/project/${projectId}/template-status`, { params: { template_name: templateName, instance_id: instanceId } });
        return response.data;
    },

    // List document templates (can optionally filter by project_id)
    getTemplates: async (projectId) => {
        const response = await api.get('/v1/documents', { params: { project_id: projectId } });
        return response.data;
    },

    // Get a single template detail (includes approval_levels and document_roles)
    getTemplate: async (documentId) => {
        const response = await api.get(`/v1/documents/${documentId}`);
        return response.data;
    },

    // Create a new document template
    createTemplate: async (data) => {
        const response = await api.post('/v1/documents', data);
        return response.data;
    },

    // Update template metadata (e.g. name, description, active status)
    updateTemplate: async (documentId, data) => {
        const response = await api.put(`/v1/documents/${documentId}`, data);
        return response.data;
    },

    // Add an approval level to a template
    addLevel: async (documentId, data) => {
        const response = await api.post(`/v1/documents/${documentId}/levels`, data);
        return response.data;
    },

    // Remove an approval level from a template
    removeLevel: async (documentId, levelId) => {
        const response = await api.delete(`/v1/documents/${documentId}/levels/${levelId}`);
        return response.data;
    },

    // Assign a document role to a user
    assignRole: async (documentId, data) => {
        const response = await api.post(`/v1/documents/${documentId}/roles`, data);
        return response.data;
    },

    // Remove a document role from a user
    removeRole: async (documentId, roleId) => {
        const response = await api.delete(`/v1/documents/${documentId}/roles/${roleId}`);
        return response.data;
    },

    // ─── Document Instance APIs ─────────────────────────────────────────────
    listProjectInstances: async (projectId, params) => {
        const response = await api.get(`/projects/${projectId}/instances`, { params });
        return response.data;
    },
    createInstance: async (projectId, data) => {
        const response = await api.post(`/projects/${projectId}/instances`, data);
        return response.data;
    },
    getInstance: async (instanceId) => {
        const response = await api.get(`/v1/instances/${instanceId}`);
        return response.data;
    },
    archiveInstance: async (instanceId) => {
        const response = await api.patch(`/v1/instances/${instanceId}/archive`);
        return response.data;
    },
    getApprovedContent: async (instanceId, versionId) => {
        const url = versionId ? `/v1/instances/${instanceId}/versions/${versionId}` : `/v1/instances/${instanceId}/content`;
        const response = await api.get(url);
        return response.data;
    },
    getDraftContent: async (instanceId) => {
        const response = await api.get(`/v1/instances/${instanceId}/draft`);
        return response.data;
    },
    listVersions: async (instanceId) => {
        const response = await api.get(`/v1/instances/${instanceId}/versions`);
        return response.data;
    },
    initiateCycle: async (instanceId) => {
        const response = await api.post(`/v1/instances/${instanceId}/cycles`);
        return response.data;
    },
    listCycles: async (instanceId) => {
        const response = await api.get(`/v1/instances/${instanceId}/cycles`);
        return response.data;
    },
    getInstanceLogs: async (instanceId) => {
        const response = await api.get(`/v1/instances/${instanceId}/logs`);
        return response.data;
    },

    // ─── Approval Cycle Action APIs ─────────────────────────────────────────
    getCycle: async (cycleId) => {
        const response = await api.get(`/v1/cycles/${cycleId}`);
        return response.data;
    },
    saveDraft: async (cycleId, content = {}) => {
        const response = await api.patch(`/v1/cycles/${cycleId}/draft`, { content });
        return response.data;
    },
    saveDraftContent: async (cycleId, content = {}) => {
        const response = await api.patch(`/v1/cycles/${cycleId}/draft`, { content });
        return response.data;
    },
    submitDraft: async (cycleId, data) => {
        const response = await api.post(`/v1/cycles/${cycleId}/submit`, data);
        return response.data;
    },
    requestRevision: async (cycleId, comments) => {
        const response = await api.post(`/v1/cycles/${cycleId}/request-revision`, { comments });
        return response.data;
    },
    rejectCycle: async (cycleId, comments) => {
        const response = await api.post(`/v1/cycles/${cycleId}/reject`, { comments });
        return response.data;
    },
    cancelCycle: async (cycleId, comments) => {
        const response = await api.post(`/v1/cycles/${cycleId}/cancel`, { comments });
        return response.data;
    },
    claimRevision: async (cycleId) => {
        const response = await api.post(`/v1/cycles/${cycleId}/claim`);
        return response.data;
    },

    // ─── Cycle Content Write APIs (Draft Mode) ──────────────────────────────
    addDirectoryDraft: async (cycleId, data) => {
        const response = await api.post(`/v1/cycles/${cycleId}/directory`, data);
        return response.data;
    },
    updateDirectoryDraft: async (cycleId, pdId, data) => {
        const response = await api.put(`/v1/cycles/${cycleId}/directory/${pdId}`, data);
        return response.data;
    },
    deleteDirectoryDraft: async (cycleId, pdId) => {
        const response = await api.delete(`/v1/cycles/${cycleId}/directory/${pdId}`);
        return response.data;
    },
    addVendorDraft: async (cycleId, data) => {
        const response = await api.post(`/v1/cycles/${cycleId}/vendors`, data);
        return response.data;
    },
    deleteVendorDraft: async (cycleId, pvId) => {
        const response = await api.delete(`/v1/cycles/${cycleId}/vendors/${pvId}`);
        return response.data;
    },
    updateAgendaDraft: async (cycleId, data) => {
        const response = await api.put(`/v1/cycles/${cycleId}/agenda`, data);
        return response.data;
    },
    addAgendaParticipantDraft: async (cycleId, pdId) => {
        const response = await api.post(`/v1/cycles/${cycleId}/agenda/participants`, { pd_id: pdId });
        return response.data;
    },
    removeAgendaParticipantDraft: async (cycleId, papId) => {
        const response = await api.delete(`/v1/cycles/${cycleId}/agenda/participants/${papId}`);
        return response.data;
    },
    updateMomDraft: async (cycleId, data) => {
        const response = await api.put(`/v1/cycles/${cycleId}/mom`, data);
        return response.data;
    },
    addMomParticipantDraft: async (cycleId, pdId) => {
        const response = await api.post(`/v1/cycles/${cycleId}/mom/participants`, { pd_id: pdId });
        return response.data;
    },
    removeMomParticipantDraft: async (cycleId, pmpId) => {
        const response = await api.delete(`/v1/cycles/${cycleId}/mom/participants/${pmpId}`);
        return response.data;
    },
    // Staff Roles Draft APIs
    addStaffDraft: async (cycleId, data) => {
        const response = await api.post(`/v1/cycles/${cycleId}/staff`, data);
        return response.data;
    },
    updateStaffDraft: async (cycleId, psrrId, data) => {
        const response = await api.put(`/v1/cycles/${cycleId}/staff/${psrrId}`, data);
        return response.data;
    },
    deleteStaffDraft: async (cycleId, psrrId) => {
        const response = await api.delete(`/v1/cycles/${cycleId}/staff/${psrrId}`);
        return response.data;
    },
    // Project Summary Draft APIs
    addSummaryDraft: async (cycleId, data) => {
        const response = await api.post(`/v1/cycles/${cycleId}/summary`, data);
        return response.data;
    },
    updateSummaryDraft: async (cycleId, id, data) => {
        const response = await api.put(`/v1/cycles/${cycleId}/summary/${id}`, data);
        return response.data;
    },
    deleteSummaryDraft: async (cycleId, id) => {
        const response = await api.delete(`/v1/cycles/${cycleId}/summary/${id}`);
        return response.data;
    }
};

export default workflowApi;
