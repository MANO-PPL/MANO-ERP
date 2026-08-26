import express from 'express';
import partyController from './partyController.js';

const router = express.Router({ mergeParams: true });

// All routes are scoped under /projects/:id/parties.
router.get('/', partyController.listProjectParties);
router.get('/available', partyController.listAvailableProjectParties);
router.post('/', partyController.addProjectParties);
router.delete('/', partyController.removeProjectParties);
router.put('/sync', partyController.syncProjectParties);
router.post('/sync', partyController.syncProjectParties);

export default router;
