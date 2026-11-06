import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireDevLabClearance } from '../../middleware/devLabGuard.js';
import * as labController from './locationLabController.js';

const router = express.Router();

// Location Dev Lab routes require valid JWT AND multi-door clearance
router.use(authenticateJWT);
router.use(requireDevLabClearance);

// Vocabulary & Seed
router.get('/types', labController.listTypes);
router.post('/types', labController.createType);
router.put('/types/:id', labController.updateType);
router.delete('/types/:id', labController.deleteType);
router.post('/types/seed', labController.seedTypes);

// Tree & Bulk Path Operations
router.get('/tree', labController.getTree);
router.post('/ensure-path', labController.ensurePath);

// Invariant Integrity Check & Path Rebuild Repair
router.get('/integrity', labController.checkIntegrity);
router.post('/rebuild-paths', labController.rebuildPaths);

// Node-Level Operations
router.get('/:id', labController.getLocation);
router.put('/:id', labController.updateLocation);
router.delete('/:id', labController.deleteLocation);
router.post('/:id/move', labController.moveLocation);
router.post('/:id/archive', labController.archiveLocation);
router.post('/:id/restore', labController.restoreLocation);
router.get('/:id/subtree', labController.getSubtree);
router.get('/:id/ancestors', labController.getAncestors);
router.get('/:id/descendants', labController.getDescendantIds);

// Root Location Creation
router.post('/', labController.createLocation);

export default router;

