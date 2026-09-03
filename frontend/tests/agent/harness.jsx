import React, { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from 'next-themes';
import '../../src/index.css';
import AgentShell from '../../src/components/Agent/AgentShell.jsx';
import { previewTransport } from '../../src/components/Agent/agentTransport.js';
import { createFixtureTransport } from './fixtures.js';

// Only this standalone test entry can select fixture transports. It imports no App/auth/ERP services.
const params = new URLSearchParams(window.location.search);
const frame = params.has('frame');
const scenarios = ['preview', 'cards', 'confirmation', 'destructive', 'bulk', 'expired', 'hold',
    'error:backend_unavailable', 'error:network_failure', 'error:request_rejected', 'error:authorization_denied',
    'error:confirmation_expired', 'error:validation_error', 'error:execution_failure'];

function Harness() {
    const location = useLocation();
    const navigate = useNavigate();
    const { resolvedTheme, setTheme } = useTheme();
    const [scenario, setScenario] = useState('preview');
    const [events, setEvents] = useState([]);
    const [networkAttempts, setNetworkAttempts] = useState([]);
    const [width, setWidth] = useState('390');
    const [height, setHeight] = useState('844');
    const [checks, setChecks] = useState([]);
    React.useEffect(() => {
        // Requests from the feature are forbidden. Asset loading is unaffected.
        const originalFetch = window.fetch;
        const originalOpen = XMLHttpRequest.prototype.open;
        const reject = url => {
            setNetworkAttempts(previous => [...previous, String(url)]);
            throw new Error('The isolated harness forbids application network requests');
        };
        window.fetch = input => reject(input);
        XMLHttpRequest.prototype.open = function (_method, url) { reject(url); };
        return () => { window.fetch = originalFetch; XMLHttpRequest.prototype.open = originalOpen; };
    }, []);
    const transport = useMemo(() => {
        const observe = value => setEvents(previous => [...previous, value]);
        if (scenario !== 'preview') return createFixtureTransport(scenario, observe);
        return { ...previewTransport, async send(request, options) {
            observe({ type: 'request', request, requestId: options.requestId });
            return previewTransport.send(request, options);
        } };
    }, [scenario]);
    const inspect = () => {
        const panel = document.getElementById('erp-agent-panel');
        const input = document.getElementById('erp-agent-input');
        const rect = panel?.getBoundingClientRect();
        const compact = innerWidth < 1024;
        const rows = [
            ['Panel opens', !!panel?.open],
            ['Responsive width', !!rect && Math.abs(rect.width - (compact ? innerWidth : 440)) < 2],
            ['Panel within viewport', !!rect && rect.left >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1],
            ['Mobile modality / desktop nonmodality', !!panel && panel.matches(':modal') === compact],
            ['Composer labeled', !!input?.labels?.length],
            ['No page overflow', document.documentElement.scrollWidth <= innerWidth],
            ['No application network execution', networkAttempts.length === 0],
            ['No raw hidden reasoning', !document.body.textContent.includes('This field must never render')],
        ];
        setChecks(rows);
    };
    return <>
        <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-gh-bg dark:text-gh-text lg:pr-[470px]">
            <h1 className="text-lg font-semibold">ERP Assistant test harness</h1>
            <p className="mt-1 text-xs">Isolated fixtures. No backend, authentication, or ERP services are mounted.</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <label>Scenario <select aria-label="Fixture scenario" className="rounded border bg-white p-2 text-gray-900" value={scenario} onChange={event => { setScenario(event.target.value); setEvents([]); setChecks([]); }}>
                    {scenarios.map(value => <option key={value}>{value}</option>)}
                </select></label>
                <button className="rounded border p-2" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>Toggle theme</button>
                <button className="rounded border p-2" onClick={() => navigate('/projects/fixture-project?tab=Reports')}>Project route</button>
                <button className="rounded border p-2" onClick={() => navigate('/resources?tab=rates')}>Resources route</button>
                <button className="rounded border p-2" onClick={() => navigate('/clients')}>Clients route</button>
                <button className="rounded border p-2" onClick={() => window.dispatchEvent(new CustomEvent('active-project-updated', { detail: { id: 'fixture-project', name: 'Fixture Project — synthetic context' } }))}>Publish matching project name</button>
                <button className="rounded border p-2" onClick={() => window.dispatchEvent(new CustomEvent('active-project-updated', { detail: { id: 'wrong-id', name: 'WRONG PROJECT' } }))}>Publish mismatched project name</button>
                <button className="rounded border p-2" onClick={() => transport.release?.()}>Release held response</button>
                <button className="rounded border p-2" onClick={inspect}>Inspect panel checks</button>
            </div>
            <p className="mt-3 text-xs" data-testid="route">Current route: {location.pathname}{location.search}</p>
            <p className="mt-2 text-xs" data-testid="network">Application network attempts: {networkAttempts.length}</p>
            <p className="mt-2 text-xs">Requests observed: {events.filter(event => event.type === 'request').length}</p>
            <ol aria-label="Harness checks" className="my-3 space-y-1 text-xs">{checks.map(([label, pass]) => <li key={label}>{pass ? 'PASS' : 'FAIL'}: {label}</li>)}</ol>
            <details className="mt-4 text-xs"><summary>Observed transport payloads</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap break-all" data-testid="payloads">{JSON.stringify(events, null, 2)}</pre></details>
            {!frame && <section className="mt-8">
                <h2 className="text-sm font-semibold">Responsive fixture viewport</h2>
                <div className="my-2 flex gap-2 text-xs"><label>Width <select aria-label="Viewport width" value={width} onChange={event => setWidth(event.target.value)} className="border bg-white p-1 text-gray-900">{['320', '390', '768', '1366', '1920'].map(value => <option key={value}>{value}</option>)}</select></label>
                    <label>Height <select aria-label="Viewport height" value={height} onChange={event => setHeight(event.target.value)} className="border bg-white p-1 text-gray-900">{['768', '844', '1024', '1080'].map(value => <option key={value}>{value}</option>)}</select></label></div>
                <div className="max-w-full overflow-auto border border-gray-300"><iframe title="Responsive assistant viewport" src="./harness.html?frame=1" style={{ width: Number(width), height: Number(height), maxWidth: 'none', border: 0 }} /></div>
            </section>}
        </main>
        <AgentShell key={scenario} transport={transport} />
    </>;
}

const harnessRoot = createRoot(document.getElementById('root'));
harnessRoot.render(<StrictMode><ThemeProvider attribute="class" defaultTheme="light" storageKey="agent-harness-theme"><MemoryRouter initialEntries={['/resources?tab=rates']}><Harness /></MemoryRouter></ThemeProvider></StrictMode>);
// Dispose the entire test tree, including dialog portals, before Vite replaces this entry.
if (import.meta.hot) import.meta.hot.dispose(() => harnessRoot.unmount());
