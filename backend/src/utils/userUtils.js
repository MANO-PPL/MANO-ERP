/**
 * Centralized utility for user role identification and type normalization.
 * Single Source of Truth for backend user role checks.
 */

export function normalizeUserType(user_type) {
    if (!user_type) return 'employee';
    const norm = user_type.toString().trim().toLowerCase();
    if (['admin', 'superadmin', 'super_admin', 'owner'].includes(norm)) return 'admin';
    if (norm === 'client') return 'client';
    return 'employee';
}

export function isAdmin(userOrType) {
    if (!userOrType) return false;
    if (typeof userOrType === 'object') {
        if (Boolean(userOrType.is_super_admin) || Boolean(userOrType.isAdmin)) return true;
        const type = userOrType.user_type;
        return normalizeUserType(type) === 'admin';
    }
    return normalizeUserType(userOrType) === 'admin';
}

export function isClient(userOrType) {
    const type = typeof userOrType === 'object' ? userOrType?.user_type : userOrType;
    return normalizeUserType(type) === 'client';
}

export function isEmployee(userOrType) {
    const type = typeof userOrType === 'object' ? userOrType?.user_type : userOrType;
    return normalizeUserType(type) === 'employee';
}

export default {
    normalizeUserType,
    isAdmin,
    isClient,
    isEmployee
};
