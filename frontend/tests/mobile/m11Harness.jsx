import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import '../../src/index.css';
import { AuthProvider } from '../../src/context/AuthContext';
import MobileMainLayout from '../../src/mobile/layout/MobileMainLayout';
import MobilePilotLayout from '../../src/mobile/routing/MobilePilotLayout';
import ResponsiveRoute from '../../src/mobile/routing/ResponsiveRoute';
import MobileProjectShell from '../../src/mobile/pages/ProjectDetails/MobileProjectShell';
import MobileCadViewer from '../../src/mobile/pages/ProjectDetails/CAD/MobileCadViewer';

const params = new URLSearchParams(location.search);
const inFrame = params.get('frame') === '1';
const width = Number(params.get('width') || 390);
const exercise = params.get('exercise') || 'sheet-hub';
const access = params.get('access') || 'write';
const caseId = params.get('case') || exercise;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const network = [];
const calls = [];
window.fetch = (input) => { network.push(String(input)); return Promise.reject(new Error('Real network blocked')); };
XMLHttpRequest.prototype.open = function blockXHR(method, url) { network.push(`${method} ${url}`); throw new Error('Real XHR blocked'); };

const workbook = { id: 'wb-42', projectId: 42, name: 'P-42 - Site workbook', templateId: 'blank', updatedAt: '2026-09-12T10:00:00Z', sheets: [{ id: 'sheet-1', name: 'Sheet1', status: 1, order: 0, row: 20, column: 12, celldata: [{ r: 0, c: 0, v: { v: 'M11', m: 'M11' } }] }] };
let workbooks = [workbook];
const spreadsheetStorage = {
    getSavedWorkbooksList(projectId) { calls.push(['sheet-list', Number(projectId)]); return workbooks.filter((item) => Number(item.projectId) === Number(projectId)).map((item) => ({ ...item, sheets: undefined, sheetCount: item.sheets.length })); },
    getWorkbookById(id) { calls.push(['sheet-get', id]); return workbooks.find((item) => item.id === id) || null; },
    saveWorkbook(data, projectId) { calls.push(['sheet-save', Number(projectId), data]); if (exercise === 'sheet-save-error') return { success: false, error: 'Synthetic local save failure' }; const saved = { ...data, projectId: Number(projectId), updatedAt: new Date().toISOString() }; workbooks = [saved, ...workbooks.filter((item) => item.id !== saved.id)]; return { success: true, workbook: saved }; },
    deleteWorkbook(id, projectId) { calls.push(['sheet-delete', id, Number(projectId)]); workbooks = workbooks.filter((item) => item.id !== id); return { success: true }; },
    importFromFile: async () => ({ success: true, workbookName: 'Imported', sheets: workbook.sheets }),
    exportToXLSX(sheets, name) { calls.push(['sheet-xlsx', sheets, name]); return { success: true, fileName: name }; },
    exportToCSV(sheets, index, name) { calls.push(['sheet-csv', sheets, index, name]); return { success: true, fileName: name }; },
};

