import * as profileService from './profileService.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';

/**
 * POST /profile - Upload profile picture
 */
export const uploadProfilePicture = catchAsync(async (req, res) => {
    const userId = req.user?.id || req.user?.user_id;
    const file = req.file;

    if (!file || !file.buffer) {
        throw new AppError('No image file provided', 400);
    }

    const result = await profileService.uploadProfilePicture(userId, file.buffer);

    res.json({
        ok: true,
        success: true,
        message: 'Profile picture updated successfully',
        profile_image_url: result.url,
        raw_url: result.rawUrl
    });
});

/**
 * DELETE /profile - Remove profile picture
 */
export const deleteProfilePicture = catchAsync(async (req, res) => {
    const userId = req.user?.id || req.user?.user_id;

    const deleted = await profileService.deleteProfilePicture(userId);

    if (!deleted) {
        throw new AppError('User not found', 404);
    }

    res.json({
        ok: true,
        success: true,
        message: 'Profile picture removed successfully'
    });
});

/**
 * GET /profile/me - Get current user profile
 */
export const getMyProfile = catchAsync(async (req, res) => {
    const userId = req.user?.id || req.user?.user_id;

    const user = await profileService.getMyProfile(userId);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    res.json({
        ok: true,
        success: true,
        user
    });
});
