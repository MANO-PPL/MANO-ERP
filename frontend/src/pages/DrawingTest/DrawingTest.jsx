import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, File, Eye, Download, AlertTriangle, Clock, RefreshCw, Layers, Hand, MousePointer } from 'lucide-react';
import { AcApDocManager } from '@mlightcad/cad-simple-viewer';

// Patch AcApDocManager to map explicit white, off-white, and light grey colors to black when the background is white.
// This handles cases where drawings explicitly color elements as white/grey, keeping them fully readable.
if (AcApDocManager && AcApDocManager.prototype) {
    const originalResolveColor = AcApDocManager.prototype.resolveColorToRgb;
    if (originalResolveColor) {
        AcApDocManager.prototype.resolveColorToRgb = function(color) {
            const rgb = originalResolveColor.call(this, color);
            if (this.curView && this.curView.backgroundColor === 0xffffff) {
                const r = (rgb >> 16) & 0xff;
                const g = (rgb >> 8) & 0xff;
                const b = rgb & 0xff;
                // If it is pure white, off-white, or very light grey (r, g, b close to each other and > 200)
                if (r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
                    return 0x000000;
                }
            }
            return rgb;
        };
    }
}

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
    const [wasmBgMode, setWasmBgMode] = useState('dark'); // 'light' or 'dark'
    const [viewMode, setViewMode] = useState('pan'); // 'select' or 'pan'

    const toggleWasmBackground = () => {
        const nextMode = wasmBgMode === 'light' ? 'dark' : 'light';
        setWasmBgMode(nextMode);
        
        if (viewerInstance.current) {
            viewerInstance.current.sendStringToExecute('switchbg');
        }
    };

    const toggleViewMode = () => {
        const nextMode = viewMode === 'select' ? 'pan' : 'select';
        setViewMode(nextMode);
        
        if (viewerInstance.current && viewerInstance.current.curView) {
            // 0 = AcEdViewMode.SELECTION, 1 = AcEdViewMode.PAN
            const modeVal = nextMode === 'select' ? 0 : 1;
            viewerInstance.current.curView.mode = modeVal;
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

            // Force default interaction mode to Pan (1 = AcEdViewMode.PAN)
            if (viewerInstance.current && viewerInstance.current.curView) {
                viewerInstance.current.curView.mode = 1;
                setViewMode('pan');
            }

            // Sync database background color variable to handle ACI-7 text inversion correctly
            if (viewerInstance.current) {
                if (wasmBgMode === 'light') {
                    viewerInstance.current.sendStringToExecute('switchbg');
                }
            }
            
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

    useEffect(() => {
        if (result && result.originalUrl) {
            initWasmRendering(result.originalUrl);
        }
    }, [result]);

    useEffect(() => {
        return () => {
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
                            <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs" title={result.originalName}>
                                {result.originalName}
                            </h3>
                        </div>
                        
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            {/* Interaction Mode Toggle */}
                            <button
                                onClick={toggleViewMode}
                                className={`px-3 py-1.5 flex items-center gap-1.5 rounded text-xs font-bold transition-all shadow-sm ${
                                    viewMode === 'pan' 
                                        ? 'bg-orange-600 hover:bg-orange-500 text-white' 
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white'
                                }`}
                                title={viewMode === 'pan' ? 'Switch to Selection Mode' : 'Switch to Pan Mode'}
                            >
                                {viewMode === 'pan' ? <Hand size={14} /> : <MousePointer size={14} />}
                                <span>{viewMode === 'pan' ? 'Pan Active' : 'Select Active'}</span>
                            </button>
                            
                            {/* Background Color Toggle */}
                            <button
                                onClick={toggleWasmBackground}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                title="Toggle canvas background color"
                            >
                                <span className={`w-2.5 h-2.5 rounded-full ${wasmBgMode === 'light' ? 'bg-white' : 'bg-black border border-white/40'}`} />
                                <span>Background: {wasmBgMode === 'light' ? 'White' : 'Black'}</span>
                            </button>
                            
                            {/* Download Original Original Untampered Drawing */}
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
                    <div className="flex-grow bg-black relative flex items-center justify-center min-h-[720px] h-[calc(100vh-230px)] w-full">
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