const category42 = { id: 5, name: 'Civil Drawings', icon_key: 'Ruler', drawing_count: 1 };
const category43 = { id: 8, name: 'Project B Drawings', icon_key: 'Folder', drawing_count: 0 };
const drawing = { id: 11, title: 'Foundation Plan', latestRevision: 2, latestDescription: 'Issued for construction', latestUploadedAt: '2026-09-10T10:00:00Z', latestDwgUrl: 'https://synthetic.invalid/foundation.dxf', latestPdfUrl: 'https://synthetic.invalid/foundation.pdf', revisions: [{ id: 101, rev: 'R2', revisionNumber: 2, description: 'Issued for construction', uploadedAt: '2026-09-10T10:00:00Z', uploaderName: 'Engineer', dwgUrl: 'https://synthetic.invalid/foundation.dxf', pdfUrl: 'https://synthetic.invalid/foundation.pdf' }, { id: 100, rev: 'R1', revisionNumber: 1, description: 'For review', uploadedAt: '2026-09-01T10:00:00Z', uploaderName: 'Engineer', dwgUrl: 'https://synthetic.invalid/foundation-r1.dwg' }] };
let resolveCategoryA;
const deferredCategoryA = new Promise((resolve) => { resolveCategoryA = resolve; });
const drawingService = {
    async listCategories(projectId) { calls.push(['category-list', Number(projectId)]); if (exercise === 'drawing-403') throw { status: 403 }; if (exercise === 'drawing-race' && Number(projectId) === 42) return deferredCategoryA; return { success: true, categories: Number(projectId) === 43 ? [category43] : exercise === 'drawing-empty' ? [] : [category42] }; },
    async createCategory(projectId, payload) { calls.push(['category-create', Number(projectId), payload]); return { success: true, category_id: 12 }; },
    async updateCategory(projectId, categoryId, payload) { calls.push(['category-update', Number(projectId), categoryId, payload]); return { success: true }; },
    async deleteCategory(projectId, categoryId, confirm) { calls.push(['category-delete', Number(projectId), categoryId, confirm]); return confirm ? { success: true } : { success: false, hasDrawings: true, count: 1, message: 'This category contains 1 drawing.' }; },
    async listDrawings(projectId, categoryId) { calls.push(['drawing-list', Number(projectId), categoryId]); return { success: true, drawings: [drawing] }; },
    async uploadDrawing(projectId, formData) { calls.push(['drawing-upload', Number(projectId), [...formData.entries()]]); return { success: true }; },
    async updateDrawing(projectId, categoryId, drawingId, payload) { calls.push(['drawing-update', Number(projectId), categoryId, drawingId, payload]); return { success: true }; },
    async deleteDrawing(projectId, categoryId, drawingId) { calls.push(['drawing-delete', Number(projectId), categoryId, drawingId]); return { success: true }; },
    async reorderDrawings(projectId, categoryId, payload) { calls.push(['drawing-reorder', Number(projectId), categoryId, payload]); return { success: true }; },
};

const projectService = {
    async getProject(id) { return { success: true, project: { id: Number(id), name: `Project ${id}`, project_code: `P-${id}` }, projectPermissions: { Spreadsheets: access === 'read' ? 1 : 2, Drawings: access === 'read' ? 1 : 2 } }; },
};
const auth = { user: { id: 7, user_id: 7, user_type: access === 'admin' ? 'admin' : 'employee' }, isAdmin: access === 'admin' };

