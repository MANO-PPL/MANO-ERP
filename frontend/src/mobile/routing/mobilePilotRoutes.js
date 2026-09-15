export const MOBILE_PILOT_PATHS = Object.freeze([
    '/',
    '/projects',
    '/projects/create',
    '/projects/new',
    '/vendors',
    '/vendors/bulk-upload',
    '/clients',
    '/clients/bulk-upload',
    '/resources',
    '/resources/bulk-upload',
    '/spreadsheets',
    '/collaboration',
    '/admin',
]);

export function normalizePilotPath(pathname) {
    if (typeof pathname !== 'string' || pathname.length === 0) return '/';
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

export function isMobilePilotPath(pathname) {
    const normalized = normalizePilotPath(pathname);
    if (MOBILE_PILOT_PATHS.includes(normalized)) return true;
    return /^\/projects\/[^/]+$/.test(normalized) && normalized !== '/projects/create' && normalized !== '/projects/new';
}
