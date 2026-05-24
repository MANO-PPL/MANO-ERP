import express from 'express';
import { analyzeReportController } from './ai.controller.js';

const router = express.Router();

// POST /api/ai/analyze-report
router.post('/analyze-report', analyzeReportController);

export default router;
