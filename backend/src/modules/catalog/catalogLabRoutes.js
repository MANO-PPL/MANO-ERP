import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireDevLabClearance } from '../../middleware/devLabGuard.js';
import * as labController from './catalogLabController.js';

const router = express.Router();

// Catalog Dev Lab routes require valid JWT AND multi-door clearance
router.use(authenticateJWT);
router.use(requireDevLabClearance);

// Units & Conversions
router.get('/units', labController.listUnits);
router.post('/units', labController.createUnit);
router.put('/units/:id', labController.updateUnit);
router.post('/units/seed', labController.seedUnits);
router.post('/units/repair', labController.repairUnits);
router.post('/units/convert', labController.convertUnits);

// Resources
router.get('/resources', labController.listResources);
router.post('/resources', labController.createResource);
router.post('/resources/import', labController.importResource);
router.get('/resources/:id', labController.getResource);
router.put('/resources/:id', labController.updateResource);
router.delete('/resources/:id', labController.deleteResource);
router.post('/resources/:id/archive', labController.archiveResource);
router.post('/resources/:id/restore', labController.restoreResource);
router.get('/resources/:id/sync-status', labController.getResourceSyncStatus);
router.get('/resources/:id/sync-diff', labController.getResourceSyncDiff);
router.post('/resources/:id/sync-accept', labController.acceptResourceSync);

router.get('/resources/:id/conversions', labController.listConversions);
router.post('/resources/:id/conversions', labController.setConversion);
router.delete('/conversions/:conversionId', labController.removeConversion);

// Rates
router.get('/resources/:id/rates', labController.listRates);
router.get('/resources/:id/rate', labController.getRate);
router.post('/resources/:id/rates', labController.setRate);
router.put('/rates/:rateId', labController.correctRate);
router.delete('/rates/:rateId', labController.removeRate);

// Activities & Norms
router.get('/activities', labController.listActivities);
router.post('/activities', labController.createActivity);
router.post('/activities/import', labController.importActivity);
router.get('/activities/:id', labController.getActivity);
router.put('/activities/:id', labController.updateActivity);
router.delete('/activities/:id', labController.deleteActivity);
router.post('/activities/:id/archive', labController.archiveActivity);
router.post('/activities/:id/restore', labController.restoreActivity);
router.get('/activities/:id/sync-status', labController.getActivitySyncStatus);
router.get('/activities/:id/sync-diff', labController.getActivitySyncDiff);
router.post('/activities/:id/sync-accept', labController.acceptActivitySync);

router.get('/activities/:id/norms', labController.getNorms);
router.post('/activities/:id/norms', labController.setNorm);
router.put('/norms/:normId', labController.correctNorm);
router.delete('/norms/:normId', labController.removeNorm);

// Computation
router.get('/activities/:id/cost', labController.computeActivityCost);
router.get('/activities/:id/expected-usage', labController.expectedUsage);

// Housekeeping, Simulator & Test Runner
router.get('/changelog/:entity/:id', labController.getChangeLog);
router.get('/integrity', labController.checkIntegrity);
router.get('/in-use-simulator', labController.getSimulatedInUse);
router.post('/in-use-simulator', labController.toggleSimulatedInUse);
router.post('/run-tests', labController.runTests);

export default router;

