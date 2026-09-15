import React, { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import '../../src/index.css';
import { AuthProvider } from '../../src/context/AuthContext';
import MobileMainLayout from '../../src/mobile/layout/MobileMainLayout';
import MobileProjectShell from '../../src/mobile/pages/ProjectDetails/MobileProjectShell';
import MobilePilotLayout from '../../src/mobile/routing/MobilePilotLayout';
import ResponsiveRoute from '../../src/mobile/routing/ResponsiveRoute';

const params = new URLSearchParams(window.location.search);
const frameMode = params.get('frame') === '1';
const projectId = params.get('project') || '42';
const route = params.get('route') || `/projects/${projectId}`;
const access = params.get('access') || 'write';
const exercise = params.get('exercise') || '';
const caseId = params.get('case') || `${window.innerWidth}-${route}-${access}-${exercise}`;
const counters = { projectLoads: 0 };
const networkAttempts = [];

window.fetch = (input) => { networkAttempts.push(`fetch ${String(input)}`); return Promise.reject(new Error('M4 harness blocks application network requests')); };
XMLHttpRequest.prototype.open = function blockedXhr(method, url) { networkAttempts.push(`${method} ${url}`); throw new Error('M4 harness blocks application network requests'); };

const fixtureProjects = {
    '42': { id: 42, name: 'Synthetic Project Alpha', project_code: 'SYN-42', status: 'active', location: 'Test City' },
    '43': { id: 43, name: 'Synthetic Project Beta', project_code: 'SYN-43', status: 'planning', location: 'Other City' },
};
const permissionKeys = ['Tasks', 'WIP', 'Reports', 'General Documents', 'Spreadsheets', 'Drawings', 'Planning', 'Phases', 'Contracts', 'Quality', 'Safety', 'Billing', 'Material Management', 'Transactions', 'Approvals', 'Settings'];
const projectService = {
    getProject: async (id) => {
        counters.projectLoads += 1;
        if (exercise === 'project-403') throw { response: { status: 403 } };
        return { success: true, project: fixtureProjects[String(id)] || fixtureProjects['42'], projectPermissions: access === 'admin' ? {} : Object.fromEntries(permissionKeys.map((key) => [key, access === 'read' ? 1 : 2])) };
    },
};
const moduleServices = {
    tasks: { getTasks: async () => ({ success: true, categories: [] }) },
    projects: { ...projectService, getProjectMembers: async () => ({ success: true, members: [] }) },
    docs: { getDirectory: async () => ({ directory: [] }), getParties: async () => ({ parties: [] }) },
};
const authOverride = { user: { id: 7, user_type: access === 'admin' ? 'admin' : 'employee' }, isAdmin: access === 'admin' };
function DesktopLayoutSentinel() { return <div data-layout-branch="desktop"><div data-agent-contract="desktop" /><Outlet /></div>; }
function DesktopPageSentinel() { return <div data-desktop-page="project-details">Existing desktop ProjectDetails sentinel</div>; }
function LocationProbe() { const location = useLocation(); return <span hidden data-app-search={location.search} data-app-pathname={location.pathname} />; }
function ContractChecks() {
    const location = useLocation(); const navigate = useNavigate(); const [results, setResults] = useState([]);
    useEffect(() => {
        let cancelled = false;
        const check = (label, pass, detail = '') => ({ label, pass: Boolean(pass), detail });
        const run = async () => {
            await new Promise((resolve) => window.setTimeout(resolve, 320));
            if (cancelled) return;
            const rows = [];
            const mobile = window.innerWidth <= 1023;
            const shell = document.querySelector('[data-mobile-page="project-shell"]');
            rows.push(check('Exact requested viewport', window.innerWidth === Number(params.get('width')), `${window.innerWidth}px`));
            rows.push(check('Exactly one presentation branch', document.querySelectorAll('[data-layout-branch]').length === 1));
            rows.push(check('Correct mobile or desktop branch', mobile ? Boolean(document.querySelector('[data-layout-branch="mobile"]')) : Boolean(document.querySelector('[data-layout-branch="desktop"]'))));
            rows.push(check('Project route preserved', exercise === 'project-403' ? location.pathname === '/projects' : location.pathname === route));
            rows.push(check('Project request is not duplicated', mobile ? counters.projectLoads === 1 : true, `${counters.projectLoads} calls`));
            if (mobile) {
                rows.push(check('Mobile project shell mounts once', exercise === 'project-403' ? document.querySelectorAll('[data-mobile-page="project-shell"]').length === 0 : document.querySelectorAll('[data-mobile-page="project-shell"]').length === 1));
                rows.push(check('Desktop ProjectDetails is absent', !document.querySelector('[data-desktop-page]')));
                rows.push(check('Mobile Agent mounts exactly once', document.querySelectorAll('[data-agent-contract="mobile"]').length === 1 && document.querySelectorAll('[aria-label="Open ERP Assistant"]').length === 1));
                rows.push(check('Project identity renders', exercise === 'project-403' || document.body.textContent.includes(fixtureProjects[projectId]?.name || 'Synthetic Project Alpha')));
                rows.push(check('Current module renders', exercise === 'project-403' || document.body.textContent.includes(params.get('tab') && params.get('tab') !== 'Invalid' ? params.get('tab') : 'Dashboard')));
                rows.push(check('No horizontal overflow', document.documentElement.scrollWidth <= window.innerWidth, `${document.documentElement.scrollWidth}/${window.innerWidth}`));
                if (exercise === 'admin-modules') {
                    document.querySelector('[aria-label="Open project module selector"]')?.click(); await new Promise((resolve) => window.setTimeout(resolve, 160));
                    rows.push(check('Admin selector exposes all 17 modules', document.querySelectorAll('[role="option"]').length === 17, `${document.querySelectorAll('[role="option"]').length} options`));
                }
                if (exercise === 'sheet-escape') {
                    const moduleSelector = document.querySelector('[aria-label="Open project module selector"]');
                    moduleSelector?.focus();
                    moduleSelector?.click();
                    for (let attempt = 0; attempt < 20 && !document.querySelector('[role="dialog"][aria-modal="true"]'); attempt += 1) await new Promise((resolve) => window.setTimeout(resolve, 40));
                    for (let attempt = 0; attempt < 20 && document.activeElement?.closest('[role="dialog"]') !== document.querySelector('[role="dialog"][aria-modal="true"]'); attempt += 1) await new Promise((resolve) => window.setTimeout(resolve, 40));
                    rows.push(check('Module sheet traps focus', Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')) && document.activeElement?.closest('[role="dialog"]') === document.querySelector('[role="dialog"][aria-modal="true"]')));
                    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((resolve) => window.setTimeout(resolve, 50));
                    rows.push(check('Escape closes module sheet', !document.querySelector('[role="dialog"][aria-modal="true"]')));
                }
                if (exercise === 'query-back') {
                    document.querySelector('[aria-label="Open project module selector"]')?.click();
                    for (let attempt = 0; attempt < 20 && !document.querySelector('[role="option"]'); attempt += 1) await new Promise((resolve) => window.setTimeout(resolve, 40));
                    const task = [...document.querySelectorAll('[role="option"]')].find((item) => item.textContent.includes('Tasks'));
                    task?.click(); await new Promise((resolve) => window.setTimeout(resolve, 80));
                    for (let attempt = 0; attempt < 20 && !document.querySelector('[data-app-search]')?.getAttribute('data-app-search')?.includes('tab=Tasks'); attempt += 1) await new Promise((resolve) => window.setTimeout(resolve, 40));
                    const appSearch = document.querySelector('[data-app-search]')?.getAttribute('data-app-search') || '';
                    rows.push(check('Tab navigation preserves unrelated query', appSearch.includes('tab=Tasks') && appSearch.includes('foo=bar'), appSearch));
                    navigate(-1); await new Promise((resolve) => window.setTimeout(resolve, 100));
                    for (let attempt = 0; attempt < 20 && !document.querySelector('[data-app-search]')?.getAttribute('data-app-search')?.includes('tab=Dashboard'); attempt += 1) await new Promise((resolve) => window.setTimeout(resolve, 40));
                    const backSearch = document.querySelector('[data-app-search]')?.getAttribute('data-app-search') || '';
                    rows.push(check('Browser Back restores prior module', backSearch.includes('tab=Dashboard'), backSearch));
                }
            } else {
                rows.push(check('Desktop ProjectDetails mounts', Boolean(document.querySelector('[data-desktop-page="project-details"]'))));
                rows.push(check('No mobile shell or Agent mounts', !document.querySelector('[data-mobile-page]') && !document.querySelector('[data-agent-contract="mobile"]')));
            }
            rows.push(check('No real ERP or Agent network request', networkAttempts.length === 0, networkAttempts.join(', ')));
            if (!cancelled) { setResults(rows); window.__M4_HARNESS_RESULT__ = { caseId, rows, counters }; window.parent.postMessage({ type: 'mano-m4-harness-results', caseId, rows }, window.location.origin); }
        };
        run(); return () => { cancelled = true; };
    }, [location.pathname]);
    return <ol aria-label="M4 frame checks" className="pointer-events-none fixed left-1 top-1 z-[100] max-h-[80vh] overflow-auto rounded-lg border bg-white p-2 text-[10px]">{results.map((row) => <li key={row.label}>{row.pass ? 'PASS' : 'FAIL'}: {row.label}{row.detail ? ` (${row.detail})` : ''}</li>)}</ol>;
}
function FrameHarness() {
    const initial = route + (params.get('tab') || params.get('foo') ? `?${new URLSearchParams({ ...(params.get('tab') ? { tab: params.get('tab') } : {}), ...(params.get('foo') ? { foo: params.get('foo') } : {}) })}` : '');
    return <StrictMode><ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}><AuthProvider><MemoryRouter initialEntries={[initial]}><LocationProbe /><ContractChecks /><Routes><Route path="/" element={<MobilePilotLayout mobile={<MobileMainLayout loadProjects={async () => ({ projects: [] })} />} desktop={<DesktopLayoutSentinel />} />}><Route path="projects" element={<ResponsiveRoute mobile={<div data-mobile-page="projects">Projects mobile redirect target</div>} desktop={<DesktopPageSentinel />} />} /><Route path="projects/:id" element={<ResponsiveRoute mobile={<MobileProjectShell authOverride={authOverride} projectService={projectService} moduleServices={moduleServices} />} desktop={<DesktopPageSentinel />} />} /></Route></Routes></MemoryRouter></AuthProvider></ThemeProvider></StrictMode>;
}
const cases = [
    { id: 'shell-360', width: 360 }, { id: 'shell-390', width: 390 }, { id: 'shell-430', width: 430 }, { id: 'shell-768', width: 768 }, { id: 'shell-1023', width: 1023 },
    { id: 'shell-1024', width: 1024 }, { id: 'shell-1280', width: 1280 }, { id: 'admin-modules-390', width: 390, access: 'admin', exercise: 'admin-modules' },
    { id: 'read-permissions-390', width: 390, access: 'read', tab: 'Settings' }, { id: 'invalid-fallback-390', width: 390, tab: 'Invalid' },
    { id: 'query-back-390', width: 390, exercise: 'query-back', tab: 'Dashboard', foo: 'bar' }, { id: 'sheet-escape-430', width: 430, exercise: 'sheet-escape' },
    { id: 'project-403-390', width: 390, exercise: 'project-403' }, { id: 'project-switch-390', width: 390, project: '43' },
];
function ParentHarness() {
    const [reports, setReports] = useState({});
    useEffect(() => { const receive = (event) => { if (event.origin === window.location.origin && event.data?.type === 'mano-m4-harness-results') setReports((current) => ({ ...current, [event.data.caseId]: event.data.rows })); }; window.addEventListener('message', receive); return () => window.removeEventListener('message', receive); }, []);
    const completed = cases.filter((item) => reports[item.id]); const passed = completed.reduce((sum, item) => sum + reports[item.id].filter((row) => row.pass).length, 0); const failed = completed.reduce((sum, item) => sum + reports[item.id].filter((row) => !row.pass).length, 0);
    return <main className="min-h-screen bg-gray-100 p-4 text-gray-900"><h1 className="text-lg font-bold">MANO ERP M4 project shell harness</h1><p data-harness-summary className="mt-1 text-xs">Completed {completed.length}/{cases.length}; PASS {passed}; FAIL {failed}.</p>{cases.map((item) => { const query = new URLSearchParams({ frame: '1', case: item.id, width: String(item.width), route: `/projects/${item.project || '42'}`, project: item.project || '42', access: item.access || 'write', ...(item.exercise ? { exercise: item.exercise } : {}), ...(item.tab ? { tab: item.tab } : {}), ...(item.foo ? { foo: item.foo } : {}) }); return <section key={item.id} data-case-status={reports[item.id] ? reports[item.id].every((row) => row.pass) ? 'pass' : 'fail' : 'running'}><h2>{item.id}</h2><iframe title={item.id} src={`./m4-harness.html?${query}`} width={item.width} height="760" onLoad={(event) => { if (item.id === 'sheet-escape-430') event.currentTarget.focus(); }} /></section>; })}</main>;
}
const root = createRoot(document.getElementById('root'));
root.render(frameMode ? <FrameHarness /> : <ParentHarness />);
