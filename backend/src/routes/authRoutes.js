import express from 'express';
import authController from '../controllers/authController.js';
import { authLimiter } from '../middleware/authLimiter.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', authLimiter, authController.login);
router.post('/refresh', authenticateJWT, authController.refresh);
router.post('/logout', authenticateJWT, authController.logout);

export default router;
