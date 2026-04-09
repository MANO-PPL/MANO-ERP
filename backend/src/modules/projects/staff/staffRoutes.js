import express from 'express';
import staffController from './staffController.js';

const router = express.Router({ mergeParams: true });

// All routes are scoped under /projects/:id/staff
router.get('/', staffController.listStaff);
router.post('/', staffController.addStaff);
router.put('/:psrr_id', staffController.updateStaff);
router.delete('/:psrr_id', staffController.removeStaff);

export default router;
