
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { isAdmin, isClient } from '../utils/userUtils.js';

export const authenticateJWT = catchAsync(async (req, res, next) => {
    let token = req.cookies?.accessToken;
    const authHeader = req.headers['authorization'];

    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }

    if (!token) {
        // If we want to return JSON 401 directly like LoginAPI did:
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user;

        // Check based on token contents
        // User tokens (issued by LoginAPI.js) have user_type='employee'/'admin'/etc.

        const targetUserId = decoded.user_id || decoded.id;
        user = await db('iam_users').where({ user_id: targetUserId }).first();

        if (!user) {
            return res.status(403).json({ message: "Forbidden: Invalid token user" });
        }

        // Standardize req.user
        req.user = {
            ...decoded,
            id: user.user_id || user.id, // standardized ID accessor
            user_id: user.user_id || user.id,
            // Use the current database value so tokens issued before org_id was
            // added (or with a stale org_id) still work for org-scoped routes.
            org_id: user.org_id,
            user_type: user.user_type ? user.user_type.toLowerCase() : 'employee',
            system_permissions: user.system_permissions
        };

        next();

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({ message: "Forbidden: Token expired" });
        }
        console.error("Auth Middleware Error:", err);
        return res.status(403).json({ message: "Forbidden: Invalid or expired token" });
    }
});

const hasAccess = (userRole, requiredLevel) => {
    if (!userRole || userRole === 'none') return false;
    if (requiredLevel === 'view') {
        return userRole === 'view' || userRole === 'edit';
    }
    if (requiredLevel === 'edit') {
        return userRole === 'edit';
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

        const userRole = permissions?.[module] || 'none';

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
    const { id: user_id, user_type, org_id } = req.user;
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
            .where({ project_id: projectId, user_id, org_id })
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
        const { id: user_id, user_type, org_id } = req.user;
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
                .where({ project_id: projectId, user_id, org_id })
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
                    projectPerms = {};
                }
            }

            // Map General Documents sub-resources to the parent 'General Documents' page permission if not explicitly set
            const generalDocsMapping = {
                'directory': 'General Documents',
                'parties': 'General Documents',
                'staff': 'General Documents',
                'summary': 'General Documents',
                'agenda': 'General Documents',
                'mom': 'General Documents',
                'org': 'General Documents',
                'instances': 'General Documents'
            };

            const mappedModule = generalDocsMapping[module] || module;
            const userRole = projectPerms?.[module] || projectPerms?.[mappedModule] || 'none';

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
        const userRole = req.user?.user_type?.toLowerCase();
        const allowedRoles = roles.map(r => r.toLowerCase());

        if (!req.user || !allowedRoles.includes(userRole)) {
            console.warn(`[AUTH] Access Denied: Path ${req.originalUrl} - User role '${userRole}' not in allowed roles [${roles.join(', ')}]`);
            return res.status(403).json({ success: false, message: `Forbidden: role '${req.user?.user_type}' not in [${roles.join(',')}]` });
        }
        next();
    };
};
