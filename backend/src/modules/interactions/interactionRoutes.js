import express from 'express';
import interactionController from './interactionController.js';
import { authenticateJWT } from '../../middleware/auth.js';

// Standalone /api/interactions router
const router = express.Router();
router.use(authenticateJWT);

router.get('/', interactionController.listInteractions);
router.post('/', interactionController.addInteraction);
router.delete('/:interactionId', interactionController.deleteInteraction);

export default router;

// Nested router for /api/parties/:id/interactions
export const partyInteractionRoutes = express.Router({ mergeParams: true });
partyInteractionRoutes.use(authenticateJWT);
partyInteractionRoutes.get('/', interactionController.listInteractions);
partyInteractionRoutes.post('/', interactionController.addInteraction);
partyInteractionRoutes.delete('/:interactionId', interactionController.deleteInteraction);
