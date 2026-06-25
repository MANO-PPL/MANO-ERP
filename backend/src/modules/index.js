import express from 'express';

// New route modules (migrated to src/)
import authRoutes from './auth/authRoutes.js';
import adminRoutes from './admin/adminRoutes.js';
import unitRoutes from './inventory/unitRoutes.js';
import resourceRoutes from './inventory/resourceRoutes.js';
import projectRoutes from './projects/projectRoutes.js';
import vendorRoutes from './vendors/vendorRoutes.js';
import clientRoutes from './clients/clientRoutes.js';
import documentRoutes from './documents/documentRoutes.js';
import instanceRoutes from './documents/instanceRoutes.js';
import cycleRoutes from './documents/cycleRoutes.js';
import aiRoutes from './ai/aiRoutes.js';

const router = express.Router();

// NEW route imports
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/projects', projectRoutes);
router.use('/units', unitRoutes);
router.use('/resources', resourceRoutes);
router.use('/vendors', vendorRoutes);
router.use('/clients', clientRoutes);
router.use('/v1/documents', documentRoutes);
router.use('/v1/instances', instanceRoutes);
router.use('/v1/cycles', cycleRoutes);
router.use('/ai', aiRoutes);

export default router;
