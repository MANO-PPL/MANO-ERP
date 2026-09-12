// No ERP service imports: only router UI state and already available display metadata.
const PROJECT_TABS = ['Dashboard', 'Tasks', 'WIP', 'Reports', 'General Documents', 'Spreadsheets', 'Drawings',
    'Planning', 'Phases', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management', 'Transactions', 'Approvals', 'Settings'];
const RESOURCE_TABS = { directory: 'Directory', recipes: 'Recipes', rates: 'Rates', conversions: 'Conversions' };
const MODULES = { projects: 'Projects', vendors: 'Vendors', clients: 'Clients', resources: 'Resources',
    spreadsheets: 'Spreadsheets', collaboration: 'Collaboration', admin: 'Employee', 'drawing-test': 'Drawings',
    transactions: 'Transactions', ledger: 'Transactions', approvals: 'Approvals' };

export function getNavigationTrail(storage) {
    try {
        const trail = JSON.parse(storage?.getItem('mano_nav_trail') || '[]');
        return Array.isArray(trail) ? trail.slice(-5) : [];
    } catch {
        return [];
    }
}

export function recordNavigationRoute(route, storage) {
    if (!route || typeof route !== 'string') return;
    try {
        const trail = getNavigationTrail(storage);
        if (trail[trail.length - 1] !== route) {
            trail.push(route.slice(0, 512));
            if (trail.length > 5) trail.shift();
            storage?.setItem('mano_nav_trail', JSON.stringify(trail));
        }
    } catch { /* storage safe */ }
}

export function extractAgentContext({ pathname = '/', search = '' } = {}, meta = {}) {
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

    if (meta && typeof meta === 'object') {
        if (meta.selectedEntityType && typeof meta.selectedEntityType === 'string') {
            context.selectedEntityType = meta.selectedEntityType.trim().slice(0, 80);
        }
        if (meta.selectedEntityId != null) {
            context.selectedEntityId = String(meta.selectedEntityId).trim().slice(0, 80);
        }
        if (meta.selectedEntityName && typeof meta.selectedEntityName === 'string') {
            context.selectedEntityName = meta.selectedEntityName.trim().slice(0, 200);
        }
        if (meta.activeTab && typeof meta.activeTab === 'string') {
            context.activeTab = meta.activeTab.trim().slice(0, 80);
        }
        if (meta.viewSummary && typeof meta.viewSummary === 'string') {
            context.viewSummary = meta.viewSummary.trim().slice(0, 500);
        }
        if (Array.isArray(meta.recentRoutes) && meta.recentRoutes.length > 0) {
            context.recentRoutes = meta.recentRoutes.slice(-5).map(r => String(r).slice(0, 512));
        }
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

export function categorizedStarterPrompts(context) {
    const entityName = context.selectedEntityName;
    let local = [];
    if (context.selectedEntityType === 'vendor' && entityName) {
        local = [`View details for ${entityName}`, `Show interaction history with ${entityName}`, `View vendor rating for ${entityName}`];
    } else if (context.module.includes('Resources') || context.module.includes('Material Management')) {
        local = ['Resources breakdown by type', 'Check a resource rate', 'List all resources'];
    } else if (context.projectId) {
        const projLabel = context.projectName || `Project #${context.projectId}`;
        const tab = context.activeTab || context.module;
        if (tab === 'Transactions') {
            local = ['Show transactions of this project', 'View transactions breakdown by type', `View summary of ${projLabel}`];
        } else if (tab === 'Billing') {
            local = ['Show bills of this project', 'View billing breakdown by type', `View summary of ${projLabel}`];
        } else if (tab === 'Tasks') {
            local = ['Show tasks of this project', 'List all tasks', 'View tasks by status'];
        } else if (tab === 'WIP') {
            local = ['Show WIP progress of this project', 'List WIP items', 'View WIP milestone status'];
        } else if (tab === 'Reports') {
            local = ['Show project reports & logs', 'List all project documents', `View summary of ${projLabel}`];
        } else if (tab === 'General Documents') {
            local = ['Overview of project documents', 'List all documents', 'View pending document approvals'];
        } else if (tab === 'Spreadsheets') {
            local = ['Overview of project spreadsheets', 'List all spreadsheets', 'View spreadsheet summaries'];
        } else if (tab === 'Drawings') {
            local = ['Overview of project drawings', 'List all drawings', 'View drawing approval status'];
        } else if (tab === 'Planning') {
            local = ['Show project planning & schedule', 'List project milestones', 'View project timeline'];
        } else if (tab === 'Phases') {
            local = ['Show project phases', 'List all phases', 'View phase status summary'];
        } else if (tab === 'Contracts') {
            local = ['Show contracts & work orders', 'List all contracts', 'View contractor agreements'];
        } else if (tab === 'Quality') {
            local = ['Quality checklists & QA/QC observations', 'List QA/QC items', 'View pending sign-offs'];
        } else if (tab === 'Safety') {
            local = ['Safety observations & incident reports', 'List safety observations', 'View compliance checklist'];
        } else if (tab === 'Approvals') {
            local = ['What approvals are waiting for my sign-off?', 'List pending approvals', 'View approvals by status'];
        } else if (tab === 'Settings') {
            local = ['Overview of project settings', 'View project permissions', 'View project members'];
        } else if (tab === 'Dashboard') {
            local = ['Show the vendors for this project', 'List all projects', `View summary of ${projLabel}`];
        } else {
            local = ['Show the vendors for this project', 'List all projects', `View summary of ${projLabel}`];
        }
    } else if (context.module === 'Projects') {
        local = ['List all projects', 'View projects by status', 'Overview of the Projects module'];
    } else if (context.module === 'Vendors') {
        local = ['List all vendors', 'View vendors by category', 'View vendors by location'];
    } else if (context.module === 'Transactions') {
        local = ['List recent transactions', 'View transactions breakdown by type', 'View monthly transactions summary'];
    } else if (context.module === 'Billing') {
        local = ['List all bills', 'View billing breakdown by type', 'View monthly billing summary'];
    } else if (context.module === 'Approvals') {
        local = ['What approvals are waiting for my sign-off?', 'List pending approvals', 'View approvals by status'];
    } else if (context.module === 'Clients') {
        local = ['List all clients', 'Summarize recent client interactions', 'View clients by sector'];
    } else {
        local = ['List all projects', 'List all vendors', 'View overview of this module'];
    }

    const global = [
        'List all projects',
        'List all vendors',
        'List all clients',
        'List all resources',
        'View recent transactions',
        'What approvals are waiting for my sign-off?',
        'Give me an overview of all ERP data'
    ].filter(g => !local.includes(g));

    return { local, global };
}

export function starterPrompts(context) {
    const { local, global } = categorizedStarterPrompts(context);
    const combined = [...local, ...global.slice(0, 2)];
    return combined.slice(0, 5);
}
