import { analyzeReport, analyzeBudget, analyzeSchedule } from './ai.service.js';
import AppError from '../../utils/AppError.js';

/**
 * POST /api/ai/analyze-report
 * Accepts report data and returns an AI-generated structured summary.
 */
export const analyzeReportController = async (req, res, next) => {
    try {
        const { reportData } = req.body;

        if (!reportData) {
            return next(new AppError('reportData is required in the request body.', 400));
        }

        const summary = await analyzeReport(reportData);

        res.status(200).json({
            status: 'success',
            data: summary,
        });
    } catch (error) {
        console.error('AI Analysis Error:', error.message);

        if (error instanceof SyntaxError) {
            return next(new AppError('Failed to parse AI response. Please try again.', 502));
        }

        return next(new AppError(error.message || 'AI analysis failed.', 500));
    }
};

/**
 * POST /api/ai/analyze-budget
 * Accepts budget data and returns AI-generated structured financial insights.
 */
export const analyzeBudgetController = async (req, res, next) => {
    try {
        const { budgetData, slabArea, gstRate, sectionId } = req.body;

        if (!budgetData) {
            return next(new AppError('budgetData is required in the request body.', 400));
        }

        const insights = await analyzeBudget({ budgetData, slabArea, gstRate, sectionId });

        res.status(200).json({
            status: 'success',
            data: insights,
        });
    } catch (error) {
        console.error('AI Budget Analysis Error:', error.message);
        if (error instanceof SyntaxError) {
            return next(new AppError('Failed to parse AI response. Please try again.', 502));
        }
        return next(new AppError(error.message || 'AI budget analysis failed.', 500));
    }
};

/**
 * POST /api/ai/analyze-schedule
 * Accepts Gantt chart phases and returns AI-generated schedule insights.
 */
export const analyzeScheduleController = async (req, res, next) => {
    try {
        const { phases, macro } = req.body;

        if (!phases) {
            return next(new AppError('phases array is required in the request body.', 400));
        }

        const insights = await analyzeSchedule({ phases, macro });

        res.status(200).json({
            status: 'success',
            data: insights,
        });
    } catch (error) {
        console.error('AI Schedule Analysis Error:', error.message);
        if (error instanceof SyntaxError) {
            return next(new AppError('Failed to parse AI response. Please try again.', 502));
        }
        return next(new AppError(error.message || 'AI schedule analysis failed.', 500));
    }
};