function DesktopLayout() { return <div data-layout-branch="desktop"><Outlet /></div>; }
function DesktopProject() { return <div data-desktop-project>Existing desktop ProjectDetails sentinel</div>; }
function DesktopCad() { return <div data-desktop-cad>Existing desktop CAD sentinel</div>; }
function LocationProbe() { const value = useLocation(); return <i hidden data-search={value.search} data-path={value.pathname} />; }
const findButton = (text, root = document) => [...root.querySelectorAll('button')].find((node) => node.textContent.includes(text) || node.getAttribute('aria-label')?.includes(text));
const setValue = (element, value) => { if (!element) return; const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')?.set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };

const minimalDxf = `0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0\n20\n0\n30\n0\n11\n100\n21\n100\n31\n0\n0\nENDSEC\n0\nEOF\n`;
const cadFetch = async () => new Response(new TextEncoder().encode(minimalDxf), { status: 200 });
const fakeViewer = { curView: { mode: 1 }, commands: [], async openDocument(name) { calls.push(['cad-open', name]); return { database: {} }; }, sendStringToExecute(command) { this.commands.push(command); calls.push(['cad-command', command]); }, async destroy() { calls.push(['cad-destroy']); } };
const fakeViewerFactory = { createInstance(options) { calls.push(['cad-create', Boolean(options.container)]); return fakeViewer; } };

function RaceDriver() {
    const navigate = useNavigate(); const once = useRef(false);
    useEffect(() => { if (exercise !== 'drawing-race' || once.current) return; once.current = true; setTimeout(() => navigate('/projects/43?tab=Drawings&view=grid&foo=preserved'), 80); setTimeout(() => resolveCategoryA({ success: true, categories: [category42] }), 240); }, [navigate]);
    return null;
}

function Checks() {
    const [results, setResults] = useState(null);
    const navigate = useNavigate();
    useEffect(() => { (async () => {
        await wait(exercise === 'cad-real' ? 2200 : exercise === 'drawing-race' ? 500 : 650);
        const rows = []; const check = (label, pass, detail = '') => rows.push({ label, pass: Boolean(pass), detail });
        const mobile = innerWidth <= 1023; const search = () => document.querySelector('[data-search]')?.dataset.search || '';
        check('Exact declared viewport', innerWidth === width, `${innerWidth}/${width}`);
        const branchCount = exercise.startsWith('cad')
            ? document.querySelectorAll('[data-mobile-cad-viewer]').length + document.querySelectorAll('[data-desktop-cad]').length
            : document.querySelectorAll('[data-layout-branch]').length;
        check('Exactly one responsive branch', branchCount === 1, String(branchCount));
        if (exercise.startsWith('cad')) {
            if (mobile) {
                check('Standalone mobile CAD only', document.querySelectorAll('[data-mobile-cad-viewer]').length === 1 && !document.querySelector('[data-desktop-cad]'));
                check('Standalone CAD has zero Agents', document.querySelectorAll('[data-agent-contract="mobile"]').length === 0);
                check('CAD page has no viewport overflow', document.documentElement.scrollWidth <= innerWidth, `${document.documentElement.scrollWidth}/${innerWidth}`);
                if (exercise === 'cad-fake') {
                    check('CAD viewer initializes one engine', calls.filter((entry) => entry[0] === 'cad-create').length === 1);
                    check('CAD opens source with real extension', calls.some((entry) => entry[0] === 'cad-open' && entry[1] === 'Fixture.dxf'));
                    for (const label of ['Select', 'Measure', 'Clear', 'Fit']) { findButton(label)?.click(); await wait(15); }
                    check('CAD commands reach existing engine', ['dist', 'regen', 'zoom e'].every((command) => fakeViewer.commands.includes(command)));
                } else {
                    check('Real CAD canvas initializes', Boolean(document.querySelector('[data-testid="mobile-cad-canvas"] canvas') || document.querySelector('[data-testid="mobile-cad-canvas"] > *')));
                    check('Real CAD fixture completes without visible error', !document.querySelector('[role="alert"]'), document.querySelector('[role="alert"]')?.textContent || '');
                }
            } else {
                check('1024 uses desktop CAD only', Boolean(document.querySelector('[data-desktop-cad]')) && !document.querySelector('[data-mobile-cad-viewer]'));
                check('Desktop CAD route has zero mobile Agents', !document.querySelector('[data-agent-contract="mobile"]'));
            }
        } else if (!mobile) {
            check('1024 uses desktop ProjectDetails only', Boolean(document.querySelector('[data-desktop-project]')) && !document.querySelector('[data-mobile-page="project-shell"]'));
            check('Desktop project has no mobile Agent', !document.querySelector('[data-agent-contract="mobile"]'));
        } else {
            check('One MobileMainLayout', document.querySelectorAll('[data-layout-branch="mobile"]').length === 1);
            check('One MobileProjectShell', document.querySelectorAll('[data-mobile-page="project-shell"]').length === 1);
            check('One mobile Agent', document.querySelectorAll('[data-agent-contract="mobile"]').length === 1);
            check('No desktop module', !document.querySelector('[data-desktop-project]'));
            check('No viewport horizontal overflow', document.documentElement.scrollWidth <= innerWidth, `${document.documentElement.scrollWidth}/${innerWidth}`);
            check('No real fetch or XHR', network.length === 0, network.join(','));
            check('Unrelated query preserved', search().includes('foo=preserved'), search());
        }

        if (mobile && exercise === 'sheet-hub') {
            check('Spreadsheet outlet mounts once', document.querySelectorAll('[data-mobile-project-spreadsheets]').length === 1);
            check('Local storage disclosure is explicit', document.body.textContent.includes('Not synchronized to the ERP server'));
            check('Stored workbook visible', document.body.textContent.includes('Site workbook'));
        }
        if (mobile && exercise === 'sheet-real') {
            check('Local storage disclosure is explicit', document.body.textContent.includes('Not synchronized to the ERP server'));
            findButton('P-42 - Site workbook')?.click(); await wait(1100);
            const editor = document.querySelector('[data-mobile-spreadsheet-editor]');
            const fortune = document.querySelector('.fortune-sheet-container');
            check('Real FortuneSheet mounts', Boolean(editor && fortune));
            check('Only FortuneSheet sheet navigator renders', document.querySelectorAll('.fortune-sheet-container').length === 1 && !document.querySelector('[data-mano-sheet-navigator]'));
            const scroller = document.querySelector('[data-testid="mobile-fortune-sheet-scroll"]');
            const before = scroller?.scrollLeft || 0; if (scroller) scroller.scrollLeft = 120;
            check('Spreadsheet horizontal movement stays internal', (scroller?.scrollLeft || 0) > before && document.documentElement.scrollWidth <= innerWidth);
            const canvas = document.querySelector('.fortune-sheet-canvas');
            canvas?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 90, clientY: 90 })); canvas?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 90, clientY: 90 })); canvas?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 90, clientY: 90 })); await wait(80);
            check('FortuneSheet accepts cell selection interaction', Boolean(document.querySelector('.luckysheet-cell-selected') || document.querySelector('.luckysheet-input-box')));
            check('Write editor exposes save', Boolean(document.querySelector('button[aria-label="Save workbook"]')));
        }
        if (mobile && exercise === 'sheet-readonly') {
            check('Read-only hub hides local mutation controls', !findButton('Blank workbook') && !findButton('Import') && !findButton('Duplicate workbook') && !findButton('Delete workbook'));
            findButton('P-42 - Site workbook')?.click(); await wait(950);
            check('Read-only workbook opens', Boolean(document.querySelector('[data-mobile-spreadsheet-editor]')));
            check('Read-only editor has no save control', !document.querySelector('button[aria-label="Save workbook"]'));
            check('Read-only inspection performs zero storage mutations', !calls.some((entry) => ['sheet-save', 'sheet-delete'].includes(entry[0])));
        }
        if (mobile && exercise === 'sheet-actions') {
            findButton('Actions for P-42 - Site workbook')?.click(); await wait(60); findButton('Duplicate workbook', document.querySelector('[role="dialog"]'))?.click(); await wait(120);
            check('Duplicate delegates project-keyed local save', calls.some((entry) => entry[0] === 'sheet-save' && entry[1] === 42 && entry[2].name.includes('(Copy)')));
            const target = workbooks.find((item) => item.name.includes('(Copy)')); findButton('Back to workbooks')?.click(); await wait(100); if (target) { findButton(`Actions for ${target.name}`)?.click(); await wait(50); const actionsDialog = document.querySelector('[role="dialog"]'); findButton('Delete workbook', actionsDialog)?.click(); await wait(50); const confirmDialog = document.querySelector('[role="dialog"]'); findButton('Delete', confirmDialog)?.click(); await wait(80); }
            check('Delete delegates exact workbook and project', calls.some((entry) => entry[0] === 'sheet-delete' && entry[1] === target?.id && entry[2] === 42));
        }
        if (mobile && exercise === 'sheet-save-error') {
            findButton('Blank workbook')?.click(); await wait(80);
            check('Observable local save failure is truthful', document.body.textContent.includes('Synthetic local save failure'));
        }
        if (mobile && exercise === 'drawing-grid') {
            check('Drawing grid mounts once', document.querySelectorAll('[data-mobile-project-drawings][data-drawings-view="grid"]').length === 1);
            check('Source category renders', document.body.textContent.includes('Civil Drawings'));
            findButton('New category')?.click(); await wait(50); setValue(document.querySelector('#mobile-drawing-category-name'), 'Electrical'); findButton('Create category', document.querySelector('[role="dialog"]'))?.click(); await wait(100);
            check('Category create uses source payload', calls.some((entry) => entry[0] === 'category-create' && entry[1] === 42 && entry[2].name === 'Electrical' && entry[2].icon_key));
            findButton('Delete')?.click(); await wait(50); findButton('Check and delete', document.querySelector('[role="dialog"]'))?.click(); await wait(80);
            check('First delete never sends confirm', calls.some((entry) => entry[0] === 'category-delete' && entry[3] === false) && !calls.some((entry) => entry[0] === 'category-delete' && entry[3] === true));
            check('Server consequence is displayed', document.body.textContent.includes('contains 1 drawing'));
            findButton('Delete all', document.querySelector('[role="dialog"]'))?.click(); await wait(100);
            check('Explicit second confirmation sends confirm=true', calls.some((entry) => entry[0] === 'category-delete' && entry[3] === true));
        }
        if (mobile && exercise === 'drawing-detail') {
            findButton('Civil Drawings')?.click(); await wait(150);
            check('Detail query preserves tab and unrelated params', search().includes('tab=Drawings') && search().includes('view=detail') && search().includes('cat=5') && search().includes('foo=preserved'), search());
            check('Drawing list uses actual source record', document.body.textContent.includes('Foundation Plan') && document.body.textContent.includes('Issued for construction'));
            findButton('Foundation Plan')?.click(); await wait(60); const dialog = document.querySelector('[data-mobile-drawing-detail]')?.closest('[role="dialog"]');
            check('Revision history renders', dialog?.textContent.includes('R2 · Latest') && dialog?.textContent.includes('R1'));
            findButton('Edit', dialog)?.click(); await wait(30); setValue(dialog?.querySelector('#mobile-drawing-edit-title'), 'Foundation Plan Updated'); findButton('Save', dialog)?.click(); await wait(100);
            check('Drawing update uses project/category/group contract', calls.some((entry) => entry[0] === 'drawing-update' && entry[1] === 42 && entry[2] === 5 && entry[3] === 11 && entry[4].title === 'Foundation Plan Updated'));
            navigate(-1); await wait(80); check('Browser Back restores drawing grid', search().includes('view=grid')); navigate(1); await wait(120); check('Browser Forward restores drawing detail', search().includes('view=detail') && search().includes('cat=5'));
        }
        if (mobile && exercise === 'drawing-mutations') {
            findButton('Civil Drawings')?.click(); await wait(150);
            findButton('Upload drawing')?.click(); await wait(50);
            let dialog = document.querySelector('[role="dialog"]'); setValue(dialog?.querySelector('#mobile-drawing-title'), 'Services Plan');
            let input = dialog?.querySelector('#mobile-drawing-file'); const firstTransfer = new DataTransfer(); firstTransfer.items.add(new File(['DXF'], 'services.dxf', { type: 'application/dxf' })); Object.defineProperty(input, 'files', { value: firstTransfer.files, configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true }));
            findButton('Create drawing', dialog)?.click(); await wait(120);
            const createCall = calls.find((entry) => entry[0] === 'drawing-upload');
            check('DXF create uses dwgFile multipart field', createCall?.[1] === 42 && createCall?.[2].some(([key, value]) => key === 'dwgFile' && value.name === 'services.dxf'));
            findButton('Foundation Plan')?.click(); await wait(50); dialog = document.querySelector('[data-mobile-drawing-detail]')?.closest('[role="dialog"]'); findButton('Revision', dialog)?.click(); await wait(50);
            dialog = document.querySelector('[role="dialog"]'); input = dialog?.querySelector('#mobile-drawing-file'); const revisionTransfer = new DataTransfer(); revisionTransfer.items.add(new File(['PDF'], 'revision.pdf', { type: 'application/pdf' })); Object.defineProperty(input, 'files', { value: revisionTransfer.files, configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true })); findButton('Upload revision', dialog)?.click(); await wait(120);
            const revisionCall = calls.filter((entry) => entry[0] === 'drawing-upload').at(-1);
            check('Revision preserves group and pdfFile contract', revisionCall?.[2].some(([key, value]) => key === 'drawingGroupId' && value === '11') && revisionCall?.[2].some(([key, value]) => key === 'pdfFile' && value.name === 'revision.pdf'));
            findButton('Foundation Plan')?.click(); await wait(50); dialog = document.querySelector('[data-mobile-drawing-detail]')?.closest('[role="dialog"]'); findButton('Delete', dialog)?.click(); await wait(40); const deleteDialog = [...document.querySelectorAll('[role="dialog"]')].at(-1); findButton('Delete', deleteDialog)?.click(); await wait(100);
            check('Confirmed drawing delete uses project category and group', calls.some((entry) => entry[0] === 'drawing-delete' && entry[1] === 42 && entry[2] === 5 && entry[3] === 11));
        }
        if (mobile && exercise === 'drawing-readonly') {
            check('Read-only drawings hide category mutation controls', !findButton('New category') && !findButton('Edit') && !findButton('Delete'));
            findButton('Civil Drawings')?.click(); await wait(120); findButton('Foundation Plan')?.click(); await wait(50);
            const dialog = document.querySelector('[data-mobile-drawing-detail]')?.closest('[role="dialog"]');
            check('Read-only drawing detail keeps history', dialog?.textContent.includes('Revision history'));
            check('Read-only drawing detail has zero mutations', !findButton('Edit', dialog) && !findButton('Revision', dialog) && !findButton('Delete', dialog) && !calls.some((entry) => entry[0].includes('create') || entry[0].includes('update') || entry[0].includes('delete') || entry[0].includes('upload')));
        }
        if (mobile && exercise === 'drawing-403') check('Drawing 403 uses current-policy access state', document.body.textContent.includes('Access denied by the current ERP permission policy.'));
        if (mobile && exercise === 'drawing-empty') check('Empty drawing state is truthful', document.body.textContent.includes('No drawing categories'));
        if (mobile && exercise === 'drawing-invalid') check('Invalid/stale drawing query normalizes safely', search().includes('view=grid') && !search().includes('cat=999') && search().includes('foo=preserved'), search());
        if (mobile && exercise === 'drawing-race') {
            check('Project B starts its own category request', calls.some((entry) => entry[0] === 'category-list' && entry[1] === 43));
            check('Late A data never overwrites B', document.body.textContent.includes('Project B Drawings') && !document.body.textContent.includes('Civil Drawings'));
        }
        setResults(rows); window.__M11_HARNESS_RESULT__ = { caseId, rows, calls, network }; parent.postMessage({ type: 'm11-results', caseId, rows }, location.origin);
    })(); }, []);
    return results ? <ol>{results.map((row) => <li key={row.label}>{row.pass ? 'PASS' : 'FAIL'} {row.label}</li>)}</ol> : null;
}

