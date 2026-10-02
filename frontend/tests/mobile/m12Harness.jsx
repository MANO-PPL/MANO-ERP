import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import '../../src/index.css';
import { AuthProvider } from '../../src/context/AuthContext';
import MobileMainLayout from '../../src/mobile/layout/MobileMainLayout';
import MobilePilotLayout from '../../src/mobile/routing/MobilePilotLayout';
import ResponsiveRoute from '../../src/mobile/routing/ResponsiveRoute';
import MobileCollaboration from '../../src/mobile/pages/Collaboration/MobileCollaboration';
import MobileAdmin from '../../src/mobile/pages/Admin/MobileAdmin';

const params = new URLSearchParams(location.search);
const inFrame = params.get('frame') === '1';
const width = Number(params.get('width') || 390);
const exercise = params.get('exercise') || 'collab-chat';
const caseId = params.get('case') || exercise;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const calls = []; const network = [];
document.cookie = 'userType=; Max-Age=0; path=/';
window.fetch = (input) => { network.push(`fetch ${input}`); return Promise.reject(new Error('Real fetch blocked')); };
XMLHttpRequest.prototype.open = function blockXHR(method, url) { network.push(`${method} ${url}`); throw new Error('Real XHR blocked'); };

let users = [
    { user_id: 7, user_name: 'Ada Admin', email: 'ada@example.test', user_type: 'admin', department_name: 'Engineering', phone_no: '9000', created_at: '2026-01-02', system_permissions: { projects: 'edit', admin: 'edit' }, project_ids: [42] },
    { user_id: 8, user_name: 'Eli Employee', email: 'eli@example.test', user_type: 'employee', department_name: 'Site', system_permissions: { projects: 'view' }, project_ids: [] },
];
let templates = [{ id: 3, name: 'Site Readers', type: 'system', permissions: { projects: 'view', collaboration: 'view', 'collaboration.chat': 'view' } }];
let initialUsersResolve; let mutationResolve;
const initialUsersDeferred = new Promise((resolve) => { initialUsersResolve = resolve; });
const mutationDeferred = new Promise((resolve) => { mutationResolve = resolve; });
let userReadCount = 0;
const adminService = {
    async getUsers() { calls.push(['users-list']); userReadCount += 1; if (exercise === 'admin-errors') throw new Error('Synthetic users failure'); if (exercise === 'admin-stale-read' && userReadCount === 1) return initialUsersDeferred; return exercise === 'admin-empty' ? { users: [] } : { users }; },
    async createUser(payload) { calls.push(['user-create', payload]); if (exercise === 'stale-mutation') return mutationDeferred; const created = { user_id: 20, user_name: payload.name, email: payload.email, user_type: payload.user_type, system_permissions: payload.system_permissions, project_ids: payload.project_ids }; users = [...users, created]; return { success: true, user: created }; },
    async updateUser(id, payload) { calls.push(['user-update', Number(id), payload]); if (exercise === 'template-partial' && Number(id) === 8) throw new Error('Synthetic row failure'); users = users.map((user) => Number(user.user_id) === Number(id) ? { ...user, ...payload, user_id: Number(id), user_name: payload.name || payload.user_name || user.user_name } : user); return { success: true }; },
    async deleteUser(id) { calls.push(['user-delete', Number(id)]); users = users.filter((user) => Number(user.user_id) !== Number(id)); return { success: true }; },
    async getPermissionTemplates() { calls.push(['templates-list', 'system']); if (exercise === 'admin-errors') throw new Error('Synthetic templates failure'); return exercise === 'admin-empty' ? { templates: [] } : { templates }; },
    async createPermissionTemplate(payload) { calls.push(['template-create', payload]); templates = [...templates, { id: 9, ...payload }]; return { success: true }; },
    async updatePermissionTemplate(id, payload) { calls.push(['template-update', Number(id), payload]); templates = templates.map((item) => Number(item.id) === Number(id) ? { ...item, ...payload } : item); return { success: true }; },
    async deletePermissionTemplate(id) { calls.push(['template-delete', Number(id)]); templates = templates.filter((item) => Number(item.id) !== Number(id)); return { success: true }; },
    async bulkUpload(file) { calls.push(['bulk-upload', file.name]); return { total_processed: 3, success_count: 2, failure_count: 1, errors: [{ message: 'Duplicate email on row 3' }] }; },
};
const projectService = { async listProjects() { calls.push(['projects-list']); if (exercise === 'admin-project-error') throw new Error('Synthetic projects failure'); return { projects: [{ id: 42, name: 'Tower A' }, { id: 43, name: 'Tower B' }] }; } };

