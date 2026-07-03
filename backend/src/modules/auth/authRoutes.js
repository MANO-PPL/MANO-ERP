import express from 'express';
import authController from './authController.js';
import { authLimiter } from '../../middleware/authLimiter.js';
import { authenticateJWT } from '../../middleware/auth.js';

const router = express.Router();

router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticateJWT, authController.getMe);

export default router;
