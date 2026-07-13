import express from 'express';
import multer from 'multer';
import adminController from './adminController.js';
import permissionController from './permissionController.js';
import { authenticateJWT, restrictTo } from '../../middleware/auth.js';

const router = express.Router();
const upload = multer(); // memory storage

// Apply auth globally
router.use(authenticateJWT);

// Read-only reference data routes accessible by admin and employee
router.get('/users', restrictTo('admin', 'employee'), adminController.listUsers);
router.get('/departments', restrictTo('admin', 'employee'), adminController.listDepartments);
router.get('/designations', restrictTo('admin', 'employee'), adminController.listDesignations);
router.get('/sectors', restrictTo('admin', 'employee'), adminController.listSectors);
router.get('/job-natures', restrictTo('admin', 'employee'), adminController.listJobNatures);

// Restrict all mutation/admin-only routes below
router.use(restrictTo('admin'));

// Users detail/mutation routes
router.get('/user/:user_id', adminController.getUser);
router.post('/user', adminController.createUser);
router.put('/user/:user_id', upload.single('profile_image'), adminController.updateUser); // image is optional
router.delete('/user/:user_id', adminController.deleteUser);

// Bulk endpoints
router.post('/users/bulk', upload.single('file'), adminController.bulkUpload);
router.post('/users/bulk-validate', adminController.bulkValidate);
router.post('/users/bulk-json', adminController.bulkJson);

// Departments
router.post('/departments', adminController.createDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);

// Designations
router.post('/designations', adminController.createDesignation);
router.delete('/designations/:id', adminController.deleteDesignation);

// Sectors
router.post('/sectors', adminController.createSector);
router.delete('/sectors/:id', adminController.deleteSector);

// Job Natures
router.post('/job-natures', adminController.createJobNature);
router.delete('/job-natures/:id', adminController.deleteJobNature);

// Permission Templates
router.get('/permission-templates', permissionController.listTemplates);
router.post('/permission-templates', permissionController.createTemplate);
router.put('/permission-templates/:id', permissionController.updateTemplate);
router.delete('/permission-templates/:id', permissionController.deleteTemplate);

export default router;
