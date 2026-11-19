import api from './api';

/**
 * Catalog API Service
 * Encapsulates all backend endpoints under /api/catalog/* for Module 2 Catalog.
 * Never sends orgId from the client; orgId is injected by server auth middleware.
 */

export const catalogApi = {
    // ─── 1. Units & Conversions ──────────────────────────────────────────────
    async listUnits() {
        const res = await api.get('/catalog/units');
        return res.data?.data || [];
    },

    async createUnit(payload) {
        const res = await api.post('/catalog/units', payload);
        return res.data?.data;
    },

    async updateUnit(id, payload) {
        const res = await api.put(`/catalog/units/${id}`, payload);
        return res.data?.data;
    },

    async deleteUnit(id) {
        const res = await api.delete(`/catalog/units/${id}`);
        return res.data?.data;
    },

    async convertUnits({ qty, from, to, resourceId }) {
        const params = { qty, from, to };
        if (resourceId) params.resourceId = resourceId;
        const res = await api.get('/catalog/convert', { params });
        return res.data?.data?.result;
    },

    // ─── 2. Resources ────────────────────────────────────────────────────────
    async listResources({ scope, projectId, kind, status, q } = {}) {
        const params = {};
        if (scope) params.scope = scope;
        if (projectId !== undefined && projectId !== null && projectId !== '') {
            params.projectId = projectId;
        } else if (scope === 'master') {
            params.scope = 'master';
        }
        if (kind && kind !== 'all') params.kind = kind;
        if (status && status !== 'all') params.status = status;
        if (q && q.trim()) params.q = q.trim();

        const res = await api.get('/catalog/resources', { params });
        return res.data?.data || [];
    },

    async getResource(id) {
        const res = await api.get(`/catalog/resources/${id}`);
        return res.data?.data;
    },

    async createResource(payload) {
        const res = await api.post('/catalog/resources', payload);
        return res.data?.data;
    },

    async updateResource(id, payload) {
        const res = await api.put(`/catalog/resources/${id}`, payload);
        return res.data?.data;
    },

    async archiveResource(id, reason) {
        const res = await api.post(`/catalog/resources/${id}/archive`, { reason });
        return res.data?.data;
    },

    async restoreResource(id, reason) {
        const res = await api.post(`/catalog/resources/${id}/restore`, { reason });
        return res.data?.data;
    },

    async deleteResource(id, reason) {
        const res = await api.delete(`/catalog/resources/${id}`, { data: { reason } });
        return res.data?.data;
    },

    // ─── 3. Resource Conversions ─────────────────────────────────────────────
    async listConversions(resourceId) {
        const res = await api.get(`/catalog/resources/${resourceId}/conversions`);
        return res.data?.data || [];
    },

    async listResourceConversions(resourceId) {
        return this.listConversions(resourceId);
    },

    async setConversion(resourceId, { fromUnitId, toUnitId, factor, reason }) {
        const res = await api.post(`/catalog/resources/${resourceId}/conversions`, {
            fromUnitId,
            toUnitId,
            factor,
            reason
        });
        return res.data?.data;
    },

    async removeConversion(conversionId, reason) {
        const res = await api.delete(`/catalog/conversions/${conversionId}`, { data: { reason } });
        return res.data?.data;
    },

    // ─── 4. Effective-Dated Rates ────────────────────────────────────────────
    async listRates(resourceId) {
        const res = await api.get(`/catalog/resources/${resourceId}/rates`);
        return res.data?.data || [];
    },

    async getRate(resourceId, date, inUnit) {
        const params = {};
        if (date) params.date = date;
        if (inUnit) params.inUnit = inUnit;
        const res = await api.get(`/catalog/resources/${resourceId}/rate`, { params });
        return res.data?.data || null;
    },

    async setRate(resourceId, { rate, unitId, effectiveFrom, note }) {
        const res = await api.post(`/catalog/resources/${resourceId}/rates`, {
            rate,
            unitId,
            effectiveFrom,
            note
        });
        return res.data?.data;
    },

    async correctRate(rateId, { patch, reason, rate, effectiveFrom, effectiveTo, note }) {
        const payload = {
            patch: patch || { rate, effectiveFrom, effectiveTo, note },
            reason
        };
        const res = await api.put(`/catalog/rates/${rateId}`, payload);
        return res.data?.data;
    },

    async removeRate(rateId, reason) {
        const res = await api.delete(`/catalog/rates/${rateId}`, { data: { reason } });
        return res.data?.data;
    },

    // ─── 5. Activities ───────────────────────────────────────────────────────
    async listActivities({ scope, projectId, status, q } = {}) {
        const params = {};
        if (scope) params.scope = scope;
        if (projectId !== undefined && projectId !== null && projectId !== '') {
            params.projectId = projectId;
        } else if (scope === 'master') {
            params.scope = 'master';
        }
        if (status && status !== 'all') params.status = status;
        if (q && q.trim()) params.q = q.trim();

        const res = await api.get('/catalog/activities', { params });
        return res.data?.data || [];
    },

    async getActivity(id) {
        const res = await api.get(`/catalog/activities/${id}`);
        return res.data?.data;
    },

    async createActivity(payload) {
        const res = await api.post('/catalog/activities', payload);
        return res.data?.data;
    },

    async updateActivity(id, payload) {
        const res = await api.put(`/catalog/activities/${id}`, payload);
        return res.data?.data;
    },

    async archiveActivity(id, reason) {
        const res = await api.post(`/catalog/activities/${id}/archive`, { reason });
        return res.data?.data;
    },

    async restoreActivity(id, reason) {
        const res = await api.post(`/catalog/activities/${id}/restore`, { reason });
        return res.data?.data;
    },

    async deleteActivity(id, reason) {
        const res = await api.delete(`/catalog/activities/${id}`, { data: { reason } });
        return res.data?.data;
    },

    // ─── 6. Composition Norms ────────────────────────────────────────────────
    async getNorms(activityId, date) {
        const params = {};
        if (date) params.date = date;
        const res = await api.get(`/catalog/activities/${activityId}/norms`, { params });
        return res.data?.data || [];
    },

    async setNorm(activityId, { resourceId, qtyPerUnit, unitId, effectiveFrom, note, wastagePct }) {
        const res = await api.post(`/catalog/activities/${activityId}/norms`, {
            resourceId,
            qtyPerUnit,
            unitId,
            effectiveFrom,
            note,
            wastagePct
        });
        return res.data?.data;
    },

    async correctNorm(normId, { patch, reason, qtyPerUnit, unitId, effectiveFrom, effectiveTo, note, wastagePct }) {
        const payload = {
            patch: patch || { qtyPerUnit, unitId, effectiveFrom, effectiveTo, note, wastagePct },
            reason
        };
        const res = await api.put(`/catalog/norms/${normId}`, payload);
        return res.data?.data;
    },

    async removeNorm(normId, reason) {
        const res = await api.delete(`/catalog/norms/${normId}`, { data: { reason } });
        return res.data?.data;
    },

    // ─── 7. Dynamic Computation ──────────────────────────────────────────────
    async computeActivityCost(activityId, date) {
        const params = {};
        if (date) params.date = date;
        const res = await api.get(`/catalog/activities/${activityId}/cost`, { params });
        return res.data?.data;
    },

    async expectedUsage(activityId, qty, date) {
        const params = { qty: qty ?? 1 };
        if (date) params.date = date;
        const res = await api.get(`/catalog/activities/${activityId}/expected-usage`, { params });
        return res.data?.data;
    },

    async getExpectedUsage(activityId, qty, date) {
        return this.expectedUsage(activityId, qty, date);
    },

    // ─── 8. Import & Sync ────────────────────────────────────────────────────
    async importResourceToProject(projectId, masterId, options = {}) {
        const res = await api.post(`/catalog/projects/${projectId}/import/resources`, {
            masterId,
            options
        });
        return res.data?.data;
    },

    async importActivityToProject(projectId, masterId, options = {}) {
        const res = await api.post(`/catalog/projects/${projectId}/import/activities`, {
            masterId,
            options
        });
        return res.data?.data;
    },

    async getResourceSyncStatus(id) {
        const res = await api.get(`/catalog/resources/${id}/sync`);
        return res.data?.data;
    },

    async getResourceSyncDiff(id) {
        const res = await api.get(`/catalog/resources/${id}/sync/diff`);
        return res.data?.data;
    },

    async acceptResourceSync(id, selection, reason) {
        const res = await api.post(`/catalog/resources/${id}/sync/accept`, {
            selection,
            reason
        });
        return res.data?.data;
    },

    async getActivitySyncStatus(id) {
        const res = await api.get(`/catalog/activities/${id}/sync`);
        return res.data?.data;
    },

    async getActivitySyncDiff(id) {
        const res = await api.get(`/catalog/activities/${id}/sync/diff`);
        return res.data?.data;
    },

    async acceptActivitySync(id, selection, reason) {
        const res = await api.post(`/catalog/activities/${id}/sync/accept`, {
            selection,
            reason
        });
        return res.data?.data;
    },

    // ─── 9. Audit Change Log ─────────────────────────────────────────────────
    async getChangeLog(entity, id) {
        const res = await api.get('/catalog/change-log', {
            params: { entity, id }
        });
        return res.data?.data || [];
    },

    // ─── 10. Projects Helper (for project scope picker) ──────────────────────
    async listProjects() {
        const res = await api.get('/projects', { params: { limit: 1000 } });
        return res.data?.projects || [];
    }
};

export default catalogApi;

