import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import drawingsService from './drawingsService.js';

// Helper to extract project ID from route params
const getProjectId = (req) => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
        throw new AppError('Invalid Project ID', 400);
    }
    return parseInt(id);
};

// ─── Category Controllers ─────────────────────────────────────────────────────

export const listCategories = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const categories = await drawingsService.getCategories(projectId);
    res.json({
        success: true,
        categories
    });
});

export const createCategory = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { name, icon_key } = req.body;
    const categoryId = await drawingsService.createCategory(projectId, { name, icon_key });
    res.status(201).json({
        success: true,
        message: 'Drawing category created successfully',
        category_id: categoryId
    });
});

export const updateCategory = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { categoryId } = req.params;
    if (!categoryId || isNaN(parseInt(categoryId))) {
        throw new AppError('Invalid Category ID', 400);
    }
    const { name, icon_key } = req.body;
    await drawingsService.updateCategory(projectId, parseInt(categoryId), { name, icon_key });
    res.json({
        success: true,
        message: 'Drawing category updated successfully'
    });
});

export const deleteCategory = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { categoryId } = req.params;
    if (!categoryId || isNaN(parseInt(categoryId))) {
        throw new AppError('Invalid Category ID', 400);
    }
    
    const confirm = req.query.confirm === 'true';
    const result = await drawingsService.deleteCategory(projectId, parseInt(categoryId), confirm);

    if (result.hasDrawings) {
        return res.json({
            success: false,
            hasDrawings: true,
            message: `This category contains ${result.count} drawings. Deleting it will permanently remove all files.`,
            count: result.count
        });
    }

    res.json({
        success: true,
        message: 'Drawing category deleted successfully'
    });
});

// ─── Drawings & Revisions Controllers ─────────────────────────────────────────

export const listDrawings = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { categoryId } = req.params;
    if (!categoryId || isNaN(parseInt(categoryId))) {
        throw new AppError('Invalid Category ID', 400);
    }
    const drawings = await drawingsService.getDrawings(projectId, parseInt(categoryId));
    res.json({
        success: true,
        drawings
    });
});

export const uploadDrawing = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { categoryId, title, description, drawingGroupId } = req.body;

    if (!categoryId || isNaN(parseInt(categoryId))) {
        throw new AppError('Invalid Category ID', 400);
    }

    // Multer fields: req.files['dwgFile'] and req.files['pdfFile']
    const dwgFile = req.files && req.files['dwgFile'] ? req.files['dwgFile'][0] : null;
    const pdfFile = req.files && req.files['pdfFile'] ? req.files['pdfFile'][0] : null;

    if (!drawingGroupId && !title) {
        throw new AppError('Drawing title is required for new records', 400);
    }

    const result = await drawingsService.uploadDrawingRecord(projectId, {
        categoryId: parseInt(categoryId),
        title,
        description,
        drawingGroupId,
        dwgFile,
        pdfFile,
        userId: req.user.id
    });

    res.status(201).json({
        success: true,
        message: drawingGroupId ? 'New revision uploaded successfully' : 'Drawing record created successfully',
        ...result
    });
});

export const updateDrawingTitle = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { categoryId, drawingGroupId } = req.params;
    
    if (!categoryId || isNaN(parseInt(categoryId))) {
        throw new AppError('Invalid Category ID', 400);
    }
    if (!drawingGroupId || isNaN(parseInt(drawingGroupId))) {
        throw new AppError('Invalid Drawing Group ID', 400);
    }

    const { title } = req.body;
    await drawingsService.updateDrawingTitle(projectId, parseInt(categoryId), parseInt(drawingGroupId), { title });

    res.json({
        success: true,
        message: 'Drawing title updated successfully'
    });
});

export const deleteDrawing = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { categoryId, drawingGroupId } = req.params;

    if (!categoryId || isNaN(parseInt(categoryId))) {
        throw new AppError('Invalid Category ID', 400);
    }
    if (!drawingGroupId || isNaN(parseInt(drawingGroupId))) {
        throw new AppError('Invalid Drawing Group ID', 400);
    }

    await drawingsService.deleteDrawing(projectId, parseInt(categoryId), parseInt(drawingGroupId));

    res.json({
        success: true,
        message: 'Drawing and all its revisions deleted successfully'
    });
});

export const reorderDrawings = catchAsync(async (req, res) => {
    const projectId = getProjectId(req);
    const { categoryId } = req.params;
    if (!categoryId || isNaN(parseInt(categoryId))) {
        throw new AppError('Invalid Category ID', 400);
    }
    const { order } = req.body;
    await drawingsService.reorderDrawings(projectId, parseInt(categoryId), order);

    res.json({
        success: true,
        message: 'Drawings reordered successfully'
    });
});

export default {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    listDrawings,
    uploadDrawing,
    updateDrawingTitle,
    deleteDrawing,
    reorderDrawings
};
