import express from 'express';
import multer from 'multer';
import vendorController from './vendorController.js';
import { authenticateJWT, restrictTo } from '../../middleware/auth.js';

const router = express.Router();
const upload = multer();

// Apply auth middleware to all vendor routes
//router.use(authenticateJWT);

// Publicly readable for authenticated users
router.get('/', vendorController.listVendors);
router.post('/bulk', upload.single('file'), vendorController.bulkUpload);
router.post('/bulk-validate', vendorController.bulkValidate);
router.post('/bulk-json', vendorController.bulkJson);
router.get('/:id', vendorController.getVendor);

// Modifications restricted to admin and hr
router.post('/', vendorController.createVendor);
router.put('/:id', vendorController.updateVendor);
router.delete('/', vendorController.deleteVendors);

export default router;
