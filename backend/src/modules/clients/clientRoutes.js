import express from 'express';
import multer from 'multer';
import clientController from './clientController.js';
import { authenticateJWT, requireSystemPermission } from '../../middleware/auth.js';

const router = express.Router();
const upload = multer();

// Apply auth and permission checks to all client routes
router.use(authenticateJWT);
router.use(requireSystemPermission('clients'));

// Publicly readable/writable based on none/view/edit permission settings
router.get('/', clientController.listClients);
router.post('/bulk', upload.single('file'), clientController.bulkUpload);
router.post('/bulk-validate', clientController.bulkValidate);
router.post('/bulk-json', clientController.bulkJson);
router.get('/:id', clientController.getClient);

// Modifications
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/', clientController.deleteClients);
router.delete('/:id', clientController.deleteClient);
router.post('/:id/interactions', clientController.addInteraction);

export default router;
