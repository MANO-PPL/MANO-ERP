import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Hand, Layers, MousePointer, RefreshCw, Ruler, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import MobileSelect from '../../../components/MobileSelect';
import { AcApDocManager } from '@mlightcad/cad-simple-viewer';
import { acdbHostApplicationServices } from '@mlightcad/data-model';
import { cadFilename, createCadLifecycleGuard, readCadSearch, runCadCommand } from './mobileCadModel';

export default function MobileCadViewer({ fetchImpl = fetch, viewerFactory = AcApDocManager, hostServices = acdbHostApplicationServices }) {
    const location = useLocation();
    const { url, name } = readCadSearch(location.search);
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    const guardRef = useRef(createCadLifecycleGuard());
    const layoutTimerRef = useRef(null);
    const [loading, setLoading] = useState(Boolean(url));
    const [error, setError] = useState('');
    const [mode, setMode] = useState('pan');
    const [layouts, setLayouts] = useState([]);
    const [activeLayout, setActiveLayout] = useState('Model');

    useEffect(() => {
        const token = guardRef.current.begin(url);
        let disposed = false;
        setError(''); setLayouts([]); setActiveLayout('Model');
        if (!url) { setLoading(false); setError('No drawing URL was supplied.'); return () => guardRef.current.invalidate(); }

        const cleanupViewer = async () => {
            const viewer = viewerRef.current;
            viewerRef.current = null;
            if (viewer?.destroy) {
                try { await viewer.destroy(); } catch { /* cleanup remains best effort */ }
            }
        };

        const initialize = async () => {
            setLoading(true);
            try {
                await cleanupViewer();
                if (!containerRef.current || disposed) return;
                const viewer = viewerFactory.createInstance({
                    container: containerRef.current,
                    baseUrl: '/',
                    webworkerFileUrls: {
                        dxfParser: '/wasm/dxf-parser-worker.js',
                        dwgParser: '/wasm/libredwg-parser-worker.js',
                        mtextRender: '/wasm/mtext-renderer-worker.js',
                    },
                });
                if (!viewer) throw new Error('The CAD viewer could not be initialized.');
                viewerRef.current = viewer;
                const response = await fetchImpl(`/api/drawings-test/proxy?url=${encodeURIComponent(url)}`);
                if (!response.ok) throw new Error(`Drawing transport failed (${response.status}).`);
                const bytes = await response.arrayBuffer();
                if (!guardRef.current.isCurrent(token, url) || disposed) { await cleanupViewer(); return; }
                hostServices.activeFontUrl = '/fonts/';
                const document = await viewer.openDocument(cadFilename(name, url), bytes, {});
                if (!document) throw new Error('The CAD engine could not open this drawing.');
                if (!guardRef.current.isCurrent(token, url) || disposed) { await cleanupViewer(); return; }
                runCadCommand(viewer, 'fit');
                runCadCommand(viewer, 'pan');
                setMode('pan');
                clearInterval(layoutTimerRef.current);
                layoutTimerRef.current = window.setInterval(() => {
                    const documentInstance = viewer.curDocument || viewer.mdiActiveDocument;
                    const records = (documentInstance?.database || viewer.database)?.objects?.layout?._recordsByName;
                    if (!records) return;
                    const nextLayouts = Array.from(records.keys());
                    if (nextLayouts.length) { setLayouts(nextLayouts); clearInterval(layoutTimerRef.current); }
                }, 500);
                setLoading(false);
            } catch (viewerError) {
                if (guardRef.current.isCurrent(token, url) && !disposed) { setError(viewerError?.message || 'The CAD viewer could not load this drawing.'); setLoading(false); }
            }
        };
        const timer = window.setTimeout(initialize, 0);
        return () => {
            disposed = true;
            window.clearTimeout(timer);
            clearInterval(layoutTimerRef.current);
            guardRef.current.invalidate();
            cleanupViewer();
        };
    }, [fetchImpl, hostServices, name, url, viewerFactory]);

    const command = (next) => {
        if (!runCadCommand(viewerRef.current, next)) return;
        if (next === 'pan' || next === 'select' || next === 'measure') setMode(next);
    };

    const switchLayout = (layoutName) => {
        const viewer = viewerRef.current;
        const documentInstance = viewer?.curDocument || viewer?.mdiActiveDocument;
        const database = documentInstance?.database || viewer?.database;
        if (!viewer || !database) return;
        try {
            const manager = typeof hostServices === 'function' ? hostServices() : hostServices;
            if (manager?.layoutManager?.setCurrentLayout(layoutName, database)) {
                setActiveLayout(layoutName);
                viewer.sendStringToExecute('regen');
                viewer.sendStringToExecute('zoom e');
            }
        } catch (layoutError) { setError(layoutError?.message || 'The selected layout could not be opened.'); }
    };

    return <main data-mobile-cad-viewer className="fixed inset-0 z-50 flex min-w-0 flex-col overflow-hidden bg-[#212830] text-white">
        <header className="shrink-0 border-b border-white/10 bg-[#1f242c] px-2.5 pb-1.5 pt-[calc(.5rem+env(safe-area-inset-top))]">
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><h1 className="truncate text-xs font-semibold">{name}</h1><p className="text-[10px] text-gray-400">Standalone CAD viewer · existing proxy transport</p></div><a href={url || undefined} download aria-disabled={!url} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white aria-disabled:pointer-events-none aria-disabled:opacity-40"><Download size={14} />Download</a></div>
            <div className="mt-1.5 flex min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5" data-testid="mobile-cad-toolbar">
                <button type="button" aria-pressed={mode === 'pan'} onClick={() => command('pan')} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${mode === 'pan' ? 'bg-blue-600' : 'bg-white/10'}`}><Hand size={14} />Pan</button>
                <button type="button" aria-pressed={mode === 'select'} onClick={() => command('select')} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${mode === 'select' ? 'bg-blue-600' : 'bg-white/10'}`}><MousePointer size={14} />Select</button>
                <button type="button" aria-pressed={mode === 'measure'} onClick={() => command('measure')} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${mode === 'measure' ? 'bg-orange-600' : 'bg-white/10'}`}><Ruler size={14} />Measure</button>
                <button type="button" onClick={() => command('clear')} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs font-semibold"><Trash2 size={14} />Clear</button>
                <button type="button" onClick={() => command('fit')} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs font-semibold"><RefreshCw size={14} />Fit</button>
                {layouts.length > 0 && (
                    <div className="w-36 shrink-0">
                        <MobileSelect
                            placeholder="CAD layout"
                            value={activeLayout}
                            onChange={(event) => switchLayout(event.target.value)}
                            options={layouts.map((layout) => ({ value: layout, label: layout }))}
                        />
                    </div>
                )}
            </div>
        </header>
        <section className="relative min-h-0 flex-1 overflow-hidden" aria-label="CAD canvas">
            <div ref={containerRef} className="h-full w-full touch-none" data-testid="mobile-cad-canvas" />
            {loading && <div role="status" className="absolute inset-0 flex flex-col p-3 space-y-2 bg-[#161b22]"><div className="h-6 w-1/3 rounded bg-white/10 animate-pulse" /><div className="flex-1 rounded-xl bg-white/5 animate-pulse" /></div>}
            {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#161b22] p-4 text-center"><AlertTriangle size={36} className="text-amber-400" /><h2 className="text-sm font-semibold">CAD drawing unavailable</h2><p className="max-w-sm text-xs leading-5 text-gray-400">{error}</p></div>}
        </section>
    </main>;
}
