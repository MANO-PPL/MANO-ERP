import express from 'express';
import multer from 'multer';
import adminController from '../controllers/adminController.js';
import permissionController from '../controllers/permissionController.js';
import { authenticateJWT, restrictTo } from '../middleware/auth.js';

const router = express.Router();
const upload = multer(); // memory storage

// Apply auth and role restrictions to all admin routes globally
router.use(authenticateJWT);
router.use(restrictTo('admin', 'hr'));

// Users
router.get('/users', adminController.listUsers);
router.get('/user/:user_id', adminController.getUser);
router.post('/user', adminController.createUser);
router.put('/user/:user_id', upload.single('profile_image'), adminController.updateUser); // image is optional
router.delete('/user/:user_id', adminController.deleteUser);

// Bulk endpoints
router.post('/users/bulk', upload.single('file'), adminController.bulkUpload);
router.post('/users/bulk-validate', adminController.bulkValidate);
router.post('/users/bulk-json', adminController.bulkJson);

// Departments
router.get('/departments', adminController.listDepartments);
router.post('/departments', adminController.createDepartment);

// Designations
router.get('/designations', adminController.listDesignations);
router.post('/designations', adminController.createDesignation);

// Permission Templates
router.get('/permission-templates', permissionController.listTemplates);
router.post('/permission-templates', permissionController.createTemplate);
router.put('/permission-templates/:id', permissionController.updateTemplate);
router.delete('/permission-templates/:id', permissionController.deleteTemplate);

export default router;
