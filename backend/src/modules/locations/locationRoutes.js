import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as locationController from './locationController.js';

const router = express.Router();

// Core Production Location Routes: All require standard user authentication
router.use(authenticateJWT);

// Read-only queries
router.get('/tree', locationController.getTree);
router.get('/children', locationController.listChildren);
router.get('/types', locationController.listTypes);
router.get('/:id', locationController.getLocation);
router.get('/:id/subtree', locationController.getSubtree);
router.get('/:id/ancestors', locationController.getAncestors);
router.get('/:id/descendants', locationController.getDescendantIds);

// Production CRUD
router.post('/', locationController.createLocation);
router.put('/:id', locationController.updateLocation);
router.post('/:id/move', locationController.moveLocation);
router.post('/:id/archive', locationController.archiveLocation);
router.post('/:id/restore', locationController.restoreLocation);
router.delete('/:id', locationController.deleteLocation);

export default router;
