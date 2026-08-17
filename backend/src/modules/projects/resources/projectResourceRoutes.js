import express from 'express';
import projectResourceController from './projectResourceController.js';
import { requireProjectPermission } from '../../../middleware/auth.js';

const router = express.Router({ mergeParams: true });

router.use(requireProjectPermission('Material Management'));
router.get('/', projectResourceController.listProjectResources);
router.get('/rates', projectResourceController.getResolvedRates);
router.delete('/:resourceId', projectResourceController.removeProjectResource);

// Project-scoped pricing stays inside the project module.
router.get('/:resourceId/rate', projectResourceController.getResolvedRate);
router.post('/:resourceId/rates', projectResourceController.addRate);
router.get('/:resourceId/rates', projectResourceController.getRateHistory);
router.post('/:resourceId/clear-rate', projectResourceController.clearRate);

// Item compositions are imported once from master, then versioned independently.
router.post('/import-batch', projectResourceController.importBatchResourcesToProject);
router.post('/:resourceId/import', projectResourceController.importResourceToProject);
router.put('/:resourceId/compositions', projectResourceController.setCompositions);
router.get('/:resourceId/compositions', projectResourceController.getCompositionHistory);

export default router;
