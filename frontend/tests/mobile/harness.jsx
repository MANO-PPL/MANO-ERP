import React, { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BriefcaseBusiness, SlidersHorizontal } from 'lucide-react';
import { ThemeProvider } from 'next-themes';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import '../../src/index.css';
import { AuthProvider } from '../../src/context/AuthContext';
import ResponsiveRoute from '../../src/mobile/routing/ResponsiveRoute';
import MobileMainLayout from '../../src/mobile/layout/MobileMainLayout';
import MobilePageHeader from '../../src/mobile/components/MobilePageHeader';
import MobileCard, { MobileEntityCard, MobileStatCard } from '../../src/mobile/components/MobileCard';
import MobileTabs from '../../src/mobile/components/MobileTabs';
import MobileSearchBar from '../../src/mobile/components/MobileSearchBar';
import MobileFilterSheet from '../../src/mobile/components/MobileFilterSheet';
import MobileBottomSheet, { MobileActionSheet } from '../../src/mobile/components/MobileBottomSheet';
import MobileConfirmModal from '../../src/mobile/components/MobileConfirmModal';
import MobileFormSection from '../../src/mobile/components/MobileFormSection';
import MobileSelect from '../../src/mobile/components/MobileSelect';
import MobileDatePicker from '../../src/mobile/components/MobileDatePicker';
import MobileFAB from '../../src/mobile/components/MobileFAB';
import MobileStickyActions from '../../src/mobile/components/MobileStickyActions';
import MobileLoadingState from '../../src/mobile/components/MobileLoadingState';
import MobileEmptyState from '../../src/mobile/components/MobileEmptyState';
import { MOBILE_DRAWER_HISTORY_KEY } from '../../src/mobile/hooks/useMobileDrawer';

const params = new URLSearchParams(window.location.search);
const isFrame = params.get('frame') === '1';
const harnessEntry = window.location.pathname.endsWith('/index.html') ? './index.html' : './harness.html';
const harnessWidths = [360, 390, 430, 768, 1023, 1024];
const networkAttempts = [];
let syntheticProjectLoads = 0;

// This harness rejects every application fetch/XHR. Assets loaded by Vite are unaffected.
const originalFetch = window.fetch;
const originalXhrOpen = XMLHttpRequest.prototype.open;
window.fetch = (input) => {
    networkAttempts.push(String(input));
    return Promise.reject(new Error('The isolated mobile harness forbids application network requests'));
};
XMLHttpRequest.prototype.open = function blockedXhr(method, url) {
    networkAttempts.push(`${method} ${url}`);
    throw new Error('The isolated mobile harness forbids application network requests');
};

window.addEventListener('beforeunload', () => {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
});

const loadSyntheticProjects = async () => {
    syntheticProjectLoads += 1;
    return {
        success: true,
        projects: [
            { id: 'fixture-1', name: 'Synthetic Alpha Project', project_code: 'FIX-001' },
            { id: 'fixture-2', name: 'Synthetic Beta Project', project_code: 'FIX-002' },
        ],
    };
};

const waitForPaint = (delay = 50) => new Promise((resolve) => window.setTimeout(resolve, delay));
const pointerEvent = (type, clientY, pointerId = 1, pointerType = 'touch') => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType, clientX: 120, clientY, button: 0 });
const dragSheet = async (target, startY, endY, pointerType = 'touch') => {
    target?.dispatchEvent(pointerEvent('pointerdown', startY, 1, pointerType));
    await waitForPaint(90);
    target?.dispatchEvent(pointerEvent('pointermove', endY, 1, pointerType));
    target?.dispatchEvent(pointerEvent('pointerup', endY, 1, pointerType));
    await waitForPaint(260);
};
const rectanglesOverlap = (first, second) => !(
    first.right <= second.left
    || first.left >= second.right
    || first.bottom <= second.top
    || first.top >= second.bottom
);

function RouteProbe() {
    const location = useLocation();
    const seenKeysRef = useRef(new Set());
    const [visits, setVisits] = useState({});

    useEffect(() => {
        if (seenKeysRef.current.has(location.key)) return;
        seenKeysRef.current.add(location.key);
        setVisits((current) => ({
            ...current,
            [location.pathname]: (current[location.pathname] || 0) + 1,
        }));
    }, [location.key, location.pathname]);

    return (
        <output
            data-current-route={location.pathname}
            data-current-route-visits={visits[location.pathname] || 0}
            className="sr-only"
        >
            {location.pathname}
        </output>
    );
}