function ProjectFrame() {
    const tab = exercise.startsWith('drawing') ? 'Drawings' : 'Spreadsheets';
    const query = exercise === 'drawing-invalid' ? '&view=detail&cat=999' : exercise.startsWith('drawing') ? '&view=grid' : '';
    return <ThemeProvider attribute="class" defaultTheme={params.get('theme') || 'light'} enableSystem={false}><AuthProvider><MemoryRouter initialEntries={[`/projects/42?tab=${tab}${query}&foo=preserved`]}><LocationProbe /><RaceDriver /><Checks /><Routes><Route path="/" element={<MobilePilotLayout mobile={<MobileMainLayout loadProjects={async () => ({ projects: [] })} />} desktop={<DesktopLayout />} />}><Route path="projects/:id" element={<ResponsiveRoute mobile={<MobileProjectShell authOverride={auth} projectService={projectService} moduleServices={{ spreadsheets: spreadsheetStorage, drawings: drawingService }} />} desktop={<DesktopProject />} />} /></Route></Routes></MemoryRouter></AuthProvider></ThemeProvider>;
}
function CadFrame() {
    const real = exercise === 'cad-real';
    return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}><MemoryRouter initialEntries={['/drawing-viewer?url=https%3A%2F%2Fsynthetic.invalid%2Ffixture.dxf&name=Fixture']}><LocationProbe /><Checks /><Routes><Route path="/drawing-viewer" element={<ResponsiveRoute mobile={<MobileCadViewer fetchImpl={cadFetch} {...(!real ? { viewerFactory: fakeViewerFactory, hostServices: { activeFontUrl: '/' } } : {})} />} desktop={<div data-layout-branch="desktop"><DesktopCad /></div>} />} /></Routes></MemoryRouter></ThemeProvider>;
}
function Frame() { return exercise.startsWith('cad') ? <CadFrame /> : <ProjectFrame />; }

