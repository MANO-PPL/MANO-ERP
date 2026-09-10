import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../middleware/auth.js';
import { createController, requireAgentOrigin } from './agentController.js';

const router = express.Router();
const controller = createController();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
});

router.use(authenticateJWT, requireAgentOrigin);
router.post('/upload', upload.single('file'), controller('upload'));
router.get('/export/:downloadId', controller('export'));
router.post('/requests', controller('request'));
router.post('/decisions', controller('decision'));
router.get('/requests/:requestId/events', controller('replay'));
export default router;
