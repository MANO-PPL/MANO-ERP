
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { isAdmin, isClient } from '../utils/userUtils.js';

export const authenticateJWT = catchAsync(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const rawBearer = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const bearerToken = (rawBearer && rawBearer !== 'null' && rawBearer !== 'undefined' && rawBearer !== '') ? rawBearer : null;
    const rawCookie = req.cookies?.accessToken ? String(req.cookies.accessToken).trim() : null;
    const cookieToken = (rawCookie && rawCookie !== 'null' && rawCookie !== 'undefined' && rawCookie !== '') ? rawCookie : null;

    const candidateTokens = [bearerToken, cookieToken].filter(Boolean);

    if (candidateTokens.length === 0) {
        return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
    }

    let decoded = null;
    let lastError = null;
    for (const token of candidateTokens) {
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded) break;
        } catch (err) {
            lastError = err;
        }
    }

    if (!decoded) {
        if (lastError?.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: "Unauthorized: Token expired", expired: true });
        }
        if (lastError?.name === 'JsonWebTokenError' || lastError?.name === 'NotBeforeError') {
            return res.status(401).json({ success: false, message: `Unauthorized: ${lastError.message}` });
        }
        // Routine token rejection - log as concise warning without dumping a stack trace
        console.warn(`[AUTH] Token rejected: ${lastError?.message || 'Invalid token'}`);
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
    }

    try {
        const targetUserId = decoded.id || decoded.user_id;
        const user = await db('iam_users').where({ id: targetUserId }).first();

        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized: User account not found" });
        }

        // Standardize req.user
        req.user = {
            ...decoded,
            id: user.id,
            user_id: user.id, // compatibility alias
            // Use the current database value so tokens issued before id was
            // added (or with a stale org_id) still work for org-scoped routes.
            org_id: user.org_id,
            user_type: user.user_type ? user.user_type.toLowerCase() : 'employee',
            system_permissions: user.system_permissions
        };

        next();
    } catch (err) {
        console.error("Auth Middleware User Lookup Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error during user lookup" });
    }
});

const hasAccess = (userRole, requiredLevel) => {
    if (userRole === null || userRole === undefined || userRole === 'none' || userRole === 0) return false;
    if (typeof userRole === 'number') {
        // Numeric levels: 1 = view, 2 = edit, 3 = admin/full
        if (requiredLevel === 'view') return userRole >= 1;
        if (requiredLevel === 'edit') return userRole >= 2;
    }
    const roleStr = String(userRole).toLowerCase().trim();
    if (roleStr === 'admin' || roleStr === 'full') return true;
    if (requiredLevel === 'view') {
        return roleStr === 'view' || roleStr === 'edit';
    }
    if (requiredLevel === 'edit') {
        return roleStr === 'edit';
    }
    return false;
};

export const requireSystemPermission = (module) => {
    return (req, res, next) => {
        const { user_type, system_permissions } = req.user;
        const requiredLevel = req.method === 'GET' ? 'view' : 'edit';

        // Admin bypass via central userUtils
        if (isAdmin(req.user)) {
            return next();
        }

        // Clients have no access to global system-level modules
        if (isClient(req.user)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: Clients do not have access to global administration modules."
            });
        }

        let permissions = system_permissions;
        if (typeof system_permissions === 'string') {
            try {
                permissions = JSON.parse(system_permissions);
            } catch (e) {
                permissions = {};
            }
        }

        // Resolve permission with case-insensitive fallback; default to 'none' (deny by default)
        const normModule = String(module).toLowerCase().trim();
        const userRole = permissions?.[module] ?? permissions?.[normModule] ?? 'none';

        if (hasAccess(userRole, requiredLevel)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: `Forbidden: You do not have '${requiredLevel}' access to ${module}.`
        });
    };
};

export const requireProjectAssignment = async (req, res, next) => {
    const userId = req.user.id;
    const { user_type, org_id } = req.user;
    const projectId = req.params.projectId || req.params.id;

    if (!projectId) {
        return res.status(400).json({ success: false, message: "Project ID is required" });
    }

    // Admin bypass via central userUtils
    if (isAdmin(req.user)) {
        return next();
    }

    try {
        const projectUser = await db('proj_members')
            .where({ project_id: projectId, user_id: userId, org_id })
            .first();

        if (!projectUser) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: You are not assigned to this project."
            });
        }

        next();
    } catch (error) {
        console.error("Project Assignment Guard Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error during project check." });
    }
};

export const requireProjectPermission = (module) => {
    return async (req, res, next) => {
        const userId = req.user.id;
        const { user_type, org_id } = req.user;
        const projectId = req.params.projectId || req.params.id;
        const requiredLevel = req.method === 'GET' ? 'view' : 'edit';

        if (!projectId) {
            return res.status(400).json({ success: false, message: "Project ID is required" });
        }

        // Admin bypass via central userUtils
        if (isAdmin(req.user)) {
            return next();
        }

        try {
            const projectUser = await db('proj_members')
                .where({ project_id: projectId, user_id: userId, org_id })
                .first();

            if (!projectUser) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: You are not assigned to this project."
                });
            }

            // Predefined client privilege: read-only (GET) view access
            if (user_type === 'client') {
                if (requiredLevel === 'view') {
                    return next();
                }
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: Clients are restricted to read-only access in this project."
                });
            }

            let projectPerms = projectUser.project_permissions;
            if (typeof projectPerms === 'string') {
                try {
                    projectPerms = JSON.parse(projectPerms);
                } catch (e) {
                    projectPerms = null;
                }
            }

            // Map General Documents sub-resources to the parent 'General Documents' page permission if not explicitly set
            const generalDocsMapping = {
                'directory': 'General Documents',
                'parties': 'General Documents',
                'summary': 'General Documents',
                'agenda': 'General Documents',
                'mom': 'General Documents',
                'org': 'General Documents',
                'instances': 'General Documents'
            };

            const mappedModule = generalDocsMapping[module] || module;
            // Resolve with case-insensitive key lookup; default to 'none' (deny by default)
            // Dashboard access is always granted at the frontend level; backend tabs use this guard
            const normModule = String(module).toLowerCase().trim();
            const normMapped = String(mappedModule).toLowerCase().trim();
            const userRole = projectPerms?.[module]
                ?? projectPerms?.[mappedModule]
                ?? projectPerms?.[normModule]
                ?? projectPerms?.[normMapped]
                ?? 'none';

            if (hasAccess(userRole, requiredLevel)) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: `Forbidden: You do not have '${requiredLevel}' access to ${module} in this project.`
            });
        } catch (error) {
            console.error("Project Permission Guard Error:", error);
            return res.status(500).json({ success: false, message: "Internal server error during authorization check." });
        }
    };
};

export const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (isAdmin(req.user)) {
            return next();
        }
        const userRole = req.user?.user_type?.toLowerCase();
        const allowedRoles = roles.map(r => r.toLowerCase());

        if (!req.user || !allowedRoles.includes(userRole)) {
            console.warn(`[AUTH] Access Denied: Path ${req.originalUrl} - User role '${userRole}' not in allowed roles [${roles.join(', ')}]`);
            return res.status(403).json({ success: false, message: `Forbidden: role '${req.user?.user_type}' not in [${roles.join(',')}]` });
        }
        next();
    };
};
