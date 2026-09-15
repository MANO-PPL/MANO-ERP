export const MOBILE_NAV_ITEMS = Object.freeze([
    { id: 'dashboard', label: 'Dashboard', path: '/', icon: 'dashboard' },
    { id: 'projects', label: 'Projects', path: '/projects', pageId: 'projects', icon: 'projects' },
    { id: 'vendors', label: 'Vendors', path: '/vendors', pageId: 'vendors', icon: 'vendors' },
    { id: 'clients', label: 'Clients', path: '/clients', pageId: 'clients', icon: 'clients' },
    { id: 'resources', label: 'Resources', path: '/resources', pageId: 'resources', icon: 'resources' },
    { id: 'spreadsheets', label: 'Spreadsheets', path: '/spreadsheets', pageId: 'spreadsheets', icon: 'spreadsheets' },
    { id: 'collaboration', label: 'Collaboration', path: '/collaboration', pageId: 'collaboration', icon: 'collaboration' },
    { id: 'admin', label: 'Employee', path: '/admin', pageId: 'admin', icon: 'admin' },
]);

export function filterMobileNavigation(items = MOBILE_NAV_ITEMS, hasPermission = () => false) {
    return items.filter((item) => item.id === 'dashboard' || hasPermission(item.pageId, 1));
}

export function normalizeRecentProjects(response, limit = 5) {
    if (!response?.success || !Array.isArray(response.projects)) return [];
    return response.projects
        .filter((project) => project && project.id != null && typeof project.name === 'string')
        .slice(0, Math.max(0, limit))
        .map((project) => ({
            id: project.id,
            name: project.name.trim() || `Project ${project.id}`,
            code: project.project_code || null,
        }));
}
