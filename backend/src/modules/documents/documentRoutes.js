import express from 'express';
import documentController from './documentController.js';
import { authenticateJWT } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

// Document Templates
router.post('/', documentController.createTemplate);
router.get('/', documentController.listTemplates);
router.get('/:document_id', documentController.getTemplate);
router.put('/:document_id', documentController.updateTemplate);

// Approval Levels
router.post('/:document_id/levels', documentController.addLevel);
router.delete('/:document_id/levels/:level_id', documentController.removeLevel);

// Document Roles
router.post('/:document_id/roles', documentController.assignRole);
router.delete('/:document_id/roles/:role_id', documentController.removeRole);

export default router;
