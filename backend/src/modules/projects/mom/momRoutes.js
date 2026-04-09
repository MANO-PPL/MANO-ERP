import express from 'express';
import momController from './momController.js';

const router = express.Router({ mergeParams: true });

// All routes are scoped under /projects/:id/moms
router.get('/', momController.listMoMs);
router.get('/:mom_id', momController.getMoM);
router.post('/', momController.createMoM);
router.put('/:mom_id', momController.updateMoM);
router.delete('/:mom_id', momController.deleteMoM);

export default router;
