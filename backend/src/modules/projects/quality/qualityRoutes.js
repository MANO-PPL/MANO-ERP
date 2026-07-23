import express from 'express';
import multer from 'multer';
import qualityController from './qualityController.js';

const router = express.Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

// Observations CRUD
router.get('/', qualityController.listObservations);
router.post('/', upload.single('photo'), qualityController.createObservation);
router.put('/:obsId', upload.single('photo'), qualityController.updateObservation);
router.post('/:obsId/fix', upload.single('photo'), qualityController.submitFix);
router.post('/:obsId/approve', qualityController.approveFix);
router.delete('/:obsId', qualityController.deleteObservation);

// Methodology Document Manager
router.get('/methodology', qualityController.listMethodologies);
router.post('/methodology', upload.single('file'), qualityController.createMethodology);
router.delete('/methodology/:docId', qualityController.deleteMethodology);

// Checklist & Snaglist Document Manager
router.get('/checklist', qualityController.listChecklists);
router.post('/checklist', upload.single('file'), qualityController.createChecklist);
router.delete('/checklist/:docId', qualityController.deleteChecklist);

export default router;


