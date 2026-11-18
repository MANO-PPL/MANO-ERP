/**
 * In-memory client cache for Catalog data (resources, rates, activities, units).
 * Eliminates redundant HTTP roundtrips on tab switches and filtering.
 */

const ratesCache = new Map(); // key: `${resourceId}_${date}` -> rateData
const resourcesCache = new Map(); // key: `${scope}_${projectId}` -> Array<resource>
const activitiesCache = new Map(); // key: `${scope}_${projectId}` -> Array<activity>

export const catalogCache = {
    // Rates
    getRate(resourceId, date) {
        return ratesCache.get(`${resourceId}_${date}`);
    },
    setRate(resourceId, date, data) {
        ratesCache.set(`${resourceId}_${date}`, data);
    },
    invalidateRate(resourceId) {
        for (const key of ratesCache.keys()) {
            if (key.startsWith(`${resourceId}_`)) {
                ratesCache.delete(key);
            }
        }
    },
    clearRates() {
        ratesCache.clear();
    },

    // Resources
    getResources(scope, projectId) {
        return resourcesCache.get(`${scope}_${projectId || 'null'}`);
    },
    setResources(scope, projectId, data) {
        resourcesCache.set(`${scope}_${projectId || 'null'}`, data);
    },
    invalidateResources(scope, projectId) {
        resourcesCache.delete(`${scope}_${projectId || 'null'}`);
    },

    // Activities
    getActivities(scope, projectId) {
        return activitiesCache.get(`${scope}_${projectId || 'null'}`);
    },
    setActivities(scope, projectId, data) {
        activitiesCache.set(`${scope}_${projectId || 'null'}`, data);
    },
    invalidateActivities(scope, projectId) {
        activitiesCache.delete(`${scope}_${projectId || 'null'}`);
    },

    // Clear all
    clearAll() {
        ratesCache.clear();
        resourcesCache.clear();
        activitiesCache.clear();
    }
};

export default catalogCache;
