// No ERP service imports: only router UI state and already available display metadata.
const PROJECT_TABS = ['Dashboard', 'Tasks', 'WIP', 'Reports', 'General Documents', 'Spreadsheets', 'Drawings',
    'Planning', 'Phases', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management', 'Transactions', 'Approvals', 'Settings'];
const RESOURCE_TABS = { directory: 'Directory', recipes: 'Recipes', rates: 'Rates', conversions: 'Conversions' };
const MODULES = { projects: 'Projects', vendors: 'Vendors', clients: 'Clients', resources: 'Resources',
    spreadsheets: 'Spreadsheets', collaboration: 'Collaboration', admin: 'Employee', 'drawing-test': 'Drawings' };

export function extractAgentContext({ pathname = '/', search = '' } = {}) {
    const context = { route: pathname, module: 'ERP' };
    const parts = pathname.split('/').filter(Boolean);
    const params = new URLSearchParams(search);
    context.module = parts.length ? (Object.hasOwn(MODULES, parts[0]) ? MODULES[parts[0]] : 'ERP') : 'Dashboard';
    if (parts[0] === 'projects' && parts.length === 2 && !['create', 'new'].includes(parts[1])) {
        context.projectId = parts[1];
        const tab = params.get('tab') || 'Dashboard';
        context.module = PROJECT_TABS.includes(tab) ? tab : 'Projects';
        if (tab === 'Material Management') {
            const subtab = params.get('matTab');
            const label = subtab === 'grid' || !subtab ? 'Resources' : Object.hasOwn(RESOURCE_TABS, subtab) ? RESOURCE_TABS[subtab] : null;
            if (label) context.module = `Material Management / ${label}`;
        }
    } else if (pathname === '/resources') {
        const tab = params.get('tab') || 'directory';
        if (Object.hasOwn(RESOURCE_TABS, tab)) context.module = `Resources / ${RESOURCE_TABS[tab]}`;
    }
    return context;
}

export function projectDisplay(context, storage, eventDetail) {
    if (!context.projectId) return null;
    let info;
    if (eventDetail) {
        if (String(eventDetail.id) !== context.projectId) return null;
        info = eventDetail;
    } else {
        try { info = JSON.parse(storage?.getItem(`active_project_info_${context.projectId}`) || 'null'); }
        catch { return null; }
    }
    return typeof info?.name === 'string' && info.name.trim() ? info.name.trim().slice(0, 200) : null;
}

export function starterPrompts(context) {
    if (context.module.includes('Resources') || context.module.includes('Material Management')) {
        return ['Find a resource', 'Check a resource rate', 'Explain resource compositions'];
    }
    if (context.projectId) return ['Show the vendors for this project', 'Explain this page', 'Summarize this project'];
    if (context.module === 'Clients') return ['Summarize recent client interactions', 'Explain this page'];
    return ['Find a resource', 'Summarize recent client interactions', 'Explain this page'];
}
