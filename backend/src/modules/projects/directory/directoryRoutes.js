import express from 'express';
import directoryController from './directoryController.js';

const router = express.Router({ mergeParams: true });

// All routes are scoped under /projects/:project_id/directory
router.get('/', directoryController.listDirectory);
router.post('/', directoryController.addDirectoryItem);
router.put('/:pd_id', directoryController.updateDirectoryItem);
router.delete('/:pd_id', directoryController.deleteDirectoryItem);

export default router;
