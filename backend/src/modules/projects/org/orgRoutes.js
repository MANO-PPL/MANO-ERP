import express from 'express';
import orgController from './orgController.js';

const router = express.Router({ mergeParams: true });

/**
 * All routes are scoped under /projects/:id/org
 */
router.get('/', orgController.getOrgChart);

export default router;
