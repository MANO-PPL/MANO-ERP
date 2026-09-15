import React, { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import '../../src/index.css';
import { AuthProvider } from '../../src/context/AuthContext';
import MobileMainLayout from '../../src/mobile/layout/MobileMainLayout';
import MobileDashboard from '../../src/mobile/pages/MobileDashboard';
import MobileLogin from '../../src/mobile/pages/Auth/MobileLogin';
import MobileProjectForm from '../../src/mobile/pages/Projects/MobileProjectForm';
import MobileProjects from '../../src/mobile/pages/Projects/MobileProjects';
import MobileGlobalSpreadsheets from '../../src/mobile/pages/Spreadsheets/MobileGlobalSpreadsheets';
import MobilePilotLayout from '../../src/mobile/routing/MobilePilotLayout';
import ResponsiveRoute from '../../src/mobile/routing/ResponsiveRoute';
import { createRequestLoader } from '../../src/mobile/utils/createRequestLoader';

const params = new URLSearchParams(window.location.search);
const frameMode = params.get('frame') === '1';
const route = params.get('route') || '/';
const access = params.get('access') || 'write';
const exercise = params.get('exercise') || '';
const caseId = params.get('case') || `${window.innerWidth}-${route}-${access}-${exercise}`;
const harnessEntry = window.location.pathname.endsWith('/index.html') ? './index.html' : './m2-harness.html';
const counters = {
    projectLoads: 0,
    login: 0,
    create: 0,
    update: 0,
    projectDetails: 0,
    memberLoads: 0,
    userLoads: 0,
    memberAssignments: 0,
    memberRemovals: 0,
};
const networkAttempts = [];
const payloads = {};

const originalFetch = window.fetch;
const originalXhrOpen = XMLHttpRequest.prototype.open;
window.fetch = (input) => {
    networkAttempts.push(`fetch ${String(input)}`);
    return Promise.reject(new Error('M2 harness blocks application network requests'));
};
XMLHttpRequest.prototype.open = function blockedXhr(method, url) {
    networkAttempts.push(`${method} ${url}`);
    throw new Error('M2 harness blocks application network requests');
};
// AuthProvider performs its real profile bootstrap only when this browser has a
// persisted userType cookie. The synthetic mobile branches receive authOverride,
// so remove that ambient browser state before mounting rather than letting it
// issue a blocked ERP request.
document.cookie = 'userType=; Max-Age=0; path=/';
window.addEventListener('beforeunload', () => {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
});

const fixtureProjects = [
    {
        id: 101,
        name: 'Synthetic Active Site',
        project_code: 'SYN-101',
        status: 'active',
        location: 'Synthetic City',
        start_date: '2026-01-10',
        end_date: '2026-12-20',
        member_count: 2,
        metadata: { description: 'Synthetic fixture only', employer: 'MANO Test', completion: 45, issues: 'Risk', tags: ['fixture'] },
    },
    {
        id: 102,
        name: 'Synthetic Archived Site',
        project_code: 'SYN-102',
        status: 'completed',
        location: 'Archive City',
        member_count: 1,
        metadata: { description: 'Synthetic archived fixture', employer: 'MANO Test', completion: 100, issues: 'Resolved' },
    },
];

const loadProjects = createRequestLoader(async () => {
    counters.projectLoads += 1;
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    return { success: true, projects: fixtureProjects };
});

const projectService = {
    getProject: async (id) => {
        counters.projectDetails += 1;
        return { success: true, project: fixtureProjects.find((project) => Number(project.id) === Number(id)) || fixtureProjects[0] };
    },
    getProjectMembers: async () => {
        counters.memberLoads += 1;
        return { success: true, members: [{ user_id: 7, user_name: 'Fixture Employee' }] };
    },
    createProject: async (payload) => {
        counters.create += 1;
        payloads.create = payload;
        return { success: true, project: { id: 103 } };
    },
    updateProject: async (id, payload) => {
        counters.update += 1;
        payloads.update = { id, payload };
        if (exercise === 'metadata-failure') return { success: false, message: 'Synthetic metadata failure' };
        const project = fixtureProjects.find((item) => Number(item.id) === Number(id));
        if (project) Object.assign(project, payload);
        return { success: true, project: { id } };
    },
    assignProjectMember: async (projectId, payload) => {
        counters.memberAssignments += 1;
        payloads.assignment = { projectId, payload };
        return { success: true };
    },
    removeProjectMember: async (projectId, userId) => {
        counters.memberRemovals += 1;
        payloads.removal = { projectId, userId };
        return { success: true };
    },
    uploadProjectLogo: async () => ({ success: true }),
};

const adminService = {
    getUsers: async () => {
        counters.userLoads += 1;
        return {
            success: true,
            users: [
                { user_id: 7, user_name: 'Fixture Employee', email: 'fixture@example.test', user_type: 'employee' },
                { user_id: 8, user_name: 'Fixture New Employee', email: 'new-fixture@example.test', user_type: 'employee' },
            ],
        };
    },
};

const authOverride = {
    user: { id: 7, user_name: 'Fixture User', organization_name: 'MANO Test', user_type: 'employee' },
    login: () => { },
    logout: async () => { },
    hasPermission: (pageId, requiredLevel = 1) => pageId === 'dashboard' || pageId == null || ((pageId === 'projects' || pageId === 'spreadsheets') && (access === 'write' || requiredLevel <= 1)),
};

let globalWorkbooks = [{ id: 'wb-global', name: 'Synthetic Global Workbook', projectId: null, sheetCount: 1, updatedAt: '2026-09-15T00:00:00.000Z', sheets: [{ id: 'sheet-1', name: 'Sheet1', status: 1, order: 0, row: 12, column: 8, celldata: [] }] }];
const globalSpreadsheetStorage = {
    getSavedWorkbooksList(projectId) { return projectId == null ? globalWorkbooks.map((workbook) => ({ ...workbook, sheets: undefined })) : []; },
    getWorkbookById(id) { return globalWorkbooks.find((workbook) => workbook.id === id) || null; },
    saveWorkbook(workbook) { const saved = { ...workbook, projectId: null, updatedAt: new Date().toISOString() }; globalWorkbooks = [saved, ...globalWorkbooks.filter((item) => item.id !== saved.id)]; return { success: true, workbook: saved }; },
    deleteWorkbook(id) { globalWorkbooks = globalWorkbooks.filter((workbook) => workbook.id !== id); return { success: true }; },
    importFromFile: async () => ({ success: true, workbookName: 'Imported', sheets: globalWorkbooks[0].sheets }),
};

const waitForPaint = (delay = 60) => new Promise((resolve) => window.setTimeout(resolve, delay));
const setNativeValue = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
};

