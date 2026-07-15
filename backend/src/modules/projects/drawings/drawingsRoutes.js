import express from 'express';
import multer from 'multer';
import * as drawingsController from './drawingsController.js';

const router = express.Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

// Categories CRUD
router.get('/categories', drawingsController.listCategories);
router.post('/categories', drawingsController.createCategory);
router.put('/categories/:categoryId', drawingsController.updateCategory);
router.delete('/categories/:categoryId', drawingsController.deleteCategory);

// Drawings CRUD & Operations
router.get('/categories/:categoryId/drawings', drawingsController.listDrawings);
router.post('/upload', upload.fields([
    { name: 'dwgFile', maxCount: 1 },
    { name: 'pdfFile', maxCount: 1 }
]), drawingsController.uploadDrawing);
router.put('/categories/:categoryId/drawings/:drawingGroupId', drawingsController.updateDrawingTitle);
router.delete('/categories/:categoryId/drawings/:drawingGroupId', drawingsController.deleteDrawing);
router.put('/categories/:categoryId/reorder', drawingsController.reorderDrawings);

export default router;
