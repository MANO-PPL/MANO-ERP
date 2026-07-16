import React, { useState, useRef, useEffect } from 'react';
import { Download, AlertTriangle, RefreshCw, Layers, Hand, MousePointer, Ruler, Trash2 } from 'lucide-react';
import { AcApDocManager } from '@mlightcad/cad-simple-viewer';
import { acdbHostApplicationServices } from '@mlightcad/data-model';

const DrawingTest = () => {
    const [result, setResult] = useState(null);
    
    // Performance & State Metrics
    const [wasmLoading, setWasmLoading] = useState(false);
    const [wasmLoadTime, setWasmLoadTime] = useState(null);
    const [wasmError, setWasmError] = useState(null);

    const containerRef = useRef(null);
    const viewerInstance = useRef(null);
    const activeDocRef = useRef(null);
    const [viewMode, setViewMode] = useState('pan'); // 'select' or 'pan' or 'measure'
    const [layouts, setLayouts] = useState([]);
    const [activeLayoutName, setActiveLayoutName] = useState('Model');
    const layoutIntervalRef = useRef(null);

    const handleSwitchViewMode = (mode) => {
        setViewMode(mode);
        if (!viewerInstance.current || !viewerInstance.current.curView) return;
        
        // 0 = AcEdViewMode.SELECTION, 1 = AcEdViewMode.PAN
        if (mode === 'pan') {
            viewerInstance.current.curView.mode = 1;
        } else if (mode === 'select') {
            viewerInstance.current.curView.mode = 0;
        }
    };

    // Track stopwatch timers
    const wasmStartRef = useRef(null);

    const initWasmRendering = async (originalUrl) => {
        setWasmLoading(true);
        setWasmError(null);
        wasmStartRef.current = performance.now();

        try {
            if (!containerRef.current) {
                throw new Error("HTML container element is not mounted yet.");
            }

            // Cleanup previous instance
            if (viewerInstance.current) {
                try {
                    await viewerInstance.current.destroy();
                } catch (e) {
                    console.warn("Error destroying previous viewer:", e);
                }
                viewerInstance.current = null;
            }

            // Initialize document manager on the container div
            viewerInstance.current = AcApDocManager.createInstance({
                container: containerRef.current,
                baseUrl: '/', // Force loading fonts locally from '/fonts/'
                webworkerFileUrls: {
                    dxfParser: '/wasm/dxf-parser-worker.js',
                    dwgParser: '/wasm/libredwg-parser-worker.js',
                    mtextRender: '/wasm/mtext-renderer-worker.js'
                }
            });

            if (!viewerInstance.current) {
                throw new Error("Failed to create AcApDocManager instance. Make sure only one instance runs at a time.");
            }

            // Fetch original DWG bytes via local proxy to bypass CORS
            const proxyUrl = `/api/drawings-test/proxy?url=${encodeURIComponent(originalUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch original file: ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            
            // Set host application service config
            acdbHostApplicationServices.activeFontUrl = '/fonts/';
            
            // Extract the actual file extension from S3 URL (ignoring query parameters) to let WASM engine choose the correct parser
            const urlPath = originalUrl.split('?')[0];
            const extension = urlPath.substring(urlPath.lastIndexOf('.')).toLowerCase();
            const filenameWithExt = result.originalName.toLowerCase().endsWith(extension)
                ? result.originalName
                : `${result.originalName}${extension}`;

            // Open document: fileName, content, options
            const doc = await viewerInstance.current.openDocument(
                filenameWithExt,
                buffer,
                {}
            );
            
            if (!doc) {
                throw new Error("AcApDocManager failed to open the document.");
            }
            activeDocRef.current = doc;

            // Patch applyCanvasBackground to force standard CAD background (#212830) when set to black (0x000000)
            if (viewerInstance.current && viewerInstance.current.curView) {
                const originalApplyBg = viewerInstance.current.curView.applyCanvasBackground;
                if (originalApplyBg) {
                    viewerInstance.current.curView.applyCanvasBackground = function(color) {
                        if (color === 0x000000) {
                            color = 0x212830;
                        }
                        originalApplyBg.call(this, color);
                    };
                }
                // Call it once to force apply the patched color if it is currently black
                if (viewerInstance.current.curView.backgroundColor === 0x000000) {
                    viewerInstance.current.curView.applyCanvasBackground(0x212830);
                }
            }

            // Initial zoom extents
            viewerInstance.current.sendStringToExecute('zoom e');

            // Force Pan Mode after a brief delay once the viewer has stabilized
            setTimeout(() => {
                handleSwitchViewMode('pan');
            }, 600);

            // Success callback: stop metrics timers
            const duration = Math.round(performance.now() - wasmStartRef.current);
            setWasmLoadTime(duration);
            setWasmLoading(false);

            // Periodically check parsed layouts to fill layouts select dropdown
            if (layoutIntervalRef.current) {
                clearInterval(layoutIntervalRef.current);
            }
            layoutIntervalRef.current = setInterval(() => {
                const docInstance = viewerInstance.current?.curDocument || viewerInstance.current?.mdiActiveDocument;
                const dbInstance = docInstance?.database || viewerInstance.current?.database;
                if (dbInstance) {
                    const layoutContainer = dbInstance.objects?.layout;
                    if (layoutContainer) {
                        const records = layoutContainer._recordsByName;
                        if (records) {
                            const parsedList = Array.from(records.keys()).map((name, index) => ({
                                id: index,
                                name: name
                            }));
                            if (parsedList.length > 0) {
                                setLayouts(parsedList);
                                clearInterval(layoutIntervalRef.current);
                            }
                        }
                    }
                }
            }, 1000);

        } catch (err) {
            console.error("WASM Rendering Failed:", err);
            setWasmError(err.message || String(err));
            setWasmLoading(false);
        }
    };

    const handleSwitchLayout = async (layoutName) => {
        const docInstance = viewerInstance.current?.curDocument || viewerInstance.current?.mdiActiveDocument;
        if (!viewerInstance.current || !docInstance) return;
        try {
            setWasmLoading(true);
            const db = docInstance.database || viewerInstance.current?.database;
            const success = acdbHostApplicationServices().layoutManager.setCurrentLayout(layoutName, db);
            if (success) {
                setActiveLayoutName(layoutName);
                viewerInstance.current.sendStringToExecute('regen');
                
                // Re-apply background mapping
                if (viewerInstance.current.curView) {
                    if (viewerInstance.current.curView.backgroundColor === 0x000000) {
                        viewerInstance.current.curView.applyCanvasBackground(0x212830);
                    }
                }
                viewerInstance.current.sendStringToExecute('zoom e');
            }
            setWasmLoading(false);
        } catch (err) {
            console.error("Layout Switch Failed:", err);
            setWasmLoading(false);
        }
    };

    const handleStartMeasure = () => {
        if (!viewerInstance.current) return;
        setViewMode('measure');
        viewerInstance.current.sendStringToExecute('dist');
    };

    const handleClearMeasurements = () => {
        if (!viewerInstance.current) return;
        viewerInstance.current.sendStringToExecute('regen');
    };

    useEffect(() => {
        if (result && result.originalUrl) {
            // Delay invocation slightly to ensure containerRef is fully mounted on DOM
            const timer = setTimeout(() => {
                initWasmRendering(result.originalUrl);
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [result]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlParam = params.get('url');
        const nameParam = params.get('name');
        if (urlParam) {
            setResult({
                originalUrl: urlParam,
                originalName: nameParam || 'Drawing.dwg'
            });
        }
    }, []);

    useEffect(() => {
        return () => {
            if (layoutIntervalRef.current) {
                clearInterval(layoutIntervalRef.current);
            }
            if (viewerInstance.current) {
                viewerInstance.current.destroy().catch(err => {
                    console.warn("Error destroying viewer on unmount:", err);
                });
            }
        };
    }, []);

    return (
        <div className="w-screen h-screen flex flex-col bg-[#212830] overflow-hidden text-white select-none">
            {/* Viewport Frame */}
            {!result ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#161b22]">
                    <RefreshCw className="animate-spin text-blue-500 mb-4" size={32} />
                    <p className="text-sm font-semibold text-gray-300">Retrieving drawing from storage...</p>
                    <p className="text-xs text-gray-500 mt-1">Please wait while the S3 connection is established.</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden w-full h-full">
                    {/* Toolbar */}
                    <div className="px-4 py-2.5 border-b border-white/5 bg-[#1f242c] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-20 shrink-0">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-xs text-white truncate max-w-[200px] sm:max-w-xs" title={result.originalName}>
                                {result.originalName}
                            </h3>
                            {layouts.length > 0 && (
                                <>
                                    <span className="text-white/10">|</span>
                                    <div className="flex items-center gap-2">
                                        <Layers size={13} className="text-gray-400" />
                                        <select
                                            value={activeLayoutName}
                                            onChange={(e) => handleSwitchLayout(e.target.value)}
                                            className="bg-[#161b22] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                                        >
                                            {layouts.map((l) => (
                                                <option key={l.id} value={l.name}>
                                                    {l.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            {/* Interaction Mode Toggles */}
                            <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10">
                                <button
                                    onClick={() => handleSwitchViewMode('pan')}
                                    className={`px-2.5 py-1 flex items-center gap-1.5 rounded-md text-xs font-bold transition-all ${
                                        viewMode === 'pan' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-300 hover:bg-white/5'
                                    }`}
                                    title="Pan Mode (Left-click drag to move)"
                                >
                                    <Hand size={13} />
                                    <span>Pan</span>
                                </button>
                                <button
                                    onClick={() => handleSwitchViewMode('select')}
                                    className={`px-2.5 py-1 flex items-center gap-1.5 rounded-md text-xs font-bold transition-all ${
                                        viewMode === 'select' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-300 hover:bg-white/5'
                                    }`}
                                    title="Selection Mode"
                                >
                                    <MousePointer size={13} />
                                    <span>Select</span>
                                </button>
                            </div>

                            {/* Measurement Buttons */}
                            <button
                                onClick={handleStartMeasure}
                                className={`px-3 py-1.5 flex items-center gap-1.5 rounded text-xs font-bold transition-all shadow-sm ${
                                    viewMode === 'measure'
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                                }`}
                                title="Measure distance between two points"
                            >
                                <Ruler size={14} />
                                <span>Measure</span>
                            </button>

                            <button
                                onClick={handleClearMeasurements}
                                className="px-3 py-1.5 bg-red-600/15 hover:bg-red-600/25 border border-red-600/30 text-red-500 rounded text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                title="Clear all active measurements"
                            >
                                <Trash2 size={14} />
                                <span>Clear</span>
                            </button>
                            
                            <span className="text-white/10">|</span>
                            
                            {/* Download Original Untampered Drawing */}
                            <a
                                href={result.originalUrl}
                                download
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <Download size={14} />
                                <span>Download Original</span>
                            </a>
                            
                            {wasmLoadTime && (
                                <span className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1.5 rounded font-mono">
                                    {wasmLoadTime} ms
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Canvas Container */}
                    <div className="flex-1 relative w-full h-full bg-[#212830] overflow-hidden flex items-center justify-center">
                        {wasmLoading && (
                            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 z-10">
                                <RefreshCw className="animate-spin text-blue-400" size={36} />
                                <p className="text-sm text-gray-300 font-medium">Parsing CAD drawing stream...</p>
                            </div>
                        )}

                        {wasmError ? (
                            <div className="p-6 text-center max-w-md space-y-4">
                                <AlertTriangle className="text-yellow-500 mx-auto" size={44} />
                                <h4 className="font-bold text-sm text-yellow-500">WASM Initialization Error</h4>
                                <p className="text-xs text-gray-400 leading-relaxed text-left whitespace-pre-line bg-black/40 p-4 rounded-lg border border-white/5 font-mono">
                                    {wasmError}
                                </p>
                            </div>
                        ) : (
                            <div ref={containerRef} className="w-full h-full flex-grow flex" />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DrawingTest;
