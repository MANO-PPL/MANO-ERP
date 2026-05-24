import { analyzeReport } from './ai.service.js';
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

        // Handle JSON parsing errors from the LLM response
        if (error instanceof SyntaxError) {
            return next(new AppError('Failed to parse AI response. Please try again.', 502));
        }

        return next(new AppError(error.message || 'AI analysis failed.', 500));
    }
};
