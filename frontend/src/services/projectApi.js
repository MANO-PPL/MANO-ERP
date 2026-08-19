import api from './api';

const unwrap = (request) => request.then(({ data }) => data);

export const projectApi = {
    listProjects: () => unwrap(api.get('/projects')),

    getProject: (id) => unwrap(api.get(`/projects/${id}`)),

    createProject: (projectData) => unwrap(api.post('/projects', projectData)),

    updateProject: (id, projectData) => unwrap(api.put(`/projects/${id}`, projectData)),

    getProjectMembers: (id) => unwrap(api.get(`/projects/${id}/members`)),

    assignProjectMember: (id, memberData) => unwrap(api.post(`/projects/${id}/members`, memberData)),

    removeProjectMember: (id, userId) => unwrap(api.delete(`/projects/${id}/members/${userId}`)),

    uploadProjectLogo: async (id, file) => {
        const formData = new FormData();
        formData.append('logo', file);
        return unwrap(api.post(`/projects/${id}/logo`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }));
    },

    listProjectResources: (projectId) => unwrap(api.get(`/projects/${projectId}/resources`)),

    getResolvedResourceRates: (projectId, resourceIds, date) => {
        const ids = [...new Set((resourceIds || []).map(Number).filter(Number.isInteger))];
        if (ids.length === 0) return Promise.resolve({ rates: [] });
        return unwrap(api.get(`/projects/${projectId}/resources/rates`, {
            params: { ids: ids.join(','), ...(date ? { date } : {}) }
        }));
    },

    removeProjectResource: (projectId, resourceId) => unwrap(api.delete(`/projects/${projectId}/resources/${resourceId}`)),

    importResource: (projectId, resourceId, effectiveFrom) => unwrap(api.post(`/projects/${projectId}/resources/${resourceId}/import`, {
            effective_from: effectiveFrom
        })),

    importResourcesBatch: (projectId, resourceIds, effectiveFrom) => unwrap(api.post(`/projects/${projectId}/resources/import-batch`, {
            resourceIds,
            effective_from: effectiveFrom
        })),

    getResolvedResourceRate: (projectId, resourceId, date) => unwrap(api.get(`/projects/${projectId}/resources/${resourceId}/rate`, {
            params: date ? { date } : undefined
        })),

    addResourceRate: (projectId, resourceId, data) => unwrap(api.post(`/projects/${projectId}/resources/${resourceId}/rates`, data)),

    updateResourceRate: (projectId, resourceId, rateId, data) => unwrap(api.put(`/projects/${projectId}/resources/${resourceId}/rates/${rateId}`, data)),

    getResourceRateHistory: (projectId, resourceId) => unwrap(api.get(`/projects/${projectId}/resources/${resourceId}/rates`)),

    clearResourceRate: (projectId, resourceId, effectiveFrom, mode = null) => unwrap(api.post(`/projects/${projectId}/resources/${resourceId}/clear-rate`, {
            effective_from: effectiveFrom,
            mode
        })),

    setProjectCompositions: (projectId, resourceId, compositions, effectiveFrom) => unwrap(api.put(`/projects/${projectId}/resources/${resourceId}/compositions`, {
            compositions,
            effective_from: effectiveFrom
        })),

    getProjectCompositionHistory: (projectId, resourceId) => unwrap(api.get(`/projects/${projectId}/resources/${resourceId}/compositions`))
};
