import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import { createController, requireAgentOrigin } from './agentController.js';

const router = express.Router();
const controller = createController();
router.use(authenticateJWT, requireAgentOrigin);
router.post('/requests', controller('request'));
router.post('/decisions', controller('decision'));
router.get('/requests/:requestId/events', controller('replay'));
export default router;
