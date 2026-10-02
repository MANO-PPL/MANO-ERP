import React, { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import MobileProjectPlanningParity from '../../src/mobile/pages/ProjectDetails/Planning/MobileProjectPlanningParity';
import MobileProjectContractsParity from '../../src/mobile/pages/ProjectDetails/Contracts/MobileProjectContractsParity';

const params = new URLSearchParams(location.search);
const testCase = params.get('case') || 'schedule';
const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (predicate, label) => { const until = Date.now() + 3000; while (Date.now() < until) { if (predicate()) return; await wait(20); } throw new Error(`Timed out: ${label}`); };
const button = (name, root = document) => [...root.querySelectorAll('button')].find((item) => item.textContent.includes(name));
const click = (name, root = document) => { const target = button(name, root); target?.click(); return target; };

function Probe() {
    const [rows, setRows] = useState([]);
    useEffect(() => { let live = true; (async () => {
        const results = []; const check = (label, pass, detail = '') => results.push({ label, pass: Boolean(pass), detail });
        try {
            await wait(80);
            if (testCase === 'schedule') {
                document.querySelector('[aria-label^="Collapse Pre-Construction"]')?.click(); await waitFor(() => !document.body.textContent.includes('Design Approval'), 'collapsed phase'); check('phase collapses without removing its data', !document.body.textContent.includes('Design Approval'));
                document.querySelector('[aria-label^="Expand Pre-Construction"]')?.click(); await waitFor(() => document.body.textContent.includes('Design Approval'), 'expanded phase'); check('phase expands with original task cards', document.body.textContent.includes('Design Approval'));
                document.querySelector('[aria-label="View Pre-Construction details"]')?.click(); await waitFor(() => Boolean(document.querySelector('[data-phase-detail]')), 'phase detail'); const detail = document.querySelector('[data-phase-detail]'); check('read-only phase detail opens with source summary', Boolean(detail) && detail.textContent.includes('Phase start') && detail.textContent.includes('High priority') && detail.textContent.includes('Design Approval')); check('detail has no mutation controls', !button('Apply local change', detail) && !button('Edit phase', detail) && !button('Delete', detail));
                document.querySelector('[role="dialog"] [aria-label="Close"]')?.click(); await waitFor(() => !document.querySelector('[data-phase-detail]'), 'phase detail close'); check('phase detail closes through shared sheet contract', !document.querySelector('[data-phase-detail]'));
            }
            if (testCase === 'schedule-write') {
                check('existing phase and task creation controls remain present', Boolean(button('Add phase')) && Boolean(button('Add task')));
                click('Design Approval'); await waitFor(() => document.querySelector('[role="dialog"]')?.textContent.includes('Activity details'), 'task editor'); check('existing task detail editor remains reachable', document.querySelector('[role="dialog"]')?.textContent.includes('High priority')); document.querySelector('[role="dialog"] [aria-label="Close"]')?.click();
                click('Edit phase'); await waitFor(() => document.querySelector('[role="dialog"]')?.textContent.includes('Edit phase'), 'phase editor'); check('existing phase editor remains reachable', Boolean(button('Apply local change', document.querySelector('[role="dialog"]')))); document.querySelector('[role="dialog"] [aria-label="Close"]')?.click();
                click('Add task'); await waitFor(() => document.querySelector('[role="dialog"]')?.textContent.includes('Add activity'), 'task creation'); check('existing add-task flow remains reachable', Boolean(button('Apply local change', document.querySelector('[role="dialog"]')))); document.querySelector('[role="dialog"] [aria-label="Close"]')?.click();
                click('Add phase'); await waitFor(() => document.querySelector('[role="dialog"]')?.textContent.includes('Add phase'), 'phase creation'); check('existing add-phase flow remains reachable', Boolean(button('Apply local change', document.querySelector('[role="dialog"]')))); document.querySelector('[role="dialog"] [aria-label="Close"]')?.click();
                click('Delete'); await waitFor(() => document.querySelector('[role="dialog"]')?.textContent.includes('Delete phase'), 'phase delete confirmation'); check('existing phase delete confirmation remains reachable', document.querySelector('[role="dialog"]')?.textContent.includes('local planning item')); document.querySelector('[role="dialog"] [aria-label="Close"]')?.click();
            }
            if (testCase === 'material') { check('s-curves render', Boolean(document.querySelector('[data-material-s-curves]'))); check('cost distribution renders', Boolean(document.querySelector('[data-material-distribution]'))); }
            if (testCase === 'manpower') { click('Planned Visible'); await wait(); check('planned toggle changes presentation', document.body.textContent.includes('Show Planned')); click('Planning'); await wait(); click('Import from Project Plan'); await wait(); check('selectable import sheet opens', document.body.textContent.includes('Import selection')); }
            if (testCase === 'logistics') { check('delivery heatmap renders', Boolean(document.querySelector('[data-delivery-heatmap]'))); check('vendor performance renders', Boolean(document.querySelector('[data-vendor-performance]'))); click('Equipment'); await wait(); check('equipment total cost is visible', document.body.textContent.includes('days ×')); }
            if (testCase === 'budget') { check('budget distribution renders', Boolean(document.querySelector('[data-budget-chart="distribution"]'))); check('budget comparison renders', Boolean(document.querySelector('[data-budget-chart="comparison"]'))); click('Civil Works'); await wait(); const input = document.querySelector('input[type="number"]'); if (input) { input.value = '123'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); } await wait(); check('budget local editor is write-gated and available', Boolean(input)); }
        } catch (error) { check('harness execution', false, error.message); }
        if (live) { window.__M9_PARITY_RESULT__ = { testCase, rows }; setRows(results); }
    })(); return () => { live = false; }; }, []);
    return <ol>{rows.map((row) => <li key={row.label}>{row.pass ? 'PASS' : 'FAIL'} {row.label} {row.detail}</li>)}</ol>;
}

function App() {
    const planning = ['schedule', 'schedule-write', 'material', 'manpower', 'logistics'].includes(testCase);
    const query = planning ? `?tab=Planning&report=${testCase === 'schedule' || testCase === 'schedule-write' ? 'project-planning' : testCase === 'material' ? 'material-histogram' : testCase === 'manpower' ? 'manpower-histogram&mpView=histogram' : 'logistic-plan'}` : '?tab=Contracts&report=budget';
    const Workspace = planning ? MobileProjectPlanningParity : MobileProjectContractsParity;
    return <MemoryRouter initialEntries={[`/projects/42${query}`]}><Workspace projectId={42} canWrite={testCase !== 'schedule'} services={{ ai: { scheduleInsights: async () => ({ insights: [] }), budgetInsights: async () => ({ insights: [] }) } }}/><Probe/></MemoryRouter>;
}
createRoot(document.getElementById('root')).render(<App/>);
