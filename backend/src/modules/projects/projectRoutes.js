import express from 'express';
import projectController from './core/projectController.js';
import directoryRoutes from './directory/directoryRoutes.js';
import vendorRoutes from './vendors/vendorRoutes.js';
import staffRoutes from './staff/staffRoutes.js';
import summaryRoutes from './summary/summaryRoutes.js';
import agendaRoutes from './agenda/agendaRoutes.js';
import momRoutes from './mom/momRoutes.js';
import orgRoutes from './org/orgRoutes.js';
import projectInstanceRoutes from './instances/projectInstanceRoutes.js';
import { authenticateJWT, restrictTo } from '../../middleware/auth.js';

const router = express.Router();

// Authentication required for all project routes
router.use(authenticateJWT);

// Projects CRUD (Only Admin and HR can create/edit projects globally)
router.post('/', restrictTo('admin', 'hr'), projectController.createProject);
router.put('/:id', restrictTo('admin', 'hr'), projectController.updateProject);

// Everyone can list projects (the frontend logic or later query updates can filter visibility if needed)
router.get('/', projectController.listProjects);
router.get('/:id', projectController.getProject);

// Project Member Management (Assigning developers, engineers, and parsing custom permissions)
router.get('/:id/members', projectController.getProjectMembers);
router.post('/:id/members', restrictTo('admin', 'hr'), projectController.assignProjectMember);
router.delete('/:id/members/:user_id', restrictTo('admin', 'hr'), projectController.removeProjectMember);

// Project Directory (sub-resource under each project)
router.use('/:id/directory', directoryRoutes);

// Project Vendors (sub-resource under each project)
router.use('/:id/vendors', vendorRoutes);

// Project Staff (sub-resource under each project)
router.use('/:id/staff', staffRoutes);

// Project Summary (sub-resource under each project)
router.use('/:id/summary', summaryRoutes);

// Project Agendas (sub-resource under each project)
router.use('/:id/agendas', agendaRoutes);

// Project Minutes of Meeting (sub-resource under each project)
router.use('/:id/moms', momRoutes);

// Project Organization Chart
router.use('/:id/org', orgRoutes);

// Project Document Instances
router.use('/:id/instances', projectInstanceRoutes);

export default router;
