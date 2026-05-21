import express from 'express';
import cycleController from './cycleController.js';
import contentWriteController from './contentWriteController.js';
import { authenticateJWT } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/:cycle_id', cycleController.getCycle);
router.patch('/:cycle_id/draft', cycleController.saveDraft);
router.post('/:cycle_id/submit', cycleController.submitDraft);

router.post('/:cycle_id/request-revision', cycleController.requestRevision);
router.post('/:cycle_id/reject', cycleController.rejectCycle);
router.post('/:cycle_id/cancel', cycleController.cancelCycle);
router.post('/:cycle_id/claim', cycleController.claimRevision);

// --- Content Write Endpoints ---
// Directory
router.post('/:cycle_id/directory', contentWriteController.addDirectory);
router.put('/:cycle_id/directory/:pd_id', contentWriteController.updateDirectory);
router.delete('/:cycle_id/directory/:pd_id', contentWriteController.deleteDirectory);

// Vendors
router.post('/:cycle_id/vendors', contentWriteController.addVendor);
router.delete('/:cycle_id/vendors/:pv_id', contentWriteController.deleteVendor);

// Staff
router.post('/:cycle_id/staff', contentWriteController.addStaff);
router.put('/:cycle_id/staff/:psrr_id', contentWriteController.updateStaff);
router.delete('/:cycle_id/staff/:psrr_id', contentWriteController.deleteStaff);

// MoM
router.put('/:cycle_id/mom', contentWriteController.updateMom);
router.post('/:cycle_id/mom/participants', contentWriteController.addMomParticipant);
router.delete('/:cycle_id/mom/participants/:pmp_id', contentWriteController.removeMomParticipant);

// Agenda
router.put('/:cycle_id/agenda', contentWriteController.updateAgenda);
router.post('/:cycle_id/agenda/participants', contentWriteController.addAgendaParticipant);
router.delete('/:cycle_id/agenda/participants/:pap_id', contentWriteController.removeAgendaParticipant);

// Summary
router.put('/:cycle_id/summary', contentWriteController.updateSummary);

export default router;
