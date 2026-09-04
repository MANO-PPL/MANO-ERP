import catchAsync from '../../utils/catchAsync.js';
import authService from './authService.js';

const REFRESH_TOKEN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 Days
const ACCESS_TOKEN_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 Minutes

export const login = catchAsync(async (req, res, next) => {
    // Support various authentication identifiers
    const user_input = req.body.email || req.body.phone_no || req.body.username || req.body.user_input;
    const user_password = req.body.password || req.body.user_password;
    const rememberMe = req.body.rememberMe === true || req.body.remember_me === true;

    if (!user_input || !user_password) {
        return res.status(400).json({
            message: "Email/Phone and password are required."
        });
    }

    const result = await authService.authenticateUser(user_input, user_password, req, rememberMe);

    // HttpOnly refresh token cookie (30 Days if rememberMe, otherwise Session cookie)
    const refreshOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        path: '/'
    };
    if (rememberMe) {
        refreshOpts.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
    }
    res.cookie('refreshToken', result.refreshToken, refreshOpts);

    // HttpOnly access token cookie (15 Minutes)
    res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
        path: '/'
    });

    // Non-HttpOnly userType cookie (30 Days if rememberMe, otherwise Session cookie) so frontend JS can read it
    const userTypeOpts = {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        path: '/'
    };
    if (rememberMe) {
        userTypeOpts.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
    }
    res.cookie('userType', result.user.user_type, userTypeOpts);

    res.status(200).json({
        success: true,
        accessToken: result.accessToken,
        user: result.user
    });
});

export const refresh = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    const result = await authService.refreshAccessToken(refreshToken, req);
    const rememberMe = !!result.rememberMe;

    // HttpOnly refresh token cookie (30 Days if rememberMe, otherwise Session cookie)
    const refreshOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        path: '/'
    };
    if (rememberMe) {
        refreshOpts.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
    }
    res.cookie('refreshToken', result.refreshToken, refreshOpts);

    // HttpOnly access token cookie (15 Minutes)
    res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
        path: '/'
    });

    // Non-HttpOnly userType cookie (30 Days if rememberMe, otherwise Session cookie) so frontend JS can read it
    const userTypeOpts = {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        path: '/'
    };
    if (rememberMe) {
        userTypeOpts.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
    }
    res.cookie('userType', result.user.user_type, userTypeOpts);

    res.status(200).json({
        success: true,
        accessToken: result.accessToken,
        user: result.user
    });
});

export const logout = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    await authService.logoutUser(refreshToken);

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('userType', { path: '/' });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export const getMe = catchAsync(async (req, res, next) => {
    const user = await authService.getUserProfile(req.user.id || req.user.user_id);
    res.status(200).json({
        success: true,
        user
    });
});

export default { login, refresh, logout, getMe };
