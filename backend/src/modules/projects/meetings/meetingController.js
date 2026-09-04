import catchAsync from '../../../utils/catchAsync.js';
import AppError from '../../../utils/AppError.js';
import meetingService from './meetingService.js';

export const getMeetings = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const result = await meetingService.fetchProjectMeetings(projectId);
    res.json({ success: true, ...result });
});

export const getMeeting = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(projectId) || isNaN(meetingId)) throw new AppError('Invalid project_id or meetingId', 400);

    const meeting = await meetingService.fetchMeetingById(projectId, meetingId);
    res.json({ success: true, meeting });
});

export const createMeeting = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new AppError('Invalid project_id', 400);

    const result = await meetingService.createMeeting(projectId, req.body);
    res.status(201).json({ success: true, message: 'Meeting created successfully', ...result });
});

export const updateMeeting = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(projectId) || isNaN(meetingId)) throw new AppError('Invalid project_id or meetingId', 400);

    const result = await meetingService.updateMeeting(projectId, meetingId, req.body);
    res.json({ success: true, message: 'Meeting updated successfully', ...result });
});

export const deleteMeeting = catchAsync(async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const meetingId = parseInt(req.params.meetingId, 10);
    if (isNaN(projectId) || isNaN(meetingId)) throw new AppError('Invalid project_id or meetingId', 400);

    const result = await meetingService.deleteMeeting(projectId, meetingId);
    res.json({ success: true, message: 'Meeting deleted successfully', ...result });
});

export default {
    getMeetings,
    getMeeting,
    createMeeting,
    updateMeeting,
    deleteMeeting
};
