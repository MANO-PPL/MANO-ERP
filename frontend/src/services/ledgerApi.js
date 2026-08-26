import api from './api';

export const ledgerApi = {
    // ─── Transaction Lifecycle ────────────────────────────────────────────────
    getTransactions: async (params = {}) => {
        const res = await api.get('/ledger/transactions', { params });
        return res.data;
    },

    listTransactions: async (params = {}) => {
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

    // ─── Ledger & Inventory Queries ───────────────────────────────────────────
    getPartyResourcePosition: async (partyId, projectResourceId, projectId, orgId) => {
        const res = await api.get('/ledger/party-position', {
            params: { party_id: partyId, project_resource_id: projectResourceId, project_id: projectId, org_id: orgId }
        });
        return res.data;
    },

    getPartyPositions: async (projectId, partyId, orgId) => {
        const res = await api.get('/ledger/party-position', {
            params: { party_id: partyId, project_id: projectId, org_id: orgId }
        });
        return res.data;
    },

    getPartyLedger: async (partyId, projectId, orgId) => {
        const res = await api.get(`/ledger/party-ledger/${partyId}`, {
            params: { project_id: projectId, org_id: orgId }
        });
        return res.data;
    },

    getPartyStatement: async (projectId, partyId, orgId) => {
        const res = await api.get(`/ledger/party-ledger/${partyId}`, {
            params: { project_id: projectId, org_id: orgId }
        });
        return res.data;
    },

    getProjectStock: async (projectId, orgId) => {
        const res = await api.get('/ledger/transactions', {
            params: { project_id: projectId, status: 'CONFIRMED', org_id: orgId }
        });
        const txns = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        const stockMap = {};
        txns.forEach(txn => {
            (txn.lines || []).forEach(l => {
                const key = `${l.party_id}_${l.project_resource_id}`;
                stockMap[key] = (stockMap[key] || 0) + Number(l.signed_qty || 0);
            });
        });
        const data = Object.entries(stockMap).map(([key, net_qty]) => {
            const [party_id, project_resource_id] = key.split('_');
            return { party_id: Number(party_id), project_resource_id: Number(project_resource_id), net_qty };
        });
        return { status: 'success', data };
    },

    // ─── Project Party Directory ──────────────────────────────────────────────
    getProjectParties: async (projectId) => {
        const res = await api.get(`/ledger/project-parties/${projectId}`);
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
    }
};

export default ledgerApi;
