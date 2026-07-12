import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, File, Eye, Download, AlertTriangle, Clock, RefreshCw, Layers, Hand, MousePointer, Ruler, Trash2 } from 'lucide-react';
import { AcApDocManager } from '@mlightcad/cad-simple-viewer';
import { acdbHostApplicationServices } from '@mlightcad/data-model';

const DrawingTest = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [result, setResult] = useState(null);
    
    // Performance & State Metrics
    const [wasmLoading, setWasmLoading] = useState(false);
    const [wasmLoadTime, setWasmLoadTime] = useState(null);
    const [wasmError, setWasmError] = useState(null);

    const containerRef = useRef(null);
    const viewerInstance = useRef(null);
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

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
            setWasmLoadTime(null);
            setWasmError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setUploadProgress(10);
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('/api/drawings-test/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });

            setResult(res.data);
            setUploadProgress(100);
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Upload failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

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

            // Fetch original DWG bytes
            const response = await fetch(originalUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch original file: ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            
            // Open document: fileName, content, options
            const opened = await viewerInstance.current.openDocument(
                file.name,
                buffer,
                {}
            );
            
            if (!opened) {
                throw new Error("AcApDocManager failed to open the document.");
            }

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
                    viewerInstance.current.curView.applyCanvasBackground(0x000000);
                }
            }

            // Force default interaction mode to Pan (1 = AcEdViewMode.PAN)
            if (viewerInstance.current && viewerInstance.current.curView) {
                viewerInstance.current.curView.mode = 1;
                setViewMode('pan');
            }

            // Clear any existing layouts interval
            if (layoutIntervalRef.current) {
                clearInterval(layoutIntervalRef.current);
                layoutIntervalRef.current = null;
            }

            // Periodically check and load layouts list until found
            layoutIntervalRef.current = setInterval(() => {
                if (viewerInstance.current && viewerInstance.current.curDocument) {
                    const doc = viewerInstance.current.curDocument;
                    const db = doc.database;
                    const layoutDict = db && db.objects && db.objects.layout;
                    if (layoutDict && layoutDict._recordsByName && layoutDict._recordsByName.size > 0) {
                        const layoutsList = [];
                        layoutDict._recordsByName.forEach((layoutObj, name) => {
                            layoutsList.push({
                                name,
                                tabOrder: layoutObj.tabOrder || 0,
                                id: layoutObj.objectId
                            });
                        });
                        if (layoutsList.length > 0) {
                            layoutsList.sort((a, b) => a.tabOrder - b.tabOrder);
                            setLayouts(layoutsList);
                            const activeName = acdbHostApplicationServices().layoutManager.findActiveLayout();
                            setActiveLayoutName(activeName || 'Model');
                            console.log("[CAD] Layouts loaded via polling:", layoutsList);
                            if (layoutIntervalRef.current) {
                                clearInterval(layoutIntervalRef.current);
                                layoutIntervalRef.current = null;
                            }
                        }
                    }
                }
            }, 500);
            
            const timeTaken = performance.now() - wasmStartRef.current;
            setWasmLoadTime(Math.round(timeTaken));
        } catch (err) {
            console.warn("WASM viewer error:", err);
            setWasmError(
                err.message + 
                "\n\n(Notice: Client-side WASM parsing requires copying the WebAssembly worker files from node_modules/@mlightcad/cad-simple-viewer/dist/ into the public/wasm/ directory of the frontend.)"
            );
        } finally {
            setWasmLoading(false);
        }
    };

    const handleSwitchLayout = (layoutName) => {
        if (!viewerInstance.current) return;
        const doc = viewerInstance.current.curDocument;
        if (!doc) return;
        const db = doc.database;
        const success = acdbHostApplicationServices().layoutManager.setCurrentLayout(layoutName, db);
        if (success) {
            setActiveLayoutName(layoutName);
            viewerInstance.current.sendStringToExecute('regen');
        }
    };

    const handleStartMeasure = () => {
        if (!viewerInstance.current) return;
        viewerInstance.current.sendStringToExecute('measuredistance');
        setViewMode('measure');
    };

    const handleClearMeasurements = () => {
        if (!viewerInstance.current) return;
        viewerInstance.current.sendStringToExecute('clearmeasurements');
        viewerInstance.current.sendStringToExecute('regen');
    };

    useEffect(() => {
        if (result && result.originalUrl) {
            initWasmRendering(result.originalUrl);
        }
    }, [result]);

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
        <div className="px-4 md:px-8 py-4 w-full dark:text-white min-h-[88vh] flex flex-col flex-1">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-200 dark:border-white/10">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">CAD Drawing Viewer</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Upload and view AutoCAD drawing files directly in your web browser.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-500 rounded-lg text-xs">
                    <Layers size={14} />
                    <span>WASM Vector Renderer</span>
                </div>
            </div>

            {/* Upload Zone */}
            {!result ? (
                <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-sm flex-1 flex flex-col justify-center items-center max-w-2xl mx-auto w-full my-auto border-dashed">
                    <div className="w-full text-center space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-lg font-bold">Select Drawing to View</h2>
                            <p className="text-xs text-gray-400">Your blueprints are processed entirely in the browser and never tampered with.</p>
                        </div>
                        <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-12 cursor-pointer transition-all bg-gray-50 dark:bg-white/[0.01]">
                            <Upload size={48} className="text-gray-400 mb-4 animate-bounce" />
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {file ? file.name : "Select or Drag a .DWG or .DXF Drawing"}
                            </span>
                            <span className="text-xs text-gray-400 mt-2">Supports AutoCAD DWG and DXF up to 50MB</span>
                            <input type="file" className="hidden" accept=".dwg,.dxf" onChange={handleFileChange} />
                        </label>

                        <button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>Uploading ({uploadProgress}%)</span>
                                </>
                            ) : (
                                <>
                                    <Upload size={16} />
                                    <span>Load Drawing</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                /* Full Page Viewport */
                <div className="flex-1 flex flex-col bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm min-h-[600px] flex-grow">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1f242c] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    setResult(null);
                                    setFile(null);
                                    if (viewerInstance.current) {
                                        viewerInstance.current.destroy().catch(err => console.warn(err));
                                        viewerInstance.current = null;
                                    }
                                }}
                                className="px-2.5 py-1.5 text-xs font-semibold border border-gray-300 dark:border-white/10 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-gray-700 dark:text-gray-300"
                            >
                                ← Upload Another
                            </button>
                            <span className="text-gray-300 dark:text-white/10">|</span>
                            <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-xs" title={result.originalName}>
                                {result.originalName}
                            </h3>
                            {layouts.length > 1 && (
                                <>
                                    <span className="text-gray-300 dark:text-white/10">|</span>
                                    <div className="flex items-center gap-2">
                                        <Layers size={14} className="text-gray-400" />
                                        <select
                                            value={activeLayoutName}
                                            onChange={(e) => handleSwitchLayout(e.target.value)}
                                            className="bg-white dark:bg-[#161b22] border border-gray-300 dark:border-white/10 rounded px-2.5 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
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
                            <div className="flex items-center bg-gray-200 dark:bg-white/5 p-0.5 rounded-lg border border-gray-300 dark:border-white/10">
                                <button
                                    onClick={() => handleSwitchViewMode('pan')}
                                    className={`px-2.5 py-1 flex items-center gap-1.5 rounded-md text-xs font-bold transition-all ${
                                        viewMode === 'pan' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/5'
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
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/5'
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
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white border border-gray-300 dark:border-white/10'
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
                            
                            <span className="text-gray-300 dark:text-white/10">|</span>
                            
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
                                <span className="text-xs bg-gray-500/10 border border-gray-500/20 text-gray-500 dark:text-gray-400 px-2.5 py-1.5 rounded font-mono">
                                    {wasmLoadTime} ms
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Canvas Container */}
                    <div className="flex-grow bg-[#212830] relative flex items-center justify-center min-h-[720px] h-[calc(100vh-230px)] w-full">
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
                            <div ref={containerRef} className="w-full h-full min-h-[720px] h-[calc(100vh-230px)] flex-grow flex" />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DrawingTest;
