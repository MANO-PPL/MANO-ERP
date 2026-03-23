import catchAsync from '../../utils/catchAsync.js';
import authService from './authService.js';

const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 Days

export const login = catchAsync(async (req, res, next) => {
    // Support various authentication identifiers
    const user_input = req.body.email || req.body.phone_no || req.body.username || req.body.user_input;
    const user_password = req.body.password || req.body.user_password;

    if (!user_input || !user_password) {
        return res.status(400).json({
            message: "Email/Phone and password are required."
        });
    }

    const result = await authService.authenticateUser(user_input, user_password, req);

    res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
        path: '/'
    });

    res.status(200).json({
        success: true,
        accessToken: result.accessToken,
        user: result.user
    });
});

export const refresh = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    const result = await authService.refreshAccessToken(refreshToken, req);

    res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
        path: '/'
    });

    res.status(200).json({
        success: true,
        accessToken: result.accessToken,
        user: result.user
    });
});

export const logout = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    await authService.logoutUser(refreshToken);

    res.clearCookie('refreshToken', { path: '/' });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export default { login, refresh, logout };
