import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    Network,
    Building2,
    Users,
    Search,
    X,
    ZoomIn,
    ZoomOut,
    Scan,
    FileSpreadsheet,
    Maximize2,
    Minimize2,
    Move,
    Phone,
    Mail,
    Focus,
    Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../../../../components/CustomSelect';
import OrgChartNode from './OrgChartNode';

const OrgChartCanvas = ({
    orgChartTree,
    orgChartViewMode = 'full',
    setOrgChartViewMode,
    focusedCompany = '',
    setFocusedCompany,
    uniqueParties = [],
    canWrite = true,
    onJumpToCompany,
    onAddCompany,
    onSwitchToDirectory
}) => {
    // Navigation state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [chartSearchQuery, setChartSearchQuery] = useState('');

    const chartContainerRef = useRef(null);
    const canvasContentRef = useRef(null);
    const isPanningRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const panStartRef = useRef({ x: 0, y: 0 });
    const hasDraggedRef = useRef(false);

    // Zoom Controls
    const handleZoomIn = useCallback(() => {
        if (!chartContainerRef.current) return;
        const rect = chartContainerRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        setZoom((prevZoom) => {
            const nextZoom = Math.min(2.5, +(prevZoom * 1.2).toFixed(2));
            setPan((prevPan) => {
                const worldX = (cx - prevPan.x) / prevZoom;
                const worldY = (cy - prevPan.y) / prevZoom;
                return {
                    x: Math.round(cx - worldX * nextZoom),
                    y: Math.round(cy - worldY * nextZoom)
                };
            });
            return nextZoom;
        });
    }, []);

    const handleZoomOut = useCallback(() => {
        if (!chartContainerRef.current) return;
        const rect = chartContainerRef.current.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        setZoom((prevZoom) => {
            const nextZoom = Math.max(0.12, +(prevZoom / 1.2).toFixed(2));
            setPan((prevPan) => {
                const worldX = (cx - prevPan.x) / prevZoom;
                const worldY = (cy - prevPan.y) / prevZoom;
                return {
                    x: Math.round(cx - worldX * nextZoom),
                    y: Math.round(cy - worldY * nextZoom)
                };
            });
            return nextZoom;
        });
    }, []);

    const handleResetZoom = useCallback(() => {
        if (!chartContainerRef.current || !canvasContentRef.current) {
            setZoom(1);
            setPan({ x: 0, y: 40 });
            return;
        }
        const container = chartContainerRef.current.getBoundingClientRect();
        const content = canvasContentRef.current;
        const treeW = content.scrollWidth || 1000;
        const nextX = Math.round((container.width - treeW) / 2);
        setZoom(1);
        setPan({ x: nextX, y: 50 });
    }, []);

    const handleFitToScreen = useCallback(() => {
        if (!chartContainerRef.current || !canvasContentRef.current) return;
        const container = chartContainerRef.current.getBoundingClientRect();
        const content = canvasContentRef.current;

        const treeW = content.scrollWidth || 1000;
        const treeH = content.scrollHeight || 650;

        const padX = 60;
        const padY = 60;
        const availW = Math.max(300, container.width - padX);
        const availH = Math.max(200, container.height - padY);

        const scale = Math.min(1.15, Math.max(0.12, Math.min(availW / treeW, availH / treeH)));
        const nextZoom = +scale.toFixed(2);

        const nextX = Math.round((container.width - treeW * nextZoom) / 2);
        const nextY = Math.max(30, Math.round((container.height - treeH * nextZoom) / 4));

        setZoom(nextZoom);
        setPan({ x: nextX, y: nextY });
    }, []);

    // Drag / Pan Handlers
    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0 && e.button !== 1) return;
        if (e.target.closest('button, input, a, select')) return;

        isPanningRef.current = true;
        setIsPanning(true);
        hasDraggedRef.current = false;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        panStartRef.current = { ...pan };

        const onMouseMove = (moveEvent) => {
            if (!isPanningRef.current) return;
            const dx = moveEvent.clientX - dragStartRef.current.x;
            const dy = moveEvent.clientY - dragStartRef.current.y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasDraggedRef.current = true;
            }
            setPan({
                x: panStartRef.current.x + dx,
                y: panStartRef.current.y + dy
            });
        };

        const onMouseUp = () => {
            isPanningRef.current = false;
            setIsPanning(false);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [pan]);

    // Spacebar Grab & Wheel Zoom Listeners
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code === 'Space' && !e.repeat && !e.target.closest('input, textarea, select')) {
                setIsSpacePressed(true);
            }
        };
        const onKeyUp = (e) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container) return;

        const onWheel = (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const factor = e.deltaY < 0 ? 1.12 : 0.88;
                setZoom((prevZoom) => {
                    const nextZoom = Math.min(2.5, Math.max(0.12, +(prevZoom * factor).toFixed(2)));
                    setPan((prevPan) => {
                        const worldX = (mouseX - prevPan.x) / prevZoom;
                        const worldY = (mouseY - prevPan.y) / prevZoom;
                        return {
                            x: Math.round(mouseX - worldX * nextZoom),
                            y: Math.round(mouseY - worldY * nextZoom)
                        };
                    });
                    return nextZoom;
                });
            } else {
                setPan((prev) => ({
                    x: Math.round(prev.x - e.deltaX),
                    y: Math.round(prev.y - e.deltaY)
                }));
            }
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', onWheel);
        };
    }, []);

    // Auto-fit on initial render or when tree changes
    useEffect(() => {
        const timer = setTimeout(() => {
            handleFitToScreen();
        }, 150);
        return () => clearTimeout(timer);
    }, [handleFitToScreen, orgChartTree?.children?.length, uniqueParties?.length]);

    return (
        <div
            ref={chartContainerRef}
            onMouseDown={handleMouseDown}
            className={`h-full flex flex-col relative bg-slate-50 dark:bg-black text-slate-900 dark:text-white overflow-hidden select-none border-t border-gray-200 dark:border-white/10 ${
                isFullscreen ? 'fixed inset-0 z-50 p-6 bg-slate-50 dark:bg-black' : ''
            }`}
            style={{
                cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'grab'
            }}
        >
            {/* View Mode Switcher & Search (Top Left) */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-1.5 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/90 dark:border-white/10 shadow-md shadow-slate-200/50 dark:shadow-none max-w-[calc(100%-380px)]">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setOrgChartViewMode('full')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                            orgChartViewMode === 'full'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                        }`}
                        title="Complete project hierarchy including all company teams"
                    >
                        <Network size={13} />
                        <span>Full Hierarchy</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setOrgChartViewMode('governance')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                            orgChartViewMode === 'governance'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                        }`}
                        title="Project governance chain of command (Parties only)"
                    >
                        <Building2 size={13} />
                        <span>Project Governance</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setOrgChartViewMode('company');
                            if (!focusedCompany && uniqueParties.length > 0) {
                                setFocusedCompany(uniqueParties[0].name);
                            }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                            orgChartViewMode === 'company'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                        }`}
                        title="Focus on a single company to inspect its internal team hierarchy"
                    >
                        <Users size={13} />
                        <span>Company Focus</span>
                    </button>
                </div>

                {orgChartViewMode === 'company' && (
                    <>
                        <div className="w-px h-4 bg-slate-200 dark:bg-white/10 my-auto" />
                        <div className="w-64">
                            <CustomSelect
                                value={focusedCompany}
                                options={uniqueParties.map((p) => ({
                                    value: p.name,
                                    label: `${p.name} (${p.category})`
                                }))}
                                placeholder="-- Select Company --"
                                onChange={(e) => {
                                    const val = typeof e === 'object' && e?.target ? e.target.value : e;
                                    setFocusedCompany(val);
                                }}
                                buttonClassName="w-full flex items-center justify-between px-2.5 py-1 bg-slate-50 dark:bg-[#1a1a1a] hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-normal text-slate-800 dark:text-slate-200 transition cursor-pointer text-left h-7"
                            />
                        </div>
                    </>
                )}

                <div className="w-px h-4 bg-slate-200 dark:bg-white/10 my-auto" />

                {/* Search bar on canvas */}
                <div className="relative flex items-center">
                    <Search size={12} className="absolute left-2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search company or person..."
                        value={chartSearchQuery}
                        onChange={(e) => setChartSearchQuery(e.target.value)}
                        className="pl-6 pr-6 py-0.5 text-xs bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 w-44"
                    />
                    {chartSearchQuery && (
                        <button
                            type="button"
                            onClick={() => setChartSearchQuery('')}
                            className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>

                {/* Total Companies Count Badge */}
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                    {uniqueParties.length} Companies
                </span>
            </div>

            {/* Figma-Style Floating Toolbar (Top Right) */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md px-1.5 py-1 rounded-xl border border-slate-200/90 dark:border-white/10 shadow-md shadow-slate-200/50 dark:shadow-none">
                <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition cursor-pointer"
                    title="Zoom Out (Ctrl + -)"
                >
                    <ZoomOut size={15} />
                </button>
                <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition cursor-pointer"
                    title="Zoom In (Ctrl + +)"
                >
                    <ZoomIn size={15} />
                </button>
                <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition cursor-pointer"
                    title="Reset Zoom to 100%"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button
                    type="button"
                    onClick={handleFitToScreen}
                    className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition cursor-pointer"
                    title="Fit to Screen"
                >
                    <Scan size={15} />
                </button>
                <div className="w-px h-4 bg-slate-200 dark:bg-white/10 my-auto" />
                {canWrite && onAddCompany && (
                    <>
                        <button
                            type="button"
                            onClick={onAddCompany}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Add a new company/party to directory"
                        >
                            <Plus size={13} className="stroke-[3]" />
                            <span>Add Company</span>
                        </button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-white/10 my-auto" />
                    </>
                )}
                <button
                    type="button"
                    onClick={onSwitchToDirectory}
                    className="px-2 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-white/10 rounded-lg transition cursor-pointer flex items-center gap-1"
                    title="Switch to spreadsheet editor"
                >
                    <FileSpreadsheet size={13} />
                    <span>Edit Grid</span>
                </button>
                <div className="w-px h-4 bg-slate-200 dark:bg-white/10 my-auto" />
                <button
                    type="button"
                    onClick={() => setIsFullscreen((prev) => !prev)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition cursor-pointer"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
            </div>

            {/* Floating Navigation Shortcut Pill (Bottom Center) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none text-[11px] font-medium text-slate-600 dark:text-slate-400 select-none pointer-events-none">
                <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                    <Move size={12} className="text-blue-500" /> Click & Drag to Pan
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span>Ctrl + Scroll to Zoom</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[10px] font-mono border border-slate-200 dark:border-white/10">Space</kbd> + Drag
                </span>
            </div>

            {/* Chart Hierarchy Canvas Viewport */}
            <div className="flex-1 w-full h-full relative overflow-hidden select-none">
                <div
                    ref={canvasContentRef}
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                        transition: isPanning ? 'none' : 'transform 0.12s ease-out'
                    }}
                    className="absolute top-0 left-0 min-w-max pb-24"
                >
                    <OrgChartNode
                        node={orgChartTree}
                        onSelect={(node) => {
                            if (hasDraggedRef.current) return;
                            setSelectedNode(node);
                        }}
                        selectedNodeId={selectedNode?.id}
                        level={0}
                        isFirst={true}
                        isLast={true}
                        parentHasMany={false}
                        hasDraggedRef={hasDraggedRef}
                        searchQuery={chartSearchQuery}
                    />

                    {(!orgChartTree?.children || orgChartTree.children.length === 0) && (
                        <div className="mt-8 flex flex-col items-center justify-center p-6 bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-md rounded-2xl border border-dashed border-slate-300 dark:border-white/15 max-w-sm mx-auto text-center shadow-xs">
                            <Building2 size={28} className="text-blue-500 mb-2" />
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Companies or Contractors Linked</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                                Add project contractors, consultants, or clients to view their organizational structure.
                            </p>
                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={onAddCompany || onSwitchToDirectory}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                                >
                                    <Plus size={13} />
                                    <span>Add First Company</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Node Details Slide-out Popover */}
            <AnimatePresence>
                {selectedNode && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="absolute bottom-4 right-4 z-30 w-84 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 space-y-3 text-left text-slate-900 dark:text-white"
                    >
                        <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                                <span className="text-[9px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                    {selectedNode.type === 'project'
                                        ? 'Project Root'
                                        : selectedNode.type === 'person'
                                            ? 'Team Member'
                                            : selectedNode.category || 'Party'}
                                </span>
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                                    {selectedNode.name}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedNode(null)}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                            {selectedNode.role && (
                                <div>
                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                                        Role / Designation:
                                    </span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{selectedNode.role}</span>
                                </div>
                            )}

                            {selectedNode.party_name && (
                                <div>
                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                                        Company / Party:
                                    </span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{selectedNode.party_name}</span>
                                </div>
                            )}

                            {selectedNode.responsibilities && (
                                <div>
                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                                        Responsibilities:
                                    </span>
                                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed italic">
                                        {selectedNode.responsibilities}
                                    </p>
                                </div>
                            )}

                            {selectedNode.phone && (
                                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                    <Phone size={12} className="text-slate-400 shrink-0" />
                                    <span>{selectedNode.phone}</span>
                                </div>
                            )}

                            {selectedNode.email && (
                                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                    <Mail size={12} className="text-slate-400 shrink-0" />
                                    <span>{selectedNode.email}</span>
                                </div>
                            )}

                            {selectedNode.children && selectedNode.children.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Subordinates & Team ({selectedNode.children.length}):
                                        </span>
                                        {canWrite && (
                                            <button
                                                type="button"
                                                onClick={() => onJumpToCompany(selectedNode.party_name || selectedNode.name, true)}
                                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-0.5 cursor-pointer"
                                            >
                                                <Plus size={10} />
                                                <span>Add Member</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                        {selectedNode.children.map((c, i) => (
                                            <div
                                                key={c.id || i}
                                                className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[11px]"
                                            >
                                                <div className="truncate">
                                                    <span className="font-semibold text-slate-900 dark:text-white block truncate">
                                                        {c.name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                                        {c.role || 'Team Member'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-1 flex-wrap">
                            {(selectedNode.type === 'party' || selectedNode.type === 'client' || selectedNode.party_name) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const company = selectedNode.party_name || selectedNode.name;
                                        if (company) {
                                            setFocusedCompany(company);
                                            setOrgChartViewMode('company');
                                        }
                                    }}
                                    className="flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-semibold cursor-pointer"
                                    title="Focus on this company's internal team tree"
                                >
                                    <Focus size={11} />
                                    <span>Focus Company</span>
                                </button>
                            )}

                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const company =
                                            selectedNode.party_name ||
                                            (selectedNode.type === 'party' ? selectedNode.name : '');
                                        onJumpToCompany(company, true);
                                    }}
                                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold cursor-pointer"
                                >
                                    <Users size={12} />
                                    <span>+ Personnel</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onSwitchToDirectory}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold cursor-pointer ml-auto"
                            >
                                <FileSpreadsheet size={12} />
                                <span>Edit Grid</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default OrgChartCanvas;
