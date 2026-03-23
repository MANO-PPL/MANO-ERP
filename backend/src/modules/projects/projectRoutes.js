import express from 'express';
import projectController from './projectController.js';
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

export default router;
