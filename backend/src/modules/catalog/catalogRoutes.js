import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as catalogController from './catalogController.js';

const router = express.Router();

// All production catalog endpoints require authenticated user context
router.use((req, res, next) => {
    if (process.env.NODE_ENV === 'test' && req.headers['x-test-user']) {
        try {
            req.user = JSON.parse(req.headers['x-test-user']);
            return next();
        } catch (_) {}
    }
    return authenticateJWT(req, res, next);
});

// ─── 1. Units & Conversions ──────────────────────────────────────────────────
router.get('/units', catalogController.listUnits);
router.post('/units', catalogController.createUnit);
router.put('/units/:id', catalogController.updateUnit);
router.get('/convert', catalogController.convertUnits);
router.post('/units/convert', catalogController.convertUnits); // Compatibility alias

// ─── 2. Resources ────────────────────────────────────────────────────────────
router.get('/resources', catalogController.listResources);
router.post('/resources', catalogController.createResource);
router.get('/resources/:id', catalogController.getResource);
router.put('/resources/:id', catalogController.updateResource);
router.delete('/resources/:id', catalogController.deleteResource);
router.post('/resources/:id/archive', catalogController.archiveResource);
router.post('/resources/:id/restore', catalogController.restoreResource);

// Resource Conversions
router.get('/resources/:id/conversions', catalogController.listConversions);
router.post('/resources/:id/conversions', catalogController.setConversion);
router.delete('/resources/:id/conversions', catalogController.removeConversion);
router.delete('/resources/:id/conversions/:conversionId', catalogController.removeConversion);
router.delete('/conversions/:conversionId', catalogController.removeConversion);

// ─── 3. Rates ────────────────────────────────────────────────────────────────
router.get('/resources/:id/rates', catalogController.listRates);
router.post('/resources/:id/rates', catalogController.setRate);
router.get('/resources/:id/rate', catalogController.getRate);
router.put('/rates/:id', catalogController.correctRate);
router.delete('/rates/:id', catalogController.removeRate);
// Compatibility aliases with :rateId
router.put('/rates/:rateId', catalogController.correctRate);
router.delete('/rates/:rateId', catalogController.removeRate);

// ─── 4. Activities ───────────────────────────────────────────────────────────
router.get('/activities', catalogController.listActivities);
router.post('/activities', catalogController.createActivity);
router.get('/activities/:id', catalogController.getActivity);
router.put('/activities/:id', catalogController.updateActivity);
router.delete('/activities/:id', catalogController.deleteActivity);
router.post('/activities/:id/archive', catalogController.archiveActivity);
router.post('/activities/:id/restore', catalogController.restoreActivity);

// ─── 5. Norms ────────────────────────────────────────────────────────────────
router.get('/activities/:id/norms', catalogController.getNorms);
router.post('/activities/:id/norms', catalogController.setNorm);
router.put('/norms/:id', catalogController.correctNorm);
router.delete('/norms/:id', catalogController.removeNorm);
// Compatibility aliases with :normId
router.put('/norms/:normId', catalogController.correctNorm);
router.delete('/norms/:normId', catalogController.removeNorm);

// ─── 6. Computation ──────────────────────────────────────────────────────────
router.get('/activities/:id/cost', catalogController.computeActivityCost);
router.get('/activities/:id/expected-usage', catalogController.expectedUsage);

// ─── 7. Import and Sync ──────────────────────────────────────────────────────
router.post('/projects/:projectId/import/resources', catalogController.importResourceToProject);
router.post('/projects/:projectId/import/activities', catalogController.importActivityToProject);

// Resource sync routes
router.get('/resources/:id/sync', catalogController.getResourceSyncStatus);
router.get('/resources/:id/sync/diff', catalogController.getResourceSyncDiff);
router.post('/resources/:id/sync/accept', catalogController.acceptResourceSync);
router.get('/resources/:id/sync-status', catalogController.getResourceSyncStatus);
router.get('/resources/:id/sync-diff', catalogController.getResourceSyncDiff);
router.post('/resources/:id/sync-accept', catalogController.acceptResourceSync);

// Activity sync routes
router.get('/activities/:id/sync', catalogController.getActivitySyncStatus);
router.get('/activities/:id/sync/diff', catalogController.getActivitySyncDiff);
router.post('/activities/:id/sync/accept', catalogController.acceptActivitySync);
router.get('/activities/:id/sync-status', catalogController.getActivitySyncStatus);
router.get('/activities/:id/sync-diff', catalogController.getActivitySyncDiff);
router.post('/activities/:id/sync-accept', catalogController.acceptActivitySync);

// ─── 8. Housekeeping ─────────────────────────────────────────────────────────
router.get('/change-log', catalogController.getChangeLog);
router.get('/changelog/:entity/:id', catalogController.getChangeLog);
router.get('/integrity', catalogController.checkIntegrity);

export default router;
