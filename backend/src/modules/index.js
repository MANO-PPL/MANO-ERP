import express from 'express';

// New route modules (migrated to src/)
import authRoutes from './auth/authRoutes.js';
import adminRoutes from './admin/adminRoutes.js';
import unitRoutes from './inventory/unitRoutes.js';
import resourceRoutes from './inventory/resourceRoutes.js';
import projectRoutes from './projects/projectRoutes.js';
import vendorRoutes from './vendors/vendorRoutes.js';
import clientRoutes from './clients/clientRoutes.js';

const router = express.Router();

// NEW route imports
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/projects', projectRoutes);
router.use('/units', unitRoutes);
router.use('/resources', resourceRoutes);
router.use('/vendors', vendorRoutes);
router.use('/clients', clientRoutes);

export default router;
