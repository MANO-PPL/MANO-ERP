import express from 'express';
import tasksController from './tasksController.js';

const router = express.Router({ mergeParams: true });

router.get('/', tasksController.getTasks);
router.post('/', tasksController.createTask);
router.put('/:taskId', tasksController.updateTask);
router.put('/:taskId/assignees', tasksController.updateTaskAssignees);
router.delete('/:taskId', tasksController.deleteTask);

router.post('/categories', tasksController.createCategory);
router.put('/categories/:categoryId', tasksController.updateCategory);
router.delete('/categories/:categoryId', tasksController.deleteCategory);

router.post('/reorder', tasksController.reorder);

export default router;
