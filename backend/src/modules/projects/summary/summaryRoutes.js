import express from 'express';
import summaryController from './summaryController.js';

const router = express.Router({ mergeParams: true });

// All routes are scoped under /projects/:id/summary
router.get('/', summaryController.listSummaries);
router.post('/', summaryController.addSummaries);
router.put('/', summaryController.updateSummaries);
router.delete('/', summaryController.removeSummaries);

export default router;
