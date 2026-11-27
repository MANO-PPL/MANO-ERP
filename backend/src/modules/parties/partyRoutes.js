import express from 'express';
import multer from 'multer';
import partyController from './partyController.js';
import { partyInteractionRoutes } from '../interactions/interactionRoutes.js';
import { authenticateJWT } from '../../middleware/auth.js';

const router = express.Router();
const upload = multer();

router.use(authenticateJWT);

// Parties CRUD & Lifecycle
router.get('/', partyController.listParties);
router.post('/batch-save', partyController.batchSave);
router.post('/bulk', upload.single('file'), partyController.bulkUpload);
router.post('/bulk-validate', partyController.bulkValidate);
router.post('/bulk-json', partyController.bulkJson);
router.get('/:id/changelog', partyController.getPartyChangeLog);
router.get('/:id/contacts', partyController.listPartyContactPersons);
router.post('/:id/contacts', partyController.addPartyContactPerson);
router.put('/:id/contacts/:personId', partyController.updatePartyContactPerson);
router.patch('/:id/contacts/:personId/primary', partyController.setPrimaryPartyContactPerson);
router.delete('/:id/contacts/:personId', partyController.deletePartyContactPerson);
router.get('/:id', partyController.getParty);
router.post('/', partyController.createParty);
router.put('/:id', partyController.updateParty);
router.post('/:id/archive', partyController.archiveParty);
router.post('/:id/restore', partyController.restoreParty);
router.delete('/', partyController.deleteParties);
router.delete('/:id', partyController.deleteParty);
router.use('/:id/interactions', partyInteractionRoutes);

export default router;
