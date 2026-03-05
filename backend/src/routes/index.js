import express from 'express';

// New route modules (migrated to src/)
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import projectRoutes from './projectRoutes.js';

const router = express.Router();

// NEW route imports
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/projects', projectRoutes);


export default router;
