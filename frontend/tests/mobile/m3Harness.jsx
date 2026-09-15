import React, { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import '../../src/index.css';
import { AuthProvider } from '../../src/context/AuthContext';
import MobileMainLayout from '../../src/mobile/layout/MobileMainLayout';
import MobileClients from '../../src/mobile/pages/Clients/MobileClients';
import MobileClientBulkUpload from '../../src/mobile/pages/Clients/MobileClientBulkUpload';
import MobileResources from '../../src/mobile/pages/Resources/MobileResources';
import MobileResourceBulkUpload from '../../src/mobile/pages/Resources/MobileResourceBulkUpload';
import MobileVendors from '../../src/mobile/pages/Vendors/MobileVendors';
import MobileVendorBulkUpload from '../../src/mobile/pages/Vendors/MobileVendorBulkUpload';
import MobilePilotLayout from '../../src/mobile/routing/MobilePilotLayout';
import ResponsiveRoute from '../../src/mobile/routing/ResponsiveRoute';
import { createRequestLoader } from '../../src/mobile/utils/createRequestLoader';

const params = new URLSearchParams(window.location.search);
const frameMode = params.get('frame') === '1';
const route = params.get('route') || '/vendors';
const access = params.get('access') || 'write';
const exercise = params.get('exercise') || '';
const caseId = params.get('case') || `${window.innerWidth}-${route}-${access}-${exercise}`;
const harnessEntry = window.location.pathname.endsWith('/index.html') ? './index.html' : './m3-harness.html';
const counters = { vendorLoads: 0, clientLoads: 0, resourceLoads: 0, projectLoads: 0, validates: 0, imports: 0, clientDetails: 0, resourceDetails: 0, recipeLoads: 0, rateLoads: 0 };
const payloads = {};
const networkAttempts = [];

const originalFetch = window.fetch;
const originalXhrOpen = XMLHttpRequest.prototype.open;
window.fetch = (input) => { networkAttempts.push(`fetch ${String(input)}`); return Promise.reject(new Error('M3 harness blocks application network requests')); };
XMLHttpRequest.prototype.open = function blockedXhr(method, url) { networkAttempts.push(`${method} ${url}`); throw new Error('M3 harness blocks application network requests'); };
window.addEventListener('beforeunload', () => { window.fetch = originalFetch; XMLHttpRequest.prototype.open = originalXhrOpen; });

const vendors = [{ id: 11, name: 'Synthetic Vendor', category: 'Supplier', job_name: 'Civil', contact_no: '1000000000', email: 'vendor@example.test', address: 'Fixture address', location: 'Test City' }];
const clients = [{ id: 21, name: 'Synthetic Client', sector_name: 'Infrastructure', job_name: 'Civil', contact_no: '2000000000', interactions: [{ id: 1, type: 'Call', interaction_date: '2026-09-01', remarks: 'Synthetic only' }] }];
const resources = [
    { id: 31, name: 'Synthetic Cement', code: 'MAT-31', type: 'material', base_unit_code: 'kg' },
    { id: 32, name: 'Synthetic Labour', code: 'LAB-32', type: 'labour', base_unit_code: 'hr' },
    { id: 33, name: 'Synthetic Concrete', code: 'ITM-33', type: 'item', base_unit_code: 'm3' },
];
const resourceDetails = {
    31: { ...resources[0], conversions: [{ id: 301, name: 'Bag', quantity: 50, unit_code: 'kg' }], compositions: [] },
    32: { ...resources[1], conversions: [], compositions: [] },
    33: { ...resources[2], conversions: [], compositions: [{ component_resource_id: 31, quantity: 2, unit_code: 'kg', effective_from: '2026-08-01' }] },
};

const delay = (ms = 25) => new Promise((resolve) => window.setTimeout(resolve, ms));
const loadVendors = createRequestLoader(async () => { counters.vendorLoads += 1; await delay(); return { success: true, vendors }; });
const loadJobNatures = createRequestLoader(async () => ({ success: true, job_natures: [{ id: 1, job_name: 'Civil' }] }));
const loadClients = createRequestLoader(async () => { counters.clientLoads += 1; await delay(); return { success: true, clients }; });
const loadClientMetadata = createRequestLoader(async () => ({ job_natures: [{ id: 1, job_name: 'Civil' }], sectors: [{ id: 1, sector_name: 'Infrastructure' }] }));
const loadResources = createRequestLoader(async () => {
    counters.resourceLoads += 1; await delay();
    if (exercise === 'resource-403') throw { response: { status: 403, data: { message: 'Forbidden' } } };
    return { success: true, resources };
});
const loadProjects = createRequestLoader(async () => { counters.projectLoads += 1; return { success: true, projects: [{ id: 77, name: 'Synthetic Project' }] }; });

const vendorService = {
    createVendor: async (payload) => { payloads.vendorCreate = payload; return { success: true, vendor: { id: 12 } }; },
    updateVendor: async (id, payload) => { payloads.vendorUpdate = { id, payload }; return { success: true }; },
    deleteVendor: async (id) => { payloads.vendorDelete = id; return { success: true }; },
};
const clientService = {
    getClientById: async (id) => { counters.clientDetails += 1; return { success: true, client: clients.find((item) => item.id === Number(id)) }; },
    createClient: async (payload) => { payloads.clientCreate = payload; return { success: true, client: { id: 22 } }; },
    updateClient: async (id, payload) => { payloads.clientUpdate = { id, payload }; return { success: true }; },
    deleteClient: async (id) => { payloads.clientDelete = id; return { success: true }; },
};
const resourceService = {
    getResourceById: async (id) => { counters.resourceDetails += 1; return { success: true, resource: resourceDetails[Number(id)] }; },
    createResource: async (payload) => { payloads.resourceCreate = payload; return { success: true }; },
    updateResource: async (id, payload) => { payloads.resourceUpdate = { id, payload }; return { success: true }; },
    deleteResource: async (id) => { payloads.resourceDelete = id; return { success: true }; },
    getCompositionHistory: async () => { counters.recipeLoads += 1; return { success: true, compositions: [{ component_resource_id: 31, quantity: 2, unit_code: 'kg', effective_from: '2026-08-01' }] }; },
    getResolvedRates: async (ids) => ({ success: true, rates: ids.map((id) => ({ resourceId: Number(id), rate: 10 })) }),
    setCompositions: async (...args) => { payloads.recipe = args; return { success: true }; },
    getResolvedRate: async () => { counters.rateLoads += 1; return { success: true, rate: { rate: 120, unitCode: 'kg', source: 'manual' } }; },
    getRateHistory: async () => ({ success: true, rates: [{ id: 401, rate: 120, unit_code: 'kg', effective_from: '2026-08-01', effective_to: null, is_active: 1 }] }),
    addRate: async (...args) => { payloads.rateCreate = args; return { success: true }; },
    updateRate: async (...args) => { payloads.rateUpdate = args; return { success: true }; },
    clearManualRate: async (...args) => { payloads.rateClear = args; return { success: true }; },
    addConversion: async (...args) => { payloads.conversionCreate = args; return { success: true }; },
    removeConversion: async (...args) => { payloads.conversionDelete = args; return { success: true }; },
};
const projectService = {
    getProjectCompositionHistory: async () => ({ success: true, compositions: [] }),
    getResolvedResourceRates: async (_projectId, ids) => ({ success: true, rates: ids.map((id) => ({ resourceId: Number(id), rate: 10 })) }),
    setProjectCompositions: async (...args) => { payloads.projectRecipe = args; return { success: true }; },
    importResource: async (...args) => { payloads.projectImport = args; return { success: true }; },
    getResolvedResourceRate: async () => ({ success: true, rate: { rate: 125, unitCode: 'kg', source: 'project' } }),
    getResourceRateHistory: async () => ({ success: true, rates: [] }),
    addResourceRate: async (...args) => { payloads.projectRateCreate = args; return { success: true }; },
    updateResourceRate: async (...args) => { payloads.projectRateUpdate = args; return { success: true }; },
    clearResourceRate: async (...args) => { payloads.projectRateClear = args; return { success: true }; },
};

const authOverride = {
    user: { id: 7, user_name: 'Fixture User', user_type: 'employee' },
    isAdmin: access === 'admin',
    hasPermission: (pageId, requiredLevel = 1) => pageId == null || pageId === 'dashboard' || ['projects', 'vendors', 'clients', 'resources'].includes(pageId) && (requiredLevel <= 1 || access !== 'read'),
};

function DesktopLayoutSentinel() { return <div data-layout-branch="desktop"><div data-agent-contract="desktop" /><Outlet /></div>; }
function DesktopPageSentinel({ name }) { return <div data-desktop-page={name}>Existing desktop {name} sentinel</div>; }
const desktop = (name) => <DesktopPageSentinel name={name} />;
function LocationProbe() { const location = useLocation(); return <span hidden data-location-path={location.pathname} data-location-search={location.search} />; }

const bulkProps = (domain) => ({
    authOverride,
    validateRequest: async () => { counters.validates += 1; return { validation: { duplicates: [{ row: 3, reason: 'Synthetic duplicate' }] } }; },
    importRequest: async (payload) => {
        counters.imports += 1; payloads.bulk = payload;
        if (domain === 'resources') throw { response: { data: { report: { errors: [{ error: 'Synthetic atomic failure' }] } } } };
        return { success: true, report: { success_count: 1, failure_count: 1, errors: [{ error: 'Synthetic partial failure' }] } };
    },
    onNavigate: (path) => { payloads.bulkBack = path; },
});

function MobileRoutes() {
    return <Routes><Route path="/" element={<MobilePilotLayout mobile={<MobileMainLayout loadProjects={loadProjects} />} desktop={<DesktopLayoutSentinel />} />}>
        <Route path="vendors" element={<ResponsiveRoute mobile={<MobileVendors authOverride={authOverride} service={vendorService} loadVendors={loadVendors} loadJobNatures={loadJobNatures} />} desktop={desktop('vendors')} />} />
        <Route path="vendors/bulk-upload" element={<ResponsiveRoute mobile={<MobileVendorBulkUpload {...bulkProps('vendors')} />} desktop={desktop('vendor-bulk')} />} />
        <Route path="clients" element={<ResponsiveRoute mobile={<MobileClients authOverride={authOverride} service={clientService} loadClients={loadClients} loadMetadata={loadClientMetadata} interactionRequest={async (id, payload) => { payloads.interaction = { id, payload }; return { success: true }; }} />} desktop={desktop('clients')} />} />
        <Route path="clients/bulk-upload" element={<ResponsiveRoute mobile={<MobileClientBulkUpload {...bulkProps('clients')} />} desktop={desktop('client-bulk')} />} />
        <Route path="resources" element={<ResponsiveRoute mobile={<MobileResources authOverride={authOverride} service={resourceService} projectService={projectService} loadResources={loadResources} loadProjects={loadProjects} />} desktop={desktop('resources')} />} />
        <Route path="resources/bulk-upload" element={<ResponsiveRoute mobile={<MobileResourceBulkUpload {...bulkProps('resources')} />} desktop={desktop('resource-bulk')} />} />
        <Route path="projects" element={<ResponsiveRoute mobile={<div data-mobile-page="projects">Existing M2 mobile route sentinel</div>} desktop={desktop('m2-projects-sentinel')} />} />
        <Route path="spreadsheets" element={desktop('spreadsheets')} />
    </Route></Routes>;
}

const waitFor = async (condition, attempts = 50) => { for (let index = 0; index < attempts; index += 1) { if (condition()) return true; await delay(40); } return false; };
const sendFile = (input, name, content) => {
    const file = new File([content], name, { type: 'text/csv' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
};
const findButton = (text) => [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === text);
const controlFor = (labelText, root = document) => {
    const label = [...root.querySelectorAll('label')].find((item) => item.textContent.trim().startsWith(labelText));
    return label?.querySelector('input, textarea, select') || (label?.htmlFor ? document.getElementById(label.htmlFor) : null);
};
const setControl = (control, value) => {
    const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, value);
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
};

function ContractChecks() {
    const location = useLocation(); const navigate = useNavigate(); const [results, setResults] = useState([]);
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            await waitFor(() => !document.body.textContent.includes('Loading vendors') && !document.body.textContent.includes('Loading clients') && !document.body.textContent.includes('Loading resources'), 60);
            await delay(180);
            if (cancelled) return;
            const rows = []; const check = (label, pass, detail = '') => rows.push({ label, pass: Boolean(pass), detail });
            const pilot = ['/vendors', '/vendors/bulk-upload', '/clients', '/clients/bulk-upload', '/resources', '/resources/bulk-upload'].includes(route);
            const mobile = window.innerWidth <= 1023 && (pilot || route === '/projects');
            check('Exact requested viewport', window.innerWidth === Number(params.get('width')), `${window.innerWidth}px`);
            check('Exactly one presentation branch', document.querySelectorAll('[data-layout-branch]').length === 1);
            check('Correct responsive branch', mobile ? Boolean(document.querySelector('[data-layout-branch="mobile"]')) : Boolean(document.querySelector('[data-layout-branch="desktop"]')));
            check('Current path preserved', location.pathname === route, location.pathname);
            if (mobile) {
                check('Desktop page is absent', !document.querySelector('[data-desktop-page]'));
                check('Agent/layout mounts exactly once', document.querySelectorAll('[data-agent-contract="mobile"]').length === 1 && document.querySelectorAll('[aria-label="Open ERP Assistant"]').length === 1);
                const domain = route.split('/')[1];
                if (pilot && !route.includes('bulk-upload')) {
                    check(`${domain} mobile page mounts once`, document.querySelectorAll(`[data-mobile-page="${domain}"]`).length === 1);
                    check(`${domain} list request is not duplicated`, counters[`${domain.slice(0, -1)}Loads`] === 1, JSON.stringify(counters));
                    const createLabel = domain === 'resources' ? 'Resource bulk upload' : `Create ${domain.slice(0, -1)}`;
                    if (exercise !== 'resource-403') check('Write controls follow permission', access === 'read' ? !document.querySelector(`[aria-label="${createLabel}"]`) : Boolean(document.querySelector(`[aria-label="${createLabel}"]`)));
                }
                if (route === '/vendors') {
                    check('Vendor card renders category/job nature', document.body.textContent.includes('Synthetic Vendor') && document.body.textContent.includes('Supplier · Civil'));
                    check('Vendor metadata control is admin-only', access === 'admin' ? Boolean(document.querySelector('[aria-label="Manage job natures"]')) : !document.querySelector('[aria-label="Manage job natures"]'));
                    if (exercise === 'vendor-crud') {
                        document.querySelector('[aria-label="Create vendor"]')?.click(); await delay();
                        const createForm = document.querySelector('[data-mobile-form="vendor"]');
                        setControl(controlFor('Company name', createForm), 'Created Vendor'); setControl(controlFor('Address', createForm), 'Created address'); setControl(controlFor('Email', createForm), 'created@example.test'); setControl(controlFor('Contact number', createForm), '3000000000');
                        findButton('Create vendor')?.click(); await waitFor(() => Boolean(payloads.vendorCreate));
                        check('Vendor create uses exact existing field contract', payloads.vendorCreate?.name === 'Created Vendor' && payloads.vendorCreate?.address === 'Created address' && payloads.vendorCreate?.contact_no === '3000000000');
                        document.querySelector('[aria-label="Actions for Synthetic Vendor"]')?.click(); await delay(); findButton('Edit vendor')?.click(); await delay();
                        const editForm = document.querySelector('[data-mobile-form="vendor"]'); setControl(controlFor('Company name', editForm), 'Synthetic Vendor Revised'); findButton('Save vendor')?.click(); await waitFor(() => Boolean(payloads.vendorUpdate));
                        check('Vendor edit sends id and complete payload', payloads.vendorUpdate?.id === 11 && payloads.vendorUpdate?.payload?.name === 'Synthetic Vendor Revised' && payloads.vendorUpdate?.payload?.email === 'vendor@example.test');
                        document.querySelector('[aria-label="Actions for Synthetic Vendor"]')?.click(); await delay(); findButton('Delete vendor')?.click(); await delay(); findButton('Delete vendor')?.click(); await waitFor(() => payloads.vendorDelete !== undefined);
                        check('Vendor delete preserves scalar service contract', payloads.vendorDelete === 11);
                    }
                }
                if (route === '/clients') {
                    check('Client card renders client-specific metadata', document.body.textContent.includes('Synthetic Client') && document.body.textContent.includes('Infrastructure · Civil'));
                    [...document.querySelectorAll('button')].find((item) => item.textContent.includes('Synthetic Client'))?.click(); await delay();
                    check('Client detail exposes interactions timeline', document.body.textContent.includes('Interactions') && document.body.textContent.includes('Synthetic only'));
                    check('Client detail request executes once', counters.clientDetails === 1);
                    if (exercise === 'client-interaction') {
                        findButton('Log interaction')?.click(); await delay(); const interactionForm = findButton('Save interaction')?.closest('form'); setControl(controlFor('Remarks', interactionForm), 'New synthetic call'); findButton('Save interaction')?.click(); await waitFor(() => Boolean(payloads.interaction));
                        check('Client interaction sends exact route id and payload', payloads.interaction?.id === 21 && payloads.interaction?.payload?.type === 'Call' && payloads.interaction?.payload?.remarks === 'New synthetic call' && /^\d{4}-\d{2}-\d{2}$/.test(payloads.interaction?.payload?.interaction_date));
                        check('Successful interaction closes the entry form', !findButton('Save interaction'));
                    }
                }
                if (route === '/resources') {
                    if (exercise === 'resource-403') {
                        check('403 renders proven generic access-denied state', document.body.textContent.includes('Resource access denied') && document.body.textContent.includes('current ERP permissions'));
                        check('403 does not render resource data or success', !document.body.textContent.includes('Synthetic Cement') && !document.body.textContent.includes('created'));
                    } else {
                        const expectedTab = new URLSearchParams(route.includes('?') ? route.split('?')[1] : '').get('tab') || params.get('tab') || 'directory';
                        check('Only requested resource workspace mounts', document.querySelectorAll('[data-resource-workspace]').length === 1 && document.querySelector(`[data-resource-workspace="${expectedTab}"]`));
                        check('Resource query tab remains represented', expectedTab === 'directory' || location.search.includes(`tab=${expectedTab}`));
                        if (expectedTab === 'conversions') {
                            check('Conversions are current-only with local calculator', document.body.textContent.includes('Current conversions') && document.body.textContent.includes('Unit calculator') && !document.body.textContent.includes('Conversion history'));
                            check('Conversion detail request is not duplicated', counters.resourceDetails === 1, `${counters.resourceDetails} calls`);
                        }
                        if (expectedTab === 'recipes') {
                            check('Recipe version workflow is present', document.body.textContent.includes('Recipe draft') && document.body.textContent.includes('Version history'));
                            check('Recipe request group is not duplicated', counters.resourceDetails === 1 && counters.recipeLoads === 1, `${counters.resourceDetails}/${counters.recipeLoads} calls`);
                        }
                        if (expectedTab === 'rates') {
                            check('Rate effective/history workflow is present', document.body.textContent.includes('Effective rate') && document.body.textContent.includes('Rate history'));
                            check('Rate request group is not duplicated', counters.rateLoads === 1, `${counters.rateLoads} calls`);
                        }
                        if (exercise === 'resource-create') {
                            document.querySelector('[aria-label="Create resource"]')?.click(); await delay(); const form = document.querySelector('[data-mobile-form="resource"]'); setControl(controlFor('Name', form), 'Created Resource'); setControl(controlFor('Base unit', form), 'kg'); findButton('Create resource')?.click(); await waitFor(() => Boolean(payloads.resourceCreate));
                            check('Resource create preserves name/type/base-unit contract', payloads.resourceCreate?.name === 'Created Resource' && payloads.resourceCreate?.type === 'material' && payloads.resourceCreate?.base_unit_code === 'kg');
                        }
                        if (exercise === 'recipe-save') {
                            findButton('Save new recipe version')?.click(); await waitFor(() => Boolean(payloads.recipe));
                            check('Recipe save preserves component/effective-date contract', Number(payloads.recipe?.[0]) === 33 && payloads.recipe?.[1]?.[0]?.component_resource_id === 31 && payloads.recipe?.[1]?.[0]?.quantity === 2 && /^\d{4}-\d{2}-\d{2}$/.test(payloads.recipe?.[2]));
                        }
                        if (exercise === 'rate-save') {
                            const rateForm = findButton('Save new version')?.closest('form'); setControl(controlFor('Rate', rateForm), '140'); findButton('Save new version')?.click(); await waitFor(() => Boolean(payloads.rateCreate));
                            check('Rate save preserves effective version contract', Number(payloads.rateCreate?.[0]) === 31 && payloads.rateCreate?.[1]?.rate === 140 && payloads.rateCreate?.[1]?.unit_code === 'kg' && /^\d{4}-\d{2}-\d{2}$/.test(payloads.rateCreate?.[1]?.effective_from));
                        }
                        if (exercise === 'conversion-delete') {
                            findButton('Delete')?.click(); await waitFor(() => Boolean(findButton('Delete conversion'))); findButton('Delete conversion')?.click(); await waitFor(() => Boolean(payloads.conversionDelete));
                            check('Confirmed conversion delete preserves resource/conversion ids', Number(payloads.conversionDelete?.[0]) === 31 && Number(payloads.conversionDelete?.[1]) === 301, JSON.stringify(payloads.conversionDelete));
                        }
                        if (exercise === 'conversion-create') {
                            const conversionForm = findButton('Add conversion')?.closest('form'); setControl(controlFor('Scale name', conversionForm), 'Sack'); setControl(controlFor('Equivalent quantity', conversionForm), '25'); findButton('Add conversion')?.click(); await waitFor(() => Boolean(payloads.conversionCreate));
                            check('Conversion create preserves current conversion contract', Number(payloads.conversionCreate?.[0]) === 31 && JSON.stringify(payloads.conversionCreate?.[1]) === JSON.stringify({ name: 'Sack', quantity: 25, unit_code: 'kg' }));
                        }
                        if (exercise === 'query-back') {
                            [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Rates')?.click();
                            await waitFor(() => document.querySelector('[data-resource-workspace="rates"]'));
                            const rateSearch = document.querySelector('[data-location-search]')?.getAttribute('data-location-search') || '';
                            check('Tab selection pushes query while preserving other state', rateSearch.includes('tab=rates') && rateSearch.includes('project_id=77'), rateSearch);
                            navigate(-1); await waitFor(() => document.querySelector('[data-resource-workspace="directory"]'));
                            const backSearch = document.querySelector('[data-location-search]')?.getAttribute('data-location-search') || '';
                            check('Router Back restores prior resource tab', Boolean(document.querySelector('[data-resource-workspace="directory"]')) && backSearch.includes('tab=directory') && backSearch.includes('project_id=77'), backSearch);
                        }
                    }
                }
                if (route.includes('bulk-upload')) {
                    if (access === 'read') {
                        check('Read-only bulk route exposes no mutation control', document.body.textContent.includes('Write access required') && !document.querySelector('input[type="file"]'));
                        check('Read-only bulk route performs no validation/import request', counters.validates === 0 && counters.imports === 0);
                    } else {
                        const entity = route.split('/')[1]; const input = document.querySelector('input[type="file"]');
                        sendFile(input, `${entity}.csv`, 'Name,Base Unit,Type\nFirst Synthetic,kg,material\nSecond Synthetic,kg,material\nDuplicate Synthetic,kg,material');
                        await waitFor(() => document.body.textContent.includes('Import 2'));
                        check('File validates into preview with issues', counters.validates === 1 && document.body.textContent.includes('3') && document.body.textContent.includes('Issues'));
                        [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Import 2')?.click(); await delay();
                        [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Confirm import')?.click();
                        await waitFor(() => document.body.textContent.includes(entity === 'resources' ? 'Import rolled back' : 'Import completed with issues'));
                        check('Bulk import submits valid rows once', counters.imports === 1 && payloads.bulk?.length === 2);
                        check(entity === 'resources' ? 'Resource failure reports atomic rollback' : `${entity} preserves partial-result reporting`, entity === 'resources' ? document.body.textContent.includes('No rows from this import were created') : document.body.textContent.includes('Created: 1 · Failed: 1'));
                    }
                }
                const dark = document.querySelector('[aria-label="Use dark theme"]'); dark?.click(); await delay();
                check('Dark theme applies', document.documentElement.classList.contains('dark'));
                document.querySelector('[aria-label="Use light theme"]')?.click(); await delay();
                check('Light theme restores', !document.documentElement.classList.contains('dark'));
            } else {
                check('Desktop fallback page mounts once', document.querySelectorAll('[data-desktop-page]').length === 1);
                check('No mobile page/Agent mounts', !document.querySelector('[data-mobile-page]') && !document.querySelector('[aria-label="Open ERP Assistant"]'));
            }
            check('No viewport-level horizontal overflow', document.documentElement.scrollWidth <= window.innerWidth, `${document.documentElement.scrollWidth}/${window.innerWidth}`);
            check('No real ERP or Agent network request', networkAttempts.length === 0, networkAttempts.join(', '));
            if (!cancelled) { setResults(rows); window.__M3_HARNESS_RESULT__ = { caseId, rows, counters, payloads }; window.parent.postMessage({ type: 'mano-m3-harness-results', caseId, rows }, window.location.origin); }
        };
        run(); return () => { cancelled = true; };
    }, []);
    return <ol aria-label="M3 frame checks" className="fixed left-1 top-14 z-[100] max-h-[80vh] max-w-[calc(100vw-0.5rem)] overflow-auto rounded-lg border bg-white/95 p-2 text-[10px] dark:bg-gh-subtle/95">{results.map((item) => <li key={item.label} className={item.pass ? 'text-emerald-700' : 'text-red-700'}>{item.pass ? 'PASS' : 'FAIL'}: {item.label}{item.detail ? ` (${item.detail})` : ''}</li>)}</ol>;
}

function FrameHarness() {
    const initial = route === '/resources' && params.get('tab') ? `${route}?tab=${params.get('tab')}&project_id=77` : route;
    return <StrictMode><ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey={`mano-m3-theme-${caseId}`}><AuthProvider><MemoryRouter initialEntries={[initial]}><LocationProbe /><ContractChecks /><MobileRoutes /></MemoryRouter></AuthProvider></ThemeProvider></StrictMode>;
}

const cases = [
    { id: 'vendors-read-360', width: 360, route: '/vendors', access: 'read' },
    { id: 'vendors-admin-390', width: 390, route: '/vendors', access: 'admin', exercise: 'vendor-crud' },
    { id: 'clients-read-430', width: 430, route: '/clients', access: 'read' },
    { id: 'clients-write-390', width: 390, route: '/clients', access: 'write', exercise: 'client-interaction' },
    { id: 'resources-directory-360', width: 360, route: '/resources', access: 'write', tab: 'directory', exercise: 'query-back' },
    { id: 'resources-create-390', width: 390, route: '/resources', access: 'write', tab: 'directory', exercise: 'resource-create' },
    { id: 'resources-recipes-390', width: 390, route: '/resources', access: 'write', tab: 'recipes', exercise: 'recipe-save' },
    { id: 'resources-rates-430', width: 430, route: '/resources', access: 'write', tab: 'rates', exercise: 'rate-save' },
    { id: 'resources-conversion-create-768', width: 768, route: '/resources', access: 'write', tab: 'conversions', exercise: 'conversion-create' },
    { id: 'resources-conversion-delete-390', width: 390, route: '/resources', access: 'write', tab: 'conversions', exercise: 'conversion-delete' },
    { id: 'resources-read-1023', width: 1023, route: '/resources', access: 'read', tab: 'directory' },
    { id: 'resources-403-390', width: 390, route: '/resources', access: 'write', exercise: 'resource-403' },
    { id: 'vendor-bulk-partial-390', width: 390, route: '/vendors/bulk-upload', access: 'write' },
    { id: 'client-bulk-partial-430', width: 430, route: '/clients/bulk-upload', access: 'write' },
    { id: 'resource-bulk-atomic-768', width: 768, route: '/resources/bulk-upload', access: 'write' },
    { id: 'vendor-bulk-read-390', width: 390, route: '/vendors/bulk-upload', access: 'read' },
    { id: 'vendors-desktop-1024', width: 1024, route: '/vendors', access: 'write' },
    { id: 'clients-desktop-1024', width: 1024, route: '/clients', access: 'write' },
    { id: 'resources-desktop-1024', width: 1024, route: '/resources', access: 'write' },
    { id: 'm2-route-regression-390', width: 390, route: '/projects', access: 'write' },
    { id: 'non-pilot-fallback-390', width: 390, route: '/spreadsheets', access: 'write' },
];

function ParentHarness() {
    const [reports, setReports] = useState({});
    useEffect(() => { const receive = (event) => { if (event.origin === window.location.origin && event.data?.type === 'mano-m3-harness-results') setReports((current) => ({ ...current, [event.data.caseId]: event.data.rows })); }; window.addEventListener('message', receive); return () => window.removeEventListener('message', receive); }, []);
    const summary = useMemo(() => { const completed = cases.filter((item) => reports[item.id]); return { completed: completed.length, passed: completed.reduce((sum, item) => sum + reports[item.id].filter((row) => row.pass).length, 0), failed: completed.reduce((sum, item) => sum + reports[item.id].filter((row) => !row.pass).length, 0) }; }, [reports]);
    return <main className="min-h-screen bg-gray-100 p-4 text-gray-900"><h1 className="text-lg font-bold">MANO ERP M3 isolated browser harness</h1><p data-harness-summary className="mt-1 text-xs">Synthetic fixtures only; fetch and XHR are blocked. Completed {summary.completed}/{cases.length}; PASS {summary.passed}; FAIL {summary.failed}.</p>{cases.map((item) => { const rows = reports[item.id] || []; const finished = rows.length > 0; const passed = finished && rows.every((row) => row.pass); const query = new URLSearchParams({ frame: '1', case: item.id, width: String(item.width), route: item.route, access: item.access, ...(item.exercise ? { exercise: item.exercise } : {}), ...(item.tab ? { tab: item.tab } : {}) }); return <section key={item.id} className="mt-5" data-case-status={finished ? passed ? 'pass' : 'fail' : 'running'}><h2 className="text-sm font-bold">{item.id} — {finished ? passed ? 'PASS' : 'FAIL' : 'RUNNING'}</h2>{finished && <ol className="mt-1 text-[10px]">{rows.map((row) => <li key={row.label}>{row.pass ? 'PASS' : 'FAIL'}: {row.label}{row.detail ? ` (${row.detail})` : ''}</li>)}</ol>}<div className="mt-2 max-w-full overflow-auto rounded-xl border bg-white p-2"><iframe title={item.id} src={`${harnessEntry}?${query}`} width={item.width} height="820" className="block max-w-none border-0" /></div></section>; })}</main>;
}

const root = createRoot(document.getElementById('root'));
root.render(frameMode ? <FrameHarness /> : <ParentHarness />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
