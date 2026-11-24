import db from '../../config/database.js';
import s3Service from '../shared/s3Service.js';
import mediaService from '../shared/mediaService.js';
import sharp from 'sharp';
import AppError from '../../utils/AppError.js';

/**
 * Upload and update a user's profile picture in S3.
 * Stored under: org_${orgId}/profiles/${userCode}.webp
 */
export async function uploadProfilePicture(userId, fileBuffer) {
    const user = await db('iam_users')
        .where({ id: userId })
        .select('id', 'user_code', 'org_id', 'profile_image_url')
        .first();

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const orgId = user.org_id || 1;
    const rawCode = user.user_code || `user_${userId}`;
    const safeUserCode = String(rawCode).trim().replace(/[^a-zA-Z0-9_-]/g, '_');

    // 1. Compress image to WebP using sharp (resize to max 1024x1024, quality: 85)
    let processedBuffer;
    let contentType = 'image/webp';
    let fileExtension = 'webp';

    try {
        processedBuffer = await sharp(fileBuffer, { animated: true })
            .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85, lossless: false })
            .toBuffer();
    } catch (sharpError) {
        console.warn('[profileService] Sharp compression fallback:', sharpError.message);
        processedBuffer = fileBuffer;
        contentType = 'image/jpeg';
        fileExtension = 'jpg';
    }

    // 2. Folder structure: org_{orgId}/profiles with timestamp for instant cache-busting
    const timestamp = Date.now();
    const folder = `org_${orgId}/profiles`;
    const fileName = `${safeUserCode}_${timestamp}.${fileExtension}`;
    const s3Key = `${folder}/${fileName}`;

    // 3. Delete existing media if user already has an avatar
    if (user.profile_image_url) {
        try {
            await mediaService.deleteMedia(user.profile_image_url);
        } catch (delErr) {
            console.warn('[profileService] Non-fatal delete old avatar warning:', delErr.message);
        }
    }

    // 4. Upload to S3
    const uploadedUrl = await s3Service.uploadFile(processedBuffer, fileName, folder, contentType);

    // 5. Update database record
    await db('iam_users')
        .where({ id: userId })
        .update({
            profile_image_url: uploadedUrl,
            updated_at: db.fn.now()
        });

    // 6. Generate presigned URL for immediate display
    const presignedUrl = await mediaService.presignUrl(uploadedUrl);

    return {
        url: presignedUrl || uploadedUrl,
        rawUrl: uploadedUrl,
        key: s3Key
    };
}

/**
 * Delete a user's profile picture from S3 and reset database field.
 */
export async function deleteProfilePicture(userId) {
    const user = await db('iam_users')
        .where({ id: userId })
        .select('id', 'profile_image_url')
        .first();

    if (!user) {
        return false;
    }

    if (user.profile_image_url) {
        try {
            await mediaService.deleteMedia(user.profile_image_url);
        } catch (error) {
            console.error('[profileService] Error deleting avatar from S3:', error);
        }
    }

    await db('iam_users')
        .where({ id: userId })
        .update({
            profile_image_url: null,
            updated_at: db.fn.now()
        });

    return true;
}

/**
 * Get the current user's profile info with department, designation, and presigned avatar.
 */
export async function getMyProfile(userId) {
    const user = await db('iam_users as users')
        .leftJoin('iam_departments as departments', 'users.dept_id', 'departments.id')
        .leftJoin('iam_designations as designations', 'users.desg_id', 'designations.id')
        .select(
            'users.id',
            'users.user_code',
            'users.user_name',
            'users.email',
            'users.phone_no',
            'users.org_id',
            'users.user_type',
            'users.profile_image_url',
            'users.system_permissions',
            'departments.dept_name',
            'designations.desg_name'
        )
        .where('users.id', userId)
        .first();

    if (!user) return null;

    let presignedAvatar = null;
    if (user.profile_image_url) {
        try {
            presignedAvatar = await mediaService.presignUrl(user.profile_image_url);
        } catch (e) {
            presignedAvatar = user.profile_image_url;
        }
    }

    let parsedPerms = null;
    if (user.system_permissions) {
        try {
            parsedPerms = typeof user.system_permissions === 'string'
                ? JSON.parse(user.system_permissions)
                : user.system_permissions;
        } catch (e) {
            parsedPerms = null;
        }
    }

    return {
        id: user.id,
        user_id: user.id,
        user_code: user.user_code,
        user_name: user.user_name,
        email: user.email,
        phone_no: user.phone_no,
        org_id: user.org_id,
        user_type: user.user_type,
        profile_image_url: presignedAvatar || user.profile_image_url,
        dept_name: user.dept_name,
        desg_name: user.desg_name,
        system_permissions: parsedPerms
    };
}
