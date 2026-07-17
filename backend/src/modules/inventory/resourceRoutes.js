import express from 'express';
import resourceController from './resourceController.js';
import { authenticateJWT, requireSystemPermission } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);
router.use(requireSystemPermission('materials'));

// Basic CRUD
router.get('/', resourceController.listResources);
router.get('/:id', resourceController.getResource);

router.post('/', resourceController.createResource);
router.put('/:id', resourceController.updateResource);
router.delete('/:id', resourceController.deleteResource);

// Compositions (Items only)
router.put('/:id/compositions', resourceController.setCompositions);

// Unit Conversions
router.post('/:id/conversions', resourceController.addConversion);
router.delete('/:id/conversions/:conv_id', resourceController.removeConversion);

export default router;
