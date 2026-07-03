
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

export const authenticateJWT = catchAsync(async (req, res, next) => {
    let token;
    const authHeader = req.headers['authorization'];

    if (authHeader && authHeader.startsWith("Bearer ")) {
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

        user = await db('iam_users').where({ user_id: decoded.user_id }).first();

        if (!user) {
            return res.status(403).json({ message: "Forbidden: Invalid token user" });
        }

        // Standardize req.user
        req.user = {
            ...decoded,
            id: user.user_id || user.id, // standardized ID accessor
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

        // Superadmin bypass
        if (user_type === 'admin') {
            return next();
        }

        // Clients have no access to global system-level modules
        if (user_type === 'client') {
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

    // Superadmin bypass
    if (user_type === 'admin') {
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

        // Superadmin bypass
        if (user_type === 'admin') {
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

            const userRole = projectPerms?.[module] || 'none';

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
        if (!req.user || !roles.includes(req.user.user_type)) {
            return res.status(403).json({ success: false, message: `Forbidden: role '${req.user?.user_type}' not in [${roles.join(',')}]` });
        }
        next();
    };
};