function DesktopLayout() { return <div data-layout-branch="desktop"><Outlet /></div>; }
function DesktopCollaboration() { return <div data-desktop-collaboration>Existing desktop Collaboration</div>; }
function DesktopAdmin() { return <div data-desktop-admin>Existing desktop Admin</div>; }
function LocationProbe() { const value = useLocation(); return <i hidden data-router-location={`${value.pathname}${value.search}${value.hash}`} />; }
const findButton = (text, root = document) => [...root.querySelectorAll('button')].find((node) => node.textContent.includes(text) || node.getAttribute('aria-label')?.includes(text));
const setValue = (element, value) => { if (!element) return; const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')?.set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };

async function completeCreate() {
    findButton('Add Employee')?.click(); await wait(40); const dialog = document.querySelector('[data-mobile-employee-editor]')?.closest('[role="dialog"]');
    setValue(dialog?.querySelector('#name'), 'New Person'); setValue(dialog?.querySelector('#email'), 'new@example.test'); setValue(dialog?.querySelector('#password'), 'explicit-secret');
    findButton('Continue', dialog)?.click(); await wait(15); findButton('Continue', dialog)?.click(); await wait(15); dialog?.querySelector('input[type="checkbox"]')?.click(); findButton('Continue', dialog)?.click(); await wait(15); findButton('Save Employee', dialog)?.click(); return dialog;
}

function Checks({ setRole }) {
    const once = useRef(false); const [results, setResults] = useState(null);
    useEffect(() => { if (once.current) return; once.current = true; (async () => {
        await wait(300); const rows = []; const check = (label, pass, detail = '') => rows.push({ label, pass: Boolean(pass), detail }); const mobile = innerWidth <= 1023;
        check('Exact declared viewport', innerWidth === width, `${innerWidth}/${width}`);
        check('Exactly one responsive branch', document.querySelectorAll('[data-layout-branch]').length === 1, String(document.querySelectorAll('[data-layout-branch]').length));
        if (mobile) {
            check('One MobileMainLayout', document.querySelectorAll('[data-layout-branch="mobile"]').length === 1);
            check('One mobile Agent', document.querySelectorAll('[data-agent-contract="mobile"]').length === 1);
            check('No desktop M12 presentation', !document.querySelector('[data-desktop-collaboration], [data-desktop-admin]'));
            check('No viewport horizontal overflow', document.documentElement.scrollWidth <= innerWidth, `${document.documentElement.scrollWidth}/${innerWidth}`);
            check('No real network', network.length === 0, network.join(','));
        } else {
            check('1024 desktop presentation only', Boolean(document.querySelector('[data-desktop-collaboration], [data-desktop-admin]')) && !document.querySelector('[data-mobile-collaboration], [data-mobile-admin]'));
            check('Desktop has no mobile Agent', !document.querySelector('[data-agent-contract="mobile"]'));
        }
        if (mobile && exercise.startsWith('collab')) {
            check('Collaboration mobile outlet once', document.querySelectorAll('[data-mobile-collaboration]').length === 1);
            check('Unrelated query survives hash handling', location.search.includes('foo=preserved'), location.search);
            if (exercise === 'collab-chat') { check('Exact source channel and message render', document.body.textContent.includes('general') && document.body.textContent.includes('Good morning team!')); check('Preview-only disclosure visible', document.body.textContent.includes('Messages are not sent or saved')); findButton('Switch')?.click(); await wait(30); check('Conversation picker uses source records', document.body.textContent.includes('design-review') && document.body.textContent.includes('Madhavan')); findButton('design-review', document.querySelector('[role="dialog"]'))?.click(); await wait(30); check('Source private conversation selected', document.body.textContent.includes('Private design review started')); }
            if (exercise === 'collab-calendar') { check('Calendar is Sunday-first', [...document.querySelectorAll('[data-mobile-collaboration-calendar] span')].some((node) => node.textContent === 'Sun')); check('Exact static schedule renders', document.body.textContent.includes('Site Inspection')); check('No Add Event workflow', !findButton('Add Event') && !findButton('Event')); }
            if (exercise === 'collab-invalid') check('Invalid hash replaced once with chat', location.hash === '#chat' && document.querySelector('[data-mobile-collaboration-chat]'), location.hash);
            if (exercise === 'collab-history') { findButton('Calendar')?.click(); await wait(40); check('User tab pushes calendar hash', location.hash === '#calendar'); history.back(); await wait(80); check('Back restores chat', location.hash === '#chat' && Boolean(document.querySelector('[data-mobile-collaboration-chat]'))); history.forward(); await wait(80); check('Forward restores calendar', location.hash === '#calendar' && Boolean(document.querySelector('[data-mobile-collaboration-calendar]'))); }
        }
        if (mobile && exercise.startsWith('admin')) {
            check('Admin mobile outlet once', document.querySelectorAll('[data-mobile-admin]').length === 1);
            if (exercise === 'admin-list') { check('Source employees render as cards', document.body.textContent.includes('Ada Admin') && document.body.textContent.includes('Eli Employee')); findButton('Ada Admin')?.click(); await wait(30); check('Employee detail shows exact access surfaces', document.body.textContent.includes('System permissions') && document.body.textContent.includes('Project membership')); }
            if (exercise === 'admin-edit-delete') {
                findButton('Ada Admin')?.click(); await wait(30); const detail = document.querySelector('[data-mobile-employee-detail]')?.closest('[role="dialog"]'); findButton('Edit Access', detail)?.click(); await wait(30);
                const editor = document.querySelector('[data-mobile-employee-editor]')?.closest('[role="dialog"]'); setValue(editor?.querySelector('#phone_no'), '9111'); findButton('Continue', editor)?.click(); await wait(10); findButton('Continue', editor)?.click(); await wait(10); findButton('Continue', editor)?.click(); await wait(10); findButton('Save Employee', editor)?.click(); await wait(140);
                const update = calls.find((item) => item[0] === 'user-update' && item[1] === 7); check('Employee edit uses exact user and allowlisted payload', update?.[2].phone_no === '9111' && update?.[2].project_permissions && Object.keys(update[2].project_permissions).length === 0);
                findButton('Ada Admin')?.click(); await wait(25); const updatedDetail = document.querySelector('[data-mobile-employee-detail]')?.closest('[role="dialog"]'); findButton('Delete Employee', updatedDetail)?.click(); await wait(25); const confirm = [...document.querySelectorAll('[role="dialog"]')].find((node) => node.textContent.includes('This permanently deletes the employee account')); findButton('Delete Employee', confirm)?.click(); await wait(140);
                check('Employee delete uses exact user identifier', calls.some((item) => item[0] === 'user-delete' && item[1] === 7));
            }
            if (exercise === 'admin-create') { await completeCreate(); await wait(180); const call = calls.find((item) => item[0] === 'user-create'); check('Create uses explicit password', call?.[1].password === 'explicit-secret'); check('Create uses exact permission and membership contracts', call?.[1].project_permissions && Object.keys(call[1].project_permissions).length === 0 && call[1].project_ids.includes(42) && Object.keys(call[1].system_permissions).length === 10); }
            if (exercise === 'admin-templates' || exercise === 'template-partial') { findButton('Permission Templates')?.click(); await wait(40); check('Source template and exact counts render', document.body.textContent.includes('Site Readers') && document.body.textContent.includes('Write 0 · Read 3 · None 0')); findButton('Apply Permissions')?.click(); await wait(30); const dialog = document.querySelector('[data-mobile-template-assignments]')?.closest('[role="dialog"]'); dialog?.querySelectorAll('input[type="checkbox"]').forEach((input) => input.click()); findButton('Apply Permissions', dialog)?.click(); await wait(180); const updates = calls.filter((item) => item[0] === 'user-update'); check('Template applies sequential exact permission payloads', updates.length === 2 && updates.every((item) => item[2].system_permissions.projects === 'view')); if (exercise === 'template-partial') check('Partial template result is truthful', document.body.textContent.includes('1 succeeded, 1 failed')); }
            if (exercise === 'admin-template-crud') {
                findButton('Permission Templates')?.click(); await wait(40); findButton('Create Template')?.click(); await wait(25); let editor = document.querySelector('[data-mobile-template-editor]')?.closest('[role="dialog"]'); setValue(editor?.querySelector('#mobile-template-name'), 'New Access'); findButton('Grant All Read', editor)?.click(); await wait(20); findButton('Save Template', editor)?.click(); await wait(140);
                const created = calls.find((item) => item[0] === 'template-create'); check('Template create uses exact serialized permission object', created?.[1].name === 'New Access' && Object.values(created[1].permissions).every((value) => value === 'view'));
                const sourceCard = [...document.querySelectorAll('section')].find((node) => node.textContent.includes('Site Readers') && node.querySelector('button')); findButton('Edit', sourceCard)?.click(); await wait(25); editor = document.querySelector('[data-mobile-template-editor]')?.closest('[role="dialog"]'); setValue(editor?.querySelector('#mobile-template-name'), 'Site Readers Updated'); findButton('Save Template', editor)?.click(); await wait(140);
                check('Template update uses correct service contract', calls.some((item) => item[0] === 'template-update' && item[1] === 3 && item[2].name === 'Site Readers Updated'));
                const updatedCard = [...document.querySelectorAll('section')].find((node) => node.textContent.includes('Site Readers Updated') && node.querySelector('button')); findButton('Delete', updatedCard)?.click(); await wait(25); const confirm = [...document.querySelectorAll('[role="dialog"]')].find((node) => node.textContent.includes('Existing employee permissions are not described as rolled back')); findButton('Delete Template', confirm)?.click(); await wait(140);
                check('Template delete uses deletePermissionTemplate identifier', calls.some((item) => item[0] === 'template-delete' && item[1] === 3));
            }
            if (exercise === 'admin-bulk') { findButton('Bulk Import')?.click(); await wait(30); const input = document.querySelector('#mobile-admin-import-file'); const transfer = new DataTransfer(); transfer.items.add(new File(['Name,Email'], 'users.xlsx')); Object.defineProperty(input, 'files', { value: transfer.files, configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true })); findButton('Start Import', document.querySelector('[role="dialog"]'))?.click(); await wait(150); check('Bulk sends exact file through service', calls.some((item) => item[0] === 'bulk-upload' && item[1] === 'users.xlsx')); check('Partial import counts and errors render', document.body.textContent.includes('Duplicate email on row 3') && document.body.textContent.includes('Succeeded')); check('File input excludes XLS', input.accept === '.csv,.xlsx'); }
            if (exercise === 'admin-readonly') { findButton('Ada Admin')?.click(); await wait(30); check('Read-only detail remains available', document.body.textContent.includes('System permissions')); check('Read-only hides all representative mutation controls', !findButton('Add Employee') && !findButton('Bulk Import') && !findButton('Edit Access') && !findButton('Delete Employee')); check('Read-only issued zero mutation requests', !calls.some((item) => ['user-create','user-update','user-delete','template-create','template-update','template-delete','bulk-upload'].includes(item[0]))); }
            if (exercise === 'admin-errors') { check('Observable users rejection is persistent', document.body.textContent.includes('Synthetic users failure')); findButton('Permission Templates')?.click(); await wait(30); check('Observable templates rejection is persistent', document.body.textContent.includes('Synthetic templates failure')); }
            if (exercise === 'admin-project-error') { check('Observable projects rejection is persistent', document.body.textContent.includes('Project membership could not be loaded: Synthetic projects failure')); findButton('Ada Admin')?.click(); await wait(20); check('Observable projects rejection does not become fake membership', document.body.textContent.includes('No project membership')); }
            if (exercise === 'admin-empty') { check('Successful empty users response stays neutral', document.body.textContent.includes('No employees found') && !document.querySelector('[role="alert"]')); }
            if (exercise === 'admin-stale-read') { await completeCreate(); await wait(120); initialUsersResolve({ users: [{ user_id: 99, user_name: 'Obsolete User', email: 'old@example.test', user_type: 'employee' }] }); await wait(100); check('Overlapping users read starts fresh request', calls.filter((item) => item[0] === 'users-list').length >= 2); check('Late stale users result cannot overwrite fresh list', document.body.textContent.includes('New Person') && !document.body.textContent.includes('Obsolete User')); }
            if (exercise === 'admin-stale-mutation') { await completeCreate(); await wait(40); check('Mutation started as project-authorized admin', calls.some((item) => item[0] === 'user-create')); setRole('employee'); await wait(50); check('Role change clears stale editor', !document.querySelector('[data-mobile-employee-editor]')); const beforeReads = calls.filter((item) => item[0] === 'users-list').length; mutationResolve({ success: true }); await wait(120); check('Late mutation completion cannot refresh newer read-only state', calls.filter((item) => item[0] === 'users-list').length === beforeReads); }
        }
        setResults(rows); window.__M12_HARNESS_RESULT__ = { caseId, rows, calls, network }; parent.postMessage({ type: 'm12-results', caseId, rows }, location.origin);
    })(); }, [setRole]);
    return results ? <ol>{results.map((row) => <li key={row.label}>{row.pass ? 'PASS' : 'FAIL'} {row.label}</li>)}</ol> : null;
}

