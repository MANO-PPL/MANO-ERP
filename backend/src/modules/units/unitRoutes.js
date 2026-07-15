import express from 'express';
import unitController from './unitController.js';
import { authenticateJWT } from '../../middleware/auth.js';

const router = express.Router();

// Authentication required for reading units
router.use(authenticateJWT);

// Expose only the read-only list route
router.get('/', unitController.listUnits);

export default router;
