import express from 'express';
import meetingController from './meetingController.js';

const router = express.Router({ mergeParams: true });

router.get('/', meetingController.getMeetings);
router.get('/:meetingId', meetingController.getMeeting);
router.post('/', meetingController.createMeeting);
router.put('/:meetingId', meetingController.updateMeeting);
router.delete('/:meetingId', meetingController.deleteMeeting);

export default router;
