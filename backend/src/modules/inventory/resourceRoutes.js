import express from 'express';
import resourceController from './resourceController.js';
import { authenticateJWT, restrictTo } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

// Basic CRUD
router.get('/', resourceController.listResources);
router.get('/:id', resourceController.getResource);

router.post('/', restrictTo('admin'), resourceController.createResource);
router.put('/:id', restrictTo('admin'), resourceController.updateResource);
router.delete('/:id', restrictTo('admin'), resourceController.deleteResource);

// Compositions (Items only)
router.put('/:id/compositions', restrictTo('admin'), resourceController.setCompositions);

// Unit Conversions
router.post('/:id/conversions', restrictTo('admin'), resourceController.addConversion);
router.delete('/:id/conversions/:conv_id', restrictTo('admin'), resourceController.removeConversion);

export default router;
