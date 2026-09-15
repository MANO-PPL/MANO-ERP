import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import '../../src/index.css';
import { AuthProvider } from '../../src/context/AuthContext';
import { authApi } from '../../src/services/authApi';
import MobileMainLayout from '../../src/mobile/layout/MobileMainLayout';
import MobileGlobalSpreadsheets from '../../src/mobile/pages/Spreadsheets/MobileGlobalSpreadsheets';
import MobilePilotLayout from '../../src/mobile/routing/MobilePilotLayout';
import ResponsiveRoute from '../../src/mobile/routing/ResponsiveRoute';

const params = new URLSearchParams(location.search);
const inFrame = params.get('frame') === '1';
const width = Number(params.get('width') || 390);
const exercise = params.get('exercise') || 'hub';
const access = params.get('access') || 'write';
const caseId = params.get('case') || exercise;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const calls = []; const network = [];
document.cookie = 'userType=employee; path=/';
window.fetch = (input) => { network.push(`fetch ${String(input)}`); return Promise.reject(new Error('Real fetch blocked')); };
XMLHttpRequest.prototype.open = function blockXHR(method, url) { network.push(`${method} ${url}`); throw new Error('Real XHR blocked'); };
let prints = 0; window.print = () => { prints += 1; };

authApi.getMe = async () => ({ success: true, user: { user_id: 7, user_name: 'Global Fixture', user_type: 'employee', system_permissions: { spreadsheets: access === 'read' ? 'view' : 'edit' } } });

const sheets = [{ id: 'sheet-1', name: 'Sheet1', status: 1, order: 0, row: 20, column: 12, celldata: [{ r: 0, c: 0, v: { v: 'Global fixture', m: 'Global fixture' } }] }];
let workbooks = [{ id: 'wb-global', name: 'Global Fixture Workbook', projectId: null, templateId: 'blank', updatedAt: '2026-09-15T00:00:00.000Z', sheets }];
const storage = {
    getSavedWorkbooksList(projectId) { calls.push(['list', projectId]); return projectId == null ? workbooks.map((workbook) => ({ ...workbook, sheets: undefined, sheetCount: workbook.sheets.length })) : []; },
    getWorkbookById(id) { calls.push(['get', id]); if (exercise === 'ownership' && id === 'wb-global') return { ...workbooks[0], projectId: 42 }; return workbooks.find((workbook) => workbook.id === id) || null; },
    saveWorkbook(workbook, projectId) { calls.push(['save', projectId, workbook]); const saved = { ...workbook, projectId: null, updatedAt: new Date().toISOString() }; workbooks = [saved, ...workbooks.filter((item) => item.id !== saved.id)]; return { success: true, workbook: saved }; },
    deleteWorkbook(id, projectId) { calls.push(['delete', id, projectId]); workbooks = workbooks.filter((workbook) => workbook.id !== id); return { success: true }; },
    importFromFile: async (file) => { calls.push(['import', file.name]); return { success: true, workbookName: 'Imported Global', sheets }; },
    exportToXLSX(data, name) { calls.push(['xlsx', data, name]); return { success: true, fileName: name }; },
    exportToCSV(data, index, name) { calls.push(['csv', data, index, name]); return { success: true, fileName: name }; },
};