function PrimitiveGallery() {
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('overview');
    const [filterOpen, setFilterOpen] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [longSheetOpen, setLongSheetOpen] = useState(false);
    const [pendingSheetOpen, setPendingSheetOpen] = useState(false);

    return (
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28">
            <RouteProbe />
            <MobilePageHeader title="Mobile foundation" subtitle="Synthetic components. No ERP data is loaded." eyebrow="M1 harness" />
            <MobileSearchBar value={search} onChange={setSearch} />
            <MobileTabs
                segmented
                value={tab}
                onChange={setTab}
                items={[{ value: 'overview', label: 'Overview' }, { value: 'activity', label: 'Activity', count: 3 }]}
            />
            <div className="grid grid-cols-2 gap-3">
                <MobileStatCard label="Open items" value="12" detail="Synthetic value" />
                <MobileStatCard label="Progress" value="64%" tone="green" />
            </div>
            <MobileEntityCard icon={BriefcaseBusiness} title="Synthetic project" subtitle="Fixture only" onClick={() => {}} />
            <MobileCard>
                <p className="text-sm text-gray-600 dark:text-gh-muted">Base card surface</p>
            </MobileCard>
            <MobileFormSection title="Project details" description="Native mobile controls">
                <MobileSelect label="Status" defaultValue="active" options={[{ value: 'active', label: 'Active' }, { value: 'hold', label: 'On hold' }]} />
                <MobileDatePicker label="Start date" defaultValue="2026-09-09" />
            </MobileFormSection>
            <div className="grid grid-cols-2 gap-2">
                <button type="button" className="min-h-11 rounded-xl border dark:border-gh-border" onClick={() => setFilterOpen(true)}>Filters</button>
                <button type="button" className="min-h-11 rounded-xl border dark:border-gh-border" onClick={() => setActionsOpen(true)}>Actions</button>
                <button type="button" className="min-h-11 rounded-xl border dark:border-gh-border" onClick={() => setSheetOpen(true)}>Sheet</button>
                <button type="button" className="min-h-11 rounded-xl border dark:border-gh-border" onClick={() => setConfirmOpen(true)}>Confirm</button>
                <button type="button" className="min-h-11 rounded-xl border dark:border-gh-border" onClick={() => setLongSheetOpen(true)}>Long sheet</button>
                <button type="button" className="min-h-11 rounded-xl border dark:border-gh-border" onClick={() => setPendingSheetOpen(true)}>Pending sheet</button>
            </div>
            <MobileLoadingState label="Synthetic loading state" rows={1} />
            <MobileEmptyState title="Synthetic empty state" description="No records are implied by this fixture." />

            <MobileFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} onApply={() => setFilterOpen(false)} onReset={() => {}}>
                <MobileSelect label="Fixture filter" options={[{ value: '', label: 'All' }]} />
            </MobileFilterSheet>
            <MobileBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Synthetic sheet">
                <div className="space-y-2">
                    <button type="button" data-sheet-first className="min-h-11 w-full rounded-xl border dark:border-gh-border">First sheet action</button>
                    <button type="button" data-sheet-last className="min-h-11 w-full rounded-xl border dark:border-gh-border">Last sheet action</button>
                </div>
            </MobileBottomSheet>
            <MobileBottomSheet
                open={longSheetOpen}
                onClose={() => setLongSheetOpen(false)}
                title="Long synthetic sheet"
                footer={(
                    <div data-tall-sheet-footer className="space-y-3">
                        <p className="text-sm font-semibold">Tall synthetic footer remains visible.</p>
                        <button type="button" className="min-h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white">Synthetic footer action</button>
                        <button type="button" className="min-h-11 w-full rounded-xl border dark:border-gh-border">Secondary footer action</button>
                    </div>
                )}
            >
                <div className="space-y-3">{Array.from({ length: 48 }, (_, index) => <p key={index} data-long-sheet-row className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gh-hover">Synthetic scroll row {index + 1}</p>)}</div>
            </MobileBottomSheet>
            <MobileBottomSheet open={pendingSheetOpen} onClose={undefined} title="Pending synthetic sheet">
                <p className="text-sm">This synthetic sheet intentionally cannot close while pending.</p>
            </MobileBottomSheet>
            <MobileActionSheet open={actionsOpen} onClose={() => setActionsOpen(false)} actions={[{ label: 'Synthetic action', onSelect: () => {} }]} />
            <MobileConfirmModal open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => setConfirmOpen(false)} message="This confirms only a local fixture interaction." />
            <MobileStickyActions>
                <button type="button" className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Synthetic save</button>
            </MobileStickyActions>
            <MobileFAB label="Synthetic add" icon={SlidersHorizontal} />
        </div>
    );
}

