import express from 'express';

// New route modules (migrated to src/)
import authRoutes from './auth/authRoutes.js';
import { authenticateJWT } from '../middleware/auth.js';
import { isDevLabEnabled, requireDevLabClearance } from '../middleware/devLabGuard.js';
import adminRoutes from './admin/adminRoutes.js';
import unitRoutes from './units/unitRoutes.js';
import resourceRoutes from './inventory/resourceRoutes.js';
import projectRoutes from './projects/projectRoutes.js';
import vendorRoutes from './vendors/vendorRoutes.js';
import clientRoutes, { contactRoutes } from './clients/clientRoutes.js';
import documentRoutes from './documents/documentRoutes.js';
import instanceRoutes from './documents/instanceRoutes.js';
import cycleRoutes from './documents/cycleRoutes.js';
import aiRoutes from './ai/aiRoutes.js';
import kgRoutes from './knowledge/kgRoutes.js';
import agentRoutes from './agent/agentRoutes.js';
import drawingsTestRoutes from './projects/drawings/testDrawings.js';
import ledgerRoutes from './ledger/ledgerRoutes.js';
import locationRoutes from './locations/locationRoutes.js';
import locationLabRoutes from './locations/locationLabRoutes.js';

const router = express.Router();

// Core production route imports
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/projects', projectRoutes);
router.use('/units', unitRoutes);
router.use('/resources', resourceRoutes);
router.use('/vendors', vendorRoutes);
router.use('/clients', clientRoutes);
router.use('/contacts', contactRoutes);
router.use('/v1/documents', documentRoutes);
router.use('/v1/instances', instanceRoutes);
router.use('/v1/cycles', cycleRoutes);
router.use('/ai', aiRoutes);
router.use('/agent/knowledge-graph', kgRoutes);
router.use('/agent', agentRoutes);
router.use('/drawings-test', drawingsTestRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/locations', locationRoutes);

// Modular Dev Lab routes (Only active if ENABLE_DEV_LAB=true in .env / .env.lab)
if (isDevLabEnabled()) {
    // Clearance probe route: Allows frontend DevRoute to check real backend whitelist clearance
    router.get('/dev/clearance', authenticateJWT, requireDevLabClearance, (req, res) => {
        res.json({
            success: true,
            cleared: true,
            user: { id: req.user.id, email: req.user.email }
        });
    });

    console.log('🧪 Mounting Location Dev Lab routes on /api/dev/locations');
    router.use('/dev/locations', locationLabRoutes);
    console.log('🧪 Mounting Catalog Dev Lab routes on /api/dev/catalog');
    router.use('/dev/catalog', catalogLabRoutes);
}

export default router;