const cases = [
    { id: 'sheet-real-360', width: 360, exercise: 'sheet-real' },
    { id: 'sheet-real-390', width: 390, exercise: 'sheet-real' },
    { id: 'sheet-real-dark-430', width: 430, exercise: 'sheet-real', theme: 'dark' },
    { id: 'sheet-actions-768', width: 768, exercise: 'sheet-actions' },
    { id: 'drawing-grid-1023', width: 1023, exercise: 'drawing-grid' },
    { id: 'project-desktop-1024', width: 1024, exercise: 'sheet-hub' },
    { id: 'sheet-readonly', width: 390, exercise: 'sheet-readonly', access: 'read' },
    { id: 'sheet-save-error', width: 390, exercise: 'sheet-save-error' },
    { id: 'drawing-detail', width: 390, exercise: 'drawing-detail' },
    { id: 'drawing-mutations', width: 430, exercise: 'drawing-mutations' },
    { id: 'drawing-readonly', width: 390, exercise: 'drawing-readonly', access: 'read' },
    { id: 'drawing-403', width: 390, exercise: 'drawing-403' },
    { id: 'drawing-empty', width: 390, exercise: 'drawing-empty' },
    { id: 'drawing-invalid', width: 390, exercise: 'drawing-invalid' },
    { id: 'drawing-race', width: 390, exercise: 'drawing-race' },
    { id: 'cad-fake-360', width: 360, exercise: 'cad-fake' },
    { id: 'cad-real-390', width: 390, exercise: 'cad-real' },
    { id: 'cad-desktop-1024', width: 1024, exercise: 'cad-fake' },
];
function Parent() {
    const [reports, setReports] = useState({});
    const nextCase = cases[Object.keys(reports).length];
    useEffect(() => { const receive = (event) => { if (event.origin === location.origin && event.data?.type === 'm11-results') setReports((current) => current[event.data.caseId] ? current : { ...current, [event.data.caseId]: event.data.rows }); }; addEventListener('message', receive); return () => removeEventListener('message', receive); }, []);
    const assertions = Object.values(reports).flat();
    return <main><h1>M11 Spreadsheets, Drawings, and CAD harness</h1><p data-harness-summary>Completed {Object.keys(reports).length}/{cases.length}; PASS {assertions.filter((row) => row.pass).length}; FAIL {assertions.filter((row) => !row.pass).length}.</p>{Object.entries(reports).flatMap(([id, rows]) => rows.filter((row) => !row.pass).map((row) => <p key={`${id}-${row.label}`}>FAIL {id}: {row.label} {row.detail}</p>))}{nextCase && <iframe key={nextCase.id} title={nextCase.id} width={nextCase.width} height="820" src={`./m11-harness.html?${new URLSearchParams({ frame: '1', case: nextCase.id, width: nextCase.width, exercise: nextCase.exercise, access: nextCase.access || 'write', theme: nextCase.theme || 'light' })}`} />}</main>;
}

createRoot(document.getElementById('root')).render(inFrame ? <Frame /> : <Parent />);