function DesktopLayoutSentinel() {
    return (
        <div data-layout-branch="desktop" className="min-h-screen bg-white p-4 dark:bg-gh-bg">
            <div data-agent-contract="desktop" />
            <p className="font-bold">Existing desktop layout sentinel</p>
            <Outlet />
        </div>
    );
}

function DesktopPageSentinel({ name }) {
    return <div data-desktop-page={name}>Existing desktop {name} sentinel</div>;
}

function MobileLoginBranch() {
    return (
        <div data-layout-branch="mobile-login">
            <MobileLogin
                authOverride={{ ...authOverride, login: (...args) => { counters.login += 1; payloads.loginAuth = args; } }}
                loginRequest={async (credentials) => {
                    payloads.login = credentials;
                    return { success: true, accessToken: 'synthetic-token', user: authOverride.user };
                }}
                onNavigate={(destination) => { payloads.loginNavigation = destination; }}
            />
        </div>
    );
}

function MobileCreatePage() {
    return (
        <MobileProjectForm
            authOverride={authOverride}
            projectService={projectService}
            adminService={adminService}
            onCancel={() => { payloads.formNavigation = '/projects'; }}
            onSaved={(result) => { payloads.saved = result; }}
        />
    );
}

function ContractChecks() {
    const location = useLocation();
    const [results, setResults] = useState([]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            await waitForPaint(180);
            for (let attempt = 0; attempt < 40 && document.body.textContent.includes('Loading projects'); attempt += 1) {
                await waitForPaint(50);
            }
            if (cancelled) return;
            const rows = [];
            const check = (label, pass, detail = '') => rows.push({ label, pass: Boolean(pass), detail });
            const mobileWidth = window.innerWidth <= 1023;
            const loginRoute = route === '/login';
            const projectDetailRoute = /^\/projects\/[^/]+$/.test(route);
            const spreadsheetRoute = route === '/spreadsheets';
            const pilotRoute = ['/', '/projects', '/projects/create', '/projects/new', '/spreadsheets'].includes(route) || projectDetailRoute;
            const expectMobile = mobileWidth && (loginRoute || pilotRoute);
            const expectedPage = route === '/' ? 'dashboard' : route === '/projects' ? 'projects' : route === '/projects/create' || route === '/projects/new' ? 'project-form' : route === '/login' ? 'login' : projectDetailRoute ? 'project-shell' : spreadsheetRoute ? 'global-spreadsheets' : null;

            check('Exact requested viewport', window.innerWidth === Number(params.get('width')), `${window.innerWidth}px`);
            check('Exactly one presentation branch', document.querySelectorAll('[data-layout-branch]').length === 1);
            check('Correct mobile or desktop branch', expectMobile
                ? Boolean(document.querySelector('[data-layout-branch="mobile"], [data-layout-branch="mobile-login"]'))
                : Boolean(document.querySelector('[data-layout-branch="desktop"]')));
            check('Current route preserved', location.pathname === route, location.pathname);

            if (expectMobile) {
                check('Expected mobile page mounted once', expectedPage && (spreadsheetRoute ? document.querySelectorAll('[data-mobile-global-spreadsheets]').length === 1 : document.querySelectorAll(`[data-mobile-page="${expectedPage}"]`).length === 1));
                check('Desktop page is absent', document.querySelectorAll('[data-desktop-page]').length === 0);
                if (loginRoute) {
                    check('Login does not mount an authenticated layout Agent', document.querySelectorAll('[data-agent-contract]').length === 0);
                    if (exercise === 'login') {
                        setNativeValue(document.getElementById('mobile-login-email'), 'fixture@example.test');
                        setNativeValue(document.getElementById('mobile-login-password'), 'synthetic-password');
                        document.querySelector('input[type="checkbox"]')?.click();
                        document.querySelector('form button[type="submit"]')?.click();
                        await waitForPaint();
                        check('Login submits exactly once', counters.login === 1);
                        check('Login preserves credential contract', payloads.login?.email === 'fixture@example.test' && payloads.login?.password === 'synthetic-password' && payloads.login?.rememberMe === true);
                        check('Login hands off to dashboard once', payloads.loginNavigation === '/');
                    }
                } else {
                    check('Authenticated mobile layout mounted once', document.querySelectorAll('[data-layout-branch="mobile"]').length === 1);
                    check('Existing Agent mounted exactly once', document.querySelectorAll('[aria-label="Open ERP Assistant"]').length === 1 && document.querySelectorAll('[data-agent-contract="mobile"]').length === 1);
                }

                if (route === '/') {
                    check('Dashboard keeps local/static data semantics', counters.projectLoads === 0 && document.body.textContent.includes('Total Contract Value'));
                    check('Dashboard exposes permission-aware quick actions', document.body.textContent.includes('Quick actions') && document.body.textContent.includes('Create project'));
                }
                if (spreadsheetRoute) {
                    check('Global Spreadsheets uses global workspace truth', document.body.textContent.includes('Global workbooks') && !document.body.textContent.includes('for this project'));
                }

                if (route === '/projects') {
                    check('Project list request is not duplicated', counters.projectLoads === 1, `${counters.projectLoads} calls`);
                    check('Active and Archived tabs are present', document.body.textContent.includes('Active') && document.body.textContent.includes('Archived') && !document.body.textContent.includes('Completed Projects'));
                    check('Active card renders existing project metadata', document.body.textContent.includes('Synthetic Active Site') && document.body.textContent.includes('SYN-101'));
                    const createControls = document.querySelectorAll('[aria-label="Create project"], button').length && [...document.querySelectorAll('button')].filter((button) => button.textContent.trim() === 'Add').length;
                    check('Create controls follow write permission', access === 'write'
                        ? Boolean(document.querySelector('[aria-label="Create project"]')) && createControls === 1
                        : !document.querySelector('[aria-label="Create project"]') && createControls === 0);

                    if (exercise === 'metadata-failure' || exercise === 'metadata-success') {
                        [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Synthetic Active Site'))?.click();
                        await waitForPaint(120);
                        const blockedButton = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Blocked');
                        blockedButton?.click();
                        for (let attempt = 0; attempt < 20; attempt += 1) {
                            const currentRisk = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Risk');
                            const currentBlocked = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Blocked');
                            const expectedStateVisible = exercise === 'metadata-success'
                                ? currentBlocked?.getAttribute('aria-pressed') === 'true'
                                : currentRisk?.getAttribute('aria-pressed') === 'true';
                            if (counters.update === 1 && !currentBlocked?.disabled && expectedStateVisible) break;
                            await waitForPaint(50);
                        }
                        const settledRiskButton = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Risk');
                        const settledBlockedButton = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Blocked');
                        check(`${exercise === 'metadata-success' ? 'Successful' : 'Failed'} issue metadata request is attempted once`, counters.update === 1);
                        check(
                            exercise === 'metadata-success' ? 'Successful issue edit becomes visible' : 'Failed issue edit does not alter visible state',
                            exercise === 'metadata-success'
                                ? settledRiskButton?.getAttribute('aria-pressed') === 'false' && settledBlockedButton?.getAttribute('aria-pressed') === 'true'
                                : settledRiskButton?.getAttribute('aria-pressed') === 'true' && settledBlockedButton?.getAttribute('aria-pressed') === 'false',
                        );
                        const tagInput = document.querySelector('input[placeholder="Add a tag"]');
                        const requestedTag = exercise === 'metadata-success' ? 'added-tag' : 'failed-tag';
                        if (tagInput) setNativeValue(tagInput, requestedTag);
                        await waitForPaint();
                        const addTagButton = [...(tagInput?.parentElement?.querySelectorAll('button') || [])]
                            .find((button) => button.textContent.trim() === 'Add');
                        addTagButton?.click();
                        for (let attempt = 0; attempt < 20 && (counters.update < 2 || (exercise === 'metadata-success' && tagInput?.value)); attempt += 1) await waitForPaint(50);
                        const visibleTags = [...document.querySelectorAll('[aria-labelledby="mobile-project-tags-heading"] span')]
                            .map((item) => item.textContent.trim());
                        check(`${exercise === 'metadata-success' ? 'Successful' : 'Failed'} tag metadata request is attempted once`, counters.update === 2);
                        check(
                            exercise === 'metadata-success' ? 'Successful tag edit becomes visible' : 'Failed tag edit preserves visible tags',
                            visibleTags.some((item) => item.includes('fixture'))
                            && (exercise === 'metadata-success' ? visibleTags.some((item) => item.includes(requestedTag)) : !visibleTags.includes(requestedTag)),
                        );
                        if (exercise === 'metadata-success') check('Successful tag edit clears the input', tagInput?.value === '');
                    } else {
                        document.querySelector('[aria-label="Actions for Synthetic Active Site"]')?.click();
                        await waitForPaint();
                        const editAction = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Edit project');
                        check('Edit action follows write permission', access === 'write' ? Boolean(editAction) : !editAction);
                        if (exercise === 'edit' && editAction) {
                            editAction.click();
                            await waitForPaint(140);
                            for (let attempt = 0; attempt < 20 && document.body.textContent.includes('Loading project details'); attempt += 1) await waitForPaint(50);
                            const editForm = document.querySelector('[data-project-form-mode="edit"]');
                            check('Edit experience loads a single mobile form', Boolean(editForm) && document.querySelectorAll('[data-project-form-mode="edit"]').length === 1);
                            check('Edit loads existing fields and members', editForm?.querySelector('input[placeholder="Project name"]')?.value === 'Synthetic Active Site' && document.body.textContent.includes('Fixture Employee'));
                            check('Edit initialization requests are not duplicated', counters.projectDetails === 1 && counters.memberLoads === 1 && counters.userLoads === 1);
                            const memberCheckboxes = [...editForm.querySelectorAll('input[type="checkbox"]')];
                            memberCheckboxes[0]?.click();
                            memberCheckboxes[1]?.click();
                            const nameInput = editForm?.querySelector('input[placeholder="Project name"]');
                            if (nameInput) setNativeValue(nameInput, 'Synthetic Active Site Revised');
                            [...(editForm?.querySelectorAll('button') || [])].find((button) => button.textContent.trim() === 'Save changes')?.click();
                            await waitForPaint(100);
                            check('Edit saves once with the existing update contract', counters.update === 1 && payloads.update?.id === 101 && payloads.update?.payload?.name === 'Synthetic Active Site Revised');
                            check('Edit assigns member with exact user_id payload', counters.memberAssignments === 1
                                && payloads.assignment?.projectId === 101
                                && JSON.stringify(payloads.assignment?.payload) === JSON.stringify({ user_id: 8 }));
                            check('Edit removes member with existing scalar contract', counters.memberRemovals === 1
                                && payloads.removal?.projectId === 101
                                && payloads.removal?.userId === 7);
                        }
                    }
                }

                if (route === '/projects/create' || route === '/projects/new') {
                    const submit = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Create project');
                    check('Create permission controls submit availability', access === 'write' ? submit && !submit.disabled : submit?.disabled);
                    check('Member selection follows write permission', access === 'write' ? document.body.textContent.includes('Project members') : !document.body.textContent.includes('Project members'));
                    if (exercise === 'create' && access === 'write') {
                        for (let attempt = 0; attempt < 20 && document.body.textContent.includes('Loading employees'); attempt += 1) await waitForPaint(50);
                        const memberCheckbox = document.querySelector('[data-project-form-mode="create"] input[type="checkbox"]');
                        memberCheckbox?.click();
                        check('Create member request is not duplicated', counters.userLoads === 1);
                        setNativeValue(document.querySelector('input[placeholder="Project name"]'), 'Synthetic Created Site');
                        setNativeValue(document.querySelector('input[placeholder="Project code"]'), 'SYN-103');
                        setNativeValue(document.querySelector('textarea[placeholder="Project scope and key deliverables"]'), 'Synthetic payload check');
                        submit?.click();
                        await waitForPaint(100);
                        check('Create saves exactly once', counters.create === 1);
                        check('Create payload remains API-compatible', payloads.create?.name === 'Synthetic Created Site' && payloads.create?.project_code === 'SYN-103' && payloads.create?.metadata?.description === 'Synthetic payload check');
                        check('Create sends selected member_ids', memberCheckbox?.checked && payloads.create?.member_ids?.length === 1 && payloads.create.member_ids[0] === 7);
                        check('Create completion callback receives project ID', payloads.saved?.id === 103 && payloads.saved?.mode === 'create');
                    }
                }

                const darkToggle = document.querySelector('[aria-label="Use dark theme"]');
                darkToggle?.click();
                await waitForPaint();
                check('Dark theme applies', document.documentElement.classList.contains('dark'));
                document.querySelector('[aria-label="Use light theme"]')?.click();
                await waitForPaint();
                check('Light theme restores', !document.documentElement.classList.contains('dark'));
            } else {
                check('Non-mobile selection keeps existing desktop page', Boolean(document.querySelector('[data-desktop-page]')));
                check('Desktop layout/Agent contract mounts once', loginRoute
                    ? document.querySelectorAll('[data-agent-contract]').length === 0
                    : document.querySelectorAll('[data-agent-contract="desktop"]').length === 1);
                check('No mobile page or mobile Agent mounted', !document.querySelector('[data-mobile-page]') && !document.querySelector('[aria-label="Open ERP Assistant"]'));
            }

            check('No viewport-level horizontal overflow', document.documentElement.scrollWidth <= window.innerWidth, `${document.documentElement.scrollWidth}/${window.innerWidth}`);
            check('No real ERP or Agent network request', networkAttempts.length === 0, networkAttempts.join(', '));
            if (!cancelled) {
                setResults(rows);
                window.__M2_HARNESS_RESULT__ = { caseId, route, width: window.innerWidth, rows, counters, payloads };
                window.parent.postMessage({ type: 'mano-m2-harness-results', caseId, route, width: window.innerWidth, rows }, window.location.origin);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [location.pathname]);

    return (
        <ol aria-label="M2 frame checks" data-harness-case={caseId} className="fixed left-1 top-14 z-[100] max-h-[80vh] max-w-[calc(100vw-0.5rem)] overflow-auto rounded-lg border border-gray-200 bg-white/95 p-2 text-[10px] shadow dark:border-gh-border dark:bg-gh-subtle/95">
            {results.map((result) => <li key={result.label} className={result.pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>{result.pass ? 'PASS' : 'FAIL'}: {result.label}{result.detail ? ` (${result.detail})` : ''}</li>)}
        </ol>
    );
}

function FrameHarness() {
    const desktopPage = (name) => <DesktopPageSentinel name={name} />;
    return (
        <StrictMode>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey={`mano-m2-harness-theme-${caseId}`}>
                <AuthProvider>
                    <MemoryRouter initialEntries={[route]}>
                        <ContractChecks />
                        <Routes>
                            <Route path="/login" element={<ResponsiveRoute mobile={<MobileLoginBranch />} desktop={desktopPage('login')} />} />
                            <Route
                                path="/"
                                element={<MobilePilotLayout mobile={<MobileMainLayout loadProjects={loadProjects} />} desktop={<DesktopLayoutSentinel />} />}
                            >
                                <Route index element={<ResponsiveRoute mobile={<MobileDashboard authOverride={authOverride} />} desktop={desktopPage('dashboard')} />} />
                                <Route path="projects" element={<ResponsiveRoute mobile={<MobileProjects authOverride={authOverride} loadProjects={loadProjects} projectService={projectService} adminService={adminService} />} desktop={desktopPage('projects')} />} />
                                <Route path="projects/create" element={<ResponsiveRoute mobile={<MobileCreatePage />} desktop={desktopPage('project-create')} />} />
                                <Route path="projects/new" element={<ResponsiveRoute mobile={<MobileCreatePage />} desktop={desktopPage('project-new')} />} />
                                <Route path="projects/:id" element={<ResponsiveRoute mobile={<div data-mobile-page="project-shell" />} desktop={desktopPage('project-details')} />} />
                                <Route path="spreadsheets" element={<ResponsiveRoute mobile={<MobileGlobalSpreadsheets authOverride={authOverride} storage={globalSpreadsheetStorage} />} desktop={desktopPage('spreadsheets')} />} />
                            </Route>
                        </Routes>
                    </MemoryRouter>
                </AuthProvider>
            </ThemeProvider>
        </StrictMode>
    );
}

const cases = [
    { id: 'login-360', width: 360, route: '/login', access: 'write', exercise: 'login' },
    { id: 'projects-read-360', width: 360, route: '/projects', access: 'read' },
    { id: 'dashboard-390', width: 390, route: '/', access: 'write' },
    { id: 'projects-write-390', width: 390, route: '/projects', access: 'write', exercise: 'edit' },
    { id: 'metadata-success-390', width: 390, route: '/projects', access: 'write', exercise: 'metadata-success' },
    { id: 'metadata-failure-390', width: 390, route: '/projects', access: 'write', exercise: 'metadata-failure' },
    { id: 'create-390', width: 390, route: '/projects/create', access: 'write', exercise: 'create' },
    { id: 'new-read-390', width: 390, route: '/projects/new', access: 'read' },
    { id: 'projects-430', width: 430, route: '/projects', access: 'write' },
    { id: 'projects-1023', width: 1023, route: '/projects', access: 'write' },
    { id: 'projects-1024', width: 1024, route: '/projects', access: 'write' },
    { id: 'details-mobile-width', width: 390, route: '/projects/42', access: 'write' },
    { id: 'spreadsheets-mobile-width', width: 390, route: '/spreadsheets', access: 'write' },
];

function ParentHarness() {
    const [reports, setReports] = useState({});
    useEffect(() => {
        const receive = (event) => {
            if (event.origin !== window.location.origin || event.data?.type !== 'mano-m2-harness-results') return;
            setReports((current) => ({ ...current, [event.data.caseId]: event.data.rows }));
        };
        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, []);
    const summary = useMemo(() => {
        const completed = cases.filter((item) => reports[item.id]);
        return { completed: completed.length, passed: completed.reduce((sum, item) => sum + reports[item.id].filter((row) => row.pass).length, 0), failed: completed.reduce((sum, item) => sum + reports[item.id].filter((row) => !row.pass).length, 0) };
    }, [reports]);

    return (
        <main className="min-h-screen bg-gray-100 p-4 text-gray-900">
            <h1 className="text-lg font-bold">MANO ERP M2 mobile pilot harness</h1>
            <p data-harness-summary className="mt-1 text-xs">Synthetic fixtures only; fetch and XHR are blocked. Completed {summary.completed}/{cases.length}; PASS {summary.passed}; FAIL {summary.failed}.</p>
            {cases.map((item) => {
                const rows = reports[item.id] || [];
                const finished = rows.length > 0;
                const passed = finished && rows.every((row) => row.pass);
                const query = new URLSearchParams({ frame: '1', case: item.id, width: String(item.width), route: item.route, access: item.access, ...(item.exercise ? { exercise: item.exercise } : {}) });
                return (
                    <section key={item.id} className="mt-5" data-case-status={finished ? passed ? 'pass' : 'fail' : 'running'}>
                        <h2 className="text-sm font-bold">{item.id} — {finished ? passed ? 'PASS' : 'FAIL' : 'RUNNING'}</h2>
                        {finished && (
                            <ol aria-label={`${item.id} results`} className="mt-1 text-[10px]">
                                {rows.map((row) => <li key={row.label}>{row.pass ? 'PASS' : 'FAIL'}: {row.label}{row.detail ? ` (${row.detail})` : ''}</li>)}
                            </ol>
                        )}
                        <div className="mt-2 max-w-full overflow-auto rounded-xl border border-gray-300 bg-white p-2">
                            <iframe title={item.id} src={`${harnessEntry}?${query}`} width={item.width} height="820" className="block max-w-none border-0" />
                        </div>
                    </section>
                );
            })}
        </main>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(frameMode ? <FrameHarness /> : <ParentHarness />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
