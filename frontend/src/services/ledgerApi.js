import api from './api';

export const ledgerApi = {
    // ─── Transaction Lifecycle ────────────────────────────────────────────────
    getTransactions: async (params = {}) => {
        const res = await api.get('/ledger/transactions', { params });
        return res.data;
    },

    getTransaction: async (id) => {
        const res = await api.get(`/ledger/transactions/${id}`);
        return res.data;
    },

    createTransaction: async (data) => {
        const res = await api.post('/ledger/transactions', data);
        return res.data;
    },

    confirmTransaction: async (id) => {
        const res = await api.post(`/ledger/transactions/${id}/confirm`);
        return res.data;
    },

    cancelTransaction: async (id) => {
        const res = await api.post(`/ledger/transactions/${id}/cancel`);
        return res.data;
    },

    // ─── Ledger Queries ───────────────────────────────────────────────────────
    getPartyResourcePosition: async (partyId, projectResourceId, projectId, orgId) => {
        const res = await api.get('/ledger/party-position', {
            params: { party_id: partyId, project_resource_id: projectResourceId, project_id: projectId, org_id: orgId }
        });
        return res.data;
    },

    getPartyLedger: async (partyId, projectId, orgId) => {
        const res = await api.get(`/ledger/party-ledger/${partyId}`, {
            params: { project_id: projectId, org_id: orgId }
        });
        return res.data;
    },

    // ─── Project Vendor Directory ─────────────────────────────────────────────
    // Returns active vendors for a project (pdoc_vendors JOIN crm_contacts).
    // pv_id from this response is used as party_id in transaction lines.
    getProjectVendors: async (projectId) => {
        const res = await api.get(`/ledger/project-vendors/${projectId}`);
        return res.data;
    },

    // ─── Action Integration Endpoints ─────────────────────────────────────────
    assignSupply: async (data) => {
        const res = await api.post('/ledger/assign-supply', data);
        return res.data;
    },

    transferParty: async (data) => {
        const res = await api.post('/ledger/transfer-party', data);
        return res.data;
    },

    // NOTE: consumeActivity and recordAdjustment are disabled — pending activity module integration
};