function DesktopSentinel() {
    return (
        <div data-layout-branch="desktop" className="min-h-screen bg-gray-50 p-6 dark:bg-gh-bg">
            <div data-agent-contract="desktop" />
            <h1 className="text-lg font-bold">Desktop sentinel</h1>
            <Outlet />
        </div>
    );
}

function ContractChecks() {
    const [results, setResults] = useState([]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            await waitForPaint(120);
            if (cancelled) return;

            const expectedWidth = Number(params.get('width') || window.innerWidth);
            const expectedMobile = expectedWidth <= 1023;
            const rows = [];
            const check = (label, pass) => rows.push({ label, pass: Boolean(pass) });
            const initialHistoryState = window.history.state;
            check('Exact expected viewport', window.innerWidth === expectedWidth);
            check('Exactly one layout branch mounted', document.querySelectorAll('[data-layout-branch]').length === 1);
            check('Correct exclusive branch mounted', Boolean(document.querySelector(`[data-layout-branch="${expectedMobile ? 'mobile' : 'desktop'}"]`)));
            check('Exactly one layout Agent contract', document.querySelectorAll('[data-agent-contract]').length === 1);

            if (expectedMobile) {
                check('Existing Agent shell mounted once', document.querySelectorAll('[aria-label="Open ERP Assistant"]').length === 1);
                const agentLauncher = document.querySelector('[aria-label="Open ERP Assistant"]');
                const mobileFab = document.querySelector('[aria-label="Synthetic add"]');
                check('FAB clears Agent launcher', !rectanglesOverlap(mobileFab.getBoundingClientRect(), agentLauncher.getBoundingClientRect()));
                const stickyActions = document.querySelector('[aria-label="Page actions"]');
                stickyActions?.scrollIntoView({ block: 'end' });
                await waitForPaint();
                check('Sticky actions clear Agent launcher', !rectanglesOverlap(stickyActions.getBoundingClientRect(), agentLauncher.getBoundingClientRect()));
                const menuButton = document.querySelector('[aria-label="Open navigation"]');
                menuButton?.click();
                await waitForPaint();
                check('Drawer opens', Boolean(document.getElementById('mobile-navigation-drawer')));
                check('Drawer locks body scroll', document.body.style.overflow === 'hidden');
                check('Permission filter hides Projects', ![...document.querySelectorAll('#mobile-navigation-drawer a')].some((link) => link.textContent.includes('Projects')));
                check('Dashboard remains available', [...document.querySelectorAll('#mobile-navigation-drawer a')].some((link) => link.textContent.includes('Dashboard')));
                check('Synthetic recent projects load', syntheticProjectLoads > 0 && document.body.textContent.includes('Synthetic Alpha Project'));

                window.history.back();
                await waitForPaint(120);
                check('Browser Back closes drawer', !document.getElementById('mobile-navigation-drawer'));
                check('Normal Back keeps current route', document.querySelector('[data-current-route]')?.dataset.currentRoute === '/');
                check('Back restores body scroll', document.body.style.overflow !== 'hidden');
                check('Back restores menu focus', document.activeElement === menuButton);

                menuButton?.click();
                await waitForPaint();
                document.querySelector('[data-testid="mobile-drawer-layer"] > button')?.click();
                await waitForPaint(120);
                check('Backdrop closes drawer', !document.getElementById('mobile-navigation-drawer'));

                menuButton?.click();
                await waitForPaint();
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
                await waitForPaint(120);
                check('Escape closes drawer', !document.getElementById('mobile-navigation-drawer'));

                menuButton?.click();
                await waitForPaint();
                document.querySelector('[aria-label="Close navigation drawer"]')?.click();
                await waitForPaint(120);
                check('Close button closes drawer', !document.getElementById('mobile-navigation-drawer'));

                menuButton?.click();
                await waitForPaint();
                const projectLink = [...document.querySelectorAll('#mobile-navigation-drawer a')]
                    .find((link) => link.textContent.includes('Synthetic Alpha Project'));
                projectLink?.click();
                await waitForPaint(150);
                check('Navigation closes drawer', !document.getElementById('mobile-navigation-drawer'));
                const routeProbe = document.querySelector('[data-current-route]');
                check('Navigation reaches requested final route', routeProbe?.dataset.currentRoute === '/projects/fixture-1');
                check('Navigation executes exactly once', routeProbe?.dataset.currentRouteVisits === '1');
                check('Navigation leaves no current drawer marker', !(MOBILE_DRAWER_HISTORY_KEY in (window.history.state || {})));
                check('Navigation consumes drawer Back entry', window.history.state === initialHistoryState);

                const sheetTrigger = [...document.querySelectorAll('button')]
                    .find((button) => button.textContent.trim() === 'Sheet');
                sheetTrigger?.focus();
                sheetTrigger?.click();
                await waitForPaint();
                const sheetPanel = [...document.querySelectorAll('[role="dialog"]')]
                    .find((dialog) => dialog.textContent.includes('Synthetic sheet'));
                const sheetClose = sheetPanel?.querySelector('button[aria-label="Close"]');
                const sheetLast = sheetPanel?.querySelector('[data-sheet-last]');
                const sheetBackdrop = document.querySelector('[data-testid="mobile-bottom-sheet-layer"] > button');
                check('Bottom sheet initially focuses panel', document.activeElement === sheetPanel);
                sheetPanel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
                check('Bottom sheet panel Shift+Tab stays inside', document.activeElement === sheetLast && sheetPanel?.contains(document.activeElement));
                check('Bottom sheet backdrop is not tabbable', sheetBackdrop?.tabIndex === -1);
                const dragRegion = sheetPanel?.querySelector('[data-testid="mobile-bottom-sheet-drag-region"]');
                await dragSheet(dragRegion, 700, 590);
                check('Bottom sheet upward drag expands', sheetPanel?.dataset.bottomSheetSnap === 'expanded');
                await dragSheet(dragRegion, 590, 700);
                check('Bottom sheet downward drag collapses', sheetPanel?.dataset.bottomSheetSnap === 'default');
                await dragSheet(dragRegion, 700, 685);
                check('Bottom sheet short drag snaps back', sheetPanel?.dataset.bottomSheetSnap === 'default');
                await dragSheet(dragRegion, 700, 585, 'mouse');
                check('Bottom sheet mouse drag expands', sheetPanel?.dataset.bottomSheetSnap === 'expanded');
                await dragSheet(dragRegion, 585, 700);
                check('Bottom sheet repeated collapse is stable', sheetPanel?.dataset.bottomSheetSnap === 'default');
                sheetLast?.focus();
                sheetLast?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
                check('Bottom sheet Tab wraps to first control', document.activeElement === sheetClose);
                sheetClose?.focus();
                sheetClose?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
                check('Bottom sheet Shift+Tab wraps to last control', document.activeElement === sheetLast);
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
                await waitForPaint();
                check('Bottom sheet Escape closes', !document.body.textContent.includes('Synthetic sheet'));
                check('Bottom sheet restores body scroll', document.body.style.overflow !== 'hidden');
                check('Bottom sheet restores trigger focus', document.activeElement === sheetTrigger);

                sheetTrigger?.focus();
                sheetTrigger?.click();
                await waitForPaint();
                document.querySelector('[data-testid="mobile-bottom-sheet-layer"] > button')?.click();
                await waitForPaint();
                check('Bottom sheet backdrop closes', !document.body.textContent.includes('Synthetic sheet'));

                sheetTrigger?.click();
                await waitForPaint();
                const reopenedPanel = [...document.querySelectorAll('[role="dialog"]')].find((dialog) => dialog.textContent.includes('Synthetic sheet'));
                check('Bottom sheet fresh reopen resets default', reopenedPanel?.dataset.bottomSheetSnap === 'default');
                await dragSheet(reopenedPanel?.querySelector('[data-testid="mobile-bottom-sheet-drag-region"]'), 700, 820);
                await waitForPaint();
                check('Bottom sheet downward drag dismisses', !document.body.textContent.includes('Synthetic sheet'));

                const longTrigger = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Long sheet');
                longTrigger?.click();
                await waitForPaint();
                const longPanel = [...document.querySelectorAll('[role="dialog"]')].find((dialog) => dialog.textContent.includes('Long synthetic sheet'));
                const longContent = longPanel?.querySelector('[data-testid="mobile-bottom-sheet-content"]');
                const longDragRegion = longPanel?.querySelector('[data-testid="mobile-bottom-sheet-drag-region"]');
                const tallFooter = longPanel?.querySelector('[data-tall-sheet-footer]');
                const defaultLongPanelRect = longPanel?.getBoundingClientRect();
                longContent.scrollTop = 160;
                const contentScrollTop = longContent.scrollTop;
                longContent.dispatchEvent(pointerEvent('pointerdown', 700));
                longContent.dispatchEvent(pointerEvent('pointermove', 590));
                longContent.dispatchEvent(pointerEvent('pointerup', 590));
                await waitForPaint();
                check('Long content scroll does not move sheet', longPanel?.dataset.bottomSheetSnap === 'default');
                check('Long content remains independently scrollable', longContent.scrollTop === contentScrollTop && longContent.scrollHeight > longContent.clientHeight);
                check('Tall footer remains visible outside scrolling content', Boolean(tallFooter) && tallFooter.getBoundingClientRect().bottom <= longPanel.getBoundingClientRect().bottom && tallFooter.getBoundingClientRect().top >= longContent.getBoundingClientRect().bottom);
                check('Tall footer does not cause panel or viewport overflow', longPanel.scrollHeight <= longPanel.clientHeight && document.documentElement.scrollWidth <= window.innerWidth);
                await dragSheet(longDragRegion, 700, 590);
                check('Header drag does not change content scroll', longContent.scrollTop === contentScrollTop);
                await waitForPaint(280);
                const expandedLongPanelRect = longPanel?.getBoundingClientRect();
                check('Long sheet remains at expanded snap after release', longPanel?.dataset.bottomSheetSnap === 'expanded' && expandedLongPanelRect?.height > defaultLongPanelRect?.height);
                check('Expanded long sheet is pinned near the safe-area top', expandedLongPanelRect?.top >= 0 && expandedLongPanelRect?.top <= 24);
                const expandedPanelTop = expandedLongPanelRect?.top;
                longContent.scrollTop = contentScrollTop + 120;
                await waitForPaint();
                check('Expanded content scroll keeps the panel pinned', longContent.scrollTop > contentScrollTop && Math.abs(longPanel.getBoundingClientRect().top - expandedPanelTop) < 1);
                await dragSheet(longDragRegion, 590, 700);
                check('Expanded long sheet downward drag collapses', longPanel?.dataset.bottomSheetSnap === 'default');
                await dragSheet(longDragRegion, 700, 590);
                await waitForPaint(280);
                check('Re-expanded long sheet remains pinned', longPanel?.dataset.bottomSheetSnap === 'expanded' && longPanel.getBoundingClientRect().top >= 0 && longPanel.getBoundingClientRect().top <= 24);
                longDragRegion?.dispatchEvent(pointerEvent('pointerdown', 700));
                longDragRegion?.dispatchEvent(pointerEvent('pointermove', 600));
                longDragRegion?.dispatchEvent(pointerEvent('pointercancel', 600));
                await waitForPaint(260);
                check('Pointer cancellation leaves stable snap', longPanel?.dataset.bottomSheetSnap === 'expanded');
                document.querySelector('[data-testid="mobile-bottom-sheet-layer"] > button')?.click();
                await waitForPaint();
                longTrigger?.click();
                await waitForPaint();
                const reopenedLongPanel = [...document.querySelectorAll('[role="dialog"]')].find((dialog) => dialog.textContent.includes('Long synthetic sheet'));
                check('Long sheet fresh reopen resets default snap', reopenedLongPanel?.dataset.bottomSheetSnap === 'default');
                document.querySelector('[data-testid="mobile-bottom-sheet-layer"] > button')?.click();
                await waitForPaint();

                const pendingTrigger = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Pending sheet');
                pendingTrigger?.click();
                await waitForPaint();
                const pendingPanel = [...document.querySelectorAll('[role="dialog"]')].find((dialog) => dialog.textContent.includes('Pending synthetic sheet'));
                const pendingDragRegion = pendingPanel?.querySelector('[data-testid="mobile-bottom-sheet-drag-region"]');
                await dragSheet(pendingDragRegion, 700, 820);
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
                document.querySelector('[data-testid="mobile-bottom-sheet-layer"] > button')?.click();
                await waitForPaint();
                check('Non-dismissible sheet rejects swipe Escape and backdrop', Boolean(document.body.textContent.includes('Pending synthetic sheet')) && pendingPanel?.dataset.bottomSheetSnap === 'default');

                const themeButton = document.querySelector('[aria-label="Use dark theme"]');
                themeButton?.click();
                await waitForPaint();
                check('Dark theme applies', document.documentElement.classList.contains('dark'));
                document.querySelector('[aria-label="Use light theme"]')?.click();
                await waitForPaint();
                check('Light theme restores', !document.documentElement.classList.contains('dark'));
            } else {
                check('Mobile shell absent at 1024', !document.querySelector('[data-layout-branch="mobile"]'));
                check('Mobile Agent shell absent at 1024', !document.querySelector('[aria-label="Open ERP Assistant"]'));
            }

            check('No viewport-level horizontal overflow', document.documentElement.scrollWidth <= window.innerWidth);
            check('No ERP or Agent fetch/XHR', networkAttempts.length === 0);
            setResults(rows);
            const targetOrigin = window.location.protocol === 'file:' ? '*' : window.location.origin;
            window.parent.postMessage({ type: 'mano-mobile-harness-results', width: window.innerWidth, rows }, targetOrigin);
        };
        run();
        return () => { cancelled = true; };
    }, []);

    return (
        <ol aria-label="Frame checks" data-viewport-width={window.innerWidth} className="fixed left-2 top-16 z-[80] max-w-xs rounded-xl border border-gray-200 bg-white/95 p-2 text-[10px] shadow dark:border-gh-border dark:bg-gh-subtle/95">
            {results.map((result) => <li key={result.label} className={result.pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>{result.pass ? 'PASS' : 'FAIL'}: {result.label}</li>)}
        </ol>
    );
}

