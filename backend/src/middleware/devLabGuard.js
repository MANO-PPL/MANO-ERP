import AppError from '../utils/AppError.js';
import { isAdmin } from '../utils/userUtils.js';

export function isDevLabEnabled() {
    return process.env.ENABLE_DEV_LAB === 'true';
}

export function requireDevLabClearance(req, res, next) {
    // -------------------------------------------------------------
    // GATE 1: Authenticated User Check (Populated by authenticateJWT)
    // -------------------------------------------------------------
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'DEV_LAB_UNAUTHORIZED',
                message: 'Unauthorized: Access requires an active authenticated session'
            }
        });
    }

    // -------------------------------------------------------------
    // GATE 2: Environment Kill-Switch
    // If not explicitly set to 'true', respond with 404 so route behaves as non-existent
    // -------------------------------------------------------------
    if (!isDevLabEnabled()) {
        return res.status(404).json({
            success: false,
            error: {
                code: 'DEV_LAB_DISABLED',
                message: 'Endpoint not available: ENABLE_DEV_LAB is disabled in environment'
            }
        });
    }

    // -------------------------------------------------------------
    // GATE 3: Whitelisted User ID or Email Check
    // -------------------------------------------------------------
    const allowedUserIds = (process.env.DEV_LAB_ALLOWED_USERS || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

    const allowedEmails = (process.env.DEV_LAB_ALLOWED_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);

    const currentUserId = String(req.user.id);
    const currentUserEmail = (req.user.email || '').toLowerCase().trim();

    const isWhitelisted = 
        allowedUserIds.includes(currentUserId) || 
        allowedEmails.includes(currentUserEmail);

    if (!isWhitelisted) {
        console.warn(`[SECURITY] User #${req.user.id} (${req.user.email}) attempted to access Dev Lab without clearance.`);
        return res.status(403).json({
            success: false,
            error: {
                code: 'DEV_LAB_NOT_WHITELISTED',
                message: `Forbidden: User #${req.user.id} (${req.user.email || 'no email'}) is not in DEV_LAB_ALLOWED_USERS or DEV_LAB_ALLOWED_EMAILS whitelist`
            }
        });
    }

    // -------------------------------------------------------------
    // GATE 4: Role Verification (Admin required for lab engine access)
    // -------------------------------------------------------------
    if (!isAdmin(req.user)) {
        return res.status(403).json({
            success: false,
            error: {
                code: 'DEV_LAB_ADMIN_REQUIRED',
                message: 'Forbidden: Administrator role required to access Developer Lab'
            }
        });
    }

    next();
}

