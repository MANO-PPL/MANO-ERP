import express from 'express';
import resourceController from '../../inventory/resourceController.js';
import { requireProjectPermission } from '../../../middleware/auth.js';

const router = express.Router({ mergeParams: true });

router.use(requireProjectPermission('Material Management'));
router.get('/', resourceController.listProjectResources);
router.post('/', resourceController.addProjectResource);
router.delete('/:resourceId', resourceController.removeProjectResource);

export default router;
