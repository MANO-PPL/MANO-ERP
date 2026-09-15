import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Hand, Layers, MousePointer, RefreshCw, Ruler, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
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
        <header className="shrink-0 border-b border-white/10 bg-[#1f242c] px-3 pb-2 pt-[calc(.5rem+env(safe-area-inset-top))]">
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><h1 className="truncate text-sm font-bold">{name}</h1><p className="text-[10px] text-gray-400">Standalone CAD viewer · existing proxy transport</p></div><a href={url || undefined} download aria-disabled={!url} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white aria-disabled:pointer-events-none aria-disabled:opacity-40"><Download size={17} />Download</a></div>
            <div className="mt-2 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1" data-testid="mobile-cad-toolbar">
                <button type="button" aria-pressed={mode === 'pan'} onClick={() => command('pan')} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold ${mode === 'pan' ? 'bg-blue-600' : 'bg-white/10'}`}><Hand size={17} />Pan</button>
                <button type="button" aria-pressed={mode === 'select'} onClick={() => command('select')} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold ${mode === 'select' ? 'bg-blue-600' : 'bg-white/10'}`}><MousePointer size={17} />Select</button>
                <button type="button" aria-pressed={mode === 'measure'} onClick={() => command('measure')} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold ${mode === 'measure' ? 'bg-orange-600' : 'bg-white/10'}`}><Ruler size={17} />Measure</button>
                <button type="button" onClick={() => command('clear')} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-bold"><Trash2 size={17} />Clear</button>
                <button type="button" onClick={() => command('fit')} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-bold"><RefreshCw size={17} />Fit</button>
                {layouts.length > 0 && <label className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-bold"><Layers size={17} /><span className="sr-only">CAD layout</span><select value={activeLayout} onChange={(event) => switchLayout(event.target.value)} className="bg-transparent text-xs font-bold text-white outline-none">{layouts.map((layout) => <option key={layout} value={layout} className="bg-[#1f242c]">{layout}</option>)}</select></label>}
            </div>
        </header>
        <section className="relative min-h-0 flex-1 overflow-hidden" aria-label="CAD canvas">
            <div ref={containerRef} className="h-full w-full touch-none" data-testid="mobile-cad-canvas" />
            {loading && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75"><RefreshCw size={32} className="animate-spin text-blue-400" /><p className="text-sm font-semibold">Loading CAD drawing…</p></div>}
            {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#161b22] p-6 text-center"><AlertTriangle size={40} className="text-amber-400" /><h2 className="text-base font-bold">CAD drawing unavailable</h2><p className="max-w-sm text-xs leading-5 text-gray-400">{error}</p></div>}
        </section>
    </main>;
}
