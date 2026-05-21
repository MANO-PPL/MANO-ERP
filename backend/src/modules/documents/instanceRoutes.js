import express from 'express';
import instanceController from './instanceController.js';
import cycleController from './cycleController.js';
import contentController from './contentController.js';
import { authenticateJWT } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

// Instance Metadata
router.get('/:instance_id', instanceController.getInstance);
router.patch('/:instance_id/archive', instanceController.archiveInstance);

// Content Read Endpoints
router.get('/:instance_id/content', contentController.getApprovedContent);
router.get('/:instance_id/draft', contentController.getDraftContent);
router.get('/:instance_id/versions', contentController.listVersions);
router.get('/:instance_id/versions/:version_id', contentController.getApprovedContent);

// Cycles nested under instance
router.post('/:instance_id/cycles', cycleController.initiateCycle);
router.get('/:instance_id/cycles', cycleController.listCycles);
export default router;
