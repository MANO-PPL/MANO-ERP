import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as catalogController from './catalogController.js';

const router = express.Router();

// Core Production Catalog Routes: All require standard user authentication
router.use(authenticateJWT);

// Units & Conversions
router.get('/units', catalogController.listUnits);
router.post('/units', catalogController.createUnit);
router.put('/units/:id', catalogController.updateUnit);
router.post('/units/convert', catalogController.convertUnits);

// Resources
router.get('/resources', catalogController.listResources);
router.post('/resources', catalogController.createResource);
router.post('/resources/import', catalogController.importResource);
router.get('/resources/:id', catalogController.getResource);
router.put('/resources/:id', catalogController.updateResource);
router.delete('/resources/:id', catalogController.deleteResource);
router.post('/resources/:id/archive', catalogController.archiveResource);
router.post('/resources/:id/restore', catalogController.restoreResource);
router.get('/resources/:id/sync-status', catalogController.getResourceSyncStatus);
router.get('/resources/:id/sync-diff', catalogController.getResourceSyncDiff);
router.post('/resources/:id/sync-accept', catalogController.acceptResourceSync);

// Per-resource conversions
router.get('/resources/:id/conversions', catalogController.listConversions);
router.post('/resources/:id/conversions', catalogController.setConversion);
router.delete('/conversions/:conversionId', catalogController.removeConversion);

// Rates
router.get('/resources/:id/rates', catalogController.listRates);
router.get('/resources/:id/rate', catalogController.getRate);
router.post('/resources/:id/rates', catalogController.setRate);
router.put('/rates/:rateId', catalogController.correctRate);
router.delete('/rates/:rateId', catalogController.removeRate);

// Activities & Norms
router.get('/activities', catalogController.listActivities);
router.post('/activities', catalogController.createActivity);
router.post('/activities/import', catalogController.importActivity);
router.get('/activities/:id', catalogController.getActivity);
router.put('/activities/:id', catalogController.updateActivity);
router.delete('/activities/:id', catalogController.deleteActivity);
router.post('/activities/:id/archive', catalogController.archiveActivity);
router.post('/activities/:id/restore', catalogController.restoreActivity);
router.get('/activities/:id/sync-status', catalogController.getActivitySyncStatus);
router.get('/activities/:id/sync-diff', catalogController.getActivitySyncDiff);
router.post('/activities/:id/sync-accept', catalogController.acceptActivitySync);

router.get('/activities/:id/norms', catalogController.getNorms);
router.post('/activities/:id/norms', catalogController.setNorm);
router.put('/norms/:normId', catalogController.correctNorm);
router.delete('/norms/:normId', catalogController.removeNorm);

// Computation
router.get('/activities/:id/cost', catalogController.computeActivityCost);
router.get('/activities/:id/expected-usage', catalogController.expectedUsage);

// Change log
router.get('/changelog/:entity/:id', catalogController.getChangeLog);

export default router;

