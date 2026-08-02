/**
 * Centralized utility for user role identification and type normalization.
 * Single Source of Truth for backend user role checks.
 */

export function normalizeUserType(user_type) {
    if (!user_type) return 'employee';
    const norm = user_type.toString().trim().toLowerCase();
    if (norm === 'admin') return 'admin';
    if (norm === 'client') return 'client';
    return 'employee';
}

export function isAdmin(userOrType) {
    const type = typeof userOrType === 'object' ? userOrType?.user_type : userOrType;
    return normalizeUserType(type) === 'admin';
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
