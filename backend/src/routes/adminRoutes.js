import express from 'express';
import multer from 'multer';
import adminController from '../controllers/adminController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();
const upload = multer(); // memory storage

router.get('/users', authenticateJWT, adminController.listUsers);
router.get('/user/:user_id', authenticateJWT, adminController.getUser);
router.get('/departments', authenticateJWT, adminController.listDepartments);
router.get('/designations', authenticateJWT, adminController.listDesignations);

router.post('/departments', authenticateJWT, adminController.createDepartment);
router.post('/designations', authenticateJWT, adminController.createDesignation);
router.post('/user', authenticateJWT, adminController.createUser);

// Update user (with optional profile image upload)
router.put('/user/:user_id', authenticateJWT, upload.single('profile_image'), adminController.updateUser);

// Delete user
router.delete('/user/:user_id', authenticateJWT, adminController.deleteUser);

// Bulk endpoints
router.post('/users/bulk', authenticateJWT, upload.single('file'), adminController.bulkUpload);
router.post('/users/bulk-validate', authenticateJWT, adminController.bulkValidate);
router.post('/users/bulk-json', authenticateJWT, adminController.bulkJson);

export default router;