function Frame() {
    const [role, setRole] = useState(params.get('access') === 'read' ? 'employee' : 'admin');
    const collaboration = exercise.startsWith('collab');
    const authOverride = { user: { user_id: 1, user_type: role, system_permissions: { admin: 'edit', collaboration: 'edit' } } };
    return <ThemeProvider attribute="class" defaultTheme={params.get('theme') || 'light'} enableSystem={false}><AuthProvider><MemoryRouter initialEntries={[collaboration ? '/collaboration?foo=preserved' : '/admin?foo=preserved']}><LocationProbe /><Checks setRole={setRole} /><Routes><Route path="/" element={<MobilePilotLayout mobile={<MobileMainLayout loadProjects={async () => ({ projects: [] })} />} desktop={<DesktopLayout />} />}><Route path="collaboration" element={<ResponsiveRoute mobile={<MobileCollaboration />} desktop={<DesktopCollaboration />} />} /><Route path="admin" element={<ResponsiveRoute mobile={<MobileAdmin services={{ admin: adminService, project: projectService }} authOverride={authOverride} />} desktop={<DesktopAdmin />} />} /></Route></Routes></MemoryRouter></AuthProvider></ThemeProvider>;
}

const cases = [
    { id: 'collab-chat-360', width: 360, exercise: 'collab-chat', hash: 'chat' },
    { id: 'collab-chat-390', width: 390, exercise: 'collab-chat', hash: 'chat' },
    { id: 'collab-chat-dark-430', width: 430, exercise: 'collab-chat', hash: 'chat', theme: 'dark' },
    { id: 'collab-calendar-768', width: 768, exercise: 'collab-calendar', hash: 'calendar' },
    { id: 'collab-invalid-1023', width: 1023, exercise: 'collab-invalid', hash: 'invalid' },
    { id: 'collab-history', width: 390, exercise: 'collab-history', hash: 'chat' },
    { id: 'collab-desktop-1024', width: 1024, exercise: 'collab-chat', hash: 'chat' },
    { id: 'admin-list-360', width: 360, exercise: 'admin-list' },
    { id: 'admin-list-390', width: 390, exercise: 'admin-list' },
    { id: 'admin-edit-delete', width: 390, exercise: 'admin-edit-delete' },
    { id: 'admin-create-430', width: 430, exercise: 'admin-create' },
    { id: 'admin-templates-768', width: 768, exercise: 'admin-templates' },
    { id: 'admin-template-crud', width: 430, exercise: 'admin-template-crud' },
    { id: 'admin-bulk-1023', width: 1023, exercise: 'admin-bulk' },
    { id: 'admin-readonly', width: 390, exercise: 'admin-readonly', access: 'read' },
    { id: 'admin-errors', width: 390, exercise: 'admin-errors' },
    { id: 'admin-project-error', width: 390, exercise: 'admin-project-error' },
    { id: 'admin-empty', width: 390, exercise: 'admin-empty' },
    { id: 'template-partial', width: 390, exercise: 'template-partial' },
    { id: 'admin-stale-read', width: 390, exercise: 'admin-stale-read' },
    { id: 'admin-stale-mutation', width: 390, exercise: 'admin-stale-mutation' },
    { id: 'admin-desktop-1024', width: 1024, exercise: 'admin-list' },
];

