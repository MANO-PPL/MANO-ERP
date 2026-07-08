import express from 'express';
import multer from 'multer';
import vendorController from './vendorController.js';
import { authenticateJWT, requireSystemPermission } from '../../middleware/auth.js';

const router = express.Router();
const upload = multer();

// Apply auth to all vendor routes
router.use(authenticateJWT);

// Publicly readable for all authenticated users to allow picking vendors for projects
router.get('/', vendorController.listVendors);
router.get('/:id', vendorController.getVendor);

// Restrict modifications and bulk operations to users with 'vendors' system permission
router.use(requireSystemPermission('vendors'));

router.post('/bulk', upload.single('file'), vendorController.bulkUpload);
router.post('/bulk-validate', vendorController.bulkValidate);
router.post('/bulk-json', vendorController.bulkJson);

// Modifications
router.post('/', vendorController.createVendor);
router.put('/:id', vendorController.updateVendor);
router.delete('/', vendorController.deleteVendors);

export default router;
