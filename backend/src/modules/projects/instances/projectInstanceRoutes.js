import express from 'express';
import projectInstanceController from './projectInstanceController.js';

// mergeParams: true is necessary to access :id from the parent router
const router = express.Router({ mergeParams: true });

router.post('/', projectInstanceController.createProjectInstance);
router.get('/', projectInstanceController.listProjectInstances);

export default router;
