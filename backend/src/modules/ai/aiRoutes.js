import express from 'express';
import { analyzeReportController, analyzeBudgetController, analyzeScheduleController } from './ai.controller.js';

const router = express.Router();

// POST /api/ai/analyze-report
router.post('/analyze-report', analyzeReportController);

// POST /api/ai/analyze-budget
router.post('/analyze-budget', analyzeBudgetController);

// POST /api/ai/schedule-insights
router.post('/schedule-insights', analyzeScheduleController);

export default router;
