import api from './api';

const isValidId = (id) => Boolean(id && !String(id).startsWith('temp_') && !isNaN(Number(id)));

/**
 * Shared REST API client factory for party-scoped resources (clients / vendors / all).
 */
export function createPartyApi(partyType) {
    const typeParam = partyType ? { party_type: partyType } : {};
    const bulkKey = partyType === 'client' ? 'clients' : partyType === 'vendor' ? 'vendors' : 'parties';

    return {
        list: async (params = {}) => {
            const response = await api.get('/parties', { params: { ...params, ...typeParam } });
            return response.data;
        },
        getById: async (id) => {
            if (!isValidId(id)) return null;
            const response = await api.get(`/parties/${id}`, { params: typeParam });
            return response.data;
        },
        create: async (data) => {
            const response = await api.post('/parties', { ...data, ...typeParam });
            return response.data;
        },
        update: async (id, data) => {
            if (!isValidId(id)) return null;
            const response = await api.put(`/parties/${id}`, { ...data, ...typeParam });
            return response.data;
        },
        remove: async (id, reason = null) => {
            if (!isValidId(id)) return null;
            if (partyType === 'vendor') {
                const response = await api.delete('/parties', { params: typeParam, data: { ids: [id], reason } });
                return response.data;
            }
            const response = await api.delete(`/parties/${id}`, { params: typeParam, data: { reason } });
            return response.data;
        },
        removeMany: async (ids, reason = null) => {
            const response = await api.delete('/parties', { params: typeParam, data: { ids, reason } });
            return response.data;
        },
        bulkCreate: async (rows) => {
            const response = await api.post('/parties/bulk-json', { [bulkKey]: rows }, { params: typeParam });
            return response.data;
        },
        batchSave: async (payload) => {
            const response = await api.post('/parties/batch-save', payload, { params: typeParam });
            return response.data;
        },
        archive: async (id, reason = null) => {
            const response = await api.post(`/parties/${id}/archive`, { reason }, { params: typeParam });
            return response.data;
        },
        restore: async (id, reason = null) => {
            const response = await api.post(`/parties/${id}/restore`, { reason }, { params: typeParam });
            return response.data;
        },
        getChangeLog: async (id) => {
            const response = await api.get(`/parties/${id}/changelog`);
            return response.data;
        },
        listContacts: async (id) => {
            const response = await api.get(`/parties/${id}/contacts`);
            return response.data;
        },
        addContact: async (id, data) => {
            const response = await api.post(`/parties/${id}/contacts`, data);
            return response.data;
        },
        updateContact: async (id, personId, data) => {
            const response = await api.put(`/parties/${id}/contacts/${personId}`, data);
            return response.data;
        },
        setPrimaryContact: async (id, personId) => {
            const response = await api.patch(`/parties/${id}/contacts/${personId}/primary`);
            return response.data;
        },
        deleteContact: async (id, personId, reason = null) => {
            const response = await api.delete(`/parties/${id}/contacts/${personId}`, { data: { reason } });
            return response.data;
        }
    };
}

export default createPartyApi('all');