function DesktopLayout() { return <div data-layout-branch="desktop"><div data-desktop-sidebar>Existing desktop Sidebar sentinel</div><Outlet /></div>; }
function DesktopSpreadsheets() { return <div data-desktop-spreadsheet-page>Existing desktop SpreadsheetPage sentinel</div>; }
function Home() { return <div data-mobile-home>Mobile dashboard fixture</div>; }
function LocationProbe() { const current = useLocation(); return <i hidden data-route={`${current.pathname}${current.search}`} />; }
const findButton = (text, root = document) => [...root.querySelectorAll('button')].find((node) => node.textContent.includes(text) || node.getAttribute('aria-label')?.includes(text) || node.title?.includes(text));
const setValue = (element, value) => { if (!element) return; const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')?.set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };

function Checks() {
    const once = useRef(false); const [results, setResults] = useState(null);
    useEffect(() => { if (once.current) return; once.current = true; (async () => {
        await wait(450); const rows = []; const check = (label, pass, detail = '') => rows.push({ label, pass: Boolean(pass), detail }); const mobile = innerWidth <= 1023;
        check('Exact declared viewport', innerWidth === width, `${innerWidth}/${width}`);
        check('Exactly one responsive branch', document.querySelectorAll('[data-layout-branch]').length === 1, String(document.querySelectorAll('[data-layout-branch]').length));
        if (!mobile) {
            check('1024 uses desktop SpreadsheetPage only', Boolean(document.querySelector('[data-desktop-spreadsheet-page]')) && !document.querySelector('[data-mobile-global-spreadsheets]'));
            check('1024 retains desktop Sidebar', Boolean(document.querySelector('[data-desktop-sidebar]')));
            check('1024 has no mobile Agent/layout', !document.querySelector('[data-agent-contract="mobile"]') && !document.querySelector('[data-layout-branch="mobile"]'));
        } else {
            check('One MobileMainLayout', document.querySelectorAll('[data-layout-branch="mobile"]').length === 1);
            check('One mobile Agent', document.querySelectorAll('[data-agent-contract="mobile"]').length === 1);
            check('No desktop SpreadsheetPage or Sidebar', !document.querySelector('[data-desktop-spreadsheet-page], [data-desktop-sidebar]'));
            check('No viewport horizontal overflow', document.documentElement.scrollWidth <= innerWidth, `${document.documentElement.scrollWidth}/${innerWidth}`);
            check('No real network', network.length === 0, network.join(','));
            if (exercise === 'drawer') {
                findButton('Open navigation')?.click(); await wait(40); const link = [...document.querySelectorAll('#mobile-navigation-drawer a')].find((node) => node.getAttribute('href') === '/spreadsheets'); check('Drawer exposes Spreadsheets navigation', Boolean(link)); link?.click(); await wait(180);
                check('Drawer navigation reaches global Spreadsheets once', document.querySelectorAll('[data-mobile-global-spreadsheets]').length === 1);
                check('Drawer closes and consumes its visible layer', !document.querySelector('[data-testid="mobile-drawer-layer"]'));
                check('Drawer navigation leaves no desktop sidebar', !document.querySelector('[data-desktop-sidebar]'));
            } else {
                check('Global mobile hub mounts once', document.querySelectorAll('[data-mobile-global-spreadsheets]').length === 1);
                check('Global disclosure has no project wording', document.body.textContent.includes('These workbooks are not synchronized to the ERP server') && !document.body.textContent.includes('for this project'));
                check('Global list is requested with null scope', calls.some((call) => call[0] === 'list' && call[1] == null));
                if (exercise === 'template') { findButton('New workbook')?.click(); await wait(1050); check('Primary create saves a null-owned global workbook', calls.some((call) => call[0] === 'save' && call[1] == null && call[2].projectId === null)); check('Created workbook opens in the shared mobile editor', Boolean(document.querySelector('[data-mobile-spreadsheet-editor]'))); }
                if (exercise === 'import') { const input = document.querySelector('input[type="file"]'); const transfer = new DataTransfer(); transfer.items.add(new File(['fixture'], 'global.xlsx')); Object.defineProperty(input, 'files', { value: transfer.files, configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true })); await wait(1050); check('Import uses the source file contract', calls.some((call) => call[0] === 'import' && call[1] === 'global.xlsx')); check('Imported workbook preserves global ownership', calls.some((call) => call[0] === 'save' && call[1] == null && call[2].projectId === null && call[2].templateId === 'imported')); }
                if (exercise === 'editor') { findButton('Global Fixture Workbook')?.click(); await wait(1100); check('Global index entry opens one FortuneSheet editor', document.querySelectorAll('[data-mobile-spreadsheet-editor]').length === 1 && document.querySelectorAll('.fortune-sheet-container').length === 1); const scroller = document.querySelector('[data-testid="mobile-fortune-sheet-scroll"]'); const before = scroller?.scrollLeft || 0; if (scroller) scroller.scrollLeft = 120; check('Grid horizontal scrolling stays contained', (scroller?.scrollLeft || 0) > before && document.documentElement.scrollWidth <= innerWidth); setValue(document.querySelector('#mobile-workbook-name'), 'Renamed Global Workbook'); findButton('Save workbook')?.click(); await wait(80); check('Rename/edit save remains global', calls.some((call) => call[0] === 'save' && call[1] == null && call[2].name === 'Renamed Global Workbook')); findButton('Export workbook')?.click(); await wait(30); const dialog = document.querySelector('[role="dialog"]'); findButton('Export all sheets as XLSX', dialog)?.click(); await wait(20); findButton('Export workbook')?.click(); await wait(30); findButton('Export active sheet as CSV', document.querySelector('[role="dialog"]'))?.click(); await wait(20); findButton('Export workbook')?.click(); await wait(30); findButton('Print from browser', document.querySelector('[role="dialog"]'))?.click(); await wait(20); check('XLSX, CSV, and print use existing contracts', calls.some((call) => call[0] === 'xlsx') && calls.some((call) => call[0] === 'csv') && prints === 1); findButton('Back to workbooks')?.click(); await wait(50); findButton('Actions for Renamed Global Workbook')?.click(); await wait(30); findButton('Duplicate workbook', document.querySelector('[role="dialog"]'))?.click(); await wait(80); check('Duplicate remains global', calls.some((call) => call[0] === 'save' && call[1] == null && String(call[2].name).includes('(Copy)'))); }
                if (exercise === 'readonly') { check('Read-only hides mutation controls', !findButton('New workbook') && !findButton('Import XLSX') && !findButton('Duplicate workbook') && !findButton('Delete workbook')); findButton('Global Fixture Workbook')?.click(); await wait(1050); check('Read-only may inspect and has no save control', Boolean(document.querySelector('[data-mobile-spreadsheet-editor]')) && !findButton('Save workbook')); check('Read-only issues no local storage mutation', !calls.some((call) => ['save', 'delete', 'import'].includes(call[0]))); }
                if (exercise === 'ownership') { findButton('Global Fixture Workbook')?.click(); await wait(80); check('Project-owned body is rejected despite global index entry', document.body.textContent.includes('unavailable in Global Spreadsheets') && !document.querySelector('[data-mobile-spreadsheet-editor]')); }
                if (exercise === 'formula') { findButton('Formula Assistant')?.click(); await wait(120); check('Existing Formula Assistant is reachable at mobile width', document.body.textContent.includes('Formula Assistant & Function Inserter')); check('Formula Assistant does not create a second spreadsheet engine', document.querySelectorAll('.fortune-sheet-container').length === 0); }
                if (exercise === 'dark') { findButton('Use dark theme')?.click(); await wait(30); check('Dark theme applies', document.documentElement.classList.contains('dark')); }
            }
        }
        setResults(rows); window.__GLOBAL_SHEETS_RESULT__ = { caseId, rows, calls, network }; parent.postMessage({ type: 'global-sheets-results', caseId, rows }, location.origin);
    })(); }, []);
    return results ? <ol>{results.map((row) => <li key={row.label}>{row.pass ? 'PASS' : 'FAIL'} {row.label} {row.detail}</li>)}</ol> : null;
}

