import express from 'express';
import agendaController from './agendaController.js';

const router = express.Router({ mergeParams: true });

// All routes are scoped under /projects/:id/agendas
router.get('/', agendaController.listAgendas);
router.get('/:agenda_id', agendaController.getAgenda);
router.post('/', agendaController.createAgenda);
router.put('/:agenda_id', agendaController.updateAgenda);
router.delete('/:agenda_id', agendaController.deleteAgenda);

export default router;
