import express from 'express';
import vendorController from './vendorController.js';

const router = express.Router({ mergeParams: true });

// All routes are scoped under /projects/:id/vendors
router.get('/', vendorController.listProjectVendors);
router.post('/', vendorController.addProjectVendors);
router.delete('/', vendorController.removeProjectVendors);

export default router;