function FrameHarness() {
    return (
        <StrictMode>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="mano-mobile-harness-theme">
                <AuthProvider>
                    <MemoryRouter initialEntries={['/']}>
                        <ContractChecks />
                        <Routes>
                            <Route
                                element={(
                                    <ResponsiveRoute
                                        mobile={<MobileMainLayout loadProjects={loadSyntheticProjects} />}
                                        desktop={<DesktopSentinel />}
                                    />
                                )}
                            >
                                <Route path="*" element={<PrimitiveGallery />} />
                            </Route>
                        </Routes>
                    </MemoryRouter>
                </AuthProvider>
            </ThemeProvider>
        </StrictMode>
    );
}

function ParentHarness() {
    const [reports, setReports] = useState({});
    const [activeIndex, setActiveIndex] = useState(0);
    useEffect(() => {
        const receive = (event) => {
            if (event.origin !== window.location.origin || event.data?.type !== 'mano-mobile-harness-results') return;
            setReports((current) => ({ ...current, [event.data.width]: event.data.rows }));
            setActiveIndex((current) => harnessWidths[current] === event.data.width ? current + 1 : current);
        };
        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, []);

    return (
        <main className="min-h-screen bg-gray-100 p-4 text-gray-900">
            <h1 className="text-lg font-bold">MANO ERP mobile foundation harness</h1>
            <p className="mt-1 text-xs">Synthetic fixtures only. Application fetch and XHR are blocked.</p>
            {harnessWidths.map((width, index) => {
                const rows = reports[width] || [];
                const finished = rows.length > 0;
                const passed = finished && rows.every((row) => row.pass);
                return (
                    <section key={width} className="mt-5">
                        <h2 className="text-sm font-bold">{width}px — {finished ? passed ? 'PASS' : 'FAIL' : 'RUNNING'}</h2>
                        <div className="mt-2 max-w-full overflow-auto rounded-xl border border-gray-300 bg-white p-2">
                            {index === activeIndex && (
                                <iframe
                                    title={`${width}px mobile foundation checks`}
                                    src={`${harnessEntry}?frame=1&width=${width}`}
                                    width={width}
                                    height="900"
                                    className="block max-w-none border-0"
                                />
                            )}
                        </div>
                    </section>
                );
            })}
        </main>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(isFrame ? <FrameHarness /> : <ParentHarness />);

if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
