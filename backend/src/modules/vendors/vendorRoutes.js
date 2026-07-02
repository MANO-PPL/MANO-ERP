import express from 'express';
import multer from 'multer';
import vendorController from './vendorController.js';
import { authenticateJWT, requireSystemPermission } from '../../middleware/auth.js';

const router = express.Router();
const upload = multer();

// Apply auth and permission checks to all vendor routes
router.use(authenticateJWT);
router.use(requireSystemPermission('vendors'));

// Publicly readable/writable based on none/view/edit permission settings
router.get('/', vendorController.listVendors);
router.post('/bulk', upload.single('file'), vendorController.bulkUpload);
router.post('/bulk-validate', vendorController.bulkValidate);
router.post('/bulk-json', vendorController.bulkJson);
router.get('/:id', vendorController.getVendor);

// Modifications
router.post('/', vendorController.createVendor);
router.put('/:id', vendorController.updateVendor);
router.delete('/', vendorController.deleteVendors);

export default router;
