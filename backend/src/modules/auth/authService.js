import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../../config/database.js';
import * as TokenService from './tokenService.js';
import EventBus from '../../utils/EventBus.js';
import { getEventSource } from '../../utils/clientInfo.js';
import AppError from '../../utils/AppError.js';

const ACCESS_TOKEN_EXPIRY = '15m';

/**
 * Helper to format user response safely and parse permissions
 */
function formatUserResponse(user) {
    let systemPerms = user.system_permissions;
    if (typeof systemPerms === 'string') {
        try {
            systemPerms = JSON.parse(systemPerms);
        } catch (e) {
            systemPerms = null;
        }
    }

    return {
        id: user.user_id,
        user_code: user.user_code,
        user_name: user.user_name,
        email: user.email,
        phone_no: user.phone_no,
        user_type: user.user_type,
        profile_image_url: user.profile_image_url,
        dept_name: user.dept_name || null,
        desg_name: user.desg_name || null,
        system_permissions: systemPerms || null
    };
}

/**
 * Authenticate user with email/phone and password
 * Returns access token, refresh token and user data
 */
export async function authenticateUser(userInput, password, req) {
    const user = await db('iam_users as users')
        .leftJoin('iam_departments as departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('iam_designations as designations', 'users.desg_id', 'designations.desg_id')
        .select(
            'users.user_id',
            'users.user_code',
            'users.user_name',
            'users.user_password',
            'users.email',
            'users.phone_no',
            'users.org_id',
            'users.user_type',
            'users.profile_image_url',
            'users.system_permissions',
            'departments.dept_name',
            'designations.desg_name'
        )
        .where('users.email', userInput)
        .orWhere('users.phone_no', userInput)
        .first();

    if (!user) throw new AppError('User not found', 401);

    const isMatch = await bcrypt.compare(password, user.user_password);
    if (!isMatch) throw new AppError('Incorrect Password', 401);

    const payload = {
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        user_type: user.user_type,
        org_id: user.org_id,
        profile_image_url: user.profile_image_url
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    const refreshToken = TokenService.generateRefreshToken();
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';

    await TokenService.saveRefreshToken(user.user_id, refreshToken, ipAddress, userAgent);

    EventBus.emitActivityLog({
        user_id: user.user_id,
        org_id: user.org_id,
        event_type: 'LOGIN',
        event_source: getEventSource(req),
        object_type: 'USER',
        object_id: user.user_id,
        description: 'User logged in successfully',
        request_ip: ipAddress,
        user_agent: userAgent
    });

    return {
        accessToken,
        refreshToken,
        user: formatUserResponse(user)
    };
}

/**
 * Refresh access token using refresh token from cookie
 */
export async function refreshAccessToken(refreshToken, req) {
    if (!refreshToken) throw new AppError('Refresh token required', 401);

    const result = await TokenService.verifyRefreshToken(refreshToken);
    if (!result || result.error) throw new AppError('Invalid or expired refresh token', 403);

    const user = result.user;
    const payload = {
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        user_type: user.user_type,
        org_id: user.org_id,
        profile_image_url: user.profile_image_url
    };

    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    let newRefreshToken = refreshToken;
    if (result.gracePeriodActive && result.activeRefreshToken) {
        newRefreshToken = result.activeRefreshToken;
    } else {
        newRefreshToken = TokenService.generateRefreshToken();
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';
        await TokenService.saveRefreshToken(user.user_id, newRefreshToken, ipAddress, userAgent);
        await TokenService.revokeRefreshToken(refreshToken, newRefreshToken);
    }

    return { 
        accessToken: newAccessToken, 
        refreshToken: newRefreshToken, 
        user: formatUserResponse(user) 
    };
}

/**
 * Logout user by revoking refresh token
 */
export async function logoutUser(refreshToken) {
    if (refreshToken) await TokenService.revokeRefreshToken(refreshToken);
}

export default { authenticateUser, refreshAccessToken, logoutUser };