function Frame() {
    const initialPath = exercise === 'drawer' ? '/' : '/spreadsheets';
    return <ThemeProvider attribute="class" defaultTheme={params.get('theme') || 'light'} enableSystem={false}><AuthProvider><MemoryRouter initialEntries={[initialPath]}><LocationProbe /><Checks /><Routes><Route path="/" element={<MobilePilotLayout mobile={<MobileMainLayout loadProjects={async () => ({ success: true, projects: [] })} />} desktop={<DesktopLayout />} />}><Route index element={<Home />} /><Route path="spreadsheets" element={<ResponsiveRoute mobile={<MobileGlobalSpreadsheets storage={storage} />} desktop={<DesktopSpreadsheets />} />} /></Route></Routes></MemoryRouter></AuthProvider></ThemeProvider>;
}

const cases = [
    { id: 'drawer-360', width: 360, exercise: 'drawer' },
    { id: 'hub-390', width: 390, exercise: 'hub' },
    { id: 'dark-430', width: 430, exercise: 'dark', theme: 'dark' },
    { id: 'template-768', width: 768, exercise: 'template' },
    { id: 'import-1023', width: 1023, exercise: 'import' },
    { id: 'editor-actions-390', width: 390, exercise: 'editor' },
    { id: 'readonly-390', width: 390, exercise: 'readonly', access: 'read' },
    { id: 'ownership-390', width: 390, exercise: 'ownership' },
    { id: 'formula-390', width: 390, exercise: 'formula' },
    { id: 'desktop-1024', width: 1024, exercise: 'hub' },
];

function Parent() {
    const [reports, setReports] = useState({}); const next = cases[Object.keys(reports).length];
    useEffect(() => { const receive = (event) => { if (event.origin === location.origin && event.data?.type === 'global-sheets-results') setReports((current) => current[event.data.caseId] ? current : { ...current, [event.data.caseId]: event.data.rows }); }; addEventListener('message', receive); return () => removeEventListener('message', receive); }, []);
    const assertions = Object.values(reports).flat();
    return <main><h1>Global Spreadsheets parity harness</h1><p data-harness-summary>Completed {Object.keys(reports).length}/{cases.length}; PASS {assertions.filter((row) => row.pass).length}; FAIL {assertions.filter((row) => !row.pass).length}.</p>{Object.entries(reports).flatMap(([id, rows]) => rows.filter((row) => !row.pass).map((row) => <p key={`${id}-${row.label}`}>FAIL {id}: {row.label} {row.detail}</p>))}{next && <iframe key={next.id} title={next.id} width={next.width} height="900" style={{ border: 0 }} src={`./global-spreadsheets-harness.html?${new URLSearchParams({ frame: '1', case: next.id, width: next.width, exercise: next.exercise, access: next.access || 'write', theme: next.theme || 'light' })}`} />}</main>;
}

createRoot(document.getElementById('root')).render(inFrame ? <Frame /> : <Parent />);
