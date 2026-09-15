export const MOBILE_PROJECT_MODULES = Object.freeze([
    { key: 'Dashboard', label: 'Dashboard', classification: 'standard', stage: 'M5' },
    { key: 'Tasks', label: 'Tasks', classification: 'standard', stage: 'M5', permission: 'Tasks' },
    { key: 'WIP', label: 'WIP', classification: 'advanced', stage: 'M5', permission: 'WIP' },
    { key: 'Reports', label: 'Reports', classification: 'advanced', stage: 'M10', permission: 'Reports' },
    { key: 'General Documents', label: 'General Documents', classification: 'standard', stage: 'M6', permission: 'General Documents' },
    { key: 'Spreadsheets', label: 'Spreadsheets', classification: 'specialized', stage: 'M11', permission: 'Spreadsheets' },
    { key: 'Drawings', label: 'Drawings', classification: 'specialized', stage: 'M11', permission: 'Drawings' },
    { key: 'Planning', label: 'Planning', classification: 'advanced', stage: 'M9', permission: 'Planning' },
    { key: 'Phases', label: 'Phases', classification: 'standard', stage: 'M5', permission: 'Phases' },
    { key: 'Contracts', label: 'Contracts', classification: 'advanced', stage: 'M9', permission: 'Contracts' },
    { key: 'Quality', label: 'Quality', classification: 'specialized', stage: 'M7', permission: 'Quality' },
    { key: 'Safety', label: 'Safety', classification: 'specialized', stage: 'M7', permission: 'Safety' },
    { key: 'Billing', label: 'Billing', classification: 'advanced', stage: 'M9', permission: 'Billing' },
    { key: 'Material Management', label: 'Material Management', classification: 'advanced', stage: 'M7', permission: 'Material Management' },
    { key: 'Transactions', label: 'Transactions', classification: 'advanced', stage: 'M8', permission: 'Transactions' },
    { key: 'Approvals', label: 'Approvals', classification: 'specialized', stage: 'M9', permission: 'Approvals' },
    { key: 'Settings', label: 'Settings', classification: 'standard', stage: 'M5', permission: 'Settings' },
]);

export const PROJECT_DEFAULT_MODULE = 'Dashboard';

export function normalizeProjectPermissionLevel(value) {
    if (typeof value === 'string') {
        return { none: 0, view: 1, read: 1, edit: 2, write: 2, full: 3, admin: 3 }[value.toLowerCase()] ?? 0;
    }
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function normalizeProjectPermissions(rawPermissions = {}) {
    return Object.fromEntries(Object.entries(rawPermissions || {}).map(([key, value]) => [key, normalizeProjectPermissionLevel(value)]));
}

export function getProjectPermissionLevel(permissions, permission) {
    if (!permissions || !permission) return 0;
    return normalizeProjectPermissionLevel(
        permissions[permission]
        ?? permissions[permission.toLowerCase()]
        ?? permissions[permission.replace(/\s+/g, '_').toLowerCase()],
    );
}

export function getVisibleProjectModules({ permissions, isAdmin = false } = {}) {
    return MOBILE_PROJECT_MODULES.filter((module) => module.key === PROJECT_DEFAULT_MODULE || isAdmin || getProjectPermissionLevel(permissions, module.permission) >= 1);
}

export function resolveProjectModule(requestedKey, visibleModules = MOBILE_PROJECT_MODULES) {
    const requested = visibleModules.find((module) => module.key === requestedKey);
    return requested?.key || visibleModules[0]?.key || PROJECT_DEFAULT_MODULE;
}

export function updateProjectModuleSearch(search, moduleKey) {
    const next = new URLSearchParams(search || '');
    next.set('tab', moduleKey);
    return `?${next.toString()}`;
}

export function createProjectRequestGuard() {
    let generation = 0;
    let activeProjectId = null;
    return {
        begin(projectId) {
            generation += 1;
            activeProjectId = String(projectId);
            return { generation, projectId: activeProjectId };
        },
        isCurrent(token) {
            return token?.generation === generation && token?.projectId === activeProjectId;
        },
    };
}