import express from 'express';
import unitController from './unitController.js';
import { authenticateJWT, restrictTo } from '../../middleware/auth.js';

const router = express.Router();

// Authentication required for all unit routes
router.use(authenticateJWT);

// Only admin can manage standard units globally (creating org-level units might be future scope)
router.post('/', restrictTo('admin'), unitController.createUnit);
router.put('/:id', restrictTo('admin'), unitController.updateUnit);
router.delete('/:id', restrictTo('admin'), unitController.deleteUnit);

// Everyone authenticated can list units
router.get('/', unitController.listUnits);

export default router;
