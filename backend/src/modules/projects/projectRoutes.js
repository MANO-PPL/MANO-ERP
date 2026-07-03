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
import { authenticateJWT, restrictTo, requireProjectPermission, requireProjectAssignment } from '../../middleware/auth.js';

const router = express.Router();

// Authentication required for all project routes
router.use(authenticateJWT);

// Projects CRUD (Only Admin and HR can create/edit projects globally)
router.post('/', restrictTo('admin'), projectController.createProject);
router.put('/:id', restrictTo('admin'), projectController.updateProject);

// Everyone can list projects (but viewing details requires assignment/admin bypass)
router.get('/', projectController.listProjects);
router.get('/:id', requireProjectAssignment, projectController.getProject);

// Project Member Management
router.get('/:id/members', requireProjectAssignment, projectController.getProjectMembers);
router.post('/:id/members', restrictTo('admin'), projectController.assignProjectMember);
router.delete('/:id/members/:user_id', restrictTo('admin'), projectController.removeProjectMember);

// Project Directory (sub-resource under each project)
router.use('/:id/directory', requireProjectPermission('directory'), directoryRoutes);

// Project Vendors (sub-resource under each project)
router.use('/:id/vendors', requireProjectPermission('vendors'), vendorRoutes);

// Project Staff (sub-resource under each project)
router.use('/:id/staff', requireProjectPermission('staff'), staffRoutes);

// Project Summary (sub-resource under each project)
router.use('/:id/summary', requireProjectPermission('summary'), summaryRoutes);

// Project Agendas (sub-resource under each project)
router.use('/:id/agendas', requireProjectPermission('agenda'), agendaRoutes);

// Project Minutes of Meeting (sub-resource under each project)
router.use('/:id/moms', requireProjectPermission('mom'), momRoutes);

// Project Organization Chart
router.use('/:id/org', requireProjectPermission('org'), orgRoutes);

// Project Document Instances
router.use('/:id/instances', requireProjectPermission('instances'), projectInstanceRoutes);

export default router;