function Parent() {
    const [reports, setReports] = useState({}); const next = cases[Object.keys(reports).length];
    useEffect(() => { const receive = (event) => { if (event.origin === location.origin && event.data?.type === 'm12-results') setReports((current) => current[event.data.caseId] ? current : { ...current, [event.data.caseId]: event.data.rows }); }; addEventListener('message', receive); return () => removeEventListener('message', receive); }, []);
    const assertions = Object.values(reports).flat();
    return <main><h1>M12 Collaboration and Admin harness</h1><p data-harness-summary>Completed {Object.keys(reports).length}/{cases.length}; PASS {assertions.filter((row) => row.pass).length}; FAIL {assertions.filter((row) => !row.pass).length}.</p>{Object.entries(reports).flatMap(([id, rows]) => rows.filter((row) => !row.pass).map((row) => <p key={`${id}-${row.label}`}>FAIL {id}: {row.label} {row.detail}</p>))}{next && <iframe key={next.id} title={next.id} width={next.width} height="860" style={{ border: 0 }} src={`./m12-harness.html?${new URLSearchParams({ frame: '1', case: next.id, width: next.width, exercise: next.exercise, access: next.access || 'write', theme: next.theme || 'light', foo: 'preserved' })}#${next.hash || ''}`} />}</main>;
}

createRoot(document.getElementById('root')).render(inFrame ? <Frame /> : <Parent />);
